import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { buildPipelineRecord } from '../pipeline-record.ts';

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
