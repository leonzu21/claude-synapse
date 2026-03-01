#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export default async function init() {
  const hooksSource = resolve(ROOT, 'hooks', 'claude-hooks.json');
  const targetDir = resolve(process.cwd(), '.claude');
  const targetFile = resolve(targetDir, 'settings.json');

  const hooksConfig = JSON.parse(readFileSync(hooksSource, 'utf-8'));

  if (existsSync(targetFile)) {
    // Merge hooks into existing settings
    const existing = JSON.parse(readFileSync(targetFile, 'utf-8'));
    if (!existing.hooks) existing.hooks = {};

    for (const [event, matchers] of Object.entries(hooksConfig.hooks)) {
      if (!existing.hooks[event]) {
        existing.hooks[event] = matchers;
      } else {
        // Append to existing matchers
        existing.hooks[event].push(...matchers);
      }
    }

    writeFileSync(targetFile, JSON.stringify(existing, null, 2) + '\n');
    console.log(`[synapse] Merged hooks into ${targetFile}`);
  } else {
    // Create new settings file
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(targetFile, JSON.stringify(hooksConfig, null, 2) + '\n');
    console.log(`[synapse] Created ${targetFile} with hooks config`);
  }

  console.log('[synapse] Hooks configured! Start synapse in another terminal:');
  console.log('  npx synapse');
  console.log('');
  console.log('Then use Claude Code normally — events will appear in the dashboard.');
}
