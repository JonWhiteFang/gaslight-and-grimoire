/**
 * SceneText — displays narrative text with a typewriter effect.
 * Click/tap to skip to full text.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const SPEED_CONFIG = {
  typewriter: { chars: 2, ms: 30 },
  fast: { chars: 6, ms: 15 },
} as const;

export interface SceneTextProps {
  text: string;
  textSpeed?: 'typewriter' | 'fast' | 'instant';
  reducedMotion?: boolean;
  onComplete?: () => void;
}

export function SceneText({ text, textSpeed = 'typewriter', reducedMotion = false, onComplete }: SceneTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [animating, setAnimating] = useState(false);
  // The text exposed to screen readers — set once the full narrative is shown
  // (instant, reduced-motion, animation complete, or skipped) and blanked while
  // a new scene animates, so `aria-live` announces each scene exactly once and
  // never mid-typewriter (F-049). State-driven (not read from `animating` at
  // render) so a scene change on a reused instance can't briefly leak the text.
  const [srText, setSrText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textRef = useRef(text);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => { textRef.current = text; }, [text]);

  const skipToEnd = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayed(textRef.current);
    setAnimating(false);
    setSrText(textRef.current);
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!text) {
      setDisplayed('');
      setAnimating(false);
      setSrText('');
      return;
    }

    if (reducedMotion || textSpeed === 'instant') {
      setDisplayed(text);
      setAnimating(false);
      setSrText(text);
      onCompleteRef.current?.();
      return;
    }

    const { chars, ms } = SPEED_CONFIG[textSpeed] ?? SPEED_CONFIG.typewriter;
    let index = 0;
    setDisplayed('');
    setAnimating(true);
    setSrText(''); // blank until this scene finishes animating

    intervalRef.current = setInterval(() => {
      index += chars;
      if (index >= text.length) {
        setDisplayed(text);
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setAnimating(false);
        setSrText(text);
        onCompleteRef.current?.();
      } else {
        setDisplayed(text.slice(0, index));
      }
    }, ms);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, textSpeed, reducedMotion]);

  return (
    <div>
      {/* Visible typewriter text. Hidden from assistive tech while animating —
          otherwise `aria-live` would announce every partial tick (F-049).
          Pointer users can still click it to skip. */}
      <p
        data-testid="scene-text-visible"
        aria-hidden="true"
        className={`text-gaslight-fog font-serif leading-relaxed whitespace-pre-wrap ${animating ? 'cursor-pointer' : ''}`}
        onClick={animating ? skipToEnd : undefined}
      >
        {displayed}
      </p>

      {/* Screen-reader narrative: the FULL text, exposed once the animation has
          completed (or immediately for instant/reduced-motion), so it's read in
          one piece rather than character-by-character. */}
      <p className="sr-only" aria-live="polite" aria-label="Scene narrative">
        {srText}
      </p>

      {/* Real, focusable skip control for keyboard users (a <button> handles
          Enter/Space natively — the old role=button <p> did neither). */}
      {animating && (
        <button
          type="button"
          onClick={skipToEnd}
          className="mt-1 text-xs text-gaslight-amber/80 hover:text-gaslight-amber underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gaslight-amber rounded"
        >
          Skip text animation
        </button>
      )}
    </div>
  );
}
