import { parseCorsOrigin } from './app.setup';

/** Asserts how the `cors` package would treat `origin` given a CORS_ORIGIN value. */
function allows(corsOrigin: string | undefined, origin: string): boolean {
  const parsed = parseCorsOrigin(corsOrigin);
  if (typeof parsed === 'boolean') return parsed;
  return parsed.some((entry) => (entry instanceof RegExp ? entry.test(origin) : entry === origin));
}

describe('parseCorsOrigin', () => {
  it('defaults to the local web app when CORS_ORIGIN is unset', () => {
    expect(parseCorsOrigin(undefined)).toEqual(['http://localhost:3000']);
  });

  it('accepts a comma separated list, ignoring surrounding whitespace', () => {
    expect(parseCorsOrigin('https://a.example , https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('matches exact origins only', () => {
    expect(allows('https://reportflow.app', 'https://reportflow.app')).toBe(true);
    expect(allows('https://reportflow.app', 'https://other.app')).toBe(false);
  });

  it('reflects any origin when the list contains *', () => {
    expect(parseCorsOrigin('*')).toBe(true);
  });

  it('matches Vercel preview hostnames through a wildcard label', () => {
    const previews = 'https://*.vercel.app';
    expect(allows(previews, 'https://reportflow-web.vercel.app')).toBe(true);
    expect(allows(previews, 'https://reportflow-git-develop-nm.vercel.app')).toBe(true);
  });

  it('does not let a wildcard label span dots, schemes or suffixes', () => {
    const previews = 'https://*.vercel.app';
    expect(allows(previews, 'https://reportflow.vercel.app.attacker.com')).toBe(false);
    expect(allows(previews, 'https://a.b.vercel.app')).toBe(false);
    expect(allows(previews, 'http://reportflow.vercel.app')).toBe(false);
  });

  it('treats dots literally rather than as regex wildcards', () => {
    expect(allows('https://*.vercel.app', 'https://reportflowXvercel.app')).toBe(false);
  });
});
