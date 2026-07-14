/**
 * LiveAnnouncer — the app's single, always-mounted screen-reader announcer
 * (UI/UX roadmap Phase 1). Renders two sr-only aria-live nodes per channel
 * (polite, assertive) so a repeated identical message re-announces by moving to
 * the other slot. Subscribes to the announcer store and marks it ready on mount
 * (after the empty regions have committed). Mount this ONCE at the app root
 * (src/main.tsx), never inside a per-screen wrapper.
 */
import { useSyncExternalStore, useEffect, useState } from 'react';
import { subscribeAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../announcer';

export function LiveAnnouncer() {
  const snapshot = useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot);

  // Per-mount empty-commit gate. The store's `ready` flag + messages persist at
  // module level, so on a remount (Fast Refresh, tests, a future root swap) the
  // snapshot may already be non-empty. Without this gate the first commit of the
  // new mount would render that text as *initial* region content, which screen
  // readers do not announce. Starting empty every mount, then flipping this flag
  // in the passive effect below, guarantees each mount's first commit is empty so
  // the message renders as a *change* to a pre-existing region.
  const [regionsCommitted, setRegionsCommitted] = useState(false);

  // Runs AFTER the empty regions have committed: mark the store ready (flushing
  // any pre-mount queued message) and open the local gate so the snapshot text
  // can render.
  useEffect(() => {
    markAnnouncerReady();
    setRegionsCommitted(true);
  }, []);

  const { polite, assertive, politeSlot, assertiveSlot } = snapshot;
  const politeText = regionsCommitted ? polite : '';
  const assertiveText = regionsCommitted ? assertive : '';

  return (
    <>
      <div aria-live="polite" className="sr-only">{politeSlot === 0 ? politeText : ''}</div>
      <div aria-live="polite" className="sr-only">{politeSlot === 1 ? politeText : ''}</div>
      <div aria-live="assertive" className="sr-only">{assertiveSlot === 0 ? assertiveText : ''}</div>
      <div aria-live="assertive" className="sr-only">{assertiveSlot === 1 ? assertiveText : ''}</div>
    </>
  );
}
