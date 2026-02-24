/**
 * NarrativePanel — main scene display area.
 *
 * Composes SceneText, SceneIllustration, DiceRollOverlay, OutcomeBanner,
 * ClueDiscoveryCard, and SceneCluePrompts. Wired to the narrative slice
 * so it re-renders on goToScene.
 *
 * Req 2.2, 2.3, 2.4, 4.6, 4.7, 4.8
 */
import React, { useState, useEffect, useRef } from 'react';
import { useStore, useCurrentScene, buildGameState } from '../../store';
import { canDiscoverClue } from '../../engine/narrativeEngine';
import { trackActivity } from '../../engine/hintEngine';
import { SceneText } from './SceneText';
import { SceneIllustration } from './SceneIllustration';
import { DiceRollOverlay } from './DiceRollOverlay';
import { OutcomeBanner } from './OutcomeBanner';
import { ClueDiscoveryCard } from './ClueDiscoveryCard';
import { SceneCluePrompts } from './SceneCluePrompts';
import { EffectFeedback } from './EffectFeedback';
import { generateEffectMessages } from '../../engine/effectMessages';
import type { Clue } from '../../types';

export function NarrativePanel() {
  const currentSceneId = useStore((s) => s.currentScene);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const textSpeed = useStore((s) => s.settings.textSpeed);
  const lastCheckResult = useStore((s) => s.lastCheckResult);
  const setCheckResult = useStore((s) => s.setCheckResult);
  const discoverClue = useStore((s) => s.discoverClue);
  const applyEffects = useStore((s) => s.applyEffects);
  const clues = useStore((s) => s.clues);
  const npcs = useStore((s) => s.npcs);
  const investigator = useStore((s) => s.investigator);

  const scene = useCurrentScene();
  const prevSceneRef = useRef('');

  // Effect feedback state
  const [effectMessages, setEffectMessages] = useState<string[]>([]);

  // Clue discovery card state
  const [discoveredClue, setDiscoveredClue] = useState<Clue | null>(null);
  const [clueCardVisible, setClueCardVisible] = useState(false);
  const [clueCardVariant, setClueCardVariant] = useState<'standard' | 'dialogue'>('standard');

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

  // Apply onEnter effects and auto-discover automatic + dialogue clues on scene change
  useEffect(() => {
    if (!scene || currentSceneId === prevSceneRef.current) return;
    prevSceneRef.current = currentSceneId;

    trackActivity({ type: 'sceneChange' });

    if (scene.onEnter && scene.onEnter.length > 0) {
      applyEffects(scene.onEnter);
      setEffectMessages(generateEffectMessages(scene.onEnter, npcs));
    } else {
      setEffectMessages([]);
    }

    const gameState = buildGameState(useStore.getState());
    let lastDiscoveredId: string | null = null;
    let lastMethod: string = 'automatic';

    for (const discovery of scene.cluesAvailable) {
      if ((discovery.method === 'automatic' || discovery.method === 'dialogue') && canDiscoverClue(discovery, gameState)) {
        discoverClue(discovery.clueId);
        lastDiscoveredId = discovery.clueId;
        lastMethod = discovery.method;
      }
    }

    if (lastDiscoveredId) {
      const freshClues = useStore.getState().clues;
      setDiscoveredClue(freshClues[lastDiscoveredId] ?? null);
      setClueCardVariant(lastMethod === 'dialogue' ? 'dialogue' : 'standard');
      setClueCardVisible(true);
      const timer = setTimeout(() => setClueCardVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [currentSceneId, scene, discoverClue, applyEffects, npcs]);

  function handleBannerDismiss() {
    setBannerVisible(false);
    setDiceVisible(false);
    setCheckResult(null);
  }

  function handleClueDiscovered(clue: Clue) {
    setDiscoveredClue(clue);
    setClueCardVariant('standard');
    setClueCardVisible(true);
    setTimeout(() => setClueCardVisible(false), 4000);
  }

  function handleCheckResult(result: { roll: number; modifier: number; total: number; tier: string }) {
    setCheckResult({
      roll: result.roll,
      modifier: result.modifier,
      total: result.total,
      tier: result.tier as import('../../types').OutcomeTier,
    });
  }

  const gameState = buildGameState(useStore.getState());

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

      {/* Effect feedback (onEnter consequences) */}
      <EffectFeedback messages={effectMessages} reducedMotion={reducedMotion} />

      {/* Active clue discovery prompts (exploration + check) */}
      {scene && (
        <SceneCluePrompts
          sceneId={currentSceneId}
          cluesAvailable={scene.cluesAvailable}
          clues={clues}
          gameState={gameState}
          investigator={investigator}
          onClueDiscovered={handleClueDiscovered}
          onCheckResult={handleCheckResult}
          discoverClue={discoverClue}
        />
      )}

      {/* Clue discovery notification */}
      <ClueDiscoveryCard
        clue={discoveredClue ?? undefined}
        visible={clueCardVisible}
        reducedMotion={reducedMotion}
        variant={clueCardVariant}
        onDismiss={() => setClueCardVisible(false)}
      />
    </section>
  );
}
