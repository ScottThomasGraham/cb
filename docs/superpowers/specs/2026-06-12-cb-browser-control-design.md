# cb — Chromium control for Claude Code

**Date:** 2026-06-12
**Status:** Approved design, ready for implementation planning
**Replaces:** Claude-Browser-V3 (Electron app, to be fully deleted)

## Purpose

Give Claude Code direct, fast, reliable control of a real Chromium browser, driven
entirely from the command line. The user asks for web work in an ordinary chat;
Claude runs `cb` commands and gets to work immediately. There is nothing to start
manually — no app to open, no server to prime, no MCP that must already be running.

This is a clean-break rewrite of Claude-Browser-V3. V3's split-pane Electron app (a
Chromium `<webview>` beside a `claude` PTY terminal, fronted by a hand-rolled
CDP RPC server) is deleted. The embedded terminal ("CLI sidebar") is gone: Claude
Code runs in the user's own terminal and drives a full, standalone Chromium window.

## Goals

- **Zero setup.** The first `cb` command in a session silently launches the browser
  if it isn't already running. Every later command attaches to the warm browser in
  milliseconds.
- **Full, real Chromium.** Tabs, address bar, behaves like Chrome. The user can
  watch and take over with the mouse at any time.
- **Reliable.** Act on elements by stable accessibility reference, not by guessing
  X/Y coordinates. Auto-wait for elements instead of sleeping. Clear success/failure
  on every action.
- **Capable.** Navigation, multi-tab, form entry, scraping/data extraction,
  downloads, uploads, network capture, arbitrary JS evaluation. Strong enough to
  operate web apps like Slack.
- **Persistent.** A dedicated browser profile keeps logins across commands and
  across chats. Log into Slack/Google/etc. once.

## Non-goals

- No embedded terminal, no React UI, no Electron.
- No login/cookie migration from V3 (user logs in fresh, once).
- No auto-solving of CAPTCHAs (hand off to the user, then continue).
- Not an MCP server. A CLI talking to a local warm browser is the interface.

## Architecture

```
You (chat) ──▶ Claude Code ──▶ `cb <command>`  (thin, self-bootstrapping CLI)
                                     │
                       attaches over a local Unix socket;
                       auto-launches the browser if not running
                                     ▼
                    Warm headed Chromium (Playwright)
                    · dedicated persistent profile (~/.cb/profile)
                    · tabs + address bar — looks/works like Chrome
                    · user can grab the mouse and take over anytime
```

Three components:

1. **Control core** — a small Node + TypeScript library wrapping Playwright against a
   persistent, headed Chromium context. Owns the browser lifecycle, the snapshot
   (accessibility-ref) model, and all action primitives. Engine: **Playwright**
   (chosen for auto-waiting, ref-based targeting, downloads/uploads, multi-tab, and
   network interception out of the box).

2. **`cb` — the CLI** — thin client. Each invocation connects to the warm browser
   over a Unix domain socket and runs one command. If no warm browser is found, it
   launches one (detached), waits for ready, then runs the command. Prints compact
   human/LLM-readable text by default; `--json` for structured output.

3. **Claude Code skill** — replaces the old `claude-browser-local` plugin. Documents
   the `cb` command surface so Claude automatically reaches for it on any web task.
   This is the "it just works" glue. A `claude-browser` alias on PATH is retained for
   backwards compatibility with existing muscle memory and the memory note.

### Warm-browser holder

A long-lived host process owns the Playwright persistent context and listens on the
Unix socket; the `cb` CLI is a short-lived client that connects per command. Keeping
Playwright objects warm in one process (rather than reconnecting over CDP per command)
preserves cross-command capabilities like continuous network logging and live tab
state. The holder is invisible to the user: auto-spawned by the first `cb` command,
self-managed thereafter. (Implementation detail — exact host/socket mechanics are
settled during planning; the contract is "first command launches it, later commands
attach fast.")

## How Claude perceives and acts on a page

Claude acts on elements **by stable reference**, not coordinates.

- `cb snapshot` returns a compact accessibility outline; every interactive element
  gets a short ref id (e.g. `e7`). Example:

  ```
  - [e3] textbox "Search"
  - [e7] button "Send"
  - [e9] link "Jump to..."
  ```

- Claude then acts on refs: `cb type e3 "deploy is green"`, `cb click e7`.
- Playwright auto-waits for each element to be actionable, so most timing bugs vanish.
- Coordinate actions remain available as a fallback for canvas/maps where no refs
  exist.

### Command surface

| Group | Commands |
|---|---|
| **Navigate** | `goto <url>`, `back`, `forward`, `reload` |
| **Tabs** | `tabs`, `tab new [url]`, `tab <n>`, `tab close [n]` |
| **Perceive** | `snapshot` (ref outline), `read` (page as clean text/markdown), `screenshot [path]` |
| **Act by ref** | `click <ref>`, `type <ref> <text>`, `fill <ref> <text>`, `select <ref> <value>`, `check <ref>`, `hover <ref>`, `upload <ref> <file>` |
| **Keys & scroll** | `press <keys>` (e.g. `Enter`, `Cmd+A`), `scroll <up\|down\|to ref>` |
| **Coordinate fallback** | `click-at <x> <y>`, `move <x> <y>` |
| **Data** | `extract <instruction\|selector>`, `eval <js>`, `requests` (recent network), `download <ref>` |
| **Wait** | `wait <text\|ref\|url\|idle>` |
| **State / lifecycle** | `url`, `title`, `status`, `quit`, `restart` |

### Output

- Default: compact text, easy to read and easy for Claude to parse.
- `--json` flag: structured output for reliable scraping/automation.
- `screenshot` writes a PNG to a path Claude then reads; screenshots are a
  "show me what it looks like" tool, not Claude's primary sense (snapshot/read are).

## Bootstrap, lifecycle & reliability

**Self-bootstrapping.** Every `cb` command checks for the warm browser over the Unix
socket. Present → attach in ms. Absent → launch headed Chromium detached, wait for
ready, run the command. The first web action in a chat spins up the browser (~1–2s,
once); everything after is instant.

**Lifecycle.**
- Browser stays open across commands and across chats. Tabs and logins persist via a
  dedicated profile dir (`~/.cb/profile`).
- `cb status` reports up/down; `cb quit` closes it; `cb restart` recycles a wedged
  browser.
- A single instance, guarded by a lock file so concurrent commands can't race-launch
  two browsers.
- If the warm browser becomes unresponsive, `cb` detects the dead socket, cleans up,
  and relaunches — self-healing rather than erroring.

**Reliability defaults.**
- Auto-wait on every action (configurable timeout, ~10s default).
- Every action returns an explicit success/failure line — never a silent no-op.
- A failed `click`/`type` re-snapshots and reports what is actually on the page, so
  Claude recovers in one step.
- `type`/`fill` always send strings via Playwright's real keyboard — fixes V3's
  all-digit-coercion bug (phone numbers, ZIPs, OTP codes).

**Visible & cooperative.**
- The window is on-screen with a real address bar and tabs. The user can watch and
  take over the mouse at any time (log in, solve a CAPTCHA, redirect the task).
- CAPTCHAs are never auto-solved; Claude hands off to the user, then continues.
- Passwords/2FA are typed straight into fields, never written to files.

## Location & migration

- New repo: **`~/Projects/cb`**.
- **Claude-Browser-V3 is fully deleted** — repo, `/Applications/Claude-Browser-V3.app`
  bundle, the broken/stale symlinks, and the `claude-browser-local` plugin
  registration. No login or cookie migration.
- New **`cb` skill** installed; **`claude-browser`** kept as a PATH alias to `cb`.
- The `claude-browser-tooling` memory note is rewritten to describe `cb` once built.

## Risks & open questions (resolved during planning)

- **node-pty / native deps:** none required anymore (no terminal). Playwright is the
  main native dependency; it bundles its own Chromium.
- **Headed Chromium UI:** Playwright's bundled headed Chromium shows a normal browser
  window with address bar and tabs (plus an automation info-bar). Acceptable; matches
  "works like Chrome."
- **Socket vs port:** Unix domain socket preferred (no port conflicts, local-only).
- **Single-instance guard:** lock file + socket liveness check.

## Success criteria

- From a cold machine, `cb goto example.com` launches the browser and loads the page
  with no prior setup step.
- `cb snapshot` → `cb click <ref>` reliably operates a live web app (validated against
  Slack: open a channel, type and send a message).
- Logins persist across separate chats without re-authentication.
- A second concurrent `cb` command never launches a second browser.
- The all-digit input bug from V3 does not reproduce (`cb fill <ref> 9144825865`
  succeeds).
