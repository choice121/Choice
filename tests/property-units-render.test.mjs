import assert from 'node:assert/strict';
import { renderPropertyUnitsHtml } from '../js/property-units.mjs';

const units = [{
  unit_number: null,
  bedrooms: 1,
  bathrooms: 1,
  square_footage: 447,
  monthly_rent: 719,
  floor_plan_name: null,
  floor_plan_image_url: 'javascript:alert(1)',
  unit_photos: [
    'https://images.example.test/unit-a.jpg',
    'javascript:alert(1)',
  ],
  amenities: ['Washer', '<script>'],
  available_date: '2026-11-01',
  status: 'available',
  security_deposit: 1450,
}];

const html = renderPropertyUnitsHtml(units);
assert.match(html, /1 bedroom layout/);
assert.doesNotMatch(html, /Unit null|Unit undefined/);
assert.match(html, /\$719/);
assert.match(html, /1 bd/);
assert.match(html, /1 ba/);
assert.match(html, /447 sqft/);
assert.match(html, /&lt;script&gt;/);
assert.match(html, /https:\/\/images\.example\.test\/unit-a\.jpg/);
assert.doesNotMatch(html, /javascript:|available|security_deposit|2026-11-01/);
assert.equal(renderPropertyUnitsHtml([]), '');

console.log('Property unit renderer tests passed.');
