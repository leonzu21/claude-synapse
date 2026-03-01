import { create } from 'zustand';
import type { AgentEvent, SessionMeta } from '@synapse-tools/protocol';
import type { AgentNode } from '@synapse-tools/protocol';
import { deriveVisualState, createEmptySessionMeta } from '@synapse-tools/protocol';

// Global application state managed with Zustand

interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  eventCount: number;
}

export interface ToolCall {
  id: string;
  agentId: string;
  parentAgentId: string | null;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  error?: string;
  startedAt: number;
  endedAt: number | null;
  status: 'running' | 'completed' | 'error';
}

export interface ToastNotification {
  id: string;
  type: 'achievement' | 'level_up' | 'info';
  title: string;
  description?: string;
  createdAt: number;
}

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Sessions
  sessions: Session[];
  activeSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  setActiveSession: (id: string | null) => void;

  // Session metadata
  sessionMeta: SessionMeta;

  // Agents (keyed by agentId) - plain object for reliable Zustand reactivity
  agents: Record<string, AgentNode>;

  // Events for current session
  events: AgentEvent[];

  // Tool call history (keyed by tool agentId)
  toolCalls: Record<string, ToolCall>;

  // Toast queue
  toastQueue: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id' | 'createdAt'>) => void;
  dismissToast: (id: string) => void;

  // Sound
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;

  // Selected agent for detail panel
  selectedAgentId: string | null;
  setSelectedAgent: (id: string | null) => void;

  // Collapse state
  collapsedAgents: Set<string>;
  toggleCollapse: (agentId: string) => void;

  // Hover state for critical path
  hoveredNodeId: string | null;
  setHoveredNode: (id: string | null) => void;

  // Process a new event
  processEvent: (event: AgentEvent) => void;

  // Load events for a session (replay)
  loadSessionEvents: (events: AgentEvent[]) => void;

  // Reset state
  reset: () => void;
}

function getInitialSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem('synapse-sound');
    if (stored === 'false') return false;
  } catch {}
  return true;
}

let toastCounter = 0;

export const useAppStore = create<AppState>((set, get) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  sessions: [],
  activeSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => {
    set({ activeSessionId: id, events: [], agents: {}, toolCalls: {}, sessionMeta: createEmptySessionMeta() });
  },

  sessionMeta: createEmptySessionMeta(),

  agents: {},
  events: [],
  toolCalls: {},

  toastQueue: [],
  addToast: (toast) => set((state) => {
    const notification: ToastNotification = {
      ...toast,
      id: `toast_${++toastCounter}_${Date.now()}`,
      createdAt: Date.now(),
    };
    const queue = [...state.toastQueue, notification].slice(-5);
    return { toastQueue: queue };
  }),
  dismissToast: (id) => set((state) => ({
    toastQueue: state.toastQueue.filter((t) => t.id !== id),
  })),

  soundEnabled: getInitialSoundEnabled(),
  setSoundEnabled: (enabled) => {
    try { localStorage.setItem('synapse-sound', String(enabled)); } catch {}
    set({ soundEnabled: enabled });
  },

  selectedAgentId: null,
  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  collapsedAgents: new Set<string>(),
  toggleCollapse: (agentId) => set((state) => {
    const next = new Set(state.collapsedAgents);
    if (next.has(agentId)) {
      next.delete(agentId);
    } else {
      next.add(agentId);
    }
    return { collapsedAgents: next };
  }),

  hoveredNodeId: null,
  setHoveredNode: (id) => set({ hoveredNodeId: id }),

  processEvent: (event) => {
    set((state) => {
      // Auto-set active session if none selected
      let activeSessionId = state.activeSessionId;
      if (!activeSessionId && event.sessionId) {
        activeSessionId = event.sessionId;
      }

      // Only process events for the active session
      if (activeSessionId && event.sessionId !== activeSessionId) {
        // Still update activeSessionId if it was just set
        if (activeSessionId !== state.activeSessionId) {
          return { activeSessionId };
        }
        return {};
      }

      const newEvents = [...state.events, event];
      const newAgents = { ...state.agents };
      const newMeta = { ...state.sessionMeta };
      const newToolCalls = { ...state.toolCalls };

      // Update session metadata from system events only (not agent events)
      const meta = event.payload.metadata;
      if (meta && event.agentId === 'system') {
        if (meta.permissionMode) newMeta.permissionMode = meta.permissionMode as string;
        if (meta.cwd) newMeta.cwd = meta.cwd as string;
        if (meta.transcriptPath) newMeta.transcriptPath = meta.transcriptPath as string;
        if (meta.model) newMeta.model = meta.model as string;
        if (meta.sessionSource) newMeta.sessionSource = meta.sessionSource as string;
        if (meta.transcriptBytes != null) newMeta.transcriptBytes = meta.transcriptBytes as number;
        if (meta.transcriptSize) newMeta.transcriptSize = meta.transcriptSize as string;
      }

      // Track specific event types for metadata
      if (event.type === 'session_start' && !newMeta.startedAt) {
        newMeta.startedAt = event.timestamp;
      }
      if (event.type === 'context_compact') {
        newMeta.compactCount += 1;
        newMeta.lastCompactAt = event.timestamp;
        newMeta.lastCompactTrigger = (meta?.trigger as string) || null;
        newMeta.turnsSinceCompact = 0; // reset on compaction
      }
      if (event.type === 'user_prompt') {
        newMeta.promptCount += 1;
        newMeta.turnsSinceCompact += 1;
      }
      if (event.type === 'notification') {
        newMeta.notificationCount += 1;
      }
      if (event.type === 'session_end') {
        newMeta.endedAt = event.timestamp;
        newMeta.endReason = (meta?.reason as string) || null;
      }

      // Update or create agent node
      if (event.agentId && event.agentId !== 'system') {
        const existing = newAgents[event.agentId];

        if (existing) {
          newAgents[event.agentId] = {
            ...existing,
            visualState: deriveVisualState(existing.visualState, event.type),
            currentTool:
              event.type === 'agent_tool_start'
                ? event.payload.tool?.toolName || null
                : event.type === 'agent_tool_end' || event.type === 'agent_tool_error'
                  ? null
                  : existing.currentTool,
            toolCount:
              event.type === 'agent_tool_end'
                ? existing.toolCount + 1
                : existing.toolCount,
            errorCount:
              event.type === 'agent_tool_error' || event.type === 'agent_error'
                ? existing.errorCount + 1
                : existing.errorCount,
            completedAt:
              event.type === 'agent_completed' ? event.timestamp : existing.completedAt,
            lastEventAt: event.timestamp,
          };
        } else if (event.type === 'agent_spawned' || event.type === 'agent_tool_start') {
          newAgents[event.agentId] = {
            id: event.agentId,
            name: event.agentName,
            type: event.agentType,
            model: (event.payload.metadata?.model as string) || null,
            parentId: event.parentAgentId,
            sessionId: event.sessionId,
            visualState: deriveVisualState('idle', event.type),
            currentTool:
              event.type === 'agent_tool_start'
                ? event.payload.tool?.toolName || null
                : null,
            toolCount: 0,
            errorCount: 0,
            startedAt: event.timestamp,
            completedAt: null,
            lastEventAt: event.timestamp,
          };
        }
      }

      // Track tool calls
      if (event.agentId && event.agentId !== 'system') {
        if (event.type === 'agent_spawned' && event.payload.tool) {
          newToolCalls[event.agentId] = {
            id: event.id,
            agentId: event.agentId,
            parentAgentId: event.parentAgentId,
            toolName: event.payload.tool.toolName,
            toolInput: event.payload.tool.toolInput,
            startedAt: event.timestamp,
            endedAt: null,
            status: 'running',
          };
        } else if (event.type === 'agent_tool_start' && event.payload.tool && !newToolCalls[event.agentId]) {
          newToolCalls[event.agentId] = {
            id: event.id,
            agentId: event.agentId,
            parentAgentId: event.parentAgentId,
            toolName: event.payload.tool.toolName,
            toolInput: event.payload.tool.toolInput,
            startedAt: event.timestamp,
            endedAt: null,
            status: 'running',
          };
        }

        const existing = newToolCalls[event.agentId];
        if (existing) {
          if (event.type === 'agent_tool_end' || event.type === 'agent_completed') {
            newToolCalls[event.agentId] = {
              ...existing,
              toolResult: event.payload.tool?.toolResult || event.payload.message,
              endedAt: event.timestamp,
              status: 'completed',
            };
          } else if (event.type === 'agent_tool_error' || event.type === 'agent_error') {
            newToolCalls[event.agentId] = {
              ...existing,
              error: event.payload.error || event.payload.tool?.error,
              endedAt: event.timestamp,
              status: 'error',
            };
          }
        }
      }

      return { events: newEvents, agents: newAgents, activeSessionId, sessionMeta: newMeta, toolCalls: newToolCalls };
    });
  },

  loadSessionEvents: (events) => {
    set({ events: [], agents: {}, toolCalls: {}, sessionMeta: createEmptySessionMeta() });
    for (const event of events) {
      get().processEvent(event);
    }
  },

  reset: () =>
    set({
      agents: {},
      events: [],
      toolCalls: {},
      activeSessionId: null,
      selectedAgentId: null,
      sessionMeta: createEmptySessionMeta(),
    }),
}));
