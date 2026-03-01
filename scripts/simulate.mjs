#!/usr/bin/env node
/**
 * Simulate a realistic multi-layer agent session for the dashboard.
 * Pushes events via Socket.IO to the collector on port 4800.
 *
 * Usage: node scripts/simulate.mjs
 */

const COLLECTOR_URL = 'http://localhost:4800';

// Auto-detect current active session (prefer the one with most events, skip sim sessions)
let SESSION;
try {
  const res = await fetch(`${COLLECTOR_URL}/api/sessions`);
  const sessions = await res.json();
  const live = sessions.filter((s) => !s.endedAt && !s.id.startsWith('sim-'));
  const active = live[live.length - 1] || sessions.filter((s) => !s.endedAt).pop();
  SESSION = active?.id || 'sim-' + Date.now().toString(36);
  console.log(`[sim] Injecting into session: ${SESSION} (${active?.eventCount || 0} events)`);
} catch {
  SESSION = 'sim-' + Date.now().toString(36);
  console.log(`[sim] Created new session: ${SESSION}`);
}

// Will be set after session detection — either existing root or a new one
let ROOT = 'root-001';
let eventCounter = 0;

function makeEvent(type, agentId, agentName, agentType, parentId, payload = {}) {
  return {
    id: `evt-${++eventCounter}`,
    type,
    timestamp: Date.now(),
    sessionId: SESSION,
    agentId,
    agentName,
    agentType,
    parentAgentId: parentId,
    payload,
    source: 'sdk',
  };
}

async function send(evt) {
  const res = await fetch(`${COLLECTOR_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(evt),
  });
  if (!res.ok) {
    console.error(`[sim] Failed to send event: ${res.status}`);
  }
  await sleep(80);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // Find the root agent of the current session
  try {
    const evtRes = await fetch(`${COLLECTOR_URL}/api/sessions/${SESSION}/events`);
    const events = await evtRes.json();
    const rootEvt = events.find((e) => e.type === 'agent_spawned' && !e.parentAgentId);
    if (rootEvt) {
      ROOT = rootEvt.agentId;
      console.log(`[sim] Found existing root agent: ${ROOT}`);
    }
  } catch {}

  console.log(`[sim] Session: ${SESSION}, Root: ${ROOT}`);

  // Skip session_start and root spawn if injecting into existing session
  if (ROOT === 'root-001') {
    await send(makeEvent('session_start', 'system', 'system', 'system', null, {
      metadata: {
        model: 'claude-opus-4-6',
        permissionMode: 'acceptEdits',
        cwd: '~/projects/myapp',
      },
    }));
    await send(makeEvent('user_prompt', ROOT, 'Claude', 'claude', null, {
      message: 'Refactor auth module, add OAuth2, update tests, and write migration guide',
    }));
    await send(makeEvent('agent_spawned', ROOT, 'Claude', 'claude', null, {
      message: 'Planning multi-step refactor...',
    }));
    await send(makeEvent('agent_thinking', ROOT, 'Claude', 'claude', null, {
      message: 'Analyzing codebase structure...',
    }));
    await sleep(2000);
  }

  // --- Layer 1: Root spawns 3 sub-agents concurrently ---

  // 1a. Explore agent for codebase analysis
  const explorer = 'explore-001';
  await send(makeEvent('agent_spawned', explorer, 'Explore', 'Explore', ROOT, {
    message: 'Exploring auth directory structure',
    tool: { toolName: 'Agent' },
    metadata: { model: 'haiku' },
  }));
  await sleep(300);

  // 1b. Plan agent for architecture
  const planner = 'plan-001';
  await send(makeEvent('agent_spawned', planner, 'Plan', 'Plan', ROOT, {
    message: 'Designing OAuth2 architecture',
    tool: { toolName: 'Agent' },
    metadata: { model: 'sonnet' },
  }));
  await sleep(300);

  // 1c. Read agent for config
  const configReader = 'read-config';
  await send(makeEvent('agent_spawned', configReader, 'Read', 'Read', ROOT, {
    message: 'Reading current auth config',
    tool: { toolName: 'Read' },
  }));
  await sleep(500);

  // --- Layer 2: Explorer spawns its own tools ---

  // Explorer starts globbing
  await send(makeEvent('agent_tool_start', explorer, 'Explore', 'Explore', ROOT, {
    tool: { toolName: 'Glob', toolInput: { pattern: 'src/auth/**/*.ts' } },
  }));
  await sleep(800);

  // Explorer spawns a sub-Grep
  const deepGrep = 'grep-deep-001';
  await send(makeEvent('agent_spawned', deepGrep, 'Grep', 'Grep', explorer, {
    message: 'Searching for auth patterns',
    tool: { toolName: 'Grep' },
  }));
  await send(makeEvent('agent_tool_start', deepGrep, 'Grep', 'Grep', explorer, {
    tool: { toolName: 'Grep', toolInput: { pattern: 'export.*Auth' } },
  }));
  await sleep(600);

  // Explorer spawns another sub-Read (layer 2)
  const deepRead = 'read-deep-001';
  await send(makeEvent('agent_spawned', deepRead, 'Read', 'Read', explorer, {
    message: 'Reading auth middleware',
    tool: { toolName: 'Read' },
  }));
  await send(makeEvent('agent_tool_start', deepRead, 'Read', 'Read', explorer, {
    tool: { toolName: 'Read', toolInput: { file_path: 'src/auth/middleware.ts' } },
  }));
  await sleep(1000);

  // --- Planner starts thinking ---
  await send(makeEvent('agent_thinking', planner, 'Plan', 'Plan', ROOT, {
    message: 'Evaluating OAuth2 providers: Google, GitHub, custom...',
  }));
  await sleep(1500);

  // Config reader works
  await send(makeEvent('agent_tool_start', configReader, 'Read', 'Read', ROOT, {
    tool: { toolName: 'Read', toolInput: { file_path: 'src/auth/config.ts' } },
  }));
  await sleep(1200);

  // --- Deep Grep completes ---
  await send(makeEvent('agent_tool_end', deepGrep, 'Grep', 'Grep', explorer, {
    message: 'Found 15 auth exports across 8 files',
    tool: { toolName: 'Grep', toolResult: '15 matches in 8 files' },
  }));
  await send(makeEvent('agent_completed', deepGrep, 'Grep', 'Grep', explorer, {
    message: 'Search complete',
  }));
  await sleep(500);

  // --- Explorer glob completes ---
  await send(makeEvent('agent_tool_end', explorer, 'Explore', 'Explore', ROOT, {
    message: 'Found 18 auth files',
    tool: { toolName: 'Glob', toolResult: '18 files matched' },
  }));
  await sleep(400);

  // Explorer spawns yet another Grep (layer 2) — for test files
  const deepGrep2 = 'grep-deep-002';
  await send(makeEvent('agent_spawned', deepGrep2, 'Grep', 'Grep', explorer, {
    message: 'Finding test files',
    tool: { toolName: 'Grep' },
  }));
  await send(makeEvent('agent_tool_start', deepGrep2, 'Grep', 'Grep', explorer, {
    tool: { toolName: 'Grep', toolInput: { pattern: 'describe.*auth' } },
  }));
  await sleep(1500);

  // --- Deep Read completes ---
  await send(makeEvent('agent_tool_end', deepRead, 'Read', 'Read', explorer, {
    message: 'Read 180 lines from middleware.ts',
    tool: { toolName: 'Read', toolResult: 'export function authMiddleware() {...}' },
  }));
  await send(makeEvent('agent_completed', deepRead, 'Read', 'Read', explorer, {
    message: 'File read complete',
  }));
  await sleep(800);

  // --- Config reader completes ---
  await send(makeEvent('agent_tool_end', configReader, 'Read', 'Read', ROOT, {
    message: 'Auth config loaded (245 lines)',
    tool: { toolName: 'Read', toolResult: 'export const authConfig = {...}' },
  }));
  await send(makeEvent('agent_completed', configReader, 'Read', 'Read', ROOT, {
    message: 'Config read complete',
  }));
  await sleep(1000);

  // --- Planner spawns its own sub-agent (Layer 2: WebSearch) ---
  const webSearch = 'websearch-001';
  await send(makeEvent('agent_spawned', webSearch, 'WebSearch', 'WebSearch', planner, {
    message: 'Researching OAuth2 best practices',
    tool: { toolName: 'WebSearch' },
  }));
  await send(makeEvent('agent_tool_start', webSearch, 'WebSearch', 'WebSearch', planner, {
    tool: { toolName: 'WebSearch', toolInput: { query: 'OAuth2 PKCE best practices 2025' } },
  }));
  await sleep(2000);

  // --- Deep Grep 2 completes ---
  await send(makeEvent('agent_tool_end', deepGrep2, 'Grep', 'Grep', explorer, {
    message: 'Found 6 test suites',
    tool: { toolName: 'Grep', toolResult: '6 test files' },
  }));
  await send(makeEvent('agent_completed', deepGrep2, 'Grep', 'Grep', explorer, {
    message: 'Test file search complete',
  }));
  await sleep(600);

  // --- Explorer completes ---
  await send(makeEvent('agent_completed', explorer, 'Explore', 'Explore', ROOT, {
    message: 'Codebase analysis done: 18 files, 6 test suites',
  }));
  await sleep(800);

  // --- WebSearch completes ---
  await send(makeEvent('agent_tool_end', webSearch, 'WebSearch', 'WebSearch', planner, {
    message: 'Found RFC 7636 PKCE flow documentation',
    tool: { toolName: 'WebSearch', toolResult: 'OAuth2 PKCE specs...' },
  }));
  await send(makeEvent('agent_completed', webSearch, 'WebSearch', 'WebSearch', planner, {
    message: 'Research complete',
  }));
  await sleep(1000);

  // --- Planner spawns WebFetch (Layer 2) ---
  const webFetch = 'webfetch-001';
  await send(makeEvent('agent_spawned', webFetch, 'WebFetch', 'WebFetch', planner, {
    message: 'Fetching OAuth2 provider docs',
    tool: { toolName: 'WebFetch' },
  }));
  await send(makeEvent('agent_tool_start', webFetch, 'WebFetch', 'WebFetch', planner, {
    tool: { toolName: 'WebFetch', toolInput: { url: 'https://tools.ietf.org/html/rfc7636' } },
  }));
  await sleep(2500);

  // --- WebFetch completes ---
  await send(makeEvent('agent_tool_end', webFetch, 'WebFetch', 'WebFetch', planner, {
    message: 'Fetched PKCE RFC',
    tool: { toolName: 'WebFetch', toolResult: 'RFC 7636 content...' },
  }));
  await send(makeEvent('agent_completed', webFetch, 'WebFetch', 'WebFetch', planner, {
    message: 'Fetch complete',
  }));
  await sleep(800);

  // --- Planner completes ---
  await send(makeEvent('agent_completed', planner, 'Plan', 'Plan', ROOT, {
    message: 'Architecture plan ready: PKCE flow with provider abstraction',
  }));
  await sleep(1500);

  // --- Root starts implementing: Edit + spawns sub-agent ---
  await send(makeEvent('agent_tool_start', ROOT, 'Claude', 'claude', null, {
    message: 'Writing OAuth2 provider...',
    tool: { toolName: 'Edit', toolInput: { file_path: 'src/auth/oauth2-provider.ts' } },
  }));
  await sleep(1500);

  // Root spawns a general-purpose agent for test writing (Layer 1)
  const testWriter = 'agent-tests';
  await send(makeEvent('agent_spawned', testWriter, 'TestWriter', 'general-purpose', ROOT, {
    message: 'Writing test suite for OAuth2',
    tool: { toolName: 'Agent' },
    metadata: { model: 'sonnet' },
  }));
  await send(makeEvent('agent_thinking', testWriter, 'TestWriter', 'general-purpose', ROOT, {
    message: 'Designing test cases...',
  }));
  await sleep(2000);

  // --- Root edit completes ---
  await send(makeEvent('agent_tool_end', ROOT, 'Claude', 'claude', null, {
    message: 'OAuth2 provider written',
    tool: { toolName: 'Edit', toolResult: 'File created: 156 lines' },
  }));
  await sleep(500);

  // Root does another edit
  await send(makeEvent('agent_tool_start', ROOT, 'Claude', 'claude', null, {
    message: 'Updating auth middleware...',
    tool: { toolName: 'Edit', toolInput: { file_path: 'src/auth/middleware.ts' } },
  }));
  await sleep(2000);

  // --- TestWriter spawns its own tools (Layer 2) ---
  const testEdit = 'edit-test-001';
  await send(makeEvent('agent_spawned', testEdit, 'Write', 'Write', testWriter, {
    message: 'Creating test file',
    tool: { toolName: 'Write' },
  }));
  await send(makeEvent('agent_tool_start', testEdit, 'Write', 'Write', testWriter, {
    tool: { toolName: 'Write', toolInput: { file_path: 'src/auth/__tests__/oauth2.test.ts' } },
  }));
  await sleep(1800);

  // TestWriter spawns a Bash to verify (Layer 2)
  const testBash = 'bash-test-001';
  await send(makeEvent('agent_spawned', testBash, 'Bash', 'Bash', testWriter, {
    message: 'Running initial test check',
    tool: { toolName: 'Bash' },
  }));
  await send(makeEvent('agent_tool_start', testBash, 'Bash', 'Bash', testWriter, {
    tool: { toolName: 'Bash', toolInput: { command: 'npx tsc --noEmit src/auth/__tests__/oauth2.test.ts' } },
  }));
  await sleep(2500);

  // Root edit completes
  await send(makeEvent('agent_tool_end', ROOT, 'Claude', 'claude', null, {
    message: 'Middleware updated',
    tool: { toolName: 'Edit', toolResult: 'File updated' },
  }));
  await sleep(500);

  // --- Test write completes ---
  await send(makeEvent('agent_tool_end', testEdit, 'Write', 'Write', testWriter, {
    message: 'Test file written (89 lines)',
    tool: { toolName: 'Write', toolResult: 'File created' },
  }));
  await send(makeEvent('agent_completed', testEdit, 'Write', 'Write', testWriter, {
    message: 'Test file ready',
  }));
  await sleep(800);

  // --- Test Bash errors ---
  await send(makeEvent('agent_tool_error', testBash, 'Bash', 'Bash', testWriter, {
    message: 'Type error: Property provider does not exist',
    tool: { toolName: 'Bash', error: 'tsc exited with code 2' },
    error: 'Type check failed',
  }));
  await send(makeEvent('agent_error', testBash, 'Bash', 'Bash', testWriter, {
    error: 'Type check failed with 1 error',
  }));
  await sleep(1500);

  // TestWriter fixes and retries — spawns Edit (Layer 2)
  const testFix = 'edit-test-fix';
  await send(makeEvent('agent_spawned', testFix, 'Edit', 'Edit', testWriter, {
    message: 'Fixing type error in test',
    tool: { toolName: 'Edit' },
  }));
  await send(makeEvent('agent_tool_start', testFix, 'Edit', 'Edit', testWriter, {
    tool: { toolName: 'Edit', toolInput: { file_path: 'src/auth/__tests__/oauth2.test.ts' } },
  }));
  await sleep(1200);

  // Root spawns final Bash for full test suite
  const finalBash = 'bash-final';
  await send(makeEvent('agent_spawned', finalBash, 'Bash', 'Bash', ROOT, {
    message: 'Running full test suite',
    tool: { toolName: 'Bash' },
  }));
  await send(makeEvent('agent_tool_start', finalBash, 'Bash', 'Bash', ROOT, {
    tool: { toolName: 'Bash', toolInput: { command: 'npm test' } },
  }));
  await sleep(2000);

  // Test fix completes
  await send(makeEvent('agent_tool_end', testFix, 'Edit', 'Edit', testWriter, {
    tool: { toolName: 'Edit', toolResult: 'Fixed import type' },
    message: 'Type error fixed',
  }));
  await send(makeEvent('agent_completed', testFix, 'Edit', 'Edit', testWriter, {
    message: 'Fix applied',
  }));
  await sleep(800);

  // TestWriter retries Bash
  const testBash2 = 'bash-test-002';
  await send(makeEvent('agent_spawned', testBash2, 'Bash', 'Bash', testWriter, {
    message: 'Re-running type check',
    tool: { toolName: 'Bash' },
  }));
  await send(makeEvent('agent_tool_start', testBash2, 'Bash', 'Bash', testWriter, {
    tool: { toolName: 'Bash', toolInput: { command: 'npx tsc --noEmit' } },
  }));
  await sleep(2500);

  // Test Bash 2 passes
  await send(makeEvent('agent_tool_end', testBash2, 'Bash', 'Bash', testWriter, {
    message: 'Type check passed',
    tool: { toolName: 'Bash', toolResult: 'No errors' },
  }));
  await send(makeEvent('agent_completed', testBash2, 'Bash', 'Bash', testWriter, {
    message: 'Types OK',
  }));
  await sleep(500);

  // TestWriter completes
  await send(makeEvent('agent_completed', testWriter, 'TestWriter', 'general-purpose', ROOT, {
    message: 'Test suite ready, all types check out',
  }));
  await sleep(1500);

  // Final Bash completes
  await send(makeEvent('agent_tool_end', finalBash, 'Bash', 'Bash', ROOT, {
    message: '42 tests passed',
    tool: { toolName: 'Bash', toolResult: '42 passing (4.1s)' },
  }));
  await send(makeEvent('agent_completed', finalBash, 'Bash', 'Bash', ROOT, {
    message: 'All tests passing',
  }));
  await sleep(2000);

  // Root wraps up
  await send(makeEvent('agent_message', ROOT, 'Claude', 'claude', null, {
    message: 'OAuth2 support added with PKCE flow. All 42 tests passing.',
  }));
  await sleep(500);

  console.log('[sim] Simulation complete — agents will remain visible in dashboard');
}

console.log('[sim] Starting simulation via HTTP API...');
run().catch((err) => {
  console.error('[sim] Error:', err.message);
  process.exit(1);
});
