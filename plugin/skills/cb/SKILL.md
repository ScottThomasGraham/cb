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
- Full upstream surface (cookies, localstorage, route, pdf, tracing, …) passes through `cb`
  unchanged. Reference: `node_modules/playwright-core/lib/tools/cli-client/skill/SKILL.md`
  inside the cb repo (`~/Projects/cb`).

---
<!-- nyx-kb:start -->

## 🔗 Related
- 🗺️ Domain: [[_Knowledge/🤖 AI Tooling (Nyx)|🤖 AI Tooling (Nyx)]]
- 🏠 Project hub: [[cb/README|cb]]
- 🔗 Related: [[neo-bridge/skills/browser-tasks|Nyx Browser Tasks 🌐]]

<!-- nyx-kb:end -->
