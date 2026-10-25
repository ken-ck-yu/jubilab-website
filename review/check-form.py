#!/usr/bin/env python3
"""Form behaviour against the dev worker (in-memory KV, fake email): break-it checks plus one real submission through the UI.

Usage:  node review/dev-worker-server.mjs 18300 > /tmp/dev.log &
        LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs <venv>/bin/python review/check-form.py http://127.0.0.1:18300 /tmp/dev.log
The log file is the dev worker's stdout: every stored record prints "PUT email:<address>", so the number of PUT lines proves
what was and was not stored. Use only on the dev worker, never on production (it creates records).
"""
import os, sys, time, urllib.parse, urllib.request, urllib.error
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/"); LOG = sys.argv[2]
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
out = []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None


def puts(): time.sleep(0.15); return sum(1 for l in open(LOG) if l.startswith("PUT "))


def post(fields):
    data = urllib.parse.urlencode(fields, doseq=True).encode()
    req = urllib.request.Request(BASE + "/api/early-access", data=data, headers={"Content-Type": "application/x-www-form-urlencoded", "Origin": BASE})
    try: r = urllib.request.build_opener(NoRedirect).open(req)
    except urllib.error.HTTPError as e: r = e
    return r.code, r.headers.get("location", "")


def check(name, ok, detail=""):
    out.append(ok); print(("PASS " if ok else "FAIL ") + name + (": " + detail if detail else ""))


GOOD = [("email", "qa-%d@example.org" % os.getpid()), ("role", "platform-ops"), ("org-type", "biotech"), ("providers", "A WGS provider"), ("volume", "30-150"), ("eln", "benchling")]
for drop, code in [("email", "email"), ("role", "role"), ("org-type", "org-type"), ("providers", "providers"), ("volume", "volume"), ("eln", "eln")]:
    n0 = puts(); s, loc = post([f for f in GOOD if f[0] != drop])
    check(f"empty {drop} -> 303 error={code}, nothing stored", s == 303 and f"error={code}" in loc and puts() == n0, f"{s} {loc}")
n0 = puts(); s, loc = post([f if f[0] != "role" else ("role", "other") for f in GOOD])
check("role Other without text -> error=role-other", s == 303 and "error=role-other" in loc and puts() == n0, loc)
n0 = puts(); s, loc = post([f if f[0] != "eln" else ("eln", "other") for f in GOOD] + [("eln-other", "   ")])
check("ELN Other with spaces only -> error=eln-other", s == 303 and "error=eln-other" in loc and puts() == n0, loc)
n0 = puts(); s, loc = post(GOOD + [("q7_note", "bot")])
check("honeypot filled -> 303 /thanks/ and nothing stored", s == 303 and loc.endswith("/thanks/") and puts() == n0, loc)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    # JS off: the server message is visible after an Other-without-text submission
    ctx = b.new_context(java_script_enabled=False); pg = ctx.new_page(); pg.goto(BASE + "/")
    pg.check("input[name=role][value=other]"); pg.check("input[name=org-type][value=core]"); pg.check("input[name=volume][value=unsure]"); pg.check("input[name=eln][value=none]")
    pg.fill("#email", "nojs-%d@example.org" % os.getpid()); pg.fill("#providers", "x")
    n0 = puts(); pg.click("button[type=submit]"); pg.wait_for_load_state()
    check("JS off, Other without text: lands on /?error=role-other with the visible message", "error=role-other" in pg.url and pg.locator("#form-error").is_visible() and puts() == n0, pg.url)
    ctx.close()
    # JS on: the browser blocks an empty submission before it reaches the server
    ctx = b.new_context(); pg = ctx.new_page(); pg.goto(BASE + "/"); n0 = puts()
    pg.click("button[type=submit]"); pg.wait_for_timeout(300)
    check("JS on, empty form: stays on the page (browser validation)", "/thanks/" not in pg.url and "error=" not in pg.url and puts() == n0, pg.url)
    pg.fill("#email", "ui-%d@example.org" % os.getpid()); pg.check("input[name=role][value=other]"); pg.check("input[name=org-type][value=pharma]"); pg.fill("#providers", "Novogene, Olink")
    pg.check('input[name=volume][value="151-500"]'); pg.check("input[name=eln][value=other]")
    pg.click("button[type=submit]"); pg.wait_for_timeout(300)
    check("JS on, Other chosen without text: blocked before sending", "/thanks/" not in pg.url and puts() == n0, pg.url)
    pg.fill("#role-other", "Sourcing lead"); pg.fill("#eln-other", "In-house"); pg.fill("#comment", "Status by email is the worst part.")
    pg.click("button[type=submit]"); pg.wait_for_url("**/thanks/"); 
    check("JS on, complete form: lands on /thanks/ and exactly one record is stored", puts() == n0 + 1, pg.url)
    ctx.close(); b.close()
sys.exit(0 if all(out) else 1)
