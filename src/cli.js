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
