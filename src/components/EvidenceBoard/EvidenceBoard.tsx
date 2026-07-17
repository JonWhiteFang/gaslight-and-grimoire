/**
 * EvidenceBoard — full-screen corkboard overlay.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useClues, useDeductions, useConnections, useSettings, useStore } from '../../store';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { trackActivity } from '../../engine/hintEngine';
import { announce } from '../../announcer';
import { classifyBoard } from '../../engine/deductionOracle';
import { buildDeduction, buildDeductionFromRecipe } from '../../engine/buildDeduction';
import type { DeductionCorrectness, OutcomeTier } from '../../types';
import { ClueCard } from './ClueCard';
import { ProgressSummary } from './ProgressSummary';
import { ConnectionThread, type Connection, type ThreadPoint } from './ConnectionThread';
import { DeductionButton } from './DeductionButton';

export interface EvidenceBoardProps {
  onClose: () => void;
  restoreFocusTo?: HTMLElement | null;
}

// Stable empty-array reference for the recipes selector — a fresh `[]` from a
// Zustand selector re-renders every store update (strict Object.is caching).
const NO_RECIPES: never[] = [];

const DEDUCTION_MESSAGES = {
  criticalSuccess: 'The connection holds — a sharp, decisive insight.',
  correct: 'The connection holds.',
  false: 'A connection forms — but an uneasy, questionable one.',
  partial: "Some of these belong together, but the reasoning won't quite hold.",
  incorrect: "These clues don't connect — not like this.",
} as const;

interface OutcomeBanner {
  message: string;
  tone: 'green' | 'amber' | 'red';
}

/** Better-of ordering for aggregating a multi-component attempt's correctness. */
const CORRECTNESS_RANK: Record<DeductionCorrectness, number> = {
  correct: 3,
  false: 2,
  partial: 1,
  incorrect: 0,
};

/** Picks the better of two correctness values (correct > false > partial > incorrect). */
function betterCorrectness(a: DeductionCorrectness, b: DeductionCorrectness): DeductionCorrectness {
  return CORRECTNESS_RANK[a] >= CORRECTNESS_RANK[b] ? a : b;
}

/**
 * Maps the aggregate oracle correctness (+ roll tier for flavour) to the banner
 * message + tone in one place. The roll only sharpens the copy of a `correct`
 * best — it never changes the outcome (enacts ADR-0012). When more than one
 * component was evaluated, the copy appends how many deductions formed (spec
 * §Banner), so a mixed `[correct, incorrect]` attempt still reports its count.
 */
function correctnessToBanner(
  best: DeductionCorrectness,
  tier: OutcomeTier,
  formedCount: number,
  evaluatedCount: number,
): OutcomeBanner {
  let message: string;
  let tone: OutcomeBanner['tone'];
  switch (best) {
    case 'correct':
      message = tier === 'critical' ? DEDUCTION_MESSAGES.criticalSuccess : DEDUCTION_MESSAGES.correct;
      tone = 'green';
      break;
    case 'false':
      message = DEDUCTION_MESSAGES.false;
      tone = 'amber';
      break;
    case 'partial':
      message = DEDUCTION_MESSAGES.partial;
      tone = 'amber';
      break;
    default:
      message = DEDUCTION_MESSAGES.incorrect;
      tone = 'red';
      break;
  }
  if (evaluatedCount > 1) {
    const noun = formedCount === 1 ? 'deduction' : 'deductions';
    message = `${message} (${formedCount} ${noun} formed.)`;
  }
  return { message, tone };
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

export function EvidenceBoard({ onClose, restoreFocusTo }: EvidenceBoardProps) {
  const clues = useClues();
  const deductions = useDeductions();
  const storeConnections = useConnections();
  const reducedMotion = useSettings().reducedMotion;
  const addConnection = useStore((s) => s.addConnection);
  const clearConnections = useStore((s) => s.clearConnections);
  const addDeduction = useStore((s) => s.addDeduction);
  const markCluesDeduced = useStore((s) => s.markCluesDeduced);
  const contestClues = useStore((s) => s.contestClues);
  const recipes = useStore((s) => s.caseData?.recipes ?? NO_RECIPES);
  const applyEffects = useStore((s) => s.applyEffects);

  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [slackConnections, setSlackConnections] = useState<Connection[]>([]);
  const [outcomeBanner, setOutcomeBanner] = useState<OutcomeBanner | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mousePos, setMousePos] = useState<ThreadPoint | null>(null);
  // Trigger re-computation of thread positions
  const [pointsVersion, setPointsVersion] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>({ restoreTo: restoreFocusTo });

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
      // Phase 2b: only record the connection. The connected cue is DERIVED from
      // membership (ClueCard isConnected) — writing a 'connected' status would
      // overwrite a clue's semantic status (N1). No updateClueStatus here.
      addConnection(connectingFrom, clueId);
      trackActivity({ type: 'connectionAttempt' });
      setConnectingFrom(null);
    },
    [connectingFrom, addConnection],
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

  // Deduction attempt handler (enacts ADR-0012). The button only rolls and hands
  // up the raw `tier`; the board runs the correctness ORACLE and forms every
  // qualifying deduction regardless of the roll. Correctness gates formation;
  // the roll only sharpens the copy of a `correct` result. The board owns the
  // transient banner (survives clearConnections) + the single announce().
  function showBanner(best: DeductionCorrectness, tier: OutcomeTier, formedCount: number, evaluatedCount: number) {
    const banner = correctnessToBanner(best, tier, formedCount, evaluatedCount);
    setOutcomeBanner(banner);
    announce(banner.message);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setOutcomeBanner(null), 2500);
  }

  /**
   * Slack-animate only the connections whose BOTH endpoints belong to a failed
   * component (so a `correct` component's threads in a mixed attempt don't turn
   * red), then clear every persisted connection. `failedIds === null` slacks all
   * (the empty-classified-result path, where no component was formed).
   */
  function slackAndClear(failedIds: Set<string> | null) {
    const toSlack = failedIds === null
      ? connections
      : connections.filter((c) => failedIds.has(c.fromId) && failedIds.has(c.toId));
    setSlackConnections(toSlack.map((c) => ({ ...c, state: 'slack' as const })));
    clearConnections();
    setTimeout(() => setSlackConnections([]), 1400);
  }

  function handleDeductionAttempt(tier: OutcomeTier) {
    const components = classifyBoard(storeConnections, clues, recipes);

    // Minor 5: an attempt with no classifiable component (every edge stale/
    // malformed) → a single incorrect outcome. Never a silent no-op.
    if (components.length === 0) {
      showBanner('incorrect', tier, 0, 0);
      slackAndClear(null);
      return;
    }

    let formedCount = 0;
    let best: DeductionCorrectness = 'incorrect';
    const failedIds = new Set<string>();
    for (const comp of components) {
      if (comp.correctness === 'correct' || comp.correctness === 'false') {
        // Mark 'deduced' ONLY the clues that are actually members of a formed
        // deduction — a noise clue lassoed into a recipe component but not part
        // of any recipe must not get a permanent 📌 it can't justify (card↔Journal
        // divergence). On the recipe path that's the union of matched recipes'
        // requiredClues; on the generic path the whole component IS the deduction.
        let deducedIds: string[];
        if (comp.recipes.length > 0) {
          // Blocker 1: form EVERY matched recipe, not just one.
          const members = new Set<string>();
          const alreadyFormed = useStore.getState().deductions;
          for (const r of comp.recipes) {
            const isNew = !alreadyFormed[r.id];
            addDeduction(buildDeductionFromRecipe(r, comp.clueIds));
            // onForm fires exactly once per playthrough: only on first formation
            // (spec §2.8 — formation-time so a mint on a terminal scene still records).
            if (isNew && r.onForm?.length) applyEffects(r.onForm);
            for (const id of r.requiredClues) members.add(id);
            formedCount += 1;
          }
          deducedIds = [...members];
        } else {
          addDeduction(buildDeduction(comp.clueIds, clues));
          deducedIds = comp.clueIds;
          formedCount += 1;
        }
        // Atomic success: invalidates any pending contested token for these clues
        // AND sets 'deduced' in one set — a stale revert from an earlier failed
        // attempt can't clobber it (Task 4 markCluesDeduced).
        markCluesDeduced(deducedIds);
      } else {
        // contestClues captures each clue's baseline prior itself (carry-forward safe).
        contestClues(comp.clueIds);
        for (const id of comp.clueIds) failedIds.add(id);
      }
      best = betterCorrectness(best, comp.correctness);
    }

    showBanner(best, tier, formedCount, components.length);
    // A partial/incorrect component slack-animates its own threads on the way out
    // (not a sibling correct component's); a clean clear when nothing failed.
    // Either way every persisted connection is cleared after the attempt.
    if (failedIds.size > 0) {
      slackAndClear(failedIds);
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
            <DeductionButton
              connectedClueIds={connectedIds}
              onResult={handleDeductionAttempt}
            />
            <button
              type="button"
              aria-label="Close Evidence Board"
              onClick={onClose}
              className="shrink-0 text-amber-300 hover:text-white text-2xl font-bold leading-none w-11 h-11 flex items-center justify-center rounded-lg hover:bg-amber-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ×
            </button>
          </div>
        </div>

        {/* Deduction outcome banner — a full-width row below the toolbar so it
            never displaces the close/deduction controls (incl. at narrow
            widths). Visual-only; the screen-reader path is announce(). */}
        {outcomeBanner && (
          <div
            aria-hidden="true"
            data-tone={outcomeBanner.tone}
            className={[
              'px-6 py-2 text-xs font-medium leading-snug border-b border-amber-900/60 bg-amber-950/80',
              outcomeBanner.tone === 'green'
                ? 'text-green-400'
                : outcomeBanner.tone === 'amber'
                  ? 'text-amber-300'
                  : 'text-red-400',
            ].join(' ')}
          >
            {outcomeBanner.message}
          </div>
        )}

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
                    isConnected={connectedIds.includes(clue.id)}
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
