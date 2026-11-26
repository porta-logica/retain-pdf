#!/usr/bin/env python3
"""Check the UI message catalogs in locales/ (design: docs/ops/planning/i18n/).

Errors (exit 1):
  - a file is not a flat JSON object of string -> string
  - a key does not start with "<file name>." (auth.json holds only "auth.*" keys)
  - a key appears in two files of the same language
  - a language has a key the source language (en) does not have
  - a translation uses different placeholders than the source text ({min} vs {minimum})
  - a language registered in languages.json has no directory, or vice versa

Warnings (exit 0, listed so translators can find gaps):
  - keys missing from a language (the UI falls back to en)

ICU syntax itself is checked by the frontend test tests/platform/i18n.test.mjs.

Usage: python3 ops/development/check_locales.py [--locales DIR] [--strict]
  --strict  also fail on missing translations.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Top-level ICU argument names: "{name}", "{name, plural, …}", "{name, number}".
PLACEHOLDER = re.compile(r"\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]")


def placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER.findall(text))


def load_language(directory: Path, errors: list[str]) -> dict[str, str]:
    messages: dict[str, str] = {}
    for path in sorted(directory.glob("*.json")):
        rel = path.relative_to(directory.parent)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"{rel}: invalid JSON: {exc}")
            continue
        if not isinstance(data, dict):
            errors.append(f"{rel}: must be a JSON object")
            continue
        prefix = f"{path.stem}."
        for key, text in data.items():
            if not isinstance(text, str):
                errors.append(f"{rel}: {key}: value must be a string")
                continue
            if not key.startswith(prefix):
                errors.append(f"{rel}: {key}: keys in this file must start with '{prefix}'")
            if key in messages:
                errors.append(f"{rel}: {key}: defined in more than one file")
            messages[key] = text
    return messages


def check(locales: Path, strict: bool = False) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    registry = json.loads((locales / "languages.json").read_text(encoding="utf-8"))
    source = registry["source"]
    codes = [entry["code"] for entry in registry["languages"]]
    if source not in codes:
        errors.append(f"languages.json: source language '{source}' is not in 'languages'")
        return errors, warnings

    on_disk = {p.name for p in locales.iterdir() if p.is_dir()}
    for code in codes:
        if code not in on_disk:
            errors.append(f"languages.json: '{code}' has no directory locales/{code}/")
    for name in sorted(on_disk - set(codes)):
        errors.append(f"locales/{name}/: not registered in languages.json")

    catalogs = {code: load_language(locales / code, errors) for code in codes if code in on_disk}
    reference = catalogs.get(source, {})
    for code, messages in catalogs.items():
        if code == source:
            continue
        missing = sorted(set(reference) - set(messages))
        for key in sorted(set(messages) - set(reference)):
            errors.append(f"{code}: {key}: not in the source language ({source})")
        for key in sorted(set(messages) & set(reference)):
            want, got = placeholders(reference[key]), placeholders(messages[key])
            if want != got:
                errors.append(
                    f"{code}: {key}: placeholders {sorted(got)} differ from {source} {sorted(want)}"
                )
        if missing:
            line = f"{code}: {len(missing)} untranslated key(s): " + ", ".join(missing)
            (errors if strict else warnings).append(line)
    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--locales", type=Path, default=REPO_ROOT / "locales")
    parser.add_argument("--strict", action="store_true", help="fail on missing translations too")
    args = parser.parse_args(argv)
    errors, warnings = check(args.locales, strict=args.strict)
    for line in warnings:
        print(f"warning: {line}")
    for line in errors:
        print(f"error: {line}", file=sys.stderr)
    if errors:
        return 1
    print(f"locales OK ({args.locales})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
