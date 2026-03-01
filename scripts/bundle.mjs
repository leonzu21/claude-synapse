#!/usr/bin/env node
/**
 * Bundle Synapse for npm distribution.
 *
 * Produces:
 *   dist/collector.mjs   — collector + protocol bundled (standalone)
 *   dist/dashboard/      — pre-built static files
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 1. Build everything with turbo
console.log('[bundle] Building packages...');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

// 2. Clean dist/
const dist = resolve(ROOT, 'dist');
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

// 3. Bundle collector + protocol into a single ESM file using esbuild
console.log('[bundle] Bundling collector...');
execSync(
  [
    'npx esbuild',
    'apps/collector/dist/index.js',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node18',
    '--outfile=dist/collector.mjs',
    '--external:fastify',
    '--external:@fastify/cors',
    '--external:@fastify/static',
    '--external:socket.io',
    '--banner:js="import { createRequire } from \'module\'; const require = createRequire(import.meta.url);"',
  ].join(' '),
  { cwd: ROOT, stdio: 'inherit' },
);

// 4. Copy dashboard dist
console.log('[bundle] Copying dashboard...');
cpSync(resolve(ROOT, 'apps/dashboard/dist'), resolve(dist, 'dashboard'), {
  recursive: true,
});

console.log('[bundle] Done! dist/ ready for npm publish.');
