/**
 * EvidenceBoard — full-screen corkboard overlay.
 *
 * Req 7.1–7.8, 12.5
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useClues, useDeductions, useConnections, useStore } from '../../store';
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
  const storeConnections = useConnections();
  const updateClueStatus = useStore((s) => s.updateClueStatus);
  const addConnection = useStore((s) => s.addConnection);
  const clearConnections = useStore((s) => s.clearConnections);

  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [slackConnections, setSlackConnections] = useState<Connection[]>([]);
  const [mousePos, setMousePos] = useState<ThreadPoint | null>(null);
  // Trigger re-computation of thread positions
  const [pointsVersion, setPointsVersion] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);

  // Track board visit for hint engine
  useEffect(() => {
    trackActivity({ type: 'boardVisit' });
  }, []);

  const revealedClues = Object.values(clues).filter((c) => c.isRevealed);
  const clueCount = revealedClues.length;
  const deductionCount = Object.keys(deductions).length;

  // Compute DOM-positioned connections from store ID pairs
  const connections: Connection[] = useMemo(() => {
    if (!boardRef.current) return [];
    // pointsVersion is used to trigger recomputation
    void pointsVersion;
    return storeConnections.map((c) => {
      const fromEl = boardRef.current!.querySelector<HTMLElement>(`[data-clue-id="${c.fromId}"]`);
      const toEl = boardRef.current!.querySelector<HTMLElement>(`[data-clue-id="${c.toId}"]`);
      const fromPoint = fromEl ? getCentre(fromEl, boardRef.current!) : { x: 0, y: 0 };
      const toPoint = toEl ? getCentre(toEl, boardRef.current!) : { x: 0, y: 0 };
      return { fromId: c.fromId, toId: c.toId, fromPoint, toPoint, state: 'active' as const };
    });
  }, [storeConnections, pointsVersion]);

  const connectedIds = Array.from(
    new Set(storeConnections.flatMap((c) => [c.fromId, c.toId])),
  );

  // Recompute points after initial render and on scroll/resize
  useEffect(() => {
    setPointsVersion((v) => v + 1);
  }, [storeConnections.length]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    function recompute() { setPointsVersion((v) => v + 1); }
    board.addEventListener('scroll', recompute);
    window.addEventListener('resize', recompute);
    return () => {
      board.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  // Keyboard: Escape closes
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

  // Mouse tracking for ghost thread
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

  // Spacebar connection logic
  const handleInitiateConnection = useCallback(
    (clueId: string) => {
      if (!connectingFrom) {
        setConnectingFrom(clueId);
        return;
      }
      if (connectingFrom === clueId) {
        setConnectingFrom(null);
        return;
      }
      addConnection(connectingFrom, clueId);
      updateClueStatus(connectingFrom, 'connected');
      updateClueStatus(clueId, 'connected');
      trackActivity({ type: 'connectionAttempt' });
      setConnectingFrom(null);
    },
    [connectingFrom, addConnection, updateClueStatus],
  );

  // Ghost thread source point
  const ghostFrom = connectingFrom
    ? (() => {
        const el = boardRef.current?.querySelector<HTMLElement>(
          `[data-clue-id="${connectingFrom}"]`,
        );
        return el && boardRef.current ? getCentre(el, boardRef.current) : undefined;
      })()
    : undefined;

  // Tag-based brightening
  function shouldBrighten(clueId: string): boolean {
    if (!connectingFrom || connectingFrom === clueId) return false;
    const src = clues[connectingFrom];
    if (!src) return false;
    const target = clues[clueId];
    return !!target && src.tags.some((t) => target.tags.includes(t));
  }

  // Deduction result handler
  function handleDeductionResult(result: 'success' | 'failure') {
    if (result === 'failure') {
      setSlackConnections(
        connections.map((c) => ({ ...c, state: 'slack' as const })),
      );
      clearConnections();
      setTimeout(() => setSlackConnections([]), 1400);
    } else {
      clearConnections();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evidence Board"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
    >
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
            <DeductionButton
              connectedClueIds={connectedIds}
              onResult={handleDeductionResult}
            />
            <button
              type="button"
              aria-label="Close Evidence Board"
              onClick={onClose}
              className="text-amber-300 hover:text-white text-2xl font-bold leading-none w-11 h-11 flex items-center justify-center rounded-lg hover:bg-amber-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ×
            </button>
          </div>
        </div>

        {/* Corkboard area */}
        <div
          ref={boardRef}
          className="flex-1 overflow-auto p-6 relative"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(120,80,20,0.15) 39px,rgba(120,80,20,0.15) 40px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(120,80,20,0.15) 39px,rgba(120,80,20,0.15) 40px)',
          }}
        >
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
            <div className="flex flex-wrap gap-6 relative z-10" role="list" aria-label="Clue cards">
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
