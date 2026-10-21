const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateForPublish } = require('../js/admin/pipeline-validation.js');

const validListing = {
  monthly_rent: 1850,
  application_fee: 50,
  description: 'Updated home with a bright kitchen and fenced yard. $50 application fee.',
};

test('accepts a reviewed description that meets Choice fee rules', () => {
  assert.deepEqual(validateForPublish(validListing), { ok: true, failures: [] });
});

test('blocks an unset or non-$50 structured application fee', () => {
  assert.equal(validateForPublish({ ...validListing, application_fee: null }).ok, false);
  assert.equal(validateForPublish({ ...validListing, application_fee: 35 }).ok, false);
});

test('blocks missing or unreviewed descriptions', () => {
  assert.equal(validateForPublish({ ...validListing, description: '' }).ok, false);
  assert.equal(
    validateForPublish({
      ...validListing,
      description: 'Updated home with a bright kitchen and fenced yard.',
    }).ok,
    false,
  );
});

test('blocks source terms that must not be published', () => {
  const description =
    'Security deposit is $1,850. Available now with a 12 month lease. Pets allowed.';
  const result = validateForPublish({ ...validListing, description });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('security-deposit')));
  assert.ok(result.failures.some((failure) => failure.includes('availability')));
  assert.ok(result.failures.some((failure) => failure.includes('lease-term')));
  assert.ok(result.failures.some((failure) => failure.includes('pet information')));
});

test('blocks tour, portal, and agent-contact details', () => {
  const description =
    'Schedule a showing through Zillow. Contact the agent at agent@example.com.';
  const result = validateForPublish({ ...validListing, description });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('third-party')));
  assert.ok(result.failures.some((failure) => failure.includes('tour, showing')));
  assert.ok(result.failures.some((failure) => failure.includes('agent contact')));
});

test('blocks URL instructions and every non-$50 fee amount', () => {
  for (const description of [
    'Apply on another rental site. $50 application fee.',
    'Visit https://rent.example/listing to apply. $50 application fee.',
    'Application fee is $0. $50 application fee.',
    'Application fee of $35. $50 application fee.',
    '$50.50 application fee. $50 application fee.',
    'Application fee waived. $50 application fee.',
  ]) {
    assert.equal(
      validateForPublish({ ...validListing, description }).ok,
      false,
      `Expected to block: ${description}`,
    );
  }
});

test('blocks invalid rent', () => {
  assert.equal(validateForPublish({ ...validListing, monthly_rent: 0 }).ok, false);
  assert.equal(validateForPublish({ ...validListing, monthly_rent: 200000 }).ok, false);
});
