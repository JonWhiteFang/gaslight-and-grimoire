/**
 * AccessibilityProvider
 *
 * Reads settings from the Zustand store and applies CSS custom properties
 * and class names to document.documentElement so all child components
 * automatically pick up font-size, high-contrast, and reduced-motion changes.
 *
 * Requirements: 12.1, 12.2, 12.4
 */
import { useEffect } from 'react';
import { useSettings } from '../../store';

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

function fontSizeToPx(fontSize: 'standard' | 'large' | 'extraLarge' | number): string {
  if (fontSize === 'standard') return '16px';
  if (fontSize === 'large') return '20px';
  if (fontSize === 'extraLarge') return '24px';
  return `${fontSize}px`;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const { fontSize, highContrast, reducedMotion } = useSettings();

  // Apply --font-size-base CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-size-base',
      fontSizeToPx(fontSize),
    );
  }, [fontSize]);

  // Apply high-contrast class and --high-contrast property
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.classList.add('high-contrast');
      root.style.setProperty('--high-contrast', '1');
    } else {
      root.classList.remove('high-contrast');
      root.style.setProperty('--high-contrast', '0');
    }
  }, [highContrast]);

  // Apply reduced-motion class
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [reducedMotion]);

  return <>{children}</>;
}
