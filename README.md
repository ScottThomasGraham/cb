# cb — instant Chromium control for Claude Code

`cb` gives Claude Code direct control of a real, headed Chromium with zero setup: ask in
chat, the first `cb` command launches the browser, and Claude drives it by accessibility
refs. It is a thin self-bootstrapping wrapper over Playwright 1.60's bundled `playwright-cli`.

It replaces Claude-Browser-V3 — no Electron, no embedded terminal, no MCP that must be
running first.

## Install
```bash
npm install
npx playwright install chromium
node scripts/install.mjs   # symlinks ~/.local/bin/cb (+ claude-browser alias), registers the plugin
cb status
```

## Use
```bash
cb goto https://example.com
cb snapshot            # see element refs (e3, e7, …)
cb click e7
cb fill e3 "hello"
cb quit
```

## How it works
- One warm, headed, bundled-Chromium session named `cb`, with a dedicated profile at
  `~/.cb/profile` (log in to Slack/Google/etc. once — it persists).
- `cb` auto-opens the session on the first command — the only thing it adds over
  `playwright-cli`. Everything after attaches in milliseconds.
- A few friendly verb aliases (`back`, `forward`, `tabs`, `read`); every other verb passes
  through to `playwright-cli` unchanged, so the full upstream surface is available.

## Architecture
| Piece | Responsibility |
|---|---|
| `src/config.js` | session name, profile path, open args |
| `src/runner.js` | resolve + spawn the bundled `playwright-cli` |
| `src/session.js` | parse `list`, `isOpen()` |
| `src/bootstrap.js` | `ensureOpen()` — auto-launch the session |
| `src/aliases.js` | friendly verbs → upstream verbs |
| `src/cli.js` | orchestrate bootstrap + forward; `status`/`quit`/`restart` |
| `bin/cb.mjs` | executable entry point |
| `plugin/` | Claude Code skill + command |

Design + plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Tests
```bash
npm test
```
Unit tests use injected fake runners and never launch a browser. Live-browser behavior
(cold-start bootstrap, warm reuse, ref actions, the all-digit-input fix, lifecycle) was
verified manually during the build.
