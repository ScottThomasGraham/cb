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
