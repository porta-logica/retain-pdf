> English translation of [docs/core/contributing/README.md](../../../../../docs/core/contributing/README.md). The Chinese original is authoritative.

# Contributing Documentation

This directory holds role-specific guides for RetainPDF contributors. The root [CONTRIBUTING.md](../../../CONTRIBUTING.md) is the short entry point; the details live here.

## Entry points

- [Frontend and desktop](./frontend.md)
- [Rust API](./backend.md)
- [Database and persistence](./database.md)
- [Python pipeline](./python-pipeline.md)
- [Embedded backend package](./backend-package.md)
- [Contributing tests](./testing.md)
- [AI-assisted development](./ai-development.md)
- [Issues, PRs, code style and release notes](./process-and-style.md)

## How to read

Read the root contributing guide first, then go to the sub-document for the module you want to change. Cross-module changes require reading the docs for every module involved.
When HTTP or the worker wire protocol is involved, you must also read
[`docs/api/`](../../../../../docs/api/README.md) (the public API documentation) and
[`contracts/README.md`](../../../../../contracts/README.md); updating prose alone is not enough.
