# i18n Framework — Decisions (2026-11-24)

Resolves the open questions in [20261124-i18n-framework.md](20261124-i18n-framework.md) §9. Where this file
and the draft disagree, this file wins.

## Decisions

1. **Languages:** `en` and `de` first. `zh-CN` remains a supported language.
2. **Source language is `en`** (changes draft principle 4). `locales/en` is the reference catalog that the type
   definitions, `check_locales.py` and translators work from. Missing keys in any language fall back to `en`, then to
   the key itself. There is no fallback to Chinese.
3. **The Chinese `message` field is removed, in stages** (changes draft principle 2). This fork does not keep the
   upstream "additive only" constraint for this work.
   - Stage A (step 2 of the migration plan): the backend adds `message_key` + `params` next to the existing `message`.
   - Stage B (after the frontend migration, step 3): the frontend no longer reads `message`; the Chinese `message` /
     `stage_detail` text is removed from API responses and events. API docs and snapshots are updated in the same branch.
4. **Frontend library:** `i18next` + `react-i18next` + `i18next-icu`, as in draft §4.1.
5. **`stage_detail_key` + `stage_detail_params` live only in the event JSON**, not in new table columns. No schema migration.
6. **Developer-facing errors** (Python `raise`, Rust `bail!`/`anyhow!` that don't reach the UI) are converted to
   English, as a separate low-priority step: done when a file is touched anyway, not as a dedicated sweep. They do
   not go through the catalog; plain English strings.

## Effect on the migration plan

| Step | Change |
|---|---|
| 1 | Catalog is authored in `en` first; `zh-CN` and `de` are filled from it. Pseudo-locale is derived from `en`. |
| 2 | Unchanged (additive `message_key`/`params`), i.e. Stage A. |
| 3 | Unchanged. |
| 3b | New: Stage B, removing the Chinese `message`/`stage_detail` text once no frontend code reads it. |
| 5 | Becomes "complete the `de` and `zh-CN` translations". |
| 6 | New: convert developer-facing errors to English, opportunistically. |
