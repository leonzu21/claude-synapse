import { useState, useCallback } from 'react';
import { useAppStore } from '../../state/store';

const COLLECTOR_URL = 'http://localhost:4800';

let eventCounter = 0;

function makeEvent(
  type: string,
  sessionId: string,
  agentId: string,
  agentName: string,
  agentType: string,
  parentId: string | null,
  payload: Record<string, unknown> = {},
) {
  return {
    id: `sim-evt-${++eventCounter}-${Date.now()}`,
    type,
    timestamp: Date.now(),
    sessionId,
    agentId,
    agentName,
    agentType,
    parentAgentId: parentId,
    payload,
    source: 'sdk',
  };
}

async function sendEvent(evt: Record<string, unknown>) {
  await fetch(`${COLLECTOR_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(evt),
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runSimulation(sessionId: string, rootId: string) {
  const sid = sessionId;
  const root = rootId;
  const prefix = `sim-${Date.now().toString(36).slice(-4)}`;

  // Layer 1: Root spawns 3 sub-agents
  const explorer = `${prefix}-explore`;
  const planner = `${prefix}-plan`;
  const reader = `${prefix}-reader`;

  await sendEvent(makeEvent('agent_spawned', sid, explorer, 'Explore', 'Explore', root, {
    message: 'Exploring auth directory', tool: { toolName: 'Agent' }, metadata: { model: 'haiku' },
  }));
  await sleep(200);
  await sendEvent(makeEvent('agent_spawned', sid, planner, 'Plan', 'Plan', root, {
    message: 'Designing OAuth2 architecture', tool: { toolName: 'Agent' }, metadata: { model: 'sonnet' },
  }));
  await sleep(200);
  await sendEvent(makeEvent('agent_spawned', sid, reader, 'Read', 'Read', root, {
    message: 'Reading auth config', tool: { toolName: 'Read' },
  }));
  await sleep(300);

  // Layer 2: Explorer spawns Grep + Read
  const deepGrep = `${prefix}-grep1`;
  const deepRead = `${prefix}-dread`;

  await sendEvent(makeEvent('agent_tool_start', sid, explorer, 'Explore', 'Explore', root, {
    tool: { toolName: 'Glob', toolInput: { pattern: 'src/auth/**/*.ts' } },
  }));
  await sleep(400);
  await sendEvent(makeEvent('agent_spawned', sid, deepGrep, 'Grep', 'Grep', explorer, {
    message: 'Searching for auth patterns', tool: { toolName: 'Grep' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, deepGrep, 'Grep', 'Grep', explorer, {
    tool: { toolName: 'Grep', toolInput: { pattern: 'export.*Auth' } },
  }));
  await sleep(400);
  await sendEvent(makeEvent('agent_spawned', sid, deepRead, 'Read', 'Read', explorer, {
    message: 'Reading middleware', tool: { toolName: 'Read' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, deepRead, 'Read', 'Read', explorer, {
    tool: { toolName: 'Read', toolInput: { file_path: 'src/auth/middleware.ts' } },
  }));
  await sleep(600);

  // Planner thinks, then spawns WebSearch
  await sendEvent(makeEvent('agent_thinking', sid, planner, 'Plan', 'Plan', root, {
    message: 'Evaluating OAuth2 providers...',
  }));
  await sleep(500);
  const webSearch = `${prefix}-ws`;
  await sendEvent(makeEvent('agent_spawned', sid, webSearch, 'WebSearch', 'WebSearch', planner, {
    message: 'Researching OAuth2 best practices', tool: { toolName: 'WebSearch' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, webSearch, 'WebSearch', 'WebSearch', planner, {
    tool: { toolName: 'WebSearch', toolInput: { query: 'OAuth2 PKCE 2025' } },
  }));
  await sleep(800);

  // Reader works
  await sendEvent(makeEvent('agent_tool_start', sid, reader, 'Read', 'Read', root, {
    tool: { toolName: 'Read', toolInput: { file_path: 'src/auth/config.ts' } },
  }));
  await sleep(1000);

  // Deep grep completes
  await sendEvent(makeEvent('agent_tool_end', sid, deepGrep, 'Grep', 'Grep', explorer, {
    message: 'Found 15 auth exports', tool: { toolName: 'Grep', toolResult: '15 matches' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, deepGrep, 'Grep', 'Grep', explorer, {
    message: 'Search complete',
  }));
  await sleep(400);

  // Explorer glob completes, spawns another grep
  await sendEvent(makeEvent('agent_tool_end', sid, explorer, 'Explore', 'Explore', root, {
    message: 'Found 18 files', tool: { toolName: 'Glob', toolResult: '18 files' },
  }));
  const deepGrep2 = `${prefix}-grep2`;
  await sendEvent(makeEvent('agent_spawned', sid, deepGrep2, 'Grep', 'Grep', explorer, {
    message: 'Finding test files', tool: { toolName: 'Grep' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, deepGrep2, 'Grep', 'Grep', explorer, {
    tool: { toolName: 'Grep', toolInput: { pattern: 'describe.*auth' } },
  }));
  await sleep(1200);

  // Deep read completes
  await sendEvent(makeEvent('agent_tool_end', sid, deepRead, 'Read', 'Read', explorer, {
    message: 'Read 180 lines', tool: { toolName: 'Read', toolResult: 'export function authMiddleware()...' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, deepRead, 'Read', 'Read', explorer, {
    message: 'File read complete',
  }));
  await sleep(500);

  // Reader completes
  await sendEvent(makeEvent('agent_tool_end', sid, reader, 'Read', 'Read', root, {
    message: 'Config loaded', tool: { toolName: 'Read', toolResult: 'authConfig = {...}' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, reader, 'Read', 'Read', root, {
    message: 'Config read complete',
  }));
  await sleep(600);

  // WebSearch completes
  await sendEvent(makeEvent('agent_tool_end', sid, webSearch, 'WebSearch', 'WebSearch', planner, {
    message: 'Found PKCE docs', tool: { toolName: 'WebSearch', toolResult: 'RFC 7636...' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, webSearch, 'WebSearch', 'WebSearch', planner, {
    message: 'Research complete',
  }));
  await sleep(500);

  // Planner spawns WebFetch
  const webFetch = `${prefix}-wf`;
  await sendEvent(makeEvent('agent_spawned', sid, webFetch, 'WebFetch', 'WebFetch', planner, {
    message: 'Fetching RFC', tool: { toolName: 'WebFetch' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, webFetch, 'WebFetch', 'WebFetch', planner, {
    tool: { toolName: 'WebFetch', toolInput: { url: 'https://tools.ietf.org/html/rfc7636' } },
  }));
  await sleep(1500);

  // Grep2 completes
  await sendEvent(makeEvent('agent_tool_end', sid, deepGrep2, 'Grep', 'Grep', explorer, {
    message: '6 test suites', tool: { toolName: 'Grep', toolResult: '6 files' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, deepGrep2, 'Grep', 'Grep', explorer, {
    message: 'Done',
  }));
  await sleep(300);

  // Explorer completes
  await sendEvent(makeEvent('agent_completed', sid, explorer, 'Explore', 'Explore', root, {
    message: '18 files, 6 test suites found',
  }));
  await sleep(500);

  // WebFetch completes
  await sendEvent(makeEvent('agent_tool_end', sid, webFetch, 'WebFetch', 'WebFetch', planner, {
    message: 'RFC fetched', tool: { toolName: 'WebFetch', toolResult: 'PKCE content...' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, webFetch, 'WebFetch', 'WebFetch', planner, {
    message: 'Fetch complete',
  }));
  await sleep(400);

  // Planner completes
  await sendEvent(makeEvent('agent_completed', sid, planner, 'Plan', 'Plan', root, {
    message: 'Architecture plan ready',
  }));
  await sleep(800);

  // Root spawns TestWriter (general-purpose agent)
  const testWriter = `${prefix}-tw`;
  await sendEvent(makeEvent('agent_spawned', sid, testWriter, 'TestWriter', 'general-purpose', root, {
    message: 'Writing OAuth2 tests', tool: { toolName: 'Agent' }, metadata: { model: 'sonnet' },
  }));
  await sendEvent(makeEvent('agent_thinking', sid, testWriter, 'TestWriter', 'general-purpose', root, {
    message: 'Designing test cases...',
  }));
  await sleep(1000);

  // TestWriter spawns Write + Bash
  const testWrite = `${prefix}-tw-w`;
  const testBash = `${prefix}-tw-b`;
  await sendEvent(makeEvent('agent_spawned', sid, testWrite, 'Write', 'Write', testWriter, {
    message: 'Creating test file', tool: { toolName: 'Write' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, testWrite, 'Write', 'Write', testWriter, {
    tool: { toolName: 'Write', toolInput: { file_path: 'src/auth/__tests__/oauth2.test.ts' } },
  }));
  await sleep(600);
  await sendEvent(makeEvent('agent_spawned', sid, testBash, 'Bash', 'Bash', testWriter, {
    message: 'Running type check', tool: { toolName: 'Bash' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, testBash, 'Bash', 'Bash', testWriter, {
    tool: { toolName: 'Bash', toolInput: { command: 'npx tsc --noEmit' } },
  }));
  await sleep(1500);

  // Write completes
  await sendEvent(makeEvent('agent_tool_end', sid, testWrite, 'Write', 'Write', testWriter, {
    message: 'Test file written', tool: { toolName: 'Write', toolResult: 'Created 89 lines' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, testWrite, 'Write', 'Write', testWriter, {
    message: 'File ready',
  }));
  await sleep(800);

  // Bash errors
  await sendEvent(makeEvent('agent_tool_error', sid, testBash, 'Bash', 'Bash', testWriter, {
    message: 'Type error', tool: { toolName: 'Bash', error: 'tsc exit code 2' }, error: 'Type check failed',
  }));
  await sendEvent(makeEvent('agent_error', sid, testBash, 'Bash', 'Bash', testWriter, {
    error: '1 type error',
  }));
  await sleep(800);

  // TestWriter spawns Edit to fix, then retry Bash
  const testFix = `${prefix}-tw-fix`;
  await sendEvent(makeEvent('agent_spawned', sid, testFix, 'Edit', 'Edit', testWriter, {
    message: 'Fixing type error', tool: { toolName: 'Edit' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, testFix, 'Edit', 'Edit', testWriter, {
    tool: { toolName: 'Edit', toolInput: { file_path: 'src/auth/__tests__/oauth2.test.ts' } },
  }));
  await sleep(1000);
  await sendEvent(makeEvent('agent_tool_end', sid, testFix, 'Edit', 'Edit', testWriter, {
    tool: { toolName: 'Edit', toolResult: 'Fixed import' }, message: 'Fixed',
  }));
  await sendEvent(makeEvent('agent_completed', sid, testFix, 'Edit', 'Edit', testWriter, {
    message: 'Fix applied',
  }));
  await sleep(500);

  const testBash2 = `${prefix}-tw-b2`;
  await sendEvent(makeEvent('agent_spawned', sid, testBash2, 'Bash', 'Bash', testWriter, {
    message: 'Re-running type check', tool: { toolName: 'Bash' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, testBash2, 'Bash', 'Bash', testWriter, {
    tool: { toolName: 'Bash', toolInput: { command: 'npx tsc --noEmit' } },
  }));
  await sleep(1500);

  // Bash2 passes
  await sendEvent(makeEvent('agent_tool_end', sid, testBash2, 'Bash', 'Bash', testWriter, {
    message: 'Types OK', tool: { toolName: 'Bash', toolResult: 'No errors' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, testBash2, 'Bash', 'Bash', testWriter, {
    message: 'Types OK',
  }));
  await sleep(500);

  // TestWriter completes
  await sendEvent(makeEvent('agent_completed', sid, testWriter, 'TestWriter', 'general-purpose', root, {
    message: 'Test suite ready',
  }));

  // Final Bash from root
  const finalBash = `${prefix}-bash-f`;
  await sendEvent(makeEvent('agent_spawned', sid, finalBash, 'Bash', 'Bash', root, {
    message: 'Running full test suite', tool: { toolName: 'Bash' },
  }));
  await sendEvent(makeEvent('agent_tool_start', sid, finalBash, 'Bash', 'Bash', root, {
    tool: { toolName: 'Bash', toolInput: { command: 'npm test' } },
  }));
  await sleep(2000);
  await sendEvent(makeEvent('agent_tool_end', sid, finalBash, 'Bash', 'Bash', root, {
    message: '42 tests passed', tool: { toolName: 'Bash', toolResult: '42 passing' },
  }));
  await sendEvent(makeEvent('agent_completed', sid, finalBash, 'Bash', 'Bash', root, {
    message: 'All tests passing',
  }));
}

export default function SimulateButton() {
  const [running, setRunning] = useState(false);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const agents = useAppStore((s) => s.agents);

  const handleSimulate = useCallback(async () => {
    if (running || !activeSessionId) return;
    setRunning(true);

    // Find the root agent
    const rootAgent = Object.values(agents).find((a) => !a.parentId);
    const rootId = rootAgent?.id || `root_${activeSessionId}`;

    try {
      await runSimulation(activeSessionId, rootId);
    } catch (err) {
      console.error('[simulate] Error:', err);
    } finally {
      setRunning(false);
    }
  }, [running, activeSessionId, agents]);

  return (
    <button
      className="text-[12px] font-bold uppercase px-1.5 py-0.5 border flex-shrink-0"
      style={{
        color: running ? '#22d65e' : 'var(--text-muted)',
        borderColor: '#334155',
        backgroundColor: running ? '#052e16' : 'transparent',
        cursor: running ? 'wait' : 'pointer',
      }}
      onClick={handleSimulate}
      disabled={running || !activeSessionId}
      title="Inject simulated agents into current session"
    >
      {running ? 'SIMULATING...' : 'SIMULATE'}
    </button>
  );
}
