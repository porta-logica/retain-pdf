> English translation of [docs/core/contributing/backend.md](../../../../../docs/core/contributing/backend.md). The Chinese original is authoritative.

# Rust API Contributing Guide

## Package names

Since 2026-10-17 all Rust packages are named `retainpdf-*`, the same style as the Python `retainpdf-math` and `retainpdf-pipeline`;
directory names under `backend/packages/` and `database/` are the package names. Application directories (`backend/api`, `backend/jobs`, `backend/cli`) and executable names are unchanged:

| Directory | Package name (`cargo -p`) | Crate name (`use`) | Executable |
|---|---|---|---|
| `backend/api` | `retainpdf-api` | `retainpdf_api` | `rust_api` |
| `backend/packages/retainpdf-api-base` | `retainpdf-api-base` | `retainpdf_api_base` | |
| `backend/packages/retainpdf-accounts` | `retainpdf-accounts` | `retainpdf_accounts` | |
| `backend/packages/retainpdf-files` | `retainpdf-files` | `retainpdf_files` | |
| `backend/packages/retainpdf-glossaries` | `retainpdf-glossaries` | `retainpdf_glossaries` | |
| `backend/packages/retainpdf-ingest` | `retainpdf-ingest` | `retainpdf_ingest` | |
| `backend/packages/retainpdf-jobs` | `retainpdf-jobs` | `retainpdf_jobs` | |
| `backend/packages/retainpdf-library` | `retainpdf-library` | `retainpdf_library` | |
| `backend/packages/retainpdf-platform` | `retainpdf-platform` | `retainpdf_platform` | |
| `backend/packages/retainpdf-providers` | `retainpdf-providers` | `retainpdf_providers` | |
| `backend/packages/retainpdf-core` | `retainpdf-core` | `retainpdf_core` | |
| `backend/packages/retainpdf-data` | `retainpdf-data` | `retainpdf_data` | |
| `database/retainpdf-db` | `retainpdf-db` | `retainpdf_db` | |
| `backend/packages/retainpdf-config` | `retainpdf-config` | `retainpdf_config` | |
| `backend/packages/retainpdf-proc` | `retainpdf-proc` | `retainpdf_proc` | |
| `backend/packages/retainpdf-runner` | `retainpdf-runner` | `retainpdf_runner` | |
| `backend/jobs` | `retainpdf-runnerd` | | `retain-jobsd` |
| `backend/cli` | `retainpdf-cli` | | `retainpdf` |

The Python translation agent package `retainpdf-translation-agent` (`backend/translation-agent`, created 2026-10-29): translates a whole page at once, validates block by block,
and revises drafts at the request of the reflow agent, using only the standard library; its test harness is in `backend/pipeline/devtools/agent_lab/`. The future reflow agent will be a separate `retainpdf-layout-agent`.
When a job selects `translation.engine=agent`, it is called by the wiring `retainpdf_translation_agent_engine/agent_flow.py` (see [translation layer notes](../../../../../docs/core/python/translation.md)), and the runtime image installs it too. The wiring moved from the translation package into this package on 2026-11-20 (previously the translation package depended on the agent package; now it is the other way round: the wiring depends on the translation package, install `retainpdf-translation-agent[engine]`; the core still uses only the standard library).
The Python classic translation engine package `retainpdf-translation-classic` (`backend/translation-classic`, split out of the translation package on 2026-11-20): batched block-by-block translation, repair fallback,
pre-translation preparation, polishing, the editorial desk; its directory structure mirrors the translation package. It depends on the translation package; the translation package loads it lazily via the engine registry `workflow/engines.py` and does not import it.
The pipeline's pre-render polishing is taken from `retainpdf_translation_classic.public`.
The Python table agent package `retainpdf-table-agent` (`backend/table-agent`, split out of the classic translation engine package on 2026-11-25): one bounded loop per table,
cell-by-cell validation; if a table cannot be fully translated, the original is kept. The core `retainpdf_table_agent` uses only the standard library (prompts live in the package too); the wiring `retainpdf_table_agent_engine`
connects to the translation base's model calls; the pipeline's table translation stage `retainpdf_pipeline/translate/tables_stage.py` imports both directly.
The Python built-in agent package for reader-page questions, `retainpdf-ask-agent` (`backend/ask-agent`, 2026-11-25): speaks ACP over stdio, and the backend's ACP bridge starts it with
`python -m retainpdf_ask_agent`; the core uses only the standard library, and the wiring `retainpdf_ask_agent_engine` makes streaming requests in three protocols (request bodies use the translation base's `model_wire`).
The Python table-of-contents agent package `retainpdf-toc-agent` (`backend/toc-agent`, created 2026-11-25): translates a book's whole TOC at once, checks entry by entry, matches translated names to the same-named headings in the body,
and hands them to the translation engine as "fixed translations" (TOC and body match exactly, and those blocks send no further requests). The core `retainpdf_toc_agent` uses only the standard library; the wiring `retainpdf_toc_agent_engine`
connects to the translation base's model calls and takes entries and headings from document.v1; the pipeline's `translate/toc_stage.py` passes it to the translation request when `translation.toc=agent`,
and the base's `workflow/fixed_translations.py` runs it alongside domain detection while building the plan.
The Rust base package `retainpdf-api-base` and the Python base package `retainpdf-base` (`backend/base`, created when the translation package was split) are two different things. `retainpdf-api-base` (created 2026-10-16) is the shared base of the API domain packages:
the error type `AppError` and loading jobs by ID, `job_loading`, one layer below `services`.

## Layering direction

Default dependency direction:

```text
rust_api app/router -> routes -> services（8 个领域包的门面）
领域包（retainpdf-jobs 等） -> retainpdf-api-base + retainpdf-core + retainpdf-data（任务包另用 retainpdf-runner、retainpdf-proc）
retainpdf-runner -> retainpdf-core + retainpdf-data + retainpdf-proc
retain-jobsd -> retainpdf-runner + retainpdf-data
```

(In the block above: `services（8 个领域包的门面）` = services (facades of the 8 domain packages); `领域包（retainpdf-jobs 等）` = domain packages (retainpdf-jobs etc.); `任务包另用 …` = the jobs package additionally uses retainpdf-runner and retainpdf-proc.)

Basic rules:

- `src/app/router/*` only assembles routes; `src/routes/*` only does HTTP adapters, extractors and response wrapping.
- Application use cases, facades and safe projections live in the 8 domain packages (`backend/packages/retainpdf-<domain>`; `src/services/mod.rs` only wires them in as `crate::services::<domain>`), and do not directly own the worker lifecycle.
- `backend/packages/retainpdf-core` only holds cross-crate domain types, config and stable DTOs, and does not depend back on HTTP, SQLite or the runner.
- `database/retainpdf-db` owns SQLite (re-exported by `retainpdf-data` as `db`); `backend/packages/retainpdf-data` owns artifact/credential reading, worker commands and the provider data boundary.
- `backend/packages/retainpdf-runner` owns the queue, stage orchestration, process spawning, cancellation, OCR dispatch and recovery.
- `backend/packages/retainpdf-proc` only provides generic subprocess safety primitives; `retain-jobsd` is the standalone job supervisor entry point.
- Do not pass `AppState` for convenience into helpers that only need `Db`, `AppConfig`, `Path` or a semaphore.

For finer rules see [Rust API collaboration conventions](../../../../../docs/core/rust_api/09-协同开发约定.md).

## API changes

- When adding public API fields, use a stable view/model; do not expose internal `JobSnapshot` fields directly.
- When adding or changing endpoints, events, artifact manifests, reader metadata, diagnostics or resume behavior, update the [API docs](../../../../../docs/core/api/index.md) or the corresponding rust_api docs.
- API response fields should preferably come from the view/projection layer; do not assemble ad-hoc JSON in routes.
- Endpoints the frontend depends on heavily, such as download, preview, Range, ETag and reader regions, must keep fields stable and backward compatible.
- When changing the shared wire protocol, update `backend/contracts`, `contracts` and the producer/consumer contract tests together.
- Public credentials use only `credential_ref`; raw secrets must never appear in responses, logs, events or stage specs.

## Common checks

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
cargo fmt --manifest-path "$BACKEND_ROOT/api/Cargo.toml" --check
cargo test --locked --workspace --manifest-path "$BACKEND_ROOT/api/Cargo.toml"
python3 "$BACKEND_ROOT/api/scripts/check_architecture.py"
```

The backend is a self-contained package within the product repository; for paths and validation rules see [Embedded backend package](./backend-package.md).

## PR description

PRs touching the Rust API should at least state:

- Which endpoints or internal services are affected.
- Whether contracts for job, artifact, reader, library, resume, diagnostics etc. change.
- Whether the frontend, desktop or API docs need updating.
- Which Rust checks were run; for those not run, explain why.
