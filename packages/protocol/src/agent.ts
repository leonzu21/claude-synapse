export type AgentVisualState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'completed'
  | 'error';

export interface AgentNode {
  id: string;
  name: string;
  type: string;
  model: string | null;
  parentId: string | null;
  sessionId: string;
  visualState: AgentVisualState;
  currentTool: string | null;
  toolCount: number;
  errorCount: number;
  startedAt: number;
  completedAt: number | null;
  lastEventAt: number;
}

/**
 * Derive visual state from a sequence of events.
 * Called each time a new event arrives for an agent.
 */
export function deriveVisualState(
  currentState: AgentVisualState,
  eventType: string,
): AgentVisualState {
  switch (eventType) {
    case 'agent_spawned':
      return 'idle';
    case 'agent_thinking':
      return 'thinking';
    case 'agent_tool_start':
      return 'working';
    case 'agent_tool_end':
      return 'thinking'; // back to thinking after tool completes
    case 'agent_tool_error':
      return 'error';
    case 'agent_completed':
      return 'completed';
    case 'agent_error':
      return 'error';
    case 'agent_message':
      return currentState === 'idle' ? 'thinking' : currentState;
    default:
      return currentState;
  }
}
