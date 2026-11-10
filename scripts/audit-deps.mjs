/** Read-only npm dependency advisory report for the locked workspace. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.verification');
mkdirSync(outDir, { recursive: true });

function audit(label, additionalArgs) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(executable, ['audit', '--json', ...additionalArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label}: npm audit did not return valid JSON (${result.stderr.trim() || `exit ${result.status}`})`);
  }
  if (!report.vulnerabilities || !report.metadata?.vulnerabilities) {
    throw new Error(`${label}: audit failed before advisory retrieval: ${report.error?.summary || report.error?.message || result.stderr.trim() || 'unknown error'}`);
  }
  const file = join(outDir, `npm-audit-${label}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  const counts = report.metadata.vulnerabilities;
  console.log(`\n${label}: ${counts.total} findings (${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate, ${counts.low} low)`);
  const details = Object.entries(report.vulnerabilities).map(([name, issue]) => {
    const advisories = issue.via.filter((entry) => typeof entry === 'object');
    const remediation = issue.fixAvailable;
    const fix = remediation === false ? 'none listed'
      : remediation === true ? 'compatible update'
        : `${remediation.name}@${remediation.version}${remediation.isSemVerMajor ? ' (major)' : ''}`;
    return {
      package: name,
      severity: issue.severity,
      direct: issue.isDirect,
      range: issue.range,
      fix,
      advisories: advisories.map((a) => a.url || a.title).join(' | ') || issue.via.join(', '),
    };
  });
  console.table(details);
  console.log(`Full dependency paths and advisory metadata: ${file}`);
  // npm audit deliberately exits nonzero when it finds advisories.
  if (result.status !== 0 && result.status !== 1) {
    console.warn(`npm audit process exited ${result.status}; review the raw report.`);
  }
  return { counts, file };
}

try {
  audit('all', []);
  audit('omit-dev', ['--omit=dev']);
  console.log('\nThe omit-dev view is only a dependency classification, not proof of Electron-runtime reachability.');
  console.log('Do not use npm audit fix --force without a package-by-package review.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
