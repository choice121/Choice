import nodeTest from 'node:test';
import assertNode from 'node:assert/strict';
import { buildPipelineRecord, qualityScore } from '../pipeline-record.ts';

declare const Deno: {
  test: (name: string, fn: () => void | Promise<void>) => void;
};

const testRunner = (typeof Deno !== 'undefined'
  ? Deno.test
  : nodeTest) as (name: string, fn: () => void | Promise<void>) => void;

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  assertNode.deepStrictEqual(actual, expected, message);
}

testRunner('buildPipelineRecord preserves source provenance and keeps listing dates separate from import/publication dates', () => {
  const record = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'ZPID-123',
    source_url: 'https://example.com/listing/123',
    title: '2BR Condo',
    address: '123 Main St',
    city: 'Columbus',
    state: 'OH',
    zip: '43229',
    property_type: 'CONDOS',
    bedrooms: 2,
    bathrooms: 2,
    monthly_rent: 1600,
    listed_at: '2024-04-15',
    source_last_updated_at: '2026-09-20T12:00:00Z',
    imported_at: '2026-09-28T10:00:00Z',
    published_at: '2026-09-28T13:30:00Z',
    source_status: 'available',
  });

  assertEquals(record.listed_at, '2024-04-15');
  assertEquals(record.source_last_updated_at, '2026-09-20T12:00:00.000Z');
  assertEquals(record.imported_at, '2026-09-28T10:00:00.000Z');
  assertEquals(record.published_at, '2026-09-28T13:30:00.000Z');
  assertEquals(record.source_status, 'available');
});

testRunner('buildPipelineRecord keeps apartment community inventory in existing original_data storage', () => {
  const record = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'ZPID-APT-123',
    source_url: 'https://www.zillow.com/apartments/example/123/',
    property_type: 'APARTMENT',
    building_name: 'Example Apartments',
    is_multi_unit: true,
    total_units: 120,
    floors: 5,
    price_range: '$1,200-$2,400',
    rent_basis: 'Base rent',
    original_data: JSON.stringify({
      _import: 'browser-extension-v52.7.1',
      source_marker: 'keep-this',
    }),
    unit_options: [{
      source_kind: 'unit',
      unit_number: 'A101',
      bedrooms: 1,
      bathrooms: 1.5,
      square_footage: 750,
      monthly_rent: 1450,
      rent_basis: 'Base rent',
    }],
    media: [{ kind: 'floor_plan', title: 'One bedroom', url: 'https://cdn.example.com/plan.jpg' }],
  });

  const originalData = JSON.parse(String(record.original_data));
  assertEquals(originalData.building_name, 'Example Apartments');
  assertEquals(originalData._import, 'browser-extension-v52.7.1');
  assertEquals(originalData.source_marker, 'keep-this');
  assertEquals(originalData.is_multi_unit, true);
  assertEquals(originalData.total_units, 120);
  assertEquals(originalData.floors, 5);
  assertEquals(originalData.price_range, '$1,200-$2,400');
  assertEquals(originalData.rent_basis, 'Base rent');
  assertEquals(originalData.unit_options[0].unit_number, 'A101');
  assertEquals(originalData.unit_options[0].bathrooms, 1.5);
  assertEquals(originalData.media[0].kind, 'floor_plan');
});

testRunner('buildPipelineRecord omits prohibited listing facts and preserves unknown features', () => {
  const record = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'ZPID-456',
    address: '456 Example St',
    city: 'Columbus',
    state: 'OH',
    zip: '43229',
    monthly_rent: 1700,
    available_date: '2026-11-01',
    minimum_lease_months: 12,
    lease_terms: ['12 months'],
    smoking_allowed: true,
    has_basement: null,
    has_central_air: null,
  });

  assertEquals(record.available_date, null);
  assertEquals(record.minimum_lease_months, null);
  assertEquals(record.lease_terms, '[]');
  assertEquals(record.smoking_allowed, null);
  assertEquals(record.has_basement, null);
  assertEquals(record.has_central_air, null);
  const withoutProhibitedFacts = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'ZPID-789',
    address: '456 Example St',
    city: 'Columbus',
    state: 'OH',
    zip: '43229',
    monthly_rent: 1700,
  });
  assertEquals(record.data_quality_score, withoutProhibitedFacts.data_quality_score);
  assertEquals(record.data_quality_score, qualityScore(record));
  assertEquals(JSON.parse(record.missing_fields as string).includes('available_date'), false);
});
