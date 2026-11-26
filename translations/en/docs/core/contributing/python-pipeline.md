> English translation of [docs/core/contributing/python-pipeline.md](../../../../../docs/core/contributing/python-pipeline.md). The Chinese original is authoritative.

# Python Pipeline Contribution Guide

## Layering direction

Overall layering:

```text
entrypoints -> runtime/pipeline -> services/* -> foundation
```

Basic rules:

- OCR provider raw payloads must first go through `document_schema` to produce `document.v1`.
- The main translation chain consumes only `document.v1` and the translation stage spec.
- The main rendering chain consumes only the source PDF, the translation manifest, per-page translation payloads and the render stage spec.
- `runtime/pipeline` only orchestrates; it does not absorb provider, LLM, Typst or redaction details.
- `translation` does not import `render` and does not consume provider raw JSON.
- `ocr_provider` does not import `translate` or `render`.

For finer-grained rules see [Python backend architecture boundaries](../../../../../docs/core/python/architecture.md).

## Change rules

- Put new logic in existing layer directories first; avoid cross-layer imports.
- Boundaries for translation, rendering and OCR providers follow `docs/core/python/architecture.md`.
- When adding rule-like logic, prefer adding minimal regression tests, especially for formulas, terminology, bboxes and payload transformations.
- Translation consistency, glossaries, formula protection and rendering strategy should be passed via stable manifests/specs where possible, not by reading another module's internal temp files.
- Rendering and PDF-processing changes must state whether they change output PDF content, size, first-screen preview experience or copyable text.

## Common checks

Python translation:

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
python3 -m compileall -q "$BACKEND_ROOT/translation/retainpdf_translation" "$BACKEND_ROOT/pipeline/retainpdf_pipeline/translate"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/translation/tests" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/translation" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

Python document schema / providers:

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/document_schema" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

Rendering:

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/rendering" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

The backend source location is determined by the package manifest; see [Embedded backend package](./backend-package.md).

## PR description

A PR touching the Python pipeline should at least state:

- Which part it affects: OCR, translation or rendering.
- Whether it changes `document.v1`, the translation manifest, render payloads or stage events.
- Whether it affects re-rendering, checkpoint resume or diagnostics of old jobs.
- Which samples were used for verification, and whether they include formulas, figure captions, footnotes, long paragraphs or high-page-count PDFs.
