/**
 * EvidenceBoard — full-screen corkboard overlay.
 *
 * Req 7.1: Accessible at any time during gameplay as a full-screen overlay.
 * Req 7.2: Displays all collected clues as draggable cards.
 * Req 7.3: Each clue card shows its status visually.
 * Req 7.4: Drag a Connection_Thread from one Clue card to another.
 * Req 7.5: Brighten clues sharing at least one tag with the source clue.
 * Req 7.6: "Attempt Deduction" button when ≥2 clues are connected.
 * Req 7.7: On success, lock clues and add Deduction to store.
 * Req 7.8: On failure, animate thread slack.
 * Req 12.5: Tab between clue cards; Spacebar to connect; Escape closes.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useClues, useDeductions, useStore } from '../../store';
import { trackActivity } from '../../engine/hintEngine';
import { ClueCard } from './ClueCard';
import { ProgressSummary } from './ProgressSummary';
import { ConnectionThread, type Connection, type ThreadPoint } from './ConnectionThread';
import { DeductionButton } from './DeductionButton';

export interface EvidenceBoardProps {
  onClose: () => void;
}

/** Returns the centre point of a DOM element relative to a container. */
function getCentre(el: HTMLElement, container: HTMLElement): ThreadPoint {
  const eRect = el.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  return {
    x: eRect.left - cRect.left + eRect.width / 2,
    y: eRect.top - cRect.top + eRect.height / 2,
  };
}

export function EvidenceBoard({ onClose }: EvidenceBoardProps) {
  const clues = useClues();
  const deductions = useDeductions();
  const updateClueStatus = useStore((s) => s.updateClueStatus);

  // ── Connection state ──────────────────────────────────────────────────────
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [slackConnections, setSlackConnections] = useState<Connection[]>([]);
  const [mousePos, setMousePos] = useState<ThreadPoint | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  // Track board visit for hint engine
  useEffect(() => {
    trackActivity({ type: 'boardVisit' });
  }, []);

  const revealedClues = Object.values(clues).filter((c) => c.isRevealed);
  const clueCount = revealedClues.length;
  const deductionCount = Object.keys(deductions).length;

  // IDs of clues that are part of at least one active connection
  const connectedIds = Array.from(
    new Set(connections.flatMap((c) => [c.fromId, c.toId])),
  );

  // ── Keyboard: Escape closes ───────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (connectingFrom) {
          setConnectingFrom(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, connectingFrom]);

  // ── Mouse tracking for ghost thread ──────────────────────────────────────
  useEffect(() => {
    if (!connectingFrom) {
      setMousePos(null);
      return;
    }
    function handleMouseMove(e: MouseEvent) {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [connectingFrom]);

  // ── Spacebar connection logic ─────────────────────────────────────────────
  const handleInitiateConnection = useCallback(
    (clueId: string) => {
      if (!connectingFrom) {
        // Start connecting from this clue
        setConnectingFrom(clueId);
        return;
      }

      if (connectingFrom === clueId) {
        // Cancel
        setConnectingFrom(null);
        return;
      }

      // Complete the connection
      const fromEl = boardRef.current?.querySelector<HTMLElement>(
        `[data-clue-id="${connectingFrom}"]`,
      );
      const toEl = boardRef.current?.querySelector<HTMLElement>(
        `[data-clue-id="${clueId}"]`,
      );

      if (fromEl && toEl && boardRef.current) {
        const fromPoint = getCentre(fromEl, boardRef.current);
        const toPoint = getCentre(toEl, boardRef.current);

        // Avoid duplicate connections
        const alreadyExists = connections.some(
          (c) =>
            (c.fromId === connectingFrom && c.toId === clueId) ||
            (c.fromId === clueId && c.toId === connectingFrom),
        );

        if (!alreadyExists) {
          setConnections((prev) => [
            ...prev,
            { fromId: connectingFrom, toId: clueId, fromPoint, toPoint, state: 'active' },
          ]);
          updateClueStatus(connectingFrom, 'connected');
          updateClueStatus(clueId, 'connected');
          trackActivity({ type: 'connectionAttempt' });
        }
      }

      setConnectingFrom(null);
    },
    [connectingFrom, connections, updateClueStatus],
  );

  // ── Ghost thread source point ─────────────────────────────────────────────
  const ghostFrom = connectingFrom
    ? (() => {
        const el = boardRef.current?.querySelector<HTMLElement>(
          `[data-clue-id="${connectingFrom}"]`,
        );
        return el && boardRef.current ? getCentre(el, boardRef.current) : undefined;
      })()
    : undefined;

  // ── Tag-based brightening helper ────────────────────────────────────────────
  function shouldBrighten(clueId: string): boolean {
    if (!connectingFrom || connectingFrom === clueId) return false;
    const src = clues[connectingFrom];
    if (!src) return false;
    const target = clues[clueId];
    return !!target && src.tags.some((t) => target.tags.includes(t));
  }

  // ── Recompute thread positions on scroll/resize ───────────────────────────
  useEffect(() => {
    const board = boardRef.current;
    if (!board || connections.length === 0) return;

    function recompute() {
      setConnections((prev) =>
        prev.map((conn) => {
          const fromEl = board!.querySelector<HTMLElement>(`[data-clue-id="${conn.fromId}"]`);
          const toEl = board!.querySelector<HTMLElement>(`[data-clue-id="${conn.toId}"]`);
          if (fromEl && toEl) {
            return { ...conn, fromPoint: getCentre(fromEl, board!), toPoint: getCentre(toEl, board!) };
          }
          return conn;
        }),
      );
    }

    board.addEventListener('scroll', recompute);
    window.addEventListener('resize', recompute);
    return () => {
      board.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [connections.length]);

  // ── Deduction result handler ──────────────────────────────────────────────
  function handleDeductionResult(result: 'success' | 'failure') {
    if (result === 'failure') {
      // Animate threads as slack, then clear them after animation
      setSlackConnections(
        connections.map((c) => ({ ...c, state: 'slack' as const })),
      );
      setConnections([]);
      setTimeout(() => setSlackConnections([]), 1400);
    } else {
      // On success, keep threads but mark them (they'll show as deduced via clue status)
      setConnections([]);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evidence Board"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
    >
      {/* Corkboard surface */}
      <div className="flex flex-col flex-1 overflow-hidden bg-amber-950/90 relative">

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/60 bg-amber-950/95">
          <div className="flex items-center gap-6">
            <h2 className="text-amber-200 text-xl font-bold tracking-wide">
              Evidence Board
            </h2>
            <ProgressSummary clueCount={clueCount} deductionCount={deductionCount} />
          </div>

          <div className="flex items-center gap-4">
            {/* Deduction button — visible when ≥2 clues are connected */}
            <DeductionButton
              connectedClueIds={connectedIds}
              onResult={handleDeductionResult}
            />

            {/* Close button */}
            <button
              type="button"
              aria-label="Close Evidence Board"
              onClick={onClose}
              className="
                text-amber-300 hover:text-white
                text-2xl font-bold leading-none
                w-11 h-11 flex items-center justify-center
                rounded-lg hover:bg-amber-800/60
                transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white
              "
            >
              ×
            </button>
          </div>
        </div>

        {/* Corkboard area — position:relative so SVG overlay aligns correctly */}
        <div
          ref={boardRef}
          className="flex-1 overflow-auto p-6 relative"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(120,80,20,0.15) 39px,rgba(120,80,20,0.15) 40px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(120,80,20,0.15) 39px,rgba(120,80,20,0.15) 40px)',
          }}
        >
          {/* SVG thread overlay */}
          <ConnectionThread
            connections={[...connections, ...slackConnections]}
            ghostFrom={ghostFrom}
            ghostTo={mousePos ?? undefined}
          />

          {revealedClues.length === 0 ? (
            <p className="text-amber-700 text-center mt-20 text-lg italic">
              No clues discovered yet. Investigate scenes to gather evidence.
            </p>
          ) : (
            <div
              className="flex flex-wrap gap-6 relative z-10"
              role="list"
              aria-label="Clue cards"
            >
              {revealedClues.map((clue) => (
                <div key={clue.id} role="listitem">
                  <ClueCard
                    clue={clue}
                    onInitiateConnection={handleInitiateConnection}
                    isConnecting={connectingFrom === clue.id}
                    isBrightened={shouldBrighten(clue.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection mode hint */}
        {connectingFrom && (
          <div
            role="status"
            aria-live="polite"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900/90 text-amber-300 text-sm px-4 py-2 rounded-full border border-amber-700"
          >
            Press <kbd className="font-bold">Space</kbd> on another clue to connect, or{' '}
            <kbd className="font-bold">Esc</kbd> to cancel
          </div>
        )}
      </div>
    </div>
  );
}
