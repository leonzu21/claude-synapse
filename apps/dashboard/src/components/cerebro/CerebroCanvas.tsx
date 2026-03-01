import { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CerebroNode, { type CerebroNodeData } from './CerebroNode';
import CollapsedNode from './CollapsedNode';
import NeuralLink from './NeuralLink';
import { useCerebroLayout } from '../../hooks/useCerebroLayout';
import { useAppStore } from '../../state/store';
import { headerLabels } from '../../labels/modeLabels';

const nodeTypes = { cerebro: CerebroNode, collapsed: CollapsedNode };
const edgeTypes = { neural: NeuralLink };

function CerebroFlowInner() {
  const { positions, tethers } = useCerebroLayout();
  const agents = useAppStore((s) => s.agents);
  const hoveredNodeId = useAppStore((s) => s.hoveredNodeId);
  const collapsedAgents = useAppStore((s) => s.collapsedAgents);
  const { fitView } = useReactFlow();
  const prevCountRef = useRef(0);

  // Compute critical path from hovered node to root
  const criticalPath = useMemo(() => {
    if (!hoveredNodeId) return null;
    const pathIds = new Set<string>();
    let current = hoveredNodeId;
    // Walk up parentId chain
    while (current) {
      pathIds.add(current);
      const agent = agents[current];
      if (!agent || !agent.parentId) break;
      current = agent.parentId;
    }
    return pathIds;
  }, [hoveredNodeId, agents]);

  const isCriticalPathActive = criticalPath !== null;

  // Build a set of which agents have children (for collapse button)
  const agentsWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const a of Object.values(agents)) {
      if (a.parentId) set.add(a.parentId);
    }
    return set;
  }, [agents]);

  // Critical path edge set (edges between consecutive critical path nodes)
  const criticalEdgeIds = useMemo(() => {
    if (!criticalPath) return null;
    const edgeIds = new Set<string>();
    for (const t of tethers) {
      if (criticalPath.has(t.sourceId) && criticalPath.has(t.targetId)) {
        edgeIds.add(t.id);
      }
    }
    return edgeIds;
  }, [criticalPath, tethers]);

  // Convert layout positions to xyflow nodes
  const nodes: Node[] = useMemo(() => {
    return positions.map((pos) => {
      const isCollapsedSynthetic = pos.agent.type === 'collapsed';

      if (isCollapsedSynthetic) {
        // Parse collapsed agent info from the synthetic agent
        const parentAgentId = pos.agent.parentId || '';
        // Get child stats from the latestDetail or from the agent fields
        return {
          id: pos.agent.id,
          type: 'collapsed',
          position: { x: pos.x, y: pos.y },
          data: {
            agentId: pos.agent.id,
            parentAgentId,
            childCount: pos.agent.toolCount, // repurposed for childCount in synthetic node
            completedCount: 0,
            errorCount: pos.agent.errorCount,
            latestDetail: pos.latestDetail,
            isOnCriticalPath: criticalPath?.has(pos.agent.id) ?? false,
            isCriticalPathActive,
          },
        };
      }

      return {
        id: pos.agent.id,
        type: 'cerebro',
        position: { x: pos.x, y: pos.y },
        data: {
          agentId: pos.agent.id,
          agentName: pos.agent.name,
          agentType: pos.agent.type,
          model: pos.agent.model,
          visualState: pos.agent.visualState,
          currentTool: pos.agent.currentTool,
          toolCount: pos.agent.toolCount,
          errorCount: pos.agent.errorCount,
          startedAt: pos.agent.startedAt,
          completedAt: pos.agent.completedAt,
          parentId: pos.agent.parentId,
          isRoot: pos.isRoot,
          latestDetail: pos.latestDetail,
          isSelected: pos.isSelected,
          depth: pos.depth,
          isActiveLayer: pos.isActiveLayer,
          hasChildren: agentsWithChildren.has(pos.agent.id),
          isCollapsed: collapsedAgents.has(pos.agent.id),
          isOnCriticalPath: criticalPath?.has(pos.agent.id) ?? false,
          isCriticalPathActive,
        } satisfies CerebroNodeData,
      };
    });
  }, [positions, criticalPath, isCriticalPathActive, agentsWithChildren, collapsedAgents]);

  // Convert tethers to xyflow edges
  const edges: Edge[] = useMemo(() => {
    return tethers.map((t) => ({
      id: t.id,
      source: t.sourceId,
      target: t.targetId,
      type: 'neural',
      data: {
        animated: t.animated,
        targetState: t.targetState,
        edgeType: t.edgeType,
        weight: t.weight,
        isOnCriticalPath: criticalEdgeIds?.has(t.id) ?? false,
        isCriticalPathActive,
      },
    }));
  }, [tethers, criticalEdgeIds, isCriticalPathActive]);

  // Auto fitView when nodes change count (new agents appear)
  const nodeCount = nodes.length;
  useEffect(() => {
    if (nodeCount > 0 && nodeCount !== prevCountRef.current) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
      }, 50);
      prevCountRef.current = nodeCount;
      return () => clearTimeout(timer);
    }
  }, [nodeCount, fitView]);

  const isEmpty = Object.keys(agents).length === 0;
  const labels = headerLabels;

  const onNodeClick = useCallback(() => {
    // Node click handled inside CerebroNode
  }, []);

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="mb-3 opacity-30 flex justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3 C8 3 5 7 5 12 S8 21 12 21" />
                <path d="M12 3 C16 3 19 7 19 12 S16 21 12 21" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
              {labels.emptyTitle}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px' }}>
              {labels.emptySubtitle}
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'transparent' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1a2030"
        />
      </ReactFlow>
    </div>
  );
}

export default function CerebroCanvas() {
  return (
    <ReactFlowProvider>
      <CerebroFlowInner />
    </ReactFlowProvider>
  );
}
