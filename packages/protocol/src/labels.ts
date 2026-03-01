// Human-readable labels and icons for tool names and agent types

const toolLabels: Record<string, { active: string; done: string; icon: string }> = {
  Bash: { active: 'Running command', done: 'Ran command', icon: '>' },
  Write: { active: 'Writing code', done: 'Wrote file', icon: '✎' },
  Edit: { active: 'Editing code', done: 'Edited file', icon: '✎' },
  Read: { active: 'Reading file', done: 'Read file', icon: '◉' },
  Grep: { active: 'Searching code', done: 'Searched code', icon: '⌕' },
  Glob: { active: 'Finding files', done: 'Found files', icon: '⌕' },
  Agent: { active: 'Spawning agent', done: 'Agent finished', icon: '◎' },
  WebSearch: { active: 'Searching the web', done: 'Web search done', icon: '⊕' },
  WebFetch: { active: 'Fetching page', done: 'Fetched page', icon: '⊕' },
  NotebookEdit: { active: 'Editing notebook', done: 'Edited notebook', icon: '✎' },
  TodoWrite: { active: 'Updating tasks', done: 'Updated tasks', icon: '☑' },
  TaskCreate: { active: 'Creating task', done: 'Created task', icon: '☑' },
  TaskUpdate: { active: 'Updating task', done: 'Updated task', icon: '☑' },
  EnterPlanMode: { active: 'Planning', done: 'Plan ready', icon: '◇' },
  ExitPlanMode: { active: 'Finishing plan', done: 'Plan done', icon: '◇' },
  AskUserQuestion: { active: 'Asking user', done: 'Got answer', icon: '?' },
  Skill: { active: 'Running skill', done: 'Skill complete', icon: '⚡' },
};

const agentTypeLabels: Record<string, { active: string; done: string; icon: string }> = {
  Explore: { active: 'Exploring codebase', done: 'Exploration done', icon: '⌕' },
  Plan: { active: 'Planning approach', done: 'Plan complete', icon: '◇' },
  'general-purpose': { active: 'Working on task', done: 'Task complete', icon: '◎' },
  root: { active: 'Thinking', done: 'Done', icon: '◎' },
};

export function getToolLabel(
  toolName: string,
  phase: 'active' | 'done' = 'active',
): string {
  const entry = toolLabels[toolName];
  if (!entry) return phase === 'active' ? `Using ${toolName}` : `Used ${toolName}`;
  return entry[phase];
}

export function getToolIcon(toolName: string): string {
  return toolLabels[toolName]?.icon || '•';
}

export function getAgentLabel(
  agentType: string,
  phase: 'active' | 'done' = 'active',
): string {
  const entry = agentTypeLabels[agentType];
  if (!entry) return phase === 'active' ? agentType : `${agentType} done`;
  return entry[phase];
}

export function getAgentIcon(agentType: string): string {
  return agentTypeLabels[agentType]?.icon || '◎';
}

/**
 * Get a short human description from tool_input for display.
 */
export function getToolDetail(toolName: string, toolInput?: Record<string, unknown>): string {
  if (!toolInput) return '';
  switch (toolName) {
    case 'Bash':
      return (toolInput.description as string) || (toolInput.command as string)?.slice(0, 60) || '';
    case 'Write':
    case 'Read':
      return shortPath(toolInput.file_path as string);
    case 'Edit':
      return shortPath(toolInput.file_path as string);
    case 'Grep':
      return (toolInput.pattern as string) || '';
    case 'Glob':
      return (toolInput.pattern as string) || '';
    case 'Agent':
      return (toolInput.description as string) || (toolInput.subagent_type as string) || '';
    case 'WebSearch':
      return (toolInput.query as string)?.slice(0, 50) || '';
    case 'WebFetch':
      return shortUrl(toolInput.url as string);
    default:
      return '';
  }
}

function shortPath(p: string | undefined): string {
  if (!p) return '';
  const parts = p.split('/');
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p;
}

function shortUrl(u: string | undefined): string {
  if (!u) return '';
  try {
    return new URL(u).hostname;
  } catch {
    return u.slice(0, 40);
  }
}
