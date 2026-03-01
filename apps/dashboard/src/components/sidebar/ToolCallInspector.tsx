import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../state/store';
import type { ToolCall } from '../../state/store';

const statusColors: Record<ToolCall['status'], string> = {
  running: '#40a8f5',
  completed: '#22d65e',
  error: '#ff4455',
};

function formatDuration(start: number, end: number | null): string {
  const ms = (end || Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function extractFilePath(toolCall: ToolCall): string | null {
  const input = toolCall.toolInput;
  if (!input) return null;
  const name = toolCall.toolName;
  if (name === 'Read' || name === 'Write' || name === 'Edit') {
    return (input.file_path as string) || null;
  }
  if (name === 'Grep' || name === 'Glob') {
    return (input.path as string) || null;
  }
  return null;
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `~/${parts.slice(-2).join('/')}`;
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const filePath = extractFilePath(tc);

  return (
    <div
      className="border-b cursor-pointer"
      style={{ borderColor: 'var(--border)' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <span
          className="w-1 h-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColors[tc.status] }}
        />
        <span
          className="text-[11px] font-bold px-1 py-px uppercase"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
          }}
        >
          {tc.toolName}
        </span>
        {filePath && (
          <span className="text-[9px] truncate" style={{ color: '#60a5fa' }}>
            {shortenPath(filePath)}
          </span>
        )}
        <span className="text-[9px] ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {formatDuration(tc.startedAt, tc.endedAt)}
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="px-1.5 pb-1.5 space-y-1"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {tc.toolInput && (
              <div>
                <span className="text-[9px] uppercase block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  INPUT
                </span>
                <pre
                  className="text-[9px] p-1 overflow-x-auto max-h-24 overflow-y-auto"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-dim)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {JSON.stringify(tc.toolInput, null, 2)}
                </pre>
              </div>
            )}
            {tc.toolResult && (
              <div>
                <span className="text-[9px] uppercase block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  RESULT
                </span>
                <pre
                  className="text-[9px] p-1 overflow-x-auto max-h-24 overflow-y-auto"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: '#22d65e',
                    border: '1px solid var(--border)',
                  }}
                >
                  {tc.toolResult}
                </pre>
              </div>
            )}
            {tc.error && (
              <div>
                <span className="text-[9px] uppercase block mb-0.5" style={{ color: '#ff4455' }}>
                  ERROR
                </span>
                <pre
                  className="text-[9px] p-1 overflow-x-auto max-h-24 overflow-y-auto"
                  style={{
                    backgroundColor: '#1a0e0e',
                    color: '#ff4455',
                    border: '1px solid #441111',
                  }}
                >
                  {tc.error}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ToolCallInspector({ agentId }: { agentId: string }) {
  const toolCalls = useAppStore((s) => s.toolCalls);

  const agentToolCalls = Object.values(toolCalls)
    .filter((tc) => tc.parentAgentId === agentId)
    .sort((a, b) => a.startedAt - b.startedAt);

  if (agentToolCalls.length === 0) return null;

  const label = 'TOOL CALL HISTORY';

  return (
    <div className="mt-1.5">
      <span
        className="text-[11px] font-bold uppercase tracking-wider block px-1 mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label} ({agentToolCalls.length})
      </span>
      <div className="max-h-48 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
        {agentToolCalls.map((tc) => (
          <ToolCallItem key={tc.agentId} tc={tc} />
        ))}
      </div>
    </div>
  );
}
