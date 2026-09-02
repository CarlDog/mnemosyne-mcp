# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8.
"""Chaos Saga scene extractor (dry run by default; --write emits files).

Sources: the operator's raw ChatGPT archive (read-only) plus the reviewed
line-range manifest in canon/scenes/_recovery-source-manifest.tsv.
Prose is copied verbatim; only role sentinels, UI artifacts, and trailing
chat offers are stripped. Metadata goes to frontmatter.
"""
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
import csv, hashlib, os, re, sys, unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

RAW = os.path.join(REPO, "data", "archive", "chatgpt", "Chaos Saga", "Chat", "Archived", "Raw")
STORY = os.path.join(REPO, "data", "stories", "chaos-saga")
SCENES = os.path.join(STORY, "canon", "scenes")
OUT_TSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chaos-scenes-dryrun.tsv")
WRITE = "--write" in sys.argv

FILE_SHA = {}
LINES = {}
for n in (1, 2, 3, 4):
    p = os.path.join(RAW, f"Chaos Saga {n}.txt")
    b = open(p, "rb").read()
    FILE_SHA[n] = hashlib.sha256(b).hexdigest()
    LINES[n] = b.decode("utf-8").split("\n")  # 1-based via idx-1

def L(n, a, b):
    """lines a..b inclusive, 1-based"""
    return LINES[n][a - 1:b]

HEADER_RE = re.compile(r"^\[Scene(?: Shift)?:")
OFFER_RE = re.compile(r"^(Want |Wanna |Should I |Shall I |Let me know|Ready |Would you like|Or want |Or should |Want me |Next up|Say the word|Just say|I can |If you want|Do you want|Up next)", re.I)
UI_RE = re.compile(r"^(Updated saved memory|Skip to content|Chat history|Today|February|Yesterday|Previous 7 Days|\d+/\d+|Thought for .*|Search)$")

ROSTER = ["Carl", "Riley", "Jenna", "Kira", "Vanessa", "Cassie", "Gavin", "Lacey", "Nyx", "Ash", "Lena", "Bryce", "Trip", "Jenny"]
FULL = {"Carl": "Carl Maddox", "Riley": "Riley Quinn", "Jenna": "Jenna Maren", "Kira": "Kira Graves", "Vanessa": "Vanessa Maddox", "Cassie": "Cassie Delaney", "Lacey": "Lacey Summers", "Nyx": "Nyx Valencia"}

# manifest location code -> catalog registry code
CODE_MAP = {"LIV": "HLR", "KIT": "HKT", "POR": "HPO", "BYD": "HBY", "KRM": "HKR", "SUV": "SUV", "BCH": "BCH", "HOU": "HOU", "ENT": "HEN", "WHR": "WHP", "DEK": "HBY", "POL": "HBY", "BAR": "BAR", "CLB": "CLB", "MBR": "HMB", "DIN": "HKT", "CLN": "CLN", "BED": "HOU"}

def clean_block(lines):
    """strip sentinels/UI, trailing offers and blank lines; keep verbatim otherwise"""
    out = []
    for ln in lines:
        s = ln.rstrip("\r")
        if s.strip() in ("You said:", "ChatGPT said:"):
            continue
        if UI_RE.match(s.strip()):
            continue
        if s.strip() == "[Typing...]":
            continue
        out.append(s)
    # trailing offers / blanks
    while out and (out[-1].strip() == "" or OFFER_RE.match(out[-1].strip())):
        out.pop()
    while out and out[0].strip() == "":
        out.pop(0)
    return out

def norm(text):
    t = unicodedata.normalize("NFKC", text).lower()
    t = re.sub(r"[\u2018\u2019\u201c\u201d\"'`]", "", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return t.strip()

def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60].rstrip("-") or "scene"

def participants(body, header):
    counts = Counter()
    speakers = set()
    text = "\n".join(body)
    for nm in ROSTER:
        counts[nm] = len(re.findall(rf"\b{nm}\b", text))
        if re.search(rf"^{nm}\s*(\(|:)", text, re.M) or re.search(rf"^{nm.upper()}\b", text, re.M):
            speakers.add(nm)
    pov_you = bool(re.search(r"^You\s*(\(|:)", text, re.M)) or bool(re.search(r"^\(I ", text, re.M))
    header_names = {nm for nm in ROSTER if re.search(rf"\b{nm}\b", header)}
    if speakers or header_names:
        chosen = [nm for nm in ROSTER if nm in speakers or nm in header_names]
        basis = "speaker-labels"
    else:
        chosen = [nm for nm in ROSTER if counts[nm] >= 2] or [nm for nm in ROSTER if counts[nm] >= 1]
        basis = "mention-based"
    if pov_you and "Carl" not in chosen:
        chosen.insert(0, "Carl")
    return [FULL.get(n, n) for n in chosen], pov_you, basis

LOC_KW = [
    (r"text messages", "TXT"), (r"whole foods|arcade|parking lot|frozen aisle", "WFS"), (r"emergency room|highland", "ERM"),
    (r"uber", "CAR"), (r"carl'?s car|carl’s car", "CAR"), (r"pub|warehouse", "WHP"), (r"bar\b", "BAR"),
    (r"master bed|bedroom", "HMB"), (r"upstairs bathroom|bathroom|shower", "HUB"), (r"upstairs hallway|landing|hallway|upstairs", "HUH"),
    (r"kitchen", "HKT"), (r"backyard|pool|deck|garden|yard", "HBY"), (r"porch", "HPO"), (r"garage", "HGR"),
    (r"living room|couch|downstairs", "HLR"), (r"kira'?s room|kira’s room|guest room|spare", "HKR"), (r"front door|entryway|entry", "HEN"),
]

def guess_loc(header, body):
    h = header.lower()
    for pat, code in LOC_KW:
        if re.search(pat, h):
            return code, "header"
    probe = " ".join(body[1:16]).lower()
    for pat, code in LOC_KW[7:]:
        if re.search(pat, probe):
            return code, "prose-heuristic"
    return "HOU", "unresolved"

def header_title(header):
    h = header.strip().rstrip("]")
    h = re.sub(r"^\[Scene(?: Shift)?:\s*", "", h)
    parts = re.split(r"\s+[–—-]\s+", h)
    if len(parts) >= 3 and re.search(r"recovery", parts[1], re.I):
        return parts[-1].strip()
    if len(parts) >= 2 and re.search(r"recovery", parts[0] + parts[1], re.I):
        return parts[-1].strip()
    return h.strip()

def rec_day(header):
    m = re.search(r"Day (\d+)", header)
    return int(m.group(1)) if m else None

def rec_time(header):
    m = re.search(r"Day \d+,\s*([A-Za-z ]+?)\s*[–—-]", header)
    return m.group(1).strip().lower() if m else None

scenes = []  # dicts

def add(src, a, b, body, header, anchor, loc, loc_basis, status, flags, title=None, native=None):
    had_user_turn = any(ln.strip() == "You said:" for ln in body)
    body = clean_block(body)
    if len(body) < 4:
        return
    parts, pov, pbasis = participants(body, header)
    if had_user_turn and src == 2:
        pov = True
        if "Carl Maddox" not in parts:
            parts.insert(0, "Carl Maddox")
    text = "\n".join(body)
    flags = list(flags)
    if pbasis == "mention-based":
        flags.append("PARTICIPANTS_MENTION_BASED")
    if len(text) > 8000:
        flags.append("LONG_UNIT_SPLIT_PENDING")
    scenes.append(dict(src=src, lines=f"{a}-{b}", header=header, title=title or header_title(header), anchor=anchor,
                       loc=loc, loc_basis=loc_basis, status=status, flags=flags, parts=parts, pov=pov, pbasis=pbasis,
                       text=text, nsha=sha(norm(text)), sha=sha(text), day=rec_day(header), tod=rec_time(header), native=native))

# ---------------------------------------------------------------- Raw 1 units
RAW1_UNITS = [  # (start, end, event, title, loc, flags) -- full coverage of Raw 1, re-cut 2026-09-02
    (1, 76, 2, "Three Raccoons Texts", "TXT", ["BROKEN_TEXT_64_65"]),
    (77, 226, 2, "The Blonde with the Convertible", "TXT", ["THIN_CONNECTIVE"]),
    (227, 284, 4, "Relapse Confession", "TXT", []),
    (285, 988, 4, "Antisocial Day: Songs, Stories, and Riley's Past", "TXT", ["THIN_CONNECTIVE", "MEETING_STORY_CONTRADICTS_OPEN_THREAD"]),
    (989, 1223, 3, "New Year's Kiss and the Dam Pact", "TXT", []),
    (1224, 1720, 5, "Matches, Outfits, and the Pub Dare", "TXT", ["THIN_CONNECTIVE"]),
    (1721, 2049, 6, "Jenny, Cassie, and the Text That Lit the Fuse", "TXT", []),
    (2050, 3270, 4, "Truth or Truth (11:30p Wednesday)", "TXT", []),
    (3271, 3397, 5, "The Million-Dollar Question", "TXT", []),
    (3398, 3480, 6, "Thursday 2:34p: Before the Cassie Date", "TXT", ["THIN_CONNECTIVE"]),
    (3481, 3638, 6, "Cassie-Date Postmortem", "TXT", []),
    (3639, 3861, 7, "Tattoos and Tacos Are Forever", "TXT", ["THIN_CONNECTIVE"]),
    (3862, 4011, 7, "Taco Prelude", "TXT", []),
    (4012, 4777, 7, "Midnight Tacos and the Safe Place", "HLR", []),
    (4778, 5851, 8, "The Hoodie, the Accidental Love, and the Sunrise", "HOU", []),
    (5852, 6193, 9, "Move-In Agreement", "HOU", ["DO_NOT_IMPLY_MOVE_HAPPENED"]),
    (6194, 6480, 9, "Rileytopia and the Nap Upstairs", "HMB", ["THIN_CONNECTIVE"]),
    (6481, 6753, 10, "Date Moved Up; Carl Realizes Home", "HOU", []),
    (6755, 7064, 10, "Red Dress Flashback", "CAR", []),
    (7065, 7181, 10, "Bearded Bond Pickup (part 1)", "CAR", ["CROSS_FILE_UNIT_CONTINUES_RAW2_89-168"]),
]
for (a, b, ev, title, loc, flags) in RAW1_UNITS:
    body = L(1, a, b)
    chat = not HEADER_RE.match(body[0])
    header = body[0] if not chat else f"[Scene: {title}]"
    add(1, a, b, body, header, f"pivotal-event:{ev}", loc, "inventory", "established", flags + (["CHAT_FORMAT"] if chat else []), title=title)

# ---------------------------------------------------------------- Raw 2
RAW2_EVENT_BREAKS = [(89, 10), (169, 11), (1084, 11), (1416, 12), (1941, 13), (2088, 14), (2777, 15), (2998, 15), (3035, 16), (3301, 17), (3445, 18), (3510, 19), (3678, None)]
def raw2_event(line):
    ev = None
    for start, e in RAW2_EVENT_BREAKS:
        if line >= start:
            ev = e
    return ev
RAW2_UNITS = [(89, 168), (169, 1083), (1084, 1415), (1416, 1940), (2088, 2446), (2777, 2992), (3182, 3299), (3305, 3443), (3453, 3508), (3512, 3629), (3680, 3783), (4006, 4495), (4499, 4865), (4872, 6282), (7485, 7809), (8008, 8176), (8625, 8703), (8778, 9095), (9408, 9818), (9824, 10021), (10069, 10145)]
def in_unit(a):
    return any(u[0] <= a <= u[1] for u in RAW2_UNITS)
RAW2_UNIT_FLAGS = {(169, 1083): ["INCIDENTAL_PATRONS_DRAFT_LEVEL"], (1084, 1415): ["VENUE_NOT_LOCKED"], (2088, 2446): ["REAL_BEGINNING_OVERSTATES_PERMANENCE"], (2777, 2992): ["RECONCILE_WHOLLY_HEALED_CLAIMS"], (3453, 3508): ["JENNA_NOT_FIANCEE"], (3512, 3629): ["REMOVE_ENGAGED_TRIO_VENUE_UNCORROBORATED"], (3680, 3783): ["NORMALIZE_APARTMENT_TO_CHAOS_HOUSE"], (4499, 4865): ["SOURCE_SKIPS_PT4_NORMALIZE_APARTMENT"], (7485, 7809): ["DAY_CYCLE_IMPOSSIBLE_RELATIVE_ORDER_ONLY"], (8778, 9095): ["RAW_PT50_REUSED"], (9824, 10021): ["INCOMPLETE_RUPTURE_CONTINUES_RAW3"]}
def unit_flags(a):
    for u, f in RAW2_UNIT_FLAGS.items():
        if u[0] <= a <= u[1]:
            return list(f)
    return []

# headerless role-play units kept whole
for (a, b, title, ev, loc) in [(89, 168, "Bearded Bond Pickup (part 2)", 10, "CAR"), (169, 1083, "First Warehouse Pub Night", 11, "WHP"), (1084, 1415, "Jenna's Post-Shift Dive", 11, "BAR"), (1416, 1940, "Uber, Bed Infiltration, and Dawn Confessions", 12, "HMB")]:
    body = L(2, a, b)
    header = body[0] if HEADER_RE.match(body[0]) else f"[Scene: {title}]"
    add(2, a, b, body, header, f"pivotal-event:{ev}", loc, "inventory", "established", unit_flags(a) + ["ROLEPLAY_UNIT_KEPT_WHOLE"], title=title)

# Raw 2 full-coverage pass (2026-09-02): the two headerless role-play gaps that hold in-scene
# dialogue (the operator plays Carl). Keys use the pre-first-beat slot "00" so existing keys stay.
RAW2_EXTRA = [
    (1941, 2047, 13, "Omelettes and the Cult of Cheese", "HKT", "00"),
    (2692, 2776, 15, "Another Show", "HMB", "00"),
]
for (a, b, ev, title, loc, slot) in RAW2_EXTRA:
    body = L(2, a, b)
    add(2, a, b, body, f"[Scene: {title}]", f"pivotal-event:{ev}", loc, "inventory", "established", ["THIN_CONNECTIVE", "ROLEPLAY_UNIT_KEPT_WHOLE"], title=title)
    scenes[-1]["fixed_beat"] = slot

# assistant-side headered scenes from 1941 to end
lines2 = LINES[2]
role = None; block_start = None; blocks = []
for i, ln in enumerate(lines2, 1):
    s = ln.strip()
    if s == "You said:" or s == "ChatGPT said:":
        if role == "assistant" and block_start:
            blocks.append((block_start, i - 1))
        role = "assistant" if s == "ChatGPT said:" else "user"
        block_start = i + 1
if role == "assistant" and block_start:
    blocks.append((block_start, len(lines2)))
for (bs, be) in blocks:
    if be < 1941:
        continue
    seg = L(2, bs, be)
    starts = [i for i, ln in enumerate(seg) if HEADER_RE.match(ln)]
    for k, s in enumerate(starts):
        e = starts[k + 1] if k + 1 < len(starts) else len(seg)
        body = seg[s:e]
        a, b = bs + s, bs + e - 1
        if 10028 <= a <= 10068:
            continue  # truncated first attempt, excluded by inventory
        header = body[0]
        d = rec_day(header)
        if not d and a >= 3678 and scenes and scenes[-1]["anchor"].startswith("recovery-day:"):
            d = int(scenes[-1]["anchor"].split(":")[1])  # sub-scene header inherits its day
            header = header  # keep verbatim; anchor inherited
        if d:
            anchor = f"recovery-day:{d}"
            loc, basis = guess_loc(header, body)
        else:
            ev = raw2_event(a)
            anchor = f"pivotal-event:{ev}" if ev else "unanchored"
            loc, basis = guess_loc(header, body)
        status = "established" if in_unit(a) else "review"
        flags = unit_flags(a) + ([] if in_unit(a) else ["UNCORROBORATED_CONNECTIVE_BEAT"]) + ([f"LOC_{basis.upper()}"] if basis != "header" else [])
        add(2, a, b, body, header, anchor, loc, basis, status, flags)

# ---------------------------------------------------------------- Raw 3 / 4 manifest
with open(os.path.join(SCENES, "_recovery-source-manifest.tsv"), encoding="utf-8") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        n = 3 if row["source"].startswith("Chaos Saga 3") else 4
        a, b = map(int, row["lines"].split("-"))
        body = L(n, a, b)
        header = body[0]
        d = rec_day(header) or int(re.match(r"R(\d+)", row["source_locator"]).group(1))
        code = CODE_MAP[row["location_code"]]
        flags = [x for x in row["flags"].split("|") if x]
        status = "established" if row["status"] == "source-confirmed" else "candidate"
        if row["location_code"] == "BED":
            flags.append("LOC_ROOM_UNCERTAIN")
        add(n, a, b, body, header, f"recovery-day:{d}", code, "manifest", status, flags, title=row["title"], native=row["source_locator"])

# ---------------------------------------------------------------- dedupe, order, keys
seen = {}
kept = []
for sc in scenes:
    if sc["nsha"] in seen:
        sc["dup_of"] = seen[sc["nsha"]]
        continue
    seen[sc["nsha"]] = f"{sc['src']}:{sc['lines']}"
    kept.append(sc)

def order_key(sc):
    src = sc["src"]; a = int(sc["lines"].split("-")[0])
    return (src, a)
kept.sort(key=order_key)

# disambiguate duplicate titles within an anchor
by_anchor_title = defaultdict(list)
for sc in kept:
    by_anchor_title[(sc["anchor"], sc["title"])].append(sc)
for (anchor, title), lst in by_anchor_title.items():
    if len(lst) > 1:
        for i, sc in enumerate(lst):
            suffix = sc["tod"].title() if sc["tod"] and len({x["tod"] for x in lst}) == len(lst) else chr(65 + i)
            sc["title"] = f"{title} ({suffix})"
            sc["flags"].append("DUP_TITLE")

beat = Counter()
for sc in kept:
    anc = sc["anchor"]
    if anc.startswith("recovery-day:"):
        tok = f"R{int(anc.split(':')[1]):03d}"
    elif anc.startswith("pivotal-event:"):
        tok = f"{int(anc.split(':')[1]):03d}"
    else:
        tok = "X000"
    if sc.get("fixed_beat"):
        sc["key"] = f"CS-{tok}-{sc['fixed_beat']}-{sc['loc']}"
    else:
        beat[tok] += 1
        sc["key"] = f"CS-{tok}-{beat[tok]:02d}-{sc['loc']}"
    sc["file"] = f"{sc['key'].lower()}--{slug(sc['title'])}.md"

base = datetime(2025, 2, 1, 0, 0, tzinfo=timezone(timedelta(hours=-6)))
prev = None
for i, sc in enumerate(kept):
    # deterministic: one raw source per 25-day block, one minute per source line,
    # so insertions never shift other scenes' timestamps
    start = int(sc["lines"].split("-")[0])
    sc["created_at"] = (base + timedelta(days=25 * (sc["src"] - 1), minutes=start)).isoformat()
    sc["follows"] = prev
    prev = sc["key"]

# ---------------------------------------------------------------- report
with open(OUT_TSV, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["key", "file", "src", "lines", "anchor", "tod", "loc", "loc_basis", "status", "flags", "participants", "pov_you", "chars", "sha256", "title", "header"])
    for sc in kept:
        w.writerow([sc["key"], sc["file"], sc["src"], sc["lines"], sc["anchor"], sc["tod"] or "", sc["loc"], sc["loc_basis"], sc["status"], "|".join(sc["flags"]), "; ".join(sc["parts"]), sc["pov"], len(sc["text"]), sc["sha"][:12], sc["title"], sc["header"][:90]])
dups = [sc for sc in scenes if sc.get("dup_of")]
print(f"scenes kept: {len(kept)}  duplicates skipped: {len(dups)}")
print("by source:", Counter(sc["src"] for sc in kept))
print("by status:", Counter(sc["status"] for sc in kept))
print("by loc:", Counter(sc["loc"] for sc in kept))
print("loc basis:", Counter(sc["loc_basis"] for sc in kept))
print("keys unique:", len({sc["key"] for sc in kept}) == len(kept))
print("files unique:", len({sc["file"] for sc in kept}) == len(kept))
for sc in dups[:12]:
    print("  dup", sc["src"], sc["lines"], "of", sc["dup_of"], "|", sc["title"][:50])

# ---------------------------------------------------------------- write
def yq(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

if WRITE:
    # remove previously extracted files (those carrying source_original_file) so re-cuts leave no strays
    for fn in os.listdir(SCENES):
        if fn.startswith("cs-") and fn.endswith(".md"):
            p = os.path.join(SCENES, fn)
            if "source_original_file:" in open(p, encoding="utf-8").read(2000):
                os.remove(p)
    for sc in kept:
        fm = ["---", f'catalog_key: {yq(sc["key"])}', f'name: {yq(sc["title"])}']
        if sc["native"]:
            fm.append(f'native_scene_id: {yq(sc["native"])}')
        fm += [f'canon_status: {sc["status"]}', f'timeline_anchor: {yq(sc["anchor"])}']
        if sc["tod"]:
            fm.append(f'story_time: {yq(sc["tod"])}')
        fm += [f'location_code: {sc["loc"]}', f'location_basis: {sc["loc_basis"]}',
               'participants: [' + ", ".join(yq(p) for p in sc["parts"]) + ']', f'participants_basis: "auto-derived ({sc["pbasis"]})"']
        if sc["pov"]:
            fm.append('pov: "second-person role-play; \\"You\\" is Carl Maddox"')
        if sc["follows"]:
            fm.append(f'follows: {yq(sc["follows"])}')
        fm += [f'created_at: {yq(sc["created_at"])}', 'created_at_basis: "synthetic: 2025-02-01 + 25 days per raw file + 1 minute per source line; raw archive mtime 2025-05-03"', 'pinned: false', 'tags: []']
        if sc["flags"]:
            fm.append('review_flags: [' + ", ".join(yq(x) for x in sc["flags"]) + ']')
        fm += [f'source_original_file: {yq("Chaos Saga " + str(sc["src"]) + ".txt")}', f'source_lines: {yq(sc["lines"])}',
               f'source_file_sha256: {FILE_SHA[sc["src"]]}', f'source_content_sha256: {sc["sha"]}', "---", ""]
        content = "\n".join(fm) + sc["text"] + "\n"
        open(os.path.join(SCENES, sc["file"]), "w", encoding="utf-8", newline="\n").write(content)
    print("written", len(kept))
