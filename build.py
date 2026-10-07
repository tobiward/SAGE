#!/usr/bin/env python3
"""Builds sage.html from the files in src/.

SAGE is developed as many small files but shipped as ONE file, so users can just download and open it.
This script stitches the pieces together:

    src/app.html          the page: markup, with {{FAVICON}}, {{CSS}} and {{JS}} placeholders
    src/css/*.css         styles, joined in filename order (01-, 02-, ...)
    src/js/*.js           scripts, joined in filename order
    src/assets/favicon.png  embedded as the page icon

Usage:
    python build.py           write sage.html
    python build.py --check   exit with an error if sage.html is out of date (used by the test workflow)

Needs only Python 3.8+; no packages.
"""
import base64
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "sage.html"


def read_parts(folder, pattern):
    files = sorted((SRC / folder).glob(pattern))
    if not files:
        sys.exit(f"build: no {pattern} files found in src/{folder}")
    return "".join(f.read_text(encoding="utf-8") for f in files)


def build():
    page = (SRC / "app.html").read_text(encoding="utf-8")
    for token in ("{{FAVICON}}", "{{CSS}}", "{{JS}}"):
        if page.count(token) != 1:
            sys.exit(f"build: src/app.html must contain {token} exactly once")
    icon = base64.b64encode((SRC / "assets" / "favicon.png").read_bytes()).decode("ascii")
    return (page.replace("{{FAVICON}}", "data:image/png;base64," + icon)
                .replace("{{CSS}}", read_parts("css", "*.css"))
                .replace("{{JS}}", read_parts("js", "*.js")))


def main():
    html = build()
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != html:
            sys.exit("build: sage.html is out of date. Run `python build.py` and commit the result.")
        print("build: sage.html is up to date")
        return
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"build: wrote {OUT.name} ({len(html.encode('utf-8')) // 1024} KB)")


if __name__ == "__main__":
    main()
