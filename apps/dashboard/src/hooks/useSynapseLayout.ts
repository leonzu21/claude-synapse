import { useMemo, useState, useEffect } from 'react';
import type { AgentNode } from '@synapse-tools/protocol';
import { useAppStore } from '../state/store';
import type { LayoutNodeData, TetherData, LayoutResult } from '../types/layout';

/** How long a completed node stays fully visible before fading */
export const COMPLETED_FADE_MS = 1500;
/** Extra buffer so the layout keeps the node while the opacity animation plays */
const LAYOUT_BUFFER_MS = 200;
const STALE_WORKING_MS = 60000;

// Radial layout constants
const RING_GAP = 220; // distance between concentric rings
const MIN_ARC_GAP = 90; // minimum spacing between nodes on same ring (px)

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

/** Count leaves in a subtree (for proportional angular allocation). */
function countLeaves(
  agentId: string,
  childMap: Record<string, AgentNode[]>,
  collapsedAgents: Set<string>,
): number {
  if (collapsedAgents.has(agentId)) return 1; // collapsed = treat as leaf
  const children = childMap[agentId] || [];
  if (children.length === 0) return 1;
  let sum = 0;
  for (const child of children) {
    sum += countLeaves(child.id, childMap, collapsedAgents);
  }
  return sum;
}

export function useSynapseLayout(): LayoutResult {
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

    // --- Determine active depths ---
    const depthMap = new Map<string, number>();
    const activeDepths = new Set<number>();

    // --- Radial layout: recursively position nodes ---
    // Each node gets an angular span proportional to its subtree leaf count.
    // Root sits at the center; children radiate outward.

    const posMap = new Map<string, { x: number; y: number }>();

    function layoutSubtree(
      agent: AgentNode,
      depth: number,
      startAngle: number,
      endAngle: number,
      parentAngle: number,
    ) {
      depthMap.set(agent.id, depth);
      const a = agents[agent.id];
      if (a && (a.visualState === 'thinking' || a.visualState === 'working')) {
        activeDepths.add(depth);
      }

      if (depth === 0) {
        // Root at center
        posMap.set(agent.id, { x: 0, y: 0 });
      } else {
        const radius = depth * RING_GAP;
        const midAngle = (startAngle + endAngle) / 2;
        const x = Math.cos(midAngle) * radius;
        const y = Math.sin(midAngle) * radius;
        posMap.set(agent.id, { x, y });
      }

      // If collapsed, add synthetic collapsed node and stop
      const isCollapsed = collapsedAgents.has(agent.id) && (childMap[agent.id] || []).length > 0;
      if (isCollapsed) return;

      // Layout children
      const children = childMap[agent.id] || [];
      if (children.length === 0) return;

      // Calculate total leaf weight for proportional angle allocation
      const totalLeaves = children.reduce(
        (sum, c) => sum + countLeaves(c.id, childMap, collapsedAgents),
        0,
      );

      // For depth 0→1 (root's children), use full circle
      let spanStart = startAngle;
      const totalSpan = endAngle - startAngle;

      for (const child of children) {
        const leaves = countLeaves(child.id, childMap, collapsedAgents);
        const childSpan = (leaves / totalLeaves) * totalSpan;
        const childEnd = spanStart + childSpan;
        const midAngle = (spanStart + childEnd) / 2;

        layoutSubtree(child, depth + 1, spanStart, childEnd, midAngle);
        spanStart = childEnd;
      }
    }

    // Layout from each root (typically just one)
    for (let i = 0; i < rootAgents.length; i++) {
      const root = rootAgents[i];
      const rootStart = (i / rootAgents.length) * Math.PI * 2 - Math.PI / 2;
      const rootEnd = ((i + 1) / rootAgents.length) * Math.PI * 2 - Math.PI / 2;
      layoutSubtree(root, 0, rootStart, rootEnd, 0);
    }

    const hasAnyActive = activeDepths.size > 0;

    // --- Build position nodes ---
    for (const agent of visibleAgents) {
      const pos = posMap.get(agent.id);
      if (!pos) continue;

      const depth = depthMap.get(agent.id) || 0;
      const isActiveLayer = true; // radial layout: no ring-based dimming
      const isCollapsed = collapsedAgents.has(agent.id) && (childMap[agent.id] || []).length > 0;

      if (isCollapsed) {
        // Add the parent node itself
        positions.push({
          agent,
          x: pos.x,
          y: pos.y,
          isSelected: agent.id === selectedAgentId,
          latestDetail: detailMap[agent.id] || '',
          isRoot: agent.parentId === null,
          phaseOffset: 0,
          depth,
          isActiveLayer,
        });

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

        // Position collapsed node further out from parent
        const parentAngle = Math.atan2(pos.y, pos.x) || 0;
        const collapsedRadius = (depth + 1) * RING_GAP;
        const cx = depth === 0 ? RING_GAP : Math.cos(parentAngle) * collapsedRadius;
        const cy = depth === 0 ? 0 : Math.sin(parentAngle) * collapsedRadius;

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
          x: cx,
          y: cy,
          isSelected: false,
          latestDetail: `${childCount} nodes, ${completedCount} done${errorCount > 0 ? `, ${errorCount} err` : ''}`,
          isRoot: false,
          phaseOffset: 0,
          depth: depth + 1,
          isActiveLayer,
        });

        tethers.push({
          id: `${agent.id}__${syntheticAgent.id}`,
          sourceId: agent.id,
          targetId: syntheticAgent.id,
          fromX: pos.x,
          fromY: pos.y,
          toX: cx,
          toY: cy,
          animated: false,
          targetState: syntheticAgent.visualState,
          edgeType: 'sub_agent',
          weight: childCount,
        });
      } else {
        positions.push({
          agent,
          x: pos.x,
          y: pos.y,
          isSelected: agent.id === selectedAgentId,
          latestDetail: detailMap[agent.id] || '',
          isRoot: agent.parentId === null,
          phaseOffset: 0,
          depth,
          isActiveLayer,
        });
      }
    }

    // --- Build tethers for non-collapsed edges ---
    for (const agent of visibleAgents) {
      if (collapsedAgents.has(agent.id)) continue;
      const children = childMap[agent.id] || [];
      for (const child of children) {
        if (!depthMap.has(child.id)) continue;
        const parentPos = posMap.get(agent.id);
        const childPos = posMap.get(child.id);
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
