#!/usr/bin/env python3
"""Track English translations of the repository's Chinese documents.

Layout: translations/en/<original path> mirrors the original file (CLAUDE.md -> translations/en/CLAUDE.md).
translations/manifest.json records, for every translation, the git blob hash of the original it was made from.
When upstream changes the original, its blob hash changes and the translation is reported as stale.

  python3 translations/tools/translation_status.py              summary: up to date / stale / untranslated
  python3 translations/tools/translation_status.py --stale      list stale translations (one path per line)
  python3 translations/tools/translation_status.py --untranslated [--prefix docs/core]
                                                                list Chinese documents without a translation
  python3 translations/tools/translation_status.py --record PATH...
                                                                mark PATH's translation as made from the current original
  python3 translations/tools/translation_status.py --diff PATH  show what changed in the original since it was translated
  python3 translations/tools/translation_status.py --fix-links  rewrite links in translations that point to
                                                                untranslated files so they reach the original file
  python3 translations/tools/translation_status.py --check      exit 1 on broken links or translations without a manifest entry
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "translations"
EN = ROOT / "en"
MANIFEST = ROOT / "manifest.json"
CJK = re.compile("[一-鿿]")
DOC_SUFFIXES = {".md", ".txt"}
SKIP_PREFIXES = ("translations/", "frontend/web/dist/", "tests/fixtures/")
LINK = re.compile(r"(\[[^\]]*\]\()([^)\s]+)(\))")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=True).stdout


def blob(path: str) -> str | None:
    full = REPO / path
    return git("hash-object", str(full)).strip() if full.is_file() else None


def load() -> dict[str, dict[str, str]]:
    return json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}


def save(manifest: dict[str, dict[str, str]]) -> None:
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def chinese_documents(prefix: str = "") -> list[str]:
    out = []
    for path in git("ls-files", "-z").split("\0"):
        if not path or not path.startswith(prefix) or path.startswith(SKIP_PREFIXES):
            continue
        if Path(path).suffix not in DOC_SUFFIXES:
            continue
        try:
            if CJK.search((REPO / path).read_text(encoding="utf-8")):
                out.append(path)
        except (UnicodeDecodeError, FileNotFoundError):
            continue
    return sorted(out)


def stale(manifest: dict[str, dict[str, str]]) -> list[str]:
    return sorted(p for p, entry in manifest.items() if blob(p) != entry["source_blob"])


def iter_links(text: str):
    for match in LINK.finditer(text):
        target = match.group(2)
        if target.startswith(("#", "http://", "https://", "mailto:", "data:")):
            continue
        yield match


def resolve_link(translation: Path, target: str) -> tuple[Path, str]:
    path, _, anchor = target.partition("#")
    path = unquote(path.strip("<>"))
    return (translation.parent / path).resolve(), anchor


def fix_links() -> int:
    changed = 0
    for translation in sorted(EN.rglob("*.md")):
        text = translation.read_text(encoding="utf-8")

        def repl(match: re.Match[str]) -> str:
            target = match.group(2)
            resolved, anchor = resolve_link(translation, target)
            if resolved.exists() or not target.split("#", 1)[0]:
                return match.group(0)
            # The link was written for the original's location: resolve it there instead.
            original = (REPO / translation.relative_to(EN)).parent / unquote(target.split("#", 1)[0].strip("<>"))
            if not original.resolve().exists():
                return match.group(0)
            new = os.path.relpath(original.resolve(), translation.parent)
            return f"{match.group(1)}{new}{'#' + anchor if anchor else ''}{match.group(3)}"

        new_text = LINK.sub(repl, text)
        if new_text != text:
            translation.write_text(new_text, encoding="utf-8")
            changed += 1
    print(f"links rewritten in {changed} file(s)")
    return 0


def check(manifest: dict[str, dict[str, str]]) -> int:
    problems = []
    for translation in sorted(EN.rglob("*")):
        if not translation.is_file():
            continue
        rel = str(translation.relative_to(EN))
        if rel not in manifest:
            problems.append(f"{rel}: translation has no manifest entry (run --record {rel})")
        if translation.suffix == ".md":
            for match in iter_links(translation.read_text(encoding="utf-8")):
                if match.group(2).split("#", 1)[0] and not resolve_link(translation, match.group(2))[0].exists():
                    problems.append(f"{rel}: broken link {match.group(2)}")
    for rel in manifest:
        if not (EN / rel).is_file():
            problems.append(f"{rel}: in manifest but translations/en/{rel} is missing")
    for line in problems:
        print(f"error: {line}", file=sys.stderr)
    return 1 if problems else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--stale", action="store_true")
    parser.add_argument("--untranslated", action="store_true")
    parser.add_argument("--prefix", default="")
    parser.add_argument("--record", nargs="+", metavar="PATH")
    parser.add_argument("--diff", metavar="PATH")
    parser.add_argument("--fix-links", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    manifest = load()

    if args.record:
        today = dt.date.today().isoformat()
        for path in args.record:
            if not (EN / path).is_file():
                print(f"error: translations/en/{path} does not exist", file=sys.stderr)
                return 1
            manifest[path] = {"source_blob": blob(path) or "", "translated": today}
        save(manifest)
        return 0
    if args.diff:
        entry = manifest.get(args.diff)
        if not entry:
            print(f"error: {args.diff} has no translation", file=sys.stderr)
            return 1
        old = git("cat-file", "-p", entry["source_blob"])
        tmp = ROOT / ".old-source.tmp"
        tmp.write_text(old, encoding="utf-8")
        try:
            result = subprocess.run(["git", "diff", "--no-index", "--", str(tmp), str(REPO / args.diff)], cwd=REPO, capture_output=True, text=True)
            sys.stdout.write(result.stdout)
        finally:
            tmp.unlink()
        return 0
    if args.fix_links:
        return fix_links()
    if args.check:
        return check(manifest)
    if args.stale:
        print("\n".join(stale(manifest)))
        return 0
    untranslated = [p for p in chinese_documents(args.prefix) if p not in manifest]
    if args.untranslated:
        print("\n".join(untranslated))
        return 0
    old = stale(manifest)
    print(f"translated: {len(manifest)} (stale: {len(old)}), untranslated Chinese documents: {len(untranslated)}")
    for path in old:
        print(f"  stale: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
