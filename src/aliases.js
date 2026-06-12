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
