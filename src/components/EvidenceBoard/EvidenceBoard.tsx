/**
 * EvidenceBoard — full-screen corkboard overlay.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useClues, useDeductions, useConnections, useSettings, useStore } from '../../store';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { trackActivity } from '../../engine/hintEngine';
import { announce } from '../../announcer';
import type { OutcomeTier } from '../../types';
import { ClueCard } from './ClueCard';
import { ProgressSummary } from './ProgressSummary';
import { ConnectionThread, type Connection, type ThreadPoint } from './ConnectionThread';
import { DeductionButton } from './DeductionButton';

export interface EvidenceBoardProps {
  onClose: () => void;
}

const DEDUCTION_MESSAGES = {
  criticalSuccess: 'The connection holds — a sharp, decisive insight.',
  success: 'The connection holds.',
  partial: "Some of these belong together, but the reasoning won't quite hold.",
  failure: "These clues don't connect — not like this.",
} as const;

interface OutcomeBanner {
  message: string;
  tone: 'green' | 'amber' | 'red';
}

/**
 * Maps a deduction outcome to its banner message + tone in one place, so the
 * two can never desync. Formation is decided in DeductionButton; this only
 * frames the already-decided result (success/failure) by roll tier.
 */
function outcomeToBanner(result: 'success' | 'failure', tier: OutcomeTier): OutcomeBanner {
  if (result === 'success') {
    return {
      message: tier === 'critical' ? DEDUCTION_MESSAGES.criticalSuccess : DEDUCTION_MESSAGES.success,
      tone: 'green',
    };
  }
  if (tier === 'partial') {
    return { message: DEDUCTION_MESSAGES.partial, tone: 'amber' };
  }
  return { message: DEDUCTION_MESSAGES.failure, tone: 'red' };
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
  const reducedMotion = useSettings().reducedMotion;
  const updateClueStatus = useStore((s) => s.updateClueStatus);
  const addConnection = useStore((s) => s.addConnection);
  const clearConnections = useStore((s) => s.clearConnections);

  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [slackConnections, setSlackConnections] = useState<Connection[]>([]);
  const [outcomeBanner, setOutcomeBanner] = useState<OutcomeBanner | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mousePos, setMousePos] = useState<ThreadPoint | null>(null);
  // Trigger re-computation of thread positions
  const [pointsVersion, setPointsVersion] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  // Track board visit for hint engine
  useEffect(() => {
    trackActivity({ type: 'boardVisit' });
  }, []);

  // Clean up the pending banner-dismiss timer on unmount.
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
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
    // rAF-throttle: scroll/resize can fire many times per frame; coalesce them
    // into a single recompute per animation frame (F-044).
    let rafId: number | null = null;
    function recompute() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setPointsVersion((v) => v + 1);
      });
    }
    board.addEventListener('scroll', recompute);
    window.addEventListener('resize', recompute);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
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
    // rAF-throttle the ghost-thread position so a fast mousemove does at most
    // one getBoundingClientRect + state update per frame (F-044).
    let rafId: number | null = null;
    let lastEvent: MouseEvent | null = null;
    function handleMouseMove(e: MouseEvent) {
      lastEvent = e;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!boardRef.current || !lastEvent) return;
        const rect = boardRef.current.getBoundingClientRect();
        setMousePos({ x: lastEvent.clientX - rect.left, y: lastEvent.clientY - rect.top });
      });
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
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

  // Deduction result handler — formation happens in DeductionButton; the board
  // owns the transient outcome banner (survives clearConnections) + the single
  // screen-reader announcement. This does NOT change what forms a deduction
  // (still the DC-14 Reason roll); it only surfaces the existing outcome legibly.
  function handleDeductionResult(result: 'success' | 'failure', tier: OutcomeTier) {
    const banner = outcomeToBanner(result, tier);

    setOutcomeBanner(banner);
    announce(banner.message);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setOutcomeBanner(null), 2500);

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
      ref={dialogRef}
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
            {outcomeBanner && (
              <span
                aria-hidden="true"
                data-tone={outcomeBanner.tone}
                className={[
                  'text-xs font-medium max-w-[16rem] leading-snug',
                  outcomeBanner.tone === 'green'
                    ? 'text-green-400'
                    : outcomeBanner.tone === 'amber'
                      ? 'text-amber-300'
                      : 'text-red-400',
                ].join(' ')}
              >
                {outcomeBanner.message}
              </span>
            )}
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
            reducedMotion={reducedMotion}
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

        {connectingFrom ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900/90 text-amber-300 text-sm px-4 py-2 rounded-full border border-amber-700"
          >
            Tap another clue to connect, or press <kbd className="font-bold">Esc</kbd> to cancel
          </div>
        ) : (
          revealedClues.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900/90 text-amber-300 text-sm px-4 py-2 rounded-full border border-amber-700"
            >
              Select two clues to connect them, then form a deduction
            </div>
          )
        )}
      </div>
    </div>
  );
}
