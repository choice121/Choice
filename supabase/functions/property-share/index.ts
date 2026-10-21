import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      const token = body.token;
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Missing token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compute sha256 hash of token
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Find share
      const { data: shareData, error: shareError } = await supabase
        .from("property_shares")
        .select("id, expires_at")
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .single();

      if (shareError || !shareData) {
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

      // Fetch properties
      const { data: properties, error: propError } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);

      if (propError) {
        return new Response(
          JSON.stringify({ error: propError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch photos for these properties
      const { data: photos, error: photoError } = await supabase
        .from("property_photos")
        .select("id, property_id, url, display_order, is_hero")
        .in("property_id", propertyIds)
        .order("display_order", { ascending: true });

      const photoMap: Record<string, Array<Record<string, unknown>>> = {};
      if (photos) {
        photos.forEach(ph => {
          photoMap[ph.property_id] = photoMap[ph.property_id] || [];
          photoMap[ph.property_id].push(ph);
        });
      }

      const enriched = (properties || []).map(prop => ({
        ...prop,
        property_photos: photoMap[prop.id] || []
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
      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "Missing property_ids" }),
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

      await supabase.from("property_shares").insert({
        id: shareId,
        token_hash: tokenHash,
        expires_at: expiresAt
      });

      const shareLinks = propertyIds.map(pId => ({
        share_id: shareId,
        property_id: pId
      }));

      await supabase.from("property_share_properties").insert(shareLinks);

      return new Response(
        JSON.stringify({ token: rawToken }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revoke") {
      const token = body.token;
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Missing token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: shareData } = await supabase
        .from("property_shares")
        .select("id")
        .eq("token_hash", tokenHash)
        .single();

      if (shareData) {
        await supabase.from("property_share_properties").delete().eq("share_id", shareData.id);
        await supabase.from("property_shares").delete().eq("id", shareData.id);
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
