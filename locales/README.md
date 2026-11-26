# UI message catalogs

Every text the user sees in the app comes from here. Design and decisions:
[docs/ops/planning/i18n/](../docs/ops/planning/i18n/README.md).

```
locales/
  languages.json      registered languages; "source" is the reference language (en)
  en/  de/  zh-CN/    one directory per language, same file names in each
    auth.json         keys "auth.*"
    common.json       keys "common.*"
```

## Rules

- Files are flat JSON: `"key": "text"`. A key starts with its file name (`auth.json` only holds `auth.*`).
- `en` is the source. New texts are added to `en` first; other languages may lag behind. A missing
  translation shows the English text.
- Never rename a published key. Change the text instead; if the meaning changes, add a new key.
- Texts use [ICU MessageFormat](https://formatjs.github.io/docs/core-concepts/icu-syntax/):
  - placeholders: `"Hello {username}"`; keep the same placeholder names as in `en`;
  - plurals: `"{minutes, plural, one {# minute} other {# minutes}}"`;
  - an apostrophe `'` starts an escape in ICU. Write `’` (typographic apostrophe) in texts, or `''` for a literal `'`.

## Translating

1. Edit `locales/<language>/<file>.json` (or copy `en/<file>.json` for a new file).
2. Check: `python3 ops/development/check_locales.py` (lists untranslated keys; fails on wrong placeholders).
3. Regenerate the web app's catalog module: `npm --prefix frontend/web run generate:i18n`.

To preview, open the app with `?lang=de` (or `en`, `zh-CN`). `?lang=xx` is a pseudo-language that wraps
every translated text as `[!! … !!]`, so any text still hardcoded in the code stands out.

## Adding a language

1. Copy `locales/en/` to `locales/<code>/` (BCP 47 code, e.g. `fr`, `pt-BR`) and translate.
2. Add `{ "code": "<code>", "name": "<name in that language>" }` to `languages.json`.
3. Run the check and the generator above.
