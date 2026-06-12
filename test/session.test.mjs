import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenSessions, isOpen } from '../src/session.js';

const LIST_OUTPUT = `### Browsers
- cb:
  - status: open
  - browser-type: chrome-for-testing
  - headed: true
- other:
  - status: closed
`;

test('parseOpenSessions returns only open session names', () => {
  const open = parseOpenSessions(LIST_OUTPUT);
  assert.ok(open.has('cb'));
  assert.ok(!open.has('other'));
});

test('parseOpenSessions on empty output returns empty set', () => {
  assert.equal(parseOpenSessions('').size, 0);
});

test('isOpen consults the runner and matches the session name', () => {
  const fakeRun = (args) => {
    assert.deepEqual(args, ['list']);
    return { status: 0, stdout: LIST_OUTPUT, stderr: '' };
  };
  assert.equal(isOpen(fakeRun, 'cb'), true);
  assert.equal(isOpen(fakeRun, 'nope'), false);
});
