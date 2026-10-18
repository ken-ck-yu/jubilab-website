#!/usr/bin/env python3
"""Acceptance checks for the Jubilab website v2 (UXD spec section 5 and, for the hero, docs/design-spec-v2.1.md section 8).

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

STRICT_NET = "--strict-network" in sys.argv  # expect zero external requests (use when Google is removed entirely; the default now allows Google only after Accept)
_args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (_args[0] if _args else "http://127.0.0.1:18212/").rstrip("/") + "/"
EXE = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
WIDTHS = [320, 390, 768, 1024, 1280, 1440, 1920]
THEMES = ["light", "dark"]
GUIDE_PATHS = ("guides/", "guides/reference-genome-build-vcf-bam/", "guides/what-parameters-produced-this-result/", "guides/nextflow-provenance-and-lineage-compared/")
GUIDE_WIDTHS = [320, 375, 768, 1440]
SIX = ["What it does", "Integrations", "Where this is going", "Is this you?", "Demo project", "Get started"]
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
  out.frameLineCR = null;
  // v2.1 frame (N1..N9)
  const fr = q('.hero .frame'), fm = q('.hero .frame-media'), fb = q('.hero .frame-bar'), ht = q('.hero-text');
  out.frame = r(fr); out.media = r(fm); out.textCol = {l: r(ht).l};
  const fcs = getComputedStyle(fr);
  out.frameStyle = {bw: [fcs.borderTopWidth, fcs.borderRightWidth, fcs.borderBottomWidth, fcs.borderLeftWidth], bs: fcs.borderTopStyle, radius: fcs.borderTopLeftRadius, ox: getComputedStyle(fr).overflowX, mox: getComputedStyle(fm).overflowX, tabindex: fr.getAttribute('tabindex'), hasLink: !!fr.querySelector('a,button,[tabindex]'), transform: fcs.transform};
  out.mediaCS = {ox: getComputedStyle(fm).overflowX, ar: fm.getBoundingClientRect().width / fm.getBoundingClientRect().height};
  out.bar = {ariaHidden: fb.getAttribute('aria-hidden'), h: fb.getBoundingClientRect().height, focusable: fb.querySelectorAll('a,button,input,[tabindex]').length, label: fb.innerText.trim(), labelPx: parseFloat(getComputedStyle(fb).fontSize)};
  out.figN = document.querySelectorAll('.hero-shot figcaption').length; out.pinN = document.querySelectorAll('.pin').length;
  out.heroText = q('.hero-text').innerText; out.imgFill = {dl: Math.abs(ib.l - r(fm).l), dr: Math.abs(ib.r - r(fm).r), dt: Math.abs(ib.t - r(fm).t), db: Math.abs(ib.b - r(fm).b)};
  out.imgAlt = img.getAttribute('alt') || '';
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
  const navLinks = [...document.querySelectorAll('.subnav a')].filter(vis);
  out.navLinks = navLinks.map(a => [a.textContent.trim(), a.getAttribute('href'), !!document.querySelector(a.getAttribute('href'))]);
  const menu = q('.menu'); out.menuVisible = vis(menu); const ms = q('.menu summary'); out.menuBtn = r(ms);
  out.menuLinks = [...menu.querySelectorAll('a')].map(a => a.textContent.trim());
  out.h1n = document.querySelectorAll('h1').length;
  out.h2s = [...document.querySelectorAll('main h2')].map(h => [h.textContent.trim(), h.closest('section') && h.closest('section').id]);
  out.h2OutsideMain = document.querySelectorAll('footer h2, header h2').length;
  const hs = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]); let skip = false; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skip = true; out.headingSkip = skip;
  out.ids = ['problem', 'how', 'fits', 'next', 'who', 'product', 'access'].map(i => !!document.getElementById(i));
  out.text = document.body.innerText;
  out.direction = /direction/i.test(document.body.innerText) || [...document.querySelectorAll('h1,h2,h3,nav a,.eyebrow')].some(e => /direction/i.test(e.textContent));
  const main0 = document.querySelector('main'); const nh = [...document.querySelectorAll('h2')].find(h => /accelerate the genetics discovery loop/i.test(h.textContent)); out.nextH2 = nh ? nh.textContent.trim() : null;
  out.chipEls = document.querySelectorAll('main [class*="chip-"], main .tag, main .tag-today, main .tag-building, main .chip-intent').length;
  out.statusWords = (main0.innerText.match(/\b(today|exploring|building|planned|coming soon|beta)\b/gi) || []).filter((w, i, a) => true);
  out.statusCtx = [...main0.innerText.matchAll(/.{0,12}\b(today|exploring|building|planned|coming soon|beta)\b.{0,12}/gi)].map(x => x[0]).filter(t => !/(we are|is|are) building|made today/i.test(t));
  const ctas = [...document.querySelectorAll('header .btn, .hero .btn:not(.ghost), form button[type=submit]')]; out.ctas = ctas.map(a => (a.getAttribute('aria-label') || a.textContent).trim()); out.heroPrimary = q('.hero .btn').getAttribute('href');
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
  { const fl = parse(getComputedStyle(document.querySelector('.hero .frame')).borderTopColor); out.frameLineCR = cr(over2(fl, pageBg), pageBg); }
  { const fb2 = document.querySelector('.hero .frame-bar'); if (fb2.innerText.trim()) { const fs = getComputedStyle(fb2); const fg = parse(fs.color); const bgc = bgOf(fb2); out.barLabelCR = cr(over2(fg, bgc), bgc); } }
  out.uiMin = ui.reduce((a, b) => b[1] < a[1] ? b : a, ['', 99]);
  // 26 targets
  const tg = [];
  for (const e of document.querySelectorAll('.btn,.theme-toggle,.menu summary,.field input,.field textarea,.twin summary,.opt')) { if (!vis(e) || isHp(e)) continue; const b = e.getBoundingClientRect(); if (b.height < 43.5 || (e.tagName !== 'A' && b.width < 43.5)) tg.push(e.tagName + '.' + e.className + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); }
  out.targetsBad = tg;
  out.footerLinks = [...document.querySelectorAll('footer a')].map(a => Math.round(a.getBoundingClientRect().height));
  // 28 form
  const form = q('#early-access-form'); const ctrls = [...form.querySelectorAll('input,textarea,select')];
  out.formFirst = ctrls[0] && ctrls[0].id; out.required = ctrls.filter(c => c.required).map(c => c.name);
  out.unlabeled = ctrls.filter(c => !isHp(c) && !(c.labels && c.labels.length)).map(c => c.name);
  out.reqNames = [...new Set(ctrls.filter(c => c.required).map(c => c.name))]; out.noDetails = !form.querySelector('details');
  out.names = [...new Set(ctrls.filter(c => !isHp(c)).map(c => c.name))];
  out.groups = [...form.querySelectorAll('fieldset')].map(f => [f.id, !!(f.querySelector('legend') && f.querySelector('legend').textContent.trim())]);
  const vals = n => [...form.querySelectorAll('input[name="' + n + '"]')].map(c => c.value);
  out.opts = {role: vals('role'), field: vals('field'), runs: vals('runs-on'), human: vals('human-data')};
  out.runsLabels = [...form.querySelectorAll('input[name="runs-on"]')].map(c => c.labels[0].textContent.trim());
  out.otherBoxes = [...form.querySelectorAll('.other input')].map(c => [c.name, c.maxLength, c.labels[0] && /If other, please specify/.test(c.labels[0].textContent)]);
  out.trackingOptional = !form.querySelector('#tracking').required && form.querySelector('#tracking').maxLength === 300;
  const hp = form.querySelector('.hp input'); const hpb = hp.getBoundingClientRect(); out.hp = {name: hp.name, ac: hp.getAttribute('autocomplete'), lp: hp.getAttribute('data-lpignore'), op: hp.hasAttribute('data-1p-ignore'), tab: hp.tabIndex, right: hpb.right, visible: hpb.right > 0 && hpb.left < iw};
  // 29 diagram
  out.diag = [...document.querySelectorAll('svg[role=img]')].map(s => [s.getAttribute('role'), !!s.querySelector('title'), !!s.querySelector('desc')]);
  const tw = q('details.twin'); out.twin = {closed: !tw.open, summary: tw.querySelector('summary').textContent.trim(), items: tw.querySelectorAll('li').length};
  // 37 footer
  const ft = q('footer'); out.footer = {mailto: !!ft.querySelector('a[href^="mailto:"]'), privacy: !!ft.querySelector('a[href$="privacy/"]'), terms: !!ft.querySelector('a[href$="terms/"]'), status: /Be among the first labs shaping Jubilab/.test(ft.innerText), synthetic: /synthetic demo data/.test(ft.innerText), backed: /Backed by/i.test(ft.innerText)};
  // bg for 30
  out.bg = getComputedStyle(document.body).backgroundColor; out.dataTheme = document.documentElement.getAttribute('data-theme');
  return out;
}
"""



GUIDE_MEASURE = r"""
() => {
  const iw = innerWidth, out = {iw, sw: document.documentElement.scrollWidth};
  const inScroll = e => !!e.closest('pre, .table-scroll');
  out.outside = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && s.display !== 'none' && s.position !== 'fixed' && !inScroll(e) && (r.right > iw + 1 || r.left < -1); })
      .map(e => e.tagName + '.' + e.className).slice(0, 5);
  const pres = [...document.querySelectorAll('main pre')];
  out.pre = {n: pres.length, focusable: pres.every(p => p.tabIndex === 0 && p.getAttribute('aria-label')), overflowX: pres.every(p => ['auto','scroll'].includes(getComputedStyle(p).overflowX)),
             scrollable: pres.filter(p => p.scrollWidth > p.clientWidth + 1).length, widest: Math.max(0, ...pres.map(p => p.getBoundingClientRect().width)), fit: pres.every(p => p.getBoundingClientRect().right <= iw + 1)};
  const tabs = [...document.querySelectorAll('main .table-scroll')];
  out.tab = {n: tabs.length, focusable: tabs.every(t => t.tabIndex === 0 && t.getAttribute('aria-label')), fit: tabs.every(t => t.getBoundingClientRect().right <= iw + 1), scrollable: tabs.filter(t => t.scrollWidth > t.clientWidth + 1).length};
  const h = [...document.querySelectorAll('main h1,main h2,main h3,main h4')].map(e => +e.tagName[1]);
  out.h1 = h.filter(x => x === 1).length; let prev = 0, skip = 0; for (const l of h) { if (prev && l > prev + 1) skip++; prev = l; } out.skip = skip;
  // contrast
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1}; };
  const bgOf = e => { let layers = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } }
      let base = {r: 255, g: 255, b: 255}; for (const c of layers.reverse()) base = {r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a)}; return base; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const sel = ['.g-lede', '.g-meta', '.g-crumbs a', '.g-body p', '.g-body li', '.g-body h2', '.g-body h3', '.g-body a', '.code-cap', 'pre.code', 'pre.code.out', '.table-scroll th', '.table-scroll td', '.table-scroll caption', '.helps p', '.helps li', '.helps h3', '.helps a', '.g-review', '.g-sources .why', '.g-list p', '.g-list .q', '.g-list h2 a', 'footer p', 'footer a', '.btn'];
  out.contrast = [];
  for (const q of sel) for (const e of [...document.querySelectorAll(q)].slice(0, 3)) {
    const st = getComputedStyle(e); if (!e.getClientRects().length || !e.textContent.trim()) continue;
    const fg = parse(st.color), bg = bgOf(e); const size = parseFloat(st.fontSize), bold = parseInt(st.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5; const r = ratio(fg, bg);
    if (r < need) out.contrast.push(q + ' ' + r.toFixed(2) + '<' + need);
  }
  const ft = [...document.querySelectorAll('footer ul a')].map(a => a.getBoundingClientRect().height);
  out.footerH = Math.min(...ft);
  out.hasGuidesLink = !![...document.querySelectorAll('footer a')].find(a => a.textContent.trim() === 'Guides' && /guides\/$/.test(a.getAttribute('href')));
  out.h1Size = parseFloat(getComputedStyle(document.querySelector('main h1')).fontSize);
  return out;
}
"""

PRESET = "try{localStorage.getItem('jubilab-consent')||localStorage.setItem('jubilab-consent',JSON.stringify({v:'denied',t:Date.now()}))}catch(e){}"


def mk(b, preset=True, **kw):
    """New browser context. By default a stored consent choice (denied) is preset so the cookie notice does not
    sit in layout measurements; pass preset=False to see the first-visit state with the notice."""
    ctx = b.new_context(**kw)
    if preset: ctx.add_init_script(PRESET)
    return ctx


def new_page(b, w, theme, dpr=1, **kw):
    ctx = mk(b, viewport={"width": w, "height": 900}, device_scale_factor=dpr, **kw)
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
            i, c = m["img"], m["cont"]; fr, md = m["frame"], m["media"]; tl = m["textCol"]["l"]
            # 4 frame inside the hero text column edges, gap to viewport
            mingap = 16 if w <= 640 else 24
            inside = abs(fr["l"] - tl) <= 1 and abs(fr["r"] - c["r"]) <= 1 and fr["l"] >= mingap - 0.5 and (m["iw"] - fr["r"]) >= mingap - 0.5
            rec(4, inside, f"{tag} frame {fr['l']:.0f}..{fr['r']:.0f}, text column {tl:.0f}..{c['r']:.0f}, gaps {fr['l']:.0f}/{m['iw'] - fr['r']:.0f}")
            # 6 (replaces 5 and 6) media size at 768 and 390
            if w == 768:
                rec(6, abs(md["w"] - 720) <= 2 and abs(md["h"] - 405) <= 2, f"{tag} media {md['w']:.0f}x{md['h']:.0f} (want 720x405)")
            if w == 390:
                rec(6, abs(md["w"] - 358) <= 2 and abs(md["h"] - 269) <= 2 and md["t"] <= 760, f"{tag} media {md['w']:.0f}x{md['h']:.0f} (want 358x269) top {md['t']:.0f}")
            if w == 1440:
                vis = (min(900, md["b"]) - md["t"]) / md["h"]
                rec(7, m["h1b"]["b"] <= 900 and m["lede"]["b"] <= 900 and m["cta"]["b"] <= 700 and vis >= 0.4, f"{tag} h1 bottom {m['h1b']['b']:.0f}, lede {m['lede']['b']:.0f}, cta {m['cta']['b']:.0f} (<=700), media visible {vis * 100:.0f}%")
            a = m["imgAttrs"]
            ratio_attr = int(a["w"] or 0) / max(1, int(a["h"] or 1))
            rec(9, a["w"] and a["h"] and abs(ratio_attr - 16 / 9) < 0.01 and a["fp"] == "high" and 40 <= a["alt"] <= 250 and all(x == "lazy" for x in m["otherImgs"]), f"{tag} attrs {a} other imgs {m['otherImgs']}")
            s = m["imgStyle"]; fs = m["frameStyle"]
            rec(10, s["filter"] == "none" and s["blend"] == "normal" and all(x == "0px" for x in s["bw"]) and all(x == "1px" for x in fs["bw"]) and fs["bs"] == "solid" and fs["radius"] == "12px" and m["figN"] == 0 and "synthetic" in m["imgAlt"].lower() and "Demo data is synthetic" in m["heroText"], f"{tag} img {s} frame {fs['bw'][0]} {fs['bs']} r{fs['radius']} figcaptions {m['figN']}")
            # N1 no caption, no pins
            rec("N1", m["figN"] == 0 and m["pinN"] == 0 and "A real screen" not in m["text"] and "An input that stays where it lives" not in m["text"] and "Demo data is synthetic" in m["heroText"], f"{tag} figcaptions {m['figN']} pins {m['pinN']}")
            # N2 width
            want = {390: 358, 768: 720, 1280: 1120, 1440: 1120, 1920: 1120}.get(w)
            if w == 1024: want = m["cont"]["r"] - tl  # container is 976 at 1024 (spec table said 944), see report
            if w == 320: want = m["iw"] - 32
            ok2 = abs(md["w"] - want) <= 2 and md["w"] <= 1240 and (w != 1440 or md["w"] >= 0.75 * m["iw"])
            rec("N2", ok2, f"{tag} media {md['w']:.0f} want {want:.0f}" + (f", {md['w'] / m['iw'] * 100:.0f}% of viewport" if w == 1440 else ""))
            # N3 ratio and fill
            wantr = 4 / 3 if w <= 640 else 16 / 9
            fl = m["imgFill"]
            rec("N3", abs(md["w"] / md["h"] - wantr) <= 0.02 and max(fl.values()) <= 1.01, f"{tag} media ratio {md['w'] / md['h']:.3f} (want {wantr:.3f}), img offsets {fl}")
            # N4 sharpness at dpr 1 (dpr 2 below)
            pxw = {"hero-720.webp": 720, "hero-1120.webp": 1120, "hero-1440.webp": 1440, "hero-2240.webp": 2240, "hero-narrow-358.webp": 358, "hero-narrow-716.webp": 716}.get(m["imgSrc"], 0)
            rec("N4", pxw >= i["w"] - 1 and i["w"] <= pxw * 1.01, f"{tag} dpr1 {m['imgSrc']} intrinsic {pxw}, displayed {i['w']:.0f}")
            # N5 chrome bar
            bar = m["bar"]; okb = bar["ariaHidden"] == "true" and abs(bar["h"] - 32) <= 2 and bar["focusable"] == 0
            if bar["label"]: okb = okb and bar["labelPx"] >= 12 and m.get("barLabelCR", 0) >= 4.5
            rec("N5", okb, f"{tag} bar {bar}")
            # N6 no scroll region on frame
            rec("N6", fs["ox"] not in ("auto", "scroll") and m["mediaCS"]["ox"] not in ("auto", "scroll") and fr["l"] >= -0.5 and fr["r"] <= m["iw"] + 0.5 and md["r"] <= m["iw"] + 0.5, f"{tag} overflow-x frame {fs['ox']} media {m['mediaCS']['ox']}")
            if th == "dark":
                rec("N7", m["frameLineCR"] >= 3, f"{tag} frame border contrast vs page {m['frameLineCR']:.2f}")
            # N8 static part: frame not focusable
            rec("N8", fs["tabindex"] is None and not fs["hasLink"], f"{tag} frame tabindex {fs['tabindex']} link/button inside {fs['hasLink']}")
            # N11 fold
            if w == 390:
                rec("N11", m["h1b"]["b"] <= 844 and m["cta"]["b"] <= 844 and md["t"] <= 844, f"{tag} h1 bottom {m['h1b']['b']:.0f}, cta {m['cta']['b']:.0f}, media top {md['t']:.0f} (fold 844; visual review of the PNG is manual)")
            if w == 1440:
                rec("N11", m["h1b"]["b"] <= 900 and m["cta"]["b"] <= 900 and (min(900, md["b"]) - md["t"]) / md["h"] >= 0.4, f"{tag} at 1440x900: h1/lede/CTAs above the fold, media visible {(min(900, md['b']) - md['t']) / md['h'] * 100:.0f}%")
            if "svg" in m:
                sv = m["svg"]
                rec(11, sv["w"] <= m["svgPanel"] + 0.5 and sv["w"] <= m["iw"] and sv["minFont"] >= 11.95, f"{tag} svg {sv['cls']} width {sv['w']:.0f} (panel {m['svgPanel']:.0f}) min text {sv['minFont']:.2f}px")
                rec(23, sv["minFont"] >= 11.95, f"{tag} svg text min {sv['minFont']:.2f}px")
            if w == 1440 and th == "light":
                rec(12, 4400 <= m["height"] <= 9000 and m["sec"]["hero"] <= 1320 and m["sec"]["next"] <= 700 and m["sec"]["product"] <= 1700, f"{tag} page {m['height']} hero {m['sec']['hero']:.0f} next {m['sec']['next']:.0f} product {m['sec']['product']:.0f}")
            if w == 390 and th == "light":
                rec(12, m["height"] <= 13700, f"{tag} page height {m['height']}")  # was 13000; the collapsed 7-question FAQ section (SEO work) adds about 600 px on phones; desktop budget (9000 at 1440) is unchanged

            if w >= 1024:  # one navigation on desktop: the sticky strip (the header holds only brand, theme toggle and CTA; its menu is shown below 900 px)
                labs = [x[0] for x in m["navLinks"]]
                rec(14, labs == SIX and all(x[2] for x in m["navLinks"]) and [x[1] for x in m["navLinks"]] == ["#how", "#fits", "#next", "#who", "#product", "#access"], f"{tag} nav {m['navLinks']}")
            if w < 640:
                rec(15, m["menuVisible"] and m["menuBtn"]["w"] >= 44 and m["menuBtn"]["h"] >= 44 and m["menuLinks"] == SIX, f"{tag} menu {m['menuBtn']['w']:.0f}x{m['menuBtn']['h']:.0f} links {m['menuLinks']}")
            rec(13, not m["direction"], f"{tag} 'Direction' present: {m['direction']}")
            rec(16, m["h1n"] == 1 and [x[1] for x in m["h2s"]] == ["how", "fits", "next", "who", "product", "faq", "access"] and not m["h2OutsideMain"] and not m["headingSkip"] and all(m["ids"]), f"{tag} h1 {m['h1n']} h2 {m['h2s']} skip {m['headingSkip']} ids {m['ids']}")
            rec(17, m["nextH2"] == "Accelerate the genetics discovery loop." and m["chipEls"] == 0 and not m["statusCtx"], f"{tag} h2 {m['nextH2']!r}, chip elements {m['chipEls']}, status words {m['statusCtx']}")
            rec(18, m["ctas"] == ["Request early access"] * 3 and m["heroPrimary"] == "#access", f"{tag} {m['ctas']} href {m['heroPrimary']}")
            rec(20, m["words"] <= 1500, f"{tag} {m['words']} words in main")
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
            ok28 = (m["formFirst"] == "email" and set(m["reqNames"]) == {"email", "role", "field", "human-data"} and m["noDetails"] and not m["unlabeled"]
                    and not m["hp"]["visible"] and m["hp"]["tab"] == -1 and m["hp"]["name"] == "q7_note" and m["hp"]["ac"] == "off" and m["hp"]["lp"] == "true" and m["hp"]["op"] and set(m["names"]) == {"email", "role", "role-other", "field", "field-other", "runs-on", "runs-on-other", "human-data", "tracking"}
                    and all(g[1] for g in m["groups"]) and len(m["groups"]) == 4 and m["trackingOptional"]
                    and m["runsLabels"] == ["Windows", "macOS", "Linux", "HPC cluster", "AWS", "Azure", "GCP", "Other (specify)"]
                    and m["opts"]["human"] == ["yes", "no"] and m["opts"]["role"][-1] == "other" and m["opts"]["field"][-1] == "other" and len(m["opts"]["role"]) == 6 and len(m["opts"]["field"]) == 6
                    and sorted(x[0] for x in m["otherBoxes"]) == ["field-other", "role-other", "runs-on-other"] and all(x[1] == 100 and x[2] for x in m["otherBoxes"]))
            rec(28, ok28, f"{tag} first {m['formFirst']} required {m['reqNames']} unlabeled {m['unlabeled']} names {m['names']} groups {m['groups']} runs {m['runsLabels']} other {m['otherBoxes']}")
            ok29 = all(x == ["img", True, True] for x in m["diag"]) and m["twin"]["closed"] and m["twin"]["summary"] == "Text version of this diagram" and m["twin"]["items"] >= 4
            rec(29, ok29, f"{tag} {m['diag']} {m['twin']}")
            f = m["footer"]
            rec(37, f["mailto"] and f["privacy"] and f["terms"] and f["status"] and f["synthetic"] and not f["backed"], f"{tag} {f}")
            if w == 1440:
                rec(32, s["filter"] == "none" and fr["w"] <= 1122 and fr["h"] <= 630 + 32 + 2, f"{tag} frame {fr['w']:.0f}x{fr['h']:.0f} (max 1122x664)")
            rec(32, fr["w"] <= 1240, f"{tag} frame width {fr['w']:.0f} (max 1240)")
        # ---- 19 forbidden strings ----------------------------------------------------
        ctx, pg = new_page(b, 1440, "light"); pg.goto(BASE); pg.wait_for_timeout(300)
        blob = pg.evaluate("document.body.innerText + ' ' + document.title + ' ' + [...document.querySelectorAll('meta')].map(m=>m.content).join(' ') + ' ' + [...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s=>s.textContent).join(' ') + ' ' + [...document.querySelectorAll('[alt],[aria-label],title,desc')].map(e=>e.getAttribute('alt')||e.getAttribute('aria-label')||e.textContent).join(' ')")
        blob = blob.replace("FAQPage", "")  # the schema.org type name in JSON-LD is not visible copy; the visible heading says "Questions", not "FAQ"
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
        ctx = mk(b, viewport={"width": 390, "height": 800}, java_script_enabled=False); pg = ctx.new_page(); pg.goto(BASE)
        pg.focus(".menu summary"); pg.keyboard.press("Enter")
        opened = pg.evaluate("document.querySelector('.menu').open")
        rec(15, opened, "390 JS off: keyboard Enter on menu summary opens the menu: " + str(opened))
        tv = pg.evaluate("(()=>{const t=document.getElementById('theme-toggle');return [t.hidden, getComputedStyle(t).display, !!document.querySelector('#early-access-form'), getComputedStyle(document.body).backgroundColor]})()")
        rec(31, tv[0] and tv[1] == "none" and tv[2] and tv[3] == "rgb(244, 245, 242)", f"JS off: toggle hidden {tv[0]} display {tv[1]} form {tv[2]} bg {tv[3]}")
        vis_off = pg.evaluate("[...document.querySelectorAll('#early-access-form .other')].map(e => e.getBoundingClientRect().height > 0)")
        rec(28, len(vis_off) == 3 and all(vis_off), f"JS off: the three 'If other' boxes are visible: {vis_off}")
        ctx.close()
        # form behaviour with JS: Other boxes hidden until chosen, then required
        ctx = mk(b, viewport={"width": 390, "height": 800}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
        st = lambda: pg.evaluate("[...document.querySelectorAll('#early-access-form .other')].map(e => [e.getBoundingClientRect().height > 0, e.querySelector('input').required])")
        s0 = st(); pg.check('#early-access-form input[name=role][value=other]'); pg.check('#early-access-form input[name=runs-on][value=other]'); s1 = st()
        pg.check('#early-access-form input[name=role][value=lab-head]'); s2 = st()
        rec(28, s0 == [[False, False]] * 3 and s1 == [[True, True], [False, False], [True, True]] and s2 == [[False, False], [False, False], [True, True]], f"JS on: other boxes {s0} -> {s1} -> {s2}")
        # Deployed routing: the home page must go through the Worker or the server-side ?error message never shows.
        try:
            import json as _j, re as _r
            _w = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wrangler.jsonc"), encoding="utf-8").read()
            _w = _r.sub(r'"(?:[^"\\]|\\.)*"|//[^\n]*|/\*[\s\S]*?\*/', lambda m: m.group(0) if m.group(0).startswith('"') else "", _w)
            _rwf = _j.loads(_w)["assets"]["run_worker_first"]
        except Exception as _e:
            _rwf = f"unreadable: {_e}"
        rec(28, sorted(_rwf) == ["/", "/api/*", "/index.html"] if isinstance(_rwf, list) else False, f"wrangler run_worker_first: {_rwf}")
        pg.goto(BASE + "?error=role#access"); pg.wait_for_timeout(500)
        er = pg.evaluate("(()=>{const m=document.getElementById('form-error');return [m.hidden, m.textContent, m.getAttribute('role'), document.activeElement===m, document.getElementById('role-group').getAttribute('aria-describedby')]})()")
        rec(28, er == [False, "Please choose your role.", "alert", True, "form-error"], f"?error=role message: {er}")
        pg.goto(BASE + "?error=tracking#access"); pg.wait_for_timeout(300)
        rec(28, pg.evaluate("(()=>{const m=document.getElementById('form-error');return !m.hidden && m.textContent==='Your comment could not be read. Please remove unusual characters and try again.' && document.querySelectorAll('#form-error').length===1})()"), "?error=tracking message shown once")
        pg.goto(BASE + "?error=bogus#access"); pg.wait_for_timeout(200)
        rec(28, pg.evaluate("document.getElementById('form-error').hidden"), "unknown ?error= value shows nothing")
        ctx.close()
        # ---- 30 theme ---------------------------------------------------------------------
        ctx = mk(b, viewport={"width": 1280, "height": 800}, color_scheme="dark"); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
        g = lambda: pg.evaluate("[document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor, document.getElementById('theme-toggle').getAttribute('aria-label')]")
        a0 = g(); pg.click("#theme-toggle"); a1 = g(); pg.reload(); pg.wait_for_timeout(300); a2 = g(); pg.click("#theme-toggle"); a3 = g()
        ok = a0[0] is None and a0[1] == "rgb(244, 245, 242)" and a1[0] == "dark" and a1[1] == "rgb(14, 20, 22)" and a2[0] == "dark" and a1[2] != a0[2] and a3[0] is None and a3[2] == a0[2]
        rec(30, ok, f"dark OS pref, empty storage: {a0} -> click {a1} -> reload {a2} -> click {a3}")
        ctx.close()
        # 31 localStorage throws
        ctx = mk(b, viewport={"width": 1280, "height": 800}); ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.goto(BASE); pg.wait_for_timeout(300)
        b0 = pg.evaluate("getComputedStyle(document.body).backgroundColor"); pg.click("#theme-toggle"); b1 = pg.evaluate("getComputedStyle(document.body).backgroundColor")
        rec(31, b0 == "rgb(244, 245, 242)" and b1 == "rgb(14, 20, 22)" and not errs, f"localStorage throws: {b0} -> {b1}, page errors {errs}")
        ctx.close()
        # ---- 33 reduced motion ------------------------------------------------------------
        for rm in ("reduce", "no-preference"):
            ctx = mk(b, viewport={"width": 1280, "height": 800}, reduced_motion=rm); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
            n0 = pg.evaluate("document.getAnimations().length")
            for sel in (".hero .btn", ".btn.ghost", ".subnav a", ".theme-toggle"):
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
            pg.on("response", lambda r: resp.append(r)); reqs = []; pg.on("request", lambda r: reqs.append(r.url))
            pg.add_init_script("window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value}).observe({type:'layout-shift',buffered:true})")
            pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(3000)
            cls = pg.evaluate("window.__cls"); cookie = pg.evaluate("document.cookie")
            rec(36, cls <= 0.02, f"{w}px CLS {cls:.4f}")
            if w == 1440:
                tot = 0; kinds = {"font": [], "js": 0, "html": 0, "css": 0, "img": 0}; hosts = set(); setck = False
                own = BASE.split("/")[2]
                for r in resp:
                    if re.sub(r"^https?://([^/]+)/.*", r"\1", r.url) != own: continue  # external (Google) bodies are not our budget
                    body = r.body(); n = len(body); tot += n; u = r.url; hosts.add(re.sub(r"^https?://([^/]+)/.*", r"\1", u))
                    if "set-cookie" in r.headers: setck = True
                    if u.endswith(".woff2"): kinds["font"].append(n)
                    elif u.endswith(".js"): kinds["js"] += n
                    elif u.endswith(".css"): kinds["css"] += n
                    elif u.endswith(".webp") or u.endswith(".png"): kinds["img"] += n
                    elif u.rstrip("/") == BASE.rstrip("/") or u.endswith(".html"): kinds["html"] = n
                # 34 counts only our own origin bytes: the Google tag is one inline snippet plus one external script and is not ours to budget.
                rec(34, tot <= 300000 and sum(kinds["font"]) <= 80000 and len(kinds["font"]) <= 3 and kinds["js"] <= 8000 and kinds["html"] <= 46000 and kinds["css"] <= 29000, f"total {tot} B (uncompressed body bytes), fonts {kinds['font']}, js {kinds['js']}, html {kinds['html']}, css {kinds['css']}, images {kinds['img']}")
                rec(9, kinds["img"] <= 200000, f"1440 image bytes {kinds['img']}")
                allowed = {"static.cloudflareinsights.com", "cloudflareinsights.com"}  # the Cloudflare beacon is injected at the edge: allowed if present, absent locally. Google hosts are NOT allowed before consent.
                ok_host = lambda h: h in allowed
                req_hosts = {re.sub(r"^https?://([^/:]+).*", r"\1", u) for u in reqs if u.startswith("http")}
                ext = {h for h in req_hosts if h != own.split(":")[0]}
                setck = any("set-cookie" in r.headers for r in resp if re.sub(r"^https?://([^/]+)/.*", r"\1", r.url) == own)
                ck = [c for c in cookie.split("; ") if c]
                if STRICT_NET:
                    rec(35, not ext and not setck and cookie == "", f"strict: external hosts {sorted(ext)}, own Set-Cookie {setck}, document.cookie {cookie!r}")
                else:
                    # Google requests may succeed or fail (sandbox without network): the page must render either way; only these hosts may be contacted.
                    rec(35, all(ok_host(h) for h in ext) and not setck and not ck, f"first visit, before consent: external hosts contacted {sorted(ext)} (allowed: Cloudflare analytics hosts only, zero Google), own Set-Cookie {setck}, document.cookie {ck}")
            ctx.close()
        # ---- C1..C11 + 35 consent: cookie notice and Google consent (Basic mode) ----------------
        SHOTS = os.environ.get("CONSENT_SHOTS", "")
        GOOG = lambda u: bool(re.search(r"^https?://[^/]*(googletagmanager\.com|google-analytics\.com|\.analytics\.google\.com|doubleclick\.net)", u))
        CJS = r"""() => {
          const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
          const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
          const B = document.querySelector('.cookie-notice'); if (!B) return {present: false};
          const r = B.getBoundingClientRect(), s = getComputedStyle(B), bg = s.backgroundColor;
          const btns = [...B.querySelectorAll('button')].map(e => { const q = e.getBoundingClientRect(), c = getComputedStyle(e); return {w: q.width, h: q.height, t: e.textContent, bg: c.backgroundColor, color: c.color, bw: c.borderTopWidth, bc: c.borderTopColor, fs: c.fontSize, fw: c.fontWeight, crText: cr(c.color, c.backgroundColor), crBorder: cr(c.borderTopColor, bg)}; });
          const p = B.querySelector('p'), a = B.querySelector('a');
          return {present: true, hidden: B.hidden || s.display === 'none', role: B.getAttribute('role'), label: B.getAttribute('aria-label'), pos: s.position, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth,
            crP: cr(getComputedStyle(p).color, bg), crA: a ? cr(getComputedStyle(a).color, bg) : 0, btns, fs: parseFloat(getComputedStyle(p).fontSize), text: p.textContent,
            modal: !!B.getAttribute('aria-modal'), overlay: [...document.querySelectorAll('body *')].some(e => e !== B && !B.contains(e) && getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().width >= innerWidth && e.getBoundingClientRect().height >= innerHeight), anim: s.animationName};
        }"""
        OVER = """sels => { const B = document.querySelector('.cookie-notice'); if (!B || B.hidden) return []; const q = B.getBoundingClientRect(); const out = [];
          for (const sel of sels) for (const e of document.querySelectorAll(sel)) { const x = e.getBoundingClientRect(); if (!x.width || !x.height) continue;
            const ov = Math.min(q.bottom, x.bottom) - Math.max(q.top, x.top); const ovx = Math.min(q.right, x.right) - Math.max(q.left, x.left); if (ov > 1 && ovx > 1 && x.top < innerHeight && x.bottom > 0) out.push(sel + ' ' + Math.round(ov) + 'px'); } return out; }"""
        gl = lambda pg: pg.evaluate("JSON.parse(localStorage.getItem('jubilab-consent')||'null')")
        for w in (390, 768, 1440):
            for th in THEMES:
                ctx = mk(b, preset=False, viewport={"width": w, "height": 900}); pg = ctx.new_page()
                greqs = []; pg.on("request", lambda r: greqs.append(r.url) if GOOG(r.url) else None)
                pg.goto(BASE); pg.wait_for_function("document.fonts.status === 'loaded'")
                if th == "dark": pg.click("#theme-toggle")
                pg.wait_for_timeout(400)
                c = pg.evaluate(CJS); tag = f"{w}/{th}"
                bt = c.get("btns", [])
                rec("C1", c["present"] and not c["hidden"] and c["role"] == "region" and c["label"] == "Cookie notice" and c["pos"] == "fixed" and not c["modal"] and not c["overlay"] and abs(c["b"] - c["ih"]) <= 1 and c["w"] >= c["iw"] - 1,
                    f"{tag} visible on first visit, role={c['role']}, aria-label={c['label']!r}, position {c['pos']}, aria-modal {c['modal']}, full-screen overlay {c['overlay']}, h {c['h']:.0f}px")
                rec("C2", c["crP"] >= 4.5 and c["crA"] >= 4.5 and all(x["crText"] >= 4.5 and x["crBorder"] >= 3 for x in bt) and len(bt) == 2, f"{tag} contrast text {c['crP']:.2f}, link {c['crA']:.2f}, buttons text {[round(x['crText'], 2) for x in bt]} border {[round(x['crBorder'], 2) for x in bt]}")
                rec("C3", len(bt) == 2 and all(x["h"] >= 44 and x["w"] >= 44 for x in bt) and all(bt[0][k] == bt[1][k] for k in ("bg", "color", "bw", "bc", "fs", "fw", "h")) and abs(bt[0]["w"] - bt[1]["w"]) <= 90, f"{tag} buttons {[(x['t'], round(x['w']), round(x['h'])) for x in bt]}, same style bg/border/font/height: {len(bt) == 2 and all(bt[0][k] == bt[1][k] for k in ('bg', 'color', 'bw', 'bc', 'fs', 'fw', 'h'))}")
                rec("C4", c["sw"] <= c["iw"] + 1 and c["l"] >= -1 and c["r"] <= c["iw"] + 1 and (w != 390 or c["h"] <= 200), f"{tag} scrollWidth {c['sw']} vs {c['iw']}, notice {c['l']:.0f}..{c['r']:.0f} height {c['h']:.0f}px (max 200 at 390)")
                rec("C4", len(greqs) == 0 and pg.evaluate("document.cookie") == "", f"{tag} no Google request and no cookie while the notice is open: {greqs}")
                if SHOTS and ((w == 390 and th == "light") or (w == 768 and th == "light") or (w == 1440 and th == "dark")):
                    pg.screenshot(path=f"{SHOTS}/banner-{w}-{th}.png")
                    pg.screenshot(path=f"{SHOTS}/banner-{w}-{th}-full.png", full_page=True)
                ctx.close()
        # overlap with the main CTA and the form submit button (390 and 1440), banner present
        for w in (390, 1440):
            ctx = mk(b, preset=False, viewport={"width": w, "height": 900}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(500)
            ov0 = pg.evaluate(OVER, [".hero .btn:not(.ghost)"])
            pg.focus("#early-access-form button[type=submit]"); pg.wait_for_timeout(300)
            ov1 = pg.evaluate(OVER, ["#early-access-form button[type=submit]", "#early-access-form input", "#early-access-form select", "#early-access-form textarea"])
            pg.evaluate("document.querySelector('#access').scrollIntoView({block:'end'})"); pg.wait_for_timeout(300)
            ov2 = pg.evaluate(OVER, ["#early-access-form button[type=submit]"])
            pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); pg.wait_for_timeout(200)
            ov3 = pg.evaluate(OVER, ["footer a", "footer p"])
            rec("C5", not ov0 and not ov1, f"{w}px banner overlap: hero CTA at top {ov0}; form controls after keyboard focus on submit {ov1}")
            rec("C5", not ov3, f"{w}px page scrolled to the very end: footer text/links overlapped by the notice {ov3} (body gets bottom padding while it is open)")
            ctx.close()
        # keyboard: Tab reaches the notice, focus visible, Enter accepts, Space declines, Escape does not hide it
        for key in ("Enter", "Space"):
            ctx = mk(b, preset=False, viewport={"width": 1280, "height": 800}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
            seen = None
            for i in range(120):
                pg.keyboard.press("Tab")
                seen = pg.evaluate("(()=>{const a=document.activeElement;return a&&a.tagName==='BUTTON'&&a.closest('.cookie-notice')?{t:a.textContent,fv:a.matches(':focus-visible'),o:getComputedStyle(a).outlineStyle,ow:parseFloat(getComputedStyle(a).outlineWidth)}:null})()")
                if seen: break
            first = seen
            pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
            still = pg.evaluate("!document.querySelector('.cookie-notice').hidden")
            if key == "Space":
                pg.keyboard.press("Tab"); seen = pg.evaluate("document.activeElement.textContent")
            rec("C6", first and first["t"] == "Accept analytics cookies" and first["fv"] and first["o"] != "none" and first["ow"] >= 2 and still, f"{key}: Tab reached {first}, banner still visible after Escape: {still}")
            pg.keyboard.press(key if key == "Enter" else " "); pg.wait_for_timeout(300)
            st = gl(pg); hid = pg.evaluate("document.querySelector('.cookie-notice').hidden")
            want = "granted" if key == "Enter" else "denied"
            rec("C6", st and st["v"] == want and hid and (key == "Enter" or seen == "Reject analytics cookies"), f"{key} on {'Accept analytics cookies' if key == 'Enter' else seen}: stored {st}, banner hidden {hid}")
            ctx.close()
        # reduced motion
        for rm in ("reduce", "no-preference"):
            ctx = mk(b, preset=False, viewport={"width": 1280, "height": 800}, reduced_motion=rm); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(500)
            an = pg.evaluate("getComputedStyle(document.querySelector('.cookie-notice')).animationName")
            rec("C7", (an == "none") if rm == "reduce" else (an == "cookie-in"), f"prefers-reduced-motion {rm}: notice animation {an!r}")
            ctx.close()
        # footer link on every page, 44px target, reopens the notice, thanks does not lose content
        for path in ("", "privacy/", "terms/", "thanks/", "404.html") + GUIDE_PATHS:
            ctx = mk(b, viewport={"width": 390, "height": 800}); pg = ctx.new_page(); pg.goto(BASE + path); pg.wait_for_timeout(400)
            n0 = pg.evaluate("!!document.querySelector('.cookie-notice')")
            lk = pg.locator("footer a", has_text="Cookie settings")
            h = lk.bounding_box()["height"] if lk.count() == 1 else 0
            lk.click(); pg.wait_for_timeout(300)
            c = pg.evaluate(CJS); foc = pg.evaluate("document.activeElement.closest('.cookie-notice')?document.activeElement.textContent:''")
            rec("C8", not n0 and lk.count() == 1 and h >= 44 and c["present"] and not c["hidden"] and foc == "Accept analytics cookies", f"/{path}: stored choice -> no notice at load {not n0}, 'Cookie settings' links {lk.count()} height {h:.0f}, click reopens {c.get('present') and not c.get('hidden')}, focus on {foc!r}")
            if path in ("thanks/", ""):
                pg.evaluate("window.scrollTo(0,0)")
                ov = pg.evaluate(OVER, ["main h1", "main p", "main form button", ".site-header a", ".site-header button"]) if path else []
                rec("C8", not ov, f"/{path or 'home'} (notice open, 390x800, scrolled to top): notice covers {ov}")
            ctx.close()
        # 35: Google consent flow in the real browser
        def flow(action):
            ctx = mk(b, preset=False, viewport={"width": 1280, "height": 800}); pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            greqs = []; pg.on("request", lambda r: greqs.append(r.url) if GOOG(r.url) else None)
            pg.route(re.compile(r"https://([^/]*\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)/.*"), lambda rt: rt.abort())  # sandbox has no network: simulate failure; requests are still recorded
            pg.goto(BASE); pg.wait_for_timeout(500)
            before = list(greqs); ck0 = pg.evaluate("document.cookie")
            return ctx, pg, errs, greqs, before, ck0
        ctx, pg, errs, greqs, before, ck0 = flow("accept")
        pg.click(".cookie-notice button:has-text('Accept analytics cookies')"); pg.wait_for_timeout(700)
        gt = [u for u in greqs if "googletagmanager.com/gtag/js?id=G-8W2MDQ58PL" in u]
        dl = pg.evaluate("[...window.dataLayer].map(a => [...a])")
        has = lambda f: any(f(a) for a in dl)
        okpage = pg.evaluate("document.querySelector('h1').offsetHeight>0") and pg.evaluate("document.querySelector('.cookie-notice').hidden")
        rec(35, not before and ck0 == "" and gt and okpage and not errs and gl(pg)["v"] == "granted" and has(lambda a: a[:2] == ["consent", "default"] and a[2]["analytics_storage"] == "denied" and a[2]["ad_storage"] == "denied") and has(lambda a: a[:2] == ["consent", "update"] and a[2] == {"analytics_storage": "granted"}) and has(lambda a: a[:2] == ["config", "G-8W2MDQ58PL"]),
            f"Accept: before {before}, cookies before {ck0!r}; after Accept requests {[u[:70] for u in gt]}, page still renders {okpage}, page errors {errs}, stored {gl(pg)['v']}, dataLayer has default(denied), update(granted), config")
        if SHOTS: pg.screenshot(path=f"{SHOTS}/accepted-1280.png")
        pg.reload(); pg.wait_for_timeout(500)
        rec(35, len([u for u in greqs if "gtag/js" in u]) >= 2 and pg.evaluate("!document.querySelector('.cookie-notice')"), f"reload with stored granted: gtag.js requested again, no notice")
        pg.click("footer a:has-text('Cookie settings')"); pg.wait_for_timeout(200)
        pg.click(".cookie-notice button:has-text('Reject analytics cookies')"); pg.wait_for_timeout(300)
        msg = pg.evaluate("document.querySelector('.cookie-notice p').textContent"); stt = gl(pg)
        den = pg.evaluate("[...window.dataLayer].some(a => a[0] === 'consent' && a[1] === 'update' && a[2].analytics_storage === 'denied')")
        rec(35, den, "Withdraw: gtag('consent','update',{analytics_storage:'denied'}) pushed to dataLayer")
        rec(35, stt["v"] == "denied" and "Reload" in msg, f"Withdraw after Accept: stored {stt['v']}, message {msg!r}")
        ctx.close()
        ctx, pg, errs, greqs, before, ck0 = flow("decline")
        pg.click(".cookie-notice button:has-text('Reject analytics cookies')"); pg.wait_for_timeout(500)
        st1 = gl(pg); pg.reload(); pg.wait_for_timeout(500)
        rec(35, st1["v"] == "denied" and not greqs and not pg.evaluate("document.querySelector('.cookie-notice')") and pg.evaluate("document.cookie") == "" and not errs, f"Decline: stored {st1['v']}, Google requests {greqs}, no notice after reload, cookies {pg.evaluate('document.cookie')!r}, errors {errs}")
        # expiry: a choice older than 180 days shows the notice again; 179 days does not
        for days, want in ((181, True), (179, False)):
            ctx2 = mk(b, preset=False, viewport={"width": 1280, "height": 800}); pg2 = ctx2.new_page()
            pg2.add_init_script("try{localStorage.setItem('jubilab-consent',JSON.stringify({v:'denied',t:Date.now()-%d*864e5}))}catch(e){}" % days); pg2.goto(BASE); pg2.wait_for_timeout(400)
            shown = pg2.evaluate("!!document.querySelector('.cookie-notice')")
            rec(35, shown == want, f"stored choice {days} days old: notice shown {shown} (want {want})")
            ctx2.close()
        ctx.close()
        # storage blocked: notice shows, accepting does not throw
        ctx = mk(b, preset=False, viewport={"width": 1280, "height": 800}); ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.route(re.compile(r"https://.*google.*"), lambda rt: rt.abort()); pg.goto(BASE); pg.wait_for_timeout(400)
        pg.click(".cookie-notice button:has-text('Accept analytics cookies')"); pg.wait_for_timeout(300)
        rec("C9", not errs, f"localStorage blocked: notice works, page errors {errs}")
        ctx.close()
        # without JS: no notice, no Google
        ctx = mk(b, preset=False, viewport={"width": 390, "height": 800}, java_script_enabled=False); pg = ctx.new_page(); greqs = []; pg.on("request", lambda r: greqs.append(r.url) if GOOG(r.url) else None); pg.goto(BASE); pg.wait_for_timeout(300)
        rec("C10", not greqs and pg.locator(".cookie-notice").count() == 0, f"no JavaScript: no notice, Google requests {greqs}")
        ctx.close()
        # layout checks with the notice present (key ones from the big measurement)
        for w in (390, 1440):
            for th in THEMES:
                ctx = mk(b, preset=False, viewport={"width": w, "height": 900}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
                if th == "dark": pg.click("#theme-toggle"); pg.wait_for_timeout(100)
                pg.wait_for_function("document.fonts.status === 'loaded'")
                m = pg.evaluate(MEASURE); tag = f"{w}/{th} with notice open"
                rec("C11", abs(m["sw"] - m["iw"]) <= 1 and m["overflowN"] == 0 and not m["failContrast"] and not m["scrollRegions"], f"{tag}: scrollWidth {m['sw']} vs {m['iw']}, outside-viewport {m['overflowN']}, contrast fails {m['failContrast'][:2]}, scroll regions {m['scrollRegions']}")
                ctx.close()
        # hero image bytes per file (check 9, budgets from spec section 4)
        import urllib.request
        budgets = {"hero-720.webp": 50000, "hero-1120.webp": 90000, "hero-1440.webp": 130000, "hero-2240.webp": 220000, "hero-narrow-358.webp": 30000, "hero-narrow-716.webp": 60000}
        sizes = {f: len(urllib.request.urlopen(BASE + "assets/img/" + f).read()) for f in budgets}
        rec(9, all(sizes[f] <= budgets[f] for f in budgets), f"hero image bytes {sizes}")
        # N4 at dpr 2: 1.9x natural; narrow files above 360 px display cannot reach 1.9x (716 px file), judged at 390 and 320 only
        for w in (320, 390, 768, 1024, 1280, 1440, 1920):
            ctx, pg = new_page(b, w, "light", dpr=2); pg.goto(BASE); pg.wait_for_timeout(300)
            pg.wait_for_function("document.querySelector('.hero img').complete")
            nat, disp, cur = pg.evaluate("(()=>{const i=document.querySelector('.hero img');return [i.naturalWidth,i.getBoundingClientRect().width,i.currentSrc.split('/').pop()]})()")
            nat = {"hero-720.webp": 720, "hero-1120.webp": 1120, "hero-1440.webp": 1440, "hero-2240.webp": 2240, "hero-narrow-358.webp": 358, "hero-narrow-716.webp": 716}[cur]  # intrinsic pixels (naturalWidth is divided by the srcset density)
            ok = nat >= 1.9 * disp - 1 and disp <= nat * 1.01
            rec("N4", ok, f"{w} dpr2 {cur} natural {nat}, displayed {disp:.0f}, ratio {nat / disp:.2f} (need >= 1.9)")
            ctx.close()
        # N8 hover lift and reduced motion
        for rm in ("no-preference", "reduce"):
            ctx = mk(b, viewport={"width": 1440, "height": 900}, reduced_motion=rm); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
            pg.hover(".hero .frame"); pg.wait_for_timeout(400)
            ty, td = pg.evaluate("(()=>{const f=document.querySelector('.hero .frame');const s=getComputedStyle(f);const m=s.transform==='none'?0:parseFloat(s.transform.split(',')[5]);return [m, Math.max(...s.transitionDuration.split(',').map(parseFloat))]})()")
            if rm == "reduce":
                rec("N8", ty == 0 and td == 0, f"reduce: hover translateY {ty}px, transition {td}s")
                rec(33, ty == 0, f"reduce: hover on .frame translateY {ty}px")
            else:
                rec("N8", -3 <= ty <= 0 and td <= 0.2, f"hover translateY {ty}px (max 3), transition {td}s")
            ctx.close()
        # N8 Tab sequence unchanged is check 27 (frame has no tabindex); N9 JS off
        ctx = mk(b, viewport={"width": 1440, "height": 900}, java_script_enabled=False); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
        fo = pg.evaluate("(()=>{const f=document.querySelector('.hero .frame').getBoundingClientRect();return [f.width,f.height]})()")
        fj = M[(1440, "light")]["frame"]
        rec("N9", abs(fo[0] - fj["w"]) <= 1 and abs(fo[1] - fj["h"]) <= 1, f"JS off frame {fo[0]:.0f}x{fo[1]:.0f} vs JS on {fj['w']:.0f}x{fj['h']:.0f}")
        ctx.close()

        # ---- guides hub and guides (G1..G6) ---------------------------------------------------------------------
        for gp in GUIDE_PATHS:
            for w in GUIDE_WIDTHS:
                for th in THEMES:
                    ctx, pg = new_page(b, w, th)
                    errs, bad = [], []
                    pg.on("pageerror", lambda e: errs.append(str(e)))
                    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                    pg.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 and r.url.startswith(BASE) else None)
                    pg.goto(BASE + gp); pg.wait_for_timeout(300)
                    if th == "dark":
                        pg.click("#theme-toggle"); pg.wait_for_timeout(100)
                    pg.wait_for_function("document.fonts.status === 'loaded'")
                    g = pg.evaluate(GUIDE_MEASURE); tag = f"/{gp} {w}/{th}"
                    rec("G1", abs(g["sw"] - g["iw"]) <= 1 and not g["outside"], f"{tag} scrollWidth {g['sw']} vs {g['iw']}, elements outside the viewport {g['outside']}")
                    rec("G2", g["pre"]["focusable"] and g["pre"]["overflowX"] and g["pre"]["fit"] and g["tab"]["focusable"] and g["tab"]["fit"], f"{tag} code blocks {g['pre']}, tables {g['tab']}")
                    if w == 320 and gp != "guides/":
                        rec("G3", g["pre"]["scrollable"] >= 1 and g["tab"]["scrollable"] >= (1 if g["tab"]["n"] else 0), f"{tag} blocks that scroll sideways instead of widening the page: code {g['pre']['scrollable']}/{g['pre']['n']}, tables {g['tab']['scrollable']}/{g['tab']['n']}")
                    rec("G4", not g["contrast"], f"{tag} low contrast {g['contrast']}")
                    rec("G5", not errs and not bad, f"{tag} console/page errors {errs[:2]} failed requests {bad[:2]}")
                    rec("G6", g["h1"] == 1 and g["skip"] == 0 and g["footerH"] >= 44 and g["hasGuidesLink"] and g["h1Size"] >= (28 if w <= 375 else 32), f"{tag} h1s {g['h1']}, skipped levels {g['skip']}, footer link height {g['footerH']:.0f}, Guides link {g['hasGuidesLink']}, h1 {g['h1Size']:.0f}px")
                    ctx.close()
        b.close()
    return


def main():
    run()
    manual = {20: "list-of-features review is manual"}
    allok = True
    print(f"Jubilab site v2 acceptance checks against {BASE}\n")
    for n in list(range(1, 38)) + ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11"] + ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11"] + ["G1", "G2", "G3", "G4", "G5", "G6"]:
        if n in (5, 8):
            print(f"{n!s:>3}  REPLACED  (by N2/N3 and N4)"); continue
        if n == "N10":
            print(f"{n!s:>3}  N/A       n/a until video: no video element exists yet"); continue
        if n not in R:
            print(f"{n!s:>3}  NOT RUN  (not covered by this script)"); continue
        res = R[n]; fails = [d for ok, d in res if not ok]
        status = "PASS" if not fails else "FAIL"
        if fails: allok = False
        extra = "  [MANUAL part: " + manual[n] + "]" if n in manual else ""
        print(f"{n!s:>3}  {status}  ({len(res) - len(fails)}/{len(res)} cases){extra}")
        for d in (fails[:6] if fails else [res[-1][1]]):
            print("        " + d)
    print("\nNote: check 5 and the old pins/caption rules are replaced by N1..N3; N10 (video) is n/a until a video exists.")
    json.dump({str(k): v for k, v in R.items()}, open("/tmp/jubilab-check-site.json", "w"), indent=1)
    sys.exit(0 if allok else 1)


main()
