/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  permissiveCorsResponse,
  permissiveJsonErr,
  permissiveJsonOk,
} from "../_shared/cors.ts";

const MAX_BODY_BYTES = 128 * 1024;
const SOURCES = new Set([
  "zillow",
  "realtor",
  "apartments",
  "redfin",
  "opendoor",
  "progress_residential",
  "cj_real_estate",
  "invitation_homes",
]);
const FACT_FIELDS = new Set([
  "source_listing_id",
  "title",
  "address",
  "city",
  "state",
  "zip",
  "property_type",
  "building_name",
  "is_multi_unit",
  "price_range",
  "rent_basis",
  "monthly_rent",
  "community_starting_rent",
  "bedrooms",
  "bathrooms",
  "half_bathrooms",
  "square_footage",
  "year_built",
  "lot_size_sqft",
  "floors",
  "total_units",
  "heating_type",
  "cooling_type",
  "has_central_air",
  "has_basement",
  "garage_spaces",
  "appliances",
  "flooring",
  "parking",
  "utilities_included",
  "laundry_type",
]);
const PAGE_COUNTS = new Set([
  "body_text_length",
  "json_ld_script_count",
  "script_count",
  "image_count",
  "video_count",
  "iframe_count",
  "unit_element_count",
  "floor_plan_element_count",
]);
const UNIT_FIELDS = new Set([
  "source_kind",
  "unit_number",
  "floor_plan_name",
  "bedrooms",
  "bathrooms",
  "half_bathrooms",
  "square_footage",
  "monthly_rent",
  "starting_rent",
  "rent_basis",
  "source_order",
]);
const MEDIA_FIELDS = new Set([
  "kind",
  "title",
  "provider",
  "floor_label",
  "display_order",
  "url_host",
  "has_url",
  "has_poster",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function diagnosticText(value: unknown, maxLength: number): string | null {
  const text = boundedString(value, maxLength);
  if (!text) return text;
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\+?\d[\d ().-]{7,}\d/g, "[phone]")
    .replace(/https?:\/\/\S+/gi, "[url]");
}

function safeUrl(value: unknown): string | null {
  const raw = boundedString(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" || !SOURCES.has(sourceForHost(url.hostname))
    ) return null;
    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

function sourceForHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host === "zillow.com" || host.endsWith(".zillow.com")) return "zillow";
  if (host === "realtor.com" || host.endsWith(".realtor.com")) return "realtor";
  if (host === "apartments.com" || host.endsWith(".apartments.com")) {
    return "apartments";
  }
  if (host === "redfin.com" || host.endsWith(".redfin.com")) return "redfin";
  if (host === "opendoor.com" || host.endsWith(".opendoor.com")) {
    return "opendoor";
  }
  if (host === "rentprogress.com" || host.endsWith(".rentprogress.com")) {
    return "progress_residential";
  }
  if (
    host === "cjproperties.org" || host.endsWith(".cjproperties.org") ||
    host === "cjrealestate.com" || host.endsWith(".cjrealestate.com") ||
    host === "appfolio.com" || host.endsWith(".appfolio.com")
  ) return "cj_real_estate";
  if (host === "invitationhomes.com" || host.endsWith(".invitationhomes.com")) {
    return "invitation_homes";
  }
  return "";
}

function sanitizeReport(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw) || raw.schema_version !== 1) return null;
  const source = boundedString(raw.source, 40) || "";
  const sourceUrl = safeUrl(raw.source_url);
  if (
    !SOURCES.has(source) || !sourceUrl ||
    sourceForHost(new URL(sourceUrl).hostname) !== source
  ) return null;

  const pageInput = isRecord(raw.page) ? raw.page : {};
  const page: Record<string, unknown> = {};
  for (const key of PAGE_COUNTS) {
    const value = finiteNumber(pageInput[key]);
    if (value != null && value >= 0) page[key] = Math.min(value, 10_000_000);
  }
  if (
    pageInput.next_data === "missing" || pageInput.next_data === "invalid" ||
    pageInput.next_data === "parsed" || pageInput.next_data === "too_large"
  ) {
    page.next_data = pageInput.next_data;
  }
  page.script_signals = Array.isArray(pageInput.script_signals)
    ? pageInput.script_signals.slice(0, 40).filter(isRecord).map((script) => {
      const clean: Record<string, unknown> = {};
      if (
        typeof script.id === "string" &&
        /^[A-Za-z0-9_.:-]{1,80}$/.test(script.id)
      ) {
        clean.id = script.id;
      }
      if (
        typeof script.type === "string" &&
        /^[A-Za-z0-9_+./-]{1,80}$/.test(script.type)
      ) clean.type = script.type;
      if (
        typeof script.source_host === "string" &&
        /^[a-z0-9.-]{1,100}$/i.test(script.source_host)
      ) clean.source_host = script.source_host.toLowerCase();
      const contentLength = finiteNumber(script.content_length);
      if (contentLength != null && contentLength >= 0) {
        clean.content_length = Math.min(contentLength, 10_000_000);
      }
      return clean;
    })
    : [];

  const extractorInput = isRecord(raw.extractor) ? raw.extractor : {};
  const errorInput = isRecord(extractorInput.direct_error)
    ? extractorInput.direct_error
    : null;
  const extractedFields = Array.isArray(extractorInput.extracted_fields)
    ? extractorInput.extracted_fields
      .filter((key): key is string =>
        typeof key === "string" && /^[a-z0-9_]{1,60}$/i.test(key)
      )
      .slice(0, 100)
    : [];
  const extractor: Record<string, unknown> = {
    matched: extractorInput.matched === true,
    direct_status:
      ["not_run", "returned_data", "returned_empty", "threw"].includes(
          String(extractorInput.direct_status),
        )
        ? extractorInput.direct_status
        : "not_run",
    direct_had_data: extractorInput.direct_had_data === true,
    json_ld_had_data: extractorInput.json_ld_had_data === true,
    extracted_fields: extractedFields,
  };
  if (errorInput) {
    const errorName = boundedString(errorInput.name, 32);
    const messageLength = finiteNumber(errorInput.message_length);
    const allowedFrameFiles = new Set([
      "shared-extractors.js",
      "live-shared-extractors.js",
      "content.js",
      "live-content.js",
    ]);
    const stackFrames = Array.isArray(errorInput.stack_frames)
      ? errorInput.stack_frames.slice(0, 8).filter(isRecord).flatMap(
        (frame) => {
          const file = boundedString(frame.file, 40);
          const line = finiteNumber(frame.line);
          const column = finiteNumber(frame.column);
          const functionName = boundedString(frame.function, 100);
          if (
            !file || !allowedFrameFiles.has(file) || line == null || line < 1 ||
            column == null || column < 1
          ) return [];
          return [{
            file,
            line: Math.min(line, 10_000_000),
            column: Math.min(column, 10_000_000),
            function: functionName &&
                /^[A-Za-z_$][A-Za-z0-9_$<>.]{0,99}$/.test(functionName)
              ? functionName
              : null,
          }];
        },
      )
      : [];
    extractor.direct_error = {
      name: [
          "Error",
          "TypeError",
          "SyntaxError",
          "RangeError",
          "ReferenceError",
          "URIError",
          "AggregateError",
          "DOMException",
        ].includes(errorName || "")
        ? errorName
        : "Error",
      message_length: messageLength != null && messageLength >= 0
        ? Math.min(messageLength, 10_000_000)
        : 0,
      stack_frames: stackFrames,
    };
  }

  const factsInput = isRecord(raw.facts) ? raw.facts : {};
  const facts: Record<string, unknown> = {};
  for (const key of FACT_FIELDS) {
    const value = factsInput[key];
    if (typeof value === "string") facts[key] = diagnosticText(value, 500);
    else if (typeof value === "number" && Number.isFinite(value)) {
      facts[key] = value;
    } else if (typeof value === "boolean") facts[key] = value;
    else if (Array.isArray(value)) {
      facts[key] = value.slice(0, 100)
        .filter((item): item is string => typeof item === "string")
        .map((item) => diagnosticText(item, 160));
    }
  }

  const unitOptions = Array.isArray(raw.unit_options)
    ? raw.unit_options.slice(0, 100).filter(isRecord).map((unit) => {
      const clean: Record<string, unknown> = {};
      for (const key of UNIT_FIELDS) {
        const value = unit[key];
        if (typeof value === "string") clean[key] = diagnosticText(value, 80);
        else if (typeof value === "number" && Number.isFinite(value)) {
          clean[key] = value;
        }
      }
      return clean;
    })
    : [];

  const mediaKinds: Record<string, number> = {};
  if (isRecord(raw.media_kinds)) {
    Object.entries(raw.media_kinds).slice(0, 20).forEach(([key, value]) => {
      const count = finiteNumber(value);
      if (/^[a-z0-9_-]{1,40}$/i.test(key) && count != null && count >= 0) {
        mediaKinds[key] = Math.min(count, 1000);
      }
    });
  }

  const media = Array.isArray(raw.media)
    ? raw.media.slice(0, 50).filter(isRecord).map((item) => {
      const clean: Record<string, unknown> = {};
      for (const key of MEDIA_FIELDS) {
        const value = item[key];
        if (
          key === "url_host" && typeof value === "string" &&
          /^[a-z0-9.-]{1,100}$/i.test(value)
        ) {
          clean[key] = value.toLowerCase();
        } else if (typeof value === "string") {
          clean[key] = diagnosticText(value, 120);
        } else if (typeof value === "boolean") {
          clean[key] = value;
        } else if (typeof value === "number" && Number.isFinite(value)) {
          clean[key] = value;
        }
      }
      return clean;
    })
    : [];
  const photoHosts: Record<string, number> = {};
  if (isRecord(raw.photo_hosts)) {
    Object.entries(raw.photo_hosts).slice(0, 20).forEach(([host, value]) => {
      const count = finiteNumber(value);
      if (/^[a-z0-9.-]{1,100}$/i.test(host) && count != null && count >= 0) {
        photoHosts[host.toLowerCase()] = Math.min(count, 1000);
      }
    });
  }

  const shape = Array.isArray(raw.source_data_shape)
    ? raw.source_data_shape.slice(0, 100).filter(isRecord).map((entry) => {
      const path = boundedString(entry.path, 300) || "";
      if (path && !/^[A-Za-z0-9_$.[\]-]{1,300}$/.test(path)) return null;
      const type =
        ["object", "array", "string", "number", "boolean", "null"].includes(
            String(entry.type),
          )
          ? entry.type
          : "unknown";
      const clean: Record<string, unknown> = { path, type };
      const length = finiteNumber(entry.length);
      const keyCount = finiteNumber(entry.key_count);
      if (length != null && length >= 0) {
        clean.length = Math.min(length, 10_000_000);
      }
      if (keyCount != null && keyCount >= 0) {
        clean.key_count = Math.min(keyCount, 10_000_000);
      }
      return clean;
    }).filter((entry): entry is Record<string, unknown> => entry !== null)
    : [];

  return {
    schema_version: 1,
    status: raw.status === "success" ? "success" : "failed",
    reason: diagnosticText(raw.reason, 100),
    source,
    source_url: sourceUrl,
    page,
    extractor,
    facts,
    unit_options: unitOptions,
    media_kinds: mediaKinds,
    media,
    photo_count: Math.max(
      0,
      Math.min(10_000_000, finiteNumber(raw.photo_count) || 0),
    ),
    photo_hosts: photoHosts,
    source_data_shape: shape,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return permissiveCorsResponse(req);
  if (req.method !== "POST") {
    return permissiveJsonErr(405, "Method not allowed", req);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return permissiveJsonErr(413, "Diagnostic report is too large", req);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed)) {
      return permissiveJsonErr(400, "Invalid request body", req);
    }
    body = parsed;
  } catch {
    return permissiveJsonErr(400, "Invalid JSON body", req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return permissiveJsonErr(503, "Diagnostics service is not configured", req);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "submit") {
    const importSecret = Deno.env.get("SHORTCUT_IMPORT_SECRET") ||
      Deno.env.get("IMPORT_SECRET");
    const suppliedSecret = req.headers.get("x-import-secret");
    if (!importSecret || suppliedSecret !== importSecret) {
      return permissiveJsonErr(401, "Invalid diagnostics authorization", req);
    }

    const report = sanitizeReport(body.diagnostic);
    const extensionVersion = boundedString(body.extension_version, 32);
    if (
      !report || !extensionVersion || !/^\d+\.\d+\.\d+$/.test(extensionVersion)
    ) {
      return permissiveJsonErr(400, "Invalid diagnostic report", req);
    }

    const { data, error } = await admin
      .from("extension_diagnostics")
      .insert({
        source: report.source,
        source_url: report.source_url,
        extension_version: extensionVersion,
        status: report.status,
        report,
      })
      .select("id, created_at, expires_at")
      .single();
    if (error) {
      console.error(
        "[extension-diagnostics] Report insert failed:",
        error.message,
      );
      return permissiveJsonErr(500, "Could not save diagnostic report", req);
    }

    const { error: cleanupError } = await admin.from("extension_diagnostics")
      .delete().lt("expires_at", new Date().toISOString());
    if (cleanupError) {
      console.warn(
        "[extension-diagnostics] Expired-report cleanup failed:",
        cleanupError.message,
      );
    }
    return permissiveJsonOk({
      ok: true,
      report_id: data.id,
      created_at: data.created_at,
      expires_at: data.expires_at,
    }, req);
  }

  if (body.action === "list") {
    const token = (req.headers.get("authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return permissiveJsonErr(401, "Admin sign-in is required", req);
    const { data: userData, error: userError } = await admin.auth.getUser(
      token,
    );
    if (userError || !userData.user) {
      return permissiveJsonErr(401, "Admin sign-in is required", req);
    }

    const { data: role, error: roleError } = await admin
      .from("admin_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (roleError || !role) {
      return permissiveJsonErr(403, "Admin access is required", req);
    }

    const { data: reports, error } = await admin
      .from("extension_diagnostics")
      .select(
        "id, source, source_url, extension_version, status, report, created_at, expires_at",
      )
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(
        "[extension-diagnostics] Report query failed:",
        error.message,
      );
      return permissiveJsonErr(500, "Could not load diagnostic reports", req);
    }
    const { error: cleanupError } = await admin.from("extension_diagnostics")
      .delete().lt("expires_at", new Date().toISOString());
    if (cleanupError) {
      console.warn(
        "[extension-diagnostics] Expired-report cleanup failed:",
        cleanupError.message,
      );
    }
    return permissiveJsonOk({ ok: true, reports: reports || [] }, req);
  }

  return permissiveJsonErr(400, "Unknown diagnostics action", req);
});
