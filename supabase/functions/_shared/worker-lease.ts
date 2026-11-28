// ============================================================================
// Choice Properties — Shared Worker Reservation Ticket (lease_token) Lock
// ============================================================================
// Enforces multi-worker batch isolation across scraping, validating, enriching,
// pricing, publishing, and verifying Edge Functions whenever a batch has an
// active worker reservation ticket in pipeline.batch_jobs.
// ============================================================================

import { isValidUuid, mapJobRpcErrorToHttpStatus, normalizeBatchId } from './job-manager.ts';

export interface LeaseCheckInput {
  adminClient: {
    rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  batchId: string | null | undefined;
  req: Request;
  body: Record<string, unknown>;
  isHumanAdmin?: boolean;
}

export type LeaseCheckResult =
  | {
      ok: true;
      skipped?: boolean;
      data?: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

export function extractWorkerCredentials(
  req: Request,
  body: Record<string, unknown>,
  isHumanAdmin = false,
): {
  workerId: string | null;
  leaseToken: string | null;
  adminOverride: boolean;
} {
  const rawWorker =
    typeof body.worker_id === 'string'
      ? body.worker_id
      : req.headers.get('x-worker-id') || '';
  const rawToken =
    typeof body.lease_token === 'string'
      ? body.lease_token
      : req.headers.get('x-lease-token') || '';

  const workerId = rawWorker.trim() || null;
  const leaseToken = rawToken.trim() || null;

  // Only allow explicit admin_override for verified human admins so two
  // concurrent service workers cannot bypass each other's reservation tickets.
  const explicitOverride =
    body.admin_override === true ||
    req.headers.get('x-admin-override') === 'true';
  const adminOverride = Boolean(explicitOverride && isHumanAdmin);

  return {
    workerId,
    leaseToken,
    adminOverride,
  };
}

export async function verifyBatchWorkerLease(input: LeaseCheckInput): Promise<LeaseCheckResult> {
  const cleanBatchId = normalizeBatchId(input.batchId || '');
  if (!cleanBatchId) {
    return { ok: true, skipped: true };
  }

  const creds = extractWorkerCredentials(input.req, input.body, Boolean(input.isHumanAdmin));

  if (creds.leaseToken && !isValidUuid(creds.leaseToken)) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'invalid_lease_token',
        batch_id: cleanBatchId,
        message: 'Provided lease_token is not a valid UUID reservation ticket.',
      },
    };
  }

  const { data, error } = await input.adminClient.rpc('job_verify_lease', {
    p_batch_id: cleanBatchId,
    p_worker_id: creds.workerId,
    p_lease_token: creds.leaseToken,
    p_admin_override: creds.adminOverride,
  });

  if (error) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: 'lease_verification_failed',
        details: error.message,
      },
    };
  }

  const parsed = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown> | null;
  if (!parsed?.ok) {
    const errCode = typeof parsed?.error === 'string' ? parsed.error : 'lease_ownership_mismatch';
    return {
      ok: false,
      status: mapJobRpcErrorToHttpStatus(errCode),
      body: {
        ...(parsed || {}),
        ok: false,
        error: errCode,
        can_admin_override: Boolean(input.isHumanAdmin),
      },
    };
  }

  return {
    ok: true,
    data: parsed,
  };
}
