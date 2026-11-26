> English translation of [docs/core/contributing/process-and-style.md](../../../../../docs/core/contributing/process-and-style.md). The Chinese original is authoritative.

# Issues, PRs, Code Style and Release Notes

## Issue process

When filing a bug issue, try to include:

- RetainPDF version and how it runs: desktop / Docker / local development.
- Operating system and browser.
- OCR provider, model provider, job workflow.
- job_id, failing stage, error summary or screenshot.
- Reproduction steps.
- Expected and actual results.
- If a PDF sample is involved, say whether it can be made public; if not, provide minimal screenshots, page numbers, bboxes or an anonymized sample.

When filing a feature issue, try to include:

- The use case.
- How you want it exposed in the frontend/API/command line.
- Whether it must stay compatible with existing jobs, artifacts, reader, library or Docker delivery.
- Modules likely affected.

Do not post security issues, leaked keys or private data in public issues. First contact the maintainers via the chat group in the README or a private GitHub channel; if you can only file publicly, describe only the impact, without keys, real files or identifiable user data.

## PR process

Suggested process:

1. Open an issue first, or describe your plan under an existing one — especially for changes spanning Rust/Python/frontend/web/Docker.
2. Branch from the latest `main`.
3. Keep the PR focused: one topic at a time.
4. Add tests along with code changes, or explain why that's not possible yet.
5. Update the relevant docs.
6. In the PR description, state clearly what changed, why, and how it was verified.

Suggested PR description:

```md
## 变更

- ...

## 验证

- [ ] npm run test:api
- [ ] BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)" && python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
- [ ] npm --prefix frontend/desktop run verify-frontend-sync

## 风险

- ...
```

(Headings in the template: 变更 = Changes, 验证 = Verification, 风险 = Risks.)

If the PR changes user-visible behavior, attach screenshots, API examples, sample job_ids or before/after comparisons.

## Follow the existing style

"Follow the existing module style and naming" means:

- First find 2 to 3 similar implementations in the same directory and continue with their naming, error handling, return types, test style and file organization.
- Where existing modules are named `*_view`, `*_payload`, `*_manifest`, `*_contract`, new fields or helpers should reuse the same vocabulary rather than starting a mix of `dto/result/response/entity`.
- Where existing code uses narrow dependency parameters, do not regress to passing the whole `AppState`, global config or a big dict.
- Where existing API responses go through the view/projection layer, do not assemble ad-hoc JSON in the route.
- Where the existing Python pipeline uses stage specs, manifests and document.v1, do not bypass them to read provider raw JSON directly.

## When to add an abstraction

Do not introduce a new abstraction system for a single small requirement. These situations usually should not get a framework-style abstraction:

- Just adding a field, a button, a download entry or a validation branch.
- Just a little duplication between two call sites.
- Just to make names "more generic" without reducing real complexity.
- Just wrapping clear sequential logic in layers of class/factory/manager.

When a new abstraction is fine:

- The same logic is already duplicated in 3 or more places and is easy to miss when changing.
- An existing function mixes IO, policy, data conversion and error handling, making it hard to test.
- The abstraction narrows cross-layer dependencies, e.g. moving business decisions from a route into a service.
- The abstraction forms a stable contract, e.g. artifact manifest, reader region, translation diagnostics.

When adding an abstraction, state in the PR description:

- Which duplication or coupling it replaces.
- Which layer it belongs to.
- Which modules may depend on it and which should not.

## Scope of changes

- Do not mix unrelated refactors into a feature PR. Keep fixes, renames, directory moves and formatting separate where possible.
- Do not casually touch many unrelated files, sort imports, reorder CSS or rewrite historical logic unless that is the PR's goal.
- Do not commit local keys, tokens, real user files, `data/db/jobs.db`, large volumes of run artifacts in `data/jobs/*`, `tmp/*` or large experiment outputs.

## Performance and large-sample changes

Changes to rendering, PDF processing, translation batching or OCR adapters can significantly affect PDFs of 500+ pages. For performance-related changes, consider providing:

- Sample page count and file type.
- Old and new durations.
- The command or job_id used.
- Whether output PDF content, size or first-screen preview experience changes.

Large samples, temporary CSVs and benchmark outputs belong in `experiments/` or `tmp/` and should not be committed by default.

## Release and operations

Ordinary contributors usually don't need to tag or publish packages. Maintainers handle version commits, tags, GitHub pushes, desktop sync and the Docker/Release process separately when releasing.

If your PR affects release packages, state in the PR description:

- Whether it affects the desktop bundle.
- Whether it affects the Docker runtime config.
- Whether a database migration or compatibility with old jobs is needed.
- Whether the README, API docs or user installation instructions need updating.

For maintainer releases, Docker delivery and production operations records, see [Operations and process records](../../../../../docs/ops/README.md) and the Docker docs.
