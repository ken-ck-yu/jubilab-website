#!/usr/bin/env python3
"""QA-1 live early-access form probe (item: live-form). Runs REAL Chromium against a live site and records the
network exchange of each submission. Every scenario submits ONE record (test addresses claude-qa-N@example.org only).
Usage: live-form-qa.py <scenario> [base]   scenarios: inspect | typed | other | dup | honeypot | noreferrer
Run with: LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/live-form-qa.py typed
Prints JSON. Do not loop this against the live site."""
import json, sys
from playwright.sync_api import sync_playwright

scn = sys.argv[1]; BASE = (sys.argv[2] if len(sys.argv) > 2 else "https://jubilab.io").rstrip("/")
EMAIL = {"typed": "claude-qa-1@example.org", "other": "claude-qa-2@example.org", "dup": "claude-qa-1@example.org",
         "honeypot": "claude-qa-3@example.org", "noreferrer": "claude-qa-6@example.org"}.get(scn)
log = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 900}); pg = ctx.new_page()
    pg.on("request", lambda r: log.append({"req": r.method + " " + r.url, "headers": r.headers, "body": r.post_data}) if r.method == "POST" or "/thanks" in r.url or "error=" in r.url else None)
    pg.on("response", lambda r: log.append({"resp": r.status, "url": r.url, "location": r.headers.get("location"), "ctype": r.headers.get("content-type")}) if "api/early-access" in r.url or "/thanks" in r.url or "error=" in r.url else None)
    pg.goto(BASE + "/", wait_until="networkidle")
    if scn == "inspect":
        hp = pg.eval_on_selector('input[name=website]', """e => { const s=getComputedStyle(e.closest('.hp')), r=e.getBoundingClientRect(); return {outer:e.closest('.hp').outerHTML, display:s.display, visibility:s.visibility, position:s.position, left:s.left, rect:[r.left,r.top,r.width,r.height], type:e.type, autocomplete:e.autocomplete, tabindex:e.tabIndex, inForm: e.form && e.form.id, labelText: e.labels[0].textContent.trim(), ariaHiddenAncestor: !!e.closest('[aria-hidden=true]')}}""")
        print(json.dumps({"honeypot": hp, "enctype": pg.eval_on_selector('#early-access-form', 'f=>f.enctype'), "action": pg.eval_on_selector('#early-access-form', 'f=>f.action'),
          "fields": pg.eval_on_selector_all('#early-access-form [name]', 'es=>es.map(e=>[e.name,e.type,e.autocomplete,e.required])'),
          "otherBoxesHiddenOnLoad": pg.eval_on_selector_all('.other[data-other-for]', 'es=>es.map(e=>e.hidden)'),
          "meta_referrer": pg.eval_on_selector_all('meta[name=referrer]', 'es=>es.length')}, indent=1)); b.close(); sys.exit()
    pg.locator("#email").click(); pg.keyboard.type(EMAIL, delay=20)
    if scn == "other":
        pg.get_by_label("Other (specify)").nth(0).check()  # role other
        pg.fill("#role-other", "Clinical trial statistician (QA test)")
        pg.locator('input[name=field][value=other]').check(); pg.fill("#field-other", "Ecology (QA test)")
        pg.locator('input[name=runs-on][value=other]').check(); pg.fill("#runs-on-other", "Own workstation under desk (QA test)")
        pg.locator('input[name=human-data][value=yes]').check()
        pg.fill("#tracking", "Spreadsheet and memory. QA test, please ignore.")
    else:
        pg.locator('input[name=role][value=postdoc-scientist]').click()
        pg.locator('input[name=field][value=genetics-genomics]').click()
        for v in ("windows", "linux", "hpc-cluster"): pg.locator(f'input[name=runs-on][value={v}]').click()
        pg.locator('input[name=human-data][value=no]').click()
        pg.fill("#tracking", "Notebooks and file names. QA test, please ignore.")
    if scn == "honeypot": pg.eval_on_selector('input[name=website]', "e=>{e.value='https://example.org'; e.dispatchEvent(new Event('input',{bubbles:true}))}")
    if scn == "noreferrer": pg.evaluate("()=>{const m=document.createElement('meta');m.name='referrer';m.content='no-referrer';document.head.appendChild(m)}")
    shown = pg.eval_on_selector_all('.other[data-other-for]', 'es=>es.map(e=>e.hidden)')
    form_data = pg.eval_on_selector('#early-access-form', "f=>[...new FormData(f).entries()]")
    with pg.expect_navigation(wait_until="load"):
        pg.get_by_role("button", name="Request early access").click()
    pg.wait_for_timeout(500)
    print(json.dumps({"scenario": scn, "email": EMAIL, "otherBoxesHiddenBeforeSubmit": shown, "formDataEntries": form_data, "network": log,
                      "finalUrl": pg.url, "title": pg.title(), "text": pg.locator("body").inner_text()[:400]}, indent=1))
    b.close()
