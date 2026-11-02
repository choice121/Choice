import nodeTest from 'node:test';
import assertNode from 'node:assert/strict';
import {
  categorizeNearbyPlace,
  haversineMeters,
  normalizeNearbyPlaces,
} from '../location-intelligence.ts';

const testRunner = (typeof Deno !== 'undefined'
  ? Deno.test
  : nodeTest) as (name: string, fn: () => void | Promise<void>) => void;

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  assertNode.deepStrictEqual(actual, expected, message);
}

function assert(condition: unknown, message?: string): asserts condition {
  assertNode.ok(condition, message);
}

testRunner('categorizeNearbyPlace maps supported location groups and ignores unrelated categories', () => {
  assertEquals(categorizeNearbyPlace(['education.school']), 'school');
  assertEquals(categorizeNearbyPlace(['leisure.park']), 'park');
  assertEquals(categorizeNearbyPlace(['commercial.supermarket']), 'shopping');
  assertEquals(categorizeNearbyPlace(['healthcare.hospital']), 'healthcare');
  assertEquals(categorizeNearbyPlace(['healthcare.clinic_or_praxis']), 'healthcare');
  assertEquals(categorizeNearbyPlace(['healthcare']), 'healthcare');
  assertEquals(categorizeNearbyPlace(['public_transport']), 'transit');
  assertEquals(categorizeNearbyPlace(['commercial.restaurant']), null);
});

testRunner('haversineMeters returns a plausible great-circle distance', () => {
  assert(Math.abs(haversineMeters(0, 0, 0, 1) - 111_195) < 5);
});

testRunner('normalizeNearbyPlaces filters distant records and sorts nearest place results', () => {
  const places = normalizeNearbyPlaces([
    {
      properties: { place_id: 'school-1', name: 'Nearby School', categories: ['education.school'] },
      geometry: { coordinates: [0.001, 0] },
    },
    {
      properties: { place_id: 'park-1', name: 'Nearby Park', categories: ['leisure.park'] },
      geometry: { coordinates: [0.002, 0] },
    },
    {
      properties: { place_id: 'far-1', name: 'Far Park', categories: ['leisure.park'] },
      geometry: { coordinates: [0.1, 0] },
    },
  ], 0, 0);

  assertEquals(places.map((place) => place.name), ['Nearby School', 'Nearby Park']);
  assert(places[0].distance_m < places[1].distance_m);
});
