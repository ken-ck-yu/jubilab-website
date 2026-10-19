#!/usr/bin/env python3
"""LAUNCH STEP 1 as one idempotent command (docs/launch-checklist.md, step 1).

  python3 scripts/go-public.py                 dry run (default): print the diff, change nothing
  python3 scripts/go-public.py --apply         write the changes
  --with-legal   also make privacy/ and terms/ indexable, each one only if it has no "Draft" notice.
                 A page that still has its Draft notice is SKIPPED with a WARNING on stderr: it keeps noindex and
                 stays out of the sitemap, the other pages still go ahead (exit 0).
                 Privacy and terms are both published (no Draft notice), so --with-legal opens both.
  --allow-draft  with --with-legal: also open pages that still have their "Draft" notice (rehearsal only)
  --root DIR     operate on another copy of the site (default: the repo this script is in)

What it does:
  1. removes <meta name="robots" content="noindex"> (and the PREVIEW comment above it) from index.html,
     and from privacy/ and terms/ with --with-legal. thanks/ and 404.html always keep noindex.
  2. replaces robots.txt with robots.launch.txt (allows search crawlers and answer bots, blocks the training
     bots GPTBot, ClaudeBot, Google-Extended and CCBot: owner decision 2026-10-16).
  3. rewrites sitemap.xml to list exactly the indexable pages (home, the guides, plus privacy/terms once indexable),
     with lastmod from the last git commit touching each page (today's date when git is unavailable).
Running it twice changes nothing the second time. Standard library only.
"""
import argparse, datetime, difflib, glob, importlib.util, os, re, subprocess, sys
from urllib.robotparser import RobotFileParser

PAGES = {"index.html": "https://jubilab.io/",
         "guides/index.html": "https://jubilab.io/guides/",
         "guides/reference-genome-build-vcf-bam/index.html": "https://jubilab.io/guides/reference-genome-build-vcf-bam/",
         "guides/what-parameters-produced-this-result/index.html": "https://jubilab.io/guides/what-parameters-produced-this-result/",
         "guides/nextflow-provenance-and-lineage-compared/index.html": "https://jubilab.io/guides/nextflow-provenance-and-lineage-compared/",
         "privacy/index.html": "https://jubilab.io/privacy/", "terms/index.html": "https://jubilab.io/terms/"}
# Blog pages are not listed here: they are discovered from blog/*/index.html and written into the sitemap as the generated
# block of scripts/build-blog.py (<!-- blog:start --> ... <!-- blog:end -->), so go-public and the generator always agree.
LEGAL = ("privacy/index.html", "terms/index.html")
ALWAYS_NOINDEX = ("thanks/index.html", "404.html")
NOINDEX = re.compile(r'(?:[ \t]*<!--[^\n]*?noindex[^\n]*?-->[ \t]*\n)?[ \t]*<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"\s*/?>[ \t]*\n?', re.I)
PREVIEW_COMMENT = re.compile(r'[ \t]*<!-- PREVIEW: noindex on every page\.[^\n]*-->[ \t]*\n')
TRAINING_BOTS = ("GPTBot", "ClaudeBot", "Google-Extended", "CCBot")


def launch_robots_ok(text):
    """The launch file must allow ordinary crawlers on / and name the sitemap; blocking only named bots is fine."""
    rp = RobotFileParser()
    rp.parse(text.splitlines())
    return all(rp.can_fetch(b, "/") for b in ("*", "Googlebot", "Bingbot")) and bool(re.search(r"^Sitemap:\s*https://", text, re.M))


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


def blog_pages(root):
    return sorted(glob.glob(os.path.join(root, "blog", "index.html")) + glob.glob(os.path.join(root, "blog", "*", "index.html")))


def blog_sitemap_block(root):
    spec = importlib.util.spec_from_file_location("build_blog", os.path.join(root, "scripts", "build-blog.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.ROOT = root
    return mod.sitemap_block(mod.load_posts(False, mod.known_site_paths()))


def plan(root, with_legal, allow_draft):
    changes, notes, errors, warnings = {}, [], [], []
    indexable = []
    pages = dict(PAGES)
    for f in blog_pages(root):
        rel = os.path.relpath(f, root)
        pages[rel] = "https://jubilab.io/" + rel[: -len("index.html")]
    for rel in pages:
        text = read(root, rel)
        if rel in LEGAL and not with_legal:
            if NOINDEX.search(text):
                notes.append(f"{rel}: keeps noindex (use --with-legal after the owner approves the text)")
                continue
        if rel in LEGAL and with_legal and 'class="draft-note"' in text and not allow_draft:
            warnings.append(f"{rel} still has its Draft notice: NOT opened (keeps noindex, not in the sitemap). Finish and approve the text, remove the notice, then run again; --allow-draft is for rehearsals only")
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
    if not re.search(r"^User-agent:\s*\*", launch, re.M) or not launch_robots_ok(launch):
        errors.append("robots.launch.txt does not allow ordinary crawlers (*, Googlebot, Bingbot) or has no Sitemap line")
    old_robots = read(root, "robots.txt")
    if old_robots != launch:
        changes["robots.txt"] = (old_robots, launch)
    entries = "".join(f"  <url>\n    <loc>{pages[r]}</loc>\n    <lastmod>{lastmod(root, r)}</lastmod>\n  </url>\n" for r in indexable if not r.startswith("blog/"))
    if any(r.startswith("blog/") for r in indexable):
        block = blog_sitemap_block(root)
        entries = entries.replace('  <url>\n    <loc>https://jubilab.io/privacy/</loc>', block + '  <url>\n    <loc>https://jubilab.io/privacy/</loc>', 1) if "privacy/" in entries else entries + block
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + "</urlset>\n"
    old_sm = read(root, "sitemap.xml")
    if old_sm != sitemap:
        changes["sitemap.xml"] = (old_sm, sitemap)
    return changes, notes, errors, warnings


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="print the diff only (default)")
    g.add_argument("--apply", action="store_true", help="write the changes")
    ap.add_argument("--with-legal", action="store_true")
    ap.add_argument("--allow-draft", action="store_true")
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    a = ap.parse_args(argv)
    changes, notes, errors, warnings = plan(a.root, a.with_legal, a.allow_draft)
    for e in errors:
        print("ERROR:", e, file=sys.stderr)
    for w in warnings:
        print("WARNING:", w, file=sys.stderr)
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
