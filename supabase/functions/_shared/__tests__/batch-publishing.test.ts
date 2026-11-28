import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLIENT_SAFE_PROPERTY_FIELDS,
  detectLeakedInternalStrings,
  extractShareTokenFromUrl,
  projectClientSafeProperty,
  sanitizeLocationDetailsForClient,
  sanitizeStructuralDetailsForClient,
  sanitizeUtilityDetailsForClient,
} from '../batch-publishing.ts';

test('projectClientSafeProperty strips internal fields, sanitizes JSONB domains, and overlays batch rent & description', () => {
  const raw = {
    id: 'prop_abc123def456',
    status: 'private_placement',
    title: '608 Maple Ave, Yukon, OK 73099',
    description: 'Canonical base description. Application Fee: $50. Submit your rental application today at Choice Properties.',
    address: '608 Maple Ave',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    monthly_rent: 1595,
    security_deposit: 1595,
    application_fee: 35,
    agent_name: 'Jane Broker',
    broker_name: 'Acme Realty',
    landlord_id: '00000000-0000-0000-0000-000000000001',
    landlords: { id: '1', contact_name: 'Secret Owner' },
    source_url: 'https://www.zillow.com/homedetails/123_zpid/',
    source_raw_payload: { attributionInfo: { agentName: 'Jane Broker' } },
    original_data: { raw: true },
    field_provenance: { source: 'zillow', source_listing_id: '123' },
    source_facts_ledger: { heating: 'confirmed_present' },
    unmapped_attributes: { internalFlag: true },
    field_verification_status: { county: 'independently_verified' },
    verification_conflicts: [{ field: 'parking', message: 'test' }],
    tax_annual_amount: 3200,
    tax_value: 250000,
    financial_details: { tax_annual_amount: 3200 },
    showing_instructions: 'Call Jane at 555-0100',
    batch_id: '9998',
    virtual_tour_url: 'https://my.insidemaps.com/app/test',
    videos: ['https://example.com/v.mp4'],
    structural_details: {
      architectural_style: 'Traditional',
      construction_materials: ['Brick'],
      zestimate: 275000,
      agent_name: 'Leaky Agent',
    },
    utility_details: {
      electric: 'Tenant',
      gas: 'Tenant',
      water_source: 'Public',
    },
    location_details: {
      county: 'Canadian County',
      neighborhood: 'Chisholm Trail',
      subdivision: 'Brookstone',
      school_district: 'Yukon Public Schools',
      schools: [
        { name: 'Ranchwood Elementary', grades: 'PK-5', rating: 8, secret_url: 'https://www.zillow.com/school/1' },
      ],
      walk_score: 42,
      zestimate: 260000,
      source_url: 'https://www.zillow.com/homedetails/123_zpid/',
      insights: {
        level: 2,
        walk_score: 42,
        census_school_district: 'Yukon Public Schools',
        nearby_highlights: [{ name: 'Chisholm Trail Park', category: 'parks', distance_miles: 0.6 }],
        rent_zestimate: 1650,
      },
    },
    property_photos: [
      { id: 'p2', url: 'https://cdn.example.com/2.jpg', display_order: 2, source_url: 'https://zillow.com/2.jpg' },
      { id: 'p1', url: 'https://cdn.example.com/1.jpg', display_order: 1, source_url: 'https://zillow.com/1.jpg' },
    ],
  };

  const safe = projectClientSafeProperty(raw, {
    property_id: 'prop_abc123def456',
    published_rent: 1850,
    published_description: 'Batch 9999 tailored description. Application Fee: $50. Submit your rental application today at Choice Properties.',
  });

  assert.equal(safe.monthly_rent, 1850);
  assert.equal(safe.security_deposit, 1850);
  assert.equal(safe.application_fee, 50);
  assert.match(String(safe.description), /Batch 9999 tailored description/);
  assert.ok(CLIENT_SAFE_PROPERTY_FIELDS.includes('structural_details'));
  assert.ok(CLIENT_SAFE_PROPERTY_FIELDS.includes('location_details'));

  // Stripped forbidden top-level keys
  for (const forbidden of [
    'agent_name',
    'broker_name',
    'landlord_id',
    'landlords',
    'source_url',
    'source_raw_payload',
    'original_data',
    'field_provenance',
    'source_facts_ledger',
    'unmapped_attributes',
    'field_verification_status',
    'verification_conflicts',
    'tax_annual_amount',
    'tax_value',
    'financial_details',
    'showing_instructions',
    'batch_id',
    'virtual_tour_url',
    'videos',
  ]) {
    assert.equal(forbidden in safe, false, `Expected ${forbidden} to be stripped`);
  }

  // Sanitized structural_details & location_details preserve public info and strip internal keys
  const structSafe = safe.structural_details as Record<string, unknown>;
  assert.equal(structSafe.architectural_style, 'Traditional');
  assert.equal('zestimate' in structSafe, false);
  assert.equal('agent_name' in structSafe, false);

  const locSafe = safe.location_details as Record<string, unknown>;
  assert.equal(locSafe.school_district, 'Yukon Public Schools');
  assert.equal(locSafe.subdivision, 'Brookstone');
  assert.equal('zestimate' in locSafe, false);
  assert.equal('source_url' in locSafe, false);
  assert.equal('secret_url' in ((locSafe.schools as Array<Record<string, unknown>>)[0] || {}), false);
  const insightsSafe = locSafe.insights as Record<string, unknown>;
  assert.equal(insightsSafe.level, 2);
  assert.equal('rent_zestimate' in insightsSafe, false);

  // Photos keep strict display_order and omit source_url
  const photos = safe.property_photos as Array<Record<string, unknown>>;
  assert.equal(photos.length, 2);
  assert.equal(photos[0].display_order, 1);
  assert.equal('source_url' in photos[0], false);

  const audit = detectLeakedInternalStrings(safe);
  assert.equal(audit.clean, true, `Unexpected leaks: ${audit.leaks.join(', ')}`);
});

test('sanitize*Details helpers handle null and corrupt strings gracefully', () => {
  assert.equal(sanitizeLocationDetailsForClient(null), null);
  assert.equal(sanitizeLocationDetailsForClient('{}'), null);
  assert.equal(sanitizeStructuralDetailsForClient('not-json'), null);
  assert.equal(sanitizeUtilityDetailsForClient({ electric: 'Tenant', source_url: 'https://zillow.com/foo' })?.electric, 'Tenant');
  assert.equal('source_url' in (sanitizeUtilityDetailsForClient({ electric: 'Tenant', source_url: 'https://zillow.com/foo' }) || {}), false);
});

test('detectLeakedInternalStrings catches forbidden top-level, nested, and external URL leaks', () => {
  const dirty = {
    id: 'prop_1',
    title: 'Private Placement Special',
    description: 'Apply at https://www.zillow.com/homedetails/foo',
    broker_name: 'Leaky Broker',
    source_facts_ledger: { raw: true },
    location_details: {
      subdivision: 'Oak Ridge',
      zestimate: 300000,
    },
    property_photos: [{ url: 'https://cdn.example.com/1.jpg', source_url: 'https://zillow.com/1.jpg' }],
  };
  const audit = detectLeakedInternalStrings(dirty);
  assert.equal(audit.clean, false);
  assert.ok(audit.leaks.includes('forbidden_field:broker_name'));
  assert.ok(audit.leaks.includes('forbidden_field:source_facts_ledger'));
  assert.ok(audit.leaks.includes('forbidden_nested_field:location_details.zestimate'));
  assert.ok(audit.leaks.includes('forbidden_photo_field:property_photos[0].source_url'));
  assert.ok(audit.leaks.includes('external_portal_url_in_description'));
  assert.ok(audit.leaks.includes('private_placement_label_exposed'));
});

test('extractShareTokenFromUrl parses hash and query tokens cleanly', () => {
  assert.equal(
    extractShareTokenFromUrl('https://choice-properties-site.pages.dev/listings.html#share=AbC_123-xyZ'),
    'AbC_123-xyZ',
  );
  assert.equal(
    extractShareTokenFromUrl('https://choice-properties-site.pages.dev/property.html?id=prop_1#share=tok_99'),
    'tok_99',
  );
  assert.equal(extractShareTokenFromUrl(null), null);
});
