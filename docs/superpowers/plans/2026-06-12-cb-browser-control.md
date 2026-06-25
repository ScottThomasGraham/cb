# cb — Chromium control for Claude Code: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `cb`, a thin self-bootstrapping CLI that gives Claude Code instant, reliable control of a real headed Chromium — with nothing to start manually.

**Architecture:** `cb` wraps Playwright 1.60's bundled `playwright-cli` (warm daemon-held sessions, accessibility-ref perception, deep command surface — all validated on this machine 2026-06-12). We write only three things on top: (1) a **self-bootstrap** layer that auto-opens a single headed, bundled-Chromium, dedicated-profile session named `cb` on the first command; (2) a small **alias map** so a handful of high-frequency verbs read naturally; (3) install + a Claude Code **skill** so Claude auto-reaches for it. The old Claude-Browser-V3 Electron app is deleted.

**Tech Stack:** Node.js (ESM), Playwright 1.60 (`playwright-core` bundled `playwright-cli`), `node:test` for tests (no extra test deps), bundled Chromium.

**Reference:** spec at `docs/superpowers/specs/2026-06-12-cb-browser-control-design.md`. Underlying CLI docs: `node_modules/playwright-core/lib/tools/cli-client/skill/SKILL.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Package metadata, `bin`, test script, `playwright` dependency |
| `src/runner.js` | Resolve the bundled `playwright-cli` entry and spawn it (captured or inherited stdio) |
| `src/aliases.js` | Pure: map friendly `cb` verbs → real `playwright-cli` verbs |
| `src/session.js` | Pure: parse `list` output; `isOpen()` helper over a runner |
| `src/bootstrap.js` | `ensureOpen()` — open the `cb` session if not already open |
| `src/config.js` | Shared constants: session name, profile path, open args |
| `src/cli.js` | Entry point: orchestrate bootstrap + forward; special verbs (`status`, `restart`, `quit`) |
| `bin/cb.mjs` | Executable shim (`#!/usr/bin/env node`) importing `src/cli.js` |
| `test/*.test.mjs` | Unit tests per pure module + bootstrap, using injected fake runners |
| `skill/SKILL.md` | Claude Code skill documenting the `cb` surface |
| `plugin/.claude-plugin/plugin.json` + `plugin/commands/cb.md` | Plugin registration |
| `scripts/install.mjs` | Symlink `~/.local/bin/cb` + `claude-browser`; register skill/plugin |
| `scripts/delete-v3.md` | Documented manual steps to remove Claude-Browser-V3 (needs user approval) |
| `README.md` | What it is, how to use, how it was built |

The pure modules (`aliases`, `session`, `config`) and the side-effecting ones (`runner`, `bootstrap`, `cli`) are split so logic is unit-testable with a fake runner and no real browser launches in CI.

---

## Task 1: Project scaffold

**Files:**
- Modify: `package.json`
- Create: `test/smoke.test.mjs`

- [ ] **Step 1: Write a failing test that the package is ESM with a `cb` bin**

`test/smoke.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('package.json declares ESM and the cb bin', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin.cb, 'bin/cb.mjs');
  assert.ok(pkg.dependencies.playwright, 'playwright must be a dependency');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/smoke.test.mjs`
Expected: FAIL (`pkg.bin` is undefined / not ESM).

- [ ] **Step 3: Edit `package.json` to the real shape**

Replace the generated `package.json` contents with:
```json
{
  "name": "cb",
  "version": "1.0.0",
  "description": "Instant Chromium control for Claude Code — a self-bootstrapping wrapper over playwright-cli.",
  "private": true,
  "type": "module",
  "bin": { "cb": "bin/cb.mjs" },
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "playwright": "^1.60.0"
  }
}
```
(`playwright` is already installed from the planning spike; keep the existing `node_modules` and `package-lock.json`.)

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/smoke.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json test/smoke.test.mjs
git commit -m "chore: scaffold cb package (ESM, cb bin, playwright dep)"
```

---

## Task 2: Config constants

**Files:**
- Create: `src/config.js`
- Create: `test/config.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/config.test.mjs`:
```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/config.test.mjs`
Expected: FAIL (`Cannot find module '../src/config.js'`).

- [ ] **Step 3: Implement `src/config.js`**

```js
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SESSION = 'cb';
export const PROFILE_DIR = join(homedir(), '.cb', 'profile');

// Verbs that must NOT trigger an auto-open (they manage or inspect lifecycle).
export const NO_BOOTSTRAP = new Set([
  'status', 'restart', 'quit', 'close', 'close-all', 'kill-all', 'list', 'delete-data',
]);

export function openArgs() {
  return [
    `-s=${SESSION}`, 'open',
    '--browser=chromium',
    '--persistent',
    `--profile=${PROFILE_DIR}`,
    '--headed',
  ];
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.js test/config.test.mjs
git commit -m "feat: cb config constants (session, profile, open args)"
```

---

## Task 3: Verb alias map

**Files:**
- Create: `src/aliases.js`
- Create: `test/aliases.test.mjs`

Rationale: `cb` is mostly passthrough to `playwright-cli`. Only a few verbs get friendlier names; everything else (goto, click, fill, type, snapshot, screenshot, eval, requests, tab-new, …) passes through unchanged so the full upstream surface stays available.

- [ ] **Step 1: Write the failing test**

`test/aliases.test.mjs`:
```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/aliases.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/aliases.js`**

```js
const ALIASES = {
  back: ['go-back'],
  forward: ['go-forward'],
  tabs: ['tab-list'],
  read: ['eval', 'document.body.innerText', '--raw'],
};

export function mapArgs(argv) {
  if (argv.length === 0) return argv;
  const [verb, ...rest] = argv;
  if (Object.prototype.hasOwnProperty.call(ALIASES, verb)) {
    return [...ALIASES[verb], ...rest];
  }
  return argv;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/aliases.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aliases.js test/aliases.test.mjs
git commit -m "feat: cb verb alias map (passthrough + friendly verbs)"
```

---

## Task 4: Session list parsing + isOpen

**Files:**
- Create: `src/session.js`
- Create: `test/session.test.mjs`

`playwright-cli list` prints blocks like:
```
### Browsers
- cb:
  - status: open
  - browser-type: chrome-for-testing
  - headed: true
```

- [ ] **Step 1: Write the failing test**

`test/session.test.mjs`:
```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/session.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/session.js`**

```js
export function parseOpenSessions(stdout) {
  const open = new Set();
  let current = null;
  for (const line of stdout.split('\n')) {
    const header = line.match(/^-\s+([^:]+):\s*$/);
    if (header) { current = header[1].trim(); continue; }
    if (current && /status:\s*open/.test(line)) { open.add(current); current = null; }
  }
  return open;
}

export function isOpen(run, name) {
  const { stdout } = run(['list'], { capture: true });
  return parseOpenSessions(stdout).has(name);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/session.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session.js test/session.test.mjs
git commit -m "feat: parse playwright-cli session list + isOpen helper"
```

---

## Task 5: The runner (spawn playwright-cli)

**Files:**
- Create: `src/runner.js`
- Create: `test/runner.test.mjs`

- [ ] **Step 1: Write the failing test (resolve the bundled CLI path)**

`test/runner.test.mjs`:
```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/runner.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/runner.js`**

```js
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function resolveCliPath() {
  return require.resolve('playwright-core/lib/tools/cli-client/cli.js');
}

export function makeRunner(cliPath = resolveCliPath()) {
  return function run(args, { capture = false } = {}) {
    const res = spawnSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf8',
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    return {
      status: res.status ?? 1,
      stdout: res.stdout || '',
      stderr: res.stderr || '',
    };
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/runner.test.mjs`
Expected: PASS (prints a version like `1.60.0`).

- [ ] **Step 5: Commit**

```bash
git add src/runner.js test/runner.test.mjs
git commit -m "feat: runner that resolves + spawns the bundled playwright-cli"
```

---

## Task 6: ensureOpen (self-bootstrap)

**Files:**
- Create: `src/bootstrap.js`
- Create: `test/bootstrap.test.mjs`

- [ ] **Step 1: Write the failing test (with a fake runner — no real browser)**

`test/bootstrap.test.mjs`:
```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/bootstrap.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/bootstrap.js`**

```js
import { isOpen } from './session.js';
import { SESSION, openArgs } from './config.js';

export function ensureOpen(run) {
  if (isOpen(run, SESSION)) return;
  const res = run(openArgs(), { capture: true });
  if (res.status !== 0) {
    throw new Error(`cb: failed to open browser session\n${res.stderr || res.stdout}`);
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/bootstrap.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js test/bootstrap.test.mjs
git commit -m "feat: ensureOpen self-bootstrap (auto-open cb session)"
```

---

## Task 7: CLI orchestration + special verbs

**Files:**
- Create: `src/cli.js`
- Create: `bin/cb.mjs`
- Create: `test/cli.test.mjs`

`src/cli.js` exports a pure-ish `main(argv, run, out)` so it can be unit-tested with a fake runner and fake output sink. Behavior:
- `status` → print whether the `cb` session is open; never bootstraps.
- `quit` → forward `close`; never bootstraps.
- `restart` → `close` then `ensureOpen`; never bootstraps before close.
- lifecycle/inspection verbs in `NO_BOOTSTRAP` → forward without bootstrapping.
- everything else → `ensureOpen`, then forward `[-s=cb, ...mapArgs(argv)]` with inherited stdio.

- [ ] **Step 1: Write the failing test**

`test/cli.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.js';

function harness({ open = false } = {}) {
  const calls = [];
  let isOpenState = open;
  const run = (args, opts) => {
    calls.push(args);
    if (args[0] === 'list') {
      return { status: 0, stdout: isOpenState ? '- cb:\n  - status: open\n' : '', stderr: '' };
    }
    if (args.includes('open')) { isOpenState = true; }
    if (args[1] === 'close') { isOpenState = false; }
    return { status: 0, stdout: '', stderr: '' };
  };
  const lines = [];
  const out = (s) => lines.push(s);
  return { run, calls, lines };
}

test('status prints open/closed and never bootstraps', () => {
  const h = harness({ open: false });
  const code = main(['status'], h.run, h.lines.push.bind(h.lines));
  assert.equal(code, 0);
  assert.deepEqual(h.calls, [['list']]); // only the inspection call
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/cli.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/cli.js`**

```js
import { ensureOpen } from './bootstrap.js';
import { isOpen } from './session.js';
import { mapArgs } from './aliases.js';
import { SESSION, NO_BOOTSTRAP } from './config.js';

// main(argv, run, out) -> exit code. `out` is a line-printer (defaults to console.log).
export function main(argv, run, out = console.log) {
  const verb = argv[0];

  if (!verb) {
    out('cb: usage: cb <command> [args]   (try: cb snapshot, cb goto <url>, cb status)');
    return 1;
  }

  if (verb === 'status') {
    out(isOpen(run, SESSION) ? 'cb: browser is open' : 'cb: browser is not running');
    return 0;
  }

  if (verb === 'restart') {
    run([`-s=${SESSION}`, 'close'], { capture: true });
    ensureOpen(run);
    out('cb: browser restarted');
    return 0;
  }

  if (verb === 'quit') {
    const res = run([`-s=${SESSION}`, 'close']);
    return res.status;
  }

  if (NO_BOOTSTRAP.has(verb)) {
    // list/close/close-all/kill-all/delete-data: forward as-is, no bootstrap.
    const res = run([`-s=${SESSION}`, ...argv]);
    return res.status;
  }

  ensureOpen(run);
  const res = run([`-s=${SESSION}`, ...mapArgs(argv)]);
  return res.status;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test test/cli.test.mjs`
Expected: PASS.

- [ ] **Step 5: Create the executable shim `bin/cb.mjs`**

```js
#!/usr/bin/env node
import { main } from '../src/cli.js';
import { makeRunner } from '../src/runner.js';

const code = main(process.argv.slice(2), makeRunner());
process.exit(code);
```

- [ ] **Step 6: Make it executable and verify the whole suite passes**

```bash
chmod +x bin/cb.mjs
node --test
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/cli.js bin/cb.mjs test/cli.test.mjs
git commit -m "feat: cb CLI orchestration (bootstrap, forward, status/quit/restart)"
```

---

## Task 8: Real end-to-end verification

**Files:** none (manual verification against a live browser).

- [ ] **Step 1: Cold start with no session — proves zero-setup bootstrap**

```bash
node bin/cb.mjs status            # expect: "cb: browser is not running"
node bin/cb.mjs goto https://example.com
```
Expected: a **headed Chromium window opens**, navigates to example.com, and the command prints the page + a snapshot reference. (~1–2s the first time.)

- [ ] **Step 2: Warm reuse + ref action + the V3 bug fix**

```bash
node bin/cb.mjs goto "data:text/html,<input id=p placeholder=Phone>"
node bin/cb.mjs snapshot --raw                 # note the textbox ref, e.g. e2
node bin/cb.mjs fill e2 9144825865             # all-digit input must succeed
node bin/cb.mjs --raw eval "document.querySelector('#p').value"
```
Expected: final line prints `"9144825865"` — confirms warm reuse, ref-based action, and that the V3 all-digit coercion bug does not reproduce.

- [ ] **Step 3: Aliases + lifecycle**

```bash
node bin/cb.mjs goto https://example.com
node bin/cb.mjs back        # -> go-back
node bin/cb.mjs tabs        # -> tab-list
node bin/cb.mjs status      # -> "cb: browser is open"
node bin/cb.mjs quit        # closes the window
node bin/cb.mjs status      # -> "cb: browser is not running"
```
Expected: each behaves as commented; the window closes on `quit`.

- [ ] **Step 4: Commit a short verification note**

Append a "## Verified" section to `README.md` (created in Task 11) — or defer to Task 11 if README isn't written yet. No code commit needed here if nothing changed.

---

## Task 9: Install script (PATH + alias)

**Files:**
- Create: `scripts/install.mjs`

- [ ] **Step 1: Implement `scripts/install.mjs`**

```js
#!/usr/bin/env node
// Symlinks ~/.local/bin/cb (and claude-browser alias) to bin/cb.mjs, and links the
// skill + plugin into ~/.claude. Idempotent: replaces existing symlinks.
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, symlinkSync, existsSync, lstatSync } from 'node:fs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();

function link(target, linkPath) {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (existsSync(linkPath) || isSymlink(linkPath)) rmSync(linkPath, { force: true });
  symlinkSync(target, linkPath);
  console.log(`linked ${linkPath} -> ${target}`);
}
function isSymlink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

const bin = join(repo, 'bin', 'cb.mjs');
link(bin, join(home, '.local', 'bin', 'cb'));
link(bin, join(home, '.local', 'bin', 'claude-browser')); // back-compat alias

// Plugin (skill ships inside the plugin under skills/cb/SKILL.md).
const pluginSrc = join(repo, 'plugin');
link(pluginSrc, join(home, '.claude', 'plugins', 'cache', 'cb-local'));

console.log('\nDone. Ensure ~/.local/bin is on PATH. Try: cb status');
```

- [ ] **Step 2: Run it and verify the symlinks**

```bash
node scripts/install.mjs
ls -l ~/.local/bin/cb ~/.local/bin/claude-browser
cb status
```
Expected: symlinks created; `cb status` prints `cb: browser is not running`.

- [ ] **Step 3: Commit**

```bash
git add scripts/install.mjs
git commit -m "feat: install script (cb + claude-browser symlinks, plugin link)"
```

---

## Task 10: Claude Code skill + plugin

**Files:**
- Create: `plugin/.claude-plugin/plugin.json`
- Create: `plugin/skills/cb/SKILL.md`
- Create: `plugin/commands/cb.md`

- [ ] **Step 1: Create `plugin/.claude-plugin/plugin.json`**

```json
{
  "name": "cb-local",
  "version": "1.0.0",
  "description": "Instant Chromium control for Claude Code via the cb CLI."
}
```

- [ ] **Step 2: Create `plugin/skills/cb/SKILL.md`**

```markdown
---
name: cb
description: Use whenever a task needs a real web browser — navigating sites, logging into web apps (Slack, Google, Vercel, etc.), filling forms, scraping/collecting data, or anything needing an authenticated or rendered page. Drives a real headed Chromium via the `cb` CLI. Nothing needs to be running first.
---

# Driving Chromium with `cb`

`cb` controls a real, persistent, headed Chromium. The first `cb` command auto-launches
the browser (dedicated profile at `~/.cb/profile`, logins persist); later commands attach
instantly. There is nothing to start manually.

## The loop: snapshot → act by ref
1. `cb snapshot` — prints an accessibility outline; each interactive element has a ref like `e7`.
2. Act on refs: `cb click e7`, `cb fill e3 "text"`, `cb type "text"`, `cb select e9 "value"`.
3. Re-`snapshot` after navigation or major state changes (refs are reassigned per snapshot).

`cb read` returns the page as text. `cb screenshot --filename=p.png` saves an image to Read.

## Common commands
- Navigate: `cb goto <url>`, `cb back`, `cb forward`, `cb reload`
- Tabs: `cb tabs`, `cb tab-new [url]`, `cb tab-select <n>`, `cb tab-close [n]`
- Act: `cb click <ref>`, `cb fill <ref> <text>`, `cb type <text>`, `cb press Enter`, `cb hover <ref>`, `cb check <ref>`, `cb upload <file>`, `cb select <ref> <value>`
- Data: `cb --raw eval "<js>"`, `cb requests`, `cb console`, `cb snapshot --raw`
- Lifecycle: `cb status`, `cb quit`, `cb restart`

## Gotchas
- **Digits are fine now.** `cb fill e2 9144825865` works — no number-coercion bug.
- **CAPTCHAs / "I'm not a robot": never solve them.** Ask Scott to click, then continue.
- **Passwords / 2FA:** type straight into the field; never write secrets to files.
- Use `--raw` to pipe a command's value into other tools; `--json` for structured output.
- Full upstream surface (cookies, localstorage, route, pdf, tracing, …) passes through `cb` unchanged — see `node_modules/.../cli-client/skill/SKILL.md` in the cb repo.
```

- [ ] **Step 3: Create `plugin/commands/cb.md`**

```markdown
---
description: Drive the cb Chromium browser (snapshot → act by ref).
---

Run `cb <command>` to control the browser. Start with `cb snapshot` to see refs, then
`cb click <ref>` / `cb fill <ref> <text>`. `cb goto <url>` to navigate. `cb status` to
check if it's running. The browser auto-launches on first use.
```

- [ ] **Step 4: Re-run install so the plugin links, and sanity check**

```bash
node scripts/install.mjs
ls -l ~/.claude/plugins/cache/cb-local
```
Expected: symlink to the repo `plugin/` directory exists.

- [ ] **Step 5: Commit**

```bash
git add plugin/
git commit -m "feat: cb Claude Code plugin (skill + command)"
```

---

## Task 11: README + delete-V3 runbook

**Files:**
- Create: `README.md`
- Create: `scripts/delete-v3.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# cb — instant Chromium control for Claude Code

`cb` gives Claude Code direct control of a real, headed Chromium with zero setup: ask in
chat, the first `cb` command launches the browser, and Claude drives it by accessibility
refs. It is a thin self-bootstrapping wrapper over Playwright 1.60's bundled `playwright-cli`.

## Install
```bash
npm install
npx playwright install chromium
node scripts/install.mjs   # symlinks ~/.local/bin/cb (+ claude-browser alias)
cb status
```

## Use
```bash
cb goto https://example.com
cb snapshot            # see element refs
cb click e7
cb fill e3 "hello"
cb quit
```

## How it works
- One warm, headed, bundled-Chromium session named `cb`, dedicated profile at `~/.cb/profile` (log in once).
- `cb` auto-opens the session on the first command (the only thing it adds over `playwright-cli`).
- A few friendly verb aliases (`back`, `forward`, `tabs`, `read`); everything else passes through to `playwright-cli`.

## Tests
```bash
npm test
```

## Verified
Cold-start bootstrap, warm reuse, ref-based actions, and the all-digit-input fix were
verified manually (Task 8 of the implementation plan).
```

- [ ] **Step 2: Write `scripts/delete-v3.md` (runbook — destructive steps need user approval)**

```markdown
# Removing Claude-Browser-V3

Run these once cb is installed and verified. They are destructive; confirm before each.

1. Stop the app if running:
   `osascript -e 'quit app "Claude-Browser-V3"'` (ignore if not running)
2. Remove the app bundle:
   `rm -rf "/Applications/Claude-Browser-V3.app"`
3. Remove the source repo:
   `rm -rf ~/Projects/Claude-Browser-V3`
4. Remove the old CLI symlink (replaced by cb's claude-browser alias):
   `rm -f ~/.local/bin/claude-browser` then re-run `node ~/Projects/cb/scripts/install.mjs`
   so `claude-browser` points at cb.
5. Remove the old plugin cache:
   `rm -rf ~/.claude/plugins/cache/claude-browser-local` (and any orphaned markers)
6. Verify: `cb status` works; `claude-browser status` (alias) works.
```

- [ ] **Step 3: Commit**

```bash
git add README.md scripts/delete-v3.md
git commit -m "docs: README + V3 removal runbook"
```

---

## Task 12: Execute V3 deletion + update memory note

**Files:** none in-repo (system changes + memory file outside the repo).

- [ ] **Step 1: With user approval, run the `scripts/delete-v3.md` steps** (Bash `rm` requires permission — request it explicitly).

- [ ] **Step 2: Re-run `node scripts/install.mjs`** so `claude-browser` resolves to cb after the old symlink is gone.

- [ ] **Step 3: Verify clean state**

```bash
cb status
claude-browser status
ls /Applications | grep -i claude-browser   # expect: nothing
```

- [ ] **Step 4: Rewrite the memory note** `~/.claude/projects/-Users-scottgraham/memory/claude-browser-tooling.md` to describe `cb` (warm session, snapshot→ref loop, self-bootstrap, profile path, alias verbs, digit-fix, install/uninstall) and update the one-line pointer in `MEMORY.md`. (No git commit — memory lives outside the repo.)

---

## Self-Review

**Spec coverage:**
- Zero setup / self-bootstrap → Tasks 6, 7 (`ensureOpen`, `status`/normal-verb flow), verified Task 8.
- Full real Chromium, tabs, address bar → bundled-chromium headed open (Task 2 `openArgs`), verified Task 8.
- Reliable ref-based control + auto-wait → provided by `playwright-cli` (snapshot/refs), exercised Tasks 7–8.
- Capable (forms, scraping, downloads, uploads, network, multi-tab) → passthrough surface (Task 3 keeps non-aliased verbs intact) + skill doc (Task 10).
- Persistent dedicated profile, log in once → `--persistent --profile=~/.cb/profile` (Task 2).
- CLI interface, not MCP → entire design (bin Task 7, install Task 9).
- `cb` skill replaces old plugin; `claude-browser` alias kept → Tasks 9–10.
- All-digit input bug fixed → asserted in Task 8 Step 2.
- Delete V3, no migration → Tasks 11–12.
- Update memory note → Task 12 Step 4.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test shows real assertions.

**Type/name consistency:** `run(args, {capture})` signature is uniform across `runner`, `session.isOpen`, `bootstrap.ensureOpen`, and `cli.main`. `SESSION`/`PROFILE_DIR`/`openArgs`/`NO_BOOTSTRAP` from `config.js` are used consistently. `mapArgs` and `parseOpenSessions`/`isOpen` names match across definition and use.

**Note on real-browser tests:** unit tests (Tasks 2–7) use injected fake runners and never launch Chromium, so `npm test` is fast and CI-safe; live-browser checks are isolated to Task 8 (manual).

---
<!-- nyx-kb:start -->

## 🔗 Related
- 🗺️ Domain: [[_Knowledge/🤖 AI Tooling (Nyx)|🤖 AI Tooling (Nyx)]]
- 🏠 Project hub: [[cb/README|cb]]
- 🔗 Related: [[cb/docs/superpowers/specs/2026-06-12-cb-browser-control-design|cb — Chromium control for Claude Code]] · [[Claude-Control/docs/superpowers/plans/2026-06-01-rdp-client-plane|RDP-Client Plane Implementation Plan]]

<!-- nyx-kb:end -->
