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
  amenities: ['Washer'],
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
assert.match(html, /https:\/\/images\.example\.test\/unit-a\.jpg/);
assert.doesNotMatch(html, /javascript:|available|security_deposit|2026-11-01/);
assert.equal(renderPropertyUnitsHtml([]), '');

const groupedHtml = renderPropertyUnitsHtml([
  { unit_number: 'A1', bedrooms: 2, bathrooms: 1, monthly_rent: 1200, building_id: 'building-a', floor_id: 'floor-1', status: 'available' },
  { unit_number: 'B1', bedrooms: 1, bathrooms: 1, monthly_rent: 900, building_id: 'building-a', floor_id: 'floor-2' },
], [
  { id: 'building-a', name: 'North Building' },
], [
  { id: 'floor-1', building_id: 'building-a', floor_label: 'First floor', sort_order: 0 },
  { id: 'floor-2', building_id: 'building-a', floor_label: 'Second floor', sort_order: 1 },
]);
assert.match(groupedHtml, /North Building/);
assert.match(groupedHtml, /First floor/);
assert.match(groupedHtml, /Second floor/);
assert.match(groupedHtml, /Unit A1/);
assert.doesNotMatch(groupedHtml, /available/);

console.log('Property unit renderer tests passed.');
