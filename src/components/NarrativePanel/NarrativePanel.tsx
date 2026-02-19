/**
 * NarrativePanel — main scene display area.
 *
 * Composes SceneText, SceneIllustration, DiceRollOverlay, OutcomeBanner,
 * and ClueDiscoveryCard. Wired to the narrative slice so it re-renders on
 * goToScene.
 *
 * Req 2.2, 2.3, 2.4, 4.6, 4.7, 4.8
 */
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { SceneText } from './SceneText';
import { SceneIllustration } from './SceneIllustration';
import { DiceRollOverlay } from './DiceRollOverlay';
import { OutcomeBanner } from './OutcomeBanner';
import { ClueDiscoveryCard } from './ClueDiscoveryCard';

export function NarrativePanel() {
  const currentScene = useStore((s) => s.currentScene);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const lastCheckResult = useStore((s) => s.lastCheckResult);
  const setCheckResult = useStore((s) => s.setCheckResult);

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
      <SceneIllustration />

      {/* Narrative text with typewriter effect (Req 2.2, 2.3) */}
      <SceneText
        text={currentScene ? `Scene: ${currentScene}` : ''}
        reducedMotion={reducedMotion}
      />

      {/* Clue discovery notification — stub, fully implemented in Task 10 */}
      <ClueDiscoveryCard />
    </section>
  );
}
