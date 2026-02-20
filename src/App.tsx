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
import { NarrativePanel } from './components/NarrativePanel';
import { StatusBar } from './components/StatusBar';
import { ChoicePanel } from './components/ChoicePanel';
import { CaseCompletion } from './components/CaseCompletion';
import { useStore, useCurrentScene } from './store';
import type { CaseCompletionResult } from './engine/caseProgression';

type Screen = 'title' | 'character-creation' | 'game' | 'load-game' | 'loading' | 'case-complete';

// Maps each archetype to the world flag it sets when its ability is activated
const ABILITY_FLAGS: Record<string, string> = {
  deductionist: 'ability-auto-succeed-reason',
  occultist: 'ability-veil-sight-active',
  operator: 'ability-auto-succeed-vigor',
  mesmerist: 'ability-auto-succeed-influence',
};

function GameContent() {
  const scene = useCurrentScene();
  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <NarrativePanel />
        <ChoicePanel choices={scene?.choices ?? []} />
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

  const archetype = useStore((s) => s.investigator.archetype);
  const abilityUsed = useStore((s) => s.investigator.abilityUsed);
  const useAbility = useStore((s) => s.useAbility);
  const setFlag = useStore((s) => s.setFlag);
  const loadGame = useStore((s) => s.loadGame);
  const loadAndStartCase = useStore((s) => s.loadAndStartCase);
  const saveGame = useStore((s) => s.saveGame);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<CaseCompletionResult | null>(null);
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

  const handleStartCase = useCallback(async () => {
    setScreen('loading');
    setLoadError(null);
    try {
      await loadAndStartCase('the-whitechapel-cipher');
      setScreen('game');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load case');
      setScreen('title');
    }
  }, [loadAndStartCase]);

  const handleCompleteCase = useCallback(() => {
    if (!currentCase) return;
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
          onContinue={() => {
            setCompletionResult(null);
            setScreen('title');
          }}
        />
      </AccessibilityProvider>
    );
  }

  if (screen === 'character-creation') {
    return (
      <AccessibilityProvider>
        <CharacterCreation onComplete={handleStartCase} />
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
        />
        <AmbientAudio />

        <GameContent />

        {/* Overlays */}
        {isEvidenceBoardOpen && (
          <EvidenceBoard onClose={() => setIsEvidenceBoardOpen(false)} />
        )}
        {isJournalOpen && (
          <CaseJournal onClose={() => setIsJournalOpen(false)} />
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
