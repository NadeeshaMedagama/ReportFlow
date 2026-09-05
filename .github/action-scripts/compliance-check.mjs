/**
 * Implementation of the ReportFlow Marketplace action (see action.yml).
 *
 * Signs in to a ReportFlow API as a manager, reads the dashboard summary and
 * per-member submission status for one week, writes the result to the job
 * summary and exposes it as step outputs. Uses only Node built-ins so the
 * action needs no dependency install.
 */
import { appendFileSync } from 'node:fs';

const API_URL = (process.env.INPUT_API_URL ?? '').trim().replace(/\/+$/, '');
const EMAIL = (process.env.INPUT_EMAIL ?? '').trim();
const PASSWORD = process.env.INPUT_PASSWORD ?? '';
const WEEK_START = (process.env.INPUT_WEEK_START ?? '').trim();
const MINIMUM_COMPLIANCE = Number(process.env.INPUT_MINIMUM_COMPLIANCE ?? '0');
const FAIL_ON_MISSING = (process.env.INPUT_FAIL_ON_MISSING ?? 'false') === 'true';
const WRITE_SUMMARY = (process.env.INPUT_SUMMARY ?? 'true') === 'true';

const fail = (message) => {
  console.log(`::error::${message}`);
  process.exit(1);
};
const warn = (message) => console.log(`::warning::${message}`);

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  const line = `${name}=${String(value).replace(/\r?\n/g, ' ')}\n`;
  if (file) appendFileSync(file, line);
  else console.log(`output ${line.trim()}`);
}

function writeSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
  else console.log(markdown);
}

async function callApi(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    fail(`Could not reach the ReportFlow API at ${API_URL}${path}: ${error.message}`);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message ?? response.statusText;
    if (response.status === 401) fail(`Sign-in rejected (401): ${detail}. Check the email and password inputs.`);
    if (response.status === 403) fail('That account is not a manager or admin, so it cannot read the dashboard.');
    fail(`API request to ${path} failed (${response.status}): ${Array.isArray(detail) ? detail.join('; ') : detail}`);
  }
  return payload;
}

// --------------------------------------------------------------------------

if (!API_URL) fail('The "api-url" input is required.');
if (!EMAIL || !PASSWORD) fail('The "email" and "password" inputs are required.');
if (WEEK_START && !/^\d{4}-\d{2}-\d{2}$/.test(WEEK_START)) {
  fail(`"week-start" must be a date in YYYY-MM-DD format, received "${WEEK_START}".`);
}

console.log(`Checking ReportFlow at ${API_URL}`);

const session = await callApi('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
const token = session.accessToken;
console.log(`Signed in as ${session.user.name} (${session.user.role}).`);

const query = WEEK_START ? `?weekStart=${WEEK_START}` : '';
const [summary, status] = await Promise.all([
  callApi(`/dashboard/summary${query}`, { token }),
  callApi(`/dashboard/submission-status${query}`, { token }),
]);

const missing = status.rows.filter((row) => row.status === 'NOT_STARTED' || row.status === 'DRAFT');
const missingNames = missing.map((row) => row.user.name);

setOutput('compliance-rate', summary.complianceRate);
setOutput('submitted', summary.submitted);
setOutput('pending', summary.pending);
setOutput('awaiting-review', summary.awaitingReview);
setOutput('needs-correction', summary.needsCorrection);
setOutput('open-blockers', summary.openBlockers);
setOutput('missing-members', missingNames.join(', '));
setOutput('week-label', summary.week.label);

console.log(
  `Week of ${summary.week.label}: ${summary.submitted}/${summary.totalMembers} submitted ` +
    `(${summary.complianceRate}%), ${summary.awaitingReview} awaiting review, ` +
    `${summary.needsCorrection} needing correction.`,
);

if (WRITE_SUMMARY) {
  const statusIcon = { APPROVED: '✅', SUBMITTED: '🔵', NEEDS_CORRECTION: '🟠', DRAFT: '⚪', NOT_STARTED: '🔴' };
  const rows = status.rows
    .map((row) => {
      const label = row.status.toLowerCase().replace('_', ' ');
      const timing = row.timing.toLowerCase().replace('_', ' ');
      return `| ${row.user.name} | ${statusIcon[row.status] ?? ''} ${label} | ${timing} | ${row.report?.project?.name ?? '-'} |`;
    })
    .join('\n');

  writeSummary(
    [
      `## Weekly report compliance - ${summary.week.label}`,
      '',
      `**${summary.submitted} of ${summary.totalMembers}** team members submitted (**${summary.complianceRate}%** compliance).`,
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      `| Submitted on time | ${summary.onTime} |`,
      `| Submitted late | ${summary.late} |`,
      `| Not submitted | ${summary.pending} |`,
      `| Awaiting review | ${summary.awaitingReview} |`,
      `| Needs correction | ${summary.needsCorrection} |`,
      `| Approved | ${summary.approved} |`,
      `| Open blockers | ${summary.openBlockers} |`,
      '',
      '### Per team member',
      '',
      '| Team member | Status | Timing | Project |',
      '| --- | --- | --- | --- |',
      rows,
    ].join('\n'),
  );
}

let failed = false;

if (MINIMUM_COMPLIANCE > 0 && summary.complianceRate < MINIMUM_COMPLIANCE) {
  console.log(
    `::error::Compliance is ${summary.complianceRate}%, below the required ${MINIMUM_COMPLIANCE}%.`,
  );
  failed = true;
}

if (missingNames.length > 0) {
  const message = `${missingNames.length} member(s) have not submitted for ${summary.week.label}: ${missingNames.join(', ')}.`;
  if (FAIL_ON_MISSING) {
    console.log(`::error::${message}`);
    failed = true;
  } else {
    warn(message);
  }
}

process.exit(failed ? 1 : 0);
