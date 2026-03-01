#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = process.env.PORT || 4800;

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

function start() {
  let entryPoint;
  let dashboardDir;

  if (isBundled) {
    // npm-installed mode: use pre-bundled files
    entryPoint = bundledCollector;
    dashboardDir = bundledDashboard;
  } else {
    // Dev mode: build from source if needed
    if (!isDevBuilt()) build();
    entryPoint = resolve(ROOT, 'apps/collector/dist/index.js');
    dashboardDir = resolve(ROOT, 'apps/dashboard/dist');
  }

  console.log(`[synapse] Starting on http://localhost:${PORT}`);

  const collector = spawn('node', [entryPoint], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(PORT),
      SYNAPSE_DASHBOARD_DIR: dashboardDir,
    },
  });

  collector.on('close', (code) => {
    process.exit(code ?? 0);
  });

  // Open browser after a short delay
  setTimeout(() => {
    const url = `http://localhost:${PORT}`;
    try {
      const platform = process.platform;
      if (platform === 'darwin') execSync(`open ${url}`);
      else if (platform === 'linux') execSync(`xdg-open ${url}`);
      else if (platform === 'win32') execSync(`start ${url}`);
    } catch {
      // Silently ignore if browser can't be opened
    }
  }, 1500);

  process.on('SIGINT', () => {
    collector.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    collector.kill('SIGTERM');
    process.exit(0);
  });
}

start();
