import { isOpen } from './session.js';
import { SESSION, openArgs } from './config.js';

export function ensureOpen(run) {
  if (isOpen(run, SESSION)) return;
  const res = run(openArgs(), { capture: true });
  if (res.status !== 0) {
    throw new Error(`cb: failed to open browser session\n${res.stderr || res.stdout}`);
  }
}
