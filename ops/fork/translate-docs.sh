#!/usr/bin/env bash
# Fork only — job 3 of docs/ops/planning/i18n/20261126-fork-maintenance.md:
# keep translations/en/ current and translate the next documents, on a branch `translations/<date>`.
# It never changes `i18n` itself: the owner reviews the branch and says "merge".
#
# Steps:
#   1. fetch origin; in a dedicated worktree branch translations/<date> from origin/i18n
#   2. stale translations (original changed upstream): Claude updates only what `--diff` shows
#   3. up to RETAIN_TRANSLATE_MAX new documents, taken from the areas in RETAIN_TRANSLATE_AREAS in order
#   4. one headless Claude call per file, allowed to write only under translations/en/; the script verifies that
#   5. --fix-links, --record, --check, commit, push, notify
#
# Installed as ~/.local/bin/retain-pdf-translate-docs by ops/fork/install-sync-timer.sh; run it by hand any time.
# Environment:
#   RETAIN_SYNC_REPO            main checkout (default: /home/$USER/Projects/IdeaProjects/retain-pdf)
#   RETAIN_TRANSLATE_WORKTREE   dedicated worktree (default: <repo>/../retain-pdf-translate)
#   RETAIN_TRANSLATE_MAX        new documents per run (default 10; stale ones are always updated)
#   RETAIN_TRANSLATE_AREAS      space-separated path prefixes, in order (default "docs/core docs/api docs/reference")
#   RETAIN_TRANSLATE_BASE       ref to branch from (default origin/i18n; for tests)
#   RETAIN_SYNC_NO_PUSH=1       do everything except pushing
set -euo pipefail

REPO=${RETAIN_SYNC_REPO:-$HOME/Projects/IdeaProjects/retain-pdf}
WORKTREE=${RETAIN_TRANSLATE_WORKTREE:-$(dirname "$REPO")/retain-pdf-translate}
MAX=${RETAIN_TRANSLATE_MAX:-10}
AREAS=${RETAIN_TRANSLATE_AREAS:-docs/core docs/api docs/reference}
BASE=${RETAIN_TRANSLATE_BASE:-origin/i18n}
STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/retain-pdf-translate
DATE=$(date +%F)
mkdir -p "$STATE_DIR"
LOG="$STATE_DIR/$DATE-$(date +%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

notify() {
  command -v notify-send >/dev/null 2>&1 && notify-send --app-name="retain-pdf translations" "$1" "$2" || true
}
fail() {
  echo "FAILED: $1"
  notify "retain-pdf: translation job failed" "$1 (log: $LOG)"
  exit 1
}
trap 'fail "unexpected error at line $LINENO"' ERR

echo "== retain-pdf translation job, $(date -Is)"
command -v claude >/dev/null 2>&1 || fail "claude CLI not found"
git -C "$REPO" fetch -q origin +refs/heads/i18n:refs/remotes/origin/i18n \
  || fail "git fetch origin failed (network or SSH agent?)"

branch="translations/$DATE"
if git -C "$REPO" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  branch="translations/$DATE-$(date +%H%M)"
fi
if [ ! -d "$WORKTREE" ]; then
  git -C "$REPO" worktree add -q --detach "$WORKTREE" "$BASE"
fi
cd "$WORKTREE"
git reset -q --hard
git clean -qfd
git checkout -q -B "$branch" "$BASE"

STATUS="python3 translations/tools/translation_status.py"
mapfile -t stale < <($STATUS --stale | sed '/^$/d')
new=()
for area in $AREAS; do
  [ "${#new[@]}" -lt "$MAX" ] || break
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    [ "${#new[@]}" -lt "$MAX" ] || break
    new+=("$path")
  done < <($STATUS --untranslated --prefix "$area")
done
echo "stale: ${#stale[@]}; new: ${#new[@]} (max $MAX from: $AREAS)"
if [ "${#stale[@]}" -eq 0 ] && [ "${#new[@]}" -eq 0 ]; then
  echo "Nothing to translate."
  exit 0
fi

CONVENTIONS="Conventions (also in translations/README.md):
- Output is translations/en/<original path>. Translate everything: no summarising, no omitted sections, table rows,
  list items, or comments inside code blocks.
- Keep Markdown structure, heading levels, tables, code, commands, paths, identifiers, URLs and link targets
  byte-identical; translate link text only. Keep Chinese file and directory names in paths as they are.
- Literal Chinese that code matches or users copy (UI strings, prompts, templates in code blocks): keep it and add the
  English in parentheses, or an English rendering right after the block.
- Terms: 领域 domain, 任务 job, 书库 library, 术语表 glossary, 产物 artifact, 流水线 pipeline, 接口 endpoint/API,
  快照 snapshot, 开发记录 devlog, 合 merge, 推送 push.
- The first line is: > English translation of [<original path>](<relative link from the translation to the original>). The Chinese original is authoritative.
  followed by one empty line.
- Write only the one translation file you were asked for. Do not run commands that change anything."
TOOLS=("Read" "Glob" "Grep" "Write(translations/en/**)" "Edit(translations/en/**)"
       "Bash(python3 translations/tools/translation_status.py --diff:*)" "Bash(git show:*)" "Bash(git log:*)")

done_files=() failed_files=()
translate() { # mode(update|new), path
  local mode=$1 path=$2 prompt
  if [ "$mode" = update ]; then
    prompt="Update the English translation translations/en/$path of $path in the repository at $WORKTREE.
The Chinese original changed since it was translated. Run: python3 translations/tools/translation_status.py --diff $path
Change the translation only where the original changed (added, removed or reworded parts); leave the rest as it is.
$CONVENTIONS"
  else
    prompt="Translate the Chinese document $path in the repository at $WORKTREE into English and write it to translations/en/$path.
$CONVENTIONS"
  fi
  echo "-- $mode: $path"
  if claude -p "$prompt" --allowedTools "${TOOLS[@]}" > "$STATE_DIR/claude-$DATE-$(echo "$path" | tr '/' '_').txt" 2>&1 \
     && [ -s "translations/en/$path" ] && head -1 "translations/en/$path" | grep -q '^> English translation of '; then
    done_files+=("$path")
  else
    echo "   failed (see $STATE_DIR)"
    git checkout -q -- "translations/en/$path" 2>/dev/null || rm -f "translations/en/$path"
    failed_files+=("$path")
  fi
}
for path in "${stale[@]}"; do translate update "$path"; done
for path in "${new[@]}"; do translate new "$path"; done

# Claude may only have touched translations/en/; anything else means the run is not trustworthy.
outside=$(git status --porcelain --untracked-files=all | awk '{print $NF}' | grep -v '^translations/en/' || true)
[ -z "$outside" ] || fail "files changed outside translations/en/: $outside"
[ "${#done_files[@]}" -gt 0 ] || fail "no file was translated (${#failed_files[@]} failed)"

$STATUS --fix-links
$STATUS --record "${done_files[@]}"
$STATUS --check || fail "translation check failed (broken links or manifest)"

# Sanity: a translation is roughly as long as its original (header adds 2 lines).
warnings=""
for path in "${done_files[@]}"; do
  src=$(wc -l < "$path") dst=$(wc -l < "translations/en/$path")
  if [ "$dst" -lt $((src * 8 / 10)) ] || [ "$dst" -gt $((src * 13 / 10 + 5)) ]; then
    warnings+="- check length: $path ($src lines -> $dst)"$'\n'
  fi
done

summary=$($STATUS | head -1)
git add translations
git commit -q -F - <<EOF
docs(translations): ${#done_files[@]} translation(s) updated or added (automatic $DATE)

Stale updated: ${#stale[@]} planned; new: ${#new[@]} planned (max $MAX from: $AREAS).

Translated: ${done_files[*]}
${failed_files:+Failed (not included): ${failed_files[*]}}
${warnings:+Length warnings:
$warnings}
Status after this run: $summary
EOF
echo "Committed $(git rev-parse --short HEAD) on $branch. $summary"
[ -z "$warnings" ] || printf '%s' "$warnings"

if [ "${RETAIN_SYNC_NO_PUSH:-}" = "1" ]; then
  echo "RETAIN_SYNC_NO_PUSH=1: not pushing."
  notify "retain-pdf: translations ready (not pushed)" "$branch: ${#done_files[@]} file(s); see $LOG"
  exit 0
fi
git push -q -u origin "$branch" || fail "git push failed"
url="https://github.com/$(git remote get-url origin | sed -E 's#^(git@github.com:|https://github.com/)##; s#\.git$##')/compare/i18n...$branch"
echo "Pushed $branch. Review: $url"
notify "retain-pdf: translations ready" "$branch: ${#done_files[@]} file(s)${failed_files:+, ${#failed_files[@]} failed}. Review and say \"merge\". $url"
