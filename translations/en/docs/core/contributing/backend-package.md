> English translation of [docs/core/contributing/backend-package.md](../../../../../docs/core/contributing/backend-package.md). The Chinese original is authoritative.

# Embedded Backend Package

RetainPDF maintains a single official product repository. The Rust API, AI service, Python pipeline, contracts, runtime resources and app Dockerfile together form the self-contained backend package under the root `backend/`, with no dependency on another GitHub repository, cross-repository tokens or MCP.

The root `backend-package.json` declares the package location:

```json
{
  "schema_version": 1,
  "source_path": "backend"
}
```

The Git commit itself pins the same version of frontend, backend and contracts. The backend no longer maintains a second repository/revision/source-tree lock.

## Single resolution entry point

Local scripts and CI should obtain the backend path via `.github/scripts/resolve_backend_source.py`, instead of repeatedly hard-coding `backend/` in commands. The resolver confirms that:

- the package is inside the current product Git repository;
- the required Rust, Python, config and Docker files are complete;
- the package used by CI or release commands has no uncommitted changes;
- it outputs the current product revision and backend subtree tree, for cache and artifact naming.

Show the current package:

```bash
python3 .github/scripts/resolve_backend_source.py --json
```

For local development that needs to test uncommitted backend changes, use the wrapper, which does no shell expansion:

```bash
python3 .github/scripts/run_with_backend_source.py -- \
  cargo test --locked --workspace --manifest-path {backend}/api/Cargo.toml
```

The wrapper allows in-progress changes in the current `backend/`, but still runs package path and layout validation. CI's `.github/actions/prepare-backend-source` does not allow a dirty package.

## Code and release boundaries

- The backend components' Python packaging, Rust workspace, source archives and Docker builds remain independently verifiable.
- Product and backend contract schemas must pass the parity check in the same PR.
- Docker, desktop and local runs all consume the same `backend/` inside the current product commit.
- CI only checks out the current product commit, then validates and consumes `backend/` in place.
- Local backend copies outside the product repository may be used for self-contained verification, but are not product build inputs or a second release source.

When adding backend capabilities, modify `backend/` directly and update tests, contracts and docs together. Do not manually copy changes from a local verification copy into the product artifact directory; changes worth keeping must enter the product's Git history.
