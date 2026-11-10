import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
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
  // A real external ESM package boundary is required for NodeNext .tsx typechecking.
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  // Install outside workspace resolution. Test actual exports, React behavior, and .d.ts consumers.
  execFileSync(npm, [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', archive,
    'react@19.2.7', 'react-dom@19.2.7', '@types/react@19.2.16',
    'typescript@6.0.3', 'jsdom@27.0.0',
  ], { cwd: workspace, stdio: 'inherit' });
  for (const file of ['preferences.mjs', 'external-react.mjs', 'external-types.tsx', 'tsconfig.json']) {
    cpSync(join(root, 'tests/consumer', file), join(workspace, file));
  }
  execFileSync(process.execPath, ['preferences.mjs'], { cwd: workspace, stdio: 'inherit' });
  execFileSync(process.execPath, ['external-react.mjs'], { cwd: workspace, stdio: 'inherit' });
  execFileSync(process.execPath, [join(workspace, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json'],
    { cwd: workspace, stdio: 'inherit' });
  console.log('Independent packed-package runtime, React and TypeScript consumers: PASS');
} finally { rmSync(workspace, { recursive: true, force: true }); }
