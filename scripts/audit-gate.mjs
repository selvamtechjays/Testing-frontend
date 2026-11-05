// Baseline-aware dependency audit gate (QA harness, BL-08).
// Fails only on NEW high/critical advisories that are not in qa/audit-baseline.json.
// Inherited findings are baselined, not fixed here (fix via /dev:build --vulnerable).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LEVELS = new Set(['high', 'critical']);

function runAudit() {
  try {
    return execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities exist; the JSON is still on stdout.
    if (err.stdout) return err.stdout.toString();
    throw err;
  }
}

const audit = JSON.parse(runAudit());
if (audit.error) {
  console.error('npm audit failed:', audit.error.summary ?? audit.error);
  process.exit(2);
}

const found = new Set();
for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === 'object' && LEVELS.has(via.severity)) found.add(via.url);
  }
}

const baseline = new Set(
  JSON.parse(readFileSync('qa/audit-baseline.json', 'utf8')).advisories.map((a) => a.url),
);
const fresh = [...found].filter((url) => !baseline.has(url));

console.log(
  `high/critical advisories: ${found.size} total, ${baseline.size} baselined, ${fresh.length} new`,
);
if (fresh.length > 0) {
  console.error('NEW high/critical advisories (not in baseline):');
  for (const url of fresh) console.error(`  ${url}`);
  process.exit(1);
}
