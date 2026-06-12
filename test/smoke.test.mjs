import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('package.json declares ESM and the cb bin', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin.cb, 'bin/cb.mjs');
  assert.ok(pkg.dependencies.playwright, 'playwright must be a dependency');
});
