#!/usr/bin/env python3
"""LAUNCH STEP 1 as one idempotent command (docs/launch-checklist.md, step 1).

  python3 scripts/go-public.py                 dry run (default): print the diff, change nothing
  python3 scripts/go-public.py --apply         write the changes
  --with-legal   also make privacy/ and terms/ indexable (owner must have approved their text)
  --allow-draft  with --with-legal: proceed even though a page still has its "Draft" notice
  --root DIR     operate on another copy of the site (default: the repo this script is in)

What it does:
  1. removes <meta name="robots" content="noindex"> (and the PREVIEW comment above it) from index.html,
     and from privacy/ and terms/ with --with-legal. thanks/ and 404.html always keep noindex.
  2. replaces robots.txt with robots.launch.txt.
  3. rewrites sitemap.xml to list exactly the indexable pages (home, plus privacy/terms once indexable),
     with lastmod from the last git commit touching each page (today's date when git is unavailable).
Running it twice changes nothing the second time. Standard library only.
"""
import argparse, datetime, difflib, os, re, subprocess, sys

PAGES = {"index.html": "https://jubilab.io/", "privacy/index.html": "https://jubilab.io/privacy/", "terms/index.html": "https://jubilab.io/terms/"}
LEGAL = ("privacy/index.html", "terms/index.html")
ALWAYS_NOINDEX = ("thanks/index.html", "404.html")
NOINDEX = re.compile(r'(?:[ \t]*<!--[^\n]*?noindex[^\n]*?-->[ \t]*\n)?[ \t]*<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"\s*/?>[ \t]*\n?', re.I)
PREVIEW_COMMENT = re.compile(r'[ \t]*<!-- PREVIEW: noindex on every page\.[^\n]*-->[ \t]*\n')
ACTIVE_DISALLOW_ALL = re.compile(r'^\s*Disallow:\s*/\s*$', re.M)


def read(root, rel):
    with open(os.path.join(root, rel), encoding="utf-8") as f:
        return f.read()


def lastmod(root, rel):
    try:
        out = subprocess.run(["git", "-C", root, "log", "-1", "--format=%cs", "--", rel], capture_output=True, text=True, timeout=20).stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", out):
            return out
    except Exception:
        pass
    return datetime.date.today().isoformat()


def plan(root, with_legal, allow_draft):
    changes, notes, errors = {}, [], []
    indexable = []
    for rel in PAGES:
        text = read(root, rel)
        if rel in LEGAL and not with_legal:
            if NOINDEX.search(text):
                notes.append(f"{rel}: keeps noindex (use --with-legal after the owner approves the text)")
                continue
        if rel in LEGAL and with_legal and 'class="draft-note"' in text and not allow_draft:
            errors.append(f"{rel} still has its Draft notice; finish the text first or pass --allow-draft")
            continue
        new = PREVIEW_COMMENT.sub("", text)
        new = NOINDEX.sub("", new)
        if new != text:
            changes[rel] = (text, new)
        if re.search(r'name="robots"[^>]*noindex', new, re.I):
            errors.append(f"{rel}: a noindex tag is still present")
        else:
            indexable.append(rel)
    for rel in ALWAYS_NOINDEX:
        if not re.search(r'name="robots"[^>]*noindex', read(root, rel), re.I):
            errors.append(f"{rel} must keep noindex but has none")
    launch = read(root, "robots.launch.txt")
    if ACTIVE_DISALLOW_ALL.search(launch) or not re.search(r"^User-agent:\s*\*", launch, re.M) or not re.search(r"^Sitemap:\s*https://", launch, re.M):
        errors.append("robots.launch.txt is not a valid allow-all launch file with a Sitemap line")
    old_robots = read(root, "robots.txt")
    if old_robots != launch:
        changes["robots.txt"] = (old_robots, launch)
    entries = "".join(f"  <url>\n    <loc>{PAGES[r]}</loc>\n    <lastmod>{lastmod(root, r)}</lastmod>\n  </url>\n" for r in indexable)
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + "</urlset>\n"
    old_sm = read(root, "sitemap.xml")
    if old_sm != sitemap:
        changes["sitemap.xml"] = (old_sm, sitemap)
    return changes, notes, errors


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="print the diff only (default)")
    g.add_argument("--apply", action="store_true", help="write the changes")
    ap.add_argument("--with-legal", action="store_true")
    ap.add_argument("--allow-draft", action="store_true")
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    a = ap.parse_args(argv)
    changes, notes, errors = plan(a.root, a.with_legal, a.allow_draft)
    for e in errors:
        print("ERROR:", e, file=sys.stderr)
    if errors:
        return 2
    for rel, (old, new) in changes.items():
        sys.stdout.writelines(difflib.unified_diff(old.splitlines(True), new.splitlines(True), f"a/{rel}", f"b/{rel}"))
    for n in notes:
        print("note:", n)
    if not changes:
        print("Nothing to change: the site is already in the launch state.")
        return 0
    if a.apply:
        for rel, (_, new) in changes.items():
            with open(os.path.join(a.root, rel), "w", encoding="utf-8", newline="") as f:
                f.write(new)
        print(f"Applied: {len(changes)} file(s) changed ({', '.join(changes)}). Commit, push and deploy are separate owner steps.")
    else:
        print(f"Dry run: {len(changes)} file(s) would change. Re-run with --apply to write them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
