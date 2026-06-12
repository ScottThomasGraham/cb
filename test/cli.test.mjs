import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.js';

function harness({ open = false } = {}) {
  const calls = [];
  let isOpenState = open;
  const run = (args) => {
    calls.push(args);
    if (args[0] === 'list') {
      return { status: 0, stdout: isOpenState ? '- cb:\n  - status: open\n' : '', stderr: '' };
    }
    if (args.includes('open')) { isOpenState = true; }
    if (args[1] === 'close') { isOpenState = false; }
    return { status: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}

test('status prints open/closed and never bootstraps', () => {
  const h = harness({ open: false });
  const lines = [];
  const code = main(['status'], h.run, (s) => lines.push(s));
  assert.equal(code, 0);
  assert.deepEqual(h.calls, [['list']]); // only the inspection call
  assert.match(lines[0], /not running/);
});

test('a normal verb bootstraps then forwards under -s=cb', () => {
  const h = harness({ open: false });
  main(['goto', 'https://example.com'], h.run, () => {});
  assert.deepEqual(h.calls[0], ['list']);          // bootstrap check
  assert.ok(h.calls.some(a => a.includes('open'))); // opened
  const fwd = h.calls.at(-1);
  assert.deepEqual(fwd, ['-s=cb', 'goto', 'https://example.com']);
});

test('back is aliased to go-back when forwarded', () => {
  const h = harness({ open: true });
  main(['back'], h.run, () => {});
  assert.deepEqual(h.calls.at(-1), ['-s=cb', 'go-back']);
});

test('quit forwards close without bootstrapping', () => {
  const h = harness({ open: true });
  main(['quit'], h.run, () => {});
  assert.ok(!h.calls.some(a => a.includes('open')));
  assert.deepEqual(h.calls.at(-1), ['-s=cb', 'close']);
});

test('restart closes then reopens', () => {
  const h = harness({ open: true });
  main(['restart'], h.run, () => {});
  assert.deepEqual(h.calls[0], ['-s=cb', 'close']);
  assert.ok(h.calls.some(a => a.includes('open')));
});
