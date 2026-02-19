/**
 * AbilityButton — displays the investigator's archetype ability in the HeaderBar.
 *
 * Shows the ability name and availability state. When used, the button is
 * greyed out and disabled with an ARIA label indicating it has been spent.
 */
import { ARCHETYPES } from '../../data/archetypes';
import type { Archetype } from '../../types';

export interface AbilityButtonProps {
  archetype: Archetype;
  abilityUsed: boolean;
  onActivate: () => void;
}

export function AbilityButton({ archetype, abilityUsed, onActivate }: AbilityButtonProps) {
  const archetypeDef = ARCHETYPES.find((a) => a.id === archetype);
  if (!archetypeDef) return null;

  const { name, description } = archetypeDef.ability;

  return (
    <button
      type="button"
      disabled={abilityUsed}
      aria-label={abilityUsed ? `${name} ability used` : `Use ${name} ability`}
      aria-disabled={abilityUsed}
      title={description}
      onClick={abilityUsed ? undefined : onActivate}
      className={`
        relative min-w-[44px] h-11 px-2 flex items-center justify-center gap-1
        rounded-lg text-xs font-semibold tracking-wide
        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
        ${
          abilityUsed
            ? 'opacity-50 text-stone-500 cursor-not-allowed bg-stone-900'
            : 'text-amber-300 hover:text-white hover:bg-stone-800 cursor-pointer'
        }
      `}
    >
      <span className={abilityUsed ? 'line-through' : ''}>{name}</span>
      {abilityUsed && (
        <span className="text-[10px] text-stone-500 ml-0.5">(Used)</span>
      )}
    </button>
  );
}
