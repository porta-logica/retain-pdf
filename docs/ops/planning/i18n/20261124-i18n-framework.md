# UI Text Internationalization (i18n) Framework — Draft for Review

Status: draft, awaiting review. No code has been changed.

## 1. Current state (surveyed 2026-11-24)

| Area | User-visible text | Existing support | Main difficulties |
|---|---|---|---|
| Frontend `frontend/web`, `packages/*` | ~900 source files contain Chinese (incl. comments), hardcoded in TSX and in "display text" domain modules | No i18n library, no locale files; dates hardcoded to `zh-CN` | Volume; tests assert on Chinese text |
| Desktop shell `frontend/desktop` | Dialogs, splash screen, error pages, ~30 files | None | Main process does not know the UI's language setting |
| Rust backend | `AppError` messages, job `stage_detail`, `bail!`/`format!` failure reasons, CLI output | Some errors have stable codes (accounts, structured errors, upstream providers) | Most `AppError`s carry only a Chinese message; code branches on text (compares `detail` against the Chinese literal for "task completed"); ~680 test assertions on Chinese text |
| Python pipeline | Progress `message=`, structured/upstream error hints, CLI prints, ~180–200 literals | None | LLM prompts are a separate category |

Logs contain almost no Chinese. Comments and docstrings are out of scope.

## 2. Principles

1. **The backend emits "code + parameters"; the frontend turns them into text.** The backend says *what happened*,
   not *in which language*. One catalog serves the whole UI, and the backend never needs to know the user's language.
2. **Additive only.** The existing Chinese `message` fields stay (as fallback and for compatibility with older
   frontends); `message_key` + `params` are added next to them.
3. **One catalog format, shared by all three languages.** TypeScript, Rust and Python read the same files.
4. **Chinese is the source language** (`zh-CN`). Missing translations fall back to Chinese, then to the key itself —
   never to blank text.
5. **LLM prompts are not part of the UI catalog**; they are managed separately per *target* language (see §7).

## 3. Message catalog

Location: `locales/` at the repository root, one directory per language, one file per domain:

```
locales/
  zh-CN/   common.json  jobs.json  errors.json  reader.json  desktop.json ...
  en/      (same file names)
  README.md   for translators: how to add a language, how to find gaps
```

Format: flat JSON, dot-separated keys, `{name}` placeholders (subset of ICU MessageFormat; plurals via ICU `plural`).
Example `locales/en/jobs.json` (the `zh-CN` file has the same keys with the original Chinese text):

```json
{
  "jobs.stage.ocr_queued": "OCR job created, waiting for a free execution slot",
  "jobs.stage.done": "Job completed",
  "errors.account.invalid_credentials": "Incorrect username or password",
  "reader.pages_left": "{count, plural, other {# pages left} one {# page left}}"
}
```

Key naming: `<domain>.<object>.<situation>`. Domains reuse the 8 backend domain names plus the frontend's
`reader`, `desktop` and `common`. Once published, a key is never renamed (change the text, not the key; if the
meaning changes, add a new key).

Why JSON + ICU: Weblate, Crowdin, Lokalise (and POEdit via conversion) support it directly, so translators never
touch code; mature ICU implementations exist for all three languages.

## 4. Integration per component

### 4.1 Frontend (web + reader)

- Library: `i18next` + `react-i18next` + `i18next-icu`. No Vite plugin required, works with esbuild; namespaces
  load lazily. (Alternative: a hand-written ~80-line `t()`; lighter, but plurals, lazy loading and interpolation
  would all be ours to build. The library is recommended.)
- Usage: in components `const { t } = useTranslation("jobs"); t("jobs.stage.done")`; non-component domain
  modules use the exported `i18n.t`.
- **Type-checked keys**: before the build, generate a `.d.ts` from `locales/zh-CN/*.json`, so a mistyped key
  is a compile error.
- When the backend returns `message_key`, render `t(message_key, params)`; otherwise show the original
  `message` (old endpoints, old job records).
- Dates/numbers: `platform/utils/datetime.ts` creates `Intl` formatters for the current locale; every
  `toLocale*` call and hardcoded `"zh-CN"` is funneled through it.
- Language selection: switch in settings → stored in `localStorage`; on first visit match `navigator.language`,
  falling back to `zh-CN`.

### 4.2 Desktop shell

- The main process uses the same `locales/*/desktop.json` with plain `i18next` (no React).
- Language source: when the UI switches language it notifies the main process via preload/IPC, which persists
  it; if unset, use `app.getLocale()`.

### 4.3 Rust backend

- `AppError` gains optional `message_key` and `params` (JSON) fields, with new constructors such as
  `AppError::bad_request_key("errors.jobs.not_found", json!({"job_id": id}))`.
  The old Chinese-only constructors remain and are replaced gradually. The response body adds
  `error.message_key` and `error.params`; existing fields are unchanged.
- Existing stable codes (`INVALID_CREDENTIALS`, …) map directly to keys: `errors.account.invalid_credentials`.
- Job `stage_detail`: add `stage_detail_key` + `stage_detail_params` (new table columns or inside the event JSON;
  migration to be decided).
  **First fix code that branches on text such as comparing `detail` to the Chinese "task completed" literal**, switching to the key or a status
  enum — this is where translation would otherwise cause behavioral bugs.
- Where the backend itself must produce text (CLI, `message` fallback): a small crate `retainpdf-i18n` embeds
  the catalog at compile time via `include_str!` and provides `tr(key, params, locale)`; the CLI picks the
  language from the `LANG` environment variable.
- No `Accept-Language` parsing (per principle 1, the backend does not need to know the language).

### 4.4 Python pipeline

- Progress events and structured errors gain `message_key` + `params`; the original `message` stays and is
  passed through Rust to the frontend.
- A small module `retainpdf_base/i18n.py` (standard library only, reads the same JSON) is used only for CLI
  prints and the `message` fallback.
- Internal `raise` messages (developer-facing) are not translated.

## 5. Making translation easy

- `locales/zh-CN` is the single source. Script `ops/development/check_locales.py`:
  - reports missing keys, extra keys and placeholder mismatches (e.g. missing `{count}`) per language;
  - scans the code for keys that are used but absent from the catalog.
  - Runs in the CI docs check: missing translations warn, placeholder errors fail.
- CSV export/import (`key, zh-CN, en, notes`) for translators who prefer not to edit JSON; alternatively connect
  Weblate directly (it reads and writes the same directory).
- Per-key context notes in `locales/_context.json` (where it appears, length limits), shown by translation tools.
- Adding a language = copy `locales/en`, rename it, and register one line in the language list.

## 6. Tests

- New tests assert on keys and parameters, not on text.
- Existing tests asserting Chinese text (frontend, ~680 in Rust) are updated when their module is migrated,
  not in one big sweep.
- A pseudo-locale `xx` (wraps every string as `[!! … !!]`) for development: switching to it reveals any remaining
  hardcoded text at a glance.

## 7. LLM prompts (out of scope; direction only)

Prompts decide *what language to translate into and how* — they are translation content. Direction: template
files per target language (`prompts/<target-language>/*.md`). `target_language_name` is already a parameter;
later, the Chinese instruction text around it gets templated too. Changes will trip the prompt sha256 snapshot
test, which must be deliberately re-recorded. Separate project.

## 8. Migration plan

| Step | Content | Risk |
|---|---|---|
| 0 | Review and finalize this design | — |
| 1 | Scaffolding: `locales/`, frontend i18next wiring, centralized date formatting, `check_locales.py`, pseudo-locale; migrate one small page as the template | Low |
| 2 | Backend adds `message_key`/`params` (additive): `AppError`, `stage_detail`, Python progress events; fix text-based branching | Medium (API changes, possible schema change; update `docs/api` and snapshots) |
| 3 | Migrate the frontend feature by feature, one PR per feature | Low risk, high volume — well suited to parallel agents |
| 4 | Desktop shell, CLI | Low |
| 5 | Complete the `en` translation | Content work |

## 9. Open questions

1. Which languages first? Only `en`, or others too (e.g. German)?
2. This repo's `CLAUDE.md` says "when working on the backend, don't touch `frontend/`" and "backend changes to the
   frontend are additive only". Does this fork keep those rules, and do you plan to contribute the changes
   upstream? That determines whether the Chinese `message` fallback must be kept permanently.
3. Frontend: `i18next` (recommended) or a hand-written `t()`?
4. `stage_detail_key`: new table columns, or only inside the event JSON?
5. Should internal developer-facing errors (Python `raise`, Rust `bail!` that never reach the UI) also be
   converted to English?
