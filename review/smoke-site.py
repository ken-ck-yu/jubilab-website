#!/usr/bin/env python3
"""Read-only post-deploy smoke test for the Jubilab website (QA-2).

Usage:
  python3 review/smoke-site.py https://jubilab.io               # production or a preview URL: everything expected
  python3 review/smoke-site.py http://127.0.0.1:18141 --static  # plain static server: Worker checks are SKIP
  python3 review/smoke-site.py https://jubilab.io --worker-url http://127.0.0.1:8787   # pages from BASE, /api and ?error= from a wrangler dev Worker
  add --browser to also render /?error=email with JavaScript OFF in Chromium (needs the Playwright venv:
  LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/smoke-site.py URL --browser)
  add --strict-headers to turn the missing-security-headers WARN into a FAIL.

Safety: it never creates a record. The only POSTs are (a) a bad email address (rejected by validation before storage)
and (b) Origin: null without Sec-Fetch-Site (rejected with 403 before the body is read). Both bodies also carry a bad
email, so even a regression in the Origin check could not store anything. GET/POST only, no deletes.

Exit code: 0 when no FAIL, 1 when any FAIL, 2 on usage error. Statuses: PASS, FAIL, SKIP (cannot be checked in this
mode, with the reason), WARN (reported, does not fail), INFO (reported only).
"""
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = "jubilab-smoke/1 (QA read-only)"
BAD_BODY = b"email=not-an-email&role=postdoc-scientist&field=genetics-genomics&runs-on=linux&human-data=no"
SORRY = "We could not send your request. Please go back and try again, or email hello@jubilab.io."
MSG_EMAIL = "That email address does not look right."
SEC_HEADERS = ["x-content-type-options", "referrer-policy", "x-frame-options", "content-security-policy",
               "strict-transport-security", "permissions-policy"]
rows = []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(url, method="GET", headers=None, data=None, timeout=20):
    """Returns (status, headers dict lower-cased, body bytes). Never follows redirects."""
    h = {"User-Agent": UA}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        r = OPENER.open(req, timeout=timeout)
    except urllib.error.HTTPError as e:
        r = e
    except Exception as e:  # connection refused, DNS, TLS
        return None, {}, repr(e).encode()
    body = r.read() if method != "HEAD" else b""
    return r.status if hasattr(r, "status") else r.code, {k.lower(): v for k, v in r.headers.items()}, body


def rec(name, status, detail=""):
    rows.append((name, status, detail))


def box(html):
    m = re.search(r'<p\b[^>]*\bid="form-error"[^>]*>[^<]*</p>', html)
    return m.group(0) if m else None


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    flags = [a for a in argv if a.startswith("--")]
    worker_url = None
    if "--worker-url" in argv:
        i = argv.index("--worker-url")
        if i + 1 >= len(argv):
            print(__doc__)
            return 2
        worker_url = argv[i + 1].rstrip("/")
        args = [a for a in args if a != worker_url]
    if len(args) != 1:
        print(__doc__)
        return 2
    base = args[0].rstrip("/")
    static = "--static" in flags
    W = worker_url or base
    wk_skip = "static server, no Worker (--static)" if static and not worker_url else None
    host = urllib.parse.urlsplit(base).hostname or ""
    local = host in ("127.0.0.1", "localhost", "::1")

    # ---- pages served from BASE
    st, h, body = fetch(base + "/")
    html = body.decode("utf-8", "replace")
    rec("GET / is 200", "PASS" if st == 200 else "FAIL", f"status {st}")
    if st is None:
        rec("abort", "FAIL", html)
        return report()
    ctype = h.get("content-type", "")
    rec("GET / content-type is text/html", "PASS" if "text/html" in ctype else "FAIL", ctype)
    missing = [x for x in SEC_HEADERS if x not in h]
    if not missing:
        rec("security headers on /", "PASS", "all of " + ", ".join(SEC_HEADERS))
    else:
        rec("security headers on /", "FAIL" if "--strict-headers" in flags else "WARN",
            "missing: " + ", ".join(missing) + " (the repo defines none; static host adds none)")
    cc = h.get("cache-control", "")
    rec("GET / (no query) keeps normal cache headers, not no-store", "PASS" if "no-store" not in cc.lower() else "FAIL", f"cache-control: {cc or '(none sent)'!r}")
    b = box(html)
    rec("GET / error box present and hidden", "PASS" if b and re.search(r"\bhidden\b", b) else "FAIL", (b or "no #form-error")[:120])

    for p in ("/thanks/", "/privacy/", "/terms/", "/guides/", "/guides/reference-genome-build-vcf-bam/", "/guides/what-parameters-produced-this-result/", "/guides/nextflow-provenance-and-lineage-compared/"):
        s, _, _ = fetch(base + p)
        rec(f"GET {p} is 200", "PASS" if s == 200 else "FAIL", f"status {s}")
    s, hh, _ = fetch(base + "/guides/guides.css")
    rec("GET /guides/guides.css is 200 css", "PASS" if s == 200 and "css" in hh.get("content-type", "") else "FAIL", f"{s} {hh.get('content-type')}")
    s, hh, _ = fetch(base + "/style.css")
    rec("GET /style.css is 200 css", "PASS" if s == 200 and "css" in hh.get("content-type", "") else "FAIL", f"{s} {hh.get('content-type')}")

    # honeypot markup (static HTML, from BASE)
    m = re.search(r"<input\b[^>]*\bname=\"q7_note\"[^>]*>", html)
    need = ['tabindex="-1"', 'autocomplete="off"', "data-lpignore", "data-1p-ignore", "data-bwignore"]
    if not m:
        rec("honeypot input name=q7_note in HTML", "FAIL", "not found (stale page cached, or old build)")
    else:
        lack = [n for n in need if n not in m.group(0)]
        rec("honeypot input name=q7_note in HTML", "PASS" if not lack else "FAIL", "autofill-hostile attributes " + ("all present" if not lack else "missing " + ", ".join(lack)))
    rec("old honeypot name 'website' is not an input", "PASS" if not re.search(r"<input\b[^>]*\bname=\"website\"", html) else "FAIL", "")

    # robots / sitemap: report only
    s, _, rb = fetch(base + "/robots.txt")
    rtxt = rb.decode("utf-8", "replace")
    dis = bool(re.search(r"^Disallow:\s*/\s*$", rtxt, re.M))
    rec("robots.txt state", "INFO", f"status {s}, " + ("crawling DISALLOWED (preview mode)" if dis else "crawling allowed or no Disallow: /"))
    s, _, sb = fetch(base + "/sitemap.xml")
    rec("sitemap.xml state", "INFO", f"status {s}, {len(re.findall(b'<loc>', sb))} url(s)" if s == 200 else f"status {s}")

    # http -> https redirect (report only)
    if base.startswith("https://") and not local:
        s, hh, _ = fetch("http://" + base[len("https://"):] + "/")
        rec("http -> https redirect", "INFO", f"status {s}" + (f" -> {hh.get('location')}" if s and 300 <= s < 400 else " (no redirect: plain HTTP is served)" if s == 200 else ""))
    else:
        rec("http -> https redirect", "SKIP", "base is not a public https URL")

    # ---- Worker-dependent checks, against W
    def wk(name, fn):
        if wk_skip:
            rec(name, "SKIP", wk_skip)
        else:
            fn()

    def c_err_email():
        s, hh, bd = fetch(W + "/?error=email")
        t = bd.decode("utf-8", "replace")
        b = box(t)
        ok_box = bool(b) and not re.search(r"\bhidden\b", b) and MSG_EMAIL in b
        rec("/?error=email shows visible message (no hidden attribute)", "PASS" if s == 200 and ok_box else "FAIL", f"status {s}; " + ((b or "no #form-error")[:140]))
        c = hh.get("cache-control", "")
        rec("/?error=email is Cache-Control: no-store", "PASS" if "no-store" in c.lower() else "FAIL", f"cache-control: {c!r}, cf-cache-status: {hh.get('cf-cache-status')}")

    def c_err_bogus():
        s, hh, bd = fetch(W + "/?error=bogus")
        b = box(bd.decode("utf-8", "replace"))
        rec("/?error=bogus keeps the box hidden", "PASS" if s == 200 and b and re.search(r"\bhidden\b", b) else "FAIL", f"status {s}")
        s2, _, bd2 = fetch(W + "/?error=%3Cscript%3Ealert(1)%3C/script%3E")
        t2 = bd2.decode("utf-8", "replace")
        rec("/?error=<script> is not reflected", "PASS" if s2 == 200 and "alert(1)" not in t2 else "FAIL", f"status {s2}")
    wk("/?error=email visible + no-store", c_err_email)
    wk("/?error=bogus hidden, no reflection", c_err_bogus)

    def c_get_api():
        s, hh, _ = fetch(W + "/api/early-access")
        rec("GET /api/early-access is 405 with Allow: POST", "PASS" if s == 405 and hh.get("allow", "").upper() == "POST" else "FAIL", f"status {s}, allow {hh.get('allow')!r}")
    wk("GET /api/early-access 405", c_get_api)

    def c_bad_email():
        o = urllib.parse.urlsplit(W)
        origin = f"{o.scheme}://{o.netloc}"
        s, hh, _ = fetch(W + "/api/early-access", "POST", {"Content-Type": "application/x-www-form-urlencoded", "Origin": origin}, BAD_BODY)
        loc = hh.get("location", "")
        want = urllib.parse.urljoin(W + "/", "/?error=email#access")
        ok = s == 303 and loc.rstrip() in ("/?error=email#access", want)
        rec("POST bad email -> 303 /?error=email#access (nothing stored)", "PASS" if ok else "FAIL", f"status {s}, location {loc!r}; bad address is rejected before any KV access")
    wk("POST bad email redirect", c_bad_email)

    def c_origin_null():
        s, hh, bd = fetch(W + "/api/early-access", "POST", {"Content-Type": "application/x-www-form-urlencoded", "Origin": "null"}, BAD_BODY)
        t = bd.decode("utf-8", "replace").strip()
        rec("POST Origin: null, no Sec-Fetch-Site -> 403 plain sentence", "PASS" if s == 403 and t == SORRY and "text/plain" in hh.get("content-type", "") else "FAIL",
            f"status {s}, content-type {hh.get('content-type')!r}, body {t[:90]!r}")
        s, hh, bd = fetch(W + "/api/early-access", "POST", {"Content-Type": "application/x-www-form-urlencoded", "Origin": "https://evil.example"}, BAD_BODY)
        rec("POST Origin: https://evil.example -> 403", "PASS" if s == 403 else "FAIL", f"status {s}")
    wk("POST Origin null / foreign 403", c_origin_null)

    if "--browser" in flags:
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                br = p.chromium.launch()
                for js, code, want in ((False, "email", True), (False, "bogus", False)):
                    if wk_skip:
                        rec(f"browser, JS off, /?error={code}", "SKIP", wk_skip)
                        continue
                    ctx = br.new_context(java_script_enabled=js)
                    pg = ctx.new_page()
                    pg.goto(W + f"/?error={code}")
                    vis = pg.locator("#form-error").is_visible()
                    rec(f"browser, JS off, /?error={code} message visible={want}", "PASS" if vis == want else "FAIL", f"visible={vis}")
                    ctx.close()
                br.close()
        except Exception as e:  # missing playwright or browser libs
            rec("browser checks", "SKIP", "Playwright unavailable: " + repr(e)[:100])
    return report()


def report():
    w = max(len(r[0]) for r in rows)
    print(f"{'CHECK'.ljust(w)}  RESULT  DETAIL")
    for n, s, d in rows:
        print(f"{n.ljust(w)}  {s.ljust(6)}  {d}")
    cnt = {k: sum(1 for r in rows if r[1] == k) for k in ("PASS", "FAIL", "SKIP", "WARN", "INFO")}
    print("\n" + ", ".join(f"{v} {k}" for k, v in cnt.items()))
    if cnt["SKIP"]:
        print("NOTE: SKIP means NOT verified in this run. Deployed routing is only verified when no check is SKIP.")
    return 1 if cnt["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
