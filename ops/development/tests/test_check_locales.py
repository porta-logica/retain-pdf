"""UI message catalog check (locales/). The real catalogs must pass; the rest guards the checker's rules."""

from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "check_locales.py"
_spec = importlib.util.spec_from_file_location("check_locales", SCRIPT)
check_locales = importlib.util.module_from_spec(_spec)
sys.modules["check_locales"] = check_locales
_spec.loader.exec_module(check_locales)


def write(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def make_locales(tmp_path: Path, de: dict[str, str]) -> Path:
    root = tmp_path / "locales"
    write(root / "languages.json", {"source": "en", "languages": [{"code": "en", "name": "English"}, {"code": "de", "name": "Deutsch"}]})
    write(root / "en" / "auth.json", {"auth.a": "Hi {name}", "auth.b": "{n, plural, one {# file} other {# files}}"})
    write(root / "de" / "auth.json", de)
    return root


def test_repository_catalogs_pass():
    errors, _ = check_locales.check(check_locales.REPO_ROOT / "locales")
    assert errors == []


def test_complete_translation_passes(tmp_path):
    root = make_locales(tmp_path, {"auth.a": "Hallo {name}", "auth.b": "{n, plural, one {# Datei} other {# Dateien}}"})
    assert check_locales.check(root) == ([], [])


def test_missing_translation_warns_and_fails_only_when_strict(tmp_path):
    root = make_locales(tmp_path, {"auth.a": "Hallo {name}"})
    errors, warnings = check_locales.check(root)
    assert errors == [] and warnings == ["de: 1 untranslated key(s): auth.b"]
    errors, _ = check_locales.check(root, strict=True)
    assert errors == ["de: 1 untranslated key(s): auth.b"]


def test_wrong_placeholder_extra_key_and_wrong_prefix_fail(tmp_path):
    root = make_locales(tmp_path, {"auth.a": "Hallo {user}", "auth.b": "{n, plural, other {# Dateien}}", "auth.zzz": "x"})
    write(root / "de" / "common.json", {"auth.c": "x"})
    errors, _ = check_locales.check(root)
    assert "de: auth.a: placeholders ['user'] differ from en ['name']" in errors
    assert "de: auth.zzz: not in the source language (en)" in errors
    assert any("common.json: auth.c: keys in this file must start with 'common.'" in e for e in errors)


def test_unregistered_language_directory_fails(tmp_path):
    root = make_locales(tmp_path, {})
    shutil.copytree(root / "de", root / "fr")
    errors, _ = check_locales.check(root)
    assert "locales/fr/: not registered in languages.json" in errors
