/**
 * SceneText — displays narrative text with a typewriter effect.
 * Click/tap to skip to full text.
 *
 * Req 2.2, 2.3
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

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
      return;
    }

    if (reducedMotion || textSpeed === 'instant') {
      setDisplayed(text);
      setAnimating(false);
      onCompleteRef.current?.();
      return;
    }

    const { chars, ms } = SPEED_CONFIG[textSpeed] ?? SPEED_CONFIG.typewriter;
    let index = 0;
    setDisplayed('');
    setAnimating(true);

    intervalRef.current = setInterval(() => {
      index += chars;
      if (index >= text.length) {
        setDisplayed(text);
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setAnimating(false);
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
    <p
      className={`text-gaslight-fog font-serif leading-relaxed whitespace-pre-wrap ${animating ? 'cursor-pointer' : ''}`}
      aria-live="polite"
      aria-label="Scene narrative"
      onClick={animating ? skipToEnd : undefined}
      role={animating ? 'button' : undefined}
    >
      {displayed}
    </p>
  );
}
