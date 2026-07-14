# Gate 1 Review — Phase 1 Live Announcer Design

## Prioritized findings

1. **High — The specified mount point does not exist in `App.tsx`.**

   **Failure:** The spec says to mount `<LiveAnnouncer>` "at the top of App's returned tree, outside every screen branch," but `App` has early returns for title, load-game, loading, case-complete, character-creation, case-selection, and game. There is no single returned tree above those branches. An implementer following the wording is likely to either duplicate the announcer in every branch or put it inside each branch's `AccessibilityProvider`; both cause the live-region DOM nodes to unmount/remount on screen changes, breaking the core pre-existing-region requirement and the proposed "same node across screen change" regression test.

   **Suggested fix:** Revise the spec to mount the announcer in `main.tsx`, not `App.tsx`. The lowest-risk shape is to render it as a root-level sibling of the app:

   ```tsx
   <React.StrictMode>
     <LiveAnnouncer />
     <ErrorBoundary>
       <LazyMotion features={domAnimation}>
         <App />
       </LazyMotion>
     </ErrorBoundary>
   </React.StrictMode>
   ```

   If the design instead keeps it inside `ErrorBoundary`, document that an app error will unmount the announcer with the failed subtree. If it is inside `LazyMotion`, it still survives screen switches, but it does not need Framer Motion context. Refactoring `App` to a single return is possible, but that is a broader structural edit than Phase 1 needs.

2. **High — Announcements can be published before the live regions pre-exist.**

   **Failure:** `initAnnouncerSubscription()` is proposed to run in `main.tsx` before React mounts `<LiveAnnouncer>`. If any store mutation calls `announce()` before the empty live-region nodes have committed, the message either becomes initial content on first mount, which screen readers generally do not announce, or is effectively lost. This contradicts the design's central premise.

   **Suggested fix:** Add an explicit readiness contract. `<LiveAnnouncer>` should first commit empty regions, then mark the announcer as ready from an effect, and only then flush queued messages. `announce()` calls before readiness should queue the latest message per channel or a small FIFO, but `getAnnouncerSnapshot()` must remain empty until readiness so the first DOM insertion is not pre-populated content. If the subscription remains, initialize it only after readiness or make it publish into that queue. Add a test for `announce('x')` before mount: initial live regions are empty, then a post-mount update inserts `x`.

3. **High — The proposed Phase 1 store events are not additive; they overlap existing live regions.**

   **Failure:** The spec says the subscription will wire events that have "no reliable SR home today," but several proposed diffs already feed local live regions:

   - `goToScene()` turns on-enter effects into `lastEffectMessages`, and `EffectFeedback` renders them inside `aria-live="polite"` with `role="status"`. This already covers composure, vitality, suspicion, disposition, and reputation effect messages.
   - `ComposureMeter` and `VitalityMeter` also render polite live descriptors (`Shaken`, `Steadied`, `Bruised`, `Mended`) when those values change.
   - `OutcomeBanner`, `DiceRollOverlay`, `ClueDiscoveryCard`, failed clue prompts, encounter reaction feedback, loading states, and the save toast already have local live/status/alert behavior and must remain excluded.

   A single on-enter composure loss could become three announcements: an effect message, the meter descriptor, and the global `Composure fell to 4`. Suspicion/reputation shifts would similarly duplicate `EffectFeedback`. That violates the additive-scope constraint and creates noisy speech output.

   **Suggested fix:** Add an overlap matrix to the spec and narrow Phase 1's subscription list. For a pure substrate phase, remove `initAnnouncerSubscription()` entirely and test the API through direct `announce()` calls. If Phase 1 must include one product event, prefer only a true gap such as halt entry, and suppress the lower-priority stat-drop announcement when the same transition produces the halt. Do not globally announce on-enter effect diffs unless the same change also removes or disables the existing local live output, which would no longer be additive.

4. **Medium — The repeated-message nonce mechanism is unreliable and leaks implementation detail.**

   **Failure:** Appending zero-width spaces is not guaranteed to make every screen reader re-announce identical text, and it is not guaranteed to stay inaudible across AT/browser combinations. It also leaks into `textContent`, Testing Library assertions, copied text, and snapshots. A separate visually-hidden counter inside the live region is not clearly safer: if exposed, it can be spoken; if `aria-hidden`, it may not produce an accessibility-tree change that causes re-announcement.

   **Suggested fix:** Keep the accessible text equal to the message and force a real DOM insertion instead. Two practical options:

   - Clear the channel, then insert the same message on the next task/microtask when the message repeats.
   - Pre-mount two slots per politeness channel and alternate which empty slot receives the message, clearing the other slot.

   The second option is more deterministic and avoids timing sensitivity, at the cost of rendering four live-region nodes instead of one polite/assertive pair. Either way, tests should assert the visible/accessibility text is exactly the message, without hidden nonce characters.

5. **Medium — The `useSyncExternalStore` approach is sound only if snapshot caching and subscription idempotence are specified.**

   **Failure:** `useSyncExternalStore` is the right API for a bare external store, and it should not itself cause tearing or double announcements. The under-specified part is implementation detail: if `getAnnouncerSnapshot()` returns a fresh `{ polite, assertive }` object on every call, React can warn that the snapshot is uncached and may re-render indefinitely. Separately, if `initAnnouncerSubscription()` is ever moved into a React effect to solve readiness, StrictMode's mount/unmount/remount cycle can create duplicate Zustand subscriptions unless cleanup or singleton idempotence is explicit. Tests and HMR can also call init more than once.

   **Suggested fix:** Require a module-level cached snapshot object that is replaced only when `announce()` changes state. `subscribeAnnouncer()` should add/remove listeners without side effects. `initAnnouncerSubscription()` should either return an unsubscribe and be owned by a component effect, or be idempotent with a test proving duplicate init does not double-call `announce()`.

6. **Medium — Last-write-wins conflicts with the proposed multi-event subscription.**

   **Failure:** The spec accepts last-write-wins for rapid announcements, but the proposed subscription can generate several polite messages during one user action: scene change, on-enter composure/vitality changes, suspicion/reputation changes, and effect feedback. React may batch external-store notifications so only the final polite snapshot reaches the DOM. That means the design can both duplicate some local announcements and silently drop other global ones.

   **Suggested fix:** Either keep Phase 1 to the announcer substrate and defer event routing, or define a minimal queue policy per channel before wiring store diffs. If the design intentionally keeps last-write-wins, the event list must be restricted to events where losing earlier messages is acceptable.

## Sound parts of the design

- The spec correctly identifies that `AccessibilityProvider` cannot host persistent live regions because it is mounted separately per `App` branch.
- A tiny external announcer store plus `useSyncExternalStore` is a reasonable architecture if snapshots are cached and publication has no render-time side effects.
- Avoiding `Date.now()` and `Math.random()` is correct for this repo's determinism constraints.
- Leaving `SceneText` F-049 and the save toast untouched is the right instinct; those are exactly the kinds of local live behaviors Phase 1 should not casually consolidate.
- Bare pre-mounted `aria-live` regions are a defensible baseline. Adding `role="status"` or `role="alert"` can remain a target-AT compatibility decision rather than a Phase 1 assumption.

## Overall verdict

The design is **not sound to proceed as-is**. It has the right substrate idea, but the implementation plan must change before coding.

Must-change items:

1. Move the mount instruction from `App.tsx` to the true root in `main.tsx`, with explicit ErrorBoundary/StrictMode behavior.
2. Add a readiness/queue contract so no announcement is rendered as initial live-region content before the regions pre-exist.
3. Replace the zero-width-space nonce with a repeat strategy that keeps the accessible text equal to the message.
4. Narrow or remove `initAnnouncerSubscription()` for Phase 1; do not globally announce composure, vitality, suspicion, or reputation diffs that already surface through existing live regions.
5. Specify cached `useSyncExternalStore` snapshots and idempotent/cleaned-up subscription initialization.
