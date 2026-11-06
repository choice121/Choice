/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const SHARE_ALIAS_RE = /^[a-z0-9]+(?:-[a-z0-9]+){1,4}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function findShareByTokenOrAlias(supabase: any, tokenOrAlias: string) {
  const value = String(tokenOrAlias || "").trim();
  if (!value) return null;

  if (SHARE_TOKEN_RE.test(value)) {
    const tokenHash = await hashShareToken(value);
    const { data, error } = await supabase
      .from("property_shares")
      .select("id, expires_at, share_alias")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) {
      console.warn("[property-share] token lookup failed", error.message);
      return null;
    }
    return data;
  }

  const alias = normalizeShareAlias(value);
  if (!alias || alias.length < 6 || !SHARE_ALIAS_RE.test(alias)) return null;

  const { data, error } = await supabase
    .from("property_shares")
    .select("id, expires_at, share_alias")
    .eq("share_alias", alias)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.warn("[property-share] alias lookup failed", error.message);
    return null;
  }
  return data;
}

async function createFriendlyShareAlias(supabase: any, properties: Array<{ city?: string | null }>, tokenHash: string): Promise<string> {
  const cityBase = (properties || [])
    .map((property) => String(property?.city || "").trim())
    .filter(Boolean)
    .sort()[0] || "share";

  const base = normalizeShareAlias(`${cityBase}-${tokenHash.slice(0, 6)}`) || "share";
  let alias = base.length >= 8 ? base : `share-${tokenHash.slice(0, 6)}`;
  alias = normalizeShareAlias(alias);
  if (!alias || alias.length < 6) {
    alias = `share-${tokenHash.slice(0, 6)}`;
  }

  let candidate = alias;
  let suffix = 1;
  while (true) {
    const { data, error } = await supabase
      .from("property_shares")
      .select("id")
      .eq("share_alias", candidate)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }
    if (!data) return candidate;
    candidate = `${alias}-${suffix.toString(36)}`.slice(0, 24);
    suffix += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const action = body.action;

    if (action === "resolve") {
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!token) {
        return new Response(
          JSON.stringify({ error: "invalid_share_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shareData = await findShareByTokenOrAlias(supabase, token);
      if (!shareData) {
        return new Response(
          JSON.stringify({ error: "share_not_found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiry
      if (new Date(shareData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "share_expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get property IDs
      const { data: linkData, error: linkError } = await supabase
        .from("property_share_properties")
        .select("property_id")
        .eq("share_id", shareData.id);

      if (linkError || !linkData || linkData.length === 0) {
        return new Response(
          JSON.stringify({ properties: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const propertyIds = linkData.map(l => l.property_id);

      // Fetch properties - safely project only client-safe public fields
      const { data: properties, error: propError } = await supabase
        .from("properties")
        .select("id, title, description, address, city, state, zip, county, neighborhood, lat, lng, property_type, year_built, floors, unit_number, total_units, bedrooms, bathrooms, half_bathrooms, total_bathrooms, square_footage, lot_size_sqft, garage_spaces, monthly_rent, security_deposit, application_fee, available_date, lease_terms, minimum_lease_months, pets_allowed, smoking_allowed, parking, parking_fee, amenities, appliances, utilities_included, flooring, heating_type, cooling_type, laundry_type, location_context, virtual_tour_url, has_basement, has_central_air, status, created_at, updated_at, ai_features, is_multi_unit, building_name, price_range, unit_floor, unit_options")
        .in("id", propertyIds)
        .in("status", ["active", "private_placement"]);

      if (propError) {
        return new Response(
          JSON.stringify({ error: propError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const shareableProperties = (properties || []).filter(
        (property) => property.status === "active" || property.status === "private_placement",
      );

      // Fetch photos for these properties
      const { data: photos, error: photoError } = await supabase
        .from("property_photos")
        .select("id, property_id, url, display_order, is_hero")
        .in("property_id", propertyIds)
        .order("display_order", { ascending: true });

      const { data: media, error: mediaError } = await supabase
        .from("property_media")
        .select("id, property_id, kind, title, floor_label, provider, url, file_id, poster_url, display_order, metadata")
        .in("property_id", propertyIds)
        .order("display_order", { ascending: true });
      if (mediaError) {
        return new Response(
          JSON.stringify({ error: "property_media_lookup_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const photoMap: Record<string, Array<Record<string, unknown>>> = {};
      const mediaMap: Record<string, Array<Record<string, unknown>>> = {};
      if (photos) {
        photos.forEach(ph => {
          photoMap[ph.property_id] = photoMap[ph.property_id] || [];
          photoMap[ph.property_id].push(ph);
        });
      }

      if (media) {
        media.forEach(item => {
          mediaMap[item.property_id] = mediaMap[item.property_id] || [];
          mediaMap[item.property_id].push(item);
        });
      }

      const enriched = shareableProperties.map(prop => ({
        ...prop,
        property_photos: photoMap[prop.id] || [],
        property_media: mediaMap[prop.id] || []
      }));

      return new Response(
        JSON.stringify({ properties: enriched }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      const bearer = req.headers.get("authorization") || "";
      const tokenMatch = bearer.match(/^Bearer\s+(.+)$/i);
      if (!tokenMatch) {
        return new Response(
          JSON.stringify({ error: "admin_auth_required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: authData, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: "admin_auth_required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: adminRole, error: adminError } = await supabase
        .from("admin_roles")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (adminError) {
        return new Response(
          JSON.stringify({ error: "admin_check_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "admin_required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const propertyIds = body.property_ids;
      if (!Array.isArray(propertyIds) || propertyIds.length === 0 || propertyIds.length > 100) {
        return new Response(
          JSON.stringify({ error: "property_ids_required_or_too_many" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const uniquePropertyIds = [...new Set(propertyIds.filter((id: unknown): id is string =>
        typeof id === "string" && id.length > 0 && id.length <= 128
      ))];
      if (uniquePropertyIds.length !== propertyIds.length) {
        return new Response(
          JSON.stringify({ error: "invalid_property_ids" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: selectedProperties, error: selectedPropertiesError } = await supabase
        .from("properties")
        .select("id, status, city")
        .in("id", uniquePropertyIds);
      if (selectedPropertiesError) {
        return new Response(
          JSON.stringify({ error: "property_validation_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (
        selectedProperties?.length !== uniquePropertyIds.length ||
        selectedProperties.some((property) => !["active", "private_placement"].includes(property.status))
      ) {
        return new Response(
          JSON.stringify({ error: "only_published_properties_can_be_shared" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate random token
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const rawToken = btoa(String.fromCharCode(...randomBytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawToken));
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const shareId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const shareAlias = await createFriendlyShareAlias(supabase, selectedProperties, tokenHash);

      const { error: shareInsertError } = await supabase.from("property_shares").insert({
        id: shareId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        share_alias: shareAlias,
      });
      if (shareInsertError) {
        return new Response(
          JSON.stringify({ error: "share_creation_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shareLinks = uniquePropertyIds.map(pId => ({
        share_id: shareId,
        property_id: pId
      }));

      const { error: linksInsertError } = await supabase.from("property_share_properties").insert(shareLinks);
      if (linksInsertError) {
        await supabase.from("property_shares").delete().eq("id", shareId);
        return new Response(
          JSON.stringify({ error: "share_properties_creation_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          token: rawToken,
          share_alias: shareAlias,
          share_url: `https://choice-properties-site.pages.dev/listings.html#share=${encodeURIComponent(shareAlias)}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revoke") {
      const bearer = req.headers.get("authorization") || "";
      const tokenMatch = bearer.match(/^Bearer\s+(.+)$/i);
      if (!tokenMatch) {
        return new Response(
          JSON.stringify({ error: "admin_auth_required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: authData, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: "admin_auth_required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: adminRole, error: adminError } = await supabase
        .from("admin_roles")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (adminError) {
        return new Response(
          JSON.stringify({ error: "admin_check_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "admin_required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!token) {
        return new Response(
          JSON.stringify({ error: "invalid_share_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shareData = await findShareByTokenOrAlias(supabase, token);
      if (!shareData) {
        return new Response(
          JSON.stringify({ error: "share_not_found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (shareData) {
        const { error: revokeError } = await supabase
          .from("property_shares")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", shareData.id);
        if (revokeError) {
          return new Response(
            JSON.stringify({ error: "share_revoke_failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ revoked: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
