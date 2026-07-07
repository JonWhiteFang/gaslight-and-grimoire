/**
 * useFocusTrap — shared modal focus management for overlay dialogs (F-007).
 *
 * Attach the returned ref to the dialog container. While mounted the hook:
 *   - captures the element focused before the dialog opened
 *   - moves focus to the first focusable descendant (or the container)
 *   - keeps Tab / Shift+Tab cycling within the container
 *   - restores focus to the captured element on unmount
 *
 * Extracted from the pattern SettingsPanel implemented inline, so every overlay
 * (EvidenceBoard, CaseJournal, NPCGallery) gets the same behaviour.
 */
import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remember what had focus so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    // Move focus into the dialog: first focusable, else the container itself.
    const initial = focusables()[0];
    if (initial) {
      initial.focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container!.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the invoking element if it is still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return containerRef;
}
