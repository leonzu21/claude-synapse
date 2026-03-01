import type { AgentNode } from '@synapse-tools/protocol';

export interface LayoutNodeData {
  agent: AgentNode;
  x: number;
  y: number;
  isSelected: boolean;
  latestDetail: string;
  isRoot: boolean;
  phaseOffset: number;
  depth: number;
  isActiveLayer: boolean;
}

export interface TetherData {
  id: string;
  sourceId: string;
  targetId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animated: boolean;
  targetState?: string;
  edgeType: 'tool_call' | 'sub_agent';
  weight: number;
}

export interface LayoutResult {
  positions: LayoutNodeData[];
  tethers: TetherData[];
  layoutWidth: number;
  layoutHeight: number;
}
