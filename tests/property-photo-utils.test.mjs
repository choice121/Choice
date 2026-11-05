import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhotoList } from '../js/property-photo-utils.js';

test('normalizePhotoList removes empty and duplicate values and keeps valid urls', () => {
  const list = [
    'https://cdn.example.com/a.jpg',
    '',
    null,
    undefined,
    'https://cdn.example.com/a.jpg',
    '   ',
    'https://cdn.example.com/b.jpg',
  ];

  assert.deepEqual(normalizePhotoList(list), [
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/b.jpg',
  ]);
});

test('normalizePhotoList falls back to placeholder when no valid media remains', () => {
  assert.deepEqual(normalizePhotoList([null, '', '  ', undefined]), ['/assets/placeholder-property.jpg']);
});
