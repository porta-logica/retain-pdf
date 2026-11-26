> English translation of [CLAUDE.md](../../CLAUDE.md). The Chinese original is authoritative.

# CLAUDE.md

Conventions for Claude Code working in this repository. For how to run the project and how directories are split, first read
[CONTRIBUTING.md](CONTRIBUTING.md) and [docs/README.md](docs/README.md); general AI development advice is in the
[AI-assisted development guide](docs/core/contributing/ai-development.md). This file only covers rules that those documents don't, but that must be kept every time.

## Communication

- Reply in English; write code identifiers, commands and paths as-is. (This fork's owner works in English, 2026-11-24.)
- Commit messages in English, prefixed `type(scope): summary`, e.g. `fix(translate): …`, `refactor(api): …`.
  Merge commits: `Merge branch 'xxx': one sentence saying what it brings in`.

## Division of work

- Frontend (`frontend/`) and backend are done separately. When working on the backend, **do not change any file under `frontend/`**; reading frontend code to confirm callers is fine.
- Backend changes are additive-only towards the frontend: old fields and old addresses stay, new ones go next to them. Where the frontend needs to follow,
  write it into the relevant backend doc or cleanup notes (e.g. `docs/ops/planning/api-reorg/`), stating the file, the old usage and the new usage.

## Branches, merging, pushing

- Do not develop directly on `main`. Open a branch for each piece of work; small docs-only changes (README and the like) can branch on the main checkout.
- All backend code branches are done in **one fixed backend worktree** (`../retain-pdf-backend`): finish one, push it, then switch to the next one's branch in the same directory,
  keeping the build cache (its own `target/`) around; no longer create a new worktree per task (decided by the user 2026-11-24). The main checkout is for merging, pushing and small docs;
  frontend sessions also merge in the main checkout; do not sit on a code branch in the main checkout. Only create another worktree when two backend tasks run at once, and give it its own `CARGO_TARGET_DIR`.
- When a branch is done, **push it to GitHub and open a draft PR** (`gh pr create --draft`) so CI runs the pre-merge checks (see next section). Pushing branches and opening PRs doesn't need the user to say "push";
  unmerged branches being visible in the public repo is fine (decided by the user 2026-11-23).
- Only when the user says **"合" ("merge")** do you merge into `main` locally; only on **"推送" ("push")** do you push `main` and tag. Each confirmation covers that one time only and does not carry over to the next.
- After pushing `main`, PRs that were merged automatically become merged; then delete their remote branch (`git push origin --delete <branch>`);
  for branches that won't be merged, close the PR and delete the remote branch.
- After pushing, run `gh run list --limit 8`; any red runs must be reported and cannot be treated as done.
- If you change endpoint behavior, events, database schema or artifact structure, update the docs **in the same branch**: external API usage is defined by `docs/api/` (the single external API reference),
  internal design (architecture, implementation approach) goes in `docs/core/api/`; `backend/api/docs/api-spec/` and `backend/api/API_SPEC.md` no longer get content (2026-11-24).

## Checks required before merging

The full checks run on GitHub (since 2026-11-23; previously the full set had to be run locally):

- The branch's draft PR triggers Tests, which picks docs checks, frontend checks or the full test suite depending on the change; the full suite includes the command list below, frontend tests, contracts,
  and another single-threaded run of `model_executor`. **The PR counts as passing only when its Tests are all green**; the merge message and the devlog's validation record the run number.
- If you changed translation-related code (see the first bullet below): also manually trigger a reverse-order run, `gh workflow run translation-offline.yml --ref <branch>`, which must also be green.
- Locally, only run the fast stuff: when changing code, run the few relevant tests; before committing, run the two architecture checks (a few seconds).
- **Tests using real keys that cost money (real models, real OCR) run only locally**, never in CI; ask the user first, as before.
- When CI can't run, or to reproduce a CI failure locally, use the commands below (for the worktree environment see "Local environment pitfalls").

Pushes to main also run the full tests; the standalone backend source package is verified when its packaging boundary changes. Web auto-publishing and official releases can reuse
the successful main-branch Tests result for the same commit. Release candidates can be pre-built manually from main. Full local check:

```bash
python3 backend/api/scripts/check_architecture.py
backend/.venv/bin/python -m pytest -q backend/api/scripts   # unit tests for the architecture check and other scripts themselves
python3 backend/pipeline/devtools/check_pipeline_architecture.py
backend/.venv/bin/python backend/pipeline/devtools/extract_pipeline_requirements.py --services-root backend --check
python3 .github/scripts/sync_backend_python_requirements.py --repo-root . --services-root backend --check
backend/.venv/bin/python -m pytest -q .github/scripts/tests   # doc relative links, delivery and CI conventions; run this when docs change too
cargo test --workspace   # runs all Rust packages like CI; the 16 packages listed previously missed retainpdf-proc, retainpdf-runnerd, retainpdf-cli
```

- If you changed the translation package `backend/translation/`, the classic translation engine package `backend/translation-classic/` (or their worker shell `backend/pipeline/retainpdf_pipeline/translate/`):
  in CI this is the `translation-offline.yml` above; to reproduce locally run
  `backend/.venv/bin/python backend/pipeline/devtools/run_translation_tests.py`, then run the translation unit tests again in reverse order with `--suite translation --reverse`
  (to catch modules polluting each other). The integration tests in `tests/performance` run each case in a fresh process, so order can't affect them and
  they don't need a reverse run (decided 2026-10-30; previously the whole suite was rerun in reverse).
  Translation tests are in `backend/pipeline/devtools/tests/translation`; the translation package's own smoke tests are in `backend/translation/tests`.
  It also runs `tests/performance/pipeline/tests`; prompt snapshots have a sha256 guard, so when you change prompts, re-record only the affected cases.
- If you changed the translation agent package `backend/translation-agent/`: run `python -m pytest backend/translation-agent/tests`, plus the test system's
  `backend/pipeline/devtools/tests/agent_lab` (it calls this package). The core `retainpdf_translation_agent` may only use the standard library, pinned by tests;
  the wiring `retainpdf_translation_agent_engine` depends on the translation package and its tests live in the translation tests (`test_agent_flow.py`, `test_agent_openai.py`), so run the translation tests.
- If you changed the table agent package `backend/table-agent/`: run `python -m pytest backend/table-agent/tests` (core uses only the standard library, and prompts unchanged to the character, both pinned;
  wiring and base JSON-extraction results matching are also in there), then run the translation tests (tests for the table translation stage `tables_stage.py` are there).
- If you changed the reader-page Q&A built-in agent package `backend/ask-agent/`: run `python -m pytest backend/ask-agent/tests` (core uses only the standard library, system prompt pinned;
  streaming parsing for the three protocols uses fake HTTP, and the entry point really spawns a subprocess against a local fake model service). The backend ACP bridge (`acp` in `retainpdf-providers`) is run separately with `cargo test -p retainpdf-providers acp`.
- If you changed "RetainPDF + pi" `backend/pi-agent/` (pi extension, wrapper script): run `node --test backend/pi-agent/tests/` (the book-reading tools share one set of assertions with the Python `tools.py`;
  `pi-acp.test.ts` really starts pi-acp + wrapper script + pi with fake model and backend, is skipped if pi isn't installed locally, and to switch pi versions use `RETAIN_PI_TEST_PI=<pi>`),
  then run `cargo test -p retainpdf-providers acp` (the part where the bridge starts it is in `acp/pi.rs`). If you change `tools.py` or prompts in `backend/ask-agent`, update the copy the pi extension mirrors as well, and run its tests.
- If you changed the interactive blocks (OpenUI) of reader ask: in the checker package `backend/openui-check/`, first run `npm ci --ignore-scripts --prefix backend/openui-check`
  (`--ignore-scripts` is required: lang-core's postinstall is install telemetry), then `npm test --prefix backend/openui-check`. The three tools (Python
  `backend/ask-agent/retainpdf_ask_agent/openui.py`, pi `backend/pi-agent/extension/openui.ts`, and `backend/cli/src/cmd/mcp_openui.rs` of `retainpdf mcp`)
  must return word-for-word identical text to the model: change one, change all three, and run the ask-agent and pi-agent tests plus `cargo test -p retainpdf-cli mcp` and `cargo test -p retainpdf-providers acp`.
  Without the checker's dependencies installed, the tests that really start the checker are skipped. The two files in `contracts/openui/` are generated by the frontend; the backend does not change them.
- If you changed the TOC agent package `backend/toc-agent/`: run `python -m pytest backend/toc-agent/tests` (core uses only the standard library; prompts and version number pinned),
  then run the translation tests (fixed translations wired into translation in `test_fixed_translations.py`, and the switch in `test_translation_toc_entries.py`, are there).
- For checks you couldn't run, say in your reply and the merge message that they weren't run and why.

## Local environment pitfalls

- Rust package names are uniformly `retainpdf-*` (use that with `cargo -p`; in code write `retainpdf_*`), consistent with the Python `retainpdf-math` and `retainpdf-pipeline`;
  directory names under `backend/packages/` and `database/` are the package names. The app directories `backend/api`, `backend/cli`, `backend/jobs` and executable names
  (`rust_api`, `retain-jobsd`, `retainpdf`) were not renamed; the mapping table is in `docs/core/contributing/backend.md`.
- Worktrees have no `backend/.venv`; before running Python and rust_api tests, point at the main checkout's environment:
  `UV_PROJECT_ENVIRONMENT=<main checkout>/backend/.venv`, `PATH=<main checkout>/backend/.venv/bin:$PATH`
  (some rust_api tests need `retainpdf-pipeline` on PATH).
- `model_executor` tests used to fail intermittently when run in parallel (test timeouts were too tight; relaxed 2026-10-16); before merging, still run them again with `--test-threads=1` (CI's Tests includes this step; when reproducing locally, run it yourself): the executor's own tests are in the `retainpdf-providers` package,
  and the few that need the whole app are in `retainpdf-api`'s `api_tests::model_executor`.
- Don't run rustfmt on whole existing files (the repo has never been formatted as a whole); feeding `rustfmt --check` from stdin always returns 0 and can't be used as a check.
- When the local multi-user dev stack is running, pipeline tests report at teardown "测试污染了仓库的 data/ 目录" ("tests polluted the repo's data/ directory"); that is written by the dev stack and won't happen in CI.

## Endpoint snapshots and architecture checks

- Three snapshots pin external behavior: the endpoint list `backend/api/docs/routes.txt`, file-output responses `backend/api/docs/file-responses.txt`,
  and the results of each job-creation entry point `backend/api/docs/submissions.txt`. The database schema has its own `database/retainpdf-db/schema.sql`
  (when adding a migration, run `UPDATE_SCHEMA=1 cargo test -p retainpdf-db schema_snapshot`); before merging each step of the database rework, you must also, on a copy of a real database, use
`retainpdf db-snapshot dump|diff` to compare what is read before and after the migration (usage in `docs/core/contributing/database.md`). Regenerate only for intentional changes:
  `UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest`,
  `UPDATE_FILE_RESPONSES=1 cargo test -p retainpdf-api --lib file_responses`,
  `UPDATE_SUBMISSIONS=1 cargo test -p retainpdf-api --lib submissions`. After regenerating, check the diff: only the expected changes should appear.
- Routes are only registered in the endpoint registry: each route file is one `crate::endpoints!` table (`backend/api/src/app/endpoints.rs`), one entry per endpoint,
  stating method, address, handler and who may use it in multi-user mode (`public`/`signed`/`admin`/`closed`), with a one-sentence `///` description; old addresses get `old "<new address>"` at the end of the line.
  Writing `.route(` directly in a route file turns the tests red. The endpoint index (overall index `docs/api/00-接口目录.md` (endpoint index), groups under `docs/api/00-接口目录/`) and `docs/routes.txt` are both generated from the tables (`UPDATE_ROUTES=1`).
- Each endpoint states who owns it and who uses it (2026-11-22): table header `owner: <domain>;` (one of the 8 domains; individual entries can override with `owner(…)` at end of line), and each entry must have
  `by(…)`: `web` frontend pages, `desktop` desktop shell main process, `worker` Python pipeline, `cli` command line, `ops` ops/debugging, `multiuser` only the discontinued multi-user edition, `agent` AI agent (**has runtime effect**: AI-only keys can only call endpoints tagged with it),
  `none` no caller yet. Omitting it fails compilation. If you can't name a caller, don't add the endpoint; if the backend adds it first and the caller follows later, write `none` and state in the handoff notes who is to wire it up.
  To see whether the registered and actual calls match, use `python3 ops/development/route_usage_report.py` (per-endpoint counts are in `data/**/diagnostics/route-usage.json`).
- Before adding a route or service, read the rules in `check_architecture.py`: handler files (under `src/routes/`) that `use crate::services::…`
  must register the file and allowed path prefixes in `ROUTE_SERVICE_IMPORT_ALLOWLIST`;
  new path parameters must be classified in `classify_param` in the accounts package's `backend/packages/retainpdf-accounts/src/access.rs`, otherwise multi-user mode returns 403 "not cleared".
- When changing `check_architecture.py`: rules for jobs and library use logical paths `src/services/<domain>/...`, fetch files with `abs_src`, scan directories with `scan_logical`;
  don't write `SRC_ROOT / ...` directly; actual directories are registered only in `DOMAIN_MOUNTS`. Paths written in rules must exist (`check_rule_paths` checks this);
  paths a rule requires to "not exist" are registered in `RULE_PATHS_MUST_NOT_EXIST`.
- `/jobs` is split into 8 categories: routes `app/router/jobs/<category>.rs`, handlers `routes/jobs/<category>.rs`, business logic
  `services/jobs/<category>/`, all three with the same name. New endpoints go into the matching category; don't add more top-level addresses like `/jobs/:job_id/<name>`;
  old addresses go directly below the new one with `old "<new address>"` at the end of the line. The root of `services/jobs/` only holds what all categories share (facade, dependencies, response views).
  Jobs and library have been split into packages; `services/jobs/...` and `services/library/...` are logical paths (architecture check errors also use them), actually located in
  `backend/packages/retainpdf-jobs/src/...` and `backend/packages/retainpdf-library/src/...`.
- New jobs are created only through `submit_job` in `services/jobs/lifecycle/creation/submit.rs`; rerunning an existing job in place goes through `relaunch_in_place`;
  writing to the database or launching jobs directly elsewhere makes `check_job_entry_ownership` report an error.
- Business logic lives only in the 8 domains (`accounts`, `providers`, `ingest`, `files`, `jobs`, `library`, `glossaries`,
  `platform`); new modules go into one of them. All 8 have been split into packages (finished 2026-10-17); `services/` has no more directories, only the `mod.rs` that wires them in.
  Each domain package's `lib.rs` is its single facade: submodules are private, and whatever is needed outside the domain is `pub use`d in the `// 门面` (facade) block.
- Domains split into standalone packages (`EXTRACTED_DOMAINS`, currently accounts `retainpdf-accounts`, files `retainpdf-files`, glossaries `retainpdf-glossaries`, ingest `retainpdf-ingest`, jobs `retainpdf-jobs`, library `retainpdf-library`, platform `retainpdf-platform`, providers `retainpdf-providers`): code is in `backend/packages/<package>`, `lib.rs` is the facade;
  `services/mod.rs` wires it in with `pub(crate) use <package> as <domain>;`, and no directory for it remains under `services/`.
  Exports used only by rust_api tests sit behind the `test-fixtures` feature in the package (`#[cfg(any(test, feature = "test-fixtures"))]`),
  enabled by rust_api's `[dev-dependencies]`; `#[cfg(test)]` is not visible across packages.
- Domains may only depend downwards; allowed directions are registered in `ALLOWED_DOMAIN_DEPENDENCIES`, and cycles are not allowed; things both sides need are moved down.
  Loading a job by ID (`job_loading`) and the error type (`AppError`) are in a separate package `retainpdf-api-base`, one layer below services;
  in rust_api keep writing `crate::error` (`job_loading` is only used by domain packages; write `retainpdf_api_base::job_loading`).
  Small test-only helpers (`project_venv_bin` to find the project Python environment, `minimal_pdf_bytes` for a minimal PDF) are also in the base package, behind `test-fixtures`.
- Endpoint request and response types go in the domain package they belong to (jobs' in `views/` of `retainpdf-jobs`; library, glossaries, file links, uploads and backups each in their own package),
  merged into `models::api` in rust_api's `backend/api/src/models.rs`; routes keep writing `crate::models::api::…`. The core package only holds records stored in the database
  (jobs, uploads, documents, glossaries, events) and small utilities every domain needs; no more response types are added there.
- To read things from a job request, use the methods in retainpdf-core `models/job/questions.rs` (`job.source_job_id()`, `job.uses_model_executor()`……);
  don't dot your way into `job.request_payload.<field>`; only the modules in `KNOWN_REQUEST_PAYLOAD_WRITERS` that generate or rewrite requests may do so, and the list may only shrink, never grow.
- Artifact file paths may only be built by the output modules (`services/jobs/files/downloads`, `services/jobs/reader/markdown.rs`, `services/library/media.rs`, plus the files package
  `retainpdf-files`'s `src/artifacts` and `src/derived_artifacts`). Elsewhere, to read artifacts already on disk (normalized document, translation manifest, translated PDF……),
  call the jobs package's `stored_path(job, data_root, StoredFile::…)`; don't call `storage_paths::resolve_*` directly; the frozen list `KNOWN_ARTIFACT_PATH_READERS` has been emptied and must not be added to.

## Records

- **Devlog**: `docs/ops/devlog/YYYY-MM.csv`, one row per item; add a row before merging each branch, and update the status after pushing.
  Columns and values are in [docs/ops/devlog/README.md](../../docs/ops/devlog/README.md); check the format with `python3 ops/development/check_devlog.py`.
- **Plans and decisions**: by topic in `docs/ops/planning/<topic>/`, file name `YYYYMMDD-<topic>.md`.
  New decisions go in new files; don't rewrite old files; the directory's README lists all files.
- Existing CSV ledgers (`docs/ops/planning/*.csv`) are append-only; never overwrite old rows.

## Security

- Do not commit or print keys and tokens; keys pasted in by the user must not be written to files or platform settings; remind the user to revoke and reissue them.
- Do not commit real user files, databases and job directories under `data/`, `tmp/`, or large experimental output.
- Do not send the user's email or other personal information to external services.
