"""Devlog conflict rule for main -> i18n syncs (ops/fork/resolve_devlog_conflict.py)."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "resolve_devlog_conflict.py"
_spec = importlib.util.spec_from_file_location("resolve_devlog_conflict", SCRIPT)
mod = importlib.util.module_from_spec(_spec)
sys.modules["resolve_devlog_conflict"] = mod
_spec.loader.exec_module(mod)

HEADER = '"date","branch"'


def test_keeps_upstream_file_and_appends_new_fork_rows():
    base = [HEADER, '"1","up-a"']
    ours = [HEADER, '"1","up-a"', '"2","fork-x"']
    theirs = [HEADER, '"1","up-a"', '"2","up-b"']
    assert mod.resolve(base, ours, theirs) == [HEADER, '"1","up-a"', '"2","up-b"', '"2","fork-x"']


def test_rows_upstream_removed_or_rewrote_stay_that_way():
    base = [HEADER, '"1","up-a","in_progress"', '"1","up-gone"']
    ours = list(base) + ['"2","fork-x"']
    theirs = [HEADER, '"1","up-a","pushed"']
    assert mod.resolve(base, ours, theirs) == [HEADER, '"1","up-a","pushed"', '"2","fork-x"']


def test_fork_rows_already_upstream_are_not_duplicated():
    base = [HEADER]
    ours = [HEADER, '"2","same"']
    theirs = [HEADER, '"2","same"']
    assert mod.resolve(base, ours, theirs) == [HEADER, '"2","same"']


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=False, capture_output=True, text=True).stdout


def test_end_to_end_in_a_real_conflicted_merge(tmp_path):
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "t@example.com")
    git(tmp_path, "config", "user.name", "t")
    log = tmp_path / "log.csv"
    log.write_text(f'{HEADER}\n"1","base"\n', encoding="utf-8")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-qm", "base")
    git(tmp_path, "switch", "-qc", "i18n")
    log.write_text(f'{HEADER}\n"1","base"\n"2","fork"\n', encoding="utf-8")
    git(tmp_path, "commit", "-qam", "fork row")
    git(tmp_path, "switch", "-q", "main")
    log.write_text(f'{HEADER}\n"1","base"\n"2","upstream"\n', encoding="utf-8")
    git(tmp_path, "commit", "-qam", "upstream row")
    git(tmp_path, "switch", "-q", "i18n")
    git(tmp_path, "merge", "-q", "main")
    assert "<<<<<<<" in log.read_text(encoding="utf-8")
    result = subprocess.run([sys.executable, str(SCRIPT), "log.csv"], cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert log.read_text(encoding="utf-8") == f'{HEADER}\n"1","base"\n"2","upstream"\n"2","fork"\n'
