import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const window = { location: { search: '', hash: '' } };
vm.runInNewContext(await readFile(new URL('../js/card-builder.js', import.meta.url), 'utf8'), {
  window,
  URLSearchParams,
});

const card = window.buildPropertyCard({
  id: 'community-1',
  title: '100 Main St, City, ST 12345',
  address: '100 Main St',
  city: 'City',
  state: 'ST',
  monthly_rent: null,
  bedrooms: null,
  bathrooms: null,
  square_footage: null,
  photo_urls: ['https://images.example.test/community.jpg'],
  property_units: [
    { unit_number: null, floor_plan_name: 'A1', bedrooms: 1, bathrooms: 1, square_footage: 616, monthly_rent: 1005 },
    { unit_number: null, floor_plan_name: 'B2', bedrooms: 2, bathrooms: 2, square_footage: 879, monthly_rent: 1315 },
  ],
});

assert.match(card, /<span class="property-card-community-prefix">From <\/span><span class="property-card-price-dollar">\$<\/span>1,005/);
assert.match(card, /1–2 beds/);
assert.match(card, /1–2 baths/);
assert.match(card, /~625–~875 sqft/);
assert.match(card, /2 floor plans/);
assert.doesNotMatch(card, /Contact|TBD/);

console.log('Community property card tests passed.');
