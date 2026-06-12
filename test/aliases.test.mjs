import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapArgs } from '../src/aliases.js';

test('back/forward/tabs map to upstream verbs', () => {
  assert.deepEqual(mapArgs(['back']), ['go-back']);
  assert.deepEqual(mapArgs(['forward']), ['go-forward']);
  assert.deepEqual(mapArgs(['tabs']), ['tab-list']);
});

test('read becomes a raw innerText eval', () => {
  assert.deepEqual(mapArgs(['read']), ['eval', 'document.body.innerText', '--raw']);
});

test('aliases preserve trailing args', () => {
  assert.deepEqual(mapArgs(['back', '--json']), ['go-back', '--json']);
});

test('unknown verbs pass through unchanged', () => {
  assert.deepEqual(mapArgs(['click', 'e5']), ['click', 'e5']);
  assert.deepEqual(mapArgs(['goto', 'https://x.com']), ['goto', 'https://x.com']);
});

test('empty argv passes through', () => {
  assert.deepEqual(mapArgs([]), []);
});
