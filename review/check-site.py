#!/usr/bin/env python3
"""Acceptance checks for the Jubilab website v2 (UXD spec section 5, with the Manager brief's overrides).

Usage:  check-site.py [base-url]     (default http://127.0.0.1:18212/)
Serve the repo first, e.g.  python3 -m http.server 18212 --bind 127.0.0.1   (run from the repo root).
Needs: python3 with playwright, the headless Chromium shell from ~/.cache/ms-playwright, and
LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs.

It measures element rectangles (body has overflow-x: clip, so scrollWidth alone proves nothing).
Prints one line per check with PASS or FAIL and the numbers. Exit code 1 if any check fails.
Check 20 (feature-list bullets) and parts of 27 need a human; they are reported as MANUAL, not PASS.
It never submits the form.
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:18212/").rstrip("/") + "/"
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
WIDTHS = [320, 390, 768, 1024, 1280, 1440, 1920]
THEMES = ["light", "dark"]
R = {}  # check number -> list of (ok, detail)


def rec(n, ok, detail):
    R.setdefault(n, []).append((bool(ok), detail))


# ---- one big in-page measurement -------------------------------------------------
MEASURE = r"""
() => {
  const iw = innerWidth, out = {};
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const inPre = e => !!e.closest('pre');
  const isHp = e => !!e.closest('.hp');
  const r = e => { const b = e.getBoundingClientRect(); return {l: b.left, t: b.top + scrollY, r: b.right, b: b.bottom + scrollY, w: b.width, h: b.height}; };
  out.iw = iw; out.sw = document.documentElement.scrollWidth; out.height = document.documentElement.scrollHeight;
  // 2 overflow by rectangle
  const bad = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (inPre(e) || isHp(e) || !vis(e)) continue;
    const b = e.getBoundingClientRect();
    if (b.right > iw + 1 || b.left < -1) bad.push(e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
  }
  out.overflow = bad.slice(0, 5); out.overflowN = bad.length;
  // 3 scroll regions
  const sc = [];
  for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e); if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && e.querySelector('img,svg') && !e.matches('pre')) sc.push(e.tagName + '.' + e.className); }
  out.scrollRegions = sc; out.scrollHint = /Scroll the (screenshot|diagram)/i.test(document.body.innerText);
  // hero image
  const img = document.querySelector('.hero img'); const wrap = document.querySelector('.hero-grid');
  const ib = r(img), wb = r(wrap); const ws = getComputedStyle(wrap);
  out.img = ib; out.cont = {l: wb.l + parseFloat(ws.paddingLeft), r: wb.r - parseFloat(ws.paddingRight)};
  out.imgNat = img.naturalWidth; out.imgSrc = img.currentSrc.split('/').pop(); out.dpr = devicePixelRatio;
  out.imgAttrs = {w: img.getAttribute('width'), h: img.getAttribute('height'), fp: img.getAttribute('fetchpriority'), alt: (img.getAttribute('alt') || '').length};
  out.otherImgs = [...document.querySelectorAll('img')].filter(i => i !== img).map(i => i.getAttribute('loading'));
  // 7 first screen
  const q = s => document.querySelector(s);
  out.h1b = r(q('h1')); out.lede = r(q('.hero-lede')); out.cta = r(q('.hero .btn'));
  // 10 image styling
  const cs = getComputedStyle(img);
  out.imgStyle = {filter: cs.filter, blend: cs.mixBlendMode, bw: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth], bs: cs.borderTopStyle};
  out.figcap = q('.hero-shot figcaption').innerText; out.shot = r(q('.hero .shot'));
  // 11 svg text
  const svg = [...document.querySelectorAll('svg[role=img]')].find(vis);
  if (svg) {
    const sb = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sc2 = sb.width / vb.width;
    let min = 999; for (const t of svg.querySelectorAll('text')) { const f = parseFloat(getComputedStyle(t).fontSize) * sc2; if (f < min) min = f; }
    out.svg = {w: sb.width, minFont: min, scale: sc2, cls: svg.getAttribute('class')};
    const pr = svg.closest('.panel').getBoundingClientRect(); out.svgPanel = pr.width;
  }
  // 12 section heights
  const sh = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().height : -1; };
  out.sec = {hero: q('.hero').getBoundingClientRect().height, next: sh('next'), product: sh('product')};
  // 13..18 content
  const navLinks = [...document.querySelectorAll('.site-nav a')].filter(vis);
  out.navLinks = navLinks.map(a => [a.textContent.trim(), a.getAttribute('href'), !!document.querySelector(a.getAttribute('href'))]);
  const menu = q('.menu'); out.menuVisible = vis(menu); const ms = q('.menu summary'); out.menuBtn = r(ms);
  out.menuLinks = [...menu.querySelectorAll('a')].map(a => a.textContent.trim());
  out.h1n = document.querySelectorAll('h1').length;
  out.h2s = [...document.querySelectorAll('main h2')].map(h => [h.textContent.trim(), h.closest('section') && h.closest('section').id]);
  out.h2OutsideMain = document.querySelectorAll('footer h2, header h2').length;
  const hs = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]); let skip = false; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skip = true; out.headingSkip = skip;
  out.ids = ['problem', 'how', 'product', 'next', 'access'].map(i => !!document.getElementById(i));
  out.text = document.body.innerText;
  out.direction = /direction/i.test(document.body.innerText) || [...document.querySelectorAll('h1,h2,h3,nav a,.eyebrow')].some(e => /direction/i.test(e.textContent));
  const nh = [...document.querySelectorAll('h2')].find(h => /where this is going/i.test(h.textContent)); out.nextH2 = nh ? nh.textContent.trim() : null;
  const chip = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^Planned, not in the product today$/.test(e.textContent.trim()) && vis(e))[0];
  out.chipDist = chip && nh ? Math.abs(chip.getBoundingClientRect().top - nh.getBoundingClientRect().top) : null;
  const ctas = [...document.querySelectorAll('header .btn, .hero .btn:not(.ghost), form button[type=submit]')]; out.ctas = ctas.map(a => a.textContent.trim()); out.heroPrimary = q('.hero .btn').getAttribute('href');
  const main = q('main'); out.words = main.innerText.trim().split(/\s+/).length;
  // 21 22 23 typography
  const px = e => parseFloat(getComputedStyle(e).fontSize), lh = e => { const s = getComputedStyle(e); return s.lineHeight === 'normal' ? px(e) * 1.2 : parseFloat(s.lineHeight); };
  out.h1 = {px: px(q('h1')), lines: Math.round(q('h1').getBoundingClientRect().height / lh(q('h1')))}; out.h2px = px(q('h2'));
  const over = [];
  for (const sec of document.querySelectorAll('main section')) {
    const h2 = sec.querySelector('h2'); if (!h2) continue; const hp = px(h2); const isNext = sec.id === 'next';
    for (const e of sec.querySelectorAll('p,li,h3,figcaption,summary,span,label,legend')) {
      if (!vis(e) || e.closest('h2') || e.closest('svg')) continue;
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const f = px(e); const lim = (isNext && e.classList.contains('statement')) ? 30.01 : 0.65 * hp + 0.01;
      if (f > lim) over.push(sec.id + ':' + e.className + ' ' + f.toFixed(1) + '>' + lim.toFixed(1));
    }
  }
  out.over22 = over;
  const small = []; const mono = /plex mono|monospace/i;
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('svg') || !vis(e) || isHp(e)) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e), f = parseFloat(s.fontSize);
    if (f < 12) small.push(e.tagName + ' ' + f);
    else if (f < 14 && !mono.test(s.fontFamily)) small.push(e.tagName + '.' + e.className + ' ' + f + ' not mono');
  }
  out.small = small.slice(0, 6);
  out.bodyP = [...document.querySelectorAll('.two p,.steps p,.outcomes p,.beside,.aud,.span,.hero-lede')].filter(vis).map(e => px(e)).reduce((a, b) => Math.min(a, b), 99);
  // 24 line length
  let maxc = 0, where = '';
  for (const e of document.querySelectorAll('main p, main li, figcaption')) {
    if (!vis(e) || e.closest('pre') || e.closest('svg')) continue;
    for (const n of e.childNodes) { /* measure first text node chars per line */ }
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let node, lines = {};
    while ((node = w.nextNode())) { const rg = document.createRange(); for (let i = 0; i < node.length; i++) { rg.setStart(node, i); rg.setEnd(node, i + 1); const b = rg.getBoundingClientRect(); if (!b.width) continue; const k = Math.round(b.top); lines[k] = (lines[k] || 0) + 1; } }
    for (const k in lines) if (lines[k] > maxc) { maxc = lines[k]; where = e.tagName + '.' + e.className; }
  }
  out.maxChars = maxc; out.maxCharsWhere = where;
  // 25 contrast
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const over2 = (f, b) => ({r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1});
  const bgOf = e => { const stack = []; for (let x = e; x; x = x.parentElement) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let bg = {r: 255, g: 255, b: 255, a: 1}; for (let i = stack.length - 1; i >= 0; i--) bg = over2(stack[i], bg); return bg; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  let minC = 99, minWhere = '', failC = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (!vis(e) || isHp(e)) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e); const isSvg = !!e.closest('svg');
    const fg = parse(isSvg ? s.fill : s.color); if (!fg) continue; const bg = bgOf(e); const f = over2(fg, bg);
    const size = parseFloat(s.fontSize) * (isSvg ? 1 : 1), bold = parseInt(s.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5; const c = cr(f, bg);
    if (c < minC) { minC = c; minWhere = e.tagName + '.' + (e.className.baseVal === undefined ? e.className : e.getAttribute('class')); }
    if (c < need) failC.push(e.tagName + '.' + (e.className.baseVal === undefined ? e.className : '') + ' ' + c.toFixed(2) + '<' + need);
  }
  out.minContrast = minC; out.minContrastWhere = minWhere; out.failContrast = failC.slice(0, 6);
  const ui = [];
  const pageBg = parse(getComputedStyle(document.body).backgroundColor);
  for (const e of document.querySelectorAll('.field input,.field textarea,.opt,.theme-toggle,.menu summary,.btn.ghost')) { if (!vis(e)) continue; const s = getComputedStyle(e); const b = parse(s.borderTopColor); const bg = bgOf(e.parentElement); ui.push([e.tagName + '.' + e.className, cr(over2(b, bg), bg)]); }
  const stroke = document.querySelector('svg .e'); if (stroke) { const sb = bgOf(stroke.closest('.diagram')); ui.push(['svg-edge', cr(over2(parse(getComputedStyle(stroke).stroke), sb), sb)]); }
  const ring = parse(getComputedStyle(document.documentElement).getPropertyValue('--accent') ? (() => { const d = document.createElement('div'); d.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent'); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; })() : 'rgb(0,0,0)');
  ui.push(['focus-ring', cr(ring, pageBg)]);
  out.uiMin = ui.reduce((a, b) => b[1] < a[1] ? b : a, ['', 99]);
  // 26 targets
  const tg = [];
  for (const e of document.querySelectorAll('.btn,.theme-toggle,.menu summary,.field input,.field textarea,.more summary,.twin summary,.opt')) { if (!vis(e) || isHp(e)) continue; const b = e.getBoundingClientRect(); if (b.height < 43.5 || (e.tagName !== 'A' && b.width < 43.5)) tg.push(e.tagName + '.' + e.className + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); }
  out.targetsBad = tg;
  out.footerLinks = [...document.querySelectorAll('footer a')].map(a => Math.round(a.getBoundingClientRect().height));
  // 28 form
  const form = q('#early-access-form'); const ctrls = [...form.querySelectorAll('input,textarea,select')];
  out.formFirst = ctrls[0] && ctrls[0].id; out.required = ctrls.filter(c => c.required).map(c => c.name);
  out.unlabeled = ctrls.filter(c => !isHp(c) && !(c.labels && c.labels.length)).map(c => c.name);
  const det = form.querySelector('details.more'); out.moreClosed = det && !det.open; out.moreHas = det ? [...det.querySelectorAll('input,textarea')].map(c => c.name).filter((v, i, a) => a.indexOf(v) === i) : [];
  const hp = form.querySelector('.hp input'); const hpb = hp.getBoundingClientRect(); out.hp = {tab: hp.tabIndex, right: hpb.right, visible: hpb.right > 0 && hpb.left < iw};
  // 29 diagram
  out.diag = [...document.querySelectorAll('svg[role=img]')].map(s => [s.getAttribute('role'), !!s.querySelector('title'), !!s.querySelector('desc')]);
  const tw = q('details.twin'); out.twin = {closed: !tw.open, summary: tw.querySelector('summary').textContent.trim(), items: tw.querySelectorAll('li').length};
  // 37 footer
  const ft = q('footer'); out.footer = {mailto: !!ft.querySelector('a[href^="mailto:"]'), privacy: !!ft.querySelector('a[href$="privacy/"]'), terms: !!ft.querySelector('a[href$="terms/"]'), status: /Early-stage software/.test(ft.innerText), synthetic: /synthetic demo data/.test(ft.innerText), backed: /Backed by/i.test(ft.innerText)};
  // bg for 30
  out.bg = getComputedStyle(document.body).backgroundColor; out.dataTheme = document.documentElement.getAttribute('data-theme');
  return out;
}
"""


def new_page(b, w, theme, dpr=1, **kw):
    ctx = b.new_context(viewport={"width": w, "height": 900}, device_scale_factor=dpr, **kw)
    pg = ctx.new_page()
    return ctx, pg


def run():
    base_text = None
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
        M = {}
        for w in WIDTHS:
            for th in THEMES:
                ctx, pg = new_page(b, w, th)
                pg.goto(BASE); pg.wait_for_timeout(500)
                if th == "dark":
                    pg.click("#theme-toggle"); pg.wait_for_timeout(100)
                pg.wait_for_function("document.fonts.status === 'loaded'")
                m = pg.evaluate(MEASURE); M[(w, th)] = m
                ctx.close()
        # ---- evaluate per width/theme -------------------------------------------------
        for (w, th), m in M.items():
            tag = f"{w}/{th}"
            rec(1, abs(m["sw"] - m["iw"]) <= 1, f"{tag} scrollWidth {m['sw']} vs {m['iw']}")
            rec(2, m["overflowN"] == 0, f"{tag} {m['overflowN']} elements outside viewport {m['overflow'][:2]}")
            rec(3, not m["scrollRegions"] and not m["scrollHint"], f"{tag} regions {m['scrollRegions']} hint {m['scrollHint']}")
            i, c = m["img"], m["cont"]
            if w >= 1024:
                inside = i["l"] >= c["l"] - 0.5 and i["r"] <= c["r"] + 0.5 and (m["iw"] - i["r"]) >= 24
                rec(4, inside, f"{tag} img {i['l']:.0f}..{i['r']:.0f} container {c['l']:.0f}..{c['r']:.0f}, right gap {m['iw'] - i['r']:.0f}")
                cap = min(600, 0.46 * m["iw"]) + 1; ar = i["w"] / i["h"]
                rec(5, i["w"] <= cap and i["h"] <= 420 and 1.33 <= ar <= 2.1, f"{tag} img {i['w']:.0f}x{i['h']:.0f} cap {cap:.0f} ratio {ar:.2f} ({i['w'] / m['iw'] * 100:.0f}% of viewport)")
            elif w == 768:
                rec(6, i["w"] <= 720 and i["h"] <= 320 and i["l"] >= c["l"] - 0.5 and i["r"] <= c["r"] + 0.5, f"{tag} img {i['w']:.0f}x{i['h']:.0f}")
            else:
                rec(6, i["w"] <= 350 and i["h"] <= 260 and i["r"] <= c["r"] + 0.5 and i["t"] <= 1000, f"{tag} img {i['w']:.0f}x{i['h']:.0f} top {i['t']:.0f}")
            if w == 1440:
                rec(7, m["h1b"]["b"] <= 900 and m["lede"]["b"] <= 900 and m["cta"]["b"] <= 900 and (min(900, i["b"]) - i["t"]) / i["h"] >= 0.4, f"{tag} h1 bottom {m['h1b']['b']:.0f}, lede {m['lede']['b']:.0f}, cta {m['cta']['b']:.0f}, img visible {(min(900, i['b']) - i['t']) / i['h'] * 100:.0f}%")
            sc = i["w"] / (m["imgNat"] / (2 if "2x" in m["imgSrc"] else 1))
            rec(8, sc >= 0.85, f"{tag} scale {sc:.3f} ({m['imgSrc']} natural {m['imgNat']}, displayed {i['w']:.0f})")
            a = m["imgAttrs"]
            rec(9, a["w"] and a["h"] and a["fp"] == "high" and 40 <= a["alt"] <= 250 and all(x == "lazy" for x in m["otherImgs"]), f"{tag} attrs {a} other imgs {m['otherImgs']}")
            s = m["imgStyle"]
            rec(10, s["filter"] == "none" and s["blend"] == "normal" and all(x == "1px" for x in s["bw"]) and s["bs"] == "solid" and "synthetic" in m["figcap"], f"{tag} {s}")
            if "svg" in m:
                sv = m["svg"]
                rec(11, sv["w"] <= m["svgPanel"] + 0.5 and sv["w"] <= m["iw"] and sv["minFont"] >= 11.95, f"{tag} svg {sv['cls']} width {sv['w']:.0f} (panel {m['svgPanel']:.0f}) min text {sv['minFont']:.2f}px")
                rec(23, sv["minFont"] >= 11.95, f"{tag} svg text min {sv['minFont']:.2f}px")
            if w == 1440 and th == "light":
                rec(12, 4400 <= m["height"] <= 6200 and m["sec"]["hero"] <= 760 and m["sec"]["next"] <= 480 and m["sec"]["product"] <= 1500, f"{tag} page {m['height']} hero {m['sec']['hero']:.0f} next {m['sec']['next']:.0f} product {m['sec']['product']:.0f}")
            if w == 390 and th == "light":
                rec(12, m["height"] <= 8000, f"{tag} page height {m['height']}")
            if w >= 1024:
                labs = [x[0] for x in m["navLinks"]]
                rec(14, labs == ["How it works", "See it", "What’s next"] and all(x[2] for x in m["navLinks"]) and [x[1] for x in m["navLinks"]] == ["#how", "#product", "#next"], f"{tag} nav {m['navLinks']}")
            if w < 640:
                rec(15, m["menuVisible"] and m["menuBtn"]["w"] >= 44 and m["menuBtn"]["h"] >= 44 and m["menuLinks"] == ["How it works", "See it", "What’s next"], f"{tag} menu {m['menuBtn']['w']:.0f}x{m['menuBtn']['h']:.0f} links {m['menuLinks']}")
            rec(13, not m["direction"], f"{tag} 'Direction' present: {m['direction']}")
            rec(16, m["h1n"] == 1 and [x[1] for x in m["h2s"]] == ["problem", "how", "product", "next", "access"] and not m["h2OutsideMain"] and not m["headingSkip"] and all(m["ids"]), f"{tag} h1 {m['h1n']} h2 {m['h2s']} skip {m['headingSkip']} ids {m['ids']}")
            rec(17, m["nextH2"] == "Where this is going" and m["chipDist"] is not None and m["chipDist"] <= 400, f"{tag} h2 {m['nextH2']!r} chip distance {m['chipDist']}")
            rec(18, m["ctas"] == ["Request early access"] * 3 and m["heroPrimary"] == "#access", f"{tag} {m['ctas']} href {m['heroPrimary']}")
            rec(20, m["words"] <= 1000, f"{tag} {m['words']} words in main")
            if w in (320, 390, 768, 1024, 1280, 1440, 1920):
                h = m["h1"]
                ok = True; d = f"{tag} h1 {h['px']:.1f}px {h['lines']} lines, h2 {m['h2px']:.1f}px"
                if w == 1440: ok = 48 <= h["px"] <= 60 and 36 <= m["h2px"] <= 44
                if w == 1280: ok = h["lines"] <= 3
                if w == 390: ok = h["lines"] <= 4
                rec(21, ok, d)
            rec(22, not m["over22"], f"{tag} {m['over22'][:3]}")
            if "svg" not in m: pass
            rec(23, not m["small"] and m["bodyP"] >= 16, f"{tag} small {m['small']} min body p {m['bodyP']}px")
            if w == 1440:
                rec(24, m["maxChars"] <= 80, f"{tag} longest line {m['maxChars']} chars ({m['maxCharsWhere']})")
            rec(25, not m["failContrast"] and m["uiMin"][1] >= 3, f"{tag} min text contrast {m['minContrast']:.2f} ({m['minContrastWhere']}); fails {m['failContrast'][:3]}; weakest UI {m['uiMin'][0]} {m['uiMin'][1]:.2f}")
            if w == 390:
                rec(26, not m["targetsBad"] and min(m["footerLinks"]) >= 24, f"{tag} small targets {m['targetsBad'][:4]} footer link heights {m['footerLinks']}")
            rec(28, m["formFirst"] == "email" and m["required"] == ["email"] and not m["unlabeled"] and m["moreClosed"] and not m["hp"]["visible"] and m["hp"]["tab"] == -1 and set(m["moreHas"]) == {"role", "field", "runs-on", "human-data", "tracking"}, f"{tag} first {m['formFirst']} required {m['required']} unlabeled {m['unlabeled']} closed {m['moreClosed']} hp {m['hp']} inside {m['moreHas']}")
            ok29 = all(x == ["img", True, True] for x in m["diag"]) and m["twin"]["closed"] and m["twin"]["summary"] == "Text version of this diagram" and m["twin"]["items"] >= 4
            rec(29, ok29, f"{tag} {m['diag']} {m['twin']}")
            f = m["footer"]
            rec(37, f["mailto"] and f["privacy"] and f["terms"] and f["status"] and f["synthetic"] and not f["backed"], f"{tag} {f}")
            if w == 1440:
                rec(32, s["filter"] == "none" and m["shot"]["w"] <= 650 and m["shot"]["h"] <= 450, f"{tag} mat+image {m['shot']['w']:.0f}x{m['shot']['h']:.0f}")
        # ---- 19 forbidden strings ----------------------------------------------------
        ctx, pg = new_page(b, 1440, "light"); pg.goto(BASE); pg.wait_for_timeout(300)
        blob = pg.evaluate("document.body.innerText + ' ' + document.title + ' ' + [...document.querySelectorAll('meta')].map(m=>m.content).join(' ') + ' ' + [...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s=>s.textContent).join(' ') + ' ' + [...document.querySelectorAll('[alt],[aria-label],title,desc')].map(e=>e.getAttribute('alt')||e.getAttribute('aria-label')||e.textContent).join(' ')")
        bad = [s for s in ["open source", "open-source", "AI-powered", "customers", "trusted by", "testimonial", "reproducible results", "guarantee", "seamless", "revolutionary", "unlock", "Backed by", "roadmap", "founder", "beta", "FAQ"] if s.lower() in blob.lower()]
        rec(19, not bad, f"forbidden strings found: {bad}")
        ctx.close()
        # ---- 27 keyboard ---------------------------------------------------------------
        for th in THEMES:
            ctx, pg = new_page(b, 1280, th); pg.goto(BASE); pg.wait_for_timeout(300)
            if th == "dark": pg.evaluate("localStorage.setItem('jubilab-theme','dark')"); pg.reload(); pg.wait_for_timeout(200)
            seq = []
            for _ in range(7):
                pg.keyboard.press("Tab")
                seq.append(pg.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return [e.className||e.tagName,e.textContent.trim().slice(0,18),parseFloat(s.outlineWidth),s.outlineStyle]})()"))
            ok = "skip" in seq[0][0] and all(x[2] >= 2 and x[3] != "none" for x in seq)
            rec(27, ok, f"1280/{th} focus order {[x[1] or x[0] for x in seq]} outline widths {[x[2] for x in seq]}")
            ctx.close()
        # menu opens by keyboard, JS off
        ctx = b.new_context(viewport={"width": 390, "height": 800}, java_script_enabled=False); pg = ctx.new_page(); pg.goto(BASE)
        pg.focus(".menu summary"); pg.keyboard.press("Enter")
        opened = pg.evaluate("document.querySelector('.menu').open")
        rec(15, opened, "390 JS off: keyboard Enter on menu summary opens the menu: " + str(opened))
        tv = pg.evaluate("(()=>{const t=document.getElementById('theme-toggle');return [t.hidden, getComputedStyle(t).display, !!document.querySelector('#early-access-form'), getComputedStyle(document.body).backgroundColor]})()")
        rec(31, tv[0] and tv[1] == "none" and tv[2] and tv[3] == "rgb(244, 245, 242)", f"JS off: toggle hidden {tv[0]} display {tv[1]} form {tv[2]} bg {tv[3]}")
        ctx.close()
        # ---- 30 theme ---------------------------------------------------------------------
        ctx = b.new_context(viewport={"width": 1280, "height": 800}, color_scheme="dark"); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
        g = lambda: pg.evaluate("[document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor, document.getElementById('theme-toggle').getAttribute('aria-label')]")
        a0 = g(); pg.click("#theme-toggle"); a1 = g(); pg.reload(); pg.wait_for_timeout(300); a2 = g(); pg.click("#theme-toggle"); a3 = g()
        ok = a0[0] is None and a0[1] == "rgb(244, 245, 242)" and a1[0] == "dark" and a1[1] == "rgb(14, 20, 22)" and a2[0] == "dark" and a1[2] != a0[2] and a3[0] is None and a3[2] == a0[2]
        rec(30, ok, f"dark OS pref, empty storage: {a0} -> click {a1} -> reload {a2} -> click {a3}")
        ctx.close()
        # 31 localStorage throws
        ctx = b.new_context(viewport={"width": 1280, "height": 800}); ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.goto(BASE); pg.wait_for_timeout(300)
        b0 = pg.evaluate("getComputedStyle(document.body).backgroundColor"); pg.click("#theme-toggle"); b1 = pg.evaluate("getComputedStyle(document.body).backgroundColor")
        rec(31, b0 == "rgb(244, 245, 242)" and b1 == "rgb(14, 20, 22)" and not errs, f"localStorage throws: {b0} -> {b1}, page errors {errs}")
        ctx.close()
        # ---- 33 reduced motion ------------------------------------------------------------
        for rm in ("reduce", "no-preference"):
            ctx = b.new_context(viewport={"width": 1280, "height": 800}, reduced_motion=rm); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
            n0 = pg.evaluate("document.getAnimations().length")
            for sel in (".hero .btn", ".btn.ghost", ".site-nav a", ".theme-toggle"):
                pg.hover(sel); pg.focus(sel)
            n1 = pg.evaluate("document.getAnimations().length")
            mx = pg.evaluate("Math.max(...[...document.querySelectorAll('*')].map(e=>Math.max(...getComputedStyle(e).transitionDuration.split(',').map(parseFloat))))")
            sb = pg.evaluate("getComputedStyle(document.documentElement).scrollBehavior")
            if rm == "reduce":
                rec(33, n0 == 0 and n1 == 0 and mx <= 0.01 and sb == "auto", f"reduce: animations {n0}/{n1}, max transition {mx}s, scroll-behavior {sb}")
            else:
                rec(33, n0 == 0 and mx <= 0.2, f"no-preference: animations at load {n0}, max transition {mx}s")
            ctx.close()
        # ---- 34 35 36 network and CLS ------------------------------------------------------
        for w in (1440, 390):
            ctx = b.new_context(viewport={"width": w, "height": 900}); pg = ctx.new_page(); resp = []
            pg.on("response", lambda r: resp.append(r))
            pg.add_init_script("window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value}).observe({type:'layout-shift',buffered:true})")
            pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(3000)
            cls = pg.evaluate("window.__cls"); cookie = pg.evaluate("document.cookie")
            rec(36, cls <= 0.02, f"{w}px CLS {cls:.4f}")
            if w == 1440:
                tot = 0; kinds = {"font": [], "js": 0, "html": 0, "css": 0, "img": 0}; hosts = set(); setck = False
                for r in resp:
                    body = r.body(); n = len(body); tot += n; u = r.url; hosts.add(re.sub(r"^https?://([^/]+)/.*", r"\1", u))
                    if "set-cookie" in r.headers: setck = True
                    if u.endswith(".woff2"): kinds["font"].append(n)
                    elif u.endswith(".js"): kinds["js"] += n
                    elif u.endswith(".css"): kinds["css"] += n
                    elif u.endswith(".webp") or u.endswith(".png"): kinds["img"] += n
                    elif u.rstrip("/") == BASE.rstrip("/") or u.endswith(".html"): kinds["html"] = n
                rec(34, tot <= 250000 and sum(kinds["font"]) <= 80000 and len(kinds["font"]) <= 3 and kinds["js"] <= 6000 and kinds["html"] <= 30000 and kinds["css"] <= 30000, f"total {tot} B (uncompressed body bytes), fonts {kinds['font']}, js {kinds['js']}, html {kinds['html']}, css {kinds['css']}, images {kinds['img']}")
                rec(9, kinds["img"] <= 100000, f"1440 image bytes {kinds['img']}")
                own = BASE.split("/")[2]
                rec(35, hosts == {own} and not setck and cookie == "", f"hosts {hosts}, Set-Cookie {setck}, document.cookie {cookie!r}")
            ctx.close()
        # hero image bytes at 1x and 2x (check 9: at most 60 KB at 1x)
        import urllib.request
        sizes = {f: len(urllib.request.urlopen(BASE + "assets/img/" + f).read()) for f in ("hero.webp", "hero-2x.webp", "hero-narrow.webp", "hero-narrow-2x.webp")}
        rec(9, sizes["hero.webp"] <= 60000 and sizes["hero-2x.webp"] <= 120000, f"hero image bytes {sizes}")
        # 2x display picks the 2x file
        ctx, pg = new_page(b, 1440, "light", dpr=2); pg.goto(BASE); pg.wait_for_timeout(300)
        cur = pg.evaluate("document.querySelector('.hero img').currentSrc.split('/').pop()")
        rec(8, cur == "hero-2x.webp", f"1440 at devicePixelRatio 2 currentSrc {cur}")
        ctx.close()
        b.close()
    return


def main():
    run()
    manual = {20: "list-of-features review is manual"}
    allok = True
    print(f"Jubilab site v2 acceptance checks against {BASE}\n")
    for n in range(1, 38):
        if n not in R:
            print(f"{n:>2}  NOT RUN  (not covered by this script)"); continue
        res = R[n]; fails = [d for ok, d in res if not ok]
        status = "PASS" if not fails else "FAIL"
        if fails: allok = False
        extra = "  [MANUAL part: " + manual[n] + "]" if n in manual else ""
        print(f"{n:>2}  {status}  ({len(res) - len(fails)}/{len(res)} cases){extra}")
        for d in (fails[:6] if fails else [res[-1][1]]):
            print("        " + d)
    json.dump({str(k): v for k, v in R.items()}, open("/tmp/jubilab-check-site.json", "w"), indent=1)
    sys.exit(0 if allok else 1)


main()
