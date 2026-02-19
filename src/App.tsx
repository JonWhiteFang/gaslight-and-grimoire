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
import { useStore } from './store';

type Screen = 'title' | 'character-creation' | 'game' | 'load-game';

// Maps each archetype to the world flag it sets when its ability is activated
const ABILITY_FLAGS: Record<string, string> = {
  deductionist: 'ability-auto-succeed-reason',
  occultist: 'ability-veil-sight-active',
  operator: 'ability-auto-succeed-vigor',
  mesmerist: 'ability-auto-succeed-influence',
};

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

  if (screen === 'title') {
    return (
      <AccessibilityProvider>
        <TitleScreen
          onNewGame={() => setScreen('character-creation')}
          onLoadGame={() => setScreen('load-game')}
          onSettings={() => setIsSettingsOpen(true)}
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

  if (screen === 'character-creation') {
    return (
      <AccessibilityProvider>
        <CharacterCreation onComplete={() => setScreen('game')} />
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
        />
        <AmbientAudio />

        <main className="flex-1 flex items-center justify-center">
          <h1 className="text-4xl text-gaslight-amber">Gaslight &amp; Grimoire</h1>
        </main>

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
