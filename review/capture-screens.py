#!/usr/bin/env python3
"""Recapture the two hero crops from the running Jubilab demo (Cohort A, synthetic data).

Usage: capture-screens.py <product-url> <out-dir>
The product is run separately, on a temp DB seeded with the repo's own `python -m server seed-demo`.
Crops are plain element/region screenshots at device scale 2. Nothing is recoloured or retouched.
Output (written to <out-dir>): hero-2x.png, hero-narrow-2x.png and the coordinates (percent) of the three pins.
"""
import json, os, sys
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], sys.argv[2]
exe = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
    # 1. Wide crop: card title + lineage graph, app window 900 px wide (card is about 674 px wide, so UI text stays 1:1).
    pg = b.new_page(viewport={"width": 900, "height": 1000}, device_scale_factor=2)
    pg.goto(url); pg.wait_for_selector("#ovGraph svg, #ovGraph .node, #ovGraph [data-id]", timeout=10000); pg.wait_for_timeout(600)
    pg.click("#ovGraph >> text=variants_run002.vcf"); pg.wait_for_timeout(300)
    r = pg.evaluate("""() => {
      const panel = document.querySelector('#ovGraph').closest('.panel').getBoundingClientRect();
      const g = document.querySelector('#ovGraph').getBoundingClientRect();
      const nodes = {};
      for (const t of ['Cohort_A.fastq.gz','Run 002','variants_run002.vcf']) {
        const el = [...document.querySelectorAll('#ovGraph *')].filter(e => e.children.length === 0 && e.textContent.includes(t))[0];
        const r = el.closest('button,[class*=node],[class*=nd],div').getBoundingClientRect(); nodes[t] = [r.left, r.top, r.width, r.height];
      }
      return {panel:[panel.left, panel.top, panel.width, panel.height], graph:[g.left,g.top,g.width,g.height], nodes};
    }""")
    x, y, w, h = r["panel"]; gx, gy, gw, gh = r["graph"]
    clip = {"x": x, "y": y, "width": w, "height": gy + gh + 18 - y}
    pg.screenshot(path=os.path.join(out, "hero-2x.png"), clip=clip)
    pins = {k: [round((v[0] - x) / clip["width"] * 100, 2), round((v[1] - y) / clip["height"] * 100, 2)] for k, v in r["nodes"].items()}
    print(json.dumps({"clip": clip, "pins_percent_left_top_of_node": pins}))
    pg.close()
    # 2. Narrow crop: the "Connected to" card of the output file, app window 340 px wide (card about 316 px).
    pg = b.new_page(viewport={"width": 340, "height": 900}, device_scale_factor=2)
    pg.goto(url); pg.wait_for_timeout(800)
    pg.click("#ovGraph >> text=variants_run002.vcf"); pg.wait_for_timeout(300)
    pg.click("text=Open asset and its lineage"); pg.wait_for_timeout(800)
    card = pg.locator(".panel", has_text="Connected to").last
    box = card.bounding_box(); print("narrow card", box)
    card.screenshot(path=os.path.join(out, "hero-narrow-2x.png"))
    b.close()
