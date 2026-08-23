/**
 * backfill-pdf-integrity -- Phase 06 follow-up -- ADMIN ONLY
 *
 * One-shot / on-demand admin tool that walks the legacy lease_pdf_versions
 * rows (rows generated before Phase 06 wired SHA-256 + audit certificates)
 * and computes the SHA-256 of the stored PDF object, writing it back to
 * the row.
 *
 * Behaviour:
 *   - Selects rows WHERE legacy_pre_phase06 = true AND sha256 IS NULL.
 *   - For each row, downloads the PDF from the lease-pdfs storage bucket,
 *     hashes the bytes (crypto.subtle SHA-256), and updates ONLY the
 *     sha256 column. The legacy_pre_phase06 flag is intentionally left
 *     true so audits continue to distinguish "natively-Phase-06 PDF (has
 *     cert page + QR token)" from "legacy PDF (hash-only, no cert page)".
 *   - If the storage object is missing, writes a marker into
 *     admin_actions but leaves the row unchanged.
 *   - Caps per-call work at `limit` rows (default 25, max 100) to stay
 *     within Supabase Edge Function CPU/wall budget on large backfills.
 *
 * Request:
 *   POST /backfill-pdf-integrity
 *   { "limit": 25, "dry_run": false }
 *
 * Response:
 *   { ok: true, processed, hashed, skipped_missing_storage, errors[] }
 *
 * Auth: requires a valid landlord/admin JWT (verify_jwt = true at the
 *       gateway in supabase/config.toml AND admin_roles row check here).
 *
 * Idempotent: re-running it is safe -- already-hashed rows are not
 *             reselected.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sha256Hex } from '../_shared/audit-certificate.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface LegacyRow {
  id:            string;
  app_id:        string;
  version_number: number;
  event:         string;
  storage_path:  string;
}

async function verifyAdmin(req: Request): Promise<{ ok: boolean; userEmail?: string; error?: string }> {
  const auth = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!auth) return { ok: false, error: 'Missing authorization header' };
  const { data: { user }, error } = await supabase.auth.getUser(auth);
  if (error || !user) return { ok: false, error: 'Invalid or expired token' };
  const { data: role } = await supabase
    .from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
  if (!role) return { ok: false, error: 'Not an admin' };
  return { ok: true, userEmail: user.email || 'admin' };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = await verifyAdmin(req);
  if (!auth.ok) return jsonErr(401, auth.error || 'Unauthorized', req);

  let body: { limit?: number; dry_run?: boolean } = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { /* allow empty body */ }
  }
  const limit   = Math.max(1, Math.min(100, Number(body.limit) || 25));
  const dryRun  = body.dry_run === true;

  // 1. Pull a batch of legacy rows that still need a hash.
  const { data: rows, error: selErr } = await supabase
    .from('lease_pdf_versions')
    .select('id, app_id, version_number, event, storage_path')
    .eq('legacy_pre_phase06', true)
    .is('sha256', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (selErr) return jsonErr(500, 'Failed to load legacy rows: ' + selErr.message, req);

  const candidates = (rows || []) as LegacyRow[];
  if (candidates.length === 0) {
    return jsonOk({
      ok:                       true,
      processed:                0,
      hashed:                   0,
      skipped_missing_storage:  0,
      errors:                   [],
      dry_run:                  dryRun,
      message:                  'No legacy rows pending integrity backfill.',
    }, req);
  }

  let hashed = 0;
  let missing = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const row of candidates) {
    if (!row.storage_path) {
      errors.push({ id: row.id, reason: 'row has no storage_path' });
      continue;
    }

    // 2. Download bytes
    const { data: blob, error: dlErr } = await supabase.storage
      .from('lease-pdfs').download(row.storage_path);
    if (dlErr || !blob) {
      missing++;
      try {
        await supabase.from('admin_actions').insert({
          action:      'backfill_pdf_integrity_storage_missing',
          target_type: 'lease_pdf_version',
          target_id:   row.id,
          metadata: {
            app_id:         row.app_id,
            version_number: row.version_number,
            event:          row.event,
            storage_path:   row.storage_path,
            error:          dlErr?.message || 'no blob',
          },
        });
      } catch (_) { /* non-fatal */ }
      continue;
    }

    // 3. Hash
    const ab    = await blob.arrayBuffer();
    const hash  = await sha256Hex(new Uint8Array(ab));

    if (dryRun) {
      hashed++;
      continue;
    }

    // 4. Persist sha256, keep legacy_pre_phase06 = true.
    const { error: upErr } = await supabase
      .from('lease_pdf_versions')
      .update({ sha256: hash })
      .eq('id', row.id)
      .is('sha256', null);  // race-safe: don't clobber if a parallel run already wrote one

    if (upErr) {
      errors.push({ id: row.id, reason: 'update failed: ' + upErr.message });
      continue;
    }
    hashed++;

    try {
      await supabase.from('admin_actions').insert({
        action:      'backfill_pdf_integrity_hashed',
        target_type: 'lease_pdf_version',
        target_id:   row.id,
        metadata: {
          app_id:         row.app_id,
          version_number: row.version_number,
          event:          row.event,
          storage_path:   row.storage_path,
          sha256:         hash,
          size_bytes:     ab.byteLength,
          performed_by:   auth.userEmail,
        },
      });
    } catch (_) { /* non-fatal */ }
  }

  // 5. Tell the caller how much work is still left so the admin UI can
  //    decide whether to call us again.
  const { count: remaining } = await supabase
    .from('lease_pdf_versions')
    .select('id', { count: 'exact', head: true })
    .eq('legacy_pre_phase06', true)
    .is('sha256', null);

  return jsonOk({
    ok:                      true,
    processed:               candidates.length,
    hashed,
    skipped_missing_storage: missing,
    errors,
    remaining:               remaining ?? null,
    dry_run:                 dryRun,
  }, req);
});
