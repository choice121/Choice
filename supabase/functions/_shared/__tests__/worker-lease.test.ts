import assert from 'node:assert/strict';
import test from 'node:test';
import { extractWorkerCredentials, verifyBatchWorkerLease } from '../worker-lease.ts';

test('extractWorkerCredentials reads body or headers and blocks admin_override for non-human workers', () => {
  const reqFromHeaders = new Request('https://example.test/fn', {
    method: 'POST',
    headers: {
      'x-worker-id': 'worker-alpha',
      'x-lease-token': '550e8400-e29b-41d4-a716-446655440000',
      'x-admin-override': 'true',
    },
  });

  const nonAdminCreds = extractWorkerCredentials(reqFromHeaders, { admin_override: true }, false);
  assert.equal(nonAdminCreds.workerId, 'worker-alpha');
  assert.equal(nonAdminCreds.leaseToken, '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(nonAdminCreds.adminOverride, false);

  const humanAdminCreds = extractWorkerCredentials(reqFromHeaders, { admin_override: true }, true);
  assert.equal(humanAdminCreds.adminOverride, true);
});

test('verifyBatchWorkerLease validates UUID format before hitting RPC', async () => {
  let rpcCalled = false;
  const res = await verifyBatchWorkerLease({
    adminClient: {
      rpc: async () => {
        rpcCalled = true;
        return { data: { ok: true }, error: null };
      },
    },
    batchId: '4821',
    req: new Request('https://example.test/fn', { method: 'POST' }),
    body: {
      worker_id: 'worker-alpha',
      lease_token: 'not-a-valid-uuid',
    },
    isHumanAdmin: false,
  });

  assert.equal(rpcCalled, false);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'invalid_lease_token');
  }
});

test('verifyBatchWorkerLease maps worker lease conflicts to 409 and verifies matching leases', async () => {
  const validToken = '550e8400-e29b-41d4-a716-446655440000';

  const conflict = await verifyBatchWorkerLease({
    adminClient: {
      rpc: async (_fn, params) => {
        assert.equal(params?.p_batch_id, '4821');
        assert.equal(params?.p_admin_override, false);
        return {
          data: {
            ok: false,
            error: 'lease_held_by_other_worker',
            holder_worker_id: 'worker-beta',
          },
          error: null,
        };
      },
    },
    batchId: '#4821',
    req: new Request('https://example.test/fn', { method: 'POST' }),
    body: { worker_id: 'worker-alpha', lease_token: validToken },
    isHumanAdmin: false,
  });

  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error, 'lease_held_by_other_worker');
    assert.equal(conflict.body.can_admin_override, false);
  }

  const verified = await verifyBatchWorkerLease({
    adminClient: {
      rpc: async (_fn, params) => {
        assert.equal(params?.p_worker_id, 'worker-alpha');
        assert.equal(params?.p_lease_token, validToken);
        return {
          data: {
            ok: true,
            has_job: true,
            has_active_lease: true,
            lease_verified: true,
          },
          error: null,
        };
      },
    },
    batchId: '4821',
    req: new Request('https://example.test/fn', { method: 'POST' }),
    body: { worker_id: 'worker-alpha', lease_token: validToken },
    isHumanAdmin: false,
  });

  assert.equal(verified.ok, true);
});
