import { memo } from 'react';

interface EdgeParticleProps {
  path: string;
  color: string;
  duration?: number;
  delay?: number;
  filterId: string;
}

function EdgeParticleComponent({ path, color, duration = 1.2, delay = 0, filterId }: EdgeParticleProps) {
  return (
    <>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle r="3" fill={color} filter={`url(#${filterId})`} opacity="0.9">
        <animateMotion
          path={path}
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
          rotate="auto"
        />
      </circle>
    </>
  );
}

export default memo(EdgeParticleComponent);
