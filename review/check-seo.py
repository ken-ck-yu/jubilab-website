#!/usr/bin/env python3
"""Crawlability and SEO checks for the Jubilab website. Standard library only.

Usage:  check-seo.py <base-url> [--mode preview|launch]
  preview (default): the current state. Every page must be noindex; robots.txt must disallow all.
  launch: the state after scripts/go-public.py --apply [--with-legal]. Home must be indexable; thanks and 404 noindex;
          privacy and terms must be indexable if listed in the sitemap, otherwise noindex; robots.txt must allow all.
Serve the repo (or the go-public copy) first, e.g.  python3 -m http.server 18151 --bind 127.0.0.1
Prints PASS, FAIL or WARN per check; exit code 1 on any FAIL. It reports state; it does not rank or promise anything.
Note: the canonical and sitemap URLs name https://jubilab.io, so they are compared by path against the base URL.
"""
import json, re, sys, urllib.request, urllib.error, urllib.parse
from html.parser import HTMLParser

PAGES = ["/", "/privacy/", "/terms/", "/thanks/", "/404.html"]
PUBLIC_ORIGIN = "https://jubilab.io"
RESULTS = []


def rec(status, name, detail=""):
    RESULTS.append(status)
    print(f"{status} {name}" + (f": {detail}" if detail else ""))


def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "check-seo"}), timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace"), r.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), e.headers
    except Exception as e:
        return 0, str(e), {}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.links, self.headings, self.imgs, self.anchors, self.ids, self.ldjson = [], [], [], [], [], set(), []
        self.title, self.lang, self._in, self._buf, self.in_main = None, None, None, "", False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "meta":
            self.meta.append(a)
        elif tag == "link":
            self.links.append(a)
        elif tag == "img":
            self.imgs.append(a)
        elif tag == "a" and "href" in a:
            self.anchors.append(a["href"])
        if tag in ("title", "h1", "h2", "h3", "h4", "h5", "h6") or (tag == "script" and a.get("type") == "application/ld+json"):
            self._in, self._buf = tag, ""

    def handle_data(self, d):
        if self._in:
            self._buf += d

    def handle_endtag(self, tag):
        if tag == self._in:
            if tag == "title" and self.title is None:
                self.title = self._buf.strip()
            elif tag == "script":
                self.ldjson.append(self._buf)
            elif tag != "title":
                self.headings.append((int(tag[1]), " ".join(self._buf.split())))
            self._in = None


def metac(p, key, val):
    for m in p.meta:
        if m.get(key) == val:
            return m.get("content")
    return None


def local(base, url):
    """Map a public-origin URL to the base under test."""
    return base + url[len(PUBLIC_ORIGIN):] if url.startswith(PUBLIC_ORIGIN) else url


def walk_ld(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from walk_ld(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk_ld(v)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    mode = "preview"
    if "--mode" in sys.argv:
        mode = sys.argv[sys.argv.index("--mode") + 1]
        args = [a for a in args if a != mode]
    if not args or mode not in ("preview", "launch"):
        print(__doc__)
        return 2
    base = args[0].rstrip("/")
    print(f"check-seo: {base} mode={mode}")

    st, robots, _ = get(base + "/robots.txt")
    rec("PASS" if st == 200 else "FAIL", "robots.txt returns 200", str(st))
    disallow_all = bool(re.search(r"^\s*Disallow:\s*/\s*$", robots, re.M))
    allows = bool(re.search(r"^\s*Allow:\s*/\s*$", robots, re.M)) and not disallow_all
    print(f"INFO robots.txt state: {'disallows all crawling' if disallow_all else 'allows crawling' if allows else 'no blanket rule'}; Sitemap line: {'yes' if re.search(r'^Sitemap:', robots, re.M | re.I) else 'no'}")
    if mode == "preview":
        rec("PASS" if disallow_all else "FAIL", "preview: robots.txt disallows all")
    else:
        rec("PASS" if allows else "FAIL", "launch: robots.txt allows all and has no blanket Disallow")
        rec("PASS" if re.search(r"^Sitemap:\s*" + re.escape(PUBLIC_ORIGIN) + "/sitemap.xml", robots, re.M | re.I) else "FAIL", "launch: robots.txt names the sitemap")

    st, sm, _ = get(base + "/sitemap.xml")
    rec("PASS" if st == 200 else "FAIL", "sitemap.xml returns 200", str(st))
    sm_locs = re.findall(r"<loc>([^<]+)</loc>", sm)
    for m in re.finditer(r"<url>(.*?)</url>", sm, re.S):
        if not re.search(r"<lastmod>\d{4}-\d{2}-\d{2}</lastmod>", m.group(1)):
            rec("FAIL", "sitemap entry has a lastmod", m.group(1).strip()[:60])
    for loc in sm_locs:
        s2, _, _ = get(local(base, loc))
        rec("PASS" if s2 == 200 else "FAIL", f"sitemap URL returns 200: {loc}", str(s2))

    pages = {}
    for path in PAGES:
        url = base + path
        st, html, hdr = get(url)
        if path == "/404.html":
            rec("PASS" if st in (200, 404) else "FAIL", f"{path} reachable", str(st))
        else:
            rec("PASS" if st == 200 else "FAIL", f"{path} returns 200", str(st))
            if st != 200:
                continue
        p = Page()
        p.feed(html)
        pages[path] = p
        public = PUBLIC_ORIGIN + (path if path != "/404.html" else "/404.html")
        robots_meta = (metac(p, "name", "robots") or "").lower()
        is_noindex = "noindex" in robots_meta
        in_sitemap = public in sm_locs
        if mode == "preview":
            want_noindex = True
        else:
            want_noindex = path in ("/thanks/", "/404.html") or (path in ("/privacy/", "/terms/") and not in_sitemap)
        rec("PASS" if is_noindex == want_noindex else "FAIL", f"{path} robots meta: {'noindex' if is_noindex else 'indexable'} (expected {'noindex' if want_noindex else 'indexable'})")
        if "noindex" in (hdr.get("X-Robots-Tag") or "").lower() and not want_noindex:
            rec("FAIL", f"{path} X-Robots-Tag noindex header")
        if path in sm_locs or in_sitemap:
            pass
        if is_noindex and in_sitemap and mode == "launch":
            rec("FAIL", f"{path} is noindex but listed in the sitemap")
        if not is_noindex and not in_sitemap and path in ("/", "/privacy/", "/terms/"):
            rec("FAIL", f"{path} is indexable but missing from the sitemap")
        rec("PASS" if p.lang == "en" else "FAIL", f"{path} html lang", str(p.lang))
        rec("PASS" if metac(p, "name", "viewport") else "FAIL", f"{path} viewport meta")
        # title, description
        t = p.title or ""
        rec("PASS" if 10 <= len(t) <= 65 else "FAIL", f"{path} title length 10-65", f"{len(t)}: {t}")
        d = metac(p, "name", "description") or ""
        indexable_page = not want_noindex
        lo, hi = (120, 160) if indexable_page else (20, 200)
        rec("PASS" if lo <= len(d) <= hi else "FAIL", f"{path} description length {lo}-{hi}", str(len(d)))
        if indexable_page and not (150 <= len(d) <= 160):
            rec("WARN", f"{path} description is outside the 150-160 target", str(len(d)))
        if indexable_page and re.search(r"draft", t + " " + d, re.I):
            rec("WARN", f"{path} title or description says 'draft' but the page is indexable")
        # canonical
        canon = [l.get("href") for l in p.links if l.get("rel") == "canonical"]
        if path == "/404.html":
            rec("PASS" if not canon else "FAIL", f"{path} has no canonical (error page)")
        else:
            rec("PASS" if canon == [public] else "FAIL", f"{path} canonical equals page URL", str(canon))
        # social
        for k in ("og:title", "og:description", "og:image", "og:type", "og:site_name"):
            if not metac(p, "property", k):
                rec("FAIL", f"{path} has {k}")
        if path != "/404.html" and metac(p, "property", "og:url") != public:
            rec("FAIL", f"{path} og:url equals page URL", str(metac(p, 'property', 'og:url')))
        for k in ("twitter:card", "twitter:title", "twitter:description", "twitter:image"):
            if not metac(p, "name", k):
                rec("FAIL", f"{path} has {k}")
        if metac(p, "property", "og:title") != t:
            rec("WARN", f"{path} og:title differs from <title>")
        # og image
        img = metac(p, "property", "og:image")
        if img:
            s2, _, h2 = get(local(base, img))
            rec("PASS" if s2 == 200 and "image/" in (h2.get("Content-Type") or "") else "FAIL", f"{path} og:image resolves", f"{s2}")
            rec("PASS" if metac(p, "property", "og:image:width") == "1200" and metac(p, "property", "og:image:height") == "630" and metac(p, "property", "og:image:alt") else "FAIL", f"{path} og:image width 1200, height 630 and alt")
        # headings
        h1s = [h for h in p.headings if h[0] == 1]
        rec("PASS" if len(h1s) == 1 else "FAIL", f"{path} exactly one h1", f"{len(h1s)}")
        prev, skips, empties = 0, [], 0
        for lvl, txt in p.headings:
            if prev and lvl > prev + 1:
                skips.append(f"h{prev}->h{lvl}")
            if not txt:
                empties += 1
            prev = lvl
        rec("PASS" if not skips and not empties else "FAIL", f"{path} heading outline has no skipped levels or empty headings", f"{len(p.headings)} headings {skips}")
        # images
        noalt = [i.get("src") for i in p.imgs if i.get("alt") is None]
        rec("PASS" if not noalt else "FAIL", f"{path} images have alt", f"{len(p.imgs)} images")
        # internal links
        bad = []
        for href in set(p.anchors):
            if re.match(r"(mailto:|tel:|javascript:)", href):
                continue
            u = urllib.parse.urljoin(url, href)
            if href.startswith(PUBLIC_ORIGIN):
                u = local(base, href)
            elif not u.startswith(base):
                continue
            frag = urllib.parse.urldefrag(u)[1]
            s2, body, _ = get(urllib.parse.urldefrag(u)[0])
            if s2 != 200:
                bad.append(f"{href} -> {s2}")
            elif frag:
                q = Page()
                q.feed(body)
                if frag not in q.ids:
                    bad.append(f"{href} (no id {frag})")
        rec("PASS" if not bad else "FAIL", f"{path} internal links resolve", f"{len(set(p.anchors))} links {bad}")

    # JSON-LD (home)
    home = pages.get("/")
    if home:
        rec("PASS" if home.ldjson else "FAIL", "home has JSON-LD")
        types, urls = set(), set()
        for blob in home.ldjson:
            try:
                data = json.loads(blob)
            except Exception as e:
                rec("FAIL", "JSON-LD parses", str(e))
                continue
            rec("PASS", "JSON-LD parses")
            for node in walk_ld(data):
                t = node.get("@type")
                types.update(t if isinstance(t, list) else [t] if t else [])
                for k in ("url", "logo", "image", "@id"):
                    v = node.get(k)
                    if isinstance(v, str) and v.startswith("http"):
                        urls.add(v.split("#")[0])
                if node.get("@type") == "SoftwareApplication":
                    desc = node.get("description", "")
                    hero = re.search(r'class="hero-lede">(.*?)</p>', get(base + "/")[1], re.S)
                    hero_txt = re.sub(r"<[^>]+>", "", hero.group(1)).replace("&rsquo;", "'") if hero else ""
                    rec("PASS" if " ".join(hero_txt.split()) == " ".join(desc.split()) else "FAIL", "SoftwareApplication description equals the visible hero text")
                    for banned in ("offers", "aggregateRating", "review"):
                        rec("PASS" if banned not in node else "FAIL", f"SoftwareApplication has no unverified '{banned}'")
        for need in ("Organization", "WebSite", "SoftwareApplication"):
            rec("PASS" if need in types else "FAIL", f"JSON-LD has {need}")
        for u in sorted(urls):
            s2, _, _ = get(local(base, u))
            rec("PASS" if s2 == 200 else "FAIL", f"JSON-LD URL resolves: {u}", str(s2))
        mail = re.findall(r'"email"\s*:\s*"([^"]+)"', "".join(home.ldjson))
        html = get(base + "/")[1]
        for m in mail:
            rec("PASS" if m in html.replace("</script>", "", 0).split("</head>")[-1] else "FAIL", f"JSON-LD email {m} is visible on the page")

    # llms.txt
    st, llms, _ = get(base + "/llms.txt")
    rec("PASS" if st == 200 else "FAIL", "llms.txt returns 200", str(st))
    rec("PASS" if llms.startswith("# ") and re.search(r"^> ", llms, re.M) else "FAIL", "llms.txt has an H1 and a summary blockquote")
    links = re.findall(r"\]\((https?://[^)]+)\)", llms)
    for u in links:
        s2, body, _ = get(local(base, urllib.parse.urldefrag(u)[0]))
        frag = urllib.parse.urldefrag(u)[1]
        ok = s2 == 200
        if ok and frag:
            q = Page()
            q.feed(body)
            ok = frag in q.ids
        rec("PASS" if ok else "FAIL", f"llms.txt link resolves: {u}", str(s2))
    rec("PASS" if links else "FAIL", "llms.txt has links", str(len(links)))

    f = RESULTS.count("FAIL")
    print(f"\ncheck-seo summary: {RESULTS.count('PASS')} PASS, {f} FAIL, {RESULTS.count('WARN')} WARN (mode {mode}). This reports on-page state only; rankings, indexing and AI citations are not checked and cannot be promised.")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
