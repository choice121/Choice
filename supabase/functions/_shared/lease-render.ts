// Choice Properties — Shared: lease-render.ts
  //
  // Single source of truth for "which lease template body should I
  // render right now?". Everywhere we previously hit
  //   .from('lease_templates').select(...).eq('is_active', true).single()
  // we now go through this module so the snapshotted version
  // (lease_template_version_id) wins over the live editable template.
  //
  // Phase 03 update: state-aware resolution.
  //   The active-template lookup now requires a state code and only
  //   considers templates whose state_code matches. Snapshot resolution
  //   is unaffected (snapshots are pinned to the application via
  //   lease_template_version_id and supersede everything).
  //
  // Legal hazard fix from Phase 02: once an application has a snapshot
  // attached, every PDF rebuild for that application uses the same
  // immutable text the tenant agreed to.

  import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
  import {
    buildLeasePDFFinalized,
    type CertSigner,
    type CertEsignConsent,
  } from './pdf.ts';
  import type { RenderedAddendum } from './lease-addenda.ts';
  import type { PartialResolver } from './template-engine.ts';
  import { prependSummaryPage } from './plain-summary.ts';

  export interface ResolvedLeaseTemplate {
    template_body: string;
    name: string;
    version_id: string | null;
    version_number: number | null;
    source: 'snapshot' | 'active_template' | 'fallback';
    state_code: string;
    legal_review_status: 'statute_derived' | 'attorney_reviewed' | 'outdated';
  }

  export type LeaseTemplateResolutionError =
    | { kind: 'no_state'; message: string }
    | { kind: 'no_template_for_state'; state_code: string; message: string }
    | { kind: 'snapshot_unreadable'; message: string };

  export interface ResolveResult {
    template: ResolvedLeaseTemplate | null;
    error?: LeaseTemplateResolutionError;
  }

  /**
   * Resolve the lease template text to use when rendering a PDF
   * for this application. Resolution order:
   *
   *   1. The application's pinned lease_template_version_id snapshot
   *      (set by generate-lease via snapshot_lease_template_for_app).
   *   2. The current active lease_templates row whose state_code
   *      matches the application's lease_state_code (Phase 03).
   *   3. Returns null if there is no template for the requested state.
   *
   * The state code for active-template lookup is taken from
   * `app.lease_state_code`. If that is missing, this returns null with
   * `error.kind === 'no_state'` — Phase 03 hardens callers to surface this
   * as a 400, replacing the silent 'MI' default that existed before.
   *
   * Backwards compatible: existing callers that destructure the return
   * value get null on every failure mode just like before. New callers
   * can use `resolveLeaseTemplateDetailed` to get the structured error.
   */
  export async function resolveLeaseTemplate(
    supabase: SupabaseClient,
    app: {
      app_id?: string;
      lease_template_version_id?: string | null;
      lease_state_code?: string | null;
    },
  ): Promise<ResolvedLeaseTemplate | null> {
    return (await resolveLeaseTemplateDetailed(supabase, app)).template;
  }

  /**
   * Same as resolveLeaseTemplate but returns the structured error so the
   * edge function can produce a meaningful 4xx instead of a generic 500.
   */
  export async function resolveLeaseTemplateDetailed(
    supabase: SupabaseClient,
    app: {
      app_id?: string;
      lease_template_version_id?: string | null;
      lease_state_code?: string | null;
    },
  ): Promise<ResolveResult> {
    // 1. Snapshot pinned to this app — wins over everything
    if (app.lease_template_version_id) {
      const { data, error } = await supabase
        .from('lease_template_versions')
        .select('id, version_number, name, template_body, state_code, legal_review_status')
        .eq('id', app.lease_template_version_id)
        .single();
      if (!error && data?.template_body) {
        return {
          template: {
            template_body:        data.template_body,
            name:                 data.name,
            version_id:           data.id,
            version_number:       data.version_number,
            source:               'snapshot',
            state_code:           (data.state_code as string) || (app.lease_state_code || ''),
            legal_review_status:  (data.legal_review_status as ResolvedLeaseTemplate['legal_review_status']) || 'statute_derived',
          },
        };
      }
      console.warn('[lease-render] pinned version_id missing/unreadable, falling through to active template:', error?.message);
      // fall through — we'll try the active template next
    }

    // 2. Active editable template — REQUIRES state_code (Phase 03)
    const stateCode = (app.lease_state_code || '').trim().toUpperCase();
    if (!stateCode) {
      return {
        template: null,
        error: {
          kind: 'no_state',
          message: 'Cannot select lease template: application has no lease_state_code set. Set the lease state on the application before generating a lease.',
        },
      };
    }

    const { data: tmpl, error: tmplErr } = await supabase
      .from('lease_templates')
      .select('id, name, template_body, state_code, legal_review_status')
      .eq('is_active', true)
      .eq('state_code', stateCode)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tmplErr) {
      console.warn('[lease-render] active template lookup error:', tmplErr.message);
    }

    if (tmpl?.template_body) {
      return {
        template: {
          template_body:        tmpl.template_body,
          name:                 tmpl.name,
          version_id:           null,
          version_number:       null,
          source:               'active_template',
          state_code:           (tmpl.state_code as string) || stateCode,
          legal_review_status:  (tmpl.legal_review_status as ResolvedLeaseTemplate['legal_review_status']) || 'statute_derived',
        },
      };
    }

    return {
      template: null,
      error: {
        kind: 'no_template_for_state',
        state_code: stateCode,
        message: `No active lease template found for state ${stateCode}. Seed one or activate an existing template for this state in Admin → Leases → Templates.`,
      },
    };
  }

  /**
   * Snapshot the active template for an application, returning the
   * resulting version metadata. Idempotent: if the application
   * already has a snapshot pinned, this is a no-op.
   */
  export async function ensureSnapshotForApp(
    supabase: SupabaseClient,
    appId: string,
    templateId?: string,
  ): Promise<{ ok: boolean; version_id?: string; version_number?: number; error?: string }> {
    const { data, error } = await supabase.rpc('snapshot_lease_template_for_app', {
      p_app_id:      appId,
      p_template_id: templateId ?? null,
    });
    if (error) return { ok: false, error: error.message };
    const r = data as { success?: boolean; version_id?: string; version_number?: number; error?: string };
    if (!r?.success) return { ok: false, error: r?.error || 'Snapshot failed' };
    return { ok: true, version_id: r.version_id, version_number: r.version_number };
  }

  /**
   * Record a new PDF version after a successful storage upload.
   * Non-fatal — failures are logged but do not break the calling
   * flow. The application's lease_pdf_url should still be updated
   * by the caller to point at the latest path.
   */
  export async function recordPdfVersion(
    supabase: SupabaseClient,
    args: {
      appId: string;
      event: 'pre_sign' | 'tenant_signed' | 'co_signed' | 'countersigned' | 'amended' | 'renewed' | 'manual';
      storagePath: string;
      sizeBytes?: number;
      templateVersionId?: string | null;
      amendmentId?: string | null;
      createdBy?: string | null;
    },
  ): Promise<void> {
    try {
      await supabase.rpc('record_lease_pdf_version', {
        p_app_id:              args.appId,
        p_event:               args.event,
        p_storage_path:        args.storagePath,
        p_size_bytes:          args.sizeBytes ?? null,
        p_template_version_id: args.templateVersionId ?? null,
        p_amendment_id:        args.amendmentId ?? null,
        p_created_by:          args.createdBy ?? null,
      });
    } catch (e) {
      console.warn('[lease-render] recordPdfVersion non-fatal:', (e as Error).message);
    }
  }

  /**
   * Build a versioned storage path for a new PDF write. Format:
   *   {app_id}/lease_v{N}_{event}_{ts}.pdf
   */
  export function buildPdfStoragePath(appId: string, versionNumber: number, event: string): string {
    return `${appId}/lease_v${versionNumber}_${event}_${Date.now()}.pdf`;
  }

  // =====================================================================
  // Phase 06 -- finalizeAndStorePdf
  //
  // One-stop helper that every signing edge function calls. Steps:
  //   1. Build the lease PDF body (template + addenda + signatures).
  //   2. SHA-256 the body bytes.
  //   3. Optionally append a Certificate of Completion page (with QR
  //      verify token).
  //   4. SHA-256 the final bytes.
  //   5. Reserve the next version_number via record_lease_pdf_version.
  //   6. Upload bytes to the lease-pdfs bucket at the versioned path.
  //   7. Patch storage_path + size_bytes on the version row.
  //   8. Pin sha256 + certificate_appended + qr_verify_token via
  //      record_lease_pdf_integrity.
  //   9. Optionally update applications.lease_pdf_url to the new path.
  //
  // Failure of any step after (5) is logged with the version_number so an
  // operator can recover. The function still returns a result object so
  // callers can decide whether to short-circuit (e.g. send emails only on
  // success).
  // =====================================================================

  export interface FinalizeAndStorePdfArgs {
    supabase:            SupabaseClient;
    app_id:              string;
    app:                 Record<string, unknown>;
    templateText:        string;
    templateVersionId:   string | null;
    templateVersion:     number | null;
    event: 'pre_sign' | 'tenant_signed' | 'co_signed' | 'countersigned' | 'amended' | 'renewed' | 'manual';
    amendmentId?:        string | null;
    createdBy?:          string | null;
    addenda?:            RenderedAddendum[];
    addendaAssetBaseUrl?: string;
    partials?:           PartialResolver;
    /**
     * If supplied, an audit certificate page is appended. Required for
     * tenant_signed / co_signed / countersigned / amended / renewed.
     */
    certificate?: {
      state_code:        string | null;
      signers:           CertSigner[];
      edge_function_tag: string;
      site_url:          string;
    };
    /** Whether to update applications.lease_pdf_url to the new path. */
    updateAppPointer?:   boolean;
    /**
     * Phase 12 — Prepend a plain-language cover page as page 1 of the PDF.
     * Defaults to true.  Pass false only for amendment PDFs or when the
     * caller explicitly needs raw template output.
     */
    includeSummary?:     boolean;
  }

  export interface FinalizeAndStorePdfResult {
    ok:                   boolean;
    error?:               string;
    storage_path?:        string;
    version_number?:      number;
    sha256?:              string;
    body_sha256?:         string;
    certificate_appended?: boolean;
    qr_verify_token?:     string | null;
  }

  /**
   * Load the most recent E-SIGN consent row per (signer_email, role) for an
   * application. Used by the cert page so it can list which signer
   * acknowledged which disclosure version.
   */
  export async function loadEsignConsentsForCert(
    supabase: SupabaseClient,
    app_id:   string,
  ): Promise<CertEsignConsent[]> {
    const { data, error } = await supabase
      .from('esign_consents')
      .select('signer_role, signer_email, disclosure_version, consented_at, ip_address')
      .eq('app_id', app_id)
      .eq('consent_given', true)
      .is('withdrawn_at', null)
      .order('consented_at', { ascending: false });
    if (error || !data) {
      console.warn('[finalizeAndStorePdf] esign_consents lookup failed:', error?.message);
      return [];
    }
    // De-dup to latest per (role, email)
    const seen = new Set<string>();
    const out: CertEsignConsent[] = [];
    for (const r of data as Array<{
      signer_role: string; signer_email: string; disclosure_version: string;
      consented_at: string; ip_address: string | null;
    }>) {
      const k = (r.signer_role || '') + '|' + (r.signer_email || '').toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        role:               r.signer_role as CertEsignConsent['role'],
        disclosure_version: r.disclosure_version,
        consented_at:       r.consented_at,
        ip:                 r.ip_address,
      });
    }
    return out;
  }

  export async function finalizeAndStorePdf(
    args: FinalizeAndStorePdfArgs,
  ): Promise<FinalizeAndStorePdfResult> {
    const {
      supabase, app_id, app, templateText, templateVersionId, templateVersion,
      event, amendmentId, createdBy, addenda, addendaAssetBaseUrl, partials,
      certificate, updateAppPointer,
    } = args;

    // Look up E-SIGN consents ONCE — only when we're actually appending
    // a cert. Cached and reused across both build passes (initial build
    // with placeholder pdf_version + rebuild with real version) so we
    // don't double up on the round-trip.
    let esignConsents: CertEsignConsent[] = [];
    if (certificate) {
      esignConsents = await loadEsignConsentsForCert(supabase, app_id);
    }

    // 1-4. Build + hash + (optionally) append cert + final hash
    let finalized;
    try {
      finalized = await buildLeasePDFFinalized(app, templateText, {
        partials,
        addenda,
        addendaAssetBaseUrl,
        certificate: certificate ? {
          site_url:          certificate.site_url,
          app_id,
          state_code:        certificate.state_code,
          template_version:  templateVersion,
          // pdf_version is the version we're about to reserve; we don't
          // know it yet, so we patch it onto the cert AFTER reserving in
          // step 5. To do that without a second build, we reserve the
          // version FIRST (step 5), then build with the known version.
          // Re-shape: reserve first, then call this -- see refactor below.
          pdf_version:       0, // placeholder, overwritten below
          edge_function_tag: certificate.edge_function_tag,
          signers:           certificate.signers,
          esign_consents:    esignConsents,
          amendment_id:      amendmentId || null,
        } : undefined,
      });
    } catch (e) {
      return { ok: false, error: 'PDF build failed: ' + (e as Error).message };
    }

    // 5. Reserve next version_number
    const { data: pv, error: pvErr } = await supabase.rpc('record_lease_pdf_version', {
      p_app_id:              app_id,
      p_event:               event,
      p_storage_path:        '',
      p_template_version_id: templateVersionId,
      p_amendment_id:        amendmentId || null,
      p_created_by:          createdBy || null,
    });
    if (pvErr) return { ok: false, error: 'Version reservation failed: ' + pvErr.message };
    const versionNumber = (pv as { version_number?: number })?.version_number || 1;

    // From this point on, any failure path that exits before storage_path
    // is patched (step 7) must delete the reserved version row, otherwise
    // it sits in lease_pdf_versions forever with storage_path = ''.
    const releaseReservedVersion = async (reason: string) => {
      const { error: delErr } = await supabase.from('lease_pdf_versions')
        .delete()
        .eq('app_id', app_id)
        .eq('version_number', versionNumber);
      if (delErr) {
        console.warn(
          `[finalizeAndStorePdf] could not release orphan version row v${versionNumber} (${reason}):`,
          delErr.message,
        );
      }
    };

    // If we appended a cert with a placeholder pdf_version, rebuild now
    // so the cert page shows the real version number. (Body rendering is
    // deterministic so the body hash is stable across builds.)
    if (certificate && finalized.certificate_appended) {
      try {
        finalized = await buildLeasePDFFinalized(app, templateText, {
          partials,
          addenda,
          addendaAssetBaseUrl,
          certificate: {
            site_url:          certificate.site_url,
            app_id,
            state_code:        certificate.state_code,
            template_version:  templateVersion,
            pdf_version:       versionNumber,
            edge_function_tag: certificate.edge_function_tag,
            signers:           certificate.signers,
            esign_consents:    esignConsents,
            amendment_id:      amendmentId || null,
            qr_verify_token:   finalized.qr_verify_token || undefined,
          },
        });
      } catch (e) {
        // Non-fatal -- we already have a cert PDF, just with a wrong
        // version number printed. Log and continue.
        console.warn('[finalizeAndStorePdf] cert version-rebuild failed (non-fatal):', (e as Error).message);
      }
    }

    // Phase 12 — prepend plain-language summary page (default on)
    if (args.includeSummary !== false) {
      try {
        finalized = {
          ...finalized,
          bytes: await prependSummaryPage(finalized.bytes, app),
        };
      } catch (e) {
        // Non-fatal: log the error and continue with the unsummarised PDF.
        console.warn('[finalizeAndStorePdf] summary prepend failed (non-fatal):', (e as Error).message);
      }
    }

    // 6. Upload
    const path = buildPdfStoragePath(app_id, versionNumber, event);
    const { error: upErr } = await supabase.storage.from('lease-pdfs')
      .upload(path, finalized.bytes, { contentType: 'application/pdf', upsert: false });
    if (upErr) {
      // Roll back the reservation so we don't leak a row with an empty
      // storage_path. Best-effort: if the delete itself fails it is
      // logged but does not change the surfaced error to the caller.
      await releaseReservedVersion('upload-failed');
      return { ok: false, error: 'PDF upload failed: ' + upErr.message };
    }

    // 7. Patch storage_path + size_bytes
    await supabase.from('lease_pdf_versions')
      .update({ storage_path: path, size_bytes: finalized.bytes.byteLength })
      .eq('app_id', app_id).eq('version_number', versionNumber);

    // 8. Pin integrity columns
    const { error: intErr } = await supabase.rpc('record_lease_pdf_integrity', {
      p_app_id:               app_id,
      p_version_number:       versionNumber,
      p_sha256:               finalized.sha256,
      p_certificate_appended: finalized.certificate_appended,
      p_qr_verify_token:      finalized.qr_verify_token,
    });
    if (intErr) {
      console.warn('[finalizeAndStorePdf] integrity write failed (non-fatal):', intErr.message);
    }

    // 9. Update app pointer
    if (updateAppPointer) {
      await supabase.from('applications')
        .update({ lease_pdf_url: path, updated_at: new Date().toISOString() })
        .eq('app_id', app_id);
    }

    return {
      ok:                   true,
      storage_path:         path,
      version_number:       versionNumber,
      sha256:               finalized.sha256,
      body_sha256:          finalized.body_sha256,
      certificate_appended: finalized.certificate_appended,
      qr_verify_token:      finalized.qr_verify_token,
    };
  }
  