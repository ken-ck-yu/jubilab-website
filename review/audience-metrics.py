#!/usr/bin/env python3
"""Objective audience metrics for the home page (T-047).

INFORMATIONAL since T-050 (2026-10-27): the owner's redesign deliberately uses API, MCP, webhook and ELN wording, so the reading-grade and
jargon-density thresholds no longer apply and nothing here fails; the numbers are printed for comparison only.

  python3 review/audience-metrics.py [path/to/index.html]      (default: ./index.html)
  git show main:index.html > /tmp/old.html && python3 review/audience-metrics.py /tmp/old.html

Counts VISIBLE main-content text only: everything inside <main>, minus the early-access form, <script>, <style>, <noscript>,
<template>, JSON-LD and SVG <title>/<desc> (screen-reader text, not on screen). The page has two copies of the comparison
diagram (wide and stacked); only the first copy ("dg-wide", or the first <svg> of a pair) is counted. The nav, header and
footer are outside <main> and are excluded. Text inside closed <details> (FAQ answers, the diagram text alternative) IS counted.

Metrics
  words         whitespace-separated words in the main text (the form is excluded)
  first screen  words in the hero text block (class "hero-text": headline, sub-line, lede, button, status line).
                "hero total" also adds the journey strip under it, for honesty; the target applies to the first number.
  FK grade      Flesch-Kincaid grade, 0.39*words/sentence + 11.8*syllables/word - 15.59. A sentence ends at . ! ? or at the end
                of a list item, heading, card, button or label (block element), so headings and bullets are not run together.
                A second "strict" grade ends sentences only at . ! ? (worst case); the target must hold for both.
  tech terms    hits per 100 words of the list TERMS below (whole words, case-insensitive; plurals count).
                "Benchling" is a product name and is not a term. "ELN" is a term; the page says "lab notebook".
  code blocks   count of <pre> and <code> elements in the whole file.
Targets: grade <= 9, <= 1.5 terms per 100 words, 0 code blocks, first screen <= 70 words.
"""
import re, sys
from html.parser import HTMLParser

TERMS = ["JSON", "API", "MCP", "webhook", "schema", "manifest", "telemetry", "endpoint", "REST", "SFTP", "LIMS", "ELN", "checksum",
         "MSA", "CLIA", "ONT", "BaseSpace", "MinKNOW", "SMRT", "SDK", "token", "protocol", "vocabulary", "spec", "append-only"]
TERM_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(t) for t in TERMS) + r")s?(?![\w-])", re.I)
BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "div", "section", "figcaption", "summary", "a", "button", "b", "span", "td", "th", "label", "ol", "ul", "details", "figure", "text", "tspan"}
SENT_BREAK = {"p", "li", "h1", "h2", "h3", "h4", "div", "section", "figcaption", "summary", "button", "td", "th", "label", "ol", "ul", "details", "figure", "text"}
SKIP = {"script", "style", "noscript", "template", "form", "title", "desc"}


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_main = 0; self.skip = 0; self.svg_depth = 0; self.svg_seen = 0; self.svg_skip = False
        self.hero_depth = 0; self.hero_text = 0; self.journey = 0
        self.chunks = []; self.hero_chunks = []; self.hero_all = []
        self.stack = []; self.code = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs); cls = (a.get("class") or "").split()
        if tag in ("pre", "code"): self.code += 1
        void = tag in ("br", "img", "input", "meta", "link", "hr", "path", "line", "rect", "circle", "polygon", "use")
        if tag == "main": self.in_main += 1
        if not self.in_main: return
        if tag in SKIP and not void: self.skip += 1; self.stack.append((tag, "skip")); return
        if tag == "svg":
            self.svg_depth += 1
            if self.svg_depth == 1:
                self.svg_seen += 1
                # count the first SVG of the comparison pair (dg-wide) and skip the stacked copy; hero/other svgs are counted once
                self.svg_skip = "dg-tall" in cls
            self.stack.append((tag, "svg")); return
        if not void: self.stack.append((tag, "")) 
        if tag == "br": self.chunks.append(" ")
        if "hero-text" in cls: self.hero_text += 1; self.stack[-1] = (tag, "hero-text")
        if "journey" in cls: self.journey += 1; self.stack[-1] = (tag, "journey")
        if tag in SENT_BREAK: self._brk()

    def handle_endtag(self, tag):
        if tag == "main": self.in_main = max(0, self.in_main - 1)
        if not self.in_main: return
        while self.stack:
            t, mark = self.stack.pop()
            if mark == "skip": self.skip -= 1
            if mark == "svg": self.svg_depth -= 1
            if mark == "hero-text": self.hero_text -= 1
            if mark == "journey": self.journey -= 1
            if t == tag: break
        if tag in SENT_BREAK: self._brk()

    def _brk(self):
        self.chunks.append(" ")
        if self.hero_text or self.journey: self.hero_all.append(" ")
        if self.hero_text: self.hero_chunks.append(" ")

    def handle_data(self, d):
        if not self.in_main or self.skip or (self.svg_depth and self.svg_skip): return
        self.chunks.append(d)
        if self.hero_text or self.journey: self.hero_all.append(d)
        if self.hero_text: self.hero_chunks.append(d)


def syll(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w: return 0
    if len(w) <= 3: return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w); w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def stats(text, strict=False):
    # strict: only . ! ? end a sentence (headings and list items without a full stop run on: worst case)
    if strict: text = text.replace("\u2029", " ")
    sents = [s for s in re.split(r"[ ]+|(?<=[.!?])\s+", text) if re.search(r"[A-Za-z]", s)]
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9'’\-]*", text)
    wc = len(words); sc = max(1, len(sents)); sy = sum(syll(w) for w in words if re.search("[A-Za-z]", w))
    fk = 0.39 * wc / sc + 11.8 * sy / max(1, wc) - 15.59
    return wc, sc, fk


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    src = open(path, encoding="utf8").read()
    p = P(); p.feed(src)
    clean = lambda ch: re.sub(r"[ \t\r\n]+", " ", "".join(ch))
    text = clean(p.chunks); hero = clean(p.hero_chunks); hero_all = clean(p.hero_all)
    wc, sc, fk = stats(text)
    fks = stats(text, strict=True)[2]
    hw = stats(hero)[0]; ha = stats(hero_all)[0]
    hits = TERM_RE.findall(text.replace(" ", " "))
    per100 = 100 * len(hits) / max(1, wc)
    res = [("words (main content)", wc, None), ("sentences", sc, None), ("first screen words (hero text)", hw, None), ("hero total words (with journey strip)", ha, None),
           ("Flesch-Kincaid grade (block-aware)", round(fk, 1), None), ("Flesch-Kincaid grade (strict: .!? only)", round(fks, 1), None), ("technical terms", len(hits), None), ("technical terms per 100 words", round(per100, 2), None),
           ("code blocks (<pre>, <code>)", p.code, None)]
    print(f"audience metrics for {path}")
    for n, v, ok in res: print(f"  {n:40s} {v!s:>8}  {'' if ok is None else ('PASS' if ok else 'FAIL')}")
    if hits: print("  term hits:", ", ".join(sorted({h.lower() for h in hits})), "->", {h.lower(): sum(1 for x in hits if x.lower() == h.lower()) for h in set(hits)})
    sys.exit(0 if all(ok is not False for _, _, ok in res) else 1)


if __name__ == "__main__":
    main()
