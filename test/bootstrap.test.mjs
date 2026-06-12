import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureOpen } from '../src/bootstrap.js';
import { openArgs } from '../src/config.js';

function fakeRunner(initiallyOpen) {
  const calls = [];
  let open = initiallyOpen;
  const run = (args) => {
    calls.push(args);
    if (args[0] === 'list') {
      return {
        status: 0,
        stdout: open ? '### Browsers\n- cb:\n  - status: open\n' : '### Browsers\n',
        stderr: '',
      };
    }
    if (args.includes('open')) { open = true; return { status: 0, stdout: '', stderr: '' }; }
    return { status: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}

test('ensureOpen opens the session when it is closed', () => {
  const { run, calls } = fakeRunner(false);
  ensureOpen(run);
  assert.deepEqual(calls[0], ['list']);
  assert.deepEqual(calls[1], openArgs());
});

test('ensureOpen does nothing when the session is already open', () => {
  const { run, calls } = fakeRunner(true);
  ensureOpen(run);
  assert.deepEqual(calls, [['list']]);
});
