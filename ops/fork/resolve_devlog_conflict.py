#!/usr/bin/env python3
"""Resolve a merge conflict in a devlog CSV (docs/ops/devlog/YYYY-MM.csv) during main -> i18n syncs.

Fork only. Both sides append rows at the end, so nearly every sync conflicts there. Rule (three-way, per row;
a row is one line because cells never contain newlines):

  result = upstream's file (stage 3, "theirs" = main)
         + rows the fork added since the merge base (in stage 2 "ours", not in stage 1 "base"), unless upstream has them

Rows that upstream removed or rewrote stay removed or rewritten: upstream owns its own rows.
Fork rows that the fork itself rewrote (e.g. status in_progress -> merged) appear in their current form.

Usage (inside a conflicted merge): resolve_devlog_conflict.py PATH...   then `git add PATH...`.
"""
from __future__ import annotations

import subprocess
import sys


def stage(path: str, number: int) -> list[str]:
    result = subprocess.run(["git", "show", f":{number}:{path}"], capture_output=True, text=True)
    if result.returncode != 0:
        return []  # e.g. the file did not exist in the merge base
    return result.stdout.splitlines()


def resolve(base: list[str], ours: list[str], theirs: list[str]) -> list[str]:
    base_rows, theirs_rows = set(base), set(theirs)
    fork_rows = [row for row in ours if row not in base_rows and row not in theirs_rows and row.strip()]
    return theirs + fork_rows


def main(paths: list[str]) -> int:
    if not paths:
        print(__doc__, file=sys.stderr)
        return 2
    for path in paths:
        theirs = stage(path, 3)
        if not theirs:
            print(f"error: {path}: no upstream version (stage 3) in the index; not a conflicted merge?", file=sys.stderr)
            return 1
        merged = resolve(stage(path, 1), stage(path, 2), theirs)
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write("\n".join(merged) + "\n")
        print(f"{path}: kept upstream's {len(theirs)} lines + {len(merged) - len(theirs)} fork row(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
