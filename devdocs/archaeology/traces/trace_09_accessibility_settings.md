# Trace 09 — Accessibility & Settings Pipeline

## 1. Entry Point

Two paths:
- **User changes setting**: `SettingsPanel` → `metaSlice.updateSettings(partial)`.
- **OS detection**: `AccessibilityProvider` detects `prefers-reduced-motion` on first mount → `updateSettings({ reducedMotion: true })`.

## 2. Execution Path

### Settings change

1. `SettingsPanel` calls `patch(partial)` → `updateSettings(partial)`.
2. `updateSettings` (metaSlice): `set(state => Object.assign(state.settings, partial))`.
3. Store notifies subscribers. `useSettings()` hook returns new settings object.

### Accessibility application

4. `AccessibilityProvider` subscribes to `useSettings()` and `useMetaActions()`.
5. Three `useEffect` hooks react to setting changes:

   **Font size** (`fontSize` dependency):
   - `document.documentElement.style.setProperty('--font-size-base', fontSizeToPx(fontSize))`.
   - Maps: `'standard'` → `'16px'`, `'large'` → `'20px'`, `'extraLarge'` → `'24px'`, number → `'{n}px'`.
   - Cleanup removes the property.

   **High contrast** (`highContrast` dependency):
   - Adds/removes `'high-contrast'` class on `document.documentElement`.
   - Sets `--high-contrast` CSS property to `'1'` or `'0'`.
   - `index.css` defines `.high-contrast` with `--color-bg: #000`, `--color-text: #fff`, `--color-border: #fff`.

   **Reduced motion** (`reducedMotion` dependency):
   - Adds/removes `'reduced-motion'` class on `document.documentElement`.
   - `index.css` defines `.reduced-motion * { animation-duration: 0ms !important; transition-duration: 0ms !important; }`.

6. OS detection: on first mount, checks `window.matchMedia('(prefers-reduced-motion: reduce)')`. If matched, calls `updateSettings({ reducedMotion: true })`. Uses a `useRef` flag to run only once.

### Consumer components

7. Components read settings individually:
   - `SceneText`: reads `textSpeed` and `reducedMotion` → skips typewriter if either is `'instant'` or `true`.
   - `DiceRollOverlay`: reads `reducedMotion` → skips spring animation, sets `duration: 0`.
   - `HintButton`: reads `reducedMotion` → adjusts Framer Motion transitions.
   - `OutcomeBanner`: reads `reducedMotion` → adjusts animation.
   - `ConnectionThread`: Framer Motion paths — affected by global `.reduced-motion` CSS rule.

## 3. Resource Management

- DOM manipulation via `document.documentElement.style` and `classList` — synchronous, cheap.
- `useEffect` cleanup functions remove classes/properties on unmount or dependency change.
- `AccessibilityProvider` wraps the entire app — it never unmounts during normal use. Cleanup only matters on full app teardown.
- `matchMedia` check is a one-time read, not a listener. If the user changes OS settings mid-session, the app won't detect it.

## 4. Error Path

- `fontSizeToPx` handles all valid `GameSettings.fontSize` values. An unexpected value would hit the `number` branch and produce `'undefinedpx'` — but TypeScript prevents this at compile time.
- `matchMedia` is guarded with `typeof window.matchMedia === 'function'` for SSR/test environments.
- No error paths in settings persistence — settings are part of `GameState` and saved/loaded with the rest of the state.

## 5. Performance Characteristics

- CSS custom property changes trigger style recalculation on the entire document. For `--font-size-base`, this affects `body` font-size. For `.high-contrast`, this affects background/text/border colors globally.
- `.reduced-motion *` uses a universal selector with `!important` — this is a broad rule that the browser must evaluate for every element. Performance impact is negligible for this app's DOM size.
- `SettingsPanel` creates a new `patch` closure on every render. The `updateSettings` call triggers a store update, which re-renders `SettingsPanel` (it subscribes to `useSettings()`), creating a render loop that React batches into one update.

## 6. Observable Effects

- DOM: CSS custom properties and classes on `<html>` element change.
- Visual: font size changes, color scheme changes, animations stop/start.
- Store: `settings` object updated.
- Persistence: settings are included in save files and autosaves.
- No SFX or logging.

## 7. Why This Design

- CSS custom properties + global classes is the simplest approach for app-wide accessibility. No prop drilling needed — any component can read CSS variables.
- Framer Motion components check `reducedMotion` prop individually because Framer Motion doesn't automatically respect the CSS class. The CSS rule handles CSS transitions/animations; the prop handles JS-driven animations.
- OS detection on mount respects user preferences without requiring manual configuration.

## 8. Feels Incomplete

- No listener for `matchMedia` changes. If the user toggles OS reduced-motion mid-session, the app doesn't respond.
- `SettingsPanel` has focus trapping but no return-focus-on-close behavior. When the panel closes, focus goes to... wherever React puts it.
- High contrast mode defines CSS variables (`--color-bg`, `--color-text`, `--color-border`) but components use Tailwind classes (`bg-gaslight-ink`, `text-gaslight-fog`), not these variables. The high-contrast CSS variables appear unused — the `.high-contrast` class sets them but nothing reads them. The actual visual effect comes from the `background-color` and `color` properties set directly on the `.high-contrast` rule, which only affect elements that don't have Tailwind overrides.
- Audio volume changes in settings don't call `AudioManager.setMasterSfxVolume()`. The volume is read from `state.settings.audioVolume.sfx` at play time, so it works, but there's no immediate feedback if audio is currently playing.

## 9. Feels Vulnerable

- The `!important` on `.reduced-motion *` could conflict with inline styles or other `!important` rules. Currently no conflicts exist, but adding new animation code could be silently broken.
- `Object.assign(state.settings, partial)` in `updateSettings` does a shallow merge. If `partial` contains `audioVolume: { ambient: 0.5 }` without `sfx`, it would overwrite the entire `audioVolume` object, losing the `sfx` value. The `SettingsPanel` works around this by always spreading: `{ audioVolume: { ...settings.audioVolume, ambient: value } }`. But any other caller could trigger the bug.

## 10. Feels Like Bad Design

- The high-contrast implementation is split between CSS variables (defined but largely unused) and direct property overrides. It's unclear whether components should read `--color-bg` or use Tailwind classes. In practice, Tailwind wins and the CSS variables are dead code.
- `AccessibilityProvider` is a renderless wrapper (`<>{children}</>`) that only exists for its `useEffect` side effects. This could be a custom hook instead of a component, reducing the component tree depth.
- Settings are persisted as part of the full game state save. This means loading a save from a different device could override the user's accessibility preferences with the saved device's preferences. Settings should arguably be stored separately from game state.
