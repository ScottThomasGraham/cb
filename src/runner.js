import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function resolveCliPath() {
  // playwright-core's exports map blocks deep subpaths, so resolve the package
  // root via its (exported) package.json and join the known CLI entry path.
  const pkgRoot = dirname(require.resolve('playwright-core/package.json'));
  return join(pkgRoot, 'lib', 'tools', 'cli-client', 'cli.js');
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
