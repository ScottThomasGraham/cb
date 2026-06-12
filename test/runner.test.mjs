import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolveCliPath, makeRunner } from '../src/runner.js';

test('resolveCliPath points at the bundled playwright-cli entry that exists', () => {
  const p = resolveCliPath();
  assert.ok(p.endsWith('cli-client/cli.js'), `unexpected path: ${p}`);
  assert.ok(existsSync(p), 'bundled playwright-cli entry must exist');
});

test('makeRunner runs the cli and reports --version (smoke, captured)', () => {
  const run = makeRunner();
  const res = run(['--version'], { capture: true });
  assert.equal(res.status, 0);
  assert.match(res.stdout.trim(), /\d+\.\d+\.\d+/);
});
