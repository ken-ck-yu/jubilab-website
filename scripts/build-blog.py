#!/usr/bin/env python3
"""Static blog generator (Python 3 standard library only). Docs: docs/blog-authoring.md

  python3 scripts/build-blog.py            build: write blog/<slug>/, blog/index.html, and the blog blocks of sitemap.xml and llms.txt
  python3 scripts/build-blog.py --check    build in memory and fail if anything on disk differs (used by tests and CI)
  python3 scripts/build-blog.py --lint     validate every source only, write nothing
  --allow-missing-og                       authoring only: a post without og.png falls back to the site-wide Open Graph image

Sources: blog/_src/<slug>/post.md (front matter + restricted Markdown), image.svg (text-free illustration), og.png (1200x630,
made from image.svg by scripts/render-og.py). Output is deterministic (no clock, no randomness, sorted) and everything is escaped.
Anything outside the allowed subset is an error, so authors cannot inject HTML or scripts.
"""
import argparse, datetime, html, json, math, os, re, sys, xml.etree.ElementTree as ET

ROOT = os.environ.get("JUBILAB_SITE_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the override is for tests
ORIGIN = "https://jubilab.io"
SRC = "blog/_src"
DEFAULT_OG = ORIGIN + "/assets/og/jubilab-og.png"
DEFAULT_OG_ALT = "Jubilab: power lab operations, from sample order to result. An order moves from sample submission through received, QC and run to delivered, with an agent reading each step. Marked: early access by invitation, nothing released yet."
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
KEYS = ["title", "description", "slug", "date", "updated", "tags", "summary", "image_alt"]
OPTIONAL = ["reading_time"]
QUESTIONS_H = "Questions we are still asking"
SOURCES_H = "Sources"
WORDS_MIN, WORDS_MAX, SOURCES_MIN = 900, 1400, 3
PALETTE = {"#f4f5f2", "#17201c", "#e8520a", "#fbe9dc", "#e6efe9", "#e8ebf3", "#f3ead6", "#2f6f62", "#ffffff", "#fff", "none"}
SVG_TAGS = {"svg", "g", "rect", "circle", "ellipse", "path", "line", "polyline", "polygon", "defs", "clipPath"}
# Words that stay out of post content until legal review (owner rule), and claim words the site never uses (as in the guides).
LEGAL_BANNED = [r"audit trails?", r"\bregulated\b", r"\bcompliance\b", r"\bcompliant\b", r"\bgxp\b", r"\bvalidated\b", r"\bfda\b", r"21\s*cfr", r"\bhipaa\b", r"\bgdpr\b"]
CLAIM_BANNED = [r"\bfastest\b", r"\bthe only\b", r"\bthe first\b", r"\bfirst and only\b", r"\bthe best\b", r"\bbest[- ]in[- ]class\b", r"\breproducible results\b", r"\bguarantee", r"\bstudies show\b", r"\bbetter than\b", r"\bbeats\b", r"\boutperform"]
BANNED_RE = re.compile("|".join(LEGAL_BANNED + CLAIM_BANNED), re.I)
TRACKING = re.compile(r"[?&](utm_[a-z]+|fbclid|gclid|mc_eid|ref|ref_src)=", re.I)


class BuildError(Exception):
    pass


def fail(slug, msg):
    raise BuildError(f"{slug}: {msg}")


esc = lambda s: html.escape(s, quote=True)


def long_date(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d} {MONTHS[m - 1]} {y}"


def valid_date(s):
    try:
        datetime.date.fromisoformat(s)
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", s))
    except ValueError:
        return False


# ---------------------------------------------------------------------------------------------------------------- source files
def split_front_matter(slug, text):
    if not text.startswith("---\n"):
        fail(slug, "post.md must start with a front-matter block: a first line of --- ")
    end = text.find("\n---\n", 4)
    if end < 0:
        fail(slug, "front matter is not closed with a line of ---")
    fm, body = text[4:end], text[end + 5:]
    meta = {}
    for ln, line in enumerate(fm.split("\n"), 2):
        if not line.strip():
            continue
        m = re.fullmatch(r"([a-z_]+): (.+)", line)
        if not m:
            fail(slug, f"front matter line {ln}: expected 'key: value', got {line[:60]!r}")
        k, v = m.group(1), m.group(2).strip()
        if k not in KEYS + OPTIONAL:
            fail(slug, f"front matter line {ln}: unknown key {k!r} (allowed: {', '.join(KEYS + OPTIONAL)})")
        if k in meta:
            fail(slug, f"front matter line {ln}: duplicate key {k!r}")
        if re.search(r"[<>\x00-\x08\x0b-\x1f]", v):
            fail(slug, f"front matter {k}: '<', '>' and control characters are not allowed")
        meta[k] = v
    for k in KEYS:
        if k not in meta:
            fail(slug, f"front matter is missing {k!r}")
    return meta, body, fm.count("\n") + 3


def check_meta(slug, dirname, meta):
    if meta["slug"] != dirname or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", meta["slug"]) or len(meta["slug"]) > 80:
        fail(slug, f"slug {meta['slug']!r} must be lowercase-with-hyphens, at most 80 characters, and equal the folder name {dirname!r}")
    full_title = meta["title"] + " | Jubilab"
    if not 10 <= len(full_title) <= 65:
        fail(slug, f"title + ' | Jubilab' is {len(full_title)} characters; it must be 10 to 65 (so the title itself is at most 55)")
    if not 150 <= len(meta["description"]) <= 160:
        fail(slug, f"description is {len(meta['description'])} characters; it must be 150 to 160")
    if not 40 <= len(meta["summary"]) <= 140:
        fail(slug, f"summary is {len(meta['summary'])} characters; it must be 40 to 140 (one line on the card)")
    if not 30 <= len(meta["image_alt"]) <= 200:
        fail(slug, f"image_alt is {len(meta['image_alt'])} characters; it must be 30 to 200 and describe the picture")
    for k in ("date", "updated"):
        if not valid_date(meta[k]):
            fail(slug, f"{k} must be a real date written YYYY-MM-DD")
    if meta["updated"] < meta["date"]:
        fail(slug, "updated is before date")
    tags = [t.strip() for t in meta["tags"].split(",")]
    if not 1 <= len(tags) <= 4 or len(set(tags)) != len(tags) or not all(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", t) for t in tags):
        fail(slug, "tags: 1 to 4 distinct lowercase-with-hyphens tags, comma separated")
    meta["tag_list"] = tags
    if "reading_time" in meta and not re.fullmatch(r"[1-9][0-9]?", meta["reading_time"]):
        fail(slug, "reading_time, when given, is a whole number of minutes")
    for k in ("title", "description", "summary", "image_alt"):
        m = BANNED_RE.search(meta[k])
        if m:
            fail(slug, f"{k} contains banned wording {m.group(0)!r}")


# ---------------------------------------------------------------------------------------------------------------- inline Markdown
class Ctx:
    def __init__(self, slug, known_paths, n_sources):
        self.slug, self.known, self.n_sources, self.cited = slug, known_paths, n_sources, set()


def check_url(ctx, url, where):
    if re.fullmatch(r"https://[^\s\"'<>`\\]+", url):
        host = url.split("/")[2]
        if "@" in host or not re.fullmatch(r"[a-z0-9.-]+(:\d+)?", host) or "." not in host:
            fail(ctx.slug, f"{where}: unusual host in {url!r}")
        if TRACKING.search(url):
            fail(ctx.slug, f"{where}: tracking parameters are not allowed in {url!r}")
        return "ext"
    if re.fullmatch(r"/[a-z0-9._/#-]*", url):
        p = url.split("#")[0]
        if p not in ctx.known:
            fail(ctx.slug, f"{where}: internal link {url!r} does not resolve to a page of this site")
        return "int"
    fail(ctx.slug, f"{where}: links must be https://... or a site path such as /guides/ (got {url!r})")


INLINE = re.compile(r"""
    (?P<code>`[^`\n]+`)
  | (?P<fn>\[\^(?P<fnn>\d+)\])
  | (?P<link>\[(?P<lt>[^\[\]\n]+)\]\((?P<lu>[^()\s]+)\))
  | (?P<bold>\*\*(?P<bt>[^*\n]+?)\*\*)
  | (?P<ital>\*(?P<it>[^*\s][^*\n]*?)\*)
""", re.X)


def inline(ctx, text, where, in_link=False):
    out, pos = [], 0
    for m in INLINE.finditer(text):
        out.append(plain(ctx, text[pos:m.start()], where))
        pos = m.end()
        if m.group("code"):
            out.append("<code>" + esc(m.group("code")[1:-1]) + "</code>")
        elif m.group("fn"):
            n = int(m.group("fnn"))
            if not 1 <= n <= ctx.n_sources:
                fail(ctx.slug, f"{where}: citation [^{n}] has no matching item {n} in the Sources list")
            ctx.cited.add(n)
            out.append(f'<sup class="cite"><a href="#src-{n}" aria-label="Source {n}">[{n}]</a></sup>')
        elif m.group("link"):
            if in_link:
                fail(ctx.slug, f"{where}: links cannot be nested")
            url, kind = m.group("lu"), check_url(ctx, m.group("lu"), where)
            rel = ' rel="noopener"' if kind == "ext" else ""
            out.append(f'<a href="{esc(url)}"{rel}>' + inline(ctx, m.group("lt"), where, True) + "</a>")
        elif m.group("bold"):
            out.append("<strong>" + inline(ctx, m.group("bt"), where, in_link) + "</strong>")
        else:
            out.append("<em>" + inline(ctx, m.group("it"), where, in_link) + "</em>")
    out.append(plain(ctx, text[pos:], where))
    return "".join(out)


def plain(ctx, s, where):
    for bad, why in (("<", "raw HTML is not allowed ('<')"), (">", "raw HTML is not allowed ('>')"), ("*", "unbalanced or unsupported '*' (use **bold**, *italic*, or '-' for lists)"),
                     ("`", "unbalanced backtick"), ("[", "unsupported '[' (links are [text](https://...); citations are [^1])"), ("]", "unsupported ']'"), ("\\", "backslash escapes are not supported"),
                     ("\t", "tab characters are not allowed")):
        if bad in s:
            fail(ctx.slug, f"{where}: {why}")
    return esc(s)


# ---------------------------------------------------------------------------------------------------------------- blocks
def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-") or "section"


def parse_blocks(slug, body, first_line):
    """Split the body into blocks: (kind, payload, line number)."""
    lines = body.split("\n")
    blocks, i = [], 0
    while i < len(lines):
        ln = first_line + i
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("```"):
            info = line[3:].strip()
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            if j >= len(lines):
                fail(slug, f"line {ln}: code fence is never closed")
            if lines[j].strip() != "```":
                fail(slug, f"line {first_line + j}: the closing fence must be exactly ```")
            blocks.append(("code", (info, lines[i + 1:j]), ln))
            i = j + 1
            continue
        if line.startswith("#"):
            m = re.fullmatch(r"(##|###) (\S.*)", line)
            if not m:
                fail(slug, f"line {ln}: only '## ' and '### ' headings are allowed (the title is the single H1)")
            blocks.append(("h" + str(len(m.group(1))), m.group(2).strip(), ln))
            i += 1
            continue
        # gather a run of lines up to the next blank line
        j = i
        while j < len(lines) and lines[j].strip() and not lines[j].startswith("```") and not lines[j].startswith("#"):
            j += 1
        chunk = lines[i:j]
        first = chunk[0]
        if first.startswith("> "):
            if not all(c.startswith("> ") for c in chunk):
                fail(slug, f"line {ln}: every line of a blockquote must start with '> '")
            blocks.append(("quote", [c[2:] for c in chunk], ln))
        elif first.startswith("- "):
            items = []
            for k, c in enumerate(chunk):
                if c.startswith("- "):
                    items.append(c[2:])
                elif c.startswith("  ") and not re.match(r"\s*([-+*]|\d+\.) ", c):
                    items[-1] += " " + c.strip()
                else:
                    fail(slug, f"line {ln + k}: nested lists and mixed list syntax are not supported")
            blocks.append(("ul", items, ln))
        elif re.match(r"\d+\. ", first):
            items = []
            for k, c in enumerate(chunk):
                m = re.fullmatch(r"(\d+)\. (.*)", c)
                if m:
                    if int(m.group(1)) != len(items) + 1:
                        fail(slug, f"line {ln + k}: ordered list items must be numbered 1, 2, 3, ...")
                    items.append(m.group(2))
                elif c.startswith("   ") and not re.match(r"\s*([-+*]|\d+\.) ", c):
                    items[-1] += " " + c.strip()
                else:
                    fail(slug, f"line {ln + k}: nested lists and mixed list syntax are not supported")
            blocks.append(("ol", items, ln))
        else:
            if re.match(r"(\s{4}|\t|[|!<]|[-+*] |---|\*\*\*|___|={3,}|\[.*\]:)", first) and not first.startswith("**"):
                fail(slug, f"line {ln}: this construct is not supported (tables, images, raw HTML, indented code, rules, '*'/'+' bullets, reference links); got {first[:40]!r}")
            for k, c in enumerate(chunk):
                if c.startswith(("- ", "> ")) or re.match(r"\d+\. ", c):
                    fail(slug, f"line {ln + k}: start lists and quotes after a blank line")
            blocks.append(("p", " ".join(c.strip() for c in chunk), ln))
        i = j
    return blocks


def parse_source_item(slug, text, n):
    m = re.fullmatch(r"\[([^\[\]]+)\]\((https://[^()\s]+)\) \| ([^|]+) \| Accessed: (\d{4}-\d{2}-\d{2})", text)
    if not m or not valid_date(m.group(4)):
        fail(slug, f"Sources item {n}: expected '[Title](https://url) | Publisher | Accessed: YYYY-MM-DD', got {text[:80]!r}")
    title, url, pub, acc = m.group(1), m.group(2), m.group(3).strip(), m.group(4)
    ctx = Ctx(slug, set(), 0)
    check_url(ctx, url, f"Sources item {n}")
    for s in (title, pub):
        if re.search(r"[<>*`\[\]\\]", s):
            fail(slug, f"Sources item {n}: plain text only in title and publisher")
    return {"title": title, "url": url, "publisher": pub, "accessed": acc}


def render_post_body(slug, body, first_line, known):
    blocks = parse_blocks(slug, body, first_line)
    h2s = [(b[1], b[2]) for b in blocks if b[0] == "h2"]
    names = [h[0] for h in h2s]
    if names[-2:] != [QUESTIONS_H, SOURCES_H] or names.count(QUESTIONS_H) != 1 or names.count(SOURCES_H) != 1:
        fail(slug, f"the last two '## ' sections must be '## {QUESTIONS_H}' and then '## {SOURCES_H}'")
    if not blocks or blocks[0][0] != "p":
        fail(slug, "the post must start with an introductory paragraph (the lede) before the first heading")
    si = next(i for i, b in enumerate(blocks) if b[0] == "h2" and b[1] == SOURCES_H)
    tail = blocks[si + 1:]
    if len(tail) != 1 or tail[0][0] != "ul":
        fail(slug, f"'## {SOURCES_H}' must contain exactly one '- ' list and nothing else")
    sources = [parse_source_item(slug, t, n) for n, t in enumerate(tail[0][1], 1)]
    if len(sources) < SOURCES_MIN:
        fail(slug, f"at least {SOURCES_MIN} sources are required (found {len(sources)})")
    if len({s["url"] for s in sources}) != len(sources):
        fail(slug, "the same URL appears twice in Sources")
    ctx = Ctx(slug, known, len(sources))
    lede_text = blocks[0][1]
    out, ids, words, lede_html, qi = [], set(), 0, "", next(i for i, b in enumerate(blocks) if b[0] == "h2" and b[1] == QUESTIONS_H)
    sections = {"main": [], "questions": []}
    cur = sections["main"]
    for idx, (kind, pay, ln) in enumerate(blocks[:si]):
        where = f"line {ln}"
        if idx == qi:
            cur = sections["questions"]
        if kind in ("h2", "h3"):
            if re.search(r"[<>*`\[\]\\]", pay):
                fail(slug, f"{where}: headings are plain text")
            if kind == "h3" and not any(b[0] == "h2" for b in blocks[:idx]):
                fail(slug, f"{where}: '###' before any '##'")
            hid = base = slugify(pay)
            n = 2
            while hid in ids or hid in ("sources", "helps-h", "main", "top", "related"):
                hid = f"{base}-{n}"
                n += 1
            ids.add(hid)
            tag = kind
            cur.append(f'<{tag} id="{hid}">{esc(pay)}</{tag}>')
            words += len(pay.split())
        elif kind == "p":
            if idx == 0:
                lede_html = inline(ctx, pay, where)  # shown in the page header, not repeated in the body
            else:
                cur.append("<p>" + inline(ctx, pay, where) + "</p>")
            words += len(re.sub(r"\[\^\d+\]", "", pay).split())
        elif kind in ("ul", "ol"):
            cur.append(f"<{kind}>\n" + "\n".join("<li>" + inline(ctx, t, where) + "</li>" for t in pay) + f"\n</{kind}>")
            words += sum(len(t.split()) for t in pay)
        elif kind == "quote":
            cur.append("<blockquote><p>" + inline(ctx, " ".join(pay), where) + "</p></blockquote>")
            words += len(" ".join(pay).split())
        elif kind == "code":
            info, lines = pay
            lang, _, cap = info.partition(" ")
            if lang and not re.fullmatch(r"[a-z0-9+-]+", lang):
                fail(slug, f"{where}: code fence language must be lowercase letters, e.g. ```bash")
            if re.search(r"[<>]", cap):
                fail(slug, f"{where}: caption must be plain text")
            label = cap.strip() or "Code example"
            cls = "code out" if lang == "output" else "code"
            if cap.strip():
                cur.append(f'<p class="code-cap">{esc(cap.strip())}</p>')
            cur.append(f'<pre class="{cls}" tabindex="0" role="region" aria-label="{esc(label)}"><code>' + esc("\n".join(lines)) + "</code></pre>")
            words += len(" ".join(lines).split())
    missing = [n for n in range(1, len(sources) + 1) if n not in ctx.cited]
    if missing:
        fail(slug, f"sources {missing} are never cited in the text; cite each with [^n] or remove it")
    if not WORDS_MIN <= words <= WORDS_MAX:
        fail(slug, f"post body is {words} words; it must be {WORDS_MIN} to {WORDS_MAX} (Sources list not counted)")
    plain_text = " ".join([lede_text] + [re.sub(r"<[^>]+>", " ", s) for s in sections["main"] + sections["questions"]] + [s["title"] + " " + s["publisher"] for s in sources])
    m = BANNED_RE.search(plain_text)
    if m:
        fail(slug, f"banned wording in the post: {m.group(0)!r}")
    return {"main": sections["main"], "questions": sections["questions"], "sources": sources, "words": words, "lede": lede_html}


# ---------------------------------------------------------------------------------------------------------------- image checks
def check_svg(slug, path):
    raw = open(path, "rb").read()
    if len(raw) > 30000:
        fail(slug, f"image.svg is {len(raw)} bytes; keep it under 30000")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        fail(slug, f"image.svg is not well-formed XML: {e}")
    if root.tag != "{http://www.w3.org/2000/svg}svg" or root.get("viewBox") != "0 0 320 180":
        fail(slug, 'image.svg must be <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" ...>')
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag not in SVG_TAGS:
            fail(slug, f"image.svg: element <{tag}> is not allowed (text, images, scripts, styles and filters are out; allowed: {', '.join(sorted(SVG_TAGS))})")
        for a, v in el.attrib.items():
            name = a.split("}")[-1]
            if name.startswith("on") or name in ("href", "style") or "url(" in v.lower() and name not in ("fill", "stroke", "clip-path") or "javascript" in v.lower():
                fail(slug, f"image.svg: attribute {name!r} is not allowed")
            if name in ("fill", "stroke") and v.lower() not in PALETTE:
                fail(slug, f"image.svg: colour {v!r} is outside the palette ({', '.join(sorted(PALETTE))})")
    return raw


def png_size(path):
    d = open(path, "rb").read(32)
    if d[:8] != b"\x89PNG\r\n\x1a\n" or d[12:16] != b"IHDR":
        return None
    return int.from_bytes(d[16:20], "big"), int.from_bytes(d[20:24], "big")


# ---------------------------------------------------------------------------------------------------------------- page chrome
def head_common(title, desc, canonical, og_type, og_image, og_alt, css_prefix, ld):
    t, d = esc(title), esc(desc)
    return f"""<!doctype html>
<html lang="en">
<head>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('consent','default',{{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'}})</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="theme-color" content="#f4f5f2">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Jubilab">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{esc(og_image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(og_alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{esc(og_image)}">
<meta name="twitter:image:alt" content="{esc(og_alt)}">
<link rel="icon" href="{css_prefix}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="{css_prefix}assets/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{css_prefix}assets/fonts/ibm-plex-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">
{json.dumps(ld, indent=2, ensure_ascii=False)}
</script>
<script>try{{if(localStorage.getItem("jubilab-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}}catch(e){{}}</script>
<link rel="stylesheet" href="{css_prefix}style.css">
<link rel="stylesheet" href="{css_prefix}guides/guides.css">
<link rel="stylesheet" href="{css_prefix}blog/blog.css">
</head>
"""


def header(p):
    cur = ' aria-current="page"'
    return f"""<body>
<a class="skip" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="{p}" aria-label="Jubilab, home">
      <svg viewBox="0 0 26 26" aria-hidden="true" focusable="false"><circle class="b-fill" cx="5" cy="13" r="3.2"/><circle class="b-line" cx="21" cy="6" r="3.2"/><circle class="b-line" cx="21" cy="20" r="3.2"/><path class="b-line" d="M8 12 L18 7 M8 14 L18 19"/></svg>
      <span class="brand-name">Jubilab</span>
    </a>
    <nav class="site-nav" aria-label="Page sections">
      <ul class="links">
        <li><a href="{p}#how">How it works</a></li>
        <li><a href="{p}#labs">For labs</a></li>
        <li><a href="{p}#teams">For teams</a></li>
        <li><a href="{p}#dev">Developers</a></li>
        <li><a href="{p}blog/"{cur}>Blog</a></li>
      </ul>
      <details class="menu">
        <summary aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
        <ul>
          <li><a href="{p}#how">How it works</a></li>
          <li><a href="{p}#labs">For labs</a></li>
          <li><a href="{p}#teams">For teams</a></li>
          <li><a href="{p}#dev">Developers</a></li>
          <li><a href="{p}blog/"{cur}>Blog</a></li>
        </ul>
      </details>
    </nav>
    <div class="tools">
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch to dark theme" title="Switch to dark theme" hidden>
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <a class="btn small" href="{p}#access" aria-label="Request early access"><span class="full">Request early access</span><span class="short" aria-hidden="true">Early access</span></a>
    </div>
  </div>
</header>
"""


def footer(p):
    return f"""<footer>
  <div class="wrap">
    <div>
      <p class="foot-brand">Jubilab</p>
      <p>The order-to-result layer for lab work. We are accepting early adopters: request access and we invite small groups first. The order layer is still being built and nothing is released yet. Examples on this site are illustrative drafts.</p>
      <p class="foot-co">A product of Billy BioTech Ltd. (<span lang="zh-Hant" class="cjk">比利生物科技有限公司</span>), Taipei</p>
      <p>Contact: <a href="mailto:hello@jubilab.io">hello@jubilab.io</a></p>
    </div>
    <ul aria-label="Footer">
      <li><a href="{p}guides/">Guides</a></li>
      <li><a href="{p}blog/">Blog</a></li>
      <li><a href="{p}privacy/">Privacy</a></li>
      <li><a href="{p}terms/">Terms</a></li>
      <li><a href="{p}#top">Back to top</a></li>
    </ul>
  </div>
</footer>
<script src="{p}assets/theme.js" defer></script>
<script src="{p}assets/consent.js" defer></script>
</body>
</html>
"""


# Same wording as the three guides (tests/guides.test.mjs pins it there); keep in step when a release changes what ships.
HELPS = """<section class="helps" aria-labelledby="helps-h">
<h2 id="helps-h">Where Jubilab is now</h2>
<p>This post comes from our earlier work on a record of how results are made. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work. We are recruiting early adopters (request access and we invite small groups first), but the order layer is still being built and nothing is released yet.</p>
<a class="btn" href="../../#access">Request early access</a>
</section>
"""

ORG = {"@type": "Organization", "name": "Jubilab", "url": ORIGIN + "/"}


def crumbs_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i, "name": n, "item": u} for i, (n, u) in enumerate(items, 1)]}


# ---------------------------------------------------------------------------------------------------------------- posts
def load_posts(allow_missing_og, known_extra):
    base = os.path.join(ROOT, SRC)
    if not os.path.isdir(base):
        return []
    dirs = sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)) and not d.startswith("."))
    known = set(known_extra) | {f"/blog/{d}/" for d in dirs}
    posts = []
    for d in dirs:
        pdir = os.path.join(base, d)
        extra = sorted(set(os.listdir(pdir)) - {"post.md", "image.svg", "og.png"})
        if extra:
            fail(d, f"unexpected files in the source folder: {extra}")
        for f in ("post.md", "image.svg"):
            if not os.path.isfile(os.path.join(pdir, f)):
                fail(d, f"missing {f}")
        raw = open(os.path.join(pdir, "post.md"), "rb").read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            fail(d, "post.md must be UTF-8")
        if "\r" in text:
            fail(d, "post.md must use Unix line endings")
        meta, body, first_line = split_front_matter(d, text)
        check_meta(d, d, meta)
        rendered = render_post_body(d, body, first_line, known)
        svg = check_svg(d, os.path.join(pdir, "image.svg"))
        og = os.path.join(pdir, "og.png")
        og_bytes = None
        if os.path.isfile(og):
            if png_size(og) != (1200, 630):
                fail(d, "og.png must be a 1200x630 PNG (python3 scripts/render-og.py makes it from image.svg)")
            og_bytes = open(og, "rb").read()
        elif not allow_missing_og:
            fail(d, "og.png is missing: run python3 scripts/render-og.py (social crawlers do not accept SVG), or --allow-missing-og while drafting")
        minutes = int(meta["reading_time"]) if "reading_time" in meta else max(1, math.ceil(rendered["words"] / 220))
        posts.append(dict(meta=meta, slug=d, rendered=rendered, svg=svg, og=og_bytes, minutes=minutes, tags=meta["tag_list"]))
    posts.sort(key=lambda p: (p["meta"]["date"], p["slug"]), reverse=True)  # newest first, ties by slug
    return posts


def related(post, posts, n=3):
    scored = []
    for o in posts:
        if o is post:
            continue
        shared = len(set(post["tags"]) & set(o["tags"]))
        if shared:
            scored.append((-shared, tuple(-int(x) for x in o["meta"]["date"].split("-")), o["slug"], o))
    return [s[3] for s in sorted(scored, key=lambda s: s[:3])[:n]]


def tags_html(tags):
    return " ".join(f'<span class="g-tag">{esc(t)}</span>' for t in tags)


def render_post(post, posts):
    m, r = post["meta"], post["rendered"]
    slug = post["slug"]
    url = f"{ORIGIN}/blog/{slug}/"
    title = m["title"] + " | Jubilab"
    og_image = f"{url}og.png" if post["og"] else DEFAULT_OG
    og_alt = m["image_alt"] if post["og"] else DEFAULT_OG_ALT
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "BlogPosting", "headline": m["title"], "description": m["description"], "url": url, "mainEntityOfPage": url, "inLanguage": "en",
         "datePublished": m["date"], "dateModified": m["updated"], "author": ORG, "publisher": ORG, "image": og_image,
         "keywords": ", ".join(post["tags"]), "wordCount": r["words"], "timeRequired": f"PT{post['minutes']}M",
         "isPartOf": {"@type": "Blog", "name": "Jubilab blog", "url": ORIGIN + "/blog/"},
         "citation": [{"@type": "CreativeWork", "name": s["title"], "url": s["url"], "publisher": {"@type": "Organization", "name": s["publisher"]}} for s in r["sources"]]},
        crumbs_ld([("Jubilab", ORIGIN + "/"), ("Blog", ORIGIN + "/blog/"), (m["title"], url)])]}
    idx = posts.index(post)
    newer, older = (posts[idx - 1] if idx > 0 else None), (posts[idx + 1] if idx + 1 < len(posts) else None)
    out = [head_common(title, m["description"], url, "article", og_image, og_alt, "../../", ld), header("../../")]
    updated = f' &middot; Updated <time datetime="{m["updated"]}">{long_date(m["updated"])}</time>' if m["updated"] != m["date"] else ""
    out.append(f"""
<main id="main">
<div id="top"></div>
<article>
<section class="g-hero b-hero">
  <div class="wrap">
    <nav class="g-crumbs" aria-label="Breadcrumb"><ol><li><a href="../../">Jubilab</a></li><li><a href="../">Blog</a></li><li aria-current="page">{esc(m["title"])}</li></ol></nav>
    <p class="eyebrow">Blog</p>
    <h1>{esc(m["title"])}</h1>
    <p class="g-lede">{r["lede"]}</p>
    <p class="g-meta">By Jubilab &middot; <time datetime="{m["date"]}">{long_date(m["date"])}</time>{updated} &middot; {post["minutes"]} min read</p>
    <p class="b-tags">{tags_html(post["tags"])}</p>
  </div>
</section>
<div class="g-body">
<div class="wrap">
<figure class="b-figure"><img src="image.svg" width="1600" height="900" alt="{esc(m["image_alt"])}" decoding="async"></figure>
""")
    out.append("\n".join(r["main"]))
    out.append(f'\n<section class="b-questions" aria-labelledby="questions-h">\n' + "\n".join(r["questions"]).replace(f'<h2 id="{slugify(QUESTIONS_H)}">', '<h2 id="questions-h">', 1) + "\n</section>\n")
    out.append(HELPS)
    out.append('<h2 id="sources">Sources</h2>\n<ol class="g-sources">')
    for n, s in enumerate(r["sources"], 1):
        out.append(f'<li id="src-{n}"><a href="{esc(s["url"])}" rel="noopener">{esc(s["title"])}</a> <span class="why">&mdash; {esc(s["publisher"])}. Accessed {long_date(s["accessed"])}. <span class="url">{esc(s["url"])}</span></span></li>')
    out.append("</ol>")
    out.append(f'<p class="g-review">Written by Jubilab. Published {long_date(m["date"])}; last updated {long_date(m["updated"])}. Where this post names other products or projects, Jubilab is not affiliated with or endorsed by them, and it does not claim any integration with them. Things we could not check are written as questions; if you spot a mistake, email <a href="mailto:hello@jubilab.io">hello@jubilab.io</a>.</p>')
    if newer or older:
        out.append('<nav class="b-pager" aria-label="More posts">')
        out.append(f'<a class="b-prev" href="../{newer["slug"]}/" rel="prev"><span class="b-dir">Newer</span><span class="b-t">{esc(newer["meta"]["title"])}</span></a>' if newer else '<span class="b-prev b-none" aria-hidden="true"></span>')
        out.append(f'<a class="b-next" href="../{older["slug"]}/" rel="next"><span class="b-dir">Older</span><span class="b-t">{esc(older["meta"]["title"])}</span></a>' if older else '<span class="b-next b-none" aria-hidden="true"></span>')
        out.append("</nav>")
    rel = related(post, posts)
    if rel:
        out.append('<section class="b-related" aria-labelledby="related"><h2 id="related">Related posts</h2><ul class="b-grid">')
        out.extend(card(o, "../") for o in rel)
        out.append("</ul></section>")
    out.append("</div>\n</div>\n</article>\n</main>\n")
    out.append(footer("../../"))
    return "".join(x if x.endswith("\n") else x + "\n" for x in out)


def card(p, rel):
    m = p["meta"]
    return (f'<li class="b-card"><a class="b-img" href="{rel}{p["slug"]}/" tabindex="-1" aria-hidden="true"><img src="{rel}{p["slug"]}/image.svg" width="1600" height="900" alt="" loading="lazy" decoding="async"></a>'
            f'<div class="b-card-body"><h2 class="b-card-t"><a href="{rel}{p["slug"]}/">{esc(m["title"])}</a></h2><p class="b-sum">{esc(m["summary"])}</p>'
            f'<p class="b-card-meta"><time datetime="{m["date"]}">{long_date(m["date"])}</time> &middot; {p["minutes"]} min read</p></div></li>')


INDEX_TITLE = "Jubilab blog: how scientific results get made"
INDEX_DESC = "Notes from the Jubilab team on data provenance, lineage and reproducibility in bioinformatics, with sources and open questions where we are not yet sure."
assert 150 <= len(INDEX_DESC) <= 160 and len(INDEX_TITLE) <= 65
INDEX_H1 = "The Jubilab blog"
INDEX_LEDE = ("Notes on provenance, lineage and the everyday questions behind a result, from our earlier work on a record of how results are made. "
              "Each post cites its sources and says what we could not check.")


def render_index(posts):
    url = ORIGIN + "/blog/"
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": INDEX_H1, "description": INDEX_DESC, "url": url, "inLanguage": "en",
         "isPartOf": {"@type": "WebSite", "name": "Jubilab", "url": ORIGIN + "/"}, "publisher": ORG,
         **({"dateModified": max(p["meta"]["updated"] for p in posts)} if posts else {}),
         "hasPart": [{"@type": "BlogPosting", "headline": p["meta"]["title"], "url": f"{ORIGIN}/blog/{p['slug']}/", "datePublished": p["meta"]["date"]} for p in posts]},
        crumbs_ld([("Jubilab", ORIGIN + "/"), ("Blog", url)])]}
    out = [head_common(INDEX_TITLE, INDEX_DESC, url, "website", DEFAULT_OG, DEFAULT_OG_ALT, "../", ld), header("../")]
    out.append(f"""
<main id="main">
<div id="top"></div>
<section class="g-hero b-hero">
  <div class="wrap">
    <nav class="g-crumbs" aria-label="Breadcrumb"><ol><li><a href="../">Jubilab</a></li><li aria-current="page">Blog</li></ol></nav>
    <p class="eyebrow">Blog</p>
    <h1>{INDEX_H1}</h1>
    <p class="g-lede">{esc(INDEX_LEDE)}</p>
  </div>
</section>
<div class="g-body b-index">
<div class="wrap">
""")
    if posts:
        out.append('<ul class="b-grid">')
        out.extend(card(p, "") for p in posts)
        out.append("</ul>")
    else:
        out.append("<p>The first posts are on the way.</p>")
    out.append("""<p class="g-review">These articles come from our earlier work on data provenance. Jubilab is now building the <a href="../">order-to-result layer for lab work</a>.</p>
<p class="g-review">Posts are written by the Jubilab team. Product names belong to their owners; Jubilab is not affiliated with or endorsed by them. If you spot a mistake, email <a href="mailto:hello@jubilab.io">hello@jubilab.io</a>.</p>
</div>
</div>
</main>
""")
    out.append(footer("../"))
    return "".join(x if x.endswith("\n") else x + "\n" for x in out)


# ---------------------------------------------------------------------------------------------------------------- sitemap and llms.txt blocks
START, END = "<!-- blog:start -->", "<!-- blog:end -->"


def sitemap_block(posts):
    last = max([p["meta"]["updated"] for p in posts], default=None)
    ents = []
    if last:
        ents.append(("/blog/", last))
    ents += [(f"/blog/{p['slug']}/", p["meta"]["updated"]) for p in sorted(posts, key=lambda p: p["slug"])]
    body = "".join(f"  <url>\n    <loc>{ORIGIN}{u}</loc>\n    <lastmod>{d}</lastmod>\n  </url>\n" for u, d in ents)
    return f"  {START}\n{body}  {END}\n"


def llms_block(posts):
    lines = [START, "## Blog", "",
             f"- [Blog]({ORIGIN}/blog/): notes on data provenance, lineage and reproducibility in bioinformatics from our earlier work, each with sources and open questions. Jubilab is now building the order-to-result layer for lab work"]
    for p in sorted(posts, key=lambda p: p["slug"]):
        lines.append(f"- [{p['meta']['title']}]({ORIGIN}/blog/{p['slug']}/): {p['meta']['summary']}")
    return "\n".join(lines) + "\n\n" + END + "\n"


def replace_block(text, block, indent, fname):
    pat = re.compile(r"[ \t]*" + re.escape(START) + r".*?" + re.escape(END) + r"\n", re.S)
    if not pat.search(text):
        fail(fname, f"markers {START} ... {END} not found")
    return pat.sub(lambda _: block, text, count=1)


# ---------------------------------------------------------------------------------------------------------------- driver
def known_site_paths():
    known = {"/", "/guides/", "/privacy/", "/terms/", "/thanks/", "/blog/"}
    gdir = os.path.join(ROOT, "guides")
    for d in os.listdir(gdir):
        if os.path.isfile(os.path.join(gdir, d, "index.html")):
            known.add(f"/guides/{d}/")
    return known


def build(allow_missing_og=False):
    """Return {relative path: bytes} of every generated file, plus the list of source slugs."""
    posts = load_posts(allow_missing_og, known_site_paths())
    files = {"blog/index.html": render_index(posts).encode()}
    for p in posts:
        base = f"blog/{p['slug']}/"
        files[base + "index.html"] = render_post(p, posts).encode()
        files[base + "image.svg"] = p["svg"]
        if p["og"]:
            files[base + "og.png"] = p["og"]
    for fname, fn in (("sitemap.xml", sitemap_block), ("llms.txt", llms_block)):
        cur = open(os.path.join(ROOT, fname), encoding="utf-8").read()
        files[fname] = replace_block(cur, fn(posts), "", fname).encode()
    return files, [p["slug"] for p in posts]


def stray_dirs(slugs):
    bdir = os.path.join(ROOT, "blog")
    return sorted(d for d in os.listdir(bdir) if os.path.isdir(os.path.join(bdir, d)) and not d.startswith("_") and d not in slugs)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="fail if the files on disk differ from what the build would write")
    ap.add_argument("--lint", action="store_true", help="validate sources only")
    ap.add_argument("--allow-missing-og", action="store_true")
    a = ap.parse_args(argv)
    try:
        files, slugs = build(a.allow_missing_og)
        stray = stray_dirs(slugs)
        if stray:
            raise BuildError(f"blog/{stray[0]}/ has no source in {SRC}/ (remove it or add the source)")
    except BuildError as e:
        print("ERROR:", e, file=sys.stderr)
        return 1
    if a.lint:
        print(f"OK: {len(slugs)} post(s) pass the lint: {', '.join(slugs)}")
        return 0
    diffs = []
    for rel, data in sorted(files.items()):
        p = os.path.join(ROOT, rel)
        old = open(p, "rb").read() if os.path.isfile(p) else None
        if old != data:
            diffs.append(rel)
            if not a.check:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "wb") as f:
                    f.write(data)
    if a.check:
        if diffs:
            print("OUT OF DATE (run python3 scripts/build-blog.py):", ", ".join(diffs), file=sys.stderr)
            return 1
        print(f"OK: generated blog files are up to date ({len(files)} files, {len(slugs)} post(s))")
        return 0
    print(f"Built {len(slugs)} post(s); wrote {len(diffs)} changed file(s)" + (": " + ", ".join(diffs) if diffs else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
