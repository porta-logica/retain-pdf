# Fork rules (porta-logica/retain-pdf)

This fork of [wxyhgk/retain-pdf](https://github.com/wxyhgk/retain-pdf) is imported by the one line `@CLAUDE.fork.md`
at the top of `CLAUDE.md`; everything else in `CLAUDE.md` is upstream's text, unchanged, so upstream syncs rarely
conflict. **Where these rules and upstream's `CLAUDE.md` disagree, these rules win.** Upstream's rules apply otherwise.
English reading copy of upstream's rules: [translations/en/CLAUDE.md](translations/en/CLAUDE.md).

## Language

- Reply in English; write code identifiers, commands and paths as-is. (Overrides 「回复一律用简体中文」.)
- Commit messages in English, prefixed `type(scope): summary`, e.g. `fix(translate): …`, `refactor(api): …`.
  Merge commits: `Merge branch 'xxx': one sentence saying what it brings in`.
- New fork documents (`docs/ops/planning/i18n/`, `ops/fork/`, `translations/`, `locales/README.md`) and devlog rows
  are written in English. Do not translate upstream files in place (see Translations).

## Branches

| Branch | Content | Rule |
|---|---|---|
| `main` | exact mirror of `upstream/main` | never commit or push to it by hand; only the mirror job fast-forwards it |
| `i18n` | `main` + all fork work; GitHub default branch | receives `main` via `sync/<date>` branches; work branches merge into it |
| work branches | one task each, from `i18n` | push and open a draft PR **into `i18n`** |

- Upstream's "合" / "推送" rules apply to `i18n` here: the owner says **"merge"** (= 合) before a branch is merged
  into `i18n`, and **"push"** (= 推送) before `i18n` is pushed. Each confirmation covers that one action only.
- After pushing `i18n`, delete the merged branch locally and on GitHub.
- Upstream's devlog rule applies: add a row before merging; rows in date order; English text.

## Scheduled maintenance (fork only)

Details: [ops/fork/README.md](ops/fork/README.md), plan: [docs/ops/planning/i18n/20261126-fork-maintenance.md](docs/ops/planning/i18n/20261126-fork-maintenance.md).

| Job | Where, when | Output |
|---|---|---|
| 1. Mirror | GitHub Actions `.github/workflows/fork-mirror-upstream.yml`, daily 03:17 UTC | `main` fast-forwarded to upstream |
| 2. Sync | local timer `retain-pdf-sync-i18n`, Mondays | branch `sync/<date>`: `main` merged into `i18n` |
| 3. Translations | local timer `retain-pdf-translate-docs`, Tuesdays | branch `translations/<date>`: stale + up to 10 new translations |

Review `sync/*` and `translations/*` branches like any other; check `translation_status.py --stale` after a sync.
After changing `ops/fork/*.sh`, rerun `ops/fork/install-sync-timer.sh`.

## Translations

- Documents and agent instructions are translated into `translations/en/<original path>`, never in place;
  `translations/manifest.json` + `translations/tools/translation_status.py` track staleness. Conventions:
  [translations/README.md](translations/README.md).
- Code comments are not mass-translated; translate them on request without writing, or in place only in files a
  fork change touches anyway.

## i18n work

Design and decisions: [docs/ops/planning/i18n/](docs/ops/planning/i18n/README.md). UI texts live in `locales/`
(`en` is the source language); check with `python3 ops/development/check_locales.py`.

## Environment

- The GitHub CLI may be missing. Then push branches with `git`, read public run/PR status via
  `curl https://api.github.com/repos/porta-logica/retain-pdf/...`, and ask the owner to open PRs or rerun jobs.
- Use `npx -y npm@11` instead of the system npm 8 for anything that writes `package-lock.json` (npm 8 drops
  `libc` fields from the lockfile).
- The clone fetches only `main` from `origin`; fetch other branches with explicit refspecs.
