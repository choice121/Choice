import assert from 'node:assert/strict';
import test from 'node:test';

import {
  capZillowBatchRent,
  ZILLOW_BATCH_RENT_CAP,
} from '../zillow_batch_price_cap.mjs';

test('caps a Zillow batch property at $1,800 and syncs the deposit and description', () => {
  const property = {
    monthly_rent: 2200,
    security_deposit: 2200,
    description: 'Monthly rent is $2,200 per month. Updated kitchen.',
  };

  const capped = capZillowBatchRent(property);

  assert.equal(capped.monthly_rent, 1800);
  assert.equal(capped.security_deposit, 1800);
  assert.equal(capped.description, 'Monthly rent is $1,800/month. Updated kitchen.');
  assert.equal(property.monthly_rent, 2200, 'does not mutate the source batch record');
});

test('does not raise rents below the batch ceiling', () => {
  const capped = capZillowBatchRent({
    monthly_rent: 1450,
    security_deposit: 900,
    description: 'Rent: $1,450.',
  });

  assert.equal(capped.monthly_rent, 1450);
  assert.equal(capped.security_deposit, 1450);
  assert.equal(capped.description, 'Rent: $1,450/month.');
  assert.equal(ZILLOW_BATCH_RENT_CAP, 1800);
});

test('rejects a missing or invalid monthly rent instead of publishing it', () => {
  assert.throws(() => capZillowBatchRent({}), /positive number/);
  assert.throws(() => capZillowBatchRent({ monthly_rent: 0 }), /positive number/);
  assert.throws(() => capZillowBatchRent(null), /record is required/);
});