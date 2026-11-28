// ============================================================
// Choice Properties — Shared Job Manager Helpers & Error Mapping
// Phase 9: Concurrent Multi-AI Job Manager, Worker Isolation &
// Safe Disposable Folder Cleanup.
// ============================================================

export const VALID_JOB_STAGES = new Set<string>([
  'queued',
  'scraping',
  'validating',
  'enriching',
  'pricing',
  'publishing',
  'verifying',
  'cleaning',
  'completed',
  'partial',
  'paused',
  'failed',
]);

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeBatchId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^#/, '');
}

export function isValidFourDigitBatchId(batchId: string): boolean {
  return /^[0-9]{4}$/.test(batchId);
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function buildRecoveryStoragePath(batchId: string, rawPath: string): string {
  const cleanBatch = normalizeBatchId(batchId);
  const cleanPath = String(rawPath || '').trim().replace(/^\/+/, '');
  if (!cleanBatch || !cleanPath) return '';
  const prefix = `recovery/${cleanBatch}/`;
  if (cleanPath.startsWith(prefix)) return cleanPath;
  if (cleanPath.startsWith('recovery/')) return cleanPath;
  return `${prefix}${cleanPath}`;
}

export function mapJobRpcErrorToHttpStatus(errorCode: unknown): number {
  const code = typeof errorCode === 'string' ? errorCode : '';
  switch (code) {
    case 'admin_or_service_required':
    case 'public_visibility_override_required':
      return 403;
    case 'invalid_batch_id_format':
    case 'invalid_workflow_type':
    case 'invalid_visibility':
    case 'batch_id_required':
    case 'worker_id_required':
    case 'lease_token_required':
    case 'invalid_stage':
    case 'invalid_lease_token':
    case 'idempotency_key_conflict':
      return 400;
    case 'job_not_found':
    case 'batch_not_found':
      return 404;
    case 'batch_id_already_used':
    case 'lease_held_by_other_worker':
    case 'lease_ownership_mismatch':
    case 'lease_expired':
    case 'job_is_paused':
    case 'job_already_terminal':
    case 'cleanup_blocked_unverified_batch':
      return 409;
    default:
      return 400;
  }
}
