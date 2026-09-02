"""Extract the Homecoming Fatigue share chat (events 34/35) into canon scene
files (the chat's own locked export blocks) plus alternates (interactive play,
the botched export block, the truncated long-form export). Verbatim text."""
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
import hashlib, os, re, unicodedata

SID = "6a8fde8e-b1a8-83ea-8bdc-f6d16149654a"
SRC = os.path.join(REPO, "data", "stories", "chaos-saga", "exports", "raw-chatgpt-shares", f"{SID}.txt")
SRC_REL = f"data/stories/chaos-saga/exports/raw-chatgpt-shares/{SID}.txt"
SCENES = os.path.join(REPO, "data", "stories", "chaos-saga", "canon", "scenes")
ALT = os.path.join(SCENES, "_alternates")
raw = open(SRC, "rb").read(); FILE_SHA = hashlib.sha256(raw).hexdigest()
L = raw.decode("utf-8").split("\n")

STOP = re.compile(r"^\**(\[Scene|Scene Lock Status|Scene IDs?:|\[EXPORT|\[CORRECTED|Chapter Complete|Export Complete|Reply “Next”|Reply \"Next\")")
OFFER = re.compile(r"^(\*\*)?(Want |Would you like|Let me know|Ready |Reply |— \(continued|—$|---$)", re.I)

def yq(s): return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60].rstrip("-")

def span_from_header(a):
    """header at line a; run until a stop marker, then trim trailing separators/offers"""
    out = [L[a - 1].rstrip("\r")]
    i = a
    while i < len(L):
        s = L[i].strip()
        if s in ("You said:", "ChatGPT said:") or STOP.match(s):
            break
        out.append(L[i].rstrip("\r")); i += 1
    while out and (out[-1].strip() == "" or OFFER.match(out[-1].strip())):
        out.pop()
    return out, a + len(out) - 1

def unit(a, b):
    out = []
    for ln in L[a - 1:b]:
        s = ln.rstrip("\r")
        if s.strip() in ("You said:", "ChatGPT said:"): continue
        out.append(s)
    while out and (out[-1].strip() == "" or OFFER.match(out[-1].strip())): out.pop()
    while out and out[0].strip() == "": out.pop(0)
    return out

def parts_of(text):
    names = [("Carl", "Carl Maddox"), ("Riley", "Riley Quinn"), ("Jenna", "Jenna Maren")]
    return [full for nm, full in names if re.search(rf"\b{nm}\b", text)]

def write_canon(key, a, title, ev, tod, date, loc, native, status, flags, follows):
    body, b = span_from_header(a)
    text = "\n".join(body)
    fm = ["---", f"catalog_key: {yq(key)}", f"name: {yq(title)}"]
    if native: fm.append(f"native_scene_id: {yq(native)}")
    fm += [f"canon_status: {status}", f"timeline_anchor: {yq(f'pivotal-event:{ev}')}", f"story_time: {yq(f'{date} / {tod}')}",
           f"location_code: {loc}", "location_basis: header",
           "participants: [" + ", ".join(yq(p) for p in parts_of(text)) + "]", 'participants_basis: "auto-derived (mention-based)"']
    if follows: fm.append(f"follows: {yq(follows)}")
    fm += [f"created_at: {yq(f'{date}T{tod}:00-05:00')}", 'created_at_basis: "in-world date/time from the scene header; this chat carries real dates"', "pinned: false", "tags: []"]
    if flags: fm.append("review_flags: [" + ", ".join(yq(x) for x in flags) + "]")
    fm += [f"source_export: {yq(SRC_REL)}", f"source_share_url: {yq('https://chatgpt.com/share/' + SID)}", f"source_lines: \"{a}-{b}\"",
           f"source_file_sha256: {FILE_SHA}", f"source_content_sha256: {hashlib.sha256(text.encode()).hexdigest()}", "---", ""]
    fn = f"{key.lower()}--{slug(title)}.md"
    open(os.path.join(SCENES, fn), "w", encoding="utf-8", newline="\n").write("\n".join(fm) + text + "\n")
    return fn, a, b, len(text)

def write_alt(a, b, title, kind, alt_of, flags):
    body = unit(a, b); text = "\n".join(body)
    fm = ["---", f"name: {yq(title)}", "canon_status: alternate", f"alternate_kind: {kind}"]
    if alt_of: fm.append(f"alternate_of: {yq(alt_of)}")
    if flags: fm.append("review_flags: [" + ", ".join(yq(x) for x in flags) + "]")
    fm += [f"source_export: {yq(SRC_REL)}", f"source_lines: \"{a}-{b}\"", f"source_file_sha256: {FILE_SHA}", f"source_content_sha256: {hashlib.sha256(text.encode()).hexdigest()}", "---", ""]
    fn = f"alt-hf-{a:05d}--{slug(title)}.md"
    open(os.path.join(ALT, fn), "w", encoding="utf-8", newline="\n").write("\n".join(fm) + text + "\n")
    return fn, a, b, kind, alt_of or "", title

# clear previous
for d, pre in ((SCENES, "cs-03"), (ALT, "alt-hf-")):
    for fn in os.listdir(d):
        if fn.startswith(pre) and fn.endswith(".md") and (pre != "cs-03" or fn.startswith(("cs-034-", "cs-035-"))):
            os.remove(os.path.join(d, fn))

# ---- canon: event 35 (May 8, Export Block 5) then event 34 (May 10, Blocks 1-4)
CANON = [
    ("CS-035-01-HLR", 4408, "The Weight That Follows You Home", 35, "17:30", "2025-05-08", "HLR", "CH-048-Homecoming", "locked", []),
    ("CS-035-02-HLR", 4436, "You Don't Have to Say Anything", 35, "17:39", "2025-05-08", "HLR", None, "locked", ["NATIVE_ID_SHARED_CH-048"]),
    ("CS-035-03-HLR", 4464, "Lightning and Laughter", 35, "17:45", "2025-05-08", "HLR", None, "locked", ["NATIVE_ID_SHARED_CH-048"]),
    ("CS-035-04-HLR", 4492, "You're Not Jenna / You're Not Riley", 35, "17:55", "2025-05-08", "HLR", None, "locked", ["NATIVE_ID_SHARED_CH-048"]),
    ("CS-035-05-HKT", 4506, "Cheesy Love-Bread & Emotional Armor", 35, "18:12", "2025-05-08", "HKT", "CH-049-CheesyBread", "locked", []),
    ("CS-035-06-HLR", 4532, "Monty Python and Domestic Peace", 35, "20:43", "2025-05-08", "HLR", "CH-050-MontyPython", "locked", []),
    ("CS-034-02-SUV", 3552, "The Drive", 34, "11:18", "2025-05-10", "SUV", "CH-051-TheDrive", "locked", []),
    ("CS-034-03-AMP", 3756, "Foreplay", 34, "12:44", "2025-05-10", "AMP", "CH-052-Foreplay", "locked", ["CORRECTED_EXPORT_BLOCK_2"]),
    ("CS-034-04-AMP", 3834, "Cotton Candy Chaos", 34, "14:03", "2025-05-10", "AMP", "CH-053-CottonCandyChaos", "locked", ["CORRECTED_EXPORT_BLOCK_2"]),
    ("CS-034-05-AMP", 3987, "Wet Chaos and Camera Flashbacks", 34, "15:22", "2025-05-10", "AMP", "CH-054-TheLogRide", "locked", []),
    ("CS-034-06-AMP", 4126, "Penance", 34, "18:12", "2025-05-10", "AMP", "CH-055-Penance", "locked", []),
    ("CS-034-07-SUV", 4256, "The Ride Home", 34, "19:07", "2025-05-10", "SUV", "CH-056-RideHome", "locked", []),
    ("CS-034-08-HLR", 4289, "Soft Coda", 34, "19:52", "2025-05-10", "HLR", "CH-057-SoftCoda", "locked", []),
]
rows = []; prev = None
for key, a, title, ev, tod, date, loc, native, status, flags in CANON:
    flags = list(flags) + ["EVENT_NUMBER_ORDER_CONTRADICTS_DATES"]
    fn, a, b, n = write_canon(key, a, title, ev, tod, date, loc, native, status, flags, prev)
    rows.append((key, fn, f"{a}-{b}", n, status)); prev = key

# Tickets, Temptation, and Tactical Evasion: interactive only, never exported; canon per lore record, status review
body = unit(1487, 2645); text = "\n".join(body)
fm = ["---", 'catalog_key: "CS-034-01-HBY"', 'name: "Tickets, Temptation, and Tactical Evasion"', "canon_status: review",
      'timeline_anchor: "pivotal-event:34"', 'story_time: "2025-05-10 / 09:42"', "location_code: HBY", "location_basis: header",
      "participants: [" + ", ".join(yq(p) for p in parts_of(text)) + "]", 'participants_basis: "auto-derived (mention-based)"',
      'pov: "interactive play; the operator writes Carl in prose turns"', 'created_at: "2025-05-10T09:42:00-05:00"',
      'created_at_basis: "in-world date/time from the scene header; this chat carries real dates"', "pinned: false", "tags: []",
      'review_flags: ["INTERACTIVE_NOT_EXPORTED", "NOT_IN_CHAPTER_LOCK_LIST", "CANON_PER_LORE_RECORD", "LONG_UNIT_SPLIT_PENDING", "EVENT_NUMBER_ORDER_CONTRADICTS_DATES"]',
      f"source_export: {yq(SRC_REL)}", f"source_share_url: {yq('https://chatgpt.com/share/' + SID)}", 'source_lines: "1487-2645"',
      f"source_file_sha256: {FILE_SHA}", f"source_content_sha256: {hashlib.sha256(text.encode()).hexdigest()}", "---", ""]
fn = "cs-034-01-hby--tickets-temptation-and-tactical-evasion.md"
open(os.path.join(SCENES, fn), "w", encoding="utf-8", newline="\n").write("\n".join(fm) + text + "\n")
rows.append(("CS-034-01-HBY", fn, "1487-2645", len(text), "review"))

# ---- alternates
ALTS = [
    (81, 264, "Homecoming interactive: The Weight That Follows You Home (Carl)", "interactive-play", "CS-035-01-HLR"),
    (265, 320, "Homecoming interactive: Jenna's POV", "interactive-play", "CS-035-02-HLR"),
    (321, 1016, "Homecoming interactive: Riley's POV through the naming", "interactive-play", "CS-035-04-HLR"),
    (1017, 1344, "Homecoming interactive: Kitchen, Something Like Home, through Monty Python", "interactive-play", "CS-035-05-HKT"),
    (2646, 2757, "Cotton Candy interactive: The Drive", "interactive-play", "CS-034-02-SUV"),
    (2758, 2845, "Cotton Candy interactive: Foreplay", "interactive-play", "CS-034-03-AMP"),
    (2846, 2989, "Cotton Candy interactive: Cotton Candy Chaos", "interactive-play", "CS-034-04-AMP"),
    (2990, 3189, "Cotton Candy interactive: Log Ride", "interactive-play", "CS-034-05-AMP"),
    (3190, 3329, "Cotton Candy interactive: Penance", "interactive-play", "CS-034-06-AMP"),
    (3330, 3411, "Cotton Candy interactive: The Ride Home", "interactive-play", "CS-034-07-SUV"),
    (3412, 3460, "Cotton Candy interactive: Cool Water & Quiet Smiles", "interactive-play", "CS-034-08-HLR"),
    (3617, 3664, "Export Block 2 first issue: Foreplay (truncated, superseded)", "superseded-draft", "CS-034-03-AMP"),
    (3665, 3740, "Export Block 2 first issue: Cotton Candy Chaos (truncated, superseded)", "superseded-draft", "CS-034-04-AMP"),
    (4626, 4922, "Full long-form export, block 1 of ? (chat ends here)", "long-form-export-partial", "CS-035-01-HLR"),
]
arows = []
for a, b, title, kind, ao in ALTS:
    flags = ["INTERACTIVE_WITH_OPERATOR_TURNS"] if kind == "interactive-play" else (["TRUNCATED_AT_CHAT_END"] if "long-form" in kind else [])
    arows.append(write_alt(a, b, title, kind, ao, flags))

# indexes
idx = ["# Homecoming Fatigue share-chat alternates", "", f"Interactive play, the botched first export block, and the truncated long-form export from the ChatGPT share chat `{SID}` (events 34 and 35). The established versions are the chat's own locked export blocks, extracted as canon scenes `CS-034-*` and `CS-035-*`.", "", "| File | Kind | Alternate of | Lines | Title |", "|---|---|---|---|---|"]
for r in arows: idx.append(f"| [{r[0]}]({r[0]}) | {r[3]} | {r[4]} | `{r[1]}-{r[2]}` | {r[5]} |")
open(os.path.join(ALT, "_index-homecoming.md"), "w", encoding="utf-8", newline="\n").write("\n".join(idx) + "\n")

sec = ["", "## Homecoming Fatigue share chat (events 34 and 35, extracted 2026-09-02)", "", f"Source: `{SRC_REL}` (share `{SID}`). The chat's own locked export blocks are the established text; keys anchor to the timeline's event numbers even though the dates run the other way (May 8 Homecoming precedes May 10 Cotton Candy).", "", "| Catalog key | Scene | Status | Source lines | Chars |", "|---|---|---|---|---:|"]
for key, fn, ln, n, st in sorted(rows):
    sec.append(f"| `{key}` | [{fn.split('--')[1][:-3].replace('-', ' ')}]({fn}) | {st} | `{ln}` | {n} |")
p = os.path.join(SCENES, "_index.md"); s = open(p, encoding="utf-8").read()
s = s.split("\n## Homecoming Fatigue share chat")[0].rstrip("\n") + "\n" + "\n".join(sec) + "\n"
open(p, "w", encoding="utf-8", newline="\n").write(s)
for r in sorted(rows): print(r)
print("alts", len(arows))
