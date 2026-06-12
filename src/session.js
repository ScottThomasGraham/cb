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
