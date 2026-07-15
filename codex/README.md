# Codex cross-provider review (file-based handoff)

A **file-based** channel for having Codex (a different model provider) adversarially review work at
three checkpoints — the **latest spec**, the **latest plan**, or a **completed implementation** (a final
pass before merge/PR) — before it goes forward. It exists because the Codex MCP tool's auth to its
Bedrock backend is unreliable in-session; a file handoff sidesteps that entirely — Claude writes a
prompt, the user runs Codex in their own terminal, Codex writes a review back.

**Scope:** three sanctioned targets — (a) a spec, (b) a plan (`docs/superpowers/*`), and (c) a
**completed, self-contained implementation** (a finished sub-project / merge-ready branch), reviewed
against its actual committed diff + built code, plus its spec/plan for fidelity, as the last gate before
it ships. **Not** for arbitrary mid-flight code diffs — those stay with the normal (in-session) review
flow. The implementation pass runs *after* the internal reviews pass and the gate is green, not instead
of them. Full details + the per-target adversarial charge live in `CLAUDE.md` ("Cross-provider review
with Codex").

## Layout

```
codex/
├── input/    Claude writes the review PROMPT here
└── output/   Codex writes its REVIEW here
```

## Naming

- **Prompt (input):**  `codex/input/<yyyy-mm-dd>-<name>.md`
- **Review (output):** `codex/output/<yyyy-mm-dd>-<name>-review.md`

Same date + name; the output carries a `-review` suffix. Date is the day the review is requested.
`<name>` disambiguates the target so a sub-project's spec/plan/impl reviews don't collide — use the
spec/plan name for those, and suffix the implementation pass with `-impl`
(e.g. `2026-07-13-sp2-world-document-store-impl` → `…-impl-review`).

## The loop

1. **Claude** writes a self-contained adversarial prompt to `codex/input/<dated-name>.md`. It must carry
   everything Codex needs (Codex has **no** conversation memory): the goal, the spec/plan path to review,
   the codebase files to ground claims against, project constraints, the "assume ≥1 real defect — find
   it" charge, and an explicit instruction to **write the review to
   `codex/output/<dated-name>-review.md`**.
2. **User** runs Codex in their terminal, pointed at the input file, e.g.:
   `codex exec "$(cat codex/input/<dated-name>.md)"`  (read-only sandbox — never grant write for a review).
3. **Codex** reads the referenced files and writes its review to `codex/output/<dated-name>-review.md`.
4. **Claude** reads the output file, addresses valid findings (or explains disagreement explicitly),
   and reports.

Both prompts and reviews are **committed** as a durable cross-provider review trail.
