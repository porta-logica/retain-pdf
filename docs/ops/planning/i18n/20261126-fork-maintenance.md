# Fork Maintenance: English Translations, Branches and Scheduled Agents — Proposal

Status: proposal (2026-11-26). Covers the owner's points 3–5: translate the Chinese material, keep `main` and `i18n`,
and keep both in sync with upstream on a schedule.

## Size of the Chinese material (measured 2026-11-26)

| Kind | Files | Volume |
|---|---|---|
| Documents (`.md`, `.txt`) | 759 | ~3 MB of text; `docs/ops/` alone (devlogs, plans, history) is 368 files |
| Code comments and strings | ~3,200 source files | ~52,000 lines with Chinese (`.py` 13k, `.rs` 12k, `.mjs` 10k, `.ts` 9.5k, `.tsx` 4k, `.css` 1.5k) |
| Agent instructions | `CLAUDE.md`, a few `AGENTS.md`/skill files | small, but changes often upstream |

Upstream is very active (dozens of commits per day), so anything we change *inside* upstream files becomes a merge
conflict sooner or later. The whole proposal follows from that.

## Point 3 — translating the Chinese material

**Principle: never translate upstream files in place. Keep translations beside them.**

### Documents and agent instructions → parallel tree `translations/en/`

- `translations/en/<original path>` mirrors the original (`CLAUDE.md` → `translations/en/CLAUDE.md`,
  `docs/core/contributing/backend.md` → `translations/en/docs/core/contributing/backend.md`).
- `translations/manifest.json` records, per translation, the git blob hash of the original it was made from.
  `translations/tools/translation_status.py` compares that with the current original: a changed hash means the
  translation is **stale**, and `--diff PATH` shows exactly what changed upstream since, so only that part needs
  re-translating.
- Upstream never touches `translations/`, so syncing never conflicts there.
- Order of work (most value first): entry and contributor docs (done in the first batch, 15 files) → `docs/core/`
  (architecture) → `docs/api/` → `docs/reference/` → package READMEs → `docs/ops/` (history; translate on demand only).

### Code comments → do not mass-translate

Translating 52,000 comment lines in place would put conflicts into nearly every upstream sync. Instead:

1. **On demand:** ask Claude to explain or translate a file/module while reading it ("translate the comments of
   `backend/packages/retainpdf-jobs/src/lifecycle/` into English"); nothing is written to the repo. This is the
   cheapest way to learn the code.
2. **In place, only where the i18n refactoring touches code anyway:** files that the `i18n` branch already changes
   diverge from upstream, so translating their comments in the same edit adds little extra conflict risk.
3. Optional: if a full English reading copy is wanted later, generate it into a separate, untracked directory
   (`translations/code-en/`, git-ignored), never on a branch.

### Agent instructions (`CLAUDE.md`)

- The English reading copy is `translations/en/CLAUDE.md` (kept current like any other document).
- Claude itself reads the Chinese `CLAUDE.md` fine, so the original stays the operative file.
- Fork-specific rules (English replies, the `i18n` workflow) currently sit inside `CLAUDE.md` on `i18n`, which will
  conflict whenever upstream edits the same lines. Recommendation: move them into a fork-only file
  `CLAUDE.fork.md` and leave a single import line `@CLAUDE.fork.md` at the top of `CLAUDE.md` — one line conflicts
  rarely and is trivial to re-apply. (Not done yet; needs your OK.)

## Point 4 — branches

| Branch | Content | Rule |
|---|---|---|
| `main` | exact mirror of `upstream/main` | never commit to it; only fast-forward from upstream |
| `i18n` | `main` + all fork work (refactoring, translations, fork docs) | receives `main` by merge; feature branches merge into it |
| `feat/…`, `docs/…` | one task each, branched from `i18n` | PR **into `i18n`**, not into `main` |

Note: the draft PR for `feat/i18n-scaffold` must target `i18n` (not `main`, as suggested earlier), so `main` stays
a clean mirror.

Merging (not rebasing) `main` into `i18n` is recommended: history stays intact for open feature branches, and each
sync is one reviewable merge commit.

## Point 5 — scheduled maintenance

Three jobs, from mechanical to AI-assisted:

| Job | When | Needs AI? | What it does |
|---|---|---|---|
| 1. Mirror | daily | no | fast-forward `main` to `upstream/main`, push to the fork |
| 2. Integrate | weekly (or daily) | only on conflicts | merge `main` into `i18n` on a branch `sync/YYYY-MM-DD`; run checks; open a PR. If the merge conflicts, a Claude agent resolves it (fork rules: keep upstream behaviour, re-apply fork changes) and explains each resolution in the PR |
| 3. Translations | weekly | yes | `translation_status.py --stale` and `--untranslated --prefix <next area>`; a Claude agent updates stale translations using `--diff`, translates up to N new files (budget cap), runs `--fix-links --check`, `--record`s them and opens a PR |

You review and merge the PRs; nothing is pushed to `i18n` without you.

### Where the scheduled agents run — options

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. GitHub Actions (recommended)** | cron workflows; job 1 is plain `git`; jobs 2–3 use `anthropics/claude-code-action` | runs without your PC; results arrive as PRs; logs in Actions | needs an `ANTHROPIC_API_KEY` repo secret and is billed per use; Actions must be enabled on the fork |
| B. Local timer | `systemd --user` timer or `cron` running `claude -p "<task>"` headless in the repo | uses your Claude subscription; no secrets on GitHub | PC must be on; you check results locally |
| C. Inside a Claude session | `/loop` or scheduled prompts | good for learning | stops when the session ends — not for maintenance |

Rough cost for option A: job 1 free; job 2 only costs when conflicts occur; job 3 depends on upstream churn and the
per-run cap (e.g. ≤ 20 files per week). A budget cap per run is part of the job's prompt and the workflow config.

### Proposed rollout

1. Now: translation tree, status script, first 15 translations (this branch).
2. Next: job 1 (mirror) as a GitHub Action — no AI, no cost; learn the scheduling mechanics.
3. Then: job 2 with Claude on conflicts; then job 3.
4. Decide A vs B for jobs 2–3 (cost vs. convenience).

## Open questions

1. Option A (GitHub Actions + API key) or B (local timer with your subscription) for the AI jobs?
2. Frequency: mirror daily, integrate and translations weekly — OK?
3. Move fork rules into `CLAUDE.fork.md` with a one-line import?
4. Which documentation area should the translation job do next (proposed: `docs/core/`)?
