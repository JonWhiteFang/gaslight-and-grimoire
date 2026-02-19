/**
 * HeaderBar — top navigation bar for the game screen.
 *
 * Contains the case title, Evidence Board toggle, Journal button,
 * NPC Gallery button, Ability button, and Menu button.
 */
import { useStore } from '../../store';
import { AbilityButton } from './AbilityButton';
import { HintButton } from './HintButton';
import type { GameState } from '../../types';

export interface HeaderBarProps {
  onOpenEvidenceBoard: () => void;
  onOpenJournal: () => void;
  onOpenNPCGallery: () => void;
  onActivateAbility: () => void;
  onOpenSettings: () => void;
}

export function HeaderBar({
  onOpenEvidenceBoard,
  onOpenJournal,
  onOpenNPCGallery,
  onActivateAbility,
  onOpenSettings,
}: HeaderBarProps) {
  const currentCase = useStore((s) => s.currentCase);
  const clues = useStore((s) => s.clues);
  const archetype = useStore((s) => s.investigator.archetype);
  const abilityUsed = useStore((s) => s.investigator.abilityUsed);

  // Build a minimal GameState snapshot for HintButton context
  const gameState = useStore((s) => ({
    investigator: s.investigator,
    currentScene: s.currentScene,
    currentCase: s.currentCase,
    clues: s.clues,
    deductions: s.deductions,
    npcs: s.npcs,
    flags: s.flags,
    factionReputation: s.factionReputation,
    sceneHistory: s.sceneHistory,
    settings: s.settings,
  })) as GameState;

  const hasNewClues = Object.values(clues).some((c) => c.status === 'new');

  return (
    <header
      role="banner"
      className="
        flex items-center justify-between
        px-4 py-3
        bg-stone-950/90 border-b border-stone-800
        backdrop-blur-sm
      "
    >
      {/* Case title */}
      <h1 className="text-amber-300 font-bold text-base tracking-wide truncate">
        {currentCase || 'Gaslight & Grimoire'}
      </h1>

      {/* Action buttons */}
      <nav aria-label="Game overlays" className="flex items-center gap-2">

        {/* Archetype Ability */}
        <AbilityButton
          archetype={archetype}
          abilityUsed={abilityUsed}
          onActivate={onActivateAbility}
        />

        {/* Hint */}
        <HintButton gameState={gameState} />

        {/* Evidence Board */}
        <button
          type="button"
          aria-label="Open Evidence Board"
          onClick={onOpenEvidenceBoard}
          className="
            relative w-11 h-11 flex items-center justify-center
            rounded-lg text-lg
            text-amber-300 hover:text-white hover:bg-stone-800
            transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          "
        >
          🔍
          {hasNewClues && (
            <span
              aria-label="New clues available"
              className="
                absolute top-1 right-1 w-2.5 h-2.5 rounded-full
                bg-amber-400 animate-pulse
              "
            />
          )}
        </button>

        {/* Case Journal */}
        <button
          type="button"
          aria-label="Open Case Journal"
          onClick={onOpenJournal}
          className="
            w-11 h-11 flex items-center justify-center
            rounded-lg text-lg
            text-amber-300 hover:text-white hover:bg-stone-800
            transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          "
        >
          📖
        </button>

        {/* NPC Gallery */}
        <button
          type="button"
          aria-label="Open NPC Gallery"
          onClick={onOpenNPCGallery}
          className="
            w-11 h-11 flex items-center justify-center
            rounded-lg text-lg
            text-amber-300 hover:text-white hover:bg-stone-800
            transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          "
        >
          👥
        </button>

        {/* Settings */}
        <button
          type="button"
          aria-label="Open Settings"
          onClick={onOpenSettings}
          className="
            w-11 h-11 flex items-center justify-center
            rounded-lg text-lg
            text-amber-300 hover:text-white hover:bg-stone-800
            transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          "
        >
          ⚙️
        </button>
      </nav>
    </header>
  );
}
