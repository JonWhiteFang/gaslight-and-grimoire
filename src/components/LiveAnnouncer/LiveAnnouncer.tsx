/**
 * LiveAnnouncer — the app's single, always-mounted screen-reader announcer
 * (UI/UX roadmap Phase 1). Renders two sr-only aria-live nodes per channel
 * (polite, assertive) so a repeated identical message re-announces by moving to
 * the other slot. Subscribes to the announcer store and marks it ready on mount
 * (after the empty regions have committed). Mount this ONCE at the app root
 * (src/main.tsx), never inside a per-screen wrapper.
 */
import { useSyncExternalStore, useEffect } from 'react';
import { subscribeAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../announcer';

export function LiveAnnouncer() {
  const snapshot = useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot);

  // Mark ready AFTER the empty regions have committed, so the first DOM state is
  // empty (screen readers only announce changes to a pre-existing region).
  useEffect(() => {
    markAnnouncerReady();
  }, []);

  const { polite, assertive, politeSlot, assertiveSlot } = snapshot;

  return (
    <>
      <div aria-live="polite" className="sr-only">{politeSlot === 0 ? polite : ''}</div>
      <div aria-live="polite" className="sr-only">{politeSlot === 1 ? polite : ''}</div>
      <div aria-live="assertive" className="sr-only">{assertiveSlot === 0 ? assertive : ''}</div>
      <div aria-live="assertive" className="sr-only">{assertiveSlot === 1 ? assertive : ''}</div>
    </>
  );
}
