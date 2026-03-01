// Single source of truth for all labels and text

// Node state labels
export const stateLabels: Record<string, string> = {
  idle: 'IDLE',
  thinking: 'REASONING',
  working: 'EXECUTING',
  completed: 'DONE',
  error: 'ERROR',
};

// Activity feed event labels
export const eventLabels: Record<string, string> = {
  agent_spawned: 'spawned subprocess',
  agent_tool_start: 'started tool',
  agent_tool_end: 'tool completed',
  agent_tool_error: 'tool failed',
  agent_completed: 'completed',
  agent_error: 'errored',
  agent_thinking: 'processing...',
};

// Detail panel stat labels
export const statLabels: Record<string, string> = {
  status: 'STATUS',
  class: 'TYPE',
  timeAlive: 'DURATION',
  toolCount: 'TOOL CALLS',
  errorCount: 'ERRORS',
  toolList: 'TOOLS USED',
};

// Session info bar labels
export const sessionLabels: Record<string, string> = {
  events: 'Events',
  tools: 'Tool Calls',
  prompts: 'Prompts',
  errors: 'Errors',
};

// Header / app-level labels
export const headerLabels: Record<string, string> = {
  title: '[*] CEREBRO',
  sidebarOpen: '[-] CLOSE LOG',
  sidebarClosed: '[+] EVENT LOG',
  emptyTitle: 'NO ACTIVE AGENTS',
  emptySubtitle: 'Start a Claude Code session to begin monitoring',
};

// Activity feed header
export const feedLabels: Record<string, string> = {
  title: 'EVENT LOG',
  countSuffix: 'ENTRIES',
  empty: 'No events recorded yet',
};
