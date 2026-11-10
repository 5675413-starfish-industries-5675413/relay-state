/** Measure the real sandboxed preload -> synchronous main IPC round trip.
 * This deliberately launches the built app without RELAY_E2E test hooks.
 * A benchmark is not a guarantee of maximum request latency.
 */
import { _electron as electron } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'apps/relay-tasks');
const env = { ...process.env };
delete env.ELECTRON_RENDERER_URL;
delete env.RELAY_E2E;
delete env.RELAY_E2E_GATE_FILE;

const electronApp = await electron.launch({ args: ['.'], cwd: appRoot, env });

try {
  // The app opens two windows; locate Workspace by URL rather than show order.
  await electronApp.firstWindow();
  let workspace;
  const deadline = Date.now() + 15_000;
  while (!workspace && Date.now() < deadline) {
    workspace = electronApp.windows().find((page) => page.url().endsWith('#workspace'));
    if (!workspace) await new Promise((done) => setTimeout(done, 50));
  }
  if (!workspace) throw new Error('Built app did not open the Workspace window');
  await workspace.waitForFunction(
    () => location.hash === '#workspace' && typeof window.relayState?.readSync === 'function',
    null,
    { timeout: 15_000 },
  );

  const versions = await electronApp.evaluate(() => ({
    electron: process.versions.electron,
    node: process.versions.node,
    chromium: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
  }));

  const observations = await workspace.evaluate(() => {
    const bridge = window.relayState;
    const check = (result, label) => {
      if (!result || !result.ok) {
        throw new Error(`${label}: ${result?.error?.code ?? 'unknown'} ${result?.error?.message ?? ''}`);
      }
      return result.value;
    };
    const size = () => check(bridge.readSync(), 'read').state.tasks.length;
    let currentRevision = check(bridge.readSync(), 'initial revision').revision;
    const create = (label) => {
      const committed = check(bridge.dispatchSync({
        type: 'task/add',
        task: {
          id: crypto.randomUUID(),
          title: `Benchmark ${label}`,
          completed: false,
          createdAt: Date.now(),
        },
      }), 'commit');
      if (committed.revision !== currentRevision + 1) throw new Error('Commit revision was not incremented by one');
      currentRevision = committed.revision;
      return committed;
    };
    const noop = () => {
      const result = check(bridge.dispatchSync({ type: 'task/delete', id: 'benchmark-nonexistent-id' }), 'no-op');
      if (result.revision !== currentRevision) throw new Error('No-op unexpectedly incremented revision');
    };
    const measure = (count, operation) => {
      const samples = [];
      for (let i = 0; i < count; i++) {
        const began = performance.now();
        operation(i);
        samples.push(performance.now() - began);
      }
      return samples;
    };
    // Exclude initial setup and JIT warmup from the recorded series.
    for (let i = 0; i < 10; i++) check(bridge.readSync(), 'warmup');
    for (let i = 0; i < 3; i++) noop();

    const rows = [];
    for (const target of [0, 20, 80]) {
      while (size() < target) create(`seed ${size() + 1}`);
      const initialTasks = size();
      rows.push({ tasks: initialTasks, operation: 'readSync', samplesMs: measure(80, () => check(bridge.readSync(), 'read')) });
      rows.push({ tasks: initialTasks, operation: 'dispatchSync (no-op)', samplesMs: measure(30, noop) });
      rows.push({ tasks: initialTasks, operation: 'dispatchSync (commit)', samplesMs: measure(12, (i) => create(`${target}-${i}`)) });
    }
    return { rows, finalTasks: size(), finalRevision: check(bridge.readSync(), 'final').revision };
  });

  const summarize = ({ tasks, operation, samplesMs }) => {
    const sorted = [...samplesMs].sort((a, b) => a - b);
    const at = (percentile) => sorted[Math.ceil((percentile / 100) * sorted.length) - 1];
    const round = (value) => Number(value.toFixed(3));
    return {
      tasks, operation, n: sorted.length,
      p50Ms: round(at(50)), p95Ms: round(at(95)),
      maxMs: round(sorted[sorted.length - 1]),
      meanMs: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    };
  };

  const report = {
    collectedAt: new Date().toISOString(),
    measurements: 'Renderer performance.now() around actual preload bridge synchronous calls (not Playwright RPC)',
    versions,
    results: observations.rows.map(summarize),
    finalTasks: observations.finalTasks,
    finalRevision: observations.finalRevision,
    caveat: 'One machine and a small workload. SendSync blocks the renderer; no worst-case time guarantee.',
  };
  const output = join(root, '.verification', 'ipc-benchmark.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Electron ${versions.electron} · ${versions.platform}/${versions.arch}`);
  console.table(report.results);
  console.log(`Machine-local evidence saved: ${output}`);
} finally {
  await electronApp.close();
}
