import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const unitColumns = "id, property_id, unit_number, bedrooms, bathrooms, square_footage, monthly_rent, floor_plan_name, floor_plan_image_url, unit_photos, amenities";

type UnitPayload = {
  unit_number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  monthly_rent: number;
  floor_plan_name: string | null;
  floor_plan_image_url: string | null;
  unit_photos: string[];
  amenities: string[];
};

function response(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function optionalNumber(value: unknown, min: number, max: number): number | null | undefined {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

function secureUrl(value: unknown, optional = false): string | null | undefined {
  if ((value == null || value === "") && optional) return null;
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number): string[] | undefined {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const result: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return undefined;
    const item = raw.trim().slice(0, maxLength);
    if (!item) continue;
    result.push(item);
  }
  return result;
}

function normalizePayload(body: Record<string, unknown>): UnitPayload | null {
  const unitNumber = typeof body.unit_number === "string" ? body.unit_number.trim().slice(0, 40) : "";
  const monthlyRent = optionalNumber(body.monthly_rent, 1, 100000);
  const bedrooms = optionalNumber(body.bedrooms, 0, 20);
  const bathrooms = optionalNumber(body.bathrooms, 0, 20);
  const squareFootage = optionalNumber(body.square_footage, 1, 100000);
  const floorPlanImageUrl = secureUrl(body.floor_plan_image_url, true);
  const unitPhotosRaw = Array.isArray(body.unit_photos) ? body.unit_photos : [];
  const unitPhotos = unitPhotosRaw.map(url => secureUrl(url)).filter((url): url is string => typeof url === "string");
  const amenities = normalizeStringList(body.amenities, 80, 80);

  if (
    !unitNumber || monthlyRent === null || monthlyRent === undefined ||
    bedrooms === undefined || bathrooms === undefined || squareFootage === undefined ||
    floorPlanImageUrl === undefined || unitPhotos.length !== unitPhotosRaw.length || !amenities
  ) return null;

  return {
    unit_number: unitNumber,
    bedrooms,
    bathrooms,
    square_footage: squareFootage,
    monthly_rent: monthlyRent,
    floor_plan_name: typeof body.floor_plan_name === "string" ? body.floor_plan_name.trim().slice(0, 120) || null : null,
    floor_plan_image_url: floorPlanImageUrl,
    unit_photos: unitPhotos,
    amenities,
  };
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

  const action = body.action;
  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";
  if (!propertyId) return response(req, { error: "property_id_required" }, 400);

  if (action === "list") {
    const { data, error } = await supabase
      .from("property_units")
      .select(unitColumns)
      .eq("property_id", propertyId)
      .order("unit_number", { ascending: true });
    if (error) return response(req, { error: "unit_list_failed" }, 500);
    return response(req, { units: data || [] });
  }

  if (action === "create" || action === "update") {
    const payload = normalizePayload(body);
    if (!payload) return response(req, { error: "invalid_unit_payload" }, 400);

    if (action === "create") {
      const { data, error } = await supabase
        .from("property_units")
        .insert({ property_id: propertyId, ...payload })
        .select(unitColumns)
        .single();
      if (error) return response(req, { error: error.code === "23505" ? "unit_number_exists" : "unit_create_failed" }, error.code === "23505" ? 409 : 500);
      return response(req, { unit: data }, 201);
    }

    const unitId = typeof body.unit_id === "string" ? body.unit_id.trim() : "";
    if (!unitId) return response(req, { error: "unit_id_required" }, 400);
    const { data, error } = await supabase
      .from("property_units")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .select(unitColumns)
      .maybeSingle();
    if (error) return response(req, { error: "unit_update_failed" }, 500);
    if (!data) return response(req, { error: "unit_not_found" }, 404);
    return response(req, { unit: data });
  }

  if (action === "delete") {
    const unitId = typeof body.unit_id === "string" ? body.unit_id.trim() : "";
    if (!unitId) return response(req, { error: "unit_id_required" }, 400);
    const { error } = await supabase
      .from("property_units")
      .delete()
      .eq("id", unitId)
      .eq("property_id", propertyId);
    if (error) return response(req, { error: "unit_delete_failed" }, 500);
    return response(req, { ok: true });
  }

  return response(req, { error: "unknown_action" }, 400);
});
