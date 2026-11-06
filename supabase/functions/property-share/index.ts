/// <reference lib="deno.ns" />

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const SHARE_ALIAS_RE = /^[a-z0-9]+(?:-[a-z0-9]+){1,4}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeShareAlias(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function callSupabaseRest(baseUrl: string, path: string, options: RequestInit = {}, authType: "service" | "anon" = "service") {
  const headers = new Headers(options.headers || {});
  const supabaseKey = authType === "service"
    ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    : (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

  if (!supabaseKey) {
    throw new Error("Missing Supabase key");
  }

  headers.set("apikey", supabaseKey);
  headers.set("Authorization", `Bearer ${supabaseKey}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload: any = null;
  if (text && text.trim()) {
    const trimmed = text.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        payload = JSON.parse(trimmed);
      } catch {
        payload = { raw: trimmed };
      }
    } else {
      payload = { raw: trimmed };
    }
  }

  if (!response.ok) {
    const message = payload && (payload.message || payload.error || payload.details)
      ? payload.message || payload.error || payload.details
      : (typeof payload?.raw === "string" && payload.raw.trim())
        ? payload.raw.trim()
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
}

async function getAuthUser(baseUrl: string, jwt: string) {
  const headers = new Headers();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${jwt}`);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers,
  });
  const text = await response.text();
  let payload: any = null;
  if (text && text.trim()) {
    const trimmed = text.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        payload = JSON.parse(trimmed);
      } catch {
        payload = { raw: trimmed };
      }
    } else {
      payload = { raw: trimmed };
    }
  }
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Auth validation failed");
  }
  return payload?.user || null;
}

async function findShareByTokenOrAlias(baseUrl: string, tokenOrAlias: string) {
  const value = String(tokenOrAlias || "").trim();
  if (!value) return null;

  if (SHARE_TOKEN_RE.test(value)) {
    const tokenHash = await hashShareToken(value);
    const result = await callSupabaseRest(baseUrl, `/rest/v1/property_shares?select=id,expires_at,share_alias&token_hash=eq.${encodeURIComponent(tokenHash)}&revoked_at=is.null`, {}, "service");
    if (!Array.isArray(result) || !result.length) return null;
    return result[0];
  }

  const alias = normalizeShareAlias(value);
  if (!alias || alias.length < 6 || !SHARE_ALIAS_RE.test(alias)) return null;

  const result = await callSupabaseRest(baseUrl, `/rest/v1/property_shares?select=id,expires_at,share_alias&share_alias=eq.${encodeURIComponent(alias)}&revoked_at=is.null`, {}, "service");
  if (!Array.isArray(result) || !result.length) return null;
  return result[0];
}

function makeJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!baseUrl || !serviceRoleKey) {
      return makeJsonResponse({ error: "Missing environment variables" }, 500);
    }

    const body = await req.json();
    const action = body.action;

    if (action === "resolve") {
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!token) {
        return makeJsonResponse({ error: "invalid_share_token" }, 400);
      }

      const shareData = await findShareByTokenOrAlias(baseUrl, token);
      if (!shareData) {
        return makeJsonResponse({ error: "share_not_found" }, 404);
      }

      if (new Date(shareData.expires_at) < new Date()) {
        return makeJsonResponse({ error: "share_expired" }, 410);
      }

      const linkRows = await callSupabaseRest(baseUrl, `/rest/v1/property_share_properties?select=property_id&share_id=eq.${encodeURIComponent(shareData.id)}`, {}, "service");
      if (!Array.isArray(linkRows) || linkRows.length === 0) {
        return makeJsonResponse({ properties: [] }, 200);
      }
      if (linkRows.length > 100) {
        return makeJsonResponse({ error: "share_property_limit_exceeded" }, 409);
      }

      const propertyIds = linkRows.map((entry: any) => entry.property_id);
      const propertyQuery = new URLSearchParams({
        select: "id,title,description,address,city,state,zip,county,neighborhood,lat,lng,property_type,year_built,floors,unit_number,total_units,bedrooms,bathrooms,half_bathrooms,total_bathrooms,square_footage,lot_size_sqft,garage_spaces,monthly_rent,security_deposit,application_fee,available_date,lease_terms,minimum_lease_months,pets_allowed,smoking_allowed,parking,parking_fee,amenities,appliances,utilities_included,flooring,heating_type,cooling_type,laundry_type,location_context,virtual_tour_url,has_basement,has_central_air,status,created_at,updated_at,ai_features,is_multi_unit,building_name,price_range,unit_floor,unit_options,community_starting_rent,community_max_rent,community_rent_basis",
        id: `in.(${propertyIds.map((id: unknown) => `"${String(id).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")})`,
        status: "in.(active,private_placement)",
      });
      const properties = await callSupabaseRest(
        baseUrl,
        `/rest/v1/properties?${propertyQuery.toString()}`,
        {},
        "service",
      );

      const shareableProperties = (Array.isArray(properties) ? properties : []).filter((property: any) => property.status === "active" || property.status === "private_placement");
      const shareablePropertyIds = shareableProperties.map((property: any) => property.id);

      let units: Array<Record<string, unknown>> = [];
      let floorPlans: Array<Record<string, unknown>> = [];
      try {
        const [unitRows, floorPlanRows] = await Promise.all([
          shareablePropertyIds.length
            ? callSupabaseRest(
                baseUrl,
                `/rest/v1/property_units?select=id,property_id,unit_number,unit_floor_label,building_name,floor_plan_name,bedrooms,bathrooms,square_footage,monthly_rent,unit_photos,status,rent_basis,source_order,review_status&property_id=in.(${shareablePropertyIds.map((id) => encodeURIComponent(String(id))).join(",")})&status=eq.active&review_status=eq.approved&order=source_order.asc`,
                {},
                "service",
              )
            : Promise.resolve([]),
          shareablePropertyIds.length
            ? callSupabaseRest(
                baseUrl,
                `/rest/v1/property_floor_plans?select=id,property_id,source_plan_id,name,bedrooms,bathrooms,square_footage,starting_rent,rent_basis,image_url,source_order,building_name,status,review_status&property_id=in.(${shareablePropertyIds.map((id) => encodeURIComponent(String(id))).join(",")})&status=eq.active&review_status=eq.approved&order=source_order.asc`,
                {},
                "service",
              )
            : Promise.resolve([]),
        ]);
        units = Array.isArray(unitRows) ? unitRows : [];
        floorPlans = Array.isArray(floorPlanRows) ? floorPlanRows : [];
      } catch (inventoryError) {
        console.warn("[property-share] inventory lookup unavailable:", inventoryError instanceof Error ? inventoryError.message : String(inventoryError));
      }

      const [photos, media] = await Promise.all([
        callSupabaseRest(baseUrl, `/rest/v1/property_photos?select=id,property_id,url,display_order,is_hero&property_id=in.(${propertyIds.map((id) => encodeURIComponent(String(id))).join(",")})&order=display_order.asc`, {}, "service").catch(() => []),
        callSupabaseRest(baseUrl, `/rest/v1/property_media?select=id,property_id,kind,title,floor_label,provider,url,file_id,poster_url,display_order,metadata&property_id=in.(${propertyIds.map((id) => encodeURIComponent(String(id))).join(",")})&order=display_order.asc`, {}, "service").catch(() => []),
      ]);

      const photoMap: Record<string, Array<Record<string, unknown>>> = {};
      const mediaMap: Record<string, Array<Record<string, unknown>>> = {};
      const unitMap: Record<string, Array<Record<string, unknown>>> = {};
      const floorPlanMap: Record<string, Array<Record<string, unknown>>> = {};

      (units || []).forEach((unit: any) => {
        const propertyId = String(unit.property_id);
        unitMap[propertyId] = unitMap[propertyId] || [];
        unitMap[propertyId].push(unit);
      });
      (floorPlans || []).forEach((plan: any) => {
        const propertyId = String(plan.property_id);
        floorPlanMap[propertyId] = floorPlanMap[propertyId] || [];
        floorPlanMap[propertyId].push(plan);
      });
      (photos || []).forEach((photo: any) => {
        photoMap[photo.property_id] = photoMap[photo.property_id] || [];
        photoMap[photo.property_id].push(photo);
      });
      (media || []).forEach((item: any) => {
        mediaMap[item.property_id] = mediaMap[item.property_id] || [];
        mediaMap[item.property_id].push(item);
      });

      const enriched = shareableProperties.map((property: any) => ({
        ...property,
        property_photos: photoMap[property.id] || [],
        property_media: mediaMap[property.id] || [],
        property_units: unitMap[property.id] || [],
        property_floor_plans: floorPlanMap[property.id] || [],
      }));

      return makeJsonResponse({ properties: enriched }, 200);
    }

    if (action === "create") {
      const bearer = req.headers.get("authorization") || "";
      const tokenMatch = bearer.match(/^Bearer\s+(.+)$/i);
      if (!tokenMatch) {
        return makeJsonResponse({ error: "admin_auth_required" }, 401);
      }

      const authUser = await getAuthUser(baseUrl, tokenMatch[1]);
      if (!authUser) {
        return makeJsonResponse({ error: "admin_auth_required" }, 401);
      }

      const adminRoles = await callSupabaseRest(baseUrl, `/rest/v1/admin_roles?select=user_id&user_id=eq.${encodeURIComponent(authUser.id)}`, {}, "service").catch(() => []);
      if (!Array.isArray(adminRoles) || adminRoles.length === 0) {
        return makeJsonResponse({ error: "admin_required" }, 403);
      }

      const propertyIds = body.property_ids;
      if (!Array.isArray(propertyIds) || propertyIds.length === 0 || propertyIds.length > 100) {
        return makeJsonResponse({ error: "property_ids_required_or_too_many" }, 400);
      }

      const uniquePropertyIds = [...new Set(propertyIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 128))];
      if (uniquePropertyIds.length !== propertyIds.length) {
        return makeJsonResponse({ error: "invalid_property_ids" }, 400);
      }

      const properties = await callSupabaseRest(baseUrl, `/rest/v1/properties?select=id,status,city&id=in.(${uniquePropertyIds.map((id) => encodeURIComponent(String(id))).join(",")})`, {}, "service");
      if (!Array.isArray(properties) || properties.length !== uniquePropertyIds.length) {
        return makeJsonResponse({ error: "only_published_properties_can_be_shared" }, 400);
      }

      if (properties.some((property: any) => !["active", "private_placement"].includes(property.status))) {
        return makeJsonResponse({ error: "only_published_properties_can_be_shared" }, 400);
      }

      const rawToken = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const shareId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      await callSupabaseRest(baseUrl, "/rest/v1/property_shares", {
        method: "POST",
        body: JSON.stringify({
          id: shareId,
          token_hash: tokenHash,
          expires_at: expiresAt,
        }),
      }, "service");

      const shareLinks = uniquePropertyIds.map((propertyId) => ({ share_id: shareId, property_id: propertyId }));
      try {
        await callSupabaseRest(baseUrl, "/rest/v1/property_share_properties", {
          method: "POST",
          body: JSON.stringify(shareLinks),
        }, "service");
      } catch (error) {
        await callSupabaseRest(baseUrl, `/rest/v1/property_shares?id=eq.${encodeURIComponent(shareId)}`, { method: "DELETE" }, "service").catch(() => undefined);
        throw error;
      }

      return makeJsonResponse({
        token: rawToken,
        share_url: `https://choice-properties-site.pages.dev/listings.html#share=${encodeURIComponent(rawToken)}`,
      }, 200);
    }

    if (action === "revoke") {
      const bearer = req.headers.get("authorization") || "";
      const tokenMatch = bearer.match(/^Bearer\s+(.+)$/i);
      if (!tokenMatch) {
        return makeJsonResponse({ error: "admin_auth_required" }, 401);
      }

      const authUser = await getAuthUser(baseUrl, tokenMatch[1]);
      if (!authUser) {
        return makeJsonResponse({ error: "admin_auth_required" }, 401);
      }

      const adminRoles = await callSupabaseRest(baseUrl, `/rest/v1/admin_roles?select=user_id&user_id=eq.${encodeURIComponent(authUser.id)}`, {}, "service").catch(() => []);
      if (!Array.isArray(adminRoles) || adminRoles.length === 0) {
        return makeJsonResponse({ error: "admin_required" }, 403);
      }

      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!token) {
        return makeJsonResponse({ error: "invalid_share_token" }, 400);
      }

      const shareData = await findShareByTokenOrAlias(baseUrl, token);
      if (!shareData) {
        return makeJsonResponse({ error: "share_not_found" }, 404);
      }

      await callSupabaseRest(baseUrl, `/rest/v1/property_shares?id=eq.${encodeURIComponent(shareData.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      }, "service");

      return makeJsonResponse({ revoked: true }, 200);
    }

    return makeJsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return makeJsonResponse({ error: message }, 500);
  }
});
