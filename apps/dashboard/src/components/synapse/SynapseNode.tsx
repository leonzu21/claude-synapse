import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../state/store';
import { COMPLETED_FADE_MS } from '../../hooks/useSynapseLayout';
import { stateLabels } from '../../labels/modeLabels';
import { IconWarning, IconTool } from '../PixelIcons';

const stateColors: Record<string, string> = {
  idle: '#7080a0',
  thinking: '#a855f7',
  working: '#22d65e',
  completed: '#40a8f5',
  error: '#ff4455',
};

const accentColors: Record<string, string> = {
  idle: '#334155',
  thinking: '#7c3aed',
  working: '#16a34a',
  completed: '#2563eb',
  error: '#dc2626',
};

function toolIcon(type: string): string {
  const icons: Record<string, string> = {
    Bash: '\u25b6',
    Read: '\u25cb',
    Write: '\u25a1',
    Edit: '\u25c7',
    Grep: '\u25ce',
    Glob: '\u25cf',
    Agent: '\u25c6',
    Explore: '\u25c8',
    WebSearch: '\u25d0',
    WebFetch: '\u25d1',
  };
  return icons[type] || '\u25a0';
}

function formatDuration(start: number, end: number | null): string {
  const ms = (end || Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export interface SynapseNodeData {
  agentId: string;
  agentName: string;
  agentType: string;
  model: string | null;
  visualState: string;
  currentTool: string | null;
  toolCount: number;
  errorCount: number;
  startedAt: number;
  completedAt: number | null;
  parentId: string | null;
  isRoot: boolean;
  latestDetail: string;
  isSelected: boolean;
  depth: number;
  isActiveLayer: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isOnCriticalPath: boolean;
  isCriticalPathActive: boolean;
  [key: string]: unknown;
}

function formatModel(model: string | null): string {
  if (!model) return 'Claude';
  const m = model.replace(/^claude-/, '');
  const parts = m.split('-');
  if (parts.length >= 3) {
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${name} ${parts.slice(1).join('.')}`;
  }
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Brain SVG watermark for the root node */
function BrainIcon({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left hemisphere */}
      <path
        d="M30 12c-4-1-8 1-10 4-3 4-3 8-1 12-3 1-5 4-5 7 0 4 2 6 5 7-1 3 0 6 2 8 2 3 5 4 8 3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Right hemisphere */}
      <path
        d="M34 12c4-1 8 1 10 4 3 4 3 8 1 12 3 1 5 4 5 7 0 4-2 6-5 7 1 3 0 6-2 8-2 3-5 4-8 3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Brain stem */}
      <path
        d="M32 53v5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Left folds */}
      <path
        d="M22 22c4 1 7-1 8-4M19 32c5 0 8-1 10-4M22 41c3-1 6-2 7-5"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      {/* Right folds */}
      <path
        d="M42 22c-4 1-7-1-8-4M45 32c-5 0-8-1-10-4M42 41c-3-1-6-2-7-5"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      {/* Central fissure */}
      <path
        d="M32 12v41"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.25"
        strokeDasharray="2 3"
      />
    </svg>
  );
}

/** Invisible centered handle — edges radiate from node center */
const centeredHandle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  top: '50%',
  left: '50%',
  right: 'auto',
  bottom: 'auto',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

function SynapseNodeComponent({ data }: NodeProps) {
  const d = data as SynapseNodeData;
  const setSelectedAgent = useAppStore((s) => s.setSelectedAgent);
  const toggleCollapse = useAppStore((s) => s.toggleCollapse);
  const setHoveredNode = useAppStore((s) => s.setHoveredNode);
  const sessionModel = useAppStore((s) => s.sessionMeta.model);
  const color = stateColors[d.visualState] || stateColors.idle;
  const accent = accentColors[d.visualState] || accentColors.idle;
  const labels = stateLabels;
  const isActive = d.visualState === 'thinking' || d.visualState === 'working';
  const isDying = d.visualState === 'completed' || d.visualState === 'error';

  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!isDying || d.isRoot) { setFading(false); return; }
    const timer = setTimeout(() => setFading(true), COMPLETED_FADE_MS);
    return () => clearTimeout(timer);
  }, [isDying, d.isRoot]);

  // Ripple on state change
  const prevStateRef = useRef(d.visualState);
  const [ripple, setRipple] = useState(false);
  useEffect(() => {
    if (d.visualState !== prevStateRef.current) {
      prevStateRef.current = d.visualState;
      setRipple(true);
      const timer = setTimeout(() => setRipple(false), 600);
      return () => clearTimeout(timer);
    }
  }, [d.visualState]);

  // Active layer dimming
  const layerDimmed = !d.isActiveLayer;
  const criticalPathDimmed = d.isCriticalPathActive && !d.isOnCriticalPath;

  const displayName = d.isRoot
    ? formatModel(sessionModel)
    : d.model
      ? formatModel(d.model)
      : d.agentType
        ? `${d.agentName}${d.agentType !== d.agentName ? ':' + d.agentType : ''}`
        : d.agentName;

  return (
    <div
      className="relative cursor-pointer"
      style={{
        opacity: fading ? 0 : criticalPathDimmed ? 0.3 : layerDimmed ? 0.35 : 1,
        transition: 'opacity 0.4s',
      }}
      onClick={() => setSelectedAgent(d.isSelected ? null : d.agentId)}
      onMouseEnter={() => setHoveredNode(d.agentId)}
      onMouseLeave={() => setHoveredNode(null)}
    >
      {/* Centered handles for radial layout */}
      <Handle type="source" position={Position.Right} style={centeredHandle} />
      <Handle type="target" position={Position.Left} style={centeredHandle} />

      {/* Ripple ring */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              border: `2px solid ${accent}`,
              borderRadius: d.isRoot ? '50%' : '2px',
            }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative overflow-hidden"
        style={d.isRoot ? {
          backgroundColor: '#0f172a',
          borderRadius: '50%',
          border: `2px solid ${d.isSelected ? color : d.isOnCriticalPath ? '#f59e0b' : '#1e293b'}`,
          width: 140,
          height: 140,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        } : {
          backgroundColor: '#0f172a',
          borderRadius: '2px',
          border: `1px solid ${d.isSelected ? color : d.isOnCriticalPath ? '#f59e0b' : '#1e293b'}`,
          borderLeft: `3px solid ${accent}`,
          minWidth: 140,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
        }}
        animate={
          fading
            ? { opacity: 0 }
            : isActive
            ? { boxShadow: [`0 0 0px ${accent}40`, `0 0 12px ${accent}60`, `0 0 0px ${accent}40`] }
            : { boxShadow: 'none' }
        }
        transition={
          fading
            ? { duration: 0.5, ease: 'easeOut' }
            : isActive
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
      >
        {/* Brain watermark for root */}
        {d.isRoot && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.5 }}>
            <BrainIcon color={accent} size={110} />
          </div>
        )}

        {/* Header: icon + name + collapse toggle */}
        <div className="flex items-center gap-1.5 mb-1" style={{ justifyContent: d.isRoot ? 'center' : undefined, position: 'relative', zIndex: 1 }}>
          <span style={{ color: accent, fontSize: '10px' }}>
            {toolIcon(d.agentType || d.agentName)}
          </span>
          <span
            style={{
              fontSize: d.isRoot ? '11px' : '10px',
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: d.isRoot ? '80px' : '100px',
              flex: d.isRoot ? undefined : 1,
              textAlign: d.isRoot ? 'center' : undefined,
            }}
          >
            {displayName}
          </span>
          {d.hasChildren && !d.isRoot && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(d.agentId);
              }}
              style={{
                fontSize: '9px',
                color: '#64748b',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '2px',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: 1,
              }}
              title={d.isCollapsed ? 'Expand children' : 'Collapse children'}
            >
              {d.isCollapsed ? '+' : '\u2212'}
            </button>
          )}
        </div>

        {/* Status chip */}
        <div className="flex items-center gap-1.5 mb-1" style={{ justifyContent: d.isRoot ? 'center' : undefined, position: 'relative', zIndex: 1 }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '9px', color, fontWeight: 500 }}>
            {labels[d.visualState] || d.visualState.toUpperCase()}
          </span>
          {!d.isRoot && (
            <span style={{ fontSize: '8px', color: '#64748b', marginLeft: 'auto' }}>
              {formatDuration(d.startedAt, d.completedAt)}
            </span>
          )}
        </div>

        {/* Detail text */}
        {d.latestDetail && !d.isRoot && (
          <div
            style={{
              fontSize: '8px',
              color: '#94a3b8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '160px',
            }}
          >
            {d.latestDetail}
          </div>
        )}

        {/* Stats row — root nodes */}
        {d.isRoot && (
          <div className="flex items-center gap-2 mt-1" style={{ fontSize: '8px', color: '#64748b', position: 'relative', zIndex: 1 }}>
            <span className="flex items-center gap-0.5" title="Tool calls">
              <IconTool color="#64748b" size={10} /> {d.toolCount}
            </span>
            {d.errorCount > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: '#ef4444' }} title="Errors">
                <IconWarning color="#ef4444" size={10} /> {d.errorCount}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Active tool badge */}
      <AnimatePresence>
        {d.currentTool && !fading && (
          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
            style={{
              fontSize: '8px',
              padding: '1px 6px',
              backgroundColor: '#1e1b4b',
              color: '#a78bfa',
              borderRadius: '2px',
              border: '1px solid #3730a3',
              zIndex: 10,
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {d.currentTool}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(SynapseNodeComponent);
