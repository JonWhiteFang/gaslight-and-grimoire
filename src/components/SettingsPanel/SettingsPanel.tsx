/**
 * SettingsPanel — full-screen overlay for accessibility, audio, and gameplay settings.
 *
 * Sections:
 *   1. Text & Display  — font size presets + custom slider, high contrast, reading pace
 *   2. Motion & Accessibility — reduced motion toggle
 *   3. Audio — ambient and SFX volume sliders
 *   4. Gameplay — auto-save frequency, hints toggle
 *
 * Requirements: 12.1, 12.2, 12.4, 12.8, 12.9, 13.6, 14.7
 */
import { useEffect, useRef } from 'react';
import { useSettings, useMetaActions } from '../../store';
import type { GameSettings } from '../../types';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const settings = useSettings();
  const { updateSettings } = useMetaActions();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on mount for keyboard users
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Trap focus within the panel
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = panel!.querySelectorAll<HTMLElement>(
        'button, input, select, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  function patch(partial: Partial<GameSettings>) {
    updateSettings(partial);
  }

  const customFontSize =
    typeof settings.fontSize === 'number' ? settings.fontSize : 16;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/80 backdrop-blur-sm
      "
    >
      <div
        ref={panelRef}
        className="
          relative w-full max-w-lg max-h-[90vh] overflow-y-auto
          bg-stone-950 border border-stone-700 rounded-xl
          p-6 text-stone-200 shadow-2xl
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-amber-300">Settings</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="
              w-11 h-11 flex items-center justify-center
              rounded-lg text-stone-400 hover:text-white hover:bg-stone-800
              transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
            "
          >
            ✕
          </button>
        </div>

        {/* ── Section 1: Text & Display ─────────────────────────────────── */}
        <section aria-labelledby="section-text-display" className="mb-6">
          <h3
            id="section-text-display"
            className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3"
          >
            Text &amp; Display
          </h3>

          {/* Font size presets */}
          <fieldset className="mb-4">
            <legend className="text-sm text-stone-300 mb-2">Font Size</legend>
            <div className="flex gap-3 flex-wrap">
              {(
                [
                  { value: 'standard', label: 'Standard' },
                  { value: 'large', label: 'Large' },
                  { value: 'extraLarge', label: 'Extra Large' },
                ] as const
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer min-h-[44px] px-3 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <input
                    type="radio"
                    name="fontSize"
                    value={value}
                    checked={settings.fontSize === value}
                    onChange={() => patch({ fontSize: value })}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>

            {/* Custom slider */}
            <div className="mt-3">
              <label
                htmlFor="font-size-custom"
                className="text-sm text-stone-400 block mb-1"
              >
                Custom size:{' '}
                <span className="text-amber-300">
                  {typeof settings.fontSize === 'number'
                    ? `${settings.fontSize}px`
                    : '—'}
                </span>
              </label>
              <input
                id="font-size-custom"
                type="range"
                min={12}
                max={32}
                step={1}
                value={customFontSize}
                onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                aria-label="Custom font size in pixels"
                className="w-full h-11 accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-stone-500 mt-1">
                <span>12px</span>
                <span>32px</span>
              </div>
            </div>
          </fieldset>

          {/* High contrast */}
          <label className="flex items-center gap-3 cursor-pointer min-h-[44px] mb-4">
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => patch({ highContrast: e.target.checked })}
              aria-label="High contrast mode"
              className="accent-amber-400 w-5 h-5"
            />
            <span className="text-sm">High contrast mode</span>
          </label>

          {/* Reading pace */}
          <fieldset>
            <legend className="text-sm text-stone-300 mb-2">Reading Pace</legend>
            <div className="flex gap-3 flex-wrap">
              {(
                [
                  { value: 'typewriter', label: 'Typewriter' },
                  { value: 'fast', label: 'Fast' },
                  { value: 'instant', label: 'Instant' },
                ] as const
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer min-h-[44px] px-3 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <input
                    type="radio"
                    name="textSpeed"
                    value={value}
                    checked={settings.textSpeed === value}
                    onChange={() => patch({ textSpeed: value })}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* ── Section 2: Motion & Accessibility ────────────────────────── */}
        <section aria-labelledby="section-motion" className="mb-6">
          <h3
            id="section-motion"
            className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3"
          >
            Motion &amp; Accessibility
          </h3>

          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => patch({ reducedMotion: e.target.checked })}
              aria-label="Reduced motion — disables animations and transitions"
              className="accent-amber-400 w-5 h-5"
            />
            <span className="text-sm">
              Reduced motion
              <span className="block text-xs text-stone-500">
                Disables animations, typewriter effect, and screen shake
              </span>
            </span>
          </label>
        </section>

        {/* ── Section 3: Audio ──────────────────────────────────────────── */}
        <section aria-labelledby="section-audio" className="mb-6">
          <h3
            id="section-audio"
            className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3"
          >
            Audio
          </h3>

          {/* Ambient volume */}
          <div className="mb-4">
            <label
              htmlFor="ambient-volume"
              className="flex justify-between text-sm text-stone-300 mb-1"
            >
              <span>Ambient</span>
              <span className="text-amber-300">
                {Math.round(settings.audioVolume.ambient * 100)}%
              </span>
            </label>
            <input
              id="ambient-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.audioVolume.ambient}
              onChange={(e) =>
                patch({
                  audioVolume: {
                    ...settings.audioVolume,
                    ambient: Number(e.target.value),
                  },
                })
              }
              aria-label="Ambient audio volume"
              className="w-full h-11 accent-amber-400 cursor-pointer"
            />
          </div>

          {/* SFX volume */}
          <div>
            <label
              htmlFor="sfx-volume"
              className="flex justify-between text-sm text-stone-300 mb-1"
            >
              <span>Sound Effects</span>
              <span className="text-amber-300">
                {Math.round(settings.audioVolume.sfx * 100)}%
              </span>
            </label>
            <input
              id="sfx-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.audioVolume.sfx}
              onChange={(e) =>
                patch({
                  audioVolume: {
                    ...settings.audioVolume,
                    sfx: Number(e.target.value),
                  },
                })
              }
              aria-label="Sound effects volume"
              className="w-full h-11 accent-amber-400 cursor-pointer"
            />
          </div>
        </section>

        {/* ── Section 4: Gameplay ───────────────────────────────────────── */}
        <section aria-labelledby="section-gameplay">
          <h3
            id="section-gameplay"
            className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3"
          >
            Gameplay
          </h3>

          {/* Auto-save frequency */}
          <fieldset className="mb-4">
            <legend className="text-sm text-stone-300 mb-2">Auto-save</legend>
            <div className="flex gap-3 flex-wrap">
              {(
                [
                  { value: 'choice', label: 'Every Choice' },
                  { value: 'scene', label: 'Every Scene' },
                  { value: 'manual', label: 'Manual' },
                ] as const
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer min-h-[44px] px-3 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <input
                    type="radio"
                    name="autoSaveFrequency"
                    value={value}
                    checked={settings.autoSaveFrequency === value}
                    onChange={() => patch({ autoSaveFrequency: value })}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Hints toggle */}
          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={settings.hintsEnabled}
              onChange={(e) => patch({ hintsEnabled: e.target.checked })}
              aria-label="Enable hints"
              className="accent-amber-400 w-5 h-5"
            />
            <span className="text-sm">
              Enable hints
              <span className="block text-xs text-stone-500">
                Shows contextual guidance when you appear stuck
              </span>
            </span>
          </label>
        </section>
      </div>
    </div>
  );
}
