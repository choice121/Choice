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
  