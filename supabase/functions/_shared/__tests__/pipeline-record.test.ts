/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { buildPipelineRecord, qualityScore } from '../pipeline-record.ts';

Deno.test('buildPipelineRecord preserves source provenance and keeps listing dates separate from import/publication dates', () => {
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
  assertEquals(record.source_last_updated_at, '2026-09-20T12:00:00Z');
  assertEquals(record.imported_at, '2026-09-28T10:00:00Z');
  assertEquals(record.published_at, '2026-09-28T13:30:00Z');
  assertEquals(record.source_status, 'available');
});

Deno.test('buildPipelineRecord omits prohibited listing facts and preserves unknown features', () => {
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

Deno.test('buildPipelineRecord preserves structured media entries from source imports', () => {
  const record = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'ZPID-999',
    address: '999 Maple Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74103',
    monthly_rent: 2100,
    bedrooms: 3,
    bathrooms: 2.5,
    total_bathrooms: 2.5,
    virtual_tour_url: 'https://my.matterport.com/show/?m=LEGACY123',
    media: [
      { kind: 'floor_plan', title: 'Main Floor Plan', floor_label: 'Main Floor', url: 'https://cdn.example.com/main-floor.jpg' },
      { kind: 'video', title: 'Walkthrough Video', url: 'https://cdn.example.com/walkthrough.mp4', provider: 'youtube' },
      { kind: 'virtual_tour', title: '3D Tour', floor_label: '2nd Floor', url: 'https://my.matterport.com/show/?m=LEGACY123' },
    ],
  });

  const originalData = JSON.parse(record.original_data as string);
  assertEquals(Array.isArray(originalData.media), true);
  assertEquals(originalData.media.length >= 2, true);
  assertEquals(originalData.media.some((item: any) => item.kind === 'floor_plan'), true);
  assertEquals(originalData.media.some((item: any) => item.kind === 'virtual_tour'), true);
  assertEquals(record.virtual_tour_url, 'https://my.matterport.com/show/?m=LEGACY123');
  assertEquals(record.total_bathrooms, 2.5);
});

Deno.test('buildPipelineRecord persists building identity and reported unit and story counts', () => {
  const record = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'COMMUNITY-123',
    title: '18081 Midway Rd, Dallas, TX 75287',
    address: '18081 Midway Rd',
    city: 'Dallas',
    state: 'TX',
    zip: '75287',
    property_type: 'APARTMENT',
    building_name: 'Hunters Hill',
    is_multi_unit: true,
    price_range: '$1,200 - $1,800',
    total_units: 400,
    floors: 4,
  });

  assertEquals(record.building_name, 'Hunters Hill');
  assertEquals(record.is_multi_unit, true);
  assertEquals(record.price_range, '$1,200 - $1,800');
  assertEquals(record.total_units, 400);
  assertEquals(record.floors, 4);
  const originalData = JSON.parse(record.original_data as string);
  assertEquals(originalData.building_name, 'Hunters Hill');
  assertEquals(originalData.is_multi_unit, true);
  assertEquals(originalData.price_range, '$1,200 - $1,800');
  assertEquals(originalData.total_units, 400);
  assertEquals(originalData.floors, 4);
});

Deno.test('buildPipelineRecord retains structured unit inventory from source imports', () => {
  const record = buildPipelineRecord({
    source: 'zillow',
    source_listing_id: 'COMMUNITY-UNIT-456',
    address: '2000 Lakeview Ave',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    property_type: 'APARTMENT',
    building_name: 'Lakeview Commons',
    is_multi_unit: true,
    total_units: 76,
    floors: 5,
    unit_options: [
      { source_kind: 'available_unit', unit_number: 'A101', bedrooms: 1, bathrooms: 1, square_footage: 650, monthly_rent: 1450, rent_basis: 'base_rent' },
      { source_kind: 'available_unit', unit_number: 'B204', bedrooms: 2, bathrooms: 2, square_footage: 930, monthly_rent: 1895, rent_basis: 'total_monthly_price' },
      { source_kind: 'floor_plan', floor_plan_name: 'Deluxe 2BR', bedrooms: 2, bathrooms: 2, square_footage: 980, starting_rent: 1795 },
    ],
  });

  const originalData = JSON.parse(record.original_data as string);
  assertEquals(Array.isArray(originalData.unit_options), true);
  assertEquals(originalData.unit_options.length, 3);
  assertEquals(originalData.unit_options[0].unit_number, 'A101');
  assertEquals(originalData.unit_options[1].rent_basis, 'total_monthly_price');

  const unitOptions = record.unit_options as Array<Record<string, unknown>>;
  assertEquals(unitOptions.length, 3);
  assertEquals(unitOptions[2].floor_plan_name, 'Deluxe 2BR');
});
