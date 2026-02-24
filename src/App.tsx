import React, { useState, useCallback } from 'react';
import { CharacterCreation } from './components/CharacterCreation';
import { HeaderBar } from './components/HeaderBar';
import { EvidenceBoard } from './components/EvidenceBoard';
import { CaseJournal } from './components/CaseJournal';
import { NPCGallery } from './components/NPCGallery';
import { AccessibilityProvider } from './components/AccessibilityProvider/AccessibilityProvider';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { AmbientAudio } from './components/AmbientAudio/AmbientAudio';
import { TitleScreen } from './components/TitleScreen/TitleScreen';
import { LoadGameScreen } from './components/TitleScreen/LoadGameScreen';
import { NarrativePanel, SceneText } from './components/NarrativePanel';
import { StatusBar } from './components/StatusBar';
import { ChoicePanel } from './components/ChoicePanel';
import { EncounterPanel } from './components/EncounterPanel';
import { CaseCompletion } from './components/CaseCompletion';
import { CaseSelection } from './components/CaseSelection';
import { useStore, useCurrentScene, buildGameState } from './store';
import type { CaseCompletionResult } from './engine/caseProgression';

type Screen = 'title' | 'character-creation' | 'case-selection' | 'game' | 'load-game' | 'loading' | 'case-complete';

// Maps each archetype to the world flag it sets when its ability is activated
const ABILITY_FLAGS: Record<string, string> = {
  deductionist: 'ability-auto-succeed-reason',
  occultist: 'ability-veil-sight-active',
  operator: 'ability-auto-succeed-vigor',
  mesmerist: 'ability-auto-succeed-influence',
};

function GameContent({ onCompleteCase, reviewSceneId, onDismissReview }: { onCompleteCase: () => void; reviewSceneId: string | null; onDismissReview: () => void }) {
  const scene = useCurrentScene();
  const caseData = useStore((s) => s.caseData);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const isTerminal = scene && scene.choices.length === 0 && !scene.encounter;

  // Read-only review mode
  if (reviewSceneId && caseData?.scenes[reviewSceneId]) {
    const reviewScene = caseData.scenes[reviewSceneId];
    return (
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <section className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 text-xs text-stone-500 uppercase tracking-wide">
              <span>📖 Reviewing previous scene</span>
            </div>
            <SceneText text={reviewScene.narrative} textSpeed="instant" reducedMotion={reducedMotion} />
            <button
              type="button"
              onClick={onDismissReview}
              className="self-center px-6 py-2 bg-amber-800 hover:bg-amber-700 text-amber-100 font-serif rounded border border-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              Return to present
            </button>
          </section>
        </div>
        <StatusBar />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <NarrativePanel />
        {isTerminal ? (
          <div className="flex justify-center p-8">
            <button
              type="button"
              onClick={onCompleteCase}
              className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-serif text-lg rounded border border-amber-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              Case Complete
            </button>
          </div>
        ) : scene?.encounter ? (
          <EncounterPanel
            sceneId={scene.id}
            rounds={scene.encounter.rounds}
            isSupernatural={scene.encounter.isSupernatural}
            onComplete={() => {}}
          />
        ) : (
          <ChoicePanel choices={scene?.choices ?? []} />
        )}
      </div>
      <StatusBar />
    </main>
  );
}


export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [isEvidenceBoardOpen, setIsEvidenceBoardOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reviewSceneId, setReviewSceneId] = useState<string | null>(null);

  const archetype = useStore((s) => s.investigator.archetype);
  const abilityUsed = useStore((s) => s.investigator.abilityUsed);
  const useAbility = useStore((s) => s.useAbility);
  const setFlag = useStore((s) => s.setFlag);
  const loadGame = useStore((s) => s.loadGame);
  const loadAndStartCase = useStore((s) => s.loadAndStartCase);
  const loadAndStartVignette = useStore((s) => s.loadAndStartVignette);
  const saveGame = useStore((s) => s.saveGame);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<CaseCompletionResult | null>(null);
  const [endingNarrative, setEndingNarrative] = useState<string | null>(null);
  const completeCase = useStore((s) => s.completeCase);
  const currentCase = useStore((s) => s.currentCase);

  const handleActivateAbility = useCallback(() => {
    if (abilityUsed) return;
    useAbility();
    const flag = ABILITY_FLAGS[archetype];
    if (flag) setFlag(flag, true);
  }, [abilityUsed, archetype, useAbility, setFlag]);

  const handleLoadSave = useCallback(
    async (saveId: string) => {
      await loadGame(saveId);
      setScreen('game');
    },
    [loadGame],
  );

  const handleSelectCase = useCallback(async (id: string, type: 'case' | 'vignette') => {
    setScreen('loading');
    setLoadError(null);
    try {
      if (type === 'vignette') {
        await loadAndStartVignette(id);
      } else {
        await loadAndStartCase(id);
      }
      setScreen('game');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load case');
      setScreen('case-selection');
    }
  }, [loadAndStartCase, loadAndStartVignette]);

  const handleCompleteCase = useCallback(() => {
    if (!currentCase) return;
    const caseData = useStore.getState().caseData;
    const sceneId = useStore.getState().currentScene;
    const scene = caseData?.scenes[sceneId];
    setEndingNarrative(scene?.narrative ?? null);
    const result = completeCase(currentCase);
    setCompletionResult(result);
    setScreen('case-complete');
  }, [currentCase, completeCase]);

  if (screen === 'title') {
    return (
      <AccessibilityProvider>
        <TitleScreen
          onNewGame={() => setScreen('character-creation')}
          onLoadGame={() => setScreen('load-game')}
          onSettings={() => setIsSettingsOpen(true)}
          loadError={loadError}
          onDismissError={() => setLoadError(null)}
        />
        {isSettingsOpen && (
          <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
        )}
      </AccessibilityProvider>
    );
  }

  if (screen === 'load-game') {
    return (
      <AccessibilityProvider>
        <LoadGameScreen
          onLoad={handleLoadSave}
          onBack={() => setScreen('title')}
        />
      </AccessibilityProvider>
    );
  }

  if (screen === 'loading') {
    return (
      <AccessibilityProvider>
        <div className="min-h-screen bg-gaslight-ink text-gaslight-fog font-serif flex items-center justify-center">
          <p className="text-gaslight-amber text-xl animate-pulse">Loading case…</p>
        </div>
      </AccessibilityProvider>
    );
  }

  if (screen === 'case-complete' && completionResult) {
    return (
      <AccessibilityProvider>
        <CaseCompletion
          facultyBonusGranted={completionResult.facultyBonusGranted}
          vignetteUnlocked={completionResult.vignetteUnlocked}
          endingNarrative={endingNarrative}
          onContinue={() => {
            setCompletionResult(null);
            setEndingNarrative(null);
            setScreen('case-selection');
          }}
        />
      </AccessibilityProvider>
    );
  }

  if (screen === 'character-creation') {
    return (
      <AccessibilityProvider>
        <CharacterCreation onComplete={() => setScreen('case-selection')} />
      </AccessibilityProvider>
    );
  }

  if (screen === 'case-selection') {
    return (
      <AccessibilityProvider>
        <CaseSelection
          onSelectCase={handleSelectCase}
          onBack={() => setScreen('title')}
        />
        {loadError && (
          <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-700 rounded px-4 py-3 text-sm text-red-200 flex items-start gap-2 z-50">
            <p className="flex-1">{loadError}</p>
            <button type="button" aria-label="Dismiss error" onClick={() => setLoadError(null)} className="shrink-0 text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
      </AccessibilityProvider>
    );
  }

  return (
    <AccessibilityProvider>
      <div className="min-h-screen bg-gaslight-ink text-gaslight-fog font-serif flex flex-col">
        <HeaderBar
          onOpenEvidenceBoard={() => setIsEvidenceBoardOpen(true)}
          onOpenJournal={() => setIsJournalOpen(true)}
          onOpenNPCGallery={() => setIsGalleryOpen(true)}
          onActivateAbility={handleActivateAbility}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSaveGame={saveGame}
          onReviewPrevious={() => {
            const history = useStore.getState().sceneHistory;
            if (history.length > 0) setReviewSceneId(history[history.length - 1]);
          }}
          canGoBack={useStore.getState().sceneHistory.length > 0}
        />
        <AmbientAudio />

        <GameContent onCompleteCase={handleCompleteCase} reviewSceneId={reviewSceneId} onDismissReview={() => setReviewSceneId(null)} />

        {/* Overlays */}
        {isEvidenceBoardOpen && (
          <EvidenceBoard onClose={() => setIsEvidenceBoardOpen(false)} />
        )}
        {isJournalOpen && (
          <CaseJournal onClose={() => setIsJournalOpen(false)} onReviewScene={(id) => setReviewSceneId(id)} />
        )}
        {isGalleryOpen && (
          <NPCGallery onClose={() => setIsGalleryOpen(false)} />
        )}
        {isSettingsOpen && (
          <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
        )}
      </div>
    </AccessibilityProvider>
  );
}
