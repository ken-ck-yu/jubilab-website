#!/usr/bin/env python3
"""Read-only: loads <base>/?error=<code> with and without JavaScript and reports whether the error box is visible.
Usage: live-error-page.py [base]. Submits nothing."""
import sys
from playwright.sync_api import sync_playwright
base = (sys.argv[1] if len(sys.argv) > 1 else "https://jubilab.io").rstrip("/")
with sync_playwright() as p:
    b = p.chromium.launch()
    for js in (True, False):
        ctx = b.new_context(java_script_enabled=js); pg = ctx.new_page()
        for code in ("email", "role-other", "bogus"):
            pg.goto(f"{base}/?error={code}", wait_until="load"); pg.wait_for_timeout(300)
            print(f"js={js} code={code} visible={pg.locator('#form-error').is_visible()} text={pg.locator('#form-error').text_content()[:60]!r}")
    b.close()
