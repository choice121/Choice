import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { buildPipelineRecord } from '../pipeline-record.ts';
import { classifySourceIdentity } from '../source-identity.ts';

Deno.test('source identity policy separates agent, company, and Opendoor cases', () => {
  const zillow = classifySourceIdentity({
    source: 'zillow',
    agent_name: 'Jordan Smith',
    agent_image_url: 'https://example.test/jordan.jpg',
  });
  assertEquals(zillow.identity_strategy, 'AGENT_POSTER');
  assertEquals(zillow.source_profile_name, 'Jordan Smith');

  const progress = classifySourceIdentity({ source: 'progress' });
  assertEquals(progress.identity_strategy, 'COMPANY_SOURCE');
  assertEquals(progress.source_profile_name, 'Progress Residential');
  assertEquals(progress.agent_name, null);

  const opendoor = classifySourceIdentity({
    source: 'opendoor',
    agent_name: 'Should never persist',
    poster_landlord_id: '00000000-0000-0000-0000-000000000001',
  });
  assertEquals(opendoor.identity_strategy, 'NO_IDENTITY');
  assertEquals(opendoor.agent_name, null);
  assertEquals(opendoor.poster_landlord_id, null);

  const unknown = classifySourceIdentity({ source: null, agent_name: null });
  assertEquals(unknown.source, 'unknown');
  assertEquals(unknown.identity_strategy, 'UNKNOWN_REVIEW');
});

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

Deno.test('buildPipelineRecord preserves fractional bathrooms and does not fabricate listing dates', () => {
  const record = buildPipelineRecord({
    source: 'opendoor',
    source_listing_id: 'OD-123',
    bathrooms: 1.5,
    agent_name: 'Must be removed',
    listed_at: 'now',
  });
  assertEquals(record.bathrooms, 1.5);
  assertEquals(record.total_bathrooms, 1.5);
  assertEquals(record.listed_at, null);
  assertEquals(record.identity_strategy, 'NO_IDENTITY');
  assertEquals(record.agent_name, null);
  assertEquals(record.poster_landlord_id, null);
});

Deno.test('buildPipelineRecord stores safe categorized poster profiles in original_data', () => {
  const record = buildPipelineRecord({
    source: 'realtor',
    source_listing_id: 'R-123',
    agent_name: 'Jordan Smith',
    broker_name: 'North Realty',
    original_data: JSON.stringify({ _choice_poster_profiles: [
      { category: 'agent', name: 'Jordan Smith', image_url: 'https://images.example.test/jordan.jpg' },
      { category: 'brokerage', name: 'North Realty', image_url: 'https://images.example.test/north.svg' },
      { category: 'brokerage', name: 'North Realty', image_url: 'https://images.example.test/duplicate.svg' },
      { category: 'agent', name: 'Fake Profile', image_url: 'http://images.example.test/insecure.jpg' },
      { category: 'broker', name: 'Unsupported category', image_url: null },
    ] }),
  });

  const originalData = JSON.parse(String(record.original_data));
  assertEquals(originalData._choice_poster_profiles, [
    { category: 'agent', name: 'Jordan Smith', image_url: 'https://images.example.test/jordan.jpg' },
    { category: 'brokerage', name: 'North Realty', image_url: 'https://images.example.test/north.svg' },
    { category: 'agent', name: 'Fake Profile', image_url: null },
  ]);
  assertEquals('poster_profiles' in record, false);
});
