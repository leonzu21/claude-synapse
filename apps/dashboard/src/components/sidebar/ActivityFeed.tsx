import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentEvent } from '@synapse-tools/protocol';
import { useAppStore } from '../../state/store';
import { stateColors } from '../../animations/variants';
import { eventLabels, feedLabels } from '../../labels/modeLabels';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** System-level events (compaction, prompts, notifications) get distinct styling. */
function isSystemEvent(event: AgentEvent): boolean {
  return (
    event.type === 'context_compact' ||
    event.type === 'user_prompt' ||
    event.type === 'notification' ||
    event.type === 'session_end' ||
    (event.type === 'session_meta' && !!event.payload.message)
  );
}

const systemEventColors: Record<string, string> = {
  context_compact: '#ffaa22',
  user_prompt: '#06b6d4',
  notification: '#a78bfa',
  session_end: '#7080a0',
  session_meta: '#a855f7',
};

const systemEventIcons: Record<string, string> = {
  context_compact: '\u21bb',
  user_prompt: '\u25b8',
  notification: '\u25c6',
  session_end: '\u25a0',
  session_meta: '\u25cf',
};

function EventItem({ event }: { event: AgentEvent }) {
  // Skip raw session_meta without a message (just metadata updates)
  if (event.type === 'session_meta' && !event.payload.message) return null;
  // Skip session_start system noise
  if (event.agentId === 'system' && event.type === 'session_start') return null;

  if (isSystemEvent(event)) {
    const color = systemEventColors[event.type] || '#7080a0';
    const icon = systemEventIcons[event.type] || '\u2022';

    return (
      <motion.div
        className="px-2 py-1.5 border-b cursor-default"
        style={{ borderColor: 'var(--border)' }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.1, ease: 'linear' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] flex-shrink-0" style={{ color }}>
            {icon}
          </span>
          <span className="text-[12px] font-bold truncate uppercase" style={{ color }}>
            {event.agentName}
          </span>
          <span className="text-[11px] ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {formatTime(event.timestamp)}
          </span>
        </div>
        {event.payload.message && (
          <div className="ml-3 mt-0.5">
            <span className="text-[11px] truncate block" style={{ color: 'var(--text-muted)' }}>
              {event.payload.message}
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  // Regular agent events
  const isError =
    event.type === 'agent_error' || event.type === 'agent_tool_error';
  const isComplete = event.type === 'agent_completed';
  const color = isError
    ? stateColors.error
    : isComplete
      ? stateColors.completed
      : event.type === 'agent_tool_start' || event.type === 'agent_spawned'
        ? stateColors.working
        : stateColors.thinking;

  const label = event.agentName;
  const modeLabel = eventLabels[event.type];
  const detail =
    event.payload.message ||
    event.payload.error ||
    '';

  return (
    <motion.div
      className="px-2 py-1.5 border-b cursor-default"
      style={{ borderColor: 'var(--border)' }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.1, ease: 'linear' }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[12px] font-bold truncate uppercase" style={{ color: 'var(--text-dim)' }}>
          {label}
        </span>
        {modeLabel && (
          <span className="text-[11px] truncate" style={{ color }}>
            {modeLabel}
          </span>
        )}
        <span className="text-[11px] ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {formatTime(event.timestamp)}
        </span>
      </div>
      {detail && (
        <div className="ml-3 mt-0.5">
          <span className="text-[11px] truncate block" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default function ActivityFeed() {
  const events = useAppStore((s) => s.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}
      >
        <span
          className="text-[13px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--text-dim)' }}
        >
          {feedLabels.title}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {events.length} {feedLabels.countSuffix}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <div className="p-3 text-center text-[12px] uppercase" style={{ color: 'var(--text-muted)' }}>
            {feedLabels.empty}
          </div>
        )}
      </div>
    </div>
  );
}
