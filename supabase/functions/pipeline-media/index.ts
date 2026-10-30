import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const MEDIA_KINDS = new Set(["floor_plan", "video", "virtual_tour", "tour_3d"]);
const MAX_MEDIA_ITEMS = 60;

type MediaItem = {
  kind: string;
  title: string;
  floor_label: string | null;
  building_name: string | null;
  unit_number: string | null;
  provider: string | null;
  url: string;
  poster_url: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
};

function response(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function safeUrl(value: unknown, optional = false): string | null {
  if ((value == null || value === "") && optional) return null;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeMedia(value: unknown): MediaItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_MEDIA_ITEMS) return null;
  const result: MediaItem[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.kind !== "string" || !MEDIA_KINDS.has(item.kind)) return null;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
    const url = safeUrl(item.url);
    const posterUrl = safeUrl(item.poster_url, true);
    if (!title || !url || (item.poster_url && !posterUrl)) return null;

    const key = `${item.kind}::${url.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      kind: item.kind,
      title,
      floor_label: typeof item.floor_label === "string" ? item.floor_label.trim().slice(0, 60) || null : null,
      building_name: typeof item.building_name === "string" ? item.building_name.trim().slice(0, 100) || null : null,
      unit_number: typeof item.unit_number === "string" ? item.unit_number.trim().slice(0, 40) || null : null,
      provider: typeof item.provider === "string" ? item.provider.trim().slice(0, 60) || null : null,
      url,
      poster_url: posterUrl,
      display_order: result.length,
      metadata: item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? item.metadata as Record<string, unknown>
        : {},
    });
  }

  return result;
}

function parseOriginalData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Preserve malformed legacy payloads under a dedicated key.
    }
    return { legacy_original_data: value };
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req.headers.get("origin")) });
  }
  if (req.method !== "POST") return response(req, { error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response(req, { error: "server_not_configured" }, 500);

  const tokenMatch = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return response(req, { error: "admin_auth_required" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) return response(req, { error: "admin_auth_required" }, 401);

  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (adminError) return response(req, { error: "admin_check_failed" }, 500);
  if (!adminRole) return response(req, { error: "admin_required" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return response(req, { error: "invalid_json" }, 400);
  }

  const pipelineId = typeof body.pipeline_id === "string" ? body.pipeline_id.trim() : "";
  if (!pipelineId) return response(req, { error: "pipeline_id_required" }, 400);
  const media = normalizeMedia(body.media);
  if (!media) return response(req, { error: "invalid_media_payload" }, 400);

  const { data: listing, error: listingError } = await supabase
    .schema("pipeline")
    .from("pipeline_properties")
    .select("id, status, original_data, edited_fields")
    .eq("id", pipelineId)
    .maybeSingle();
  if (listingError) return response(req, { error: "pipeline_listing_lookup_failed" }, 500);
  if (!listing) return response(req, { error: "pipeline_listing_not_found" }, 404);
  if (listing.status === "published" || listing.status === "archived") {
    return response(req, { error: "pipeline_listing_not_editable" }, 409);
  }

  const originalData = parseOriginalData(listing.original_data);
  originalData.media = media;
  const legacyTour = media.find(item => item.kind === "virtual_tour" || item.kind === "tour_3d")?.url ?? null;
  const editedFields = new Set<string>();
  if (typeof listing.edited_fields === "string") {
    try {
      const parsed = JSON.parse(listing.edited_fields);
      if (Array.isArray(parsed)) parsed.forEach(field => { if (typeof field === "string") editedFields.add(field); });
    } catch {
      // Replace malformed edited-field metadata with a clean list.
    }
  } else if (Array.isArray(listing.edited_fields)) {
    listing.edited_fields.forEach((field: unknown) => { if (typeof field === "string") editedFields.add(field); });
  }
  editedFields.add("media");

  const { error: updateError } = await supabase
    .schema("pipeline")
    .from("pipeline_properties")
    .update({
      original_data: JSON.stringify(originalData),
      virtual_tour_url: legacyTour,
      edited_fields: JSON.stringify([...editedFields]),
      status: listing.status === "scraped" ? "edited" : listing.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pipelineId);
  if (updateError) return response(req, { error: "pipeline_media_save_failed" }, 500);

  return response(req, { ok: true, media, virtual_tour_url: legacyTour });
});
