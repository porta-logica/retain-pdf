> English translation of [docs/core/contributing/testing.md](../../../../../docs/core/contributing/testing.md). The Chinese original is authoritative.

# Testing Contribution Guide

Test contributions matter as much as code contributions. Professional testers can contribute high-value work without first understanding the whole internal implementation.

## What you can contribute

- Public or anonymized PDF samples, with the expected behavior, page numbers, bboxes, screenshots and job_ids.
- Regression cases for OCR normalization, translation, formula protection, rendering, downloads, reader, library and resume.
- Large-sample performance benchmarks, e.g. stage durations, memory use and output size for 100-, 500- and 1000-page PDFs.
- End-to-end acceptance checklists, e.g. desktop first launch, Docker upgrade, retry after network loss, token errors, job cancellation, re-rendering, bulk deletion.
- Manual test reports, including environment, version, reproduction steps, expected results, actual results and attachments.
- Automated test scripts or fixtures, provided they contain no private tokens, real user files or non-public content.

## Suggested test issue format

```md
## 环境

- RetainPDF 版本：
- 运行方式：桌面端 / Docker / 本地开发
- 系统和浏览器：
- OCR provider：
- 模型 provider：

## 样本

- 是否可公开：
- 页数：
- 相关页码 / bbox：
- job_id：

## 步骤

1. ...
2. ...

## 期望结果

...

## 实际结果

...

## 附件

- 截图 / 脱敏 PDF / 日志 / 事件流片段
```

(Template glossary: 环境 = Environment — RetainPDF version, how it runs: desktop / Docker / local development, OS and browser, OCR provider, model provider; 样本 = Sample — can it be public, page count, relevant pages / bbox, job_id; 步骤 = Steps; 期望结果 = Expected result; 实际结果 = Actual result; 附件 = Attachments — screenshots / anonymized PDF / logs / event stream excerpts.)

## Test PR suggestions

- Keep fixtures small; if 1 to 3 pages reproduce it, don't commit a whole book.
- Large files, batches of PDFs and benchmark output go in `experiments/` or external links by default; only commit small samples that clearly need to be part of automated tests.
- When adding a test, state which bug, module or user flow it protects.
- For performance tests, state the machine environment, sample page count, command, old duration, new duration and allowed variance.
- For visual/rendering problems, attach page numbers, bboxes, screenshots and expected behavior where possible; just saying "it looks wrong" is hard to turn into a regression test.

## Common test entry points

Rust API:

```bash
npm run test:api
```

Python:

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/translation" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/document_schema" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/rendering" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

Frontend and desktop:

```bash
npm --prefix frontend/web test
npm --prefix frontend/web run build
npm --prefix frontend/desktop run verify-frontend-sync
```

`npm --prefix frontend/web test` uses Node's native test runner and focuses on regressions in pure functions that don't depend on a browser or backend services, such as job progress and status shaping.

The frontend end-to-end status smoke test actually submits jobs and usually needs a local Rust API, an OCR token, a model key and a sample PDF; run it only when you have these:

```bash
cd frontend/web
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```
