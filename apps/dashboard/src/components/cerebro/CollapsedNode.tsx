import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useAppStore } from '../../state/store';

export interface CollapsedNodeData {
  agentId: string;
  parentAgentId: string;
  childCount: number;
  completedCount: number;
  errorCount: number;
  latestDetail: string;
  isOnCriticalPath: boolean;
  isCriticalPathActive: boolean;
  [key: string]: unknown;
}

function CollapsedNodeComponent({ data }: NodeProps) {
  const d = data as CollapsedNodeData;
  const toggleCollapse = useAppStore((s) => s.toggleCollapse);
  const criticalPathDimmed = d.isCriticalPathActive && !d.isOnCriticalPath;

  const summary = `${d.childCount} node${d.childCount !== 1 ? 's' : ''}`;
  const detail = [
    d.completedCount > 0 ? `${d.completedCount} done` : null,
    d.errorCount > 0 ? `${d.errorCount} err` : null,
  ].filter(Boolean).join(', ');

  return (
    <div
      className="relative cursor-pointer"
      style={{
        opacity: criticalPathDimmed ? 0.3 : 1,
        transition: 'opacity 0.4s',
      }}
      onClick={() => toggleCollapse(d.parentAgentId)}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#334155', border: 'none', width: 6, height: 6 }}
      />

      {/* Stacked rectangles effect */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          right: '-4px',
          bottom: '-4px',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '2px',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: '2px',
          right: '-2px',
          bottom: '-2px',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '2px',
          opacity: 0.7,
        }}
      />

      <div
        style={{
          position: 'relative',
          backgroundColor: '#0f172a',
          borderRadius: '2px',
          border: `1px solid ${d.isOnCriticalPath ? '#f59e0b' : '#334155'}`,
          borderLeft: '3px solid #475569',
          minWidth: 100,
          padding: '8px 10px',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>
          {summary}
        </div>
        {detail && (
          <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>
            {detail}
          </div>
        )}
        <div style={{ fontSize: '8px', color: '#475569', marginTop: '4px' }}>
          click to expand
        </div>
      </div>
    </div>
  );
}

export default memo(CollapsedNodeComponent);
