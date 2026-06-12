import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { SESSION, PROFILE_DIR, openArgs } from '../src/config.js';

test('session name is "cb"', () => {
  assert.equal(SESSION, 'cb');
});

test('profile dir is under the home directory', () => {
  assert.ok(PROFILE_DIR.startsWith(homedir()));
  assert.ok(PROFILE_DIR.endsWith('/.cb/profile'));
});

test('openArgs launch a headed, persistent, bundled-chromium session in the profile', () => {
  const a = openArgs();
  assert.deepEqual(a, [
    '-s=cb', 'open',
    '--browser=chromium',
    '--persistent',
    `--profile=${PROFILE_DIR}`,
    '--headed',
  ]);
});
