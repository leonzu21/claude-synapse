#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = process.env.PORT || 4800;
const PID_FILE = resolve(tmpdir(), `claude-synapse-${PORT}.pid`);

// Detect whether we're running from the npm-published bundle or from source
const bundledCollector = resolve(ROOT, 'dist', 'collector.mjs');
const bundledDashboard = resolve(ROOT, 'dist', 'dashboard');
const isBundled = existsSync(bundledCollector);

const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') {
  const initPath = resolve(ROOT, 'bin', 'init.mjs');
  const { default: init } = await import(initPath);
  await init();
  process.exit(0);
}

if (command === 'stop') {
  stop();
  process.exit(0);
}

if (command === 'status') {
  status();
  process.exit(0);
}

function isDevBuilt() {
  return (
    existsSync(resolve(ROOT, 'packages/protocol/dist/index.js')) &&
    existsSync(resolve(ROOT, 'apps/collector/dist/index.js')) &&
    existsSync(resolve(ROOT, 'apps/dashboard/dist/index.html'))
  );
}

function build() {
  console.log('[synapse] Building...');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  console.log('[synapse] Build complete.');
}

function getEntryAndDashboard() {
  if (isBundled) {
    return { entryPoint: bundledCollector, dashboardDir: bundledDashboard };
  }
  if (!isDevBuilt()) build();
  return {
    entryPoint: resolve(ROOT, 'apps/collector/dist/index.js'),
    dashboardDir: resolve(ROOT, 'apps/dashboard/dist'),
  };
}

function isRunning() {
  if (!existsSync(PID_FILE)) return false;
  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  try {
    process.kill(pid, 0); // signal 0 = check if alive
    return pid;
  } catch {
    // Stale pid file
    unlinkSync(PID_FILE);
    return false;
  }
}

function stop() {
  const pid = isRunning();
  if (!pid) {
    console.log(`[synapse] Not running on port ${PORT}.`);
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    unlinkSync(PID_FILE);
    console.log(`[synapse] Stopped (pid ${pid}).`);
  } catch (err) {
    console.error(`[synapse] Failed to stop pid ${pid}:`, err.message);
  }
}

function status() {
  const pid = isRunning();
  if (pid) {
    console.log(`[synapse] Running on http://localhost:${PORT} (pid ${pid})`);
  } else {
    console.log(`[synapse] Not running.`);
  }
}

function start() {
  const runningPid = isRunning();
  if (runningPid) {
    console.log(`[synapse] Already running on http://localhost:${PORT} (pid ${runningPid})`);
    process.exit(0);
  }

  const { entryPoint, dashboardDir } = getEntryAndDashboard();
  const isDaemon = args.includes('--daemon') || args.includes('-d');

  const collector = spawn('node', [entryPoint], {
    cwd: ROOT,
    stdio: isDaemon ? 'ignore' : 'inherit',
    detached: isDaemon,
    env: {
      ...process.env,
      PORT: String(PORT),
      SYNAPSE_DASHBOARD_DIR: dashboardDir,
    },
  });

  if (isDaemon) {
    // Write PID file and detach
    writeFileSync(PID_FILE, String(collector.pid));
    collector.unref();
    console.log(`[synapse] Started in background on http://localhost:${PORT} (pid ${collector.pid})`);
    console.log(`[synapse] Stop with: npx claude-synapse stop`);

    // Open browser
    setTimeout(() => {
      const url = `http://localhost:${PORT}`;
      try {
        if (process.platform === 'darwin') execSync(`open ${url}`);
        else if (process.platform === 'linux') execSync(`xdg-open ${url}`);
        else if (process.platform === 'win32') execSync(`start ${url}`);
      } catch {}
      process.exit(0);
    }, 1500);
  } else {
    // Foreground mode
    console.log(`[synapse] Starting on http://localhost:${PORT}`);
    writeFileSync(PID_FILE, String(collector.pid));

    collector.on('close', (code) => {
      try { unlinkSync(PID_FILE); } catch {}
      process.exit(code ?? 0);
    });

    setTimeout(() => {
      const url = `http://localhost:${PORT}`;
      try {
        if (process.platform === 'darwin') execSync(`open ${url}`);
        else if (process.platform === 'linux') execSync(`xdg-open ${url}`);
        else if (process.platform === 'win32') execSync(`start ${url}`);
      } catch {}
    }, 1500);

    process.on('SIGINT', () => {
      collector.kill('SIGINT');
      try { unlinkSync(PID_FILE); } catch {}
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      collector.kill('SIGTERM');
      try { unlinkSync(PID_FILE); } catch {}
      process.exit(0);
    });
  }
}

start();
