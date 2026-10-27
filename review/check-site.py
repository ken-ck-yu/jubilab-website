#!/usr/bin/env python3
"""Acceptance checks for the Jubilab website (order-to-result pivot, 2026-10-25).

Usage:  check-site.py [base-url]     (default http://127.0.0.1:18300/)
Serve the repo first, e.g.  node review/dev-worker-server.mjs 18300   (or python3 -m http.server, run from the repo root).
Needs: python3 with playwright (not in the system python: use a venv), the headless Chromium shell from ~/.cache/ms-playwright,
and LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs.

It measures element rectangles (body has overflow-x: clip, so scrollWidth alone proves nothing). It never submits the form
(review/check-form.py does that against the dev worker). Prints one line per check with PASS or FAIL and the numbers;
exit code 1 if any check fails.
"""
import os, re, sys
from playwright.sync_api import sync_playwright

_args = [a for a in sys.argv[1:] if not a.startswith("-")]
BASE = (_args[0] if _args else "http://127.0.0.1:18300/").rstrip("/") + "/"
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440, 1920]
THEMES = ["light", "dark"]  # the home page is light only; blog, guide and legal pages keep both
NAV = [("How it works", "#how"), ("For teams", "#teams"), ("For labs", "#labs"), ("AI & developers", "#developers")]
SECTIONS = ["teams", "how", "labs", "developers", "access"]
FORBIDDEN = ["revolutionis", "revolutioniz", "unlock", "empower", "stripe for", "sample-to-result", "outsourced lab work",
             "with automation and scale", "provenance", "lineage", "nextflow", "snakemake", "testimonial", "trusted by", "guarantee", "stripe", "illustrative", "not a real order", "product concept", "in development", "being built", "nothing is released", "not yet released", "prototype"]
R = []


def rec(n, ok, detail):
    R.append((n, bool(ok), detail))


MEASURE = r"""
() => {
  const iw = innerWidth, out = {};
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const isHp = e => !!e.closest('.hp');
  const px = e => parseFloat(getComputedStyle(e).fontSize);
  out.iw = iw; out.sw = document.documentElement.scrollWidth; out.height = document.documentElement.scrollHeight;
  const bad = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('pre') || isHp(e) || !vis(e)) continue;
    const b = e.getBoundingClientRect();
    if (b.right > iw + 1 || b.left < -1) bad.push(e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
  }
  out.overflow = bad.slice(0, 4); out.overflowN = bad.length;
  const pres = [...document.querySelectorAll('main pre')];
  out.pre = {n: pres.length, ok: pres.every(p => p.tabIndex === 0 && p.getAttribute('aria-label')), fit: pres.every(p => p.getBoundingClientRect().right <= iw + 1)};
  const q = s => document.querySelector(s);
  out.h1 = {n: document.querySelectorAll('h1').length, text: q('h1').textContent.trim(), bottom: q('h1').getBoundingClientRect().bottom + scrollY, px: px(q('h1'))};
  out.sub = q('.hero-sub').textContent.trim(); out.lead = q('.hero-lead').textContent.trim(); out.cta = q('.hero .button').getBoundingClientRect().bottom + scrollY;
  const hs = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]); let skip = false; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skip = true; out.skip = skip;
  out.secIds = [...document.querySelectorAll('main section[id]')].map(s => s.id);
  out.h2Outside = document.querySelectorAll('footer h2, header h2').length;
  out.sub_nav = [...document.querySelectorAll('.navlinks a')].filter(vis).map(a => [a.textContent.trim(), a.getAttribute('href'), !!document.querySelector(a.getAttribute('href'))]);
  out.themeToggle = !!document.getElementById('theme-toggle');
  const svgs = [...document.querySelectorAll('.flow-panel svg.dg')].filter(vis);
  out.flow = svgs.map(s => { const sb = s.getBoundingClientRect(), vb = s.viewBox.baseVal, sc = sb.width / vb.width; let min = 999; for (const t of s.querySelectorAll('text')) min = Math.min(min, px(t) * sc); return {cls: s.getAttribute('class'), w: Math.round(sb.width), minFont: Math.round(min * 10) / 10, role: s.getAttribute('role'), title: !!s.querySelector('title'), desc: s.querySelector('desc') ? s.querySelector('desc').textContent.length : 0, lanes: /DRY LAB/.test(s.textContent) && /WET LAB/.test(s.textContent)}; });
  out.journey = [...document.querySelectorAll('.hero .dash-t b')].map(l => l.textContent);
  out.twinClosed = true;
  const small = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('svg') || !vis(e) || isHp(e)) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const f = px(e); if (f < 12) small.push(e.tagName + '.' + e.className + ' ' + f);
  }
  out.small = small.slice(0, 5);
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const over = (f, b) => ({r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1});
  const bgOf = e => { const st = []; for (let x = e; x; x = x.parentElement) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let bg = {r: 255, g: 255, b: 255, a: 1}; for (let i = st.length - 1; i >= 0; i--) bg = over(st[i], bg); return bg; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  let minC = 99, where = '', fails = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (!vis(e) || isHp(e)) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e), isSvg = !!e.closest('svg');
    const fg = parse(isSvg ? s.fill : s.color); if (!fg) continue; const bg = bgOf(e); const f = over(fg, bg);
    const size = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700; const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5; const c = cr(f, bg);
    if (c < minC) { minC = c; where = e.tagName + '.' + (e.className.baseVal === undefined ? e.className : e.getAttribute('class')); }
    if (c < need) fails.push(e.tagName + '.' + (e.className.baseVal === undefined ? e.className : '') + ' ' + c.toFixed(2) + '<' + need);
  }
  out.minC = minC; out.minWhere = where; out.failC = fails.slice(0, 5);
  const ui = [];
  for (const e of document.querySelectorAll('.form-card input:not([type=hidden]),.form-card textarea,.form-card select,.button.secondary')) { if (!vis(e) || isHp(e)) continue; const s = getComputedStyle(e); const b = parse(s.borderTopColor); const bg = bgOf(e.parentElement); ui.push([e.className || e.tagName, cr(over(b, bg), bg)]); }
  out.uiMin = ui.reduce((a, b) => b[1] < a[1] ? b : a, ['', 99]);
  const tg = [];
  for (const e of document.querySelectorAll('.button,.form-card input,.form-card textarea,.form-card select')) { if (!vis(e) || isHp(e)) continue; const b = e.getBoundingClientRect(); if (b.height < 43.5 || (e.tagName !== 'A' && b.width < 43.5)) tg.push(e.tagName + '.' + e.className + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); }
  out.targetsBad = tg;
  const form = q('#early-access-form'), ctrls = [...form.querySelectorAll('input,textarea,select')];
  out.formFirst = ctrls[0].id; out.req = [...new Set(ctrls.filter(c => c.required).map(c => c.name))].sort();
  out.names = [...new Set(ctrls.filter(c => !isHp(c)).map(c => c.name))].sort();
  out.unlabeled = ctrls.filter(c => !isHp(c) && !(c.labels && c.labels.length)).map(c => c.name);
  out.groups = [['selects', [...form.querySelectorAll('select')].length === 4]];
  const hp = form.querySelector('.hp input'), hb = hp.getBoundingClientRect();
  out.hp = {name: hp.name, tab: hp.tabIndex, ac: hp.getAttribute('autocomplete'), visible: hb.right > 0 && hb.left < iw};
  const vals = n => [...form.querySelectorAll('select[name=' + n + '] option')].map(c => c.value).filter(Boolean);
  out.vals = {role: vals('role'), org: vals('org-type'), vol: vals('volume'), eln: vals('eln')};
  out.other = [...form.querySelectorAll('.other input')].map(c => [c.name, c.maxLength]);
  out.commentOptional = !q('#comment').required && q('#comment').maxLength === 300; out.providers = [q('#providers').required, q('#providers').maxLength];
  const ft = q('footer'); out.footer = {mailto: !!ft.querySelector('a[href^="mailto:"]'), privacy: !!ft.querySelector('a[href$="privacy/"]'), terms: !!ft.querySelector('a[href$="terms/"]'), retired: !!ft.querySelector('a[href$="blog/"]') && !!ft.querySelector('a[href$="guides/"]')};
  out.ctas = [...document.querySelectorAll('header .button, .hero .button:not(.secondary), form button[type=submit]')].map(a => a.textContent.replace(/\s+/g, ' ').trim());
  out.text = document.body.innerText; out.words = q('main').innerText.trim().split(/\s+/).length;
  return out;
}
"""
PRESET = "try{localStorage.getItem('jubilab-consent')||localStorage.setItem('jubilab-consent',JSON.stringify({v:'denied',t:Date.now()}))}catch(e){}"


def mk(b, **kw):
    ctx = b.new_context(**kw)
    ctx.add_init_script(PRESET)
    return ctx


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
        for w in WIDTHS:
            for th in ["light"]:
                ctx = mk(b, viewport={"width": w, "height": 900})
                ext = []
                pg = ctx.new_page()
                pg.on("request", lambda r: ext.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith("data:") else None)
                pg.goto(BASE); pg.wait_for_timeout(400)
                pg.wait_for_function("document.fonts.status === 'loaded'")
                m = pg.evaluate(MEASURE); t = f"{w}/{th}"
                rec(1, abs(m["sw"] - m["iw"]) <= 1 and m["overflowN"] == 0, f"{t} scrollWidth {m['sw']}/{m['iw']}, {m['overflowN']} elements outside viewport {m['overflow'][:2]}")
                rec(2, m["pre"]["n"] == 0, f"{t} code blocks {m['pre']}")
                rec(3, m["h1"]["n"] == 1 and m["h1"]["text"] == "Streamline biological sample to data with AI enablement." and m["lead"] == "So scientists and AI agents can order, track and read results across dry labs, wet labs and logistics." and m["sub"].startswith("For biotech teams, research groups and the labs that run their samples") and not m["themeToggle"] and not m["skip"] and not m["h2Outside"], f"{t} h1 {m['h1']['n']} skip {m['skip']}")
                rec(4, m["secIds"] == SECTIONS, f"{t} sections {m['secIds']}")
                rec(5, [x[:2] for x in m["sub_nav"]] == [list(n) for n in NAV] and all(x[2] for x in m["sub_nav"]), f"{t} nav {m['sub_nav']}")
                rec(6, len(m["flow"]) == 2 and all(f["role"] == "img" and f["title"] and f["desc"] > 200 and f["minFont"] >= 11.9 and f["w"] <= m["iw"] and f["lanes"] and f["cls"] == ("dg dg-wide" if w >= 1000 else "dg dg-tall") for f in m["flow"]) and m["journey"] == ["ORD-1042", "ORD-1041", "ORD-1039", "ORD-1037"], f"{t} diagrams {m['flow']} hero dashboard orders {m['journey']}")
                rec(7, not m["small"], f"{t} text under 12px: {m['small']}")
                rec(8, not m["failC"] and m["uiMin"][1] >= 3, f"{t} min text contrast {m['minC']:.2f} ({m['minWhere']}); fails {m['failC']}; weakest UI {m['uiMin'][0]} {m['uiMin'][1]:.2f}")
                if w in (360, 390):
                    rec(9, not m["targetsBad"], f"{t} small targets {m['targetsBad'][:4]}")
                rec(10, m["formFirst"] == "email" and m["req"] == ["eln", "email", "org-type", "providers", "role", "volume"] and m["names"] == ["comment", "eln", "eln-other", "email", "org-type", "providers", "role", "role-other", "volume"] and not m["unlabeled"] and all(g[1] for g in m["groups"]), f"{t} form req {m['req']} unlabeled {m['unlabeled']} groups {m['groups']}")
                rec(11, m["hp"]["name"] == "q7_note" and m["hp"]["tab"] == -1 and m["hp"]["ac"] == "off" and not m["hp"]["visible"], f"{t} honeypot {m['hp']}")
                rec(12, m["vals"]["org"] == ["biotech", "pharma", "academic", "provider", "core"] and m["vals"]["eln"] == ["benchling", "labguru", "scispot", "other", "none"] and m["vals"]["vol"] == ["lt-30", "30-150", "151-500", "gt-500", "unsure"] and m["vals"]["role"][-1] == "other" and m["other"] == [["role-other", 100], ["eln-other", 100]] and m["commentOptional"] and m["providers"] == [True, 200], f"{t} options {m['vals']} other {m['other']}")
                f = m["footer"]
                rec(13, f["mailto"] and f["privacy"] and f["terms"] and f["retired"], f"{t} footer {f}")
                rec(14, m["ctas"] == ["Request early access ↗", "Request early access →", "Request early access →"], f"{t} CTAs {m['ctas']}")
                low = m["text"].lower()
                bad = [s for s in FORBIDDEN if s in low]
                rec(15, not bad, f"{t} forbidden strings {bad}")
                rec(16, not ext, f"{t} requests outside the site before consent: {ext}")
                if w == 1440 and th == "light":
                    rec(17, m["h1"]["bottom"] <= 900 and m["cta"] <= 900 and 36 <= m["h1"]["px"] <= 70, f"{t} h1 bottom {m['h1']['bottom']:.0f}, CTA {m['cta']:.0f}, h1 {m['h1']['px']:.0f}px")
                    rec(18, m["words"] <= 2300, f"{t} {m['words']} words in main, page height {m['height']}")
                ctx.close()
        for th in ["light"]:
            ctx = mk(b, viewport={"width": 1280, "height": 900}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
            seq = []
            for _ in range(7):
                pg.keyboard.press("Tab")
                seq.append(pg.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return [e.className||e.tagName,e.textContent.trim().slice(0,18),parseFloat(s.outlineWidth),s.outlineStyle]})()"))
            rec(19, "skip" in seq[0][0] and all(x[2] >= 2 and x[3] != "none" for x in seq), f"1280/{th} focus order {[x[1] or x[0] for x in seq]}")
            ctx.close()
        # blog and guide pages: no overflow, new nav and footer, no old chrome, no external requests
        PAGES = ["blog/", "blog/what-is-data-provenance-in-bioinformatics/", "blog/local-first-for-lab-data/", "guides/", "guides/reference-genome-build-vcf-bam/", "guides/nextflow-provenance-and-lineage-compared/"]
        for path in PAGES:
            for w in (320, 390, 768, 1440):
                for th in THEMES:
                    ctx = mk(b, viewport={"width": w, "height": 900}); pg = ctx.new_page(); pg.goto(BASE + path); pg.wait_for_timeout(250)
                    if th == "dark": pg.evaluate("localStorage.setItem('jubilab-theme','dark')"); pg.reload(); pg.wait_for_timeout(200)
                    r = pg.evaluate("""() => { const iw = innerWidth; const bad = [...document.body.querySelectorAll('*')].filter(e => { if (e.closest('pre,.table-scroll')) return false; const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && s.position !== 'fixed' && (b.right > iw + 1 || b.left < -1); }).map(e => e.tagName + '.' + e.className).slice(0, 3);
                      const links = [...document.querySelectorAll('.site-nav .menu a')].map(a => a.textContent.trim());
                      const foot = [...document.querySelectorAll('footer a')].map(a => a.textContent.trim());
                      return {sw: document.documentElement.scrollWidth, iw, bad, links, foot, old: /Be among the first labs|synthetic demo data|How Jubilab helps/.test(document.body.innerText)}; }""")
                    ok = r["sw"] <= r["iw"] + 1 and not r["bad"] and r["links"] == ["How it works", "For teams", "For labs", "AI & developers", "Blog"] and {"Guides", "Blog", "Privacy", "Terms"} <= set(r["foot"]) and not r["old"]
                    rec(26, ok, f"{path} {w}/{th} {r}")
                    ctx.close()
        ctx = mk(b, viewport={"width": 390, "height": 800}, java_script_enabled=False); pg = ctx.new_page(); pg.goto(BASE + "blog/")
        pg.focus(".menu summary"); pg.keyboard.press("Enter")
        rec(20, pg.evaluate("document.querySelector('.menu').open"), "390 JS off (blog page): Enter on the menu summary opens it")
        pg.goto(BASE)
        tv = pg.evaluate("(()=>{return [!document.getElementById('theme-toggle'), !!document.querySelector('#early-access-form'), getComputedStyle(document.body).backgroundColor]})()")
        rec(21, tv[0] and tv[1] and tv[2] == "rgb(255, 255, 255)", f"JS off: no theme toggle {tv[0]}, form {tv[1]}, bg {tv[2]}")
        vis_off = pg.evaluate("[...document.querySelectorAll('#early-access-form .other')].map(e => e.getBoundingClientRect().height > 0)")
        rec(22, vis_off == [True, True], f"JS off: the two 'If other' boxes are visible {vis_off}")
        ctx.close()
        ctx = mk(b, viewport={"width": 390, "height": 800}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
        st = lambda: pg.evaluate("[...document.querySelectorAll('#early-access-form .other')].map(e => [e.getBoundingClientRect().height > 0, e.querySelector('input').required])")
        s0 = st(); pg.select_option('#role', 'other'); pg.select_option('#eln', 'other'); s1 = st()
        pg.select_option('#role', 'scientist'); s2 = st()
        rec(23, s0 == [[False, False]] * 2 and s1 == [[True, True]] * 2 and s2 == [[False, False], [True, True]], f"JS on: other boxes {s0} -> {s1} -> {s2}")
        ctx.close()
        ctx = b.new_context(viewport={"width": 390, "height": 800}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
        rec(24, pg.locator(".cookie-notice").count() == 1, "first visit shows the cookie notice")
        ctx.close()
        ctx = mk(b, viewport={"width": 390, "height": 800}); pg = ctx.new_page(); pg.goto(BASE + "?error=providers"); pg.wait_for_timeout(300)
        rec(25, pg.locator("#form-error").is_visible() and "providers" in pg.inner_text("#form-error"), "?error=providers shows its message")
        ctx.close()
        b.close()
    ok = True
    by = {}
    for n, k, d in R:
        by.setdefault(n, []).append((k, d))
    for n in sorted(by):
        if n in (8, 6) and "-v" in sys.argv: print("   ", [d for k, d in by[n]][:16])
        bad = [d for k, d in by[n] if not k]
        ok = ok and not bad
        print(f"{'PASS' if not bad else 'FAIL'} check {n} ({len(by[n])} runs)" + ("" if not bad else ": " + bad[0]))
        for d in bad[1:4]:
            print("     also:", d)
    print("\ncheck-site:", "ALL PASS" if ok else "FAILURES")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(run())
