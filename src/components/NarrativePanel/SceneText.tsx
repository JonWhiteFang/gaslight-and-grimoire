/**
 * SceneText — displays narrative text with a typewriter effect.
 *
 * Req 2.2: When a Scene_Node is loaded, the NarrativePanel SHALL display the
 *          scene's narrative text with a typewriter effect.
 * Req 2.3: While reduced motion mode is enabled, the NarrativePanel SHALL
 *          display all text instantly without the typewriter effect.
 */
import React, { useEffect, useRef, useState } from 'react';

/** Characters revealed per tick in typewriter mode */
const CHARS_PER_TICK = 2;

/** Milliseconds between ticks */
const TICK_MS = 30;

export interface SceneTextProps {
  /** The full narrative text to display */
  text: string;
  /** When true, renders all text instantly (accessibility: reduced motion) */
  reducedMotion?: boolean;
  /** Called when the full text has been revealed */
  onComplete?: () => void;
}

export function SceneText({ text, reducedMotion = false, onComplete }: SceneTextProps) {
  const [displayed, setDisplayed] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref current without re-triggering the effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    // Clear any running interval when text or mode changes
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!text) {
      setDisplayed('');
      return;
    }

    if (reducedMotion) {
      // Instant render — no animation
      setDisplayed(text);
      onCompleteRef.current?.();
      return;
    }

    // Typewriter mode: reveal CHARS_PER_TICK characters every TICK_MS ms
    let index = 0;
    setDisplayed('');

    intervalRef.current = setInterval(() => {
      index += CHARS_PER_TICK;
      if (index >= text.length) {
        setDisplayed(text);
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onCompleteRef.current?.();
      } else {
        setDisplayed(text.slice(0, index));
      }
    }, TICK_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, reducedMotion]);

  return (
    <p
      className="text-gaslight-fog font-serif leading-relaxed whitespace-pre-wrap"
      aria-live="polite"
      aria-label="Scene narrative"
    >
      {displayed}
    </p>
  );
}
