import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const workspace = mkdtempSync(join(tmpdir(), 'relay-consumer-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  const output = execFileSync(npm, ['pack', '--workspace', '@relay-state/store', '--json', '--pack-destination', workspace],
    { cwd: root, encoding: 'utf8' });
  const [result] = JSON.parse(output);
  const archive = join(workspace, result.filename);
  execFileSync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', archive],
    { cwd: workspace, stdio: 'inherit' });
  cpSync(join(root, 'tests/consumer/preferences.mjs'), join(workspace, 'preferences.mjs'));
  execFileSync(process.execPath, ['preferences.mjs'], { cwd: workspace, stdio: 'inherit' });
  console.log('Independent packed-package consumer: PASS');
} finally { rmSync(workspace, { recursive: true, force: true }); }
