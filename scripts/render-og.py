#!/usr/bin/env python3
"""Render assets/og/jubilab-og.png (1200x630) from assets/og/og-source.html with headless Chromium (Playwright).
Social crawlers do not reliably accept SVG for og:image, so the page ships a PNG. Needs: pip install playwright and a
Chromium (set CHROMIUM=/path/to/chrome if it is not found). Not needed to build the site.

  python3 scripts/render-og.py
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def chromium():
    if os.environ.get("CHROMIUM"):
        return os.environ["CHROMIUM"]
    c = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium*/*/chrome*")) + glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium*/chrome*")))
    return next((x for x in c if os.path.isfile(x) and os.access(x, os.X_OK) and os.path.basename(x) in ("chrome", "chrome-headless-shell")), None)


def main():
    from playwright.sync_api import sync_playwright
    src = os.path.join(ROOT, "assets", "og", "og-source.html")
    out = os.path.join(ROOT, "assets", "og", "jubilab-og.png")
    with sync_playwright() as p:
        exe = chromium()
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        pg.goto("file://" + src)
        pg.wait_for_function("document.fonts.status === 'loaded'")
        pg.screenshot(path=out, clip={"x": 0, "y": 0, "width": 1200, "height": 630})
        b.close()
    print("wrote", os.path.relpath(out, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
