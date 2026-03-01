import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../state/store';
import { sessionLabels } from '../../labels/modeLabels';
import SessionDiffSummary from '../sidebar/SessionDiffSummary';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function shortPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `~/${parts.slice(-2).join('/')}`;
}

const permissionLabels: Record<string, string> = {
  default: 'DEFAULT',
  plan: 'PLAN MODE',
  acceptEdits: 'ACCEPT EDITS',
  dontAsk: "DON'T ASK",
  bypassPermissions: 'BYPASS',
};

function Pill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1 text-[12px] whitespace-nowrap flex-shrink-0">
      <span style={{ color: 'var(--text-muted)' }}>{label.toUpperCase()}</span>
      <span className={`font-bold ${color || ''}`} style={color ? undefined : { color: 'var(--text-dim)' }}>
        {value}
      </span>
    </div>
  );
}

function Separator() {
  return <div className="w-px h-2.5 flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />;
}

export default function SessionInfo() {
  const meta = useAppStore((s) => s.sessionMeta);
  const events = useAppStore((s) => s.events);
  const agents = useAppStore((s) => s.agents);
  const labels = sessionLabels;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const agentList = Object.values(agents);
    const toolCalls = agentList.reduce((sum, a) => sum + a.toolCount, 0);
    const errors = agentList.reduce((sum, a) => sum + a.errorCount, 0);
    const duration = meta.startedAt ? Date.now() - meta.startedAt : 0;
    return { toolCalls, errors, duration };
  }, [agents, meta.startedAt, tick]);

  const hasData = events.length > 0;
  if (!hasData) return null;

  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1 flex-wrap"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, ease: 'linear' }}
    >
      {meta.model && (
        <>
          <Pill label="Model" value={meta.model} color="text-violet-400" />
          <Separator />
        </>
      )}

      {meta.permissionMode && (
        <Pill
          label="Mode"
          value={permissionLabels[meta.permissionMode] || meta.permissionMode.toUpperCase()}
          color={meta.permissionMode === 'plan' ? 'text-amber-400' : undefined}
        />
      )}

      {meta.cwd && (
        <Pill label="CWD" value={shortPath(meta.cwd)} />
      )}

      <Separator />

      {stats.duration > 0 && (
        <Pill label="Duration" value={formatDuration(stats.duration)} />
      )}

      <Pill label={labels.events} value={String(events.length)} />

      {stats.toolCalls > 0 && (
        <Pill label={labels.tools} value={String(stats.toolCalls)} />
      )}

      {meta.promptCount > 0 && (
        <Pill label={labels.prompts} value={String(meta.promptCount)} />
      )}

      {stats.errors > 0 && (
        <Pill label={labels.errors} value={String(stats.errors)} color="text-red-400" />
      )}

      {meta.transcriptSize && (
        <>
          <Separator />
          <Pill label="Transcript" value={meta.transcriptSize} />
        </>
      )}

      {meta.compactCount > 0 && (
        <>
          <Separator />
          <div className="flex items-center gap-1 text-[12px] flex-shrink-0 whitespace-nowrap">
            <span style={{ color: 'var(--text-muted)' }}>COMPACTIONS</span>
            <span className="font-bold text-amber-400">{meta.compactCount}</span>
            {meta.lastCompactTrigger && (
              <span style={{ color: 'var(--text-muted)' }}>
                ({meta.lastCompactTrigger})
              </span>
            )}
          </div>
          <Pill
            label="Turns since"
            value={String(meta.turnsSinceCompact)}
            color="text-amber-400"
          />
        </>
      )}

      <Separator />
      <div className="relative">
        <SessionDiffSummary />
      </div>
    </motion.div>
  );
}
