import assert from 'node:assert/strict';
import { renderPropertyUnitsHtml } from '../js/property-units.mjs';

const units = [{
  unit_number: 'A<&1',
  bedrooms: 0,
  bathrooms: 1.5,
  square_footage: 720,
  monthly_rent: 1450,
  floor_plan_name: 'Studio <script>',
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
assert.match(html, /Studio &lt;script&gt;/);
assert.match(html, /Unit A&lt;&amp;1/);
assert.match(html, /\$1,450/);
assert.match(html, /Studio/);
assert.match(html, /1\.5 ba/);
assert.match(html, /https:\/\/images\.example\.test\/unit-a\.jpg/);
assert.doesNotMatch(html, /javascript:|available|security_deposit|2026-11-01/);
assert.equal(renderPropertyUnitsHtml([]), '');

console.log('Property unit renderer tests passed.');
