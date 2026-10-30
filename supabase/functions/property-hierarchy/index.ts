import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const buildingColumns = "id, property_id, name, building_code, sort_order";
const floorColumns = "id, property_id, building_id, floor_label, floor_code, sort_order";

type JsonBody = Record<string, unknown>;

function response(req: Request, body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function validId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function validPropertyId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 120;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/<[^>]*>/g, "").slice(0, maxLength);
  return result || null;
}

function sortOrder(value: unknown): number | null {
  if (value == null || value === "") return 0;
  const result = Number(value);
  return Number.isInteger(result) && result >= 0 && result <= 10000 ? result : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req.headers.get("origin")) });
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

  let body: JsonBody;
  try {
    body = await req.json();
  } catch {
    return response(req, { error: "invalid_json" }, 400);
  }

  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : body.property_id;
  if (!validPropertyId(propertyId)) return response(req, { error: "invalid_property_id" }, 400);
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "list") {
    const [buildingsResult, floorsResult] = await Promise.all([
      supabase.from("property_buildings").select(buildingColumns).eq("property_id", propertyId).order("sort_order").order("name"),
      supabase.from("property_floors").select(floorColumns).eq("property_id", propertyId).order("sort_order").order("floor_label"),
    ]);
    if (buildingsResult.error || floorsResult.error) return response(req, { error: "hierarchy_list_failed" }, 500);
    return response(req, { buildings: buildingsResult.data || [], floors: floorsResult.data || [] });
  }

  const table = action === "create_building" || action === "update_building" || action === "delete_building"
    ? "property_buildings"
    : action === "create_floor" || action === "update_floor" || action === "delete_floor"
      ? "property_floors"
      : null;
  if (!table) return response(req, { error: "unknown_action" }, 400);

  const isBuilding = table === "property_buildings";
  const entityId = body.id;
  if (action.startsWith("update_") || action.startsWith("delete_")) {
    if (!validId(entityId)) return response(req, { error: "invalid_id" }, 400);
    const { data: existing, error } = await supabase.from(table).select("id")
      .eq("id", entityId).eq("property_id", propertyId).maybeSingle();
    if (error) return response(req, { error: "hierarchy_lookup_failed" }, 500);
    if (!existing) return response(req, { error: "hierarchy_item_not_found" }, 404);
  }

  if (!isBuilding && action !== "delete_floor") {
    if (!validId(body.building_id)) return response(req, { error: "building_required" }, 400);
    const { data: building, error } = await supabase
      .from("property_buildings")
      .select("id")
      .eq("id", body.building_id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error) return response(req, { error: "building_lookup_failed" }, 500);
    if (!building) return response(req, { error: "building_not_found" }, 404);
  }

  if (action === "delete_building") {
    const { data: floors, error: floorError } = await supabase
      .from("property_floors").select("id").eq("building_id", entityId).eq("property_id", propertyId).limit(1);
    if (floorError) return response(req, { error: "hierarchy_delete_check_failed" }, 500);
    const { data: units, error: unitError } = await supabase
      .from("property_units").select("id").eq("building_id", entityId).eq("property_id", propertyId).limit(1);
    if (unitError) return response(req, { error: "hierarchy_delete_check_failed" }, 500);
    const { data: media, error: mediaError } = await supabase
      .from("property_media").select("id").eq("building_id", entityId).eq("property_id", propertyId).limit(1);
    if (mediaError) return response(req, { error: "hierarchy_delete_check_failed" }, 500);
    if (floors?.length || units?.length || media?.length) return response(req, { error: "building_in_use" }, 409);
  }

  if (action === "delete_floor") {
    const { data: units, error: unitError } = await supabase
      .from("property_units").select("id").eq("floor_id", entityId).eq("property_id", propertyId).limit(1);
    if (unitError) return response(req, { error: "hierarchy_delete_check_failed" }, 500);
    const { data: media, error: mediaError } = await supabase
      .from("property_media").select("id").eq("floor_id", entityId).eq("property_id", propertyId).limit(1);
    if (mediaError) return response(req, { error: "hierarchy_delete_check_failed" }, 500);
    if (units?.length || media?.length) return response(req, { error: "floor_in_use" }, 409);
  }

  if (action.startsWith("create_") || action.startsWith("update_")) {
    const label = cleanText(isBuilding ? body.name : body.floor_label, 100);
    const code = cleanText(isBuilding ? body.building_code : body.floor_code, 40);
    const order = sortOrder(body.sort_order);
    if (!label || order === null) return response(req, { error: "invalid_hierarchy_payload" }, 400);
    const values: JsonBody = {
      [isBuilding ? "name" : "floor_label"]: label,
      [isBuilding ? "building_code" : "floor_code"]: code,
      sort_order: order,
    };
    if (!isBuilding) values.building_id = body.building_id;

    const query = action.startsWith("create_")
      ? supabase.from(table).insert({ property_id: propertyId, ...values })
      : supabase.from(table).update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", entityId).eq("property_id", propertyId);
    const { data, error } = await query.select(isBuilding ? buildingColumns : floorColumns).maybeSingle();
    if (error) {
      if (error.code === "23505") return response(req, { error: "hierarchy_code_exists" }, 409);
      if (error.code === "23503") return response(req, { error: "hierarchy_reference_conflict" }, 409);
      return response(req, { error: "hierarchy_save_failed" }, 500);
    }
    if (!data) return response(req, { error: "hierarchy_item_not_found" }, 404);
    return response(req, { [isBuilding ? "building" : "floor"]: data }, action.startsWith("create_") ? 201 : 200);
  }

  const { error } = await supabase.from(table).delete().eq("id", entityId).eq("property_id", propertyId);
  if (error) {
    if (error.code === "23503") return response(req, { error: "hierarchy_reference_conflict" }, 409);
    return response(req, { error: "hierarchy_delete_failed" }, 500);
  }
  return response(req, { ok: true });
});
