# English translations

English reading copies of the repository's Chinese documents and agent instructions. This directory exists only
in this fork (branch `i18n`); upstream files are never translated in place, so syncing with upstream never
conflicts here. Background: [fork maintenance proposal](../docs/ops/planning/i18n/20261126-fork-maintenance.md).

- `en/<original path>` — the translation of `<original path>`, e.g. [en/CLAUDE.md](en/CLAUDE.md) translates
  [CLAUDE.md](../CLAUDE.md). The Chinese original is authoritative.
- `manifest.json` — for each translation, the git blob hash of the original it was made from and the date.
- `tools/translation_status.py` — finds stale and untranslated documents.

## Workflow

```bash
python3 translations/tools/translation_status.py                       # summary
python3 translations/tools/translation_status.py --stale               # originals changed since translation
python3 translations/tools/translation_status.py --diff CLAUDE.md      # what changed upstream since then
python3 translations/tools/translation_status.py --untranslated --prefix docs/core
# … translate or update translations/en/<path> …
python3 translations/tools/translation_status.py --fix-links           # links to untranslated files -> originals
python3 translations/tools/translation_status.py --record <path>...    # mark as current
python3 translations/tools/translation_status.py --check               # broken links / missing manifest entries
```

Translation conventions: keep Markdown structure, code, commands, paths and identifiers unchanged; keep Chinese
file names as they are; terms: 领域 domain, 任务 job, 书库 library, 术语表 glossary, 产物 artifact,
流水线 pipeline, 接口 endpoint/API, 快照 snapshot, 开发记录 devlog. Each file starts with a line linking its original.
