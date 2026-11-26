> English translation of [docs/core/contributing/frontend.md](../../../../../docs/core/contributing/frontend.md). The Chinese original is authoritative.

# Frontend and Desktop Contributing Guide

## Directory boundaries

- `frontend/web/`: the static frontend source currently used in production, and the input to the desktop bundle.
- `frontend/web-react/`: migration area for the new React frontend; it does not currently replace `frontend/web/` directly.
- `frontend/desktop/`: Electron desktop packaging.
- `frontend/desktop/app/frontend/**`: the frontend bundle the desktop app actually reads; it should not be the primary place to edit.

## Local startup

First install the uniformly locked workspace dependencies from the repository root:

```bash
npm ci
```

The root `package-lock.json` is the only official npm
lockfile for `frontend/*` and `packages/*`. Do not commit separate `package-lock.json` files inside workspaces.

```bash
cd frontend/web
python3 -m http.server 40001 --bind 0.0.0.0
```

To start the React migration area on its own:

```bash
npm run dev --workspace=frontend-react
```

Default port: `40002`. This entry is still a migration area and does not directly replace the production `frontend/web/`.

Default ports:

- Web frontend: `40001`
- Rust API: `41000`
- Second port (only `/health`, `/ready`): `42000`

For frontend API base rules see [Local startup and configuration](../../../../../docs/core/api/local-dev.md).

## Desktop sync

After changing `frontend/web/src/**`, `frontend/web/*.html`, `frontend/web/src/styles/**` or other frontend resources that go into the desktop bundle, you must sync the desktop app:

```bash
npm run verify-frontend-sync --workspace=retain-pdf-desktop
```

This command rebuilds the static frontend, syncs it into the desktop bundle and runs the desktop frontend smoke test.

### Troubleshooting desktop errors

The desktop main-process log is `logs/desktop-main.log` under the Electron user data directory (`frontend/desktop/src/main/desktop-logging.js`).
The directory name follows the app name: on Windows look under `%APPDATA%\`, on Mac under `~/Library/Application Support/`, for `RetainPDF` or
`retain-pdf-desktop`; the `[desktop] app ready … userData=` line at startup gives the exact path. Errors in pages are all logged as lines starting with `[desktop][renderer-issue]`:

- `type=error` / `unhandledrejection`: errors not caught on window (`frontend/desktop/preload.js`).
- `type=react-caught` / `react-uncaught`: React component errors (caught by an error boundary, or the whole tree unmounted), followed by two sections, `component-stack:` and `stack:`.
  Every page's React root uses `reactRootErrorOptions()` from `web/src/platform/desktop/renderer-issue.ts` (home and detail pages via
  `app/shell-boot.ts`, the reader page via `bootReader({ rootOptions })`), and reports to the main process through the desktop bridge `reportRendererIssue`.
- The production bundle is minified, but function and class names are kept during bundling (`keepNames` in `web/scripts/build-js-bundle.mjs`), so component names are visible in component stacks;
  for React errors that give only a number (e.g. #185 "maximum update depth exceeded"), the component stack tells you which component it is.

## Change rules

- Do not change only `frontend/desktop/app/frontend/**`; change the `frontend/web/**` sources and then sync.
- Put UI logic preferably in existing feature/controller/view modules; do not stuff new flows back into one big entry file.
- When adding download, reader, status card or glossary capabilities, confirm the desktop bundle also passes `npm run verify-frontend-sync --workspace=retain-pdf-desktop`.
- When the frontend needs new API fields, first confirm the backend has a stable view/projection; do not make the frontend guess from internal payloads, raw artifacts or database fields.
- Changes to `frontend/web-react/` should be clearly migration-area capabilities, unless the PR's goal is to switch the production entry.

## Common checks

```bash
npm run build:web
npm run verify-frontend-sync --workspace=retain-pdf-desktop
```

When you change styles, skins or page structure (CSS, theme variables, component DOM), also run the visual regression: each skin × 8 page states is compared pixel by pixel against main's build output,
and only the places you intended to change may differ (usage in [frontend/web/tests/README.md](../../../../../frontend/web/tests/README.md)):

```bash
npm --prefix frontend/web run build
npm --prefix frontend/web run visual:check -- --base main
```

The frontend end-to-end status smoke really submits jobs and usually needs a local Rust API, an OCR token, a model key and a sample PDF; run it only when you have these:

```bash
cd frontend/web
npm run smoke:status -- --file ../../data/temPDF/test1.pdf
```
