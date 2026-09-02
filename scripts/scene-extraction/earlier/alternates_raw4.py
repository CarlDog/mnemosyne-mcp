# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
"""Raw 4 pass: every assistant block that looks like scene prose (a [Scene header
or >=3 speaker-label lines) and whose text is not already inside a canon scene
file becomes an alternate under canon/scenes/_alternates/. Canon spans stay
where they are. Verbatim apart from sentinels, UI lines, trailing offers."""
import hashlib, os, re, unicodedata, glob
from collections import Counter

RAW = os.path.join(REPO, "data", "archive", "chatgpt", "Chaos Saga", "Chat", "Archived", "Raw", "Chaos Saga 4.txt")
SCENES = r"D:\GitHub\mnemosyne-mcp\data\stories\chaos-saga\canon\scenes"
OUT = os.path.join(SCENES, "_alternates")
raw = open(RAW, "rb").read(); FILE_SHA = hashlib.sha256(raw).hexdigest()
L = raw.decode("utf-8").split("\n")

HEADER_RE = re.compile(r"^\**\[Scene(?: Shift)?:")
OFFER_RE = re.compile(r"^(Want |Wanna |Should I |Shall I |Let me know|Ready |Would you like|Or want |Or should |Want me |Next up|Say the word|Just say|I can |If you want|Do you want|Up next)", re.I)
UI_RE = re.compile(r"^(Updated saved memory|Skip to content|Chat history|Today|February|Yesterday|Previous 7 Days|\d+/\d+|Thought for .*|Search)$")
SP = re.compile(r"^(Carl|Riley|Jenna|Kira|Vanessa|Cassie|Lacey|Nyx|Gavin)\s*(\(|:)")
CANON_SPANS = [(28, 65), (338, 371), (378, 409), (898, 950)]

def norm(t):
    t = unicodedata.normalize("NFKC", t).lower()
    t = re.sub(r"[\u2018\u2019\u201c\u201d\"'`*_]", "", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60].rstrip("-") or "scene"

def yq(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

def clean(lines):
    out = []
    for ln in lines:
        s = ln.rstrip("\r")
        if s.strip() in ("You said:", "ChatGPT said:") or UI_RE.match(s.strip()):
            continue
        out.append(s)
    while out and (out[-1].strip() == "" or OFFER_RE.match(out[-1].strip())):
        out.pop()
    while out and out[0].strip() == "":
        out.pop(0)
    return out

# canon corpus (all scene files incl. the three export scenes) + Raw 3 alternates
corpus = []
keymap = {}
for p in glob.glob(os.path.join(SCENES, "cs-*.md")) + glob.glob(os.path.join(OUT, "alt-r3-*.md")):
    t = open(p, encoding="utf-8").read()
    body = t.split("\n---\n", 1)[1] if "\n---\n" in t else t
    corpus.append(norm(body))
    m = re.search(r'^catalog_key: "([^"]+)"', t, re.M); n = re.search(r'^name: "([^"]+)"', t, re.M)
    if m and n:
        keymap[norm(n.group(1))] = m.group(1)
NCANON = "\n".join(corpus)

blocks = []; role = None; start = None
for i, ln in enumerate(L, 1):
    s = ln.strip()
    if s in ("You said:", "ChatGPT said:"):
        if start: blocks.append((role, start, i - 1))
        role = "assistant" if s == "ChatGPT said:" else "user"; start = i + 1
blocks.append((role, start, len(L)))

def alt_of(header):
    m = re.search(r"PT (\d+)", header)
    if m and "House Guests" in header:
        k = keymap.get(norm(f"House Guests PT {m.group(1)}"))
        if k: return k
    t = re.sub(r"^\**\[Scene(?: Shift)?:\s*", "", header.strip()).rstrip("]*")
    parts = re.split(r"\s+[–—-]\s+", t)
    cand = parts[-1].strip()
    return keymap.get(norm(cand))

items = []; seen = set()
for role, a0, b0 in blocks:
    if role != "assistant": continue
    seg = L[a0 - 1:b0]
    starts = [k for k, x in enumerate(seg) if HEADER_RE.match(x.strip())]
    pieces = []
    if starts:
        if starts[0] > 0 and sum(1 for x in seg[:starts[0]] if SP.match(x.strip())) >= 3:
            pieces.append((0, starts[0]))
        for n, k in enumerate(starts):
            pieces.append((k, starts[n + 1] if n + 1 < len(starts) else len(seg)))
    else:
        pieces.append((0, len(seg)))
    for k, e in pieces:
        a, b = a0 + k, a0 + e - 1
        if any(x <= a <= y for x, y in CANON_SPANS): continue
        body = clean(seg[k:e])
        if len(body) < 8: continue
        hdr = HEADER_RE.match(body[0].strip())
        spk = sum(1 for x in body if SP.match(x.strip()))
        first = body[0].strip()
        scene_pre = bool(re.search(r"scene|rewrite|version of|POV", first, re.I)) and len(body) >= 12
        if not hdr and spk < 3 and not scene_pre: continue
        if not hdr and re.search(r"profile|dossier|hiccup|snag|locked in|has been officially|style guide|formatting|breakdown of wardrobe|added to each", first, re.I): continue
        text = "\n".join(body); nt = norm(text)
        if len(nt) > 200 and nt[:400] in NCANON and nt[-300:] in NCANON: continue  # already canon/alternate
        h = hashlib.sha256(nt.encode()).hexdigest()
        if h in seen: continue
        seen.add(h)
        if hdr:
            header = body[0].strip()
            title = re.sub(r"^\**\[Scene(?: Shift)?:\s*", "", header).rstrip("]*").strip()
            ao = alt_of(header)
            if "Non-Canon" in header: kind = "non-canon-explicit"
            elif ao: kind = "variant-of-canon"
            elif a >= 19000: kind = "replay-variant"
            else: kind = "style-sample"
        else:
            first = body[0].strip()
            pre = re.sub(r"^(Absolutely|You got it|Perfect|Got it|Let.s go|Let.s do it|Oh, this one.s|Here it is|Here.s|Love all of those)[^A-Za-z]*", "", first)
            title = (pre[:80].rstrip(" .,:—–-") or f"Untitled prose at line {a}")
            if SP.match(first) or len(title) < 8:
                nxt = next((x.strip() for x in body[1:] if x.strip() and not SP.match(x.strip())), "")
                title = f"{first.split('(')[0].split(':')[0].strip()}: {nxt[:70]}".rstrip(" .,:—–-")
            ao = None
            kind = "replay-variant" if a >= 19000 else "prompt-sample"
        items.append(dict(a=a, b=b, title=title, kind=kind, alt_of=ao, text=text, sha=hashlib.sha256(text.encode()).hexdigest()))

for fn in os.listdir(OUT):
    if fn.startswith("alt-r4-") and fn.endswith(".md"): os.remove(os.path.join(OUT, fn))
rows = []
for it in items:
    fn = f"alt-r4-{it['a']:05d}--{slug(it['title'])}.md"
    fm = ["---", f"name: {yq(it['title'])}", "canon_status: alternate", f"alternate_kind: {it['kind']}"]
    if it["alt_of"]: fm.append(f"alternate_of: {yq(it['alt_of'])}")
    fm += ['source_original_file: "Chaos Saga 4.txt"', f"source_lines: \"{it['a']}-{it['b']}\"", f"source_file_sha256: {FILE_SHA}", f"source_content_sha256: {it['sha']}", "---", ""]
    open(os.path.join(OUT, fn), "w", encoding="utf-8", newline="\n").write("\n".join(fm) + it["text"] + "\n")
    rows.append((fn, it["kind"], it["alt_of"] or "", f"{it['a']}-{it['b']}", it["title"]))
idx = ["# Raw 4 alternates", "", "Non-canon scene prose from `Chaos Saga 4.txt` that is not already a canon scene or a Raw 3 alternate: formatting/normalized variants of canon Recovery scenes, prompt-elevation samples, an explicitly non-canon karaoke scene, and replay variants from the file's re-run of the early text-message story. Ignored by validator and compiler.", "", "| File | Kind | Alternate of | Lines | Title |", "|---|---|---|---|---|"]
for r in rows: idx.append(f"| [{r[0]}]({r[0]}) | {r[1]} | {r[2]} | `{r[3]}` | {r[4]} |")
open(os.path.join(OUT, "_index-raw4.md"), "w", encoding="utf-8", newline="\n").write("\n".join(idx) + "\n")
print(len(rows), Counter(r[1] for r in rows))
for r in rows: print(r[3], r[1], r[2], "|", r[4][:70].encode("ascii", "replace").decode())
