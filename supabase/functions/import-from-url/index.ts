/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CORE_FIELDS,
  BONUS_FIELDS,
  buildPipelineRecord,
  isEmpty,
} from "../_shared/pipeline-record.ts";
import { buildCorsHeaders, corsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import {
  extractVerifiedZillowRental,
  parseZillowDetailUrl,
} from "../_shared/zillow-url-import.ts";

const MAX_REQUEST_BYTES = 8_192;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 2;

type ImportResult =
  | { ok: true; html: string }
  | { ok: false; blocked?: boolean; error: string };

function json(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function readHtml(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_HTML_BYTES) throw new Error("Zillow page is too large to import.");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("Zillow page is too large to import.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readRequestBody(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function fetchZillowListing(url: URL, zpid: string): Promise<ImportResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let current = url;

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.8",
          "User-Agent": "ChoicePropertiesListingImporter/1.0 (+https://choice-properties-site.pages.dev)",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) {
          return { ok: false, error: "Zillow redirected too many times." };
        }
        try {
          await response.body?.cancel();
        } catch {
          // The redirect response is discarded before the next constrained request.
        }
        const redirected = parseZillowDetailUrl(new URL(location, current).toString());
        if (!redirected.ok || redirected.zpid !== zpid) {
          return { ok: false, error: "Zillow redirected away from the requested listing." };
        }
        current = redirected.url;
        continue;
      }

      if (response.status === 403 || response.status === 429) {
        return {
          ok: false,
          blocked: true,
          error: "Zillow declined the server-side request. No access controls were bypassed.",
        };
      }
      if (!response.ok) {
        return { ok: false, error: `Zillow returned HTTP ${response.status}.` };
      }
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        return { ok: false, error: "Zillow did not return a listing page." };
      }

      return { ok: true, html: await readHtml(response) };
    }

    return { ok: false, error: "Zillow redirect limit reached." };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Zillow did not respond before the import timed out." };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not fetch the Zillow listing.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return corsResponse(origin);
  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: "Request origin is not allowed." }, 403, origin);
  }
  if (req.method !== "POST") {
    return json({ error: "POST is required." }, 405, origin);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "Request body is too large." }, 413, origin);
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await readRequestBody(req);
    if (rawBody === null) {
      return json({ error: "Request body is too large." }, 413, origin);
    }
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "A JSON object is required." }, 400, origin);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON request body." }, 400, origin);
  }

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in as an administrator to import listings." }, 401, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[import-from-url] Supabase service configuration is missing.");
    return json({ error: "The import service is not configured." }, 503, origin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ error: "Your administrator session is invalid or expired." }, 401, origin);
  }

  const { data: adminRole, error: roleError } = await admin
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (roleError) {
    console.error("[import-from-url] Admin role lookup failed:", roleError.message);
    return json({ error: "Could not verify administrator permissions." }, 500, origin);
  }
  if (!adminRole) return json({ error: "Administrator access is required." }, 403, origin);

  const parsedUrl = parseZillowDetailUrl(body.url);
  if (parsedUrl.ok === false) return json({ error: parsedUrl.error }, 400, origin);

  const { data: existingRows, error: duplicateError } = await admin
    .schema("pipeline")
    .from("pipeline_properties")
    .select("id, title")
    .eq("source", "zillow")
    .eq("source_listing_id", parsedUrl.zpid)
    .order("imported_at", { ascending: false })
    .limit(1);
  if (duplicateError) {
    console.error("[import-from-url] Duplicate lookup failed:", duplicateError.message);
    return json({ error: "Could not check for an existing import." }, 500, origin);
  }
  const existing = existingRows?.[0];
  if (existing) {
    return json({
      ok: false,
      duplicate: true,
      id: existing.id,
      title: existing.title,
    }, 200, origin);
  }

  const folderId = typeof body.folder_id === "string" ? body.folder_id.trim() : "";
  if (folderId) {
    const { data: folder, error: folderError } = await admin
      .schema("pipeline")
      .from("pipeline_folders")
      .select("id")
      .eq("id", folderId)
      .maybeSingle();
    if (folderError) {
      console.error("[import-from-url] Folder lookup failed:", folderError.message);
      return json({ error: "Could not verify the selected folder." }, 500, origin);
    }
    if (!folder) return json({ error: "The selected pipeline folder was not found." }, 404, origin);
  }

  const fetched = await fetchZillowListing(parsedUrl.url, parsedUrl.zpid);
  if (fetched.ok === false) {
    return json(fetched.blocked
      ? { ok: false, blocked: true, message: fetched.error }
      : { ok: false, error: fetched.error }, 200, origin);
  }

  const extracted = extractVerifiedZillowRental(fetched.html, parsedUrl.zpid);
  if (!extracted) {
    return json({
      ok: false,
      error: "Could not verify an explicit rental status and asking rent for this Zillow listing.",
    }, 200, origin);
  }
  if (
    !extracted.address ||
    !extracted.city ||
    !extracted.state ||
    !extracted.zip ||
    !extracted.title ||
    !Number.isFinite(Number(extracted.monthly_rent)) ||
    Number(extracted.monthly_rent) <= 0
  ) {
    return json({
      ok: false,
      error: "The Zillow page is missing a complete address, ZIP code, or asking rent required for staging.",
    }, 200, origin);
  }

  const record = buildPipelineRecord({
    ...extracted,
    source: "zillow",
    source_listing_id: parsedUrl.zpid,
    source_url: parsedUrl.url.toString(),
    _import: "admin-url-import-v1",
  });
  record.original_data = JSON.stringify({
    source: "zillow",
    zpid: parsedUrl.zpid,
    source_url: parsedUrl.url.toString(),
    import_method: "admin-url-import-v1",
    fetched_at: new Date().toISOString(),
  });

  const photoUrls = (() => {
    try {
      const parsed = JSON.parse(String(record.original_image_urls || "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  record.photo_import_status = "completed";
  record.photo_upload_status = photoUrls.length > 0 ? "complete" : "none";
  record.last_photo_import_at = new Date().toISOString();
  record.last_photo_import_error = null;

  if (folderId) {
    const { data: lastRecord, error: serialError } = await admin
      .schema("pipeline")
      .from("pipeline_properties")
      .select("folder_serial")
      .eq("folder_id", folderId)
      .order("folder_serial", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (serialError) {
      console.error("[import-from-url] Folder serial lookup failed:", serialError.message);
      return json({ error: "Could not assign the listing to the selected folder." }, 500, origin);
    }
    record.folder_id = folderId;
    record.folder_serial = (lastRecord?.folder_serial || 0) + 1;
  }

  const { error: insertError } = await admin
    .schema("pipeline")
    .from("pipeline_properties")
    .insert(record);
  if (insertError) {
    if (insertError.code === "23505") {
      return json({
        ok: false,
        duplicate: true,
        title: record.title,
      }, 200, origin);
    }
    console.error("[import-from-url] Pipeline insert failed:", insertError.message);
    return json({ error: "Could not add the listing to the pipeline." }, 500, origin);
  }

  const populatedFields = [...CORE_FIELDS, ...BONUS_FIELDS]
    .filter((field) => !isEmpty(record[field]));

  return json({
    ok: true,
    id: record.id,
    title: record.title,
    city: record.city,
    score: record.data_quality_score,
    photos: photoUrls.length,
    populated_fields: populatedFields,
    missing_fields: (() => {
      try {
        const parsed = JSON.parse(String(record.missing_fields || "[]"));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
  }, 200, origin);
});
