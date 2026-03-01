import { AgentEvent, AgentEventType } from './events.js';
import { getToolLabel, getToolDetail, getAgentLabel } from './labels.js';

let eventCounter = 0;

function generateId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

interface ClaudeHookPayload {
  session_id?: string;
  hook_event_name?: string;
  // Common fields on every hook
  permission_mode?: string;
  cwd?: string;
  transcript_path?: string;
  // Tool fields
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  tool_use_id?: string;
  error?: string;
  // Subagent fields
  agent_id?: string;
  agent_type?: string;
  last_assistant_message?: string;
  // SessionStart fields
  source?: string;
  model?: string;
  // PreCompact fields
  trigger?: string;
  custom_instructions?: string;
  // Notification fields
  message?: string;
  title?: string;
  notification_type?: string;
  // UserPromptSubmit fields
  prompt?: string;
  // SessionEnd fields
  reason?: string;
  [key: string]: unknown;
}

const activeSessions = new Set<string>();
const knownSubagents = new Map<string, { sessionId: string; agentType: string }>();
// Stash model from Agent PreToolUse so we can attach it to SubagentStart
// Keyed by sessionId, queued in order (FIFO) for parallel agent spawns
const pendingAgentModels = new Map<string, string[]>();

export function transformClaudeHook(
  hookEvent: string,
  body: ClaudeHookPayload,
): AgentEvent[] {
  const events: AgentEvent[] = [];
  const now = Date.now();
  const sessionId = body.session_id || 'session_default';
  const rootAgentId = `root_${sessionId}`;

  // Build common metadata from fields present on every hook
  const commonMeta: Record<string, unknown> = {};
  if (body.permission_mode) commonMeta.permissionMode = body.permission_mode;
  if (body.cwd) commonMeta.cwd = body.cwd;
  if (body.transcript_path) commonMeta.transcriptPath = body.transcript_path;

  // Auto-create session + root agent on first event
  if (!activeSessions.has(sessionId)) {
    activeSessions.add(sessionId);
    events.push({
      id: generateId(),
      type: 'session_start',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'Session',
      agentType: 'system',
      parentAgentId: null,
      payload: { metadata: commonMeta },
      source: 'claude_hooks',
    });
    events.push({
      id: generateId(),
      type: 'agent_spawned',
      timestamp: now,
      sessionId,
      agentId: rootAgentId,
      agentName: 'Claude',
      agentType: 'root',
      parentAgentId: null,
      payload: {},
      source: 'claude_hooks',
    });
  }

  // Always emit session_meta with common fields so dashboard stays updated
  if (Object.keys(commonMeta).length > 0) {
    events.push({
      id: generateId(),
      type: 'session_meta',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'Session',
      agentType: 'system',
      parentAgentId: null,
      payload: { metadata: commonMeta },
      source: 'claude_hooks',
    });
  }

  if (hookEvent === 'SessionStart') {
    const meta: Record<string, unknown> = { ...commonMeta };
    if (body.model) meta.model = body.model;
    if (body.source) meta.sessionSource = body.source;

    events.push({
      id: generateId(),
      type: 'session_meta',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'Session started',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        message: body.source === 'compact'
          ? 'Context compacted — session resumed'
          : body.source === 'resume'
            ? 'Session resumed'
            : body.model
              ? `Model: ${body.model}`
              : 'Session started',
        metadata: meta,
      },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'PreCompact') {
    events.push({
      id: generateId(),
      type: 'context_compact',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'Context compaction',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        message: body.trigger === 'manual'
          ? 'Manual context compaction (/compact)'
          : 'Auto context compaction (nearing limit)',
        metadata: {
          trigger: body.trigger,
          customInstructions: body.custom_instructions,
        },
      },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'UserPromptSubmit') {
    events.push({
      id: generateId(),
      type: 'user_prompt',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'User prompt',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        message: body.prompt?.slice(0, 200),
      },
      source: 'claude_hooks',
    });

    // Set root agent to thinking immediately
    events.push({
      id: generateId(),
      type: 'agent_thinking',
      timestamp: now,
      sessionId,
      agentId: rootAgentId,
      agentName: 'Claude',
      agentType: 'root',
      parentAgentId: null,
      payload: { message: 'Processing prompt...' },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'Notification') {
    events.push({
      id: generateId(),
      type: 'notification',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: body.title || 'Notification',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        message: body.message,
        metadata: {
          notificationType: body.notification_type,
        },
      },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'SessionEnd') {
    events.push({
      id: generateId(),
      type: 'session_end',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'Session ended',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        message: `Session ended: ${body.reason || 'unknown'}`,
        metadata: { reason: body.reason },
      },
      source: 'claude_hooks',
    });

    // Clean up
    activeSessions.delete(sessionId);
    for (const [id, sub] of knownSubagents) {
      if (sub.sessionId === sessionId) knownSubagents.delete(id);
    }
  } else if (hookEvent === 'PermissionRequest') {
    const toolName = body.tool_name || 'unknown';
    const detail = getToolDetail(toolName, body.tool_input);

    events.push({
      id: generateId(),
      type: 'notification',
      timestamp: now,
      sessionId,
      agentId: 'system',
      agentName: 'Permission request',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        message: `${getToolLabel(toolName, 'active')}${detail ? ': ' + detail : ''}`,
        metadata: { notificationType: 'permission_prompt', toolName },
      },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'SubagentStart') {
    const agentId = body.agent_id || `sub_${generateId()}`;
    const agentType = body.agent_type || 'subagent';
    const queue = pendingAgentModels.get(sessionId);
    const agentModel = queue?.shift() || null;
    if (queue && queue.length === 0) pendingAgentModels.delete(sessionId);
    knownSubagents.set(agentId, { sessionId, agentType });

    events.push({
      id: generateId(),
      type: 'agent_spawned',
      timestamp: now,
      sessionId,
      agentId,
      agentName: getAgentLabel(agentType, 'active'),
      agentType,
      parentAgentId: rootAgentId,
      payload: { metadata: agentModel ? { model: agentModel } : undefined },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'SubagentStop') {
    const agentId = body.agent_id || 'unknown_sub';
    const sub = knownSubagents.get(agentId);
    const agentType = sub?.agentType || body.agent_type || 'subagent';

    events.push({
      id: generateId(),
      type: 'agent_completed',
      timestamp: now,
      sessionId,
      agentId,
      agentName: getAgentLabel(agentType, 'done'),
      agentType,
      parentAgentId: rootAgentId,
      payload: {
        message: body.last_assistant_message?.slice(0, 200),
      },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'PreToolUse') {
    const toolName = body.tool_name || 'unknown';
    const toolUseId = body.tool_use_id || `tool_${generateId()}`;
    const detail = getToolDetail(toolName, body.tool_input);

    // Stash model when spawning a subagent so SubagentStart can pick it up
    if (toolName === 'Agent' && body.tool_input?.model) {
      const queue = pendingAgentModels.get(sessionId) || [];
      queue.push(body.tool_input.model as string);
      pendingAgentModels.set(sessionId, queue);
    }

    // Each tool call gets its own node as a child of root
    events.push({
      id: generateId(),
      type: 'agent_spawned',
      timestamp: now,
      sessionId,
      agentId: toolUseId,
      agentName: getToolLabel(toolName, 'active'),
      agentType: toolName,
      parentAgentId: rootAgentId,
      payload: {
        tool: { toolName, toolInput: body.tool_input },
        message: detail,
      },
      source: 'claude_hooks',
    });

    // Immediately transition to working
    events.push({
      id: generateId(),
      type: 'agent_tool_start',
      timestamp: now,
      sessionId,
      agentId: toolUseId,
      agentName: getToolLabel(toolName, 'active'),
      agentType: toolName,
      parentAgentId: rootAgentId,
      payload: {
        tool: { toolName, toolInput: body.tool_input },
        message: detail,
      },
      source: 'claude_hooks',
    });

    // Set root to working while tool executes
    events.push({
      id: generateId(),
      type: 'agent_tool_start',
      timestamp: now,
      sessionId,
      agentId: rootAgentId,
      agentName: 'Claude',
      agentType: 'root',
      parentAgentId: null,
      payload: {
        tool: { toolName },
      },
      source: 'claude_hooks',
    });
  } else if (hookEvent === 'PostToolUse') {
    const toolName = body.tool_name || 'unknown';
    const toolUseId = body.tool_use_id || '';

    if (toolUseId) {
      events.push({
        id: generateId(),
        type: 'agent_completed',
        timestamp: now,
        sessionId,
        agentId: toolUseId,
        agentName: getToolLabel(toolName, 'done'),
        agentType: toolName,
        parentAgentId: rootAgentId,
        payload: {
          tool: {
            toolName,
            toolResult:
              typeof body.tool_response === 'string'
                ? body.tool_response.slice(0, 500)
                : body.tool_response
                  ? JSON.stringify(body.tool_response).slice(0, 500)
                  : undefined,
          },
        },
        source: 'claude_hooks',
      });

      // Root back to thinking between tool calls
      events.push({
        id: generateId(),
        type: 'agent_tool_end',
        timestamp: now,
        sessionId,
        agentId: rootAgentId,
        agentName: 'Claude',
        agentType: 'root',
        parentAgentId: null,
        payload: {
          tool: { toolName },
        },
        source: 'claude_hooks',
      });
    }
  } else if (hookEvent === 'PostToolUseFailure') {
    const toolName = body.tool_name || 'unknown';
    const toolUseId = body.tool_use_id || '';

    if (toolUseId) {
      events.push({
        id: generateId(),
        type: 'agent_error',
        timestamp: now,
        sessionId,
        agentId: toolUseId,
        agentName: getToolLabel(toolName, 'done'),
        agentType: toolName,
        parentAgentId: rootAgentId,
        payload: {
          error: body.error,
          tool: { toolName, error: body.error },
        },
        source: 'claude_hooks',
      });

      // Root back to thinking (child errored, not root)
      events.push({
        id: generateId(),
        type: 'agent_tool_end',
        timestamp: now,
        sessionId,
        agentId: rootAgentId,
        agentName: 'Claude',
        agentType: 'root',
        parentAgentId: null,
        payload: {
          tool: { toolName },
        },
        source: 'claude_hooks',
      });
    }
  } else if (hookEvent === 'Stop') {
    events.push({
      id: generateId(),
      type: 'agent_completed',
      timestamp: now,
      sessionId,
      agentId: rootAgentId,
      agentName: 'Claude',
      agentType: 'root',
      parentAgentId: null,
      payload: {
        message: body.last_assistant_message?.slice(0, 200),
      },
      source: 'claude_hooks',
    });

    // Clean up session tracking to prevent memory leaks
    activeSessions.delete(sessionId);
    for (const [id, sub] of knownSubagents) {
      if (sub.sessionId === sessionId) knownSubagents.delete(id);
    }
  }

  return events;
}

export function resetTransformState(): void {
  activeSessions.clear();
  knownSubagents.clear();
  pendingAgentModels.clear();
  eventCounter = 0;
}
