/**
 * Runs `npm audit` and fails only on findings that are not in
 * .github/audit-allowlist.json.
 *
 * Plain `npm audit --audit-level=high` is all-or-nothing: one unfixable
 * transitive advisory turns the gate permanently red, and the usual response
 * is to lower the threshold, which hides the next real problem. This keeps the
 * gate meaningful instead - known findings are accepted explicitly, with a
 * reason and a review date, and anything new still fails the build.
 *
 * Usage: node scripts/audit-check.mjs [--production] [--level=high]
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);

const args = process.argv.slice(2);
const productionOnly = args.includes('--production');
const levelArg = args.find((a) => a.startsWith('--level='));
const MIN_LEVEL = levelArg ? levelArg.split('=')[1] : 'high';
const ORDER = ['info', 'low', 'moderate', 'high', 'critical'];
const atLeastMinLevel = (severity) => ORDER.indexOf(severity) >= ORDER.indexOf(MIN_LEVEL);

const isCI = process.env.GITHUB_ACTIONS === 'true';
const annotate = (level, message) => console.log(isCI ? `::${level}::${message}` : `[${level}] ${message}`);

/**
 * npm audit exits non-zero when it finds anything, and the registry is
 * occasionally flaky. A failed registry call still prints JSON, but with an
 * `error` field and no `metadata` - treating that as "no vulnerabilities"
 * would turn an outage into a silent pass, so it is rejected explicitly.
 */
async function auditJson() {
  const argv = ['audit', '--json', ...(productionOnly ? ['--omit=dev'] : [])];

  for (let attempt = 1; attempt <= 3; attempt++) {
    let raw = null;
    try {
      const { stdout } = await run('npm', argv, { maxBuffer: 32 * 1024 * 1024 });
      raw = stdout;
    } catch (error) {
      // A findings-present exit still carries the full report on stdout.
      raw = error.stdout ?? null;
      if (!raw) {
        if (attempt === 3) {
          annotate('error', `npm audit could not run: ${error.message}`);
          process.exit(1);
        }
        annotate('warning', `npm audit attempt ${attempt} could not run, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
        continue;
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    // A usable report always carries the per-severity counters. An empty or
    // error-shaped report means the registry call did not really succeed.
    const counters = parsed?.metadata?.vulnerabilities;
    const usable = parsed && !parsed.error && counters && ORDER.every((level) => typeof counters[level] === 'number');
    if (usable) return parsed;

    const detail = parsed?.error
      ? `${parsed.error.code ?? 'error'}: ${parsed.error.summary ?? 'registry request failed'}`
      : 'unparseable audit output';
    if (attempt === 3) {
      annotate('error', `npm audit did not return a usable report after 3 attempts (${detail}). Refusing to pass the security gate on an incomplete audit.`);
      process.exit(1);
    }
    annotate('warning', `npm audit attempt ${attempt} returned no usable report (${detail}), retrying...`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
  }
}

const allowlist = JSON.parse(readFileSync(new URL('../.github/audit-allowlist.json', import.meta.url), 'utf8')).allow;
const today = new Date().toISOString().slice(0, 10);

const report = await auditJson();
const found = Object.entries(report.vulnerabilities ?? {});

const blocking = [];
const accepted = [];

for (const [name, vulnerability] of found) {
  if (!atLeastMinLevel(vulnerability.severity)) continue;

  const entry = allowlist.find((item) => item.package === name);
  if (!entry) {
    blocking.push({ name, severity: vulnerability.severity, via: describeVia(vulnerability) });
    continue;
  }
  if (entry.reviewBy && entry.reviewBy < today) {
    blocking.push({
      name,
      severity: vulnerability.severity,
      via: `allowlist entry expired on ${entry.reviewBy} - re-assess it or extend the date`,
    });
    continue;
  }
  accepted.push({ name, severity: vulnerability.severity, entry });
}

// An allowlist entry that no longer matches anything is dead weight.
const reportedNames = new Set(found.map(([name]) => name));
const stale = allowlist.filter((item) => !reportedNames.has(item.package));

console.log(`npm audit (${productionOnly ? 'production' : 'all'} dependencies), failing at "${MIN_LEVEL}" and above\n`);

if (accepted.length) {
  console.log(`Accepted findings (${accepted.length}):`);
  for (const item of accepted) {
    console.log(`  - ${item.name} [${item.severity}] until ${item.entry.reviewBy}`);
    console.log(`      via:    ${item.entry.introducedBy}`);
    console.log(`      reason: ${item.entry.reason}`);
  }
  console.log();
}

for (const item of stale) {
  annotate('warning', `Allowlist entry for "${item.package}" no longer matches any finding - remove it from .github/audit-allowlist.json.`);
}

if (blocking.length === 0) {
  console.log(`No unreviewed findings at "${MIN_LEVEL}" or above.`);
  process.exit(0);
}

console.log(`Unreviewed findings (${blocking.length}):`);
for (const item of blocking) {
  console.log(`  - ${item.name} [${item.severity}] ${item.via}`);
  annotate('error', `Unreviewed ${item.severity} advisory in "${item.name}". Upgrade it, or add a justified entry to .github/audit-allowlist.json.`);
}
process.exit(1);

function describeVia(vulnerability) {
  const via = vulnerability.via ?? [];
  const titles = via.filter((v) => typeof v === 'object').map((v) => v.title);
  if (titles.length) return titles[0];
  const names = via.filter((v) => typeof v === 'string');
  return names.length ? `via ${names.join(', ')}` : '';
}
