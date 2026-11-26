> English translation of [docs/core/contributing/ai-development.md](../../../../../docs/core/contributing/ai-development.md). The Chinese original is authoritative.

# AI-Assisted Development Guide

RetainPDF encourages AI-assisted development. We recommend coding agents such as Codex or Claude Code that can read and write the local repository, run commands and execute tests, rather than asking a model in a chat window to invent a plan out of thin air.

AI can improve efficiency, but it cannot replace boundary judgment, test verification or final responsibility. Whoever submits a PR must confirm the change fits the project architecture, passes the necessary checks, and be able to explain the risks.

## Recommended tools

- Codex: good for code changes, refactoring, testing, doc cleanup and pre-release checks in a local repository.
- Claude Code: good for long-context code reading, cross-file refactoring, generating tests and summarizing complex changes.

Contributors are not required to use any particular tool, but if AI took part in development, briefly say in the PR description which parts it helped with, e.g. "helped generate tests", "helped tidy docs", "helped refactor import boundaries".

## Suggested AI skills

The capabilities below can be written as a Codex skill, a Claude Code command, or an in-project agent checklist.

### RetainPDF project context

Purpose: make the AI understand the repository boundaries before acting.

Should include:

- Project root: the current product repository root; do not hard-code absolute local paths.
- Backend source: first run `.github/scripts/resolve_backend_source.py --json` to resolve the self-contained package inside the current product commit.
- Main backend modules: `api/`, `ai/`, `pipeline/`, `translation/`, `contracts/`, `packages/` (Rust packages); product integration lives in `.github/`, `ops/deployment/docker/` and `backend-package.json`.
- Rust workspace: `api` is the HTTP composition root; the stable boundaries are
  `retainpdf-core`, `retainpdf-data`, `retainpdf-runner`, `retainpdf-proc` and the domain packages under `backend/packages/`, plus
  `backend/jobs` (`retain-jobsd`). Do not merge these responsibilities back into `rust_api/src`.
- Core rules: do not revert unrelated uncommitted changes; make manual edits with patches; read neighboring code before changing; run tests per module.
- Doc entry points: root `CONTRIBUTING.md` and `docs/core/contributing/README.md`

### Rust API boundary check

Purpose: stop the AI from mixing routes, services, runner and db.

Remind the AI:

- `src/app/router/*` only assembles routes; `src/routes/*` is only the HTTP adapter.
- Application use cases, facades and safe views/projections live in the 8 domain packages (`backend/packages/retainpdf-<domain>`; `src/services/mod.rs` only wires them in).
- `backend/packages/retainpdf-runner/src/job_runner/*` does runtime execution; generic process control stays in `retainpdf-proc`.
- Database access goes through the `retainpdf-data::Db` facade and domain submodules; no raw SQL in routes/services.
- New API fields must be synced to the per-domain API docs, the mirrored JSON Schemas and the producer/consumer contract tests.

Common checks:

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
cargo fmt --manifest-path "$BACKEND_ROOT/api/Cargo.toml" --check
cargo test --locked --workspace --manifest-path "$BACKEND_ROOT/api/Cargo.toml"
python3 "$BACKEND_ROOT/api/scripts/check_architecture.py"
```

### Python pipeline boundary check

Purpose: stop the AI from introducing cross-layer imports or bypassing the stable manifests.

Remind the AI:

- Raw OCR payloads first go into `document_schema`, which produces `document.v1`.
- translation does not import rendering.
- rendering only consumes the source PDF, the translation manifest, per-page payloads and the render spec.
- When adding formula, glossary, bbox or rendering strategies, add a minimal regression test.

Common checks:

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/translation" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/rendering" -q
```

### Frontend and desktop sync

Purpose: stop the AI from changing only the web source and forgetting the desktop bundle.

Remind the AI:

- After changing `frontend/web/**`, run `npm --prefix frontend/desktop run verify-frontend-sync`.
- Do not change only `frontend/desktop/app/frontend/**`.
- `frontend/web-react/` is a migration area and does not replace `frontend/web/` by default.
- The local static frontend's default port is `40001`.

Common checks:

```bash
npm --prefix frontend/web run build
npm --prefix frontend/desktop run verify-frontend-sync
```

### Test and regression generation

Purpose: let the AI help professional testers turn problems into reproducible cases.

Ask the AI to output:

- Environment, version, provider, workflow.
- Whether the sample can be made public.
- Page number, bbox, screenshots, job_id.
- Reproduction steps, expected result, actual result.
- A minimal fixture or automated-test suggestion.

### Documentation consistency check

Purpose: keep docs from falling behind code changes.

Ask the AI to check:

- Whether API fields, requests/responses and error codes are synced to `docs/api/` (the single public API documentation); whether internal implementation notes are synced to `docs/core/api/`.
- Whether Rust boundaries are synced to `docs/core/rust_api/`.
- Whether shared schemas stay
  byte-identical between `backend/contracts` and `contracts`.
- Whether Python boundaries are synced to `docs/core/python/`.
- Whether frontend, Docker and desktop ports and commands are consistent.
- Whether the root `CONTRIBUTING.md` is still just a short entry point.

## Recommended workflow

1. Have the AI read the relevant sub-documents first, not change code right away.
2. Ask the AI for the scope of impact and a verification plan.
3. Have the AI submit patches in small steps, with no unrelated formatting.
4. Run the corresponding tests or checks.
5. Have the AI do a review: focus on cross-layer dependencies, legacy compatibility, test gaps and doc gaps.
6. A human confirms the output, risks and PR description.

## Prompt suggestions

You can say this directly to Codex or Claude Code:

```text
你在 RetainPDF 仓库中工作。先阅读 CONTRIBUTING.md 和相关 docs/core/contributing 子文档。
只修改本任务相关文件，不要回滚无关脏改。
改动前说明影响范围，改动后运行对应测试。
如果不能运行测试，说明原因和剩余风险。
```

(English: You are working in the RetainPDF repository. First read CONTRIBUTING.md and the relevant docs/core/contributing sub-documents. Only modify files related to this task; do not revert unrelated uncommitted changes. Before changing, explain the scope of impact; after changing, run the corresponding tests. If you cannot run the tests, explain why and the remaining risk.)

For the backend:

```text
检查这次 Rust API 改动是否违反 routes -> services -> job_runner/db 的边界。
重点看 route 是否拼业务 JSON、service 是否直接依赖 HTTP Response、job_runner 是否反向依赖 service。
给出文件和行号，必要时直接修复。
```

(English: Check whether this Rust API change violates the routes -> services -> job_runner/db boundary. Focus on whether routes assemble business JSON, whether services depend directly on HTTP Response, and whether job_runner depends back on services. Give files and line numbers; fix directly if needed.)

For Python:

```text
检查 translation、rendering、ocr_provider 是否存在跨层 import。
不要让 translation import render。
如果需要共享数据，通过 manifest/spec/document.v1 传递。
```

(English: Check whether translation, rendering and ocr_provider have cross-layer imports. Do not let translation import render. If data must be shared, pass it via manifest/spec/document.v1.)

For tests:

```text
把这个 bug 报告整理成可复现测试用例。
需要包含环境、样本、页码、bbox、复现步骤、期望结果、实际结果，以及建议自动化测试落点。
```

(English: Turn this bug report into a reproducible test case. Include environment, sample, page number, bbox, reproduction steps, expected result, actual result, and where an automated test should go.)

## Notes

- AI-generated code must be reviewed by a human.
- AI must not commit real user files, private tokens, local databases or large runtime artifacts.
- When refactoring, the AI must state which duplication or coupling it replaced; it must not add abstractions just to "look more generic".
- When the AI changes release, Docker or desktop packaging flows, it must additionally explain how to roll back and how to verify.
