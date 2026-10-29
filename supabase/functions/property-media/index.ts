import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const mediaKinds = new Set(["floor_plan", "video", "virtual_tour", "tour_3d"]);
const mediaColumns = "id, property_id, kind, title, floor_label, provider, url, file_id, poster_url, display_order, metadata, created_at, updated_at";

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeUrl(value: unknown, optional = false): string | null {
  if ((value == null || value === "") && optional) return null;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response({ error: "server_not_configured" }, 500);

  const bearer = req.headers.get("authorization") || "";
  const tokenMatch = bearer.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return response({ error: "admin_auth_required" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) return response({ error: "admin_auth_required" }, 401);

  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (adminError) return response({ error: "admin_check_failed" }, 500);
  if (!adminRole) return response({ error: "admin_required" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return response({ error: "invalid_json" }, 400);
  }

  const action = body.action;
  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";
  if (!propertyId) return response({ error: "property_id_required" }, 400);

  if (action === "list") {
    const { data, error } = await supabase
      .from("property_media")
      .select(mediaColumns)
      .eq("property_id", propertyId)
      .order("display_order")
      .order("created_at");
    if (error) return response({ error: "media_list_failed", detail: error.message }, 500);
    return response({ media: data || [] });
  }

  if (action === "set_unit_floor") {
    const unitFloor = typeof body.unit_floor === "string" ? body.unit_floor.trim().slice(0, 60) || null : null;
    const { data, error } = await supabase
      .from("properties")
      .update({ unit_floor: unitFloor, updated_at: new Date().toISOString() })
      .eq("id", propertyId)
      .select("id, unit_floor")
      .single();
    if (error) return response({ error: "unit_floor_update_failed", detail: error.message }, 500);
    return response({ property: data });
  }

  if (action === "create") {
    const kind = body.kind;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const url = safeUrl(body.url);
    if (typeof kind !== "string" || !mediaKinds.has(kind)) return response({ error: "invalid_media_kind" }, 400);
    if (!title) return response({ error: "title_required" }, 400);
    if (!url) return response({ error: "https_url_required" }, 400);

    const posterUrl = safeUrl(body.poster_url, true);
    if (body.poster_url && !posterUrl) return response({ error: "invalid_poster_url" }, 400);
    const { data, error } = await supabase
      .from("property_media")
      .insert({
        property_id: propertyId,
        kind,
        title,
        floor_label: typeof body.floor_label === "string" ? body.floor_label.trim().slice(0, 60) || null : null,
        provider: typeof body.provider === "string" ? body.provider.trim().slice(0, 60) || null : null,
        url,
        file_id: typeof body.file_id === "string" ? body.file_id.slice(0, 255) || null : null,
        poster_url: posterUrl,
        display_order: Number.isInteger(body.display_order) ? body.display_order : 0,
        metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
      })
      .select(mediaColumns)
      .single();
    if (error) return response({ error: "media_create_failed", detail: error.message }, 500);
    return response({ media: data }, 201);
  }

  const mediaId = typeof body.id === "string" ? body.id : "";
  if (!mediaId) return response({ error: "media_id_required" }, 400);

  if (action === "update") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 120);
    if (typeof body.floor_label === "string") patch.floor_label = body.floor_label.trim().slice(0, 60) || null;
    if (typeof body.provider === "string") patch.provider = body.provider.trim().slice(0, 60) || null;
    if (Number.isInteger(body.display_order)) patch.display_order = body.display_order;
    if (Object.hasOwn(body, "poster_url")) {
      const posterUrl = safeUrl(body.poster_url, true);
      if (body.poster_url && !posterUrl) return response({ error: "invalid_poster_url" }, 400);
      patch.poster_url = posterUrl;
    }
    if (Object.hasOwn(body, "url")) {
      const url = safeUrl(body.url);
      if (!url) return response({ error: "https_url_required" }, 400);
      patch.url = url;
    }
    const { data, error } = await supabase
      .from("property_media")
      .update(patch)
      .eq("id", mediaId)
      .eq("property_id", propertyId)
      .select(mediaColumns)
      .single();
    if (error) return response({ error: "media_update_failed", detail: error.message }, 500);
    return response({ media: data });
  }

  if (action === "reorder") {
    const ids = Array.isArray(body.ids) ? body.ids : (Array.isArray(body.order) ? body.order : null);
    if (!ids || ids.length > 100 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
      return response({ error: "invalid_media_order" }, 400);
    }
    const { data: existing, error: existingError } = await supabase
      .from("property_media")
      .select("id")
      .eq("property_id", propertyId);
    if (existingError) return response({ error: "media_order_load_failed", detail: existingError.message }, 500);
    const existingIds = new Set((existing || []).map((item) => item.id));
    if (ids.some((id) => !existingIds.has(id))) {
      return response({ error: "media_order_mismatch" }, 400);
    }
    for (const [displayOrder, id] of ids.entries()) {
      const { error } = await supabase
        .from("property_media")
        .update({ display_order: displayOrder, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) return response({ error: "media_order_save_failed", detail: error.message }, 500);
    }
    return response({ saved: true });
  }

  if (action === "delete") {
    const { data: existing, error: lookupError } = await supabase
      .from("property_media")
      .select("id, file_id")
      .eq("id", mediaId)
      .eq("property_id", propertyId)
      .single();
    if (lookupError || !existing) return response({ error: "media_not_found" }, 404);
    const { error } = await supabase
      .from("property_media")
      .delete()
      .eq("id", mediaId)
      .eq("property_id", propertyId);
    if (error) return response({ error: "media_delete_failed", detail: error.message }, 500);
    return response({ deleted: true, file_id: existing.file_id || null });
  }

  return response({ error: "unknown_action" }, 400);
});