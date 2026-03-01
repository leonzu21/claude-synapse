import { useMemo, useState, useEffect } from 'react';
import type { AgentNode } from '@synapse-tools/protocol';
import { useAppStore } from '../state/store';
import type { LayoutNodeData, TetherData, LayoutResult } from '../types/layout';

/** How long a completed node stays fully visible before fading */
export const COMPLETED_FADE_MS = 1500;
/** Extra buffer so the layout keeps the node while the opacity animation plays */
const LAYOUT_BUFFER_MS = 200;
const STALE_WORKING_MS = 60000;

// Layout constants — left-to-right layered graph
const LAYER_GAP_X = 260;
const NODE_GAP_Y = 100;

// Tool types that classify as tool_call edges
const TOOL_TYPES = new Set([
  'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob',
  'WebSearch', 'WebFetch', 'NotebookEdit',
]);

// Agent-like types that classify as sub_agent edges
const AGENT_TYPES = new Set(['Agent', 'Explore', 'Plan', 'general-purpose']);

function classifyEdgeType(child: AgentNode, childMap: Record<string, AgentNode[]>): 'tool_call' | 'sub_agent' {
  if (AGENT_TYPES.has(child.type) || AGENT_TYPES.has(child.name)) return 'sub_agent';
  if ((childMap[child.id] || []).length > 0) return 'sub_agent';
  if (TOOL_TYPES.has(child.type) || TOOL_TYPES.has(child.name)) return 'tool_call';
  return 'tool_call';
}

export function useCerebroLayout(): LayoutResult {
  const agents = useAppStore((s) => s.agents);
  const events = useAppStore((s) => s.events);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const collapsedAgents = useAppStore((s) => s.collapsedAgents);

  // Tick for periodic re-eval (removing completed nodes from layout)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const now = Date.now();
    const agentList = Object.values(agents);
    const positions: LayoutNodeData[] = [];
    const tethers: TetherData[] = [];

    // Detail map from events
    const detailMap: Record<string, string> = {};
    for (const evt of events) {
      if (evt.payload.message) {
        detailMap[evt.agentId] = evt.payload.message;
      }
    }

    // Filter to visible agents only
    const layoutKeepMs = COMPLETED_FADE_MS + LAYOUT_BUFFER_MS;
    const visibleAgents = agentList.filter((a) => {
      if (!a.parentId) return true;
      if (a.visualState === 'completed' && a.completedAt) {
        return now - a.completedAt < layoutKeepMs;
      }
      if (a.visualState === 'error' && a.lastEventAt) {
        return now - a.lastEventAt < layoutKeepMs;
      }
      if (
        (a.visualState === 'working' || a.visualState === 'thinking') &&
        now - a.lastEventAt > STALE_WORKING_MS
      ) {
        return false;
      }
      return true;
    });

    const visibleSet = new Set(visibleAgents.map((a) => a.id));
    const rootAgents = visibleAgents.filter((a) => !a.parentId);
    const childMap: Record<string, AgentNode[]> = {};
    for (const agent of visibleAgents) {
      if (agent.parentId && visibleSet.has(agent.parentId)) {
        if (!childMap[agent.parentId]) childMap[agent.parentId] = [];
        childMap[agent.parentId].push(agent);
      }
    }

    // --- Pass 1: BFS from roots to assign depth, respecting collapse ---
    const depthMap = new Map<string, number>();
    const layerMap = new Map<number, AgentNode[]>();
    const queue: { agent: AgentNode; depth: number }[] = [];

    for (const root of rootAgents) {
      queue.push({ agent: root, depth: 0 });
    }

    while (queue.length > 0) {
      const { agent, depth } = queue.shift()!;
      if (depthMap.has(agent.id)) continue;
      depthMap.set(agent.id, depth);

      if (!layerMap.has(depth)) layerMap.set(depth, []);
      layerMap.get(depth)!.push(agent);

      // If collapsed, skip children (they'll be handled as a synthetic node later)
      if (collapsedAgents.has(agent.id)) continue;

      const children = childMap[agent.id] || [];
      for (const child of children) {
        if (!depthMap.has(child.id)) {
          queue.push({ agent: child, depth: depth + 1 });
        }
      }
    }

    // --- Determine active depths ---
    const activeDepths = new Set<number>();
    for (const [id, depth] of depthMap) {
      const a = agents[id];
      if (a && (a.visualState === 'thinking' || a.visualState === 'working')) {
        activeDepths.add(depth);
      }
    }
    const hasAnyActive = activeDepths.size > 0;

    // --- Pass 2: Position nodes left-to-right ---
    const sortedDepths = Array.from(layerMap.keys()).sort((a, b) => a - b);

    for (const depth of sortedDepths) {
      const layerNodes = layerMap.get(depth)!;
      const x = depth * LAYER_GAP_X;
      const totalHeight = (layerNodes.length - 1) * NODE_GAP_Y;
      const startY = -totalHeight / 2;

      for (let i = 0; i < layerNodes.length; i++) {
        const agent = layerNodes[i];
        const y = startY + i * NODE_GAP_Y;
        const isActiveLayer = hasAnyActive ? activeDepths.has(depth) : true;

        // Check if this is a collapsed node with children
        const isCollapsed = collapsedAgents.has(agent.id) && (childMap[agent.id] || []).length > 0;

        if (isCollapsed) {
          // Gather collapsed children stats
          const descendants: AgentNode[] = [];
          const descQueue = [...(childMap[agent.id] || [])];
          while (descQueue.length > 0) {
            const desc = descQueue.shift()!;
            descendants.push(desc);
            const descChildren = childMap[desc.id] || [];
            descQueue.push(...descChildren);
          }
          const childCount = descendants.length;
          const completedCount = descendants.filter((d) => d.visualState === 'completed').length;
          const errorCount = descendants.filter((d) => d.visualState === 'error').length;

          // Add the parent node itself
          positions.push({
            agent,
            x,
            y,
            isSelected: agent.id === selectedAgentId,
            latestDetail: detailMap[agent.id] || '',
            isRoot: agent.parentId === null,
            phaseOffset: 0,
            depth,
            isActiveLayer,
          });

          // Add synthetic collapsed node at next depth
          const collapsedX = x + LAYER_GAP_X;
          const syntheticAgent: AgentNode = {
            id: `${agent.id}__collapsed`,
            name: 'collapsed',
            type: 'collapsed',
            model: null,
            parentId: agent.id,
            sessionId: agent.sessionId,
            visualState: errorCount > 0 ? 'error' : completedCount === childCount ? 'completed' : 'working',
            currentTool: null,
            toolCount: childCount,
            errorCount,
            startedAt: agent.startedAt,
            completedAt: null,
            lastEventAt: agent.lastEventAt,
          };

          positions.push({
            agent: syntheticAgent,
            x: collapsedX,
            y,
            isSelected: false,
            latestDetail: `${childCount} nodes, ${completedCount} done${errorCount > 0 ? `, ${errorCount} err` : ''}`,
            isRoot: false,
            phaseOffset: 0,
            depth: depth + 1,
            isActiveLayer,
          });

          // Tether from parent to collapsed
          tethers.push({
            id: `${agent.id}__${syntheticAgent.id}`,
            sourceId: agent.id,
            targetId: syntheticAgent.id,
            fromX: x,
            fromY: y,
            toX: collapsedX,
            toY: y,
            animated: false,
            targetState: syntheticAgent.visualState,
            edgeType: 'sub_agent',
            weight: childCount,
          });
        } else {
          positions.push({
            agent,
            x,
            y,
            isSelected: agent.id === selectedAgentId,
            latestDetail: detailMap[agent.id] || '',
            isRoot: agent.parentId === null,
            phaseOffset: 0,
            depth,
            isActiveLayer,
          });
        }
      }
    }

    // --- Build tethers for non-collapsed edges ---
    for (const agent of visibleAgents) {
      if (collapsedAgents.has(agent.id)) continue; // collapsed parent's children are handled above
      const children = childMap[agent.id] || [];
      for (const child of children) {
        if (!depthMap.has(child.id)) continue;
        const parentPos = positions.find((p) => p.agent.id === agent.id);
        const childPos = positions.find((p) => p.agent.id === child.id);
        if (!parentPos || !childPos) continue;

        tethers.push({
          id: `${agent.id}__${child.id}`,
          sourceId: agent.id,
          targetId: child.id,
          fromX: parentPos.x,
          fromY: parentPos.y,
          toX: childPos.x,
          toY: childPos.y,
          animated: child.visualState === 'thinking' || child.visualState === 'working',
          targetState: child.visualState,
          edgeType: classifyEdgeType(child, childMap),
          weight: Math.max(1, child.toolCount),
        });
      }
    }

    // Bounding box
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const pos of positions) {
      const hw = 100;
      const hh = 60;
      if (pos.x - hw < minX) minX = pos.x - hw;
      if (pos.x + hw > maxX) maxX = pos.x + hw;
      if (pos.y - hh < minY) minY = pos.y - hh;
      if (pos.y + hh > maxY) maxY = pos.y + hh;
    }

    const layoutWidth = Math.max(maxX - minX, 200);
    const layoutHeight = Math.max(maxY - minY, 200);

    return { positions, tethers, layoutWidth, layoutHeight };
  }, [agents, events, selectedAgentId, collapsedAgents, tick]);
}
