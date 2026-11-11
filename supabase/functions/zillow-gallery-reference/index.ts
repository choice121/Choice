import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, corsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import {
  normalizeZillowListingUrl,
  sanitizeZillowGalleryReport,
} from "../_shared/zillow-gallery-reference.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
  throw new Error("Supabase service configuration is missing");
}

function json(data: unknown, status: number, origin: string | null, publicRead = false) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      ...(publicRead ? { "Access-Control-Allow-Origin": "*" } : {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newReadToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createAdminClient() {
  return createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authorizeAdmin(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: "unauthorized" as const };

  const authClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return { error: "unauthorized" as const };

  const admin = await createAdminClient();
  const { data: role, error: roleError } = await admin
    .from("admin_roles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError) {
    console.error("[zillow-gallery-reference] Admin role lookup failed", roleError.message);
    return { error: "server_error" as const };
  }
  if (!role) return { error: "forbidden" as const };
  return { user, admin };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return corsResponse(origin);

  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return json({ error: "report_not_found" }, 404, origin, true);
    }
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("zillow_gallery_reference_reports")
      .select("id, source_url, report, created_at")
      .eq("read_token_hash", await hashToken(token))
      .maybeSingle();
    if (error) {
      console.error("[zillow-gallery-reference] Report lookup failed", error.message);
      return json({ error: "report_lookup_failed" }, 500, origin, true);
    }
    if (!data) return json({ error: "report_not_found" }, 404, origin, true);
    return json({
      id: data.id,
      source_url: data.source_url,
      created_at: data.created_at,
      snapshot: data.report,
    }, 200, origin, true);
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!isAllowedOrigin(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

  const auth = await authorizeAdmin(req);
  if ("error" in auth) {
    const status = auth.error === "unauthorized" ? 401 : auth.error === "forbidden" ? 403 : 500;
    return json({ error: auth.error }, status, origin);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 100_000) return json({ error: "report_too_large" }, 413, origin);
  let body: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > 100_000) {
      return json({ error: "report_too_large" }, 413, origin);
    }
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }
  if (!body || typeof body !== "object") return json({ error: "invalid_report" }, 400, origin);

  const input = body as Record<string, unknown>;
  const sourceUrl = normalizeZillowListingUrl(input.source_url);
  const report = sanitizeZillowGalleryReport(input.snapshot);
  if (!sourceUrl || !report) return json({ error: "invalid_report" }, 400, origin);

  const readToken = newReadToken();
  const { data, error } = await auth.admin
    .from("zillow_gallery_reference_reports")
    .insert({
      user_id: auth.user.id,
      source_url: sourceUrl,
      report,
      read_token_hash: await hashToken(readToken),
    })
    .select("id, created_at")
    .single();
  if (error || !data) {
    console.error("[zillow-gallery-reference] Report insert failed", error?.message || "no row returned");
    return json({ error: "report_save_failed" }, 500, origin);
  }

  return json({
    ok: true,
    report_id: data.id,
    created_at: data.created_at,
    report_url: `${SUPABASE_URL}/functions/v1/zillow-gallery-reference?token=${encodeURIComponent(readToken)}`,
  }, 201, origin);
});
