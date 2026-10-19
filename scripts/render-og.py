#!/usr/bin/env python3
"""Make blog/_src/<slug>/og.png (1200x630) from image.svg with headless Chromium (Playwright). Social crawlers
(Facebook, LinkedIn, X and others) do not reliably accept SVG for og:image, so each post also ships a PNG.

  python3 scripts/render-og.py            render posts whose og.png is missing or older than image.svg
  python3 scripts/render-og.py --all      render every post again
  python3 scripts/render-og.py slug ...   only these posts

The 16:9 picture is scaled to the full 630 px height (1120 px wide) and centred on a canvas of the picture's own
background colour (the fill of its first <rect>), so nothing is cropped. Needs: pip install playwright and a Chromium
(set CHROMIUM=/path/to/chrome if it is not found). Not needed to build the site; scripts/build-blog.py stays standard-library only.
"""
import base64, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def chromium():
    if os.environ.get("CHROMIUM"):
        return os.environ["CHROMIUM"]
    c = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium*/*/chrome*")) + glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium*/chrome*")))
    return next((x for x in c if os.path.isfile(x) and os.access(x, os.X_OK) and os.path.basename(x) in ("chrome", "chrome-headless-shell")), None)


def main(argv):
    from playwright.sync_api import sync_playwright
    allp = "--all" in argv
    only = [a for a in argv if not a.startswith("--")]
    base = os.path.join(ROOT, "blog", "_src")
    todo = []
    for d in sorted(os.listdir(base)):
        svg, png = (os.path.join(base, d, f) for f in ("image.svg", "og.png"))
        if not os.path.isfile(svg) or (only and d not in only):
            continue
        if allp or only or not os.path.isfile(png) or os.path.getmtime(png) < os.path.getmtime(svg):
            todo.append((d, svg, png))
    if not todo:
        print("Nothing to render.")
        return 0
    with sync_playwright() as p:
        exe = chromium()
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        for d, svg, png in todo:
            raw = open(svg, "rb").read()
            m = re.search(rb'<rect[^>]*fill="(#[0-9a-fA-F]{3,6})"', raw)
            bg = m.group(1).decode() if m else "#f4f5f2"
            uri = "data:image/svg+xml;base64," + base64.b64encode(raw).decode()
            pg.set_content(f'<body style="margin:0;background:{bg};display:flex;justify-content:center"><img src="{uri}" style="height:630px;width:1120px;display:block"></body>')
            pg.wait_for_function("document.images[0].complete")
            pg.screenshot(path=png, clip={"x": 0, "y": 0, "width": 1200, "height": 630})
            print("wrote", os.path.relpath(png, ROOT))
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
