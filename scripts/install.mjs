#!/usr/bin/env node
// Install cb: symlink the CLI onto PATH and register the Claude Code plugin.
// Idempotent — safe to re-run.
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mkdirSync, rmSync, symlinkSync, existsSync, lstatSync, readFileSync, writeFileSync,
} from 'node:fs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();

function isLink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}
function link(target, linkPath) {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (existsSync(linkPath) || isLink(linkPath)) rmSync(linkPath, { recursive: true, force: true });
  symlinkSync(target, linkPath);
  console.log(`linked ${linkPath} -> ${target}`);
}

// 1) CLI on PATH (+ back-compat alias).
const bin = join(repo, 'bin', 'cb.mjs');
link(bin, join(home, '.local', 'bin', 'cb'));
link(bin, join(home, '.local', 'bin', 'claude-browser'));

// 2) Plugin into the Claude Code plugin cache (symlink the versioned dir to the repo plugin).
const cacheDir = join(home, '.claude', 'plugins', 'cache', 'cb-local', '1.0.0');
link(join(repo, 'plugin'), cacheDir);

// 3) Register (enable) the plugin in installed_plugins.json.
const registryPath = join(home, '.claude', 'plugins', 'installed_plugins.json');
let registry = {};
if (existsSync(registryPath)) {
  try { registry = JSON.parse(readFileSync(registryPath, 'utf8')); } catch { registry = {}; }
}
registry['cb-local'] = {
  version: '1.0.0',
  enabled: true,
  source: { source: 'local', path: cacheDir },
  installedAt: registry['cb-local']?.installedAt ?? new Date().toISOString(),
};
mkdirSync(dirname(registryPath), { recursive: true });
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`registered cb-local in ${registryPath}`);

console.log('\nDone. Ensure ~/.local/bin is on PATH. Try: cb status');
console.log('(Restart Claude Code to load the cb skill.)');
