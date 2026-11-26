> English translation of [CONTRIBUTING.md](../../CONTRIBUTING.md). The Chinese original is authoritative.

# Contributing guide

Thank you for wanting to take part in RetainPDF. The project comprises a Rust API, a database, a Python OCR/translation/rendering pipeline, a static frontend, a desktop app and Docker delivery. The most important things when contributing are: clear boundaries, verifiable changes, reproducible problems.

## Areas to contribute

- Frontend and desktop: job status, side-by-side reading, glossary UI, download experience and Electron bundle sync.
- Rust API: job management, library endpoints, artifact downloads, event streams, reader, resume-from-checkpoint and permission boundaries.
- Database and persistence: job/artifact/event/glossary records, schema compatibility, old-data recovery and storage paths.
- Python pipeline: OCR normalization, translation consistency, formula protection, rendering, PDF processing and failure diagnostics.
- Specialist testing: real-sample regression, edge cases, fixtures, automation scripts, performance benchmarks and acceptance checklists.
- AI-assisted development: Codex or Claude Code are recommended for splitting tasks along project boundaries, generating tests, code review and documentation updates.
- Docker, CI, documentation and the maintainer release process.

## Sub-documents

- [Frontend and desktop contributing guide](docs/core/contributing/frontend.md)
- [Rust API contributing guide](docs/core/contributing/backend.md)
- [Database and persistence contributing guide](docs/core/contributing/database.md)
- [Python pipeline contributing guide](docs/core/contributing/python-pipeline.md)
- [Embedded backend package](docs/core/contributing/backend-package.md)
- [Testing contributing guide](docs/core/contributing/testing.md)
- [AI-assisted development guide](docs/core/contributing/ai-development.md)
- [Issues, PRs, code style and release notes](docs/core/contributing/process-and-style.md)

Also recommended reading:

- [README](../../README.md)
- [Local startup and configuration](../../docs/core/api/local-dev.md)
- [Runtime storage layout](../../docs/core/api/storage.md)
- [Mainline documentation](docs/core/README.md)

## Minimal local startup

Backend:

```bash
python3 ops/development/dev_stack.py
```

This entry point prepares `backend/.venv` and the Rust binaries, and starts `rust_api` and `retain-jobsd`
in `remote + supervised` mode
(RetainPDF's own AI service `retainpdf-ai` was removed on 2026-11-03). On an already prepared checkout you can append `--no-sync --no-build`.

Frontend:

```bash
npm ci
npm run build:web
python3 -m http.server 40001 --bind 0.0.0.0 --directory frontend/web
```

All official JavaScript workspaces share the root `package-lock.json`. Do not run standalone installs inside
`frontend/*` or `frontend/packages/*` that would create nested lock files; when adding or updating dependencies,
run npm from the repository root.

Default ports:

- Rust API: `41000`
- Second port (only `/health`, `/ready`): `42000`
- Web frontend: `40001`

The local launcher also uses a loopback port for backend-internal communication only:
`41002` for `retain-jobsd` (`41100`, formerly used by the AI service, was removed along with it on 2026-11-03).

Docker delivery uses the same set of ports by default. If Docker Web is already running on your machine, the local static frontend can temporarily use another free port; changing the port only affects the browser entry point, not the Rust API default port.

## Minimum requirements before submitting

- Explain what changed, why, and which modules are affected.
- Run the tests or checks matching the scope of the change.
- If some check was not run, explain why in the PR description.
- Do not commit local keys, tokens, real user files, `data/db/jobs.db`, `data/jobs/*`, `tmp/*` or large experimental output.
- When changing the API, events, database schema, artifact structure, module boundaries or deployment, update the docs too.

## Directory placement rules

- App entry points go in `frontend/`, shared frontend libraries in `frontend/packages/`; backend services go in `backend/`, shared backend libraries in `backend/packages/`.
- Cross-side contracts go in `contracts/`, data-layer code in `database/`, project-level tests in `tests/`.
- Development, deployment and release tools go in `ops/`, security policies and checks in `security/`, official docs all in `docs/`.
- Module scripts live with their owner, e.g. `frontend/web/scripts/`, `backend/api/scripts/`;
  repository-level CI tools go in `.github/scripts/`.
- Do not recreate root-level `apps/`, `packages/`, `services/`, `doc/`, `scripts/` or `src/` as source entry points.
- `data/` and `tmp/` only hold local runtime and diagnostic data and must not be used as code or documentation entry points.

Maintainer release, Docker delivery and production ops processes are not part of the regular contributor mainline; see [Ops and process records](../../docs/ops/README.md) and the Docker docs.
