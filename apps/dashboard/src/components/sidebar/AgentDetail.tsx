import { motion } from 'framer-motion';
import { useAppStore } from '../../state/store';
import { stateColors } from '../../animations/variants';
import { stateLabels, statLabels } from '../../labels/modeLabels';
import { IconClose } from '../PixelIcons';
import ToolCallInspector from './ToolCallInspector';

function formatDuration(start: number, end: number | null): string {
  const ms = (end || Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function AgentDetail() {
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const agents = useAppStore((s) => s.agents);
  const events = useAppStore((s) => s.events);
  const setSelectedAgent = useAppStore((s) => s.setSelectedAgent);

  if (!selectedAgentId) return null;

  const agent = agents[selectedAgentId];
  if (!agent) return null;

  const agentEvents = events.filter((e) => e.agentId === selectedAgentId);
  const tools = agentEvents
    .filter((e) => e.type === 'agent_tool_start')
    .map((e) => e.payload.tool?.toolName)
    .filter(Boolean);

  const color = stateColors[agent.visualState] || stateColors.idle;

  return (
    <motion.div
      className="border-t-2 p-2.5"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, ease: 'linear' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2"
            style={{ backgroundColor: color }}
          />
          <span className="text-[14px] font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
            {agent.name}
          </span>
        </div>
        <button
          className="hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => setSelectedAgent(null)}
        >
          <IconClose color="var(--text-muted)" size={14} />
        </button>
      </div>

      <div className="space-y-1.5 text-[12px]">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>{statLabels.status}</span>
          <span className="uppercase font-bold" style={{ color }}>
            {stateLabels[agent.visualState] || agent.visualState}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>{statLabels.class}</span>
          <span className="uppercase" style={{ color: 'var(--text-dim)' }}>{agent.type}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>{statLabels.timeAlive}</span>
          <span style={{ color: 'var(--text-dim)' }}>
            {formatDuration(agent.startedAt, agent.completedAt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>{statLabels.toolCount}</span>
          <span style={{ color: 'var(--text-dim)' }}>{agent.toolCount}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>{statLabels.errorCount}</span>
          <span style={{ color: agent.errorCount > 0 ? 'var(--agent-error)' : 'var(--text-dim)' }}>
            {agent.errorCount}
          </span>
        </div>

        {tools.length > 0 && (
          <div className="mt-1.5">
            <span className="block mb-1 uppercase" style={{ color: 'var(--text-muted)' }}>{statLabels.toolList}</span>
            <div className="flex flex-wrap gap-1">
              {tools.map((tool, i) => (
                <span
                  key={i}
                  className="px-1 py-px text-[11px] border"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-dim)',
                    borderColor: 'var(--border)',
                  }}
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        <ToolCallInspector agentId={selectedAgentId} />
      </div>
    </motion.div>
  );
}
