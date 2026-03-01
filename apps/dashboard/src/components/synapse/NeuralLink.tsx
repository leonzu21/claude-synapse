import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { type EdgeProps } from '@xyflow/react';
import { COMPLETED_FADE_MS } from '../../hooks/useSynapseLayout';
import EdgeParticle from './EdgeParticle';

interface NeuralLinkData {
  animated?: boolean;
  targetState?: string;
  edgeType?: 'tool_call' | 'sub_agent';
  weight?: number;
  isOnCriticalPath?: boolean;
  isCriticalPathActive?: boolean;
}

const edgeColors = {
  tool_call: { base: '#22d65e', active: '#4ade80' },
  sub_agent: { base: '#7c3aed', active: '#a78bfa' },
};

/** Radial-aware bezier: works for any direction between source and target */
function buildBezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular unit vector for a subtle arc
  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = dist * 0.12;

  // Control points at 1/3 and 2/3 along the line, bowed perpendicular
  const cx1 = sx + dx / 3 + nx * bow;
  const cy1 = sy + dy / 3 + ny * bow;
  const cx2 = sx + (dx * 2) / 3 + nx * bow;
  const cy2 = sy + (dy * 2) / 3 + ny * bow;

  return `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;
}

/** Relative version of the bezier (for animateMotion particles) */
function buildRelativeBezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = dist * 0.12;

  const cx1 = dx / 3 + nx * bow;
  const cy1 = dy / 3 + ny * bow;
  const cx2 = (dx * 2) / 3 + nx * bow;
  const cy2 = (dy * 2) / 3 + ny * bow;

  return `M 0 0 C ${cx1} ${cy1}, ${cx2} ${cy2}, ${dx} ${dy}`;
}

function NeuralLinkComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const edgeData = data as NeuralLinkData | undefined;
  const animated = edgeData?.animated ?? false;
  const targetState = edgeData?.targetState;
  const edgeType = edgeData?.edgeType ?? 'tool_call';
  const weight = edgeData?.weight ?? 1;
  const isOnCriticalPath = edgeData?.isOnCriticalPath ?? false;
  const isCriticalPathActive = edgeData?.isCriticalPathActive ?? false;
  const isDying = targetState === 'completed' || targetState === 'error';

  const wasAlive = useRef(!isDying);
  const [fading, setFading] = useState(false);

  // Signal pulse state
  const prevTargetState = useRef(targetState);
  const [pulsing, setPulsing] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (!isDying) {
      wasAlive.current = true;
      setFading(false);
      return;
    }
    const delay = wasAlive.current ? 0 : 100;
    const timer = setTimeout(() => setFading(true), delay);
    return () => clearTimeout(timer);
  }, [isDying]);

  // Measure path length for pulse animation
  const measuredRef = useCallback((el: SVGPathElement | null) => {
    if (el) {
      (pathRef as React.MutableRefObject<SVGPathElement | null>).current = el;
      setPathLength(el.getTotalLength());
    }
  }, []);

  // Detect completion transition -> trigger pulse
  useEffect(() => {
    if (targetState === 'completed' && prevTargetState.current !== 'completed') {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), 500);
      prevTargetState.current = targetState;
      return () => clearTimeout(timer);
    }
    prevTargetState.current = targetState;
  }, [targetState]);

  const edgePath = buildBezierPath(sourceX, sourceY, targetX, targetY);

  // Weight -> stroke width: max(1, min(4, 1 + log2(weight + 1)))
  const strokeWidth = Math.max(1, Math.min(4, 1 + Math.log2(weight + 1)));

  // Colors
  const colors = edgeColors[edgeType];
  const baseColor = isOnCriticalPath ? '#f59e0b' : colors.base;
  const activeColor = isOnCriticalPath ? '#fbbf24' : colors.active;
  const criticalExtraWidth = isOnCriticalPath ? 2 : 0;
  const criticalPathDimmed = isCriticalPathActive && !isOnCriticalPath;

  const opacity = fading ? 0 : criticalPathDimmed ? 0.15 : animated ? 0.9 : 0.5;
  const fadeTransition = `opacity ${COMPLETED_FADE_MS / 1000}s ease-out`;

  const relativeParticlePath = buildRelativeBezierPath(sourceX, sourceY, targetX, targetY);

  return (
    <g>
      {/* Base line */}
      <path
        ref={measuredRef}
        d={edgePath}
        fill="none"
        stroke={baseColor}
        strokeWidth={strokeWidth + criticalExtraWidth}
        opacity={opacity * 0.4}
        style={{ transition: fading ? fadeTransition : 'opacity 0.3s' }}
      />

      {/* Active overlay — marching dashes */}
      {animated && (
        <path
          d={edgePath}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth + 0.5 + criticalExtraWidth}
          strokeDasharray="6 4"
          opacity={opacity}
          style={{ transition: fading ? fadeTransition : 'opacity 0.3s' }}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-20"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Idle dashes */}
      {!animated && !pulsing && (
        <path
          d={edgePath}
          fill="none"
          stroke={baseColor}
          strokeWidth={strokeWidth + criticalExtraWidth}
          strokeDasharray="3 4"
          opacity={opacity * 0.6}
          style={{ transition: fading ? fadeTransition : 'opacity 0.3s' }}
        />
      )}

      {/* Signal pulse on completion */}
      {pulsing && pathLength > 0 && (
        <path
          d={edgePath}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth + 1 + criticalExtraWidth}
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength}
          opacity={0.9}
        >
          <animate
            attributeName="stroke-dashoffset"
            from={String(pathLength)}
            to="0"
            dur="0.5s"
            fill="freeze"
            repeatCount="1"
          />
        </path>
      )}

      {/* Edge particles for active edges */}
      {animated && (
        <g transform={`translate(${sourceX}, ${sourceY})`}>
          <EdgeParticle
            path={relativeParticlePath}
            color={activeColor}
            filterId={`glow-${id}-0`}
          />
          {weight >= 3 && (
            <EdgeParticle
              path={relativeParticlePath}
              color={activeColor}
              delay={0.6}
              filterId={`glow-${id}-1`}
            />
          )}
        </g>
      )}
    </g>
  );
}

export default memo(NeuralLinkComponent);
