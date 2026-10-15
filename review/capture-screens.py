#!/usr/bin/env python3
"""Recapture the hero images from the running Jubilab demo (Cohort A, synthetic data), per docs/design-spec-v2.1.md section 4.

Usage: capture-screens.py <product-url> <out-dir>
The product is run separately, on a temp DB seeded with the repo's own `python -m server seed-demo`.
Writes <out-dir>/master.png (1280x720 window at device scale 2, lineage graph with the variants_run002.vcf detail
panel open, page scrolled so the Project lineage panel sits under the top bar) and <out-dir>/narrow.png (358x269
region of the 'Connected to' card of variants_run002.vcf at a 382 px window, scale 2). Nothing is recoloured or retouched.
Then export WebP (widths 720, 1120, 1440, 2240 for the master; 358, 716 for the narrow) with the byte budgets of spec section 4.
"""
import os, sys
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], sys.argv[2]
exe = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
    pg.goto(url); pg.wait_for_selector("#ovGraph svg, #ovGraph .node, #ovGraph [data-id]", timeout=10000); pg.wait_for_timeout(600)
    pg.click("#ovGraph >> text=variants_run002.vcf"); pg.wait_for_timeout(300)
    pg.evaluate("window.scrollTo(0, document.querySelector('#ovGraph').closest('.panel').getBoundingClientRect().top + scrollY - 88)")
    pg.mouse.move(1279, 719); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(out, "master.png")); pg.close()
    pg = b.new_page(viewport={"width": 382, "height": 900}, device_scale_factor=2)
    pg.goto(url); pg.wait_for_timeout(800)
    pg.click("#ovGraph >> text=variants_run002.vcf"); pg.wait_for_timeout(300)
    pg.click("text=Open asset and its lineage"); pg.wait_for_timeout(800)
    card = pg.locator(".panel", has_text="Connected to").last
    card.scroll_into_view_if_needed(); pg.mouse.move(0, 0); pg.wait_for_timeout(300)
    bb = card.bounding_box()
    pg.screenshot(path=os.path.join(out, "narrow.png"), full_page=True, clip={"x": bb["x"], "y": bb["y"] + pg.evaluate("scrollY"), "width": 358, "height": 269})
    b.close()

from PIL import Image
jobs = [("master.png", "hero-720", 720, 50), ("master.png", "hero-1120", 1120, 90), ("master.png", "hero-1440", 1440, 130), ("master.png", "hero-2240", 2240, 220),
        ("narrow.png", "hero-narrow-358", 358, 30), ("narrow.png", "hero-narrow-716", 716, 60)]
for src, name, w, cap in jobs:
    im = Image.open(os.path.join(out, src)).convert("RGB")
    r = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    for q in range(90, 40, -2):
        r.save(os.path.join(out, name + ".webp"), "WEBP", quality=q, method=6)
        if os.path.getsize(os.path.join(out, name + ".webp")) <= cap * 1000: break
    print(name, r.size, "q", q, os.path.getsize(os.path.join(out, name + ".webp")), "budget", cap * 1000)
