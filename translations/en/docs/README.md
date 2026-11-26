> English translation of [docs/README.md](../../../docs/README.md). The Chinese original is authoritative.

# RetainPDF documentation index

For user installation, downloads and Docker deployment, see the [README](../../../README.md) at the repository root; for how to use it once installed, see the [user guide](../../../frontend/web/guide/README.md) (shipped with the software; clicking 「使用说明」 ("User guide") in the app opens it too).
This directory is the repository's single documentation root; do not create a parallel `doc/` or documentation directories outside modules.

## Entry points

- [User guide](../../../frontend/web/guide/README.md): written for users, one page per frontend module; it is what the 「使用说明」 ("User guide") link at the bottom of the app opens
- [Repository layout](./core/repository-layout.md): the six responsibilities, shared contracts and dependency rules
- [Mainline development docs](./core/README.md): current architecture, integration, development and runtime conventions
- [API Wiki](../../../docs/api/README.md): API navigation organized by endpoint capability
- [Architecture decision records](../../../docs/adr/README.md): long-lived key technical decisions
- [Reference material](../../../docs/reference/README.md): external services, design deliverables and topic material
- [Ops and process records](../../../docs/ops/README.md): plans, reports, post-mortems and migration records

## How to read

New documents should first pick one of the categories above and get an entry from the corresponding README. Modules may keep
implementation notes close to the code, but cross-module or collaboration-facing documents are all navigated from here.
