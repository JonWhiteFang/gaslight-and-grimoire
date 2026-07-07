#!/usr/bin/env bash
# PostToolUse "correctness check" hook — runs after Claude edits a file.
#
#   * public/content/**.json  -> content validator (scripts/validateCase.mjs)  [always on]
#   * *.ts / *.tsx            -> tsc --noEmit (whole project)                   [toggle: TYPECHECK]
#
# On failure we print the tool's own output on stderr and exit 2, which feeds the
# failure back to Claude so it can fix it in the same turn (the edit is already
# written to disk and is NOT reverted — the hook only surfaces the problem).
# On success we exit 0 quietly.
#
# Design note: content-JSON edits are atomic and self-contained, so validating
# after every one is safe and blocking. The whole-project type-check is broader —
# during a multi-file refactor an intermediate edit can legitimately fail tsc
# until the last file lands. If that gets noisy, set TYPECHECK=0 below (content
# validation stays on regardless).
set -uo pipefail

TYPECHECK=1   # set to 0 to silence the whole-project type-check

DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$DIR" || exit 0

# The tool-call payload arrives as JSON on stdin; pull out the edited file path.
file="$(cat | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0

fail() {  # $1 = label, $2 = captured output
  printf '%s failed after editing %s:\n\n%s\n' "$1" "$file" "$2" >&2
  exit 2
}

# --- Content validation: any JSON under public/content/ ----------------------
case "$file" in
  */public/content/*.json|public/content/*.json)
    if ! out="$(node scripts/validateCase.mjs 2>&1)"; then
      fail "Content validation (scripts/validateCase.mjs)" "$out"
    fi
    ;;
esac

# --- Type-check: any TypeScript source --------------------------------------
if [ "$TYPECHECK" = "1" ]; then
  case "$file" in
    *.ts|*.tsx)
      if [ -x node_modules/.bin/tsc ]; then TSC="node_modules/.bin/tsc"; else TSC="npx tsc"; fi
      if ! out="$($TSC --noEmit 2>&1)"; then
        fail "Type-check (tsc --noEmit)" "$out"
      fi
      ;;
  esac
fi

exit 0
