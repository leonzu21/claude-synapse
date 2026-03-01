export type AgentEventType =
  | 'session_start'
  | 'session_end'
  | 'session_meta'
  | 'context_compact'
  | 'user_prompt'
  | 'notification'
  | 'agent_spawned'
  | 'agent_thinking'
  | 'agent_tool_start'
  | 'agent_tool_end'
  | 'agent_tool_error'
  | 'agent_message'
  | 'agent_completed'
  | 'agent_error';

export interface ToolPayload {
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  error?: string;
}

export interface AgentEventPayload {
  message?: string;
  tool?: ToolPayload;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  timestamp: number;
  sessionId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  parentAgentId: string | null;
  payload: AgentEventPayload;
  source: 'claude_hooks' | 'sdk' | 'replay';
}

/** Session-level metadata extracted from hook common fields. */
export interface SessionMeta {
  model: string | null;
  permissionMode: string | null;
  cwd: string | null;
  transcriptPath: string | null;
  sessionSource: string | null;
  compactCount: number;
  lastCompactAt: number | null;
  lastCompactTrigger: string | null;
  promptCount: number;
  notificationCount: number;
  startedAt: number | null;
  endedAt: number | null;
  endReason: string | null;
  transcriptBytes: number | null;
  transcriptSize: string | null;
  turnsSinceCompact: number;
}

export function createEmptySessionMeta(): SessionMeta {
  return {
    model: null,
    permissionMode: null,
    cwd: null,
    transcriptPath: null,
    sessionSource: null,
    compactCount: 0,
    lastCompactAt: null,
    lastCompactTrigger: null,
    promptCount: 0,
    notificationCount: 0,
    startedAt: null,
    endedAt: null,
    endReason: null,
    transcriptBytes: null,
    transcriptSize: null,
    turnsSinceCompact: 0,
  };
}
