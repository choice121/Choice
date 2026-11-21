import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VALID_JOB_STAGES,
  buildRecoveryStoragePath,
  isValidFourDigitBatchId,
  isValidUuid,
  mapJobRpcErrorToHttpStatus,
  normalizeBatchId,
} from '../job-manager.ts';

test('normalizeBatchId & isValidFourDigitBatchId enforce exact 4-digit format', () => {
  assert.equal(normalizeBatchId(' #4821 '), '4821');
  assert.equal(isValidFourDigitBatchId('4821'), true);
  assert.equal(isValidFourDigitBatchId('0007'), true);
  assert.equal(isValidFourDigitBatchId('482'), false);
  assert.equal(isValidFourDigitBatchId('48210'), false);
  assert.equal(isValidFourDigitBatchId('PB-20260401-1234'), false);
});

test('buildRecoveryStoragePath creates pipeline-recovery compatible recovery/{batch_id}/ paths', () => {
  assert.equal(
    buildRecoveryStoragePath('4821', 'batches/4821/apify/run_1/999.json'),
    'recovery/4821/batches/4821/apify/run_1/999.json',
  );
  assert.equal(
    buildRecoveryStoragePath('#4821', 'recovery/4821/batches/4821/apify/run_1/999.json'),
    'recovery/4821/batches/4821/apify/run_1/999.json',
  );
  assert.equal(buildRecoveryStoragePath('', 'batches/4821/a.json'), '');
});

test('mapJobRpcErrorToHttpStatus maps isolation & cleanup guards to 409 and validation errors to 400/404', () => {
  assert.equal(mapJobRpcErrorToHttpStatus('lease_held_by_other_worker'), 409);
  assert.equal(mapJobRpcErrorToHttpStatus('lease_ownership_mismatch'), 409);
  assert.equal(mapJobRpcErrorToHttpStatus('lease_expired'), 409);
  assert.equal(mapJobRpcErrorToHttpStatus('cleanup_blocked_unverified_batch'), 409);
  assert.equal(mapJobRpcErrorToHttpStatus('batch_id_already_used'), 409);
  assert.equal(mapJobRpcErrorToHttpStatus('job_not_found'), 404);
  assert.equal(mapJobRpcErrorToHttpStatus('invalid_stage'), 400);
  assert.equal(mapJobRpcErrorToHttpStatus('admin_or_service_required'), 403);
});

test('UUID validation and stage allowlist guard inputs cleanly', () => {
  assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isValidUuid('not-a-uuid'), false);
  assert.equal(VALID_JOB_STAGES.has('cleaning'), true);
  assert.equal(VALID_JOB_STAGES.has('completed'), true);
  assert.equal(VALID_JOB_STAGES.has('unknown_stage'), false);
});
