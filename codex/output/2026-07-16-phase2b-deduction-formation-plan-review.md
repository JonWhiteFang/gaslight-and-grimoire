# Codex review - Phase 2b deduction formation implementation plan

## Findings

### Blocker - The successful formation path never concretely claims a contested token

**Grounding:** Task 4, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:531-625`;
Task 7, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:885-923`;
`src/store/slices/evidenceSlice.ts:40-45`.

**Failure scenario:** Attempt A fails for `{c1,c2}`, so `contestClues` stores token `gen=1` and prior
status `examined` for `c1`. Before A's timer fires, attempt B forms a valid deduction using `{c1,c3}`.
The Task 7 code only calls the existing `updateClueStatus(c1, 'deduced')`; that action does not change
`contestedTokens`. A's timer still sees `contestedTokens.c1 === 1` and restores `c1` to `examined`,
leaving a persisted deduction whose clue is no longer `deduced`.

The Task 4 test avoids this failure by calling a hypothetical `claimClues`, but the proposed
`EvidenceSlice` interface and implementation never define it. Deferring the claim to Task 7 also makes
Task 4's promised green commit impossible as written. The comments at lines 920-922 restate the
requirement but do not implement it.

**Suggested fix:** Specify and implement a real atomic store action in Task 4, such as
`markCluesDeduced(ids)`, that invalidates each current token and sets `deduced` in the same `set`.
Task 7 must call that action. Add a board-level fake-timer test that drives fail -> success without
manually invoking an ownership helper, then advances A's timer and asserts `c1` remains `deduced`.

### Blocker - Pending revert timers are neither tracked nor cancelled on reset/load

**Grounding:** Task 4, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:494-502,545-550,593-632`;
the Task 4 file list omits `src/store/slices/metaSlice.ts`; the live load assignment is
`src/store/slices/metaSlice.ts:113-134`.

**Failure scenario:** A failed attempt schedules an anonymous timer with `gen=1`. Loading a save
replaces `clues` but, under the plan, leaves `contestedTokens` and `attemptSeq` untouched because
`metaSlice.loadGame` is never changed. When the old timer fires, it can restore an old prior status into
the newly loaded clue with the same id. New-case reset is also unsafe: it clears tokens and resets the
sequence to zero but cannot cancel the anonymous timer. If a new attempt obtains `gen=1` before the old
timer fires, the old callback mistakes the new token for its own and clobbers the new attempt.

The proposed reset test is a false-green: it does not call `resetForNewCase`, advance a timer, or contain
an assertion, and it schedules a real two-second timer. This diverges from the spec's explicit
reset/load cancellation contract and reintroduces the timer-ownership blocker across lifecycle changes.

**Suggested fix:** Keep timer handles in a non-serialised registry keyed by generation, remove them when
they fire, and expose a cancellation/reset helper used by both successful `resetForNewCase` flows and
`metaSlice.loadGame` immediately before committing loaded state. Clear tokens only together with timer
cancellation. Test load/reset followed by a same-id new attempt before the old deadline.

### Major - Fail-to-fail overlap restores `contested` and strands the clue

**Grounding:** Task 4, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:521-551,596-617`;
Task 7, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:903-907`; required coverage in
`docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:329-334`.

**Failure scenario:** A fails `{c1,c2}` while `c1` is `examined`, making it `contested` under token 1.
Before A reverts, B fails `{c1,c4}`. Task 7 snapshots B's current prior status as `contested`, then B
claims token 2. A correctly does nothing, but B later restores its captured value, `contested`, and
deletes the token. No timer now owns `c1`, so it remains contested permanently.

The plan omits the spec-required fail-to-fail test, so this passes the proposed suite.

**Suggested fix:** Store each clue's baseline semantic prior status alongside its token. Re-contesting an
already contested clue must carry forward that baseline rather than snapshot `contested`. Add the exact
A/B fake-timer test and assert `c1` ultimately returns to its original status.

### Major - A current-version v5 save can reload with `contested` forever

**Grounding:** Task 5, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:653-714`;
`src/engine/saveManager.ts:178-187`; spec requirement
`docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:207-210`.

**Failure scenario:** After Phase 2b, a failed attempt marks clues contested, the player closes the board,
and a v5 save is written before the two-second store timer fires. On reload there is no owning timer.
`migrate` returns immediately when `saveFile.version === CURRENT_SAVE_VERSION`, while the proposed
normalisation only runs inside `if (version < 5)`. The v5 clue therefore stays contested forever.

The v4 fixtures all pass, as do versionless saves through the existing migration chain, so the proposed
tests do not expose this all-versions load-normalisation defect.

**Suggested fix:** Apply transient `contested -> examined` normalisation on every load, including current
version files, outside the v4 -> v5 conditional/early return. Add a v5 contested fixture plus a second
migration call to pin idempotence. Keep `connected` recovery in the v4 -> v5 step.

### Major - A success/critical roll leaves the mounted deduction button permanently locked

**Grounding:** Task 7, `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md:866-875`;
`src/components/EvidenceBoard/DeductionButton.tsx:36-40,48-68,76-95`.

**Failure scenario:** An attempt rolls `success` or `critical`, so the retained button phase becomes
`success`. The board clears connections and the button returns `null` for fewer than two ids, but the
component remains mounted and preserves its hook state. When the player connects a second clue-set in
the same board session, the button reappears as disabled `Deduction Locked`; no later deduction can be
attempted until the entire board is closed and reopened.

Moving the old revert timer out of the button also removes the only delayed phase reset, and the proposed
tests exercise only one attempt per mount.

**Suggested fix:** Reset local phase whenever the attempted connection signature is cleared/changes, or
reduce local state to the synchronous `rolling` phase and let the board-owned banner carry the result.
Add an integration test that forms one deduction, connects another pair without unmounting the board,
and successfully attempts again.

## Verified Areas

The proposed oracle correctly handles mixed authored/unauthored internal edges, all matching recipes,
red-herring precedence, and fail-closed endpoints. The validator rules are placed in the shared
`validateBundle` path; all eight shipped cases currently validate, all shipped clue ids satisfy the
proposed charset, and no authored recipe occupies the reserved prefix.

**Verdict:** The plan is not sound to implement as written; the token claim and timer lifecycle blockers
must be made concrete before implementation, and the overlap, load normalisation, and repeat-attempt
gaps need tests and fixes.
