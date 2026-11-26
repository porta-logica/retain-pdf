> English translation of [docs/core/contributing/database.md](../../../../../docs/core/contributing/database.md). The Chinese original is authoritative.

# Database and Persistence Contribution Guide

## Runtime location

The Rust API currently uses SQLite, located by default at `DATA_ROOT/db/jobs.db`. Common paths in local development:

- `data/db/jobs.db`: the SQLite database; not committed by default.
- `data/jobs/**`: job run directories and intermediate artifacts; not committed by default.
- `data/uploads/**`: uploaded files; not committed by default.
- `data/downloads/**`: download artifacts; not committed by default.

For the storage layout see [Runtime storage layout](../../../../../docs/core/api/storage.md).

## Code boundaries

All database access is consolidated in
`database/retainpdf-db/src/db.rs` and its submodules (re-exported by `retainpdf-data` as `retainpdf_data::db`):

- `db.rs`: the `Db` facade, exposing persistence for jobs, artifacts, events, documents, collections, glossaries, translation versions, sync, and so on.
- `database/retainpdf-db/schema.sql`: **what every table looks like now** (columns, types, defaults, primary keys, foreign keys, indexes, triggers) — a snapshot of a fresh empty database after running all table creation and migrations.
  If you change the structure (add a migration), regenerate it: `UPDATE_SCHEMA=1 cargo test -p retainpdf-db schema_snapshot`; the diff should contain only the expected changes.
  That an old database upgraded step by step matches a freshly created one is guarded by `an_old_database_upgraded_matches_a_fresh_one`; a real database can be compared once, read-only:
  `RETAINPDF_COMPARE_DB=<db file> cargo test -p retainpdf-db compare_a_real_database -- --ignored --nocapture`.
- `db/snapshot_diff.rs`: **the before/after comparison tool for schema changes** (used at every step of the database redesign, see
  [Database redesign overall design](../../../../../docs/ops/planning/database-redesign/20261120-数据库重做总体设计.md)). It only calls `Db`'s public read API and exports what it reads —
  job snapshots, artifact lists, progress events, resume records, books, uploads, translation versions, progress feeds, various lists and counts — as one-record-per-line JSON (sorted by category and ID,
  with credentials in requests replaced by fingerprints). Export once before and once after the migration and compare record by record; if the read API is unchanged they should be identical. IDs the read API needs to know up front (uploads, progress feeds, resume stages and external calls)
  are listed from the tables in `enumerate_keys`; **when renaming or splitting tables, change this one place**. Usage (opening an old database upgrades it to the current program, so only use it on copies; it refuses a database in use):

  ```bash
  sqlite3 data/db/jobs.db ".backup /tmp/x/before.db" && cp /tmp/x/before.db /tmp/x/after.db
  <main 上编的 retainpdf> db-snapshot dump --db /tmp/x/before.db --out /tmp/x/before.jsonl
  <分支上编的 retainpdf>  db-snapshot dump --db /tmp/x/after.db  --out /tmp/x/after.jsonl   # 打开时跑新迁移
  retainpdf db-snapshot diff /tmp/x/before.jsonl /tmp/x/after.jsonl [--ignore 类别[:字段路径前缀]]...
  ```

  (In the block above: `<main 上编的 retainpdf>` = retainpdf built on main; `<分支上编的 retainpdf>` = retainpdf built on the branch; the comment means "runs the new migrations on open"; `类别[:字段路径前缀]` = category[:field path prefix].)

  Exit code 0 if identical, 1 if different, listing which record, which field, and the before/after values. Use `--ignore` only for **intentional** changes, and state in the merge description what was ignored and why.
- `db/schema/base.sql`: idempotent creation of the earliest tables (uploads, jobs, artifacts, events, glossaries), the starting point of a new database; do not add new tables or columns here.
- `db/schema/mod.rs`: the executor for numbered migrations, plus idempotent column additions for old tables (`LEGACY_COLUMNS`, now only `jobs.document_id`).
- `db/schema/migrations/`: numbered migrations, one `vNN_<domain>.sql` per migration, with the explanation at the top of the file; the list is in `migrations/mod.rs`. The version number is the position in the list; released ones can only be appended to — never changed, deleted or reordered.
  For migrations that **cannot be re-run** — changing column values, dropping columns, adding columns with foreign keys (from v32 on) — register an "already in the post-migration shape" query in `APPLIED_CHECKS` in `schema/mod.rs`:
  normal upgrades never hit it; it is for tests that roll `user_version` back and re-run later migrations (SQLite cannot drop columns with foreign keys, so they cannot be undone).
  To test "upgrading an old database", prefer `schema::create_at_version(conn, N)` to create a database stopped at migration N, write data in that era's table shapes, then `Db::init`,
  instead of manually undoing later migrations (example: `a_v35_book_reads_the_same_after_the_library_items_migration` in `documents/tests.rs`).
- Values such as status and workflow are stored as **plain text** and pinned with `CHECK` (from v32: `jobs.status`, `jobs.workflow`; previously JSON strings `"succeeded"`).
  In code, write and query with `JobStatusKind::as_str()` / `WorkflowKind::as_str()`, not `serde_json::to_string` (that adds quotes).
  The parent of an OCR sub-job is in `jobs.parent_job_id` (filled by the database layer when writing the job from the ID pattern `{parent job}-ocr`; left empty if the parent is not in the database).
- A job's runtime info (`runtime` in the API, from v33) **stores only what cannot be computed**: stage history is in `job_stage_history` (one row per stage, append-only; writes touch only changed rows);
  time entered the current stage, last error and retry times, and retry count are columns on `jobs`. Current stage, end reason, the two durations, final failure category and summary are computed on read by
  `JobRecord::fill_derived_runtime` — the same function as the last step of `sync_runtime_info` before writing, so what is read equals what was computed at write time
  (pinned by `runtime_reads_back_exactly_what_was_computed_before_writing`). From v33 `LEGACY_COLUMNS` no longer backfills (otherwise it would add back the dropped `runtime_json`).
- `job_usage_cache` / `job_usage_rollups` (v34): per-job model usage totals, a **cache** — the source of truth is the ledgers and reports in the job directory; `source_key`
  records those files' sizes, modification times and the price-table fingerprint at computation time, and recomputes on mismatch (job package `reports/usage/cache.rs`). No foreign key to `jobs`
  (jobs whose record was deleted but whose directory remains still get usage computed); not synced.
- Progress feed `event_feed_items` (from v35): items from `events` store only `source_event_uid` (which raw event), and the content is computed on read by `project_event` in the job package's
  `progress/event_feed/sync.rs` — the same function as at import; items from jsonl files in the job directory still store `payload_json`.
  When raw events are deleted by retention, the source revision changes and the feed is rebuilt; deletion during a read is reported as "event stream changed" and the frontend rereads from the start.
- Duplicate-submission prevention (v38, see [Duplicate-submission prevention](../../../../../docs/ops/planning/api-reorg/20261124-防重复提交.md)): `job_derivations` records which source job a new job created by resume, retry or OCR-ambiguity recovery
  derives from (deleted along with the new job); `Db::save_derived_job_as_new_run` checks "does the source job still have a queued / running derived job" and persists within the same `BEGIN IMMEDIATE` transaction;
  `idempotency_keys` is a short-term record of the `Idempotency-Key` request header (kept 24 hours, used by rust_api's
  `app/idempotency.rs`, periodically purged of expired entries). Neither table is synced or backfilled.
- Artifact paths are always stored relative to the data directory (`normalize_job_artifacts_for_storage`). The event log `events_jsonl` and previous translation `previous_output_pdf` were only added on 2026-11-21
  and handled leniently: ones outside the data directory (synced from another device) are kept as-is without error; ones previously stored as local absolute paths are rewritten once by `relativize_stored_artifact_paths` in `Db::init`.
- Incremental shrinking: `PRAGMA incremental_vacuum` returns one row per page freed; use `maintenance::incremental_vacuum` to run it to completion (`execute_batch` takes only one step, freeing one page).
- `db/rows.rs`: shared row decoding; domain-specific decoding stays in the corresponding submodule.
- The library (from v36) is "item master table + per-type detail tables": items `library_items` (currently only references `reference`; later notes, annotations, plugin types),
  bibliographic records `item_references` (common CSL fields as columns, the rest as a blob in `extra_csl_json`; title source and lock also live here), creators `item_creators` (one per row),
  files under an item `item_files` (`file_id` = sha256 of the PDF content = the `document_id` in the API; reading state, current job, chosen translation `chosen_version_id`),
  title suggestions `item_title_suggestions`; from v37 also tags `tags` / `item_tags` (any item can be tagged; tag IDs are derived from names, so identical names aren't duplicated),
  relations between items `item_relations`, and folder members `collection_items` (members are items). The item ID auto-created on PDF upload is the file's content fingerprint (`item_id = file_id`).
  **A book in the API (`DocumentRecord`) is read from the view `library_documents`**; per-book lookups and filters are written against this view; writes go separately to item, bibliographic record and
  file. Deleting a book deletes the item (`DELETE FROM library_items`); bibliographic records, creators, files, title suggestions, and translation versions and folder memberships hanging off the files
  are all cascade-deleted via foreign keys. Jobs, translation versions and the full-text index link by the file's content fingerprint, not directly to the item. Design: see
  [Library item model](../../../../../docs/ops/planning/database-redesign/20261121-书库条目模型.md) and [Step 5a adjustments](../../../../../docs/ops/planning/database-redesign/20261121-书库条目第5a步.md).
- Reader ask Q&A records (v39, see [Step 3: Q&A records](../../../../../docs/ops/planning/reader-ask/20261125-第3步：问答记录.md)): `ask_threads` has one row per question
  (anchor split into columns: pane, page, block, selected text, that block's source and translation, section, position on page), `ask_messages` one row per Q&A message (usage as a JSON blob). Attached to
  `item_files(file_id)`, cascade-deleted with the book; not synced, no ownership column (follows the book). The comparison tool exports `ask_threads` in each book's `document` record.
- `db/documents/*`: documents, search, backfill and document row reads. (Tables and modules for AI chat, AI computation, AI document rewriting and favorites were removed on 2026-11-20, v31.)
- `db/pipeline/*`: pipeline attempts, dispatch, stages, units, events and transactional writes; reads and migration writes must not be merged back into one big file.

Basic rules:

- When touching the database, prefer extending via the `Db` facade and existing domain modules; do not write SQL directly in routes, HTTP services or the presentation layer.
- Keep queries, transactional writes, row decoding and compatibility migrations separate; cross-table atomic operations are centralized in the domain `tx` module.
- When adding a persisted field, first decide whether it belongs in a database record, a file manifest, or transient runtime state; do not casually stuff transient state into the database.
- Store relative paths, artifact keys, job_ids and stable metadata in the database where possible; resolve real file paths at runtime via the storage path resolver.
- API response fields should preferably come from the view/projection layer; do not let the frontend depend directly on database column names or `JobSnapshot` internal fields.
- Data the frontend consumes long-term — glossaries, library, artifact manifests, reader metadata — should preferably be designed as stable tables/stable views.

## Compatibility requirements

When changing the schema, you must consider:

- Whether an old `jobs.db` still starts.
- Whether old jobs can still be listed, viewed in detail and deleted.
- Whether old artifacts can still be downloaded.
- Whether old glossaries can still be read or migrated.
- Whether old documents/conversations/operations/versions can still be restored with a consistent active version.
- Whether running pipeline attempts, dispatches and committed units are still recognizable after a process restart.
- Whether re-rendering, checkpoint resume or failure diagnostics are affected.

Do not commit your local `data/db/jobs.db`. To reproduce a database problem, prefer providing minimal SQL, an anonymized fixture, the job_id, the schema version and reproduction steps.

## Common checks

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
cargo test --locked --workspace --manifest-path "$BACKEND_ROOT/api/Cargo.toml"
python3 "$BACKEND_ROOT/api/scripts/check_architecture.py"
```

When adding database behavior, prefer adding minimal unit tests in the corresponding domain submodule of `retainpdf-data/src/db/**`;
only extend `db.rs` for capabilities that genuinely belong to the public façade.

## PR description

A PR touching the database should at least state:

- Which tables, columns, indexes or JSON fields were added or changed.
- Whether old jobs, artifacts, glossaries, documents, conversations and operations remain compatible.
- Whether a migration, backfill, cleanup or one-off fix script is needed.
- Which database tests cover it, and whether it was verified against old data samples.
