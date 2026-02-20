/**
 * NarrativePanel — main scene display area.
 *
 * Composes SceneText, SceneIllustration, DiceRollOverlay, OutcomeBanner,
 * and ClueDiscoveryCard. Wired to the narrative slice so it re-renders on
 * goToScene.
 *
 * Req 2.2, 2.3, 2.4, 4.6, 4.7, 4.8
 */
import React, { useState, useEffect, useRef } from 'react';
import { useStore, useCurrentScene, buildGameState } from '../../store';
import { applyOnEnterEffects, canDiscoverClue } from '../../engine/narrativeEngine';
import { trackActivity } from '../../engine/hintEngine';
import { SceneText } from './SceneText';
import { SceneIllustration } from './SceneIllustration';
import { DiceRollOverlay } from './DiceRollOverlay';
import { OutcomeBanner } from './OutcomeBanner';
import { ClueDiscoveryCard } from './ClueDiscoveryCard';
import type { Clue } from '../../types';

export function NarrativePanel() {
  const currentSceneId = useStore((s) => s.currentScene);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const textSpeed = useStore((s) => s.settings.textSpeed);
  const lastCheckResult = useStore((s) => s.lastCheckResult);
  const setCheckResult = useStore((s) => s.setCheckResult);
  const discoverClue = useStore((s) => s.discoverClue);

  const scene = useCurrentScene();
  const prevSceneRef = useRef('');

  // Clue discovery card state
  const [discoveredClue, setDiscoveredClue] = useState<Clue | null>(null);
  const [clueCardVisible, setClueCardVisible] = useState(false);

  // Show the dice overlay while a check result is present
  const [diceVisible, setDiceVisible] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    if (lastCheckResult) {
      setDiceVisible(true);
      setBannerVisible(true);
    } else {
      setDiceVisible(false);
      setBannerVisible(false);
    }
  }, [lastCheckResult]);

  // Apply onEnter effects and auto-discover clues when scene changes
  useEffect(() => {
    if (!scene || currentSceneId === prevSceneRef.current) return;
    prevSceneRef.current = currentSceneId;

    trackActivity({ type: 'sceneChange' });

    if (scene.onEnter && scene.onEnter.length > 0) {
      applyOnEnterEffects(scene.onEnter);
    }

    // Auto-discover clues with method 'automatic'
    const gameState = buildGameState(useStore.getState());
    let lastDiscoveredId: string | null = null;
    for (const discovery of scene.cluesAvailable) {
      if (discovery.method === 'automatic' && canDiscoverClue(discovery, gameState)) {
        discoverClue(discovery.clueId);
        lastDiscoveredId = discovery.clueId;
      }
    }

    // Show discovery card for the last auto-discovered clue
    if (lastDiscoveredId) {
      const freshClues = useStore.getState().clues;
      setDiscoveredClue(freshClues[lastDiscoveredId] ?? null);
      setClueCardVisible(true);
      const timer = setTimeout(() => setClueCardVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [currentSceneId, scene, discoverClue]);

  function handleBannerDismiss() {
    setBannerVisible(false);
    setDiceVisible(false);
    setCheckResult(null);
  }

  return (
    <section
      aria-label="Narrative panel"
      className="flex flex-col gap-4 p-4 max-w-2xl mx-auto"
    >
      {/* Outcome feedback (Req 4.8, 16.1, 16.2, 16.5) */}
      <OutcomeBanner
        tier={lastCheckResult?.tier}
        visible={bannerVisible}
        reducedMotion={reducedMotion}
        onDismiss={handleBannerDismiss}
      />

      {/* Dice roll result (Req 4.6, 4.7) */}
      <DiceRollOverlay
        roll={lastCheckResult?.roll}
        modifier={lastCheckResult?.modifier}
        total={lastCheckResult?.total}
        visible={diceVisible}
        reducedMotion={reducedMotion}
      />

      {/* Scene illustration (Req 2.4) */}
      <SceneIllustration src={scene?.illustration} />

      {/* Narrative text with typewriter effect (Req 2.2, 2.3) */}
      <SceneText
        text={scene?.narrative ?? ''}
        textSpeed={textSpeed}
        reducedMotion={reducedMotion}
      />

      {/* Clue discovery notification */}
      <ClueDiscoveryCard
        clue={discoveredClue ?? undefined}
        visible={clueCardVisible}
        reducedMotion={reducedMotion}
        onDismiss={() => setClueCardVisible(false)}
      />
    </section>
  );
}
