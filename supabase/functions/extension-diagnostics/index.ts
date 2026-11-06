/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MAX_BODY_BYTES = 100_000;
const REPORT_TTL_DAYS = 30;
const SOURCES = new Set([
  "zillow", "realtor", "apartments", "redfin", "opendoor",
  "progress", "progress_residential", "cj_real_estate", "invitation_homes",
]);
const FACT_KEYS = new Set([
  "source_listing_id", "title", "address", "city", "state", "zip",
  "property_type", "building_name", "is_multi_unit", "price_range",
  "rent_basis", "monthly_rent", "community_starting_rent", "bedrooms",
  "bathrooms", "half_bathrooms", "square_footage", "year_built",
  "lot_size_sqft", "floors", "total_units", "heating_type", "cooling_type",
  "has_central_air", "has_basement", "garage_spaces", "appliances",
  "flooring", "parking", "utilities_included", "laundry_type",
]);

function json(data: unknown, status: number, origin: string | null) {
  const corsHeaders = buildCorsHeaders(origin);
  if (origin === "null") corsHeaders["Access-Control-Allow-Origin"] = "null";
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength) || null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, 10_000_000)
    : null;
}

function cleanHost(value: unknown): string | null {
  const host = cleanText(value, 100)?.toLowerCase();
  return host && /^[a-z0-9.-]+$/.test(host) ? host : null;
}

function cleanSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4_000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed = [
      "zillow.com", "realtor.com", "apartments.com", "redfin.com",
      "opendoor.com", "rentprogress.com", "cjproperties.org",
      "cjrealestate.com", "appfolio.com", "invitationhomes.com",
    ];
    if (!allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    return `${url.origin}${url.pathname}`.slice(0, 2_000);
  } catch {
    return null;
  }
}

function sanitizeDiagnostic(input: unknown): Record<string, unknown> | null {
  const raw = objectValue(input);
  if (raw.schema_version !== 1 || !["success", "failed"].includes(String(raw.status))) return null;
  const source = cleanText(raw.source, 40);
  const sourceUrl = cleanSourceUrl(raw.source_url);
  if (!source || !SOURCES.has(source) || !sourceUrl) return null;

  const rawPage = objectValue(raw.page);
  const page: Record<string, unknown> = {
    title: cleanText(rawPage.title, 300),
    body_text_length: safeNumber(rawPage.body_text_length),
    next_data: cleanText(rawPage.next_data, 30),
  };
  for (const key of [
    "json_ld_script_count", "script_count", "image_count", "video_count",
    "iframe_count", "unit_element_count", "floor_plan_element_count",
    "floor_plan_candidate_count",
  ]) page[key] = safeNumber(rawPage[key]);
  page.script_signals = (Array.isArray(rawPage.script_signals) ? rawPage.script_signals : [])
    .slice(0, 40)
    .map((item) => {
      const signal = objectValue(item);
      return {
        id: cleanText(signal.id, 80),
        type: cleanText(signal.type, 80),
        source_host: cleanHost(signal.source_host),
        content_length: safeNumber(signal.content_length),
      };
    });

  const rawExtractor = objectValue(raw.extractor);
  const rawError = objectValue(rawExtractor.direct_error);
  const extractor = {
    matched: rawExtractor.matched === true,
    direct_status: cleanText(rawExtractor.direct_status, 30),
    direct_had_data: rawExtractor.direct_had_data === true,
    json_ld_had_data: rawExtractor.json_ld_had_data === true,
    extracted_fields: (Array.isArray(rawExtractor.extracted_fields) ? rawExtractor.extracted_fields : [])
      .slice(0, 100)
      .map((field) => cleanText(field, 80))
      .filter((field): field is string => !!field),
    direct_error: {
      name: cleanText(rawError.name, 40),
      message_length: safeNumber(rawError.message_length),
      stack_frames: (Array.isArray(rawError.stack_frames) ? rawError.stack_frames : [])
        .slice(0, 8)
        .map((item) => {
          const frame = objectValue(item);
          return {
            file: cleanText(frame.file, 100),
            line: safeNumber(frame.line),
            column: safeNumber(frame.column),
            function: cleanText(frame.function, 100),
          };
        }),
    },
  };

  const facts: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(objectValue(raw.facts))) {
    if (!FACT_KEYS.has(key)) continue;
    if (typeof value === "string") facts[key] = cleanText(value, 500);
    else if (typeof value === "number") facts[key] = Number.isFinite(value) ? value : null;
    else if (typeof value === "boolean") facts[key] = value;
    else if (Array.isArray(value)) {
      facts[key] = value.slice(0, 100).map((item) =>
        typeof item === "string" ? cleanText(item, 160) :
          typeof item === "number" && Number.isFinite(item) ? item : null
      ).filter((item) => item !== null);
    }
  }

  const unitOptions = (Array.isArray(raw.unit_options) ? raw.unit_options : [])
    .slice(0, 100)
    .map((item) => {
      const unit = objectValue(item);
      return {
        source_kind: cleanText(unit.source_kind, 40),
        unit_number: cleanText(unit.unit_number, 40),
        floor_plan_name: cleanText(unit.floor_plan_name, 80),
        bedrooms: safeNumber(unit.bedrooms),
        bathrooms: safeNumber(unit.bathrooms),
        half_bathrooms: safeNumber(unit.half_bathrooms),
        square_footage: safeNumber(unit.square_footage),
        monthly_rent: safeNumber(unit.monthly_rent),
        starting_rent: safeNumber(unit.starting_rent),
        rent_basis: cleanText(unit.rent_basis, 80),
        source_order: safeNumber(unit.source_order),
      };
    });

  const mediaKinds: Record<string, number> = {};
  for (const [key, value] of Object.entries(objectValue(raw.media_kinds)).slice(0, 30)) {
    const kind = cleanText(key, 40);
    const count = safeNumber(value);
    if (kind && count !== null) mediaKinds[kind] = count;
  }
  const media = (Array.isArray(raw.media) ? raw.media : []).slice(0, 50).map((item) => {
    const entry = objectValue(item);
    return {
      kind: cleanText(entry.kind, 40),
      title: cleanText(entry.title, 120),
      provider: cleanText(entry.provider, 80),
      floor_label: cleanText(entry.floor_label, 80),
      display_order: safeNumber(entry.display_order),
      url_host: cleanHost(entry.url_host),
      has_url: entry.has_url === true,
      has_poster: entry.has_poster === true,
    };
  });

  const photoHosts: Record<string, number> = {};
  for (const [host, value] of Object.entries(objectValue(raw.photo_hosts)).slice(0, 30)) {
    const safeKey = cleanHost(host);
    const count = safeNumber(value);
    if (safeKey && count !== null) photoHosts[safeKey] = count;
  }
  const sourceDataShape = (Array.isArray(raw.source_data_shape) ? raw.source_data_shape : [])
    .slice(0, 100)
    .map((item) => {
      const shape = objectValue(item);
      return {
        path: cleanText(shape.path, 200),
        type: cleanText(shape.type, 30),
        length: safeNumber(shape.length),
        key_count: safeNumber(shape.key_count),
      };
    });

  return {
    schema_version: 1,
    status: raw.status,
    reason: cleanText(raw.reason, 40),
    source,
    source_url: sourceUrl,
    page,
    extractor,
    facts,
    unit_options: unitOptions,
    media_kinds: mediaKinds,
    media,
    photo_count: safeNumber(raw.photo_count),
    photo_hosts: photoHosts,
    source_data_shape: sourceDataShape,
  };
}

async function authorizeAdmin(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) return { error: "service_unavailable" as const };
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: "unauthorized" as const };
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return { error: "unauthorized" as const };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: role, error: roleError } = await admin.from("admin_roles")
    .select("id").eq("user_id", user.id).maybeSingle();
  if (roleError) {
    console.error("[extension-diagnostics] Admin role lookup failed", roleError.message);
    return { error: "server_error" as const };
  }
  if (!role) return { error: "forbidden" as const };
  return { admin };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    const headers = buildCorsHeaders(origin);
    if (origin === "null") headers["Access-Control-Allow-Origin"] = "null";
    return new Response(null, { status: 204, headers });
  }
  if (origin !== "null" && !isAllowedOrigin(origin)) {
    return json({ error: "origin_not_allowed" }, 403, origin);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "service_unavailable" }, 503, origin);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "report_too_large" }, 413, origin);
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "report_too_large" }, 413, origin);
  }
  let body: Record<string, unknown>;
  try {
    body = objectValue(JSON.parse(rawBody));
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }

  const auth = await authorizeAdmin(req);
  if ("error" in auth) {
    const status = auth.error === "unauthorized" ? 401 :
      auth.error === "forbidden" ? 403 :
      auth.error === "service_unavailable" ? 503 : 500;
    return json({ error: auth.error }, status, origin);
  }
  const admin = auth.admin;

  if (body.action === "submit") {
    const diagnostic = sanitizeDiagnostic(body.diagnostic);
    if (!diagnostic) return json({ error: "invalid_diagnostic_report" }, 400, origin);
    const extensionVersion = cleanText(body.extension_version, 30);
    if (!extensionVersion || !/^\d+\.\d+\.\d+$/.test(extensionVersion)) {
      return json({ error: "invalid_extension_version" }, 400, origin);
    }
    const { error: cleanupError } = await admin.from("extension_diagnostic_reports").delete()
      .lt("expires_at", new Date().toISOString());
    if (cleanupError) {
      console.error("[extension-diagnostics] Expired-report cleanup failed", cleanupError.message);
    }
    const { data, error } = await admin.from("extension_diagnostic_reports").insert({
      extension_version: extensionVersion,
      source: diagnostic.source,
      source_url: diagnostic.source_url,
      status: diagnostic.status,
      diagnostic,
      expires_at: new Date(Date.now() + REPORT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }).select("id").single();
    if (error || !data) {
      console.error("[extension-diagnostics] Report insert failed", error?.message || "no row returned");
      return json({ error: "report_storage_failed" }, 500, origin);
    }
    return json({ ok: true, report_id: data.id }, 200, origin);
  }

  if (body.action === "list") {
    const { data, error } = await admin.from("extension_diagnostic_reports")
      .select("id, extension_version, source, source_url, status, diagnostic, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[extension-diagnostics] Report list failed", error.message);
      return json({ error: "report_list_failed" }, 500, origin);
    }
    return json({ ok: true, reports: data || [] }, 200, origin);
  }

  return json({ error: "unsupported_action" }, 400, origin);
});
