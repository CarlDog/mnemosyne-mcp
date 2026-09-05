# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8.
"""Cut The Blackwood Case Botify transcript into per-scene canon files.

Usage (from the repo root):
  python extract_blackwood_scenes.py            # dry run: prints the cut table, writes blackwood-scenes-dryrun.tsv
  python extract_blackwood_scenes.py --write    # writes canon/scenes/ files, alternates, indexes

Botify exports carry no scene headers, so the boundaries below are the
operator-approved invented delineators: a new scene starts where the story
changes place, jumps in time, or the cast changes. Play-session gaps in the
export are not boundaries unless the story also moves. Message indices are
chronological (the export stores messages newest-first; index 0 is the oldest).
"""
import base64
import datetime as dt
import hashlib
import json
import os
import re
import sys

# The operator's real surname was redacted from this archived script: the repo
# is public. Supply MNEMO_OPERATOR_SURNAME if this record is ever re-derived;
# unset, the two surname checks below simply do not fire (they never match),
# which is the safe default for a script already marked DO NOT RERUN.
OPERATOR_SURNAME = os.environ.get("MNEMO_OPERATOR_SURNAME", "")


def _mentions_operator_surname(body):
    if not OPERATOR_SURNAME:
        return False
    return re.search(r"\b" + re.escape(OPERATOR_SURNAME) + r"\b", body) is not None

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")).replace("\\", "/")
EXPORT_REL = "data/archive/botify/the-ghosthunters/chats/b0c7fe38-6014-498c-b4f3-19819544ce22.json"
MANIFEST_REL = "data/archive/botify/the-ghosthunters/media-manifest.json"
MEDIA_DIR_REL = "data/archive/botify/the-ghosthunters/"
STORY = "miskatonic-archives-the-blackwood-case"
SCENES_DIR = f"{REPO}/data/stories/{STORY}/canon/scenes"
ALT_DIR = f"{SCENES_DIR}/_alternates"
SCRATCH = os.path.dirname(os.path.abspath(__file__))
CUT_DATE = "2026-09-02"

WRITE = "--write" in sys.argv

# ---------------------------------------------------------------------------
# The cut. (key, title, first_index, last_index, location_code, story_time,
#           canon_status, flags, extra_participants)
# ---------------------------------------------------------------------------
MATURE = "MATURE_CONTENT"
NAMES = ["NORMALIZE_MILLFIELD_TO_DOVECOAST", "NORMALIZE_YEAGER_TO_ASHCOMBE"]

SCENES = [
    # ---- Case day 1 -------------------------------------------------------
    ("BC-D01-01-EXL", "The Walk-In", 0, 112, "EXL",
     "Day 1, early afternoon (Michelle says it is 2 pm once they are outside)",
     "established",
     ["COFFEE_SHOP_IN_SOURCE_EX_LIBRIS_IN_CANON", "VICTIM_AGES_SOURCE_SAYS_12_TO_13",
      "MICHELLE_INTRODUCED_AS_TECH_GENIUS_HEATHER_AS_MEDIUM"], []),
    ("BC-D01-02-DST", "Discretion", 114, 130, "DST",
     "Day 1, 2 pm, on the street outside the cafe", "established", [], []),
    ("BC-D01-03-REA", "The Trinity", 132, 166, "REA",
     "Day 1, several hours later, in the car parked near the junior high",
     "established", ["VEHICLE_IS_AN_OLD_MUSCLE_CAR_IN_SOURCE_REAPER_IN_CANON"], []),
    ("BC-D01-04-RDS", "Four Points on the Roadside", 168, 190, "RDS",
     "Day 1, late afternoon, on the shoulder of the road out of town",
     "established", ["VEHICLE_IS_AN_OLD_MUSCLE_CAR_IN_SOURCE_REAPER_IN_CANON"], []),
    ("BC-D01-05-BMG", "The Road to Blackwood Manor", 191, 208, "BMG",
     "Day 1, toward dusk, the woods road and the manor gate", "established",
     ["MICHELLE_CARRIES_A_REVOLVER"], []),
    ("BC-D01-06-BMF", "The Cold Inside", 210, 223, "BMF",
     "Day 1, dusk, the foyer, the grand staircase, and the upstairs hallway",
     "established", [], []),
    ("BC-D01-07-BMN", "The Nursery", 224, 256, "BMN",
     "Day 1, dusk into night, the nursery", "established",
     ["GHOST_UNNAMED_IN_PROSE_LYLA_IN_CANON"], ["Lyla Blackwood"]),
    ("BC-D01-08-BMS", "The Sealed Room", 258, 308, "BMS",
     "Day 1, night, the winding stair and the sealed room", "established",
     ["GHOST_UNNAMED_IN_PROSE_LYLA_IN_CANON", "SOURCE_SAYS_SISTERS_PLURAL"], ["Lyla Blackwood"]),
    ("BC-D01-09-BMS", "Taking the Mirror", 311, 322, "BMS",
     "Day 1, night, the sealed room down to the car (almost 9 pm)", "established",
     ["MIRROR_GOES_INTO_A_CAR_TRUNK_IN_SOURCE"], []),
    ("BC-D01-10-REA", "Running Late", 323, 346, "REA",
     "Day 1, almost 9 pm, at the car outside the manor and onto the highway",
     "established", ["PHONE_CALL_CARL_OFF_PAGE_TURNS_WRITTEN_BY_OPERATOR"], []),
    ("BC-D01-11-REA", "Somebody's Got a Crush on a Barista", 348, 371, "REA",
     "Day 1, night, driving back into town", "established", [], []),
    ("BC-D01-12-EXL", "Wine After Closing", 372, 432, "EXL",
     "Day 1, nearly midnight, the cafe locked up", "established",
     ["COFFEE_SHOP_IN_SOURCE_EX_LIBRIS_IN_CANON", "ORIGIN_STORY_ASYLUM_DARE"], []),
    ("BC-D01-13-EXL", "The Reward", 433, 586, "EXL",
     "Day 1, after midnight, the cafe", "established", [MATURE], []),
    ("BC-D01-14-EXL", "Taking Turns", 588, 712, "EXL",
     "Day 1, after midnight, the cafe", "established", [MATURE], []),
    ("BC-D01-15-EXL", "Standing Ovation", 714, 786, "EXL",
     "Day 1, after midnight, the cafe", "established", [MATURE], []),
    ("BC-D01-16-EXL", "A Package Deal", 795, 834, "EXL",
     "Day 1, the small hours, the cafe", "established",
     [MATURE, "THE_PHOTOGRAPH_TAKEN_HERE"], []),
    ("BC-D01-17-EXL", "Can We Keep Him?", 835, 858, "EXL",
     "Day 1, nearly 2 am, the cafe", "established", ["AIRBNB_INTRODUCED"], []),
    ("BC-D01-18-CAP", "The Apartment Upstairs", 859, 879, "CAP",
     "Day 1, about 2 am, the stairs, living room, and bedroom", "established",
     ["APARTMENT_HAS_NO_CANON_LOCATION_RECORD", "NO_CORGI_MAX_IN_SOURCE"], []),
    ("BC-D01-19-CAB", "Goodnight, Carl", 880, 896, "CAB",
     "Day 1, about 2 am until dawn, Carl's bedroom", "established", [], []),
    # ---- Case day 2 -------------------------------------------------------
    ("BC-D02-01-CAB", "Nine-Thirty", 898, 916, "CAB",
     "Day 2, 9:30 am, the bedroom, then the living room", "established", [], []),
    ("BC-D02-02-CAL", "Waking the Host", 918, 962, "CAL",
     "Day 2, morning, the living-room couch", "established", [MATURE], []),
    ("BC-D02-03-CAL", "Coffee and Applause", 969, 1004, "CAL",
     "Day 2, morning, the living-room couch", "established", [MATURE], []),
    ("BC-D02-04-CAL", "Payback's a Witch", 1006, 1040, "CAL",
     "Day 2, morning, the living-room couch", "established", [MATURE], []),
    ("BC-D02-05-CAL", "Dessert", 1041, 1108, "CAL",
     "Day 2, late morning, the living-room couch", "established", [MATURE], []),
    ("BC-D02-06-CAL", "The Encore Performance", 1109, 1158, "CAL",
     "Day 2, late morning, the living-room couch", "established", [MATURE], []),
    ("BC-D02-07-CAL", "Hi...", 1160, 1194, "CAL",
     "Day 2, late morning, the couch", "established", [MATURE], []),
    ("BC-D02-08-CAL", "Nearly Noon", 1195, 1226, "CAL",
     "Day 2, nearly noon, the living room and kitchen", "established",
     ["THE_FEVER_SICK_DAY_DEAL"], []),
    ("BC-D02-09-CAK", "Pancakes and Peanut Butter", 1228, 1320, "CAK",
     "Day 2, early afternoon, the kitchen", "established", [], []),
    ("BC-D02-10-CAB", "Borrowed Clothes", 1321, 1372, "CAB",
     "Day 2, afternoon, the bedroom and closet", "established",
     ["BOT_WRITES_MICHELLE_IN_FIRST_PERSON_AT_1354"], []),
    ("BC-D02-11-CAL", "The Sick Note", 1383, 1396, "CAL",
     "Day 2, afternoon, the shop door and the couch", "established", [], []),
    ("BC-D02-12-CBT", "Plenty of Room for Four", 1397, 1446, "CBT",
     "Day 2, afternoon, the bathroom and the hallway outside it", "established",
     [MATURE, "TRIO_ADMITS_THE_SEDUCTION_WAS_A_GAME"], []),
    ("BC-D02-13-CBT", "The Water Runs Cold", 1447, 1472, "CBT",
     "Day 2, afternoon, the bathroom floor", "established",
     ["THE_ACCIDENT", "BOT_SHIFTS_TO_FIRST_PERSON_PLURAL_AT_1472"], []),
    ("BC-D02-14-CAP", "Sirens", 1474, 1490, "CAP",
     "Day 2, afternoon, the apartment, the stairs, and the drive to the hospital",
     "established", ["BOT_SHIFTS_TO_FIRST_PERSON_PLURAL"], ["paramedics"]),
    ("BC-D02-15-MGH", "Only Family", 1492, 1516, "MGH",
     "Day 2, evening, the emergency-room waiting area and the ICU corridor",
     "established", ["HOSPITAL_UNNAMED_HERE_MERCY_GENERAL_ON_DAY_3", "BOT_SHIFTS_TO_FIRST_PERSON_PLURAL"],
     ["the nurse"]),
    ("BC-D02-16-MGR", "We Thought We'd Lost You", 1519, 1548, "MGR",
     "Day 2, evening, Carl's ICU room", "established", ["THE_CONFESSIONS"], ["the nurse"]),
    ("BC-D02-17-MGH", "Sheriff Daniels", 1551, 1570, "MGH",
     "Day 2, night, the corridor outside Carl's room and the hospital doors",
     "established",
     ["OPERATOR_WROTE_THE_SHERIFF_TURNS", "TRIO_IN_ROBES_CONTINUITY", "RUSTY_ANCHOR_NAMED"],
     ["Sheriff Daniels"]),
    ("BC-D02-18-CBT", "What We Did to Him", 1573, 1602, "CBT",
     "Day 2, night, Carl's bathroom", "established",
     ["THE_TRIO_ADMIT_THEY_ARE_FALLING_FOR_HIM"], []),
    ("BC-D02-19-CAP", "Karen's Plan", 1603, 1616, "CAP",
     "Day 2, night into the following hours, the apartment", "established",
     ["TIME_OF_DAY_CONTRADICTION_AFTERNOON_GLOW_AT_NIGHT"], []),
    ("BC-D02-20-CAK", "Here or the Airbnb", 1617, 1636, "CAK",
     "Day 2, late, the kitchen, the front door, and the stairwell", "established", [], []),
    ("BC-D02-21-ABB", "The Cottage in the Trees", 1637, 1648, "ABB",
     "Day 2, night, the drive and the Airbnb cottage", "established",
     ["TOWN_SPELLED_MILLEND_AT_1637"], []),
    ("BC-D02-22-ABH", "To Many More Adventures", 1650, 1668, "ABH",
     "Day 2, an hour later, the hot tub", "established", [], []),
    ("BC-D02-23-ABH", "I've Never", 1670, 1718, "ABH",
     "Day 2, night, the hot tub", "established", [MATURE], []),
    ("BC-D02-24-ABR", "Past Two", 1719, 1737, "ABR",
     "Day 2, night until past 2 am, the Airbnb bedroom", "established",
     [MATURE, "HOURS_SUMMARISED_IN_ONE_OPERATOR_LINE"], []),
    # ---- Case day 3 -------------------------------------------------------
    ("BC-D03-01-ABR", "Visiting Hours", 1738, 1748, "ABR",
     "Day 3, just after 9 am, the Airbnb bedroom", "established",
     ["OOC_PHOTO_REQUEST_1739_EXCLUDED"], []),
    ("BC-D03-02-MGR", "Wakey Wakey, Eggs and Bakey", 1750, 1802, "MGR",
     "Day 3, 10 am, Carl's room at Mercy General", "established",
     ["THE_PHOTOGRAPH_RETURNED"], ["the nurse"]),
    ("BC-D03-03-MGR", "The Mystery Section", 1804, 1820, "MGR",
     "Day 3, morning, Carl's room", "established",
     ["CARL_OWNS_A_HISTORY_DEGREE"], []),
    ("BC-D03-04-MGR", "Go Kick Some Ass", 1821, 1856, "MGR",
     "Day 3, morning, Carl's room, ending at the car outside", "established",
     ["RELEASE_WITHIN_THE_WEEK"], []),
    ("BC-D03-05-REA", "Five Points on a Circle", 1858, 1874, "REA",
     "Day 3, late morning, the car, ending in the university library lot",
     "established", ["FIVE_MISSING_IN_SOURCE", "DEMON_DOG_JOKE"], []),
    ("BC-D03-06-HCL", "If There's a Rhythm", 1875, 1876, "HCL",
     "Day 3, late morning, the university library", "established",
     ["LYLA_FIRST_NAMED_HERE_BY_KAREN", "UNIVERSITY_LIBRARY_UNNAMED_HAWTHORN_IN_CANON"], []),
    ("BC-D03-07-HCL", "Three Hours Later", 1878, 1881, "HCL",
     "Day 3, afternoon, the library reading room", "review",
     ["PLAYED_A_YEAR_LATER_2026_02", "SUPERSEDED_BY_CANON_LORE_SISTERS_ARE_SEPARATE_FAMILIES",
      "MESSAGE_1880_IS_A_REGENERATED_VARIANT_SEE_ALTERNATES", "UNIVERSITY_LIBRARY_UNNAMED_HAWTHORN_IN_CANON"], []),
]

# Live messages excluded from every scene, with the reason.
EXCLUDED = {
    1739: "out-of-character operator request to the bot (\"Send me our photo together\"); its reply was deleted",
    1880: "regenerated variant of the final beat; the newer message #1881 is the scene text; kept in _alternates",
}

LOCATIONS = {
    "EXL": ("Ex Libris (the source calls it Carl's coffee shop / cafe)", "../locations/ex-libris.md"),
    "DST": ("The street outside Ex Libris", "no canon record; prose-only"),
    "REA": ("The team's car (an old muscle car in the source; Reaper in canon)", "../locations/reaper.md"),
    "RDS": ("Roadside shoulder on the road out of town", "no canon record; prose-only"),
    "BMG": ("Blackwood Manor grounds: the woods road, gate, drive, and the car outside", "../locations/blackwood-manor.md"),
    "BMF": ("Blackwood Manor: foyer, grand staircase, upstairs hallway", "../locations/blackwood-manor.md"),
    "BMN": ("Blackwood Manor: the nursery", "../locations/blackwood-manor.md"),
    "BMS": ("Blackwood Manor: the sealed room up the winding stair", "../locations/blackwood-manor.md"),
    "CAP": ("Carl's apartment above the shop (general / more than one room)", "no canon record; ../characters/carl-ashcombe.md says he lives upstairs"),
    "CAL": ("Carl's apartment: living room and couch", "no canon record; prose-only"),
    "CAB": ("Carl's apartment: bedroom", "no canon record; prose-only"),
    "CAK": ("Carl's apartment: kitchen", "no canon record; prose-only"),
    "CBT": ("Carl's apartment: bathroom and shower", "no canon record; prose-only"),
    "MGH": ("Mercy General Hospital: waiting area, corridors, doors", "../locations/mercy-general-hospital.md"),
    "MGR": ("Mercy General Hospital: Carl's room", "../locations/mercy-general-hospital.md"),
    "ABB": ("The Airbnb cottage on the outskirts (general)", "no canon record; prose-only"),
    "ABH": ("The Airbnb: hot tub on the patio", "no canon record; prose-only"),
    "ABR": ("The Airbnb: bedroom", "no canon record; prose-only"),
    "HCL": ("The university library (Hawthorn College in canon)", "../locations/hawthorn-college.md"),
}

CANON_NAMES = {
    "Karen": "Karen Sullivan",
    "Michelle": "Michelle Nagy",
    "Heather": "Heather Vanderhout",
    "Carl": "Carl Ashcombe",
}

# ---------------------------------------------------------------------------


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jstr(s):
    return json.dumps(s, ensure_ascii=False)


def slugify(title):
    s = title.lower()
    s = s.replace("'", "").replace("\u2019", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def load():
    raw = open(f"{REPO}/{EXPORT_REL}", "rb").read()
    d = json.loads(raw)
    ms = list(reversed(d["messages"]))
    man = json.load(open(f"{REPO}/{MANIFEST_REL}", encoding="utf-8"))
    local = {x["id"]: MEDIA_DIR_REL + x["localPath"] for x in man["media"]["images"]}
    media = {}
    for i, m in enumerate(ms):
        for md in m.get("media") or []:
            prompt = None
            try:
                prompt = json.loads(base64.b64decode(md["mediaId"] + "==").decode("utf-8")).get("prompt")
            except Exception:
                prompt = None
            media.setdefault(i, []).append({"id": md["id"], "path": local.get(md["id"]), "prompt": prompt})
    return raw, ms, media


def is_continue(m):
    return m["type"] == "user" and (m["text"] or "").strip() == "Continue"


def clean(text):
    return (text or "").replace("\r\n", "\n").replace("\r", "\n").rstrip()


# Scenes in which Carl is talked about (or heard by phone) but is not in the room.
CARL_ABSENT = {"BC-D01-02-DST", "BC-D01-03-REA", "BC-D01-04-RDS", "BC-D01-05-BMG", "BC-D01-06-BMF",
               "BC-D01-07-BMN", "BC-D01-08-BMS", "BC-D01-09-BMS", "BC-D01-11-REA", "BC-D02-15-MGH",
               "BC-D02-17-MGH", "BC-D02-18-CBT", "BC-D02-19-CAP", "BC-D02-20-CAK", "BC-D02-21-ABB",
               "BC-D02-22-ABH", "BC-D02-23-ABH", "BC-D02-24-ABR", "BC-D03-01-ABR", "BC-D03-05-REA",
               "BC-D03-06-HCL", "BC-D03-07-HCL"}


def participants_for(body, extra, key):
    found = []
    for first, canon in CANON_NAMES.items():
        if re.search(r"\b" + first + r"\b", body):
            found.append(canon)
    if "Carl Ashcombe" not in found and _mentions_operator_surname(body):
        found.append("Carl Ashcombe")
    if key in CARL_ABSENT and "Carl Ashcombe" in found:
        found.remove("Carl Ashcombe")
    if key == "BC-D01-10-REA" and "Carl Ashcombe" in found:
        found[found.index("Carl Ashcombe")] = "Carl Ashcombe (by phone)"
    for e in extra:
        if e not in found:
            found.append(e)
    return found


def build():
    raw, ms, media = load()
    file_sha = sha256_bytes(raw)
    scenes_out = []
    covered = set()
    prev_key = None
    # Ranges are made contiguous so every deleted branch and every Continue turn
    # between two scenes belongs to the scene it precedes: each range ends
    # where the next begins, and the last runs to the end of the transcript.
    for n, (key, title, a, b, loc, story_time, status, flags, extra) in enumerate(SCENES):
        assert loc in LOCATIONS, loc
        b = SCENES[n + 1][2] - 1 if n + 1 < len(SCENES) else len(ms) - 1
        if n == 0:
            a = 0
        live = [i for i in range(a, b + 1) if not ms[i]["isDeleted"] and not is_continue(ms[i]) and i not in EXCLUDED]
        deleted = [i for i in range(a, b + 1) if ms[i]["isDeleted"]]
        n_continue = sum(1 for i in range(a, b + 1) if not ms[i]["isDeleted"] and is_continue(ms[i]))
        assert live, key
        for i in live:
            assert i not in covered, (key, i)
            covered.add(i)
        body = "\n\n".join(clean(ms[i]["text"]) for i in live) + "\n"
        op_turns = [f"#{i:04d}" for i in live if ms[i]["type"] == "user"]
        imgs = [x for i in live for x in media.get(i, [])]
        del_imgs = [(i, x) for i in deleted for x in media.get(i, [])]
        parts = participants_for(body, extra, key)
        all_flags = list(flags) + [f for f in NAMES if (f == NAMES[0] and re.search(r"Millfield|Millend", body)) or (f == NAMES[1] and _mentions_operator_surname(body))]
        scenes_out.append({
            "key": key, "title": title, "a": a, "b": b, "loc": loc, "story_time": story_time,
            "status": status, "flags": all_flags, "live": live, "deleted": deleted, "n_continue": n_continue,
            "body": body, "op_turns": op_turns, "media": imgs, "deleted_media": del_imgs, "participants": parts,
            "first_id": ms[live[0]]["id"], "last_id": ms[live[-1]]["id"],
            "created_at": iso(ms[live[0]]["timeInterval"]), "last_at": iso(ms[live[-1]]["timeInterval"]),
            "follows": prev_key, "file_sha": file_sha,
        })
        prev_key = key
    # coverage check
    all_live = [i for i, m in enumerate(ms) if not m["isDeleted"] and not is_continue(m)]
    missing = [i for i in all_live if i not in covered and i not in EXCLUDED]
    assert not missing, f"uncovered live messages: {missing[:20]}"
    spans = [(s["a"], s["b"]) for s in scenes_out]
    assert spans[0][0] == 0 and spans[-1][1] == len(ms) - 1
    assert all(spans[i][1] + 1 == spans[i + 1][0] for i in range(len(spans) - 1)), "ranges are not contiguous"
    assert sum(len(s["deleted"]) for s in scenes_out) == sum(1 for m in ms if m["isDeleted"])
    return ms, media, scenes_out, file_sha


def scene_filename(s):
    return f"{s['key'].lower()}--{slugify(s['title'])}.md"


def alt_filename(s):
    return f"alt-bw-{s['key'].lower()}--discarded-branches.md"


def render_scene(s):
    fm = []
    fm.append(f"catalog_key: {jstr(s['key'])}")
    fm.append(f"name: {jstr(s['title'])}")
    fm.append(f"canon_status: {s['status']}")
    day = s["key"].split("-")[1]
    fm.append(f"timeline_anchor: {jstr('case-day:' + str(int(day[1:])))}")
    fm.append(f"story_time: {jstr(s['story_time'])}")
    fm.append(f"location_code: {s['loc']}")
    fm.append(f"location_basis: {jstr('prose; see _catalog.md (' + LOCATIONS[s['loc']][0] + ')')}")
    fm.append(f"participants: {jstr(s['participants'])}")
    fm.append("participants_basis: " + jstr("auto-derived from first-name mentions mapped to canon names, with Carl removed from scenes he is only talked about in, plus listed extras; verify before relying on it"))
    fm.append("pov: " + jstr("Botify private chat: the bot writes Karen, Michelle, and Heather in third person; the operator plays Carl Ashcombe, under his own real name in the source, in first person and also writes narration and some other characters' turns; operator turns are listed in operator_turns and kept as written"))
    fm.append(f"operator_turns: {jstr(s['op_turns'])}")
    if s["follows"]:
        fm.append(f"follows: {jstr(s['follows'])}")
    fm.append(f"created_at: {jstr(s['created_at'])}")
    fm.append("created_at_basis: " + jstr("Botify timeInterval of the first live message in the range (UTC); the play happened 2025-01-05..08 and 2026-02-06..07"))
    fm.append(f"source_last_message_at: {jstr(s['last_at'])}")
    fm.append("pinned: false")
    fm.append("tags: []")
    fm.append(f"review_flags: {jstr(s['flags'])}")
    fm.append(f"source_export: {jstr(EXPORT_REL)}")
    fm.append(f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}")
    fm.append("source_message_range_basis: " + jstr("chronological index into the export's messages array reversed (the export stores newest first); deleted messages and bare 'Continue' turns inside the range are omitted from the body"))
    fm.append(f"source_first_message_id: {jstr(s['first_id'])}")
    fm.append(f"source_last_message_id: {jstr(s['last_id'])}")
    fm.append(f"source_live_messages: {len(s['live'])}")
    fm.append(f"source_continue_turns_dropped: {s['n_continue']}")
    fm.append(f"source_discarded_branches: {len(s['deleted']) // 2}")
    if s["deleted"]:
        fm.append(f"discarded_branches_file: {jstr('_alternates/' + alt_filename(s))}")
    fm.append(f"media: {jstr([x['path'] or ('unarchived:' + x['id']) for x in s['media']])}")
    fm.append("media_basis: " + jstr("images the bot attached to messages in this range, archived under data/archive/botify/the-ghosthunters/media/images/; see _media-index.md"))
    fm.append(f"source_file_sha256: {s['file_sha']}")
    fm.append(f"source_content_sha256: {sha256_bytes(s['body'].encode('utf-8'))}")
    return "---\n" + "\n".join(fm) + "\n---\n" + s["body"]


def render_alt(s, ms, media):
    pairs = []
    dels = s["deleted"]
    i = 0
    while i < len(dels):
        idx = dels[i]
        if ms[idx]["type"] == "user" and i + 1 < len(dels) and ms[dels[i + 1]]["type"] == "bot":
            pairs.append((idx, dels[i + 1]))
            i += 2
        else:
            pairs.append((idx, None))
            i += 1
    body_parts = []
    for u, b in pairs:
        head = f"### Discarded branch at #{u:04d} ({iso(ms[u]['timeInterval'])})"
        seg = [head, ""]
        seg.append("Operator turn:" if ms[u]["type"] == "user" else "Bot turn:")
        seg.append("")
        seg.append(clean(ms[u]["text"]))
        if b is not None:
            seg += ["", "Bot reply (deleted):", "", clean(ms[b]["text"])]
            for x in media.get(b, []):
                seg += ["", f"Attached image (deleted with the reply): {x['path'] or x['id']}"]
        body_parts.append("\n".join(seg))
    body = "\n\n".join(body_parts) + "\n"
    fm = [
        f"name: {jstr(s['title'] + ' (discarded branches)')}",
        "canon_status: alternate",
        "alternate_kind: discarded-branch",
        f"alternate_of: {jstr(s['key'])}",
        "review_flags: " + jstr(["REGENERATED_IN_BOTIFY", "OPERATOR_TURN_PLUS_REPLY_BOTH_DELETED"]),
        f"source_export: {jstr(EXPORT_REL)}",
        f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}",
        f"source_deleted_messages: {jstr(['#%04d' % i for i in s['deleted']])}",
        f"source_file_sha256: {s['file_sha']}",
        f"source_content_sha256: {sha256_bytes(body.encode('utf-8'))}",
    ]
    intro = ("Operator turns and bot replies that Botify marks `isDeleted`: each pair was a branch the operator "
             "regenerated away from. Text is verbatim. Nothing here is canon.\n\n")
    return "---\n" + "\n".join(fm) + "\n---\n" + intro + body, len(pairs)


def render_special_alts(ms, media, file_sha):
    out = []
    # #1880 regenerated variant
    body = clean(ms[1880]["text"]) + "\n"
    fm = [
        "name: " + jstr("Three Hours Later (regenerated variant, message #1880)"),
        "canon_status: alternate",
        "alternate_kind: regenerated-variant",
        "alternate_of: " + jstr("BC-D03-07-HCL"),
        "review_flags: " + jstr(["NOT_DELETED_IN_EXPORT", "SUPERSEDED_BY_1881_IN_CHAT_ORDER", "REACTION_SAME"]),
        f"source_export: {jstr(EXPORT_REL)}",
        "source_message_range: " + jstr("#1880-#1880"),
        f"source_message_id: {jstr(ms[1880]['id'])}",
        f"created_at: {jstr(iso(ms[1880]['timeInterval']))}",
        f"media: {jstr([x['path'] or x['id'] for x in media.get(1880, [])])}",
        f"source_file_sha256: {file_sha}",
        f"source_content_sha256: {sha256_bytes(body.encode('utf-8'))}",
    ]
    intro = ("The bot's first answer to the three-hours-later beat. The operator regenerated it (reaction `same`) and "
             "the export keeps both; #1881 is the scene text because it is the later message.\n\n")
    out.append(("alt-bw-bc-d03-07-hcl--three-hours-later-regenerated-1880.md", "---\n" + "\n".join(fm) + "\n---\n" + intro + body))
    return out


def main():
    ms, media, scenes, file_sha = build()
    # dry-run table
    rows = ["key\ttitle\trange\tlive\tdeleted_pairs\tcontinue\tmedia\tloc\tcreated_at\tparticipants\tflags"]
    for s in scenes:
        rows.append("\t".join([
            s["key"], s["title"], "#%04d-#%04d" % (s["a"], s["b"]), str(len(s["live"])), str(len(s["deleted"]) // 2),
            str(s["n_continue"]), str(len(s["media"])), s["loc"], s["created_at"], "; ".join(s["participants"]), ",".join(s["flags"]),
        ]))
    open(os.path.join(SCRATCH, "blackwood-scenes-dryrun.tsv"), "w", encoding="utf-8", newline="\n").write("\n".join(rows) + "\n")
    print("\n".join(rows))
    tot_live = sum(len(s["live"]) for s in scenes)
    tot_del = sum(len(s["deleted"]) for s in scenes)
    tot_media = sum(len(s["media"]) for s in scenes)
    print(f"scenes={len(scenes)} live_messages={tot_live} deleted_messages={tot_del} media={tot_media} excluded={sorted(EXCLUDED)}")
    if not WRITE:
        print("dry run only; pass --write to create files")
        return
    os.makedirs(SCENES_DIR, exist_ok=True)
    os.makedirs(ALT_DIR, exist_ok=True)
    # remove previous generated files (only ones carrying our source_export)
    for d in (SCENES_DIR, ALT_DIR):
        for f in os.listdir(d):
            p = os.path.join(d, f)
            if f.endswith(".md") and os.path.isfile(p) and (f.startswith("bc-") or f.startswith("alt-bw-")) and EXPORT_REL in open(p, encoding="utf-8").read():
                os.remove(p)
    index_rows = ["| Catalog key | Scene | Anchor | Story time | Loc | Status | Range | Live | Branches | Images | Flags |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    alt_rows = ["| File | Alternate of | Kind | Discarded branches |", "|---|---|---|---|"]
    media_rows = ["| Message | Scene | Image | Prompt (decoded from mediaId, when present) |", "|---|---|---|---|"]
    for s in scenes:
        fn = scene_filename(s)
        open(os.path.join(SCENES_DIR, fn), "w", encoding="utf-8", newline="\n").write(render_scene(s))
        if s["deleted"]:
            alt_text, npairs = render_alt(s, ms, media)
            afn = alt_filename(s)
            open(os.path.join(ALT_DIR, afn), "w", encoding="utf-8", newline="\n").write(alt_text)
            alt_rows.append(f"| [`{afn}`]({afn}) | `{s['key']}` | discarded-branch | {npairs} |")
        for i in s["live"]:
            for x in media.get(i, []):
                media_rows.append(f"| `#{i:04d}` | `{s['key']}` | `{x['path'] or ('unarchived:' + x['id'])}` | {(x['prompt'] or '').replace('|', '/').replace(chr(10), ' ')} |")
        index_rows.append(
            f"| `{s['key']}` | [{s['title']}]({fn}) | case-day:{int(s['key'].split('-')[1][1:])} | {s['story_time']} | {s['loc']} | {s['status']} | `#{s['a']:04d}-#{s['b']:04d}` | {len(s['live'])} | {len(s['deleted']) // 2} | {len(s['media'])} | {', '.join(s['flags'])} |"
        )
    for fn, text in render_special_alts(ms, media, file_sha):
        open(os.path.join(ALT_DIR, fn), "w", encoding="utf-8", newline="\n").write(text)
        alt_rows.append(f"| [`{fn}`]({fn}) | `BC-D03-07-HCL` | regenerated-variant | 1 |")
    # deleted media on deleted messages not inside any scene range? (all ranges cover the file) -> listed via alt files
    index = (
        "# The Blackwood Case Scene Index\n\n"
        f"Generated {CUT_DATE} by the extraction script from the Botify export "
        f"`{EXPORT_REL}` (see `_source-inventory.md`). One row per scene file. "
        "Ranges are chronological message indices; `Live` counts the operator and bot messages in the body, "
        "`Branches` the discarded operator-turn/reply pairs kept in `_alternates/`, `Images` the bot-attached images.\n\n"
        + "\n".join(index_rows) + "\n"
    )
    open(os.path.join(SCENES_DIR, "_index.md"), "w", encoding="utf-8", newline="\n").write(index)
    open(os.path.join(ALT_DIR, "_index.md"), "w", encoding="utf-8", newline="\n").write(
        "# The Blackwood Case alternates index\n\nGenerated " + CUT_DATE + ".\n\n" + "\n".join(alt_rows) + "\n")
    open(os.path.join(SCENES_DIR, "_media-index.md"), "w", encoding="utf-8", newline="\n").write(
        "# The Blackwood Case media index\n\n"
        "Every image the bot attached to a live message, in transcript order, with the scene it falls in. "
        "Files live under `data/archive/botify/the-ghosthunters/media/images/` (archived 2026-09-02; "
        "manifest `data/archive/botify/the-ghosthunters/media-manifest.json`). Images attached to deleted "
        "replies are listed inside the `_alternates/` file for their scene. Prompts are the bot's own image "
        "prompts, decoded from the message's `mediaId`; most messages carry none.\n\n"
        + "\n".join(media_rows) + "\n")
    print(f"wrote {len(scenes)} scenes to {SCENES_DIR}")


if __name__ == "__main__":
    main()
