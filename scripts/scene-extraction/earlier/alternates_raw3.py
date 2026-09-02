# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
"""Extract Raw 3's non-canon scene prose (style samples, template placeholders,
superseded drafts) into canon/scenes/_alternates/. The underscore directory is
ignored by validate-canon and compile-story, so nothing here becomes an entity.
Prose is verbatim; sentinels, UI lines, and trailing offers are stripped."""
import hashlib, os, re, sys, unicodedata, csv

RAW = os.path.join(REPO, "data", "archive", "chatgpt", "Chaos Saga", "Chat", "Archived", "Raw", "Chaos Saga 3.txt")
OUT = r"D:\GitHub\mnemosyne-mcp\data\stories\chaos-saga\canon\scenes\_alternates"
os.makedirs(OUT, exist_ok=True)
raw = open(RAW, "rb").read()
FILE_SHA = hashlib.sha256(raw).hexdigest()
L = raw.decode("utf-8").split("\n")

HEADER_RE = re.compile(r"^\[Scene(?: Shift)?:")
OFFER_RE = re.compile(r"^(Want |Wanna |Should I |Shall I |Let me know|Ready |Would you like|Or want |Or should |Want me |Next up|Say the word|Just say|I can |If you want|Do you want|Up next)", re.I)
UI_RE = re.compile(r"^(Updated saved memory|Skip to content|Chat history|Today|February|Yesterday|Previous 7 Days|\d+/\d+|Thought for .*|Search)$")
ALT_OF = {"66": "CS-R024-05-HLR", "67": "CS-R024-06-HKT", "68": "CS-R024-07-HPO", "83": "CS-R024-22-BCH"}
RANGES = [(1, 4870), (4956, 5322), (6215, 6279)]  # uncovered stretches with scene prose

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

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60].rstrip("-") or "scene"

def norm(t):
    t = unicodedata.normalize("NFKC", t).lower()
    t = re.sub(r"[\u2018\u2019\u201c\u201d\"'`]", "", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()

def yq(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

# assistant blocks
blocks = []
role = None; start = None
for i, ln in enumerate(L, 1):
    s = ln.strip()
    if s in ("You said:", "ChatGPT said:"):
        if role == "assistant" and start:
            blocks.append((start, i - 1))
        role = "assistant" if s == "ChatGPT said:" else "user"
        start = i + 1
if role == "assistant" and start:
    blocks.append((start, len(L)))

def in_ranges(a):
    return any(x <= a <= y for x, y in RANGES)

items = []
seen = {}
for bs, be in blocks:
    seg = L[bs - 1:be]
    starts = [k for k, ln in enumerate(seg) if HEADER_RE.match(ln)]
    for n, k in enumerate(starts):
        e = starts[n + 1] if n + 1 < len(starts) else len(seg)
        a, b = bs + k, bs + e - 1
        if not in_ranges(a):
            continue
        body = clean(seg[k:e])
        if len(body) < 8:
            continue
        header = body[0].strip()
        text = "\n".join(body)
        h = hashlib.sha256(norm(text).encode()).hexdigest()
        if h in seen:
            continue
        seen[h] = a
        title = re.sub(r"^\[Scene(?: Shift)?:\s*", "", header.rstrip("]"))
        m = re.search(r"PT (\d+)", header)
        if "Location – Day/Time – Chapter Label" in header or "Location ? Day/Time" in header:
            kind = "template-placeholder"; title = f"Style-guide placeholder scene at line {a}"
        elif m and m.group(1) == "65":
            kind = "recap"; title = f"House Guests PT 65 (assistant recap, line {a})"
        elif m and m.group(1) in ALT_OF:
            kind = "superseded-draft"; title = f"House Guests PT {m.group(1)} (superseded draft, line {a})"
        else:
            kind = "style-sample"
        items.append(dict(a=a, b=b, header=header, title=title, kind=kind, text=text,
                          alt_of=ALT_OF.get(m.group(1)) if m else None,
                          sha=hashlib.sha256(text.encode()).hexdigest()))

# clear previous alt files for raw 3
for fn in os.listdir(OUT):
    if fn.startswith("alt-r3-") and fn.endswith(".md"):
        os.remove(os.path.join(OUT, fn))

rows = []
for it in items:
    fn = f"alt-r3-{it['a']:05d}--{slug(it['title'])}.md"
    fm = ["---", f"name: {yq(it['title'])}", "canon_status: alternate", f"alternate_kind: {it['kind']}"]
    if it["alt_of"]:
        fm.append(f"alternate_of: {yq(it['alt_of'])}")
    fm += ['source_original_file: "Chaos Saga 3.txt"', f"source_lines: \"{it['a']}-{it['b']}\"",
           f"source_file_sha256: {FILE_SHA}", f"source_content_sha256: {it['sha']}", "---", ""]
    open(os.path.join(OUT, fn), "w", encoding="utf-8", newline="\n").write("\n".join(fm) + it["text"] + "\n")
    rows.append((fn, it["kind"], it["alt_of"] or "", f"{it['a']}-{it['b']}", it["title"]))

idx = ["# Raw 3 alternates", "", "Non-canon scene prose from `Chaos Saga 3.txt`: style-guide samples, template placeholders, and superseded drafts of canon scenes. Files here are ignored by the validator and compiler and never import. See `README.md` in this folder.", "",
       "| File | Kind | Alternate of | Lines | Title |", "|---|---|---|---|---|"]
for r in rows:
    idx.append(f"| [{r[0]}]({r[0]}) | {r[1]} | {r[2]} | `{r[3]}` | {r[4]} |")
open(os.path.join(OUT, "_index-raw3.md"), "w", encoding="utf-8", newline="\n").write("\n".join(idx) + "\n")
from collections import Counter
print(len(rows), Counter(r[1] for r in rows))
for r in rows:
    print(r[3], r[1], r[4][:70])
