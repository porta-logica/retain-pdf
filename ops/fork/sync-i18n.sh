#!/usr/bin/env bash
# Fork only — job 2 of docs/ops/planning/i18n/20261126-fork-maintenance.md:
# merge the mirrored upstream `main` into `i18n` on a new branch `sync/<date>`, push it, and report.
# It never changes `i18n` itself: the owner reviews the branch and says "merge".
#
# Steps:
#   1. fetch origin; stop if origin/i18n already contains origin/main
#   2. in a dedicated worktree, branch sync/<date> from origin/i18n and merge origin/main
#   3. devlog CSV conflicts -> ops/fork/resolve_devlog_conflict.py (no AI)
#   4. any other conflicts -> headless Claude (`claude -p`) with read/edit tools only; it explains each resolution
#   5. quick checks (devlog format, .github script tests, translation status), commit, push, notify
#
# Installed as ~/.local/bin/retain-pdf-sync-i18n by ops/fork/install-sync-timer.sh; run it by hand any time.
# Environment:
#   RETAIN_SYNC_REPO       main checkout (default: /home/$USER/Projects/IdeaProjects/retain-pdf)
#   RETAIN_SYNC_WORKTREE   dedicated worktree (default: <repo>/../retain-pdf-sync)
#   RETAIN_SYNC_NO_AI=1    do not call Claude; stop and report if non-devlog conflicts remain
#   RETAIN_SYNC_NO_PUSH=1  do everything except pushing (for trying it out)
#   RETAIN_SYNC_BASE / RETAIN_SYNC_UPSTREAM   refs to merge into / from (default origin/i18n / origin/main; for tests)
set -euo pipefail

REPO=${RETAIN_SYNC_REPO:-$HOME/Projects/IdeaProjects/retain-pdf}
WORKTREE=${RETAIN_SYNC_WORKTREE:-$(dirname "$REPO")/retain-pdf-sync}
STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/retain-pdf-sync
BASE=${RETAIN_SYNC_BASE:-origin/i18n}
UPSTREAM=${RETAIN_SYNC_UPSTREAM:-origin/main}
DATE=$(date +%F)
mkdir -p "$STATE_DIR"
LOG="$STATE_DIR/$DATE-$(date +%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

notify() { # title, body
  command -v notify-send >/dev/null 2>&1 && notify-send --app-name="retain-pdf sync" "$1" "$2" || true
}
fail() {
  echo "FAILED: $1"
  notify "retain-pdf: main → i18n sync failed" "$1 (log: $LOG)"
  exit 1
}
trap 'fail "unexpected error at line $LINENO"' ERR

echo "== retain-pdf main -> i18n sync, $(date -Is)"
# Explicit refspecs: the clone may fetch only main from origin (single-branch), and origin/i18n must be current.
git -C "$REPO" fetch -q origin \
  +refs/heads/main:refs/remotes/origin/main +refs/heads/i18n:refs/remotes/origin/i18n \
  || fail "git fetch origin failed (network or SSH agent?)"

if git -C "$REPO" merge-base --is-ancestor "$UPSTREAM" "$BASE"; then
  echo "i18n already contains main ($(git -C "$REPO" rev-parse --short "$UPSTREAM")); nothing to do."
  exit 0
fi
behind=$(git -C "$REPO" rev-list --count "$BASE..$UPSTREAM")
echo "i18n is $behind commit(s) behind main."

branch="sync/$DATE"
if git -C "$REPO" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  branch="sync/$DATE-$(date +%H%M)"
fi

if [ ! -d "$WORKTREE" ]; then
  git -C "$REPO" worktree add -q --detach "$WORKTREE" "$BASE"
fi
cd "$WORKTREE"
git merge --abort >/dev/null 2>&1 || true
git reset -q --hard
git clean -qfd
git checkout -q -B "$branch" "$BASE"

resolutions=""
if git merge --no-ff --no-commit "$UPSTREAM" >/dev/null 2>&1; then
  echo "Merged without conflicts."
else
  mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
  [ "${#conflicts[@]}" -gt 0 ] || fail "merge failed without conflicts"
  echo "Conflicts: ${conflicts[*]}"

  devlogs=() others=()
  for path in "${conflicts[@]}"; do
    case "$path" in
      docs/ops/devlog/*.csv) devlogs+=("$path") ;;
      *) others+=("$path") ;;
    esac
  done
  if [ "${#devlogs[@]}" -gt 0 ]; then
    python3 ops/fork/resolve_devlog_conflict.py "${devlogs[@]}"
    git add -- "${devlogs[@]}"
    resolutions+="- devlog: kept upstream's rows plus the fork's new rows (${devlogs[*]})"$'\n'
  fi

  if [ "${#others[@]}" -gt 0 ]; then
    [ "${RETAIN_SYNC_NO_AI:-}" != "1" ] || fail "conflicts need a human or Claude: ${others[*]}"
    command -v claude >/dev/null 2>&1 || fail "claude CLI not found; conflicts: ${others[*]}"
    echo "Asking Claude to resolve: ${others[*]}"
    prompt="You are resolving a git merge in progress in $WORKTREE: upstream's main (origin/main, 'theirs') is being merged into this fork's i18n branch ('ours').
Conflicted files: ${others[*]}

Rules:
- Upstream owns its code and docs: keep upstream's version of upstream content, then re-apply the fork's intent on top of it.
- Fork-only content (translations/, ops/fork/, locales/, .github/workflows/fork-*, docs/ops/planning/i18n/, CLAUDE.fork.md and the single line `@CLAUDE.fork.md` near the top of CLAUDE.md) must be kept.
- Use git show :1:<path> (base), :2:<path> (ours/fork), :3:<path> (theirs/upstream) and git log to understand both sides.
- Edit only the conflicted files; remove every conflict marker. Do not run git add, git commit or any other command that changes state.
- If a conflict cannot be resolved safely, leave its markers in place and say why.
Finally print, for each file, one or two lines: what each side changed and how you resolved it."
    if ! claude -p "$prompt" \
        --allowedTools "Read" "Edit" "Grep" "Glob" "Bash(git show:*)" "Bash(git diff:*)" "Bash(git log:*)" "Bash(git status:*)" \
        > "$STATE_DIR/claude-$DATE.txt"; then
      fail "Claude exited with an error; see $STATE_DIR/claude-$DATE.txt"
    fi
    cat "$STATE_DIR/claude-$DATE.txt"
    for path in "${others[@]}"; do
      if grep -qE '^(<<<<<<<|=======|>>>>>>>)( |$)' -- "$path"; then
        fail "conflict markers left in $path; Claude's notes: $STATE_DIR/claude-$DATE.txt"
      fi
    done
    git add -- "${others[@]}"
    resolutions+="- resolved by Claude: ${others[*]}"$'\n'"$(sed 's/^/  /' "$STATE_DIR/claude-$DATE.txt")"$'\n'
  fi
fi

echo "== quick checks"
checks=""
python3 ops/development/check_devlog.py >/dev/null && checks+="devlog format OK; " || fail "devlog format check failed"
if python3 -m pytest --version >/dev/null 2>&1; then
  python3 -m pytest -q .github/scripts/tests >/dev/null && checks+=".github script tests OK; " || fail ".github script tests failed"
else
  checks+=".github script tests not run (no pytest); "
fi
translations=$(python3 translations/tools/translation_status.py 2>/dev/null | head -1 || echo "translation status unavailable")
checks+="translations: $translations"

git commit -q -F - <<EOF
Merge branch 'main' into i18n: bring in $behind upstream commit(s) (automatic sync $DATE)

${resolutions:-No conflicts.}
Checks: $checks
EOF
echo "Committed $(git rev-parse --short HEAD) on $branch. $checks"
python3 translations/tools/translation_status.py --stale 2>/dev/null | sed 's/^/stale translation: /' || true

if [ "${RETAIN_SYNC_NO_PUSH:-}" = "1" ]; then
  echo "RETAIN_SYNC_NO_PUSH=1: not pushing."
  notify "retain-pdf: sync ready (not pushed)" "$branch: $behind upstream commit(s); see $LOG"
  exit 0
fi
git push -q -u origin "$branch" || fail "git push failed"
url="https://github.com/$(git remote get-url origin | sed -E 's#^(git@github.com:|https://github.com/)##; s#\.git$##')/compare/i18n...$branch"
echo "Pushed $branch. Review: $url"
notify "retain-pdf: main → i18n sync ready" "$branch: $behind upstream commit(s). Review and say \"merge\". $url"
