import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, corsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { normalizeNearbyPlaces } from "../_shared/location-intelligence.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("Supabase service configuration is missing");
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PARTIAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEOAPIFY_TIMEOUT_MS = 8000;
const GEOAPIFY_CATEGORIES = [
  "education.school",
  "education.college",
  "education.university",
  "leisure.park",
  "commercial.supermarket",
  "commercial.shopping_mall",
  "healthcare",
  "public_transport",
];

type LocationSnapshot = {
  neighborhood: string | null;
  county: string | null;
  city: string | null;
  places: ReturnType<typeof normalizeNearbyPlaces>;
  provider: string;
  attribution: string;
  distance_note: string;
  status: "ok" | "partial";
  fetched_at: string;
};

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchGeoapify(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOAPIFY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[property-location] Geoapify request failed", response.status);
      return { ok: false as const, status: response.status, data: null };
    }
    return { ok: true as const, status: response.status, data: await response.json() };
  } catch (error) {
    console.warn("[property-location] Geoapify request failed", error instanceof Error ? error.name : "unknown_error");
    return { ok: false as const, status: null, data: null };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return corsResponse(origin);
  if (!isAllowedOrigin(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  let body: { property_id?: unknown; share_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }

  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";
  if (!propertyId || propertyId.length > 128) return json({ error: "invalid_property_id" }, 400, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id, status, lat, lng")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) {
    console.error("[property-location] Property lookup failed", propertyError.message);
    return json({ error: "property_lookup_failed" }, 500, origin);
  }
  if (!property) return json({ error: "property_not_found" }, 404, origin);

  if (property.status !== "active") {
    const token = typeof body.share_token === "string" ? body.share_token : "";
    if (property.status !== "private_placement" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return json({ error: "property_not_found" }, 404, origin);
    }
    const { data: share, error: shareError } = await admin
      .from("property_shares")
      .select("id")
      .eq("token_hash", await hashToken(token))
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (shareError) {
      console.error("[property-location] Share lookup failed", shareError.message);
      return json({ error: "share_lookup_failed" }, 500, origin);
    }
    if (!share) return json({ error: "property_not_found" }, 404, origin);
    const { data: link, error: linkError } = await admin
      .from("property_share_properties")
      .select("property_id")
      .eq("share_id", share.id)
      .eq("property_id", property.id)
      .maybeSingle();
    if (linkError) {
      console.error("[property-location] Share-property lookup failed", linkError.message);
      return json({ error: "share_lookup_failed" }, 500, origin);
    }
    if (!link) return json({ error: "property_not_found" }, 404, origin);
  }

  if (!validCoordinate(property.lat, -90, 90) || !validCoordinate(property.lng, -180, 180)) {
    return json({ error: "property_coordinates_unavailable" }, 422, origin);
  }

  const { data: cached, error: cacheError } = await admin
    .from("property_location_intelligence")
    .select("data, fetched_at, expires_at")
    .eq("property_id", property.id)
    .maybeSingle();
  if (cacheError) {
    console.error("[property-location] Cache lookup failed", cacheError.message);
    return json({ error: "location_cache_unavailable" }, 500, origin);
  }
  if (cached && Date.parse(cached.expires_at) > Date.now()) {
    return json({ ...cached.data, fetched_at: cached.fetched_at, stale: false }, 200, origin);
  }

  const apiKey = Deno.env.get("GEOAPIFY_API_KEY");
  if (!apiKey) {
    if (cached) return json({ ...cached.data, fetched_at: cached.fetched_at, stale: true }, 200, origin);
    return json({ error: "location_provider_not_configured" }, 503, origin);
  }

  const placesUrl = new URL("https://api.geoapify.com/v2/places");
  const reverseUrl = new URL("https://api.geoapify.com/v1/geocode/reverse");
  placesUrl.searchParams.set("apiKey", apiKey);
  placesUrl.searchParams.set("categories", GEOAPIFY_CATEGORIES.join(","));
  placesUrl.searchParams.set("filter", `circle:${property.lng},${property.lat},5000`);
  placesUrl.searchParams.set("bias", `proximity:${property.lng},${property.lat}`);
  placesUrl.searchParams.set("limit", "100");
  placesUrl.searchParams.set("lang", "en");
  reverseUrl.searchParams.set("lat", String(property.lat));
  reverseUrl.searchParams.set("lon", String(property.lng));
  reverseUrl.searchParams.set("format", "json");
  reverseUrl.searchParams.set("lang", "en");
  reverseUrl.searchParams.set("apiKey", apiKey);
  const [placesResult, reverseResult] = await Promise.all([
    fetchGeoapify(placesUrl),
    fetchGeoapify(reverseUrl),
  ]);

  if (!placesResult.ok && !reverseResult.ok) {
    if (cached) {
      return json({
        ...cached.data,
        fetched_at: cached.fetched_at,
        stale: true,
        refresh_warning: "Nearby place data could not be refreshed.",
      }, 200, origin);
    }
    return json({
      error: "location_provider_unavailable",
      provider_status: {
        places: placesResult.status,
        reverse_geocoding: reverseResult.status,
      },
    }, 502, origin);
  }

  const reverse = reverseResult.data?.results?.[0] || reverseResult.data?.features?.[0]?.properties || {};
  const neighborhood = reverse.suburb || reverse.neighbourhood || reverse.neighborhood || reverse.district || null;
  const fetchedAt = new Date().toISOString();
  const snapshot: LocationSnapshot = {
    neighborhood: typeof neighborhood === "string" ? neighborhood : null,
    county: typeof reverse.county === "string" ? reverse.county : null,
    city: typeof (reverse.city || reverse.town || reverse.village) === "string"
      ? reverse.city || reverse.town || reverse.village
      : null,
    places: normalizeNearbyPlaces(placesResult.data?.features, property.lat, property.lng),
    provider: "Geoapify Places and Geocoding",
    attribution: "© Geoapify · © OpenStreetMap contributors",
    distance_note: "Distances are approximate straight-line distances, not walking or driving routes.",
    status: placesResult.ok && reverseResult.ok ? "ok" : "partial",
    fetched_at: fetchedAt,
  };

  const { error: saveError } = await admin
    .from("property_location_intelligence")
    .upsert({
      property_id: property.id,
      data: snapshot,
      source: "geoapify",
      fetched_at: fetchedAt,
      expires_at: new Date(Date.now() + (snapshot.status === "ok" ? CACHE_TTL_MS : PARTIAL_CACHE_TTL_MS)).toISOString(),
    }, { onConflict: "property_id" });
  if (saveError) {
    console.error("[property-location] Cache save failed", saveError.message);
    return json({ error: "location_cache_unavailable" }, 500, origin);
  }

  return json({ ...snapshot, stale: false }, 200, origin);
});
