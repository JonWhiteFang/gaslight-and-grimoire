/**
 * ConnectionThread — SVG overlay that draws threads between connected clue cards.
 *
 * Req 7.4: Drag a Connection_Thread from one Clue card to another.
 * Req 7.5: Brighten clues sharing at least one tag with the source (handled in EvidenceBoard).
 * Req 7.8: On failure, animate thread going slack.
 */
import React from 'react';
import { motion } from 'framer-motion';

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
}

function midPoint(a: ThreadPoint, b: ThreadPoint): ThreadPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Renders a single SVG path as a slightly curved thread */
function Thread({
  from,
  to,
  slack = false,
}: {
  from: ThreadPoint;
  to: ThreadPoint;
  slack?: boolean;
}) {
  const mid = midPoint(from, to);
  // Add a slight droop for the slack animation
  const controlY = slack ? mid.y + 40 : mid.y;
  const d = `M ${from.x} ${from.y} Q ${mid.x} ${controlY} ${to.x} ${to.y}`;

  return (
    <motion.path
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
        />
      ))}

      {/* Ghost thread while dragging */}
      {ghostFrom && ghostTo && (
        <motion.path
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
