#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = process.env.PORT || 4800;

const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') {
  // Run the init/setup flow
  const initPath = resolve(ROOT, 'bin', 'init.mjs');
  const { default: init } = await import(initPath);
  await init();
  process.exit(0);
}

function isBuilt() {
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
  if (!isBuilt()) {
    build();
  }

  console.log(`[synapse] Starting on http://localhost:${PORT}`);

  const collector = spawn('node', [resolve(ROOT, 'apps/collector/dist/index.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
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
