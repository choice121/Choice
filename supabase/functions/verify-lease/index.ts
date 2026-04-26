/**
 * verify-lease -- Phase 06
 *
 * PUBLIC endpoint that verifies the integrity of a lease PDF given a
 * QR-token printed on the audit certificate page. Flow:
 *
 *   GET/POST /verify-lease?t=<qr_verify_token>
 *
 *   1. lookup_lease_by_qr_token(t)  -- anon RPC, returns PII-free
 *      summary: storage_path, sha256, version_number, event, signers
 *      list (role + initials + signed_at), state_code, signed dates,
 *      app_id (last 4 chars only).
 *   2. Download the PDF from the lease-pdfs storage bucket via the
 *      service-role client.
 *   3. Re-hash the bytes with SHA-256.
 *   4. Compare to the stored sha256.
 *   5. Return { hash_match, summary, recomputed_sha256, stored_sha256 }.
 *   6. On mismatch, log an admin_actions row so an operator can
 *      investigate (someone has either tampered with the storage object
 *      or the integrity row).
 *
 * This endpoint is PUBLIC (no auth) -- the QR token is the credential
 * AND is itself only printed on a fully signed PDF that the holder of
 * the lease already has access to. Per-IP rate limit (60/hr) prevents
 * token enumeration.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sha256Hex } from '../_shared/pdf.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface PublicLeaseSummary {
  found:                boolean;
  error?:               string;
  state_code:           string | null;
  lease_status:         string | null;
  lease_start_date:     string | null;
  lease_end_date:       string | null;
  pdf_version:          number;
  event:                string;
  sha256:               string;
  certificate_appended: boolean;
  storage_path:         string;
  created_at:           string | null;
  // Phase 10: lookup_lease_by_qr_token may surface lease_id for callers
  // that want to deep-link the lease history view. Optional for backwards
  // compat with the older RPC body.
  lease_id?:            string | null;
  app_id_last4?:        string | null;
  signers: Array<{
    role:         string;
    display_name: string;
    signed_at:    string | null;
  }>;
  esign_consents_by_role: Record<string, number>;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Accept token via query string or JSON body so the verify page and
  // any future API client can both call this endpoint.
  let token = '';
  const url = new URL(req.url);
  token = url.searchParams.get('t') || url.searchParams.get('token') || '';
  if (!token && req.method === 'POST') {
    try {
      const body = await req.json();
      token = (body?.t || body?.token || '').toString().trim();
    } catch { /* body parse optional */ }
  }
  if (!token) return jsonErr(400, 'Missing verification token (?t=...)');
  if (token.length < 10 || token.length > 64) {
    return jsonErr(400, 'Invalid verification token format');
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  if (await isDbRateLimited(ip, 'verify-lease', 60, 60 * 60 * 1000)) {
    return jsonErr(429, 'Too many verification requests from this network. Please wait an hour and try again.');
  }

  // 1. Look up the version by token (returns JSONB { found, ... })
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('lookup_lease_by_qr_token', { p_token: token });
  if (rpcErr) {
    console.error('[verify-lease] lookup RPC error:', rpcErr.message);
    return jsonErr(500, 'Verification lookup failed.');
  }
  const summaryRaw = rpcData as PublicLeaseSummary;
  if (!summaryRaw || summaryRaw.found !== true) {
    return jsonErr(404, summaryRaw?.error || 'Verification token not recognized. The PDF may have been re-issued or the link is invalid.');
  }
  if (!summaryRaw.storage_path) {
    return jsonErr(409, 'This lease version has no PDF on file yet.');
  }

  // 2. Download the PDF
  const { data: blob, error: dlErr } = await supabase.storage
    .from('lease-pdfs').download(summaryRaw.storage_path);
  if (dlErr || !blob) {
    console.error('[verify-lease] download failed for', summaryRaw.storage_path, dlErr?.message);
    // Treat missing storage object as a tamper-flag (someone deleted
    // the file out from under the integrity row).
    try {
      await supabase.from('admin_actions').insert({
        action:      'lease_verify_storage_missing',
        target_type: 'lease_pdf_version',
        target_id:   summaryRaw.storage_path,
        metadata:    {
          token_prefix:     token.slice(0, 8),
          pdf_version:      summaryRaw.pdf_version,
          event:            summaryRaw.event,
          ip,
          stored_sha256:    summaryRaw.sha256,
        },
      });
    } catch (_) { /* non-fatal */ }
    return jsonOk({
      ok:                  true,
      hash_match:          false,
      reason:              'PDF object not found in storage',
      summary:             summaryRaw,
      recomputed_sha256:   null,
      stored_sha256:       summaryRaw.sha256,
    });
  }

  // 3. Hash
  const ab     = await blob.arrayBuffer();
  const recomputed = await sha256Hex(new Uint8Array(ab));

  // 4. Compare
  const hash_match = recomputed.toLowerCase() === (summaryRaw.sha256 || '').toLowerCase();

  // 5. Log tamper event
  if (!hash_match) {
    try {
      await supabase.from('admin_actions').insert({
        action:      'lease_verify_hash_mismatch',
        target_type: 'lease_pdf_version',
        target_id:   summaryRaw.storage_path,
        metadata:    {
          token_prefix:      token.slice(0, 8),
          pdf_version:       summaryRaw.pdf_version,
          event:             summaryRaw.event,
          ip,
          stored_sha256:     summaryRaw.sha256,
          recomputed_sha256: recomputed,
          size_on_disk:      ab.byteLength,
        },
      });
    } catch (_) { /* non-fatal */ }
  }

  // Phase 10: opportunistically enrich with lease_id from lease_pdf_versions
  // so downstream UIs (admin lease history) can deep-link from a verify
  // result back to the lease detail page.
  let leaseId: string | null = summaryRaw.lease_id || null;
  if (!leaseId && summaryRaw.storage_path) {
    try {
      const { data: pv } = await supabase
        .from('lease_pdf_versions')
        .select('lease_id')
        .eq('storage_path', summaryRaw.storage_path)
        .maybeSingle();
      leaseId = (pv as { lease_id: string | null } | null)?.lease_id || null;
    } catch (_) { /* non-fatal */ }
  }

  return jsonOk({
    ok:                true,
    hash_match,
    lease_id:          leaseId,
    summary:           { ...summaryRaw, lease_id: leaseId },
    recomputed_sha256: recomputed,
    stored_sha256:     summaryRaw.sha256,
    size_bytes:        ab.byteLength,
    verified_at:       new Date().toISOString(),
  });
});
