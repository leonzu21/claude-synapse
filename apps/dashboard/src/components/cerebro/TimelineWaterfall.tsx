import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../state/store';
import type { ToolCall } from '../../state/store';
import type { AgentNode } from '@synapse-tools/protocol';

const LANE_HEIGHT = 28;
const BLOCK_HEIGHT = 20;
const SUB_LANE_HEIGHT = 22;
const HEADER_HEIGHT = 24;
const LEFT_GUTTER = 120;
const MIN_BLOCK_WIDTH = 4;
const TICK_HEIGHT = 16;

const statusColors: Record<string, string> = {
  completed: '#22d65e',
  error: '#ff4455',
  running: '#40a8f5',
  idle: '#475569',
};

function formatTickTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface LaneData {
  agent: AgentNode;
  toolCalls: ToolCall[];
  subLanes: LaneData[];
}

export default function TimelineWaterfall() {
  const agents = useAppStore((s) => s.agents);
  const toolCalls = useAppStore((s) => s.toolCalls);
  const sessionMeta = useAppStore((s) => s.sessionMeta);
  const setSelectedAgent = useAppStore((s) => s.setSelectedAgent);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pixelsPerSecondRef = useRef(80);

  // Derive time boundaries
  const { sessionStart, sessionEnd, lanes } = useMemo(() => {
    const agentList = Object.values(agents);
    const tcList = Object.values(toolCalls);

    const start = sessionMeta.startedAt || Math.min(...agentList.map((a) => a.startedAt), Date.now());
    const now = Date.now();
    const end = sessionMeta.endedAt || now;

    // Root agents = no parent
    const rootAgents = agentList.filter((a) => !a.parentId);
    // Non-tool sub-agents (have parent, not tool calls)
    const subAgents = agentList.filter((a) => a.parentId && !tcList.find((tc) => tc.agentId === a.id));

    const buildLane = (agent: AgentNode): LaneData => {
      const myToolCalls = tcList
        .filter((tc) => tc.parentAgentId === agent.id)
        .sort((a, b) => a.startedAt - b.startedAt);
      const mySubs = subAgents
        .filter((a) => a.parentId === agent.id)
        .map(buildLane);
      return { agent, toolCalls: myToolCalls, subLanes: mySubs };
    };

    const lanes = rootAgents.map(buildLane);
    return { sessionStart: start, sessionEnd: end, lanes };
  }, [agents, toolCalls, sessionMeta]);

  const duration = sessionEnd - sessionStart;

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [toolCalls]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.85 : 1.18;
      pixelsPerSecondRef.current = Math.max(10, Math.min(500, pixelsPerSecondRef.current * delta));
      // Force re-render via container resize trick
      if (containerRef.current) {
        containerRef.current.style.setProperty('--pps', String(pixelsPerSecondRef.current));
      }
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  if (lanes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[14px] uppercase" style={{ color: 'var(--text-muted)' }}>
        No events yet
      </div>
    );
  }

  const pps = pixelsPerSecondRef.current;
  const timelineWidth = Math.max(400, (duration / 1000) * pps);

  // Calculate total height
  function countLaneHeight(lane: LaneData): number {
    let h = LANE_HEIGHT;
    for (const sub of lane.subLanes) {
      h += countLaneHeight(sub);
    }
    return h;
  }
  const totalHeight = lanes.reduce((sum, l) => sum + countLaneHeight(l), 0) + HEADER_HEIGHT;

  // Render tick marks
  const ticks: { x: number; label: string }[] = [];
  const tickInterval = duration > 300000 ? 60000 : duration > 30000 ? 10000 : duration > 5000 ? 1000 : 200;
  for (let t = 0; t <= duration; t += tickInterval) {
    ticks.push({
      x: LEFT_GUTTER + (t / 1000) * pps,
      label: formatTickTime(t),
    });
  }

  function renderLane(lane: LaneData, yOffset: number): React.JSX.Element[] {
    const elements: React.JSX.Element[] = [];
    const laneY = yOffset;

    // Lane label
    elements.push(
      <g key={`label-${lane.agent.id}`}>
        <text
          x={4}
          y={laneY + LANE_HEIGHT / 2 + 3}
          fill="var(--text-dim)"
          fontSize={12}
          fontWeight="bold"
          fontFamily="monospace"
          style={{ textTransform: 'uppercase' as const }}
        >
          {lane.agent.name.slice(0, 14)}
        </text>
      </g>,
    );

    // Lane background
    elements.push(
      <rect
        key={`bg-${lane.agent.id}`}
        x={LEFT_GUTTER}
        y={laneY}
        width={timelineWidth}
        height={LANE_HEIGHT}
        fill="var(--bg-primary)"
        opacity={0.3}
      />,
    );

    // Lane separator
    elements.push(
      <line
        key={`sep-${lane.agent.id}`}
        x1={0}
        y1={laneY + LANE_HEIGHT}
        x2={LEFT_GUTTER + timelineWidth}
        y2={laneY + LANE_HEIGHT}
        stroke="var(--border)"
        strokeWidth={0.5}
      />,
    );

    // Tool call blocks
    for (const tc of lane.toolCalls) {
      const startX = LEFT_GUTTER + ((tc.startedAt - sessionStart) / 1000) * pps;
      const endTime = tc.endedAt || Date.now();
      const blockWidth = Math.max(MIN_BLOCK_WIDTH, ((endTime - tc.startedAt) / 1000) * pps);
      const color = statusColors[tc.status] || statusColors.idle;

      elements.push(
        <g
          key={`tc-${tc.agentId}`}
          className="cursor-pointer"
          onClick={() => setSelectedAgent(tc.agentId)}
        >
          <rect
            x={startX}
            y={laneY + (LANE_HEIGHT - BLOCK_HEIGHT) / 2}
            width={blockWidth}
            height={BLOCK_HEIGHT}
            fill={color}
            opacity={0.8}
            rx={2}
          />
          {blockWidth > 30 && (
            <text
              x={startX + 3}
              y={laneY + LANE_HEIGHT / 2 + 3}
              fill="#000"
              fontSize={11}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {tc.toolName}
            </text>
          )}
        </g>,
      );
    }

    // Sub-lanes
    let subY = laneY + LANE_HEIGHT;
    for (const sub of lane.subLanes) {
      const subElements = renderSubLane(sub, subY);
      elements.push(...subElements);
      subY += countLaneHeight(sub);
    }

    return elements;
  }

  function renderSubLane(lane: LaneData, yOffset: number): React.JSX.Element[] {
    const elements: React.JSX.Element[] = [];

    // Indented label
    elements.push(
      <g key={`sub-label-${lane.agent.id}`}>
        <text
          x={16}
          y={yOffset + SUB_LANE_HEIGHT / 2 + 3}
          fill="var(--text-muted)"
          fontSize={11}
          fontFamily="monospace"
        >
          {'\u2514'} {lane.agent.name.slice(0, 12)}
        </text>
      </g>,
    );

    // Sub-lane background
    elements.push(
      <rect
        key={`sub-bg-${lane.agent.id}`}
        x={LEFT_GUTTER}
        y={yOffset}
        width={timelineWidth}
        height={SUB_LANE_HEIGHT}
        fill="var(--bg-secondary)"
        opacity={0.2}
      />,
    );

    // Tool call blocks for sub-lane
    for (const tc of lane.toolCalls) {
      const startX = LEFT_GUTTER + ((tc.startedAt - sessionStart) / 1000) * pps;
      const endTime = tc.endedAt || Date.now();
      const blockWidth = Math.max(MIN_BLOCK_WIDTH, ((endTime - tc.startedAt) / 1000) * pps);
      const color = statusColors[tc.status] || statusColors.idle;

      elements.push(
        <g
          key={`sub-tc-${tc.agentId}`}
          className="cursor-pointer"
          onClick={() => setSelectedAgent(tc.agentId)}
        >
          <rect
            x={startX}
            y={yOffset + (SUB_LANE_HEIGHT - BLOCK_HEIGHT * 0.7) / 2}
            width={blockWidth}
            height={BLOCK_HEIGHT * 0.7}
            fill={color}
            opacity={0.7}
            rx={1}
          />
        </g>,
      );
    }

    // Nested sub-lanes
    let subY = yOffset + SUB_LANE_HEIGHT;
    for (const sub of lane.subLanes) {
      elements.push(...renderSubLane(sub, subY));
      subY += countLaneHeight(sub);
    }

    return elements;
  }

  let currentY = HEADER_HEIGHT;
  const allElements: React.JSX.Element[] = [];

  for (const lane of lanes) {
    allElements.push(...renderLane(lane, currentY));
    currentY += countLaneHeight(lane);
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="text-[11px] px-2 py-1 flex items-center justify-between" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        <span>TIMELINE WATERFALL</span>
        <span>Ctrl+Scroll to zoom</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <svg
          width={LEFT_GUTTER + timelineWidth + 20}
          height={totalHeight + 10}
          style={{ minWidth: '100%' }}
        >
          {/* Time axis ticks */}
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.x}
                y1={0}
                x2={tick.x}
                y2={TICK_HEIGHT}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
              <text
                x={tick.x}
                y={TICK_HEIGHT - 4}
                fill="var(--text-muted)"
                fontSize={11}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {tick.label}
              </text>
              {/* Vertical guide line */}
              <line
                x1={tick.x}
                y1={HEADER_HEIGHT}
                x2={tick.x}
                y2={totalHeight}
                stroke="var(--border)"
                strokeWidth={0.25}
                strokeDasharray="2,4"
              />
            </g>
          ))}

          {/* Header separator */}
          <line
            x1={0}
            y1={HEADER_HEIGHT}
            x2={LEFT_GUTTER + timelineWidth}
            y2={HEADER_HEIGHT}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {allElements}
        </svg>
      </div>
    </div>
  );
}
