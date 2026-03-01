// Pixel art SVG icon components — 16x16 grid, crispEdges rendering

interface IconProps {
  color?: string;
  size?: number;
}

const defaults = { color: 'currentColor', size: 16 };

function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
    >
      {children}
    </svg>
  );
}

/** Hollow square — idle state */
export function IconIdle({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="10" height="10" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

/** Diamond shape — thinking state */
export function IconThinking({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="7" y="2" width="2" height="2" fill={color} />
      <rect x="5" y="4" width="2" height="2" fill={color} />
      <rect x="9" y="4" width="2" height="2" fill={color} />
      <rect x="3" y="6" width="2" height="2" fill={color} />
      <rect x="11" y="6" width="2" height="2" fill={color} />
      <rect x="5" y="8" width="2" height="2" fill={color} />
      <rect x="9" y="8" width="2" height="2" fill={color} />
      <rect x="7" y="10" width="2" height="2" fill={color} />
    </Svg>
  );
}

/** Lightning bolt — working state */
export function IconWorking({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="8" y="1" width="2" height="2" fill={color} />
      <rect x="7" y="3" width="2" height="2" fill={color} />
      <rect x="6" y="5" width="2" height="2" fill={color} />
      <rect x="5" y="7" width="6" height="2" fill={color} />
      <rect x="8" y="9" width="2" height="2" fill={color} />
      <rect x="7" y="11" width="2" height="2" fill={color} />
      <rect x="6" y="13" width="2" height="2" fill={color} />
    </Svg>
  );
}

/** Checkmark — completed state */
export function IconCompleted({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="8" width="2" height="2" fill={color} />
      <rect x="5" y="10" width="2" height="2" fill={color} />
      <rect x="7" y="8" width="2" height="2" fill={color} />
      <rect x="9" y="6" width="2" height="2" fill={color} />
      <rect x="11" y="4" width="2" height="2" fill={color} />
    </Svg>
  );
}

/** X mark — error state */
export function IconError({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="2" height="2" fill={color} />
      <rect x="11" y="3" width="2" height="2" fill={color} />
      <rect x="5" y="5" width="2" height="2" fill={color} />
      <rect x="9" y="5" width="2" height="2" fill={color} />
      <rect x="7" y="7" width="2" height="2" fill={color} />
      <rect x="5" y="9" width="2" height="2" fill={color} />
      <rect x="9" y="9" width="2" height="2" fill={color} />
      <rect x="3" y="11" width="2" height="2" fill={color} />
      <rect x="11" y="11" width="2" height="2" fill={color} />
    </Svg>
  );
}

/** Exclamation triangle — warning */
export function IconWarning({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="7" y="2" width="2" height="2" fill={color} />
      <rect x="6" y="4" width="4" height="2" fill={color} />
      <rect x="5" y="6" width="6" height="2" fill={color} />
      <rect x="4" y="8" width="8" height="2" fill={color} />
      <rect x="3" y="10" width="10" height="2" fill={color} />
      {/* Hollow out the exclamation mark */}
      <rect x="7" y="5" width="2" height="3" fill="var(--bg-card, #1c1c28)" />
      <rect x="7" y="9" width="2" height="2" fill="var(--bg-card, #1c1c28)" />
    </Svg>
  );
}

/** Wrench — tool icon */
export function IconTool({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="10" y="2" width="2" height="2" fill={color} />
      <rect x="12" y="2" width="2" height="2" fill={color} />
      <rect x="10" y="4" width="2" height="2" fill={color} />
      <rect x="8" y="6" width="2" height="2" fill={color} />
      <rect x="6" y="8" width="2" height="2" fill={color} />
      <rect x="4" y="10" width="2" height="2" fill={color} />
      <rect x="2" y="12" width="2" height="2" fill={color} />
      <rect x="4" y="12" width="2" height="2" fill={color} />
      <rect x="2" y="10" width="2" height="2" fill={color} />
    </Svg>
  );
}

/** Small X — close button */
export function IconClose({ color = defaults.color, size = defaults.size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="2" height="2" fill={color} />
      <rect x="10" y="4" width="2" height="2" fill={color} />
      <rect x="6" y="6" width="2" height="2" fill={color} />
      <rect x="8" y="6" width="2" height="2" fill={color} />
      <rect x="6" y="8" width="2" height="2" fill={color} />
      <rect x="8" y="8" width="2" height="2" fill={color} />
      <rect x="4" y="10" width="2" height="2" fill={color} />
      <rect x="10" y="10" width="2" height="2" fill={color} />
    </Svg>
  );
}
