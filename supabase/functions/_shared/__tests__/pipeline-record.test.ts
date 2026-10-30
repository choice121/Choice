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
});
