> English translation of [docs/core/repository-layout.md](../../../../docs/core/repository-layout.md). The Chinese original is authoritative.

# Repository Directory Responsibilities

The repository is partitioned by responsibility, and modules are organized by feature internally. Directory moves do not change package names, public APIs,
the job protocol, the desktop installer's internal layout or the location of user data.

| Directory | Responsibility |
| --- | --- |
| `frontend/web`, `frontend/desktop` | Web and desktop entry points |
| `frontend/packages` | Shared frontend UI, Reader, client and presentation models |
| `backend/api`, `backend/jobs` | HTTP boundary and job process scheduling |
| `backend/pipeline` | Standalone executable document pipeline (the AI service `backend/ai` was removed on 2026-11-03) |
| `backend/packages` | Internal shared Rust libraries for the backend |
| `database/retainpdf-db` | Data access implementation, migrations and their tests; contains no real database files |
| `contracts` | The single upstream for cross-platform JSON Schemas and generated DTOs |
| `backend/contracts` | Byte-identical protocol mirror supporting the backend source package; does not evolve independently |
| `tests` | Project-level performance tests and fixed samples |
| `ops/development`, `ops/release`, `ops/deployment` | Local environment, delivery tooling and deployment configuration |
| `security` | Security guidelines, checks and test navigation |
| `resources` | Static resources shared across modules, such as fonts |
| `docs` | Architecture, development, reference material and operations records |
| `experiments` | Experiments that production code does not depend on |

## Dependency and ownership rules

- Dedicated resources, unit tests and dev tools live with their module; only cross-module tests go in the root `tests`.
- Applications depend on their own shared libraries; the frontend does not reference backend implementation and vice versa.
- Cross-platform protocols must not depend on business implementation; after changing the upstream, sync the mirror and run the parity check.
- The pipeline does not depend on HTTP request context or the UI and must be independently invocable by offline commands.
- The data layer does not depend on API routes, job scheduling or model calls. Security checks are still performed by business entry points.
- Workspace manifests, lock files and `.github` stay where tools require them; no permanent copies of old directories
  or symlinks for source-path compatibility.

## Data and verification

Local API auth config lives by default in `backend/api/auth.local.json`, is not added to Git, and its file permissions
should be restricted to read/write for the current user only. An explicit `RUST_API_ROOT` still determines a custom config location; the desktop
uses its original user directory. The default new layout no longer falls back to reading `services/api/auth.local.json`.
Explicit `RUST_API_KEYS`, `RUST_API_MAX_RUNNING_JOBS`, `RUST_API_SIMPLE_PORT`
take precedence over the config file, with file values used when unset; an explicitly empty key or a corrupt file errors out clearly
rather than being silently bypassed. The dev launcher sets the key and port explicitly, and non-loopback listening rejects the default dev key.

This round only moves source code: existing `data/`, `tmp/`, credentials and job artifact paths stay as they are.
`var/` is a candidate for future normalization of run artifacts, not a new run root in this round. Test fixtures are
versioned inputs; test output must not be written back into fixtures or committed to the repository.

Protocol check: `python3 backend/contracts/check_parity.py --require-upstream`.
Frontend, backend, translation, source archive and desktop verification should each be reported separately; static path checks do not mean
a real release, a Windows install or paid model calls have passed.
