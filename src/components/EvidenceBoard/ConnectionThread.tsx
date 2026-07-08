/**
 * ConnectionThread — SVG overlay that draws threads between connected clue cards.
 */
import { m } from 'framer-motion';

export interface ThreadPoint {
  x: number;
  y: number;
}

export interface Connection {
  fromId: string;
  toId: string;
  fromPoint: ThreadPoint;
  toPoint: ThreadPoint;
  /** 'active' = normal gold thread; 'slack' = failure animation */
  state?: 'active' | 'slack';
}

interface ConnectionThreadProps {
  connections: Connection[];
  /** Ghost thread following the mouse while connecting */
  ghostFrom?: ThreadPoint;
  ghostTo?: ThreadPoint;
  /** When true, threads appear instantly with no draw/fade animation (F-048). */
  reducedMotion?: boolean;
}

function midPoint(a: ThreadPoint, b: ThreadPoint): ThreadPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Renders a single SVG path as a slightly curved thread */
function Thread({
  from,
  to,
  slack = false,
  reducedMotion = false,
}: {
  from: ThreadPoint;
  to: ThreadPoint;
  slack?: boolean;
  reducedMotion?: boolean;
}) {
  const mid = midPoint(from, to);
  // Add a slight droop for the slack animation
  const controlY = slack ? mid.y + 40 : mid.y;
  const d = `M ${from.x} ${from.y} Q ${mid.x} ${controlY} ${to.x} ${to.y}`;

  // Reduced motion: render the thread in its final state with no draw/fade
  // (framer-motion is JS-driven, so the global CSS reduced-motion rule can't
  // reach it — gate it here). A slack (failure) thread stays hidden.
  if (reducedMotion) {
    if (slack) return null;
    return (
      <path
        d={d}
        fill="none"
        stroke="#eab308"
        strokeWidth={2}
      />
    );
  }

  return (
    <m.path
      d={d}
      fill="none"
      stroke={slack ? '#ef4444' : '#eab308'}
      strokeWidth={slack ? 1.5 : 2}
      strokeDasharray={slack ? '6 4' : undefined}
      initial={slack ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
      animate={
        slack
          ? { pathLength: 1, opacity: [1, 0.6, 0], transition: { duration: 1.2 } }
          : { pathLength: 1, opacity: 1, transition: { duration: 0.4 } }
      }
    />
  );
}

export function ConnectionThread({
  connections,
  ghostFrom,
  ghostTo,
  reducedMotion = false,
}: ConnectionThreadProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
      aria-hidden="true"
    >
      {connections.map((conn) => (
        <Thread
          key={`${conn.fromId}-${conn.toId}`}
          from={conn.fromPoint}
          to={conn.toPoint}
          slack={conn.state === 'slack'}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* Ghost thread while dragging */}
      {ghostFrom && ghostTo && (
        <m.path
          d={`M ${ghostFrom.x} ${ghostFrom.y} L ${ghostTo.x} ${ghostTo.y}`}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          opacity={0.6}
        />
      )}
    </svg>
  );
}
