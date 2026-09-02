# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8.
"""Cut the Shadowflame Botify transcript (Dark Queen Lilith private chat) into
per-scene draft files under drafts/scenes/ as overlay add operations.

Usage: python extract_shadowflame_scenes.py [--write]

Same invented delineators as The Blackwood Case: a new scene where the story
changes place, jumps in time, or the cast changes; play-session gaps are not
boundaries. Ranges are made contiguous so every deleted branch belongs to the
scene it precedes. Indices are chronological (export is newest-first).
"""
import base64
import datetime as dt
import hashlib
import json
import os
import re
import sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")).replace("\\", "/")
BOT_DIR = "data/archive/botify/dark-queen-lilith/"
EXPORT_REL = BOT_DIR + "chats/1b4aae74-6348-4a59-b17a-2c3ebfd7cf24.json"
MANIFEST_REL = BOT_DIR + "media-manifest.json"
STORY = "shadowflame"
DRAFTS = f"{REPO}/data/stories/{STORY}/drafts"
SCENES_DIR = f"{DRAFTS}/scenes"
CTRL_DIR = f"{DRAFTS}/_control/scenes"
ALT_DIR = f"{CTRL_DIR}/_alternates"
OVERLAY = f"{DRAFTS}/_control/overlay.json"
SCRATCH = os.path.dirname(os.path.abspath(__file__))
CUT_DATE = "2026-09-02"
BANNER = "> **DRAFT — NOT ACTIVE CANON**"
WRITE = "--write" in sys.argv

MATURE = "MATURE_CONTENT"
NAMEFLAGS = {
    "Rosemary": "NORMALIZE_ROSEMARY_WORTHINGTON_TO_HELENA_MARLOWE",
    "Isolde": "NORMALIZE_ISOLDE_TO_CECILY_FAIRFAX",
    "Briar": "NORMALIZE_BRIAR_ROSE_BLACKWOOD_TO_BEATRICE_RAVENSCROFT",
    "Seraphina": "NORMALIZE_SERAPHINA_THORNE_TO_VIVIENNE_HARCOURT",
    "Blackwood": "NORMALIZE_BLACKWOOD_MANOR_TO_RAVENSCROFT_MANOR",
    "Jägermeister": "JAGERMEISTER_JOKE_NAME_IN_SOURCE",
}

# (key, title, first_index, location, story_time, status, flags, extra_participants)
SCENES = [
    # ---- Day 1: Karl comes for the amulet ----------------------------------
    ("SF-D01-01-THR", "Lord Karl Von Jäger", 0, "THR",
     "Day 1, night, Lilith's chamber (the throne chamber by later reference)", "established",
     ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE", "LILITH_EYES_OBSIDIAN_HERE_VIOLET_LATER", "AMULET_GLOWS_BLUE_HERE"], []),
    ("SF-D01-02-THR", "Shall We Dance?", 47, "THR",
     "Day 1, night, the same chamber", "established", ["KARL_BINDS_AND_HUMILIATES_LILITH", "KARL_FADES_AT_THE_DOOR"], []),
    ("SF-D01-03-THR", "À Bientôt", 62, "THR",
     "Day 1, night, alone after Karl fades", "established", ["LILITH_ALONE_SOLILOQUY"], []),
    # ---- Day 2: the surrender ---------------------------------------------
    ("SF-D02-01-BAL", "Damn You, Karl Jäger", 81, "BAL",
     "Day 2, days later, night, the balcony", "established", [], []),
    ("SF-D02-02-BAL", "I Wish to Die", 115, "BAL",
     "Day 2, night, the balcony", "established", ["KARL_SAYS_HE_WISHES_TO_DIE"], []),
    ("SF-D02-03-BAL", "Freely Given", 130, "BAL",
     "Day 2, night, the balcony, then the following weeks", "established",
     ["THE_SURRENDER", "AMULET_WRAPPED_IN_CLOTH_TAKEN_BY_KARL", "WEEKS_MONTAGE_AT_END"], []),
    # ---- Day 3: the Shadowflame Ruby, the grimoire, the experiment ----------
    ("SF-D03-01-BAL", "The Shadowflame Ruby", 164, "BAL",
     "Day 3, weeks later, a summer evening on the balcony", "established",
     ["BOT_NAMES_KARL_AS_CARL_YEAGER_AT_0167", "RUBY_GIFTED_AS_A_NECKLACE"], []),
    ("SF-D03-02-BAL", "The Farmer's Daughter", 196, "BAL",
     "Day 3, evening, the balcony", "established",
     ["KARLS_ALTERED_ACCOUNT_CANON_SAYS_THE_DAUGHTER_WAS_LILITH", "BOT_CALLS_KARL_CARL_AT_0205"], []),
    ("SF-D03-03-BAL", "The Shadowflame Heart", 227, "BAL",
     "Day 3, night, the balcony", "established", ["RUBY_RENAMED_SHADOWFLAME_HEART"], []),
    ("SF-D03-04-PCH", "The Grimoire", 241, "PCH",
     "Day 3, night, the vanity in Lilith's chambers", "established", ["SOUL_BINDING_RITE_FOUND"], []),
    ("SF-D03-05-PCH", "Whom to Test It On?", 254, "PCH",
     "Day 3, night, the writing desk", "established",
     ["INVITATION_NAMES_THE_BLACKWOODS_AND_WOODSHOME_DEBUTANTE_BALL", "BALL_IS_TWO_DAYS_AWAY_THE_FIFTEENTH"], []),
    ("SF-D03-06-WDR", "The Crimson Gown", 261, "WDR",
     "Day 3, night, the walk-in closet", "established", ["IMAGE_ONLY_BOT_MESSAGES_IN_RANGE"], []),
    ("SF-D03-07-PCH", "Target Practice", 280, "PCH",
     "Day 3, night, the chaise and a charred circle on the floor", "established", [], []),
    ("SF-D03-08-HID", "My Playthings", 290, "HID",
     "Day 3, night, the hidden chamber behind the concealed door", "established", [MATURE], []),
    ("SF-D03-09-HID", "A Pretty Little Morsel", 305, "HID",
     "Day 3, night, the hidden chamber", "established",
     [MATURE, "CAPTIVE_CONJURED_BY_OPERATOR_TURN", "SUBJECT_CALLED_GIRL_IN_SOURCE_ADULT_WOMAN_IN_CANON"], ["The First Test Subject"]),
    ("SF-D03-10-HID", "Your First Taste", 348, "HID",
     "Day 3, night, the hidden chamber", "established", [MATURE], ["The First Test Subject"]),
    ("SF-D03-11-HID", "Do You Trust Me?", 405, "HID",
     "Day 3, night, the hidden chamber", "established", [MATURE], ["The First Test Subject"]),
    ("SF-D03-12-HID", "If She Ever Reawakens", 506, "HID",
     "Day 3, the small hours, the hidden chamber, then Lilith's bed", "established",
     [MATURE, "HOURS_SUMMARISED_IN_ONE_OPERATOR_LINE", "SUBJECT_LEFT_UNCONSCIOUS_IN_BONDS"], ["The First Test Subject"]),
    # ---- Day 4: the debutante ball and the first bindings -------------------
    ("SF-D04-01-PCH", "She Did Not Survive the Night", 519, "PCH",
     "Day 4, the following days, then dressing for the ball", "established",
     ["THE_DEATH_STATED_IN_PASSING_AT_0519", "OPERATOR_SAYS_EXPERIMENT_TONIGHT"], []),
    ("SF-D04-02-RVM", "The Woodshome Debutante Ball", 534, "RVM",
     "Day 4, evening to midnight, the manor foyer and ballroom", "established",
     ["LILITH_DESCRIBED_AS_RED_HAIRED_HERE", "NO_AGES_GIVEN_CANON_SAYS_19_20_21"], []),
    ("SF-D04-03-CON", "Petals", 561, "CON",
     "Day 4, night, the darkened conservatory", "established", [MATURE, "ENCHANTED_SCENTS_LOWER_INHIBITIONS"], []),
    ("SF-D04-04-CON", "Well, Well", 607, "CON",
     "Day 4, night, the conservatory", "established", ["LILITH_REVEALS_HERSELF"], []),
    ("SF-D04-05-CON", "Penance", 647, "CON",
     "Day 4, night, the conservatory", "established", [MATURE, "THE_SWITCH"], []),
    ("SF-D04-06-CON", "Three Candidates Again", 723, "CON",
     "Day 4, night, the conservatory, ending at the portal", "established", ["THE_OFFER_AND_THREE_YESES"], []),
    ("SF-D04-07-PCH", "Welcome, My Darlings", 769, "PCH",
     "Day 4, night, Lilith's boudoir", "established", [], []),
    ("SF-D04-08-PCH", "Naughty Girls", 802, "PCH",
     "Day 4, night, the boudoir", "established", ["STRAY_ASTERISK_TURN_0835_DROPPED"], []),
    ("SF-D04-09-PCH", "Truth or Die", 853, "PCH",
     "Day 4, night, the boudoir", "established", [MATURE], []),
    ("SF-D04-10-PCH", "Dare", 893, "PCH",
     "Day 4, night, the boudoir", "established", ["SHADOWSCAPE_SANGUINE"], []),
    ("SF-D04-11-PCH", "Bare Yourselves", 929, "PCH",
     "Day 4, night, the boudoir", "established", [MATURE, "BOT_PLACES_LILITH_ON_A_THRONE_AND_DAIS_HERE"], []),
    ("SF-D04-12-PCH", "Undress Me", 983, "PCH",
     "Day 4, night, the boudoir", "established", [MATURE], []),
    ("SF-D04-13-PCH", "Rosemary's Binding", 1025, "PCH",
     "Day 4, night, the chaise", "established", [MATURE, "THE_OATH_FIRST_SPOKEN"], []),
    ("SF-D04-14-PCH", "Briar Rose's Binding", 1081, "PCH",
     "Day 4, night, the boudoir", "established", [MATURE], []),
    ("SF-D04-15-PCH", "Isolde's Initiation", 1134, "PCH",
     "Day 4, night, the boudoir", "established",
     [MATURE, "NON_CONSENT_ISOLDE_PLEADS_NO_AND_IS_HELD_DOWN", "AMULET_PULSES_THOUGH_SURRENDERED"], []),
    ("SF-D04-16-PCH", "Three Pure Blossoms", 1218, "PCH",
     "Day 4, night, the boudoir", "established", ["THRALLS_SENT_BACK_THROUGH_THE_PORTAL"], []),
    ("SF-D04-17-PCH", "Pent-Up Tension", 1246, "PCH",
     "Day 4, night until dawn, Lilith's bed", "established", [MATURE, "LILITH_FIERY_HAIR_HERE"], []),
    # ---- Day 5: the bath -----------------------------------------------------
    ("SF-D05-01-BTH", "Morning Ablutions", 1273, "BTH",
     "Day 5, dawn, the bathing room", "established", ["PLAYED_MONTHS_LATER_2025_06"], []),
    ("SF-D05-02-BTH", "Does It Serve You Well?", 1288, "BTH",
     "Day 5, morning, the bathing room", "established", ["KARL_KISSES_HER_FOREHEAD", "LILITH_EYES_VIOLET_FROM_HERE"], []),
    # ---- Day 6: the masquerade and Vivienne ----------------------------------
    ("SF-D06-01-GRH", "The Solstice Masquerade", 1306, "GRH",
     "Day 6, days later, the masquerade in Lilith's ballroom", "established",
     ["LILITH_HOSTS_THIS_BALL", "THRALLS_ATTEND_AS_GUESTS"], []),
    ("SF-D06-02-GRH", "Seraphina Thorne", 1319, "GRH",
     "Day 6, night, a window at the edge of the ballroom", "established", [], []),
    ("SF-D06-03-TER", "The Tainted Glass", 1337, "TER",
     "Day 6, night, the balcony off the ballroom", "established",
     ["POTION_IN_THE_WINE", "PLAYED_ACROSS_JUNE_4_AND_5"], []),
    ("SF-D06-04-PCH", "The Sisterhood", 1364, "PCH",
     "Day 6, night, Lilith's bedchamber", "established", ["THRALLS_SUMMONED_MYSTICALLY"], []),
    ("SF-D06-05-PCH", "Dance With Me", 1380, "PCH",
     "Day 6, night, the bedchamber", "established", [MATURE], []),
    ("SF-D06-06-PCH", "Confessions", 1402, "PCH",
     "Day 6, night, the bedchamber", "established", [MATURE, "SERAPHINAS_FANTASIES"], []),
    ("SF-D06-07-PCH", "The Thief in the Night", 1412, "PCH",
     "Day 6, night, the bed", "established", [MATURE, "ROLE_PLAY_WITHIN_THE_ROLE_PLAY"], []),
    ("SF-D06-08-PCH", "Kneel", 1452, "PCH",
     "Day 6, night, the center of the chamber", "established", [MATURE, "THE_RUNED_COLLAR"], []),
    ("SF-D06-09-PCH", "Open Your Mouth", 1474, "PCH",
     "Day 6, night, the chamber", "established", [MATURE], []),
    ("SF-D06-10-PCH", "The Velvet Box", 1490, "PCH",
     "Day 6, night, the chamber", "established", [MATURE, "THE_JADE_EGG"], []),
    ("SF-D06-11-PCH", "Denied", 1510, "PCH",
     "Day 6, night, the chamber", "established", [MATURE, "IMAGE_ONLY_BOT_MESSAGE_1522"], []),
    ("SF-D06-12-PCH", "Attend Me", 1523, "PCH",
     "Day 6, night, the chaise", "established", [MATURE, "DUPLICATE_TEXT_1525_1526_KEPT"], []),
    ("SF-D06-13-PCH", "Worship Your Sister", 1541, "PCH",
     "Day 6, night, the chamber", "established", [MATURE], []),
    ("SF-D06-14-PCH", "Seraphina's Binding", 1557, "PCH",
     "Day 6, night, the chamber, then the bed", "established", [MATURE, "THE_OATH_NOW_AND_FOREVER_MORE"], []),
    ("SF-D06-15-PCH", "Discretion Is Key", 1574, "PCH",
     "Day 6, night, the bed and the bath, ending at the portal", "established",
     [MATURE, "PLAYED_MONTHS_LATER_2025_09", "COVEN_COUNTED_AS_ONE_STEP_FROM_COMPLETE"], []),
    ("SF-D06-16-PCH", "My Silent Observer", 1587, "PCH",
     "Day 6, night, Lilith's bed", "established",
     [MATURE, "KARL_DECLINES_AND_WITHDRAWS", "THE_BLAST_IS_LILITHS_OWN_CANON_CALLS_THE_EXPLOSION_UNEXPLAINED"], []),
    ("SF-D06-17-PCH", "The Black Rose", 1610, "PCH",
     "Day 6, night, the mended wall and the bedside table", "established",
     ["KARLS_NOTE_QUOTED_VERBATIM", "LILITH_VOWS_TO_BIND_KARL", "AMULET_MEANS_THE_SHADOWFLAME_RUBY_HERE"], []),
    ("SF-D06-18-PCH", "An Unfortunate Accident", 1618, "PCH",
     "Day 6, night, the chamber door", "established", ["ATTENDANT_UNNAMED"], ["an attendant"]),
    ("SF-D06-19-GRH", "The Farce", 1622, "GRH",
     "Day 6, late night, the ballroom and the terrace", "established", ["REGINALD_APPEARS"], ["Reginald"]),
    ("SF-D06-20-PCH", "Four", 1634, "PCH",
     "Day 6, after the guests leave, the foyer, then the chambers", "established",
     ["FIFTH_IS_THE_SACRED_NUMBER"], []),
    ("SF-D06-21-PCH", "Isolde's Devotion", 1638, "PCH",
     "Day 6, late night, Lilith's chambers", "established", [MATURE], []),
    ("SF-D06-22-PCH", "Lady Elaea Wainwright", 1654, "PCH",
     "Day 6, late night, Lilith's bed", "established",
     [MATURE, "ISOLDES_MAIDSERVANT_CONFESSION", "ELAEA_SURNAME_WAINWRIGHT_AND_EARL_OF_GLENGARRY_IN_SOURCE", "ISOLDE_EYES_HAZEL_HERE_GREEN_EARLIER"],
     ["Lady Elaea (named only)"]),
]

EXCLUDED = {}

LOCATIONS = {
    "THR": ("The Throne Chamber (the source says only 'my domain', 'the chamber'; Lilith rises from her throne there on Day 2)", "../locations/the-throne-chamber.md"),
    "BAL": ("Lilith's Balcony, off the throne chamber", "../locations/lilith-s-balcony.md"),
    "PCH": ("Lilith's Private Chambers: bedchamber, boudoir, chaise, vanity, writing desk", "../locations/lilith-s-private-chambers.md"),
    "WDR": ("Lilith's Wardrobe & Dressing Room (the walk-in closet)", "../locations/lilith-s-wardrobe-dressing-room.md"),
    "HID": ("The Hidden Chamber behind the concealed door off the boudoir", "../locations/the-hidden-chamber.md"),
    "BTH": ("Lilith's Bathing Room", "../locations/lilith-s-bathing-room.md"),
    "RVM": ("Ravenscroft Manor (Blackwood Manor in the source): foyer, staircase, ballroom", "../locations/ravenscroft-manor.md"),
    "CON": ("The Conservatory at Ravenscroft Manor", "../locations/the-conservatory.md"),
    "GRH": ("The Grand Hall: Lilith's own ballroom, the masquerade", "../locations/the-grand-hall.md"),
    "TER": ("The Terrace and Gardens: the balcony off the ballroom", "../locations/the-terrace-and-gardens.md"),
}

CANON_NAMES = {
    "Lilith": "Lilith Noctara",
    "Jäger": "Lord Karl von Jäger",
    "Karl": "Lord Karl von Jäger",
    "Rosemary": "Helena Marlowe (played as Rosemary Worthington)",
    "Isolde": "Cecily Fairfax (played as Isolde Fairfax)",
    "Briar": "Beatrice Ravenscroft (played as Briar Rose Blackwood)",
    "Seraphina": "Vivienne Harcourt (played as Seraphina Thorne)",
    "Reginald": "Reginald",
}
# Scenes Karl is actually in (he often speaks unnamed, so mentions are not enough).
KARL_PRESENT = {"SF-D01-01-THR", "SF-D01-02-THR", "SF-D02-01-BAL", "SF-D02-02-BAL", "SF-D02-03-BAL",
                "SF-D03-01-BAL", "SF-D03-02-BAL", "SF-D03-03-BAL", "SF-D05-02-BTH", "SF-D06-16-PCH"}
# Scenes where Karl is only spoken of.
KARL_ABSENT = {"SF-D01-03-THR", "SF-D03-04-PCH", "SF-D03-05-PCH", "SF-D04-01-PCH", "SF-D04-17-PCH",
               "SF-D05-01-BTH", "SF-D06-01-GRH", "SF-D06-17-PCH", "SF-D06-18-PCH", "SF-D06-19-GRH", "SF-D06-20-PCH"}
# Scenes where the thralls are only spoken of (not in the room).
THRALLS_ABSENT = {"SF-D04-01-PCH", "SF-D04-17-PCH", "SF-D05-01-BTH", "SF-D06-17-PCH", "SF-D06-20-PCH"}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jstr(s):
    return json.dumps(s, ensure_ascii=False)


def slugify(t):
    t = t.lower().replace("'", "").replace("\u2019", "").replace("à", "a").replace("ô", "o").replace("é", "e").replace("ä", "a")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def load():
    raw = open(f"{REPO}/{EXPORT_REL}", "rb").read()
    ms = list(reversed(json.loads(raw)["messages"]))
    man = json.load(open(f"{REPO}/{MANIFEST_REL}", encoding="utf-8"))
    local = {x["id"]: BOT_DIR + x["localPath"] for x in man["media"]["images"]}
    media = {}
    for i, m in enumerate(ms):
        for md in m.get("media") or []:
            try:
                prompt = json.loads(base64.b64decode(md["mediaId"] + "==").decode("utf-8")).get("prompt")
            except Exception:
                prompt = None
            media.setdefault(i, []).append({"id": md["id"], "path": local.get(md["id"]), "prompt": prompt})
    return raw, ms, media


def dropped_turn(m):
    t = (m["text"] or "").strip()
    return m["type"] == "user" and t in ("Continue", "*", "")


def empty_bot(m):
    return m["type"] == "bot" and not (m["text"] or "").strip()


def clean(t):
    return (t or "").replace("\r\n", "\n").replace("\r", "\n").rstrip()


FOUNDING_THREE = [CANON_NAMES["Rosemary"], CANON_NAMES["Isolde"], CANON_NAMES["Briar"]]
SERAPHINA = CANON_NAMES["Seraphina"]


def _day_beat(key):
    p = key.split("-")
    return int(p[1][1:]), int(p[2])


def thralls_present(key):
    d, b = _day_beat(key)
    out = []
    if (d == 4 and 2 <= b <= 16) or (d == 6 and (b == 1 or 4 <= b <= 15 or b == 19)):
        out += FOUNDING_THREE
    if d == 6 and (1 <= b <= 15 or b == 19):
        out.append(SERAPHINA)
    if d == 6 and b in (21, 22):
        out.append(CANON_NAMES["Isolde"])
    return out


def participants_for(body, extra, key):
    # Lilith is the bot and is in every scene, first person or third.
    found = ["Lilith Noctara"]
    if key in KARL_PRESENT:
        found.append("Lord Karl von Jäger")
    found += thralls_present(key)
    if re.search(r"\bReginald\b", body):
        found.append("Reginald")
    for e in extra:
        if e not in found:
            found.append(e)
    return found


def build():
    raw, ms, media = load()
    file_sha = sha(raw)
    out = []
    covered = set()
    prev = None
    for n, (key, title, a, loc, story_time, status, flags, extra) in enumerate(SCENES):
        assert loc in LOCATIONS, loc
        b = SCENES[n + 1][2] - 1 if n + 1 < len(SCENES) else len(ms) - 1
        if n == 0:
            a = 0
        live = [i for i in range(a, b + 1) if not ms[i]["isDeleted"] and not dropped_turn(ms[i]) and not empty_bot(ms[i]) and i not in EXCLUDED]
        deleted = [i for i in range(a, b + 1) if ms[i]["isDeleted"]]
        n_drop = sum(1 for i in range(a, b + 1) if not ms[i]["isDeleted"] and dropped_turn(ms[i]))
        n_empty = sum(1 for i in range(a, b + 1) if not ms[i]["isDeleted"] and empty_bot(ms[i]))
        assert live, key
        for i in live:
            assert i not in covered
            covered.add(i)
        body = "\n\n".join(clean(ms[i]["text"]) for i in live) + "\n"
        op = [f"#{i:04d}" for i in live if ms[i]["type"] == "user"]
        imgs = [x for i in range(a, b + 1) if not ms[i]["isDeleted"] for x in media.get(i, [])]
        parts = participants_for(body, extra, key)
        fl = list(flags)
        for word, flag in NAMEFLAGS.items():
            if word in body and flag not in fl:
                fl.append(flag)
        out.append(dict(key=key, title=title, a=a, b=b, loc=loc, story_time=story_time, status=status, flags=fl,
                        live=live, deleted=deleted, n_drop=n_drop, n_empty=n_empty, body=body, op=op, media=imgs,
                        participants=parts, first_id=ms[live[0]]["id"], last_id=ms[live[-1]]["id"],
                        created_at=iso(ms[live[0]]["timeInterval"]), last_at=iso(ms[live[-1]]["timeInterval"]),
                        follows=prev, file_sha=file_sha))
        prev = key
    all_live = [i for i, m in enumerate(ms) if not m["isDeleted"] and not dropped_turn(m) and not empty_bot(m)]
    missing = [i for i in all_live if i not in covered and i not in EXCLUDED]
    assert not missing, missing[:20]
    spans = [(s["a"], s["b"]) for s in out]
    assert spans[0][0] == 0 and spans[-1][1] == len(ms) - 1
    assert all(spans[i][1] + 1 == spans[i + 1][0] for i in range(len(spans) - 1))
    assert sum(len(s["deleted"]) for s in out) == sum(1 for m in ms if m["isDeleted"])
    return ms, media, out, file_sha


def fname(s):
    return f"{s['key'].lower()}--{slugify(s['title'])}.md"


def altname(s):
    return f"alt-sf-{s['key'].lower()}--discarded-branches.md"


def render_scene(s):
    day = int(s["key"].split("-")[1][1:])
    fm = [
        f"catalog_key: {jstr(s['key'])}", f"name: {jstr(s['title'])}", f"canon_status: {s['status']}",
        f"timeline_anchor: {jstr('story-day:' + str(day))}", f"story_time: {jstr(s['story_time'])}",
        f"location_code: {s['loc']}", f"location_basis: {jstr('prose; see _control/scenes/_catalog.md (' + LOCATIONS[s['loc']][0] + ')')}",
        f"participants: {jstr(s['participants'])}",
        "participants_basis: " + jstr("auto-derived from first-name mentions mapped to canon names (the played names differ from canon; both are given), with Karl and the thralls removed from scenes they are only spoken of in, plus listed extras; verify before relying on it"),
        "pov: " + jstr("Botify private chat with the Dark Queen Lilith bot: the bot writes Lilith (first person early, third person later); the operator plays Lord Karl von Jäger in first person on Days 1-3 and 5-6, and from Day 3 onward also writes Lilith's own actions, the thralls, and narration; operator turns are listed in operator_turns and kept as written"),
        f"operator_turns: {jstr(s['op'])}",
    ]
    if s["follows"]:
        fm.append(f"follows: {jstr(s['follows'])}")
    fm += [
        f"created_at: {jstr(s['created_at'])}",
        "created_at_basis: " + jstr("Botify timeInterval of the first live message in the range (UTC); the play ran 2025-01-07..14, 2025-06-03..08, and 2025-09-16..20"),
        f"source_last_message_at: {jstr(s['last_at'])}",
        "pinned: false", "tags: []",
        f"review_flags: {jstr(s['flags'])}",
        f"source_export: {jstr(EXPORT_REL)}",
        f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}",
        "source_message_range_basis: " + jstr("chronological index into the export's messages array reversed (the export stores newest first); deleted messages, bare 'Continue' or '*' turns, and image-only bot messages inside the range are omitted from the body; ranges are contiguous so every discarded branch belongs to the scene it precedes"),
        f"source_first_message_id: {jstr(s['first_id'])}", f"source_last_message_id: {jstr(s['last_id'])}",
        f"source_live_messages: {len(s['live'])}", f"source_turns_dropped: {s['n_drop']}",
        f"source_image_only_messages: {s['n_empty']}", f"source_discarded_branches: {len(s['deleted']) // 2}",
    ]
    if s["deleted"]:
        fm.append(f"discarded_branches_file: {jstr('_control/scenes/_alternates/' + altname(s))}")
    fm += [
        f"media: {jstr([x['path'] or ('unarchived:' + x['id']) for x in s['media']])}",
        "media_basis: " + jstr("images the bot attached to live messages in this range, archived under data/archive/botify/dark-queen-lilith/media/images/; see _control/scenes/_media-index.md"),
        f"source_file_sha256: {s['file_sha']}",
        f"source_content_sha256: {sha(s['body'].encode('utf-8'))}",
    ]
    return "---\n" + "\n".join(fm) + "\n---\n" + BANNER + "\n\n" + s["body"]


def render_alt(s, ms, media):
    dels = s["deleted"]
    pairs = []
    i = 0
    while i < len(dels):
        idx = dels[i]
        if ms[idx]["type"] == "user" and i + 1 < len(dels) and dels[i + 1] == idx + 1 and ms[dels[i + 1]]["type"] == "bot":
            pairs.append((idx, dels[i + 1])); i += 2
        else:
            pairs.append((idx, None)); i += 1
    parts = []
    for u, b in pairs:
        seg = [f"### Discarded branch at #{u:04d} ({iso(ms[u]['timeInterval'])})", "",
               "Operator turn:" if ms[u]["type"] == "user" else "Bot turn:", "", clean(ms[u]["text"])]
        for x in media.get(u, []):
            seg += ["", f"Attached image (deleted): {x['path'] or x['id']}"]
        if b is not None:
            seg += ["", "Bot reply (deleted):", "", clean(ms[b]["text"])]
            for x in media.get(b, []):
                seg += ["", f"Attached image (deleted with the reply): {x['path'] or x['id']}"]
        parts.append("\n".join(seg))
    body = "\n\n".join(parts) + "\n"
    fm = [
        f"name: {jstr(s['title'] + ' (discarded branches)')}", "canon_status: alternate", "alternate_kind: discarded-branch",
        f"alternate_of: {jstr(s['key'])}", "review_flags: " + jstr(["REGENERATED_IN_BOTIFY", "OPERATOR_TURN_PLUS_REPLY_BOTH_DELETED"]),
        f"source_export: {jstr(EXPORT_REL)}", f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}",
        f"source_deleted_messages: {jstr(['#%04d' % i for i in dels])}", f"source_file_sha256: {s['file_sha']}",
        f"source_content_sha256: {sha(body.encode('utf-8'))}",
    ]
    intro = "Operator turns and bot replies that Botify marks `isDeleted`: each pair was a branch the operator regenerated away from. Text is verbatim. Nothing here is canon.\n\n"
    return "---\n" + "\n".join(fm) + "\n---\n" + intro + body, len(pairs)


def main():
    ms, media, scenes, file_sha = build()
    rows = ["key\ttitle\trange\tlive\tbranches\tdropped\timg_only\tmedia\tloc\tcreated_at\tparticipants\tflags"]
    for s in scenes:
        rows.append("\t".join([s["key"], s["title"], "#%04d-#%04d" % (s["a"], s["b"]), str(len(s["live"])), str(len(s["deleted"]) // 2),
                               str(s["n_drop"]), str(s["n_empty"]), str(len(s["media"])), s["loc"], s["created_at"], "; ".join(s["participants"]), ",".join(s["flags"])]))
    open(os.path.join(SCRATCH, "shadowflame-scenes-dryrun.tsv"), "w", encoding="utf-8", newline="\n").write("\n".join(rows) + "\n")
    print("\n".join(rows))
    print(f"scenes={len(scenes)} live={sum(len(s['live']) for s in scenes)} deleted={sum(len(s['deleted']) for s in scenes)} media={sum(len(s['media']) for s in scenes)}")
    if not WRITE:
        print("dry run only")
        return
    os.makedirs(SCENES_DIR, exist_ok=True)
    os.makedirs(ALT_DIR, exist_ok=True)
    for d, pref in ((SCENES_DIR, "sf-"), (ALT_DIR, "alt-sf-")):
        for f in os.listdir(d):
            p = os.path.join(d, f)
            if f.startswith(pref) and f.endswith(".md") and EXPORT_REL in open(p, encoding="utf-8").read():
                os.remove(p)
    raw = open(OVERLAY, "rb").read()
    man = json.loads(raw)
    by_path = {e["path"]: e for e in man["files"]}
    man["files"] = [e for e in man["files"] if not (e["path"].startswith("scenes/sf-"))]
    index_rows = ["| Catalog key | Scene | Anchor | Story time | Loc | Status | Range | Live | Branches | Images | Flags |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    alt_rows = ["| File | Alternate of | Kind | Discarded branches |", "|---|---|---|---|"]
    media_rows = ["| Message | Scene | Image | Prompt (decoded from mediaId, when present) |", "|---|---|---|---|"]
    for s in scenes:
        fn = fname(s)
        text = render_scene(s)
        open(os.path.join(SCENES_DIR, fn), "w", encoding="utf-8", newline="\n").write(text)
        man["files"].append({"path": f"scenes/{fn}", "operation": "add", "baseline_sha256": None,
                             "draft_sha256": sha(open(os.path.join(SCENES_DIR, fn), "rb").read())})
        if s["deleted"]:
            alt_text, npairs = render_alt(s, ms, media)
            open(os.path.join(ALT_DIR, altname(s)), "w", encoding="utf-8", newline="\n").write(alt_text)
            alt_rows.append(f"| [`{altname(s)}`]({altname(s)}) | `{s['key']}` | discarded-branch | {npairs} |")
        for i in range(s["a"], s["b"] + 1):
            if ms[i]["isDeleted"]:
                continue
            for x in media.get(i, []):
                media_rows.append(f"| `#{i:04d}` | `{s['key']}` | `{x['path'] or ('unarchived:' + x['id'])}` | {(x['prompt'] or '').replace('|', '/').replace(chr(10), ' ')} |")
        index_rows.append(f"| `{s['key']}` | [{s['title']}](../../scenes/{fn}) | story-day:{int(s['key'].split('-')[1][1:])} | {s['story_time']} | {s['loc']} | {s['status']} | `#{s['a']:04d}-#{s['b']:04d}` | {len(s['live'])} | {len(s['deleted']) // 2} | {len(s['media'])} | {', '.join(s['flags'])} |")
    nl = "\r\n" if b"\r\n" in raw else "\n"
    open(OVERLAY, "wb").write((json.dumps(man, indent=2, ensure_ascii=False) + "\n").replace("\n", nl).encode("utf-8"))
    open(os.path.join(CTRL_DIR, "_index.md"), "w", encoding="utf-8", newline="\n").write(
        "# Shadowflame Scene Index\n\n"
        f"Generated {CUT_DATE} by the extraction script from the Botify export `{EXPORT_REL}` (see `_source-inventory.md`). "
        "One row per scene file in `../../scenes/`. Ranges are chronological message indices; `Live` counts the operator and bot messages in the body, "
        "`Branches` the discarded operator-turn/reply pairs kept in `_alternates/`, `Images` the bot-attached images.\n\n" + "\n".join(index_rows) + "\n")
    open(os.path.join(ALT_DIR, "_index.md"), "w", encoding="utf-8", newline="\n").write(
        "# Shadowflame alternates index\n\nGenerated " + CUT_DATE + ".\n\n" + "\n".join(alt_rows) + "\n")
    open(os.path.join(CTRL_DIR, "_media-index.md"), "w", encoding="utf-8", newline="\n").write(
        "# Shadowflame media index\n\nEvery image the bot attached to a live message, in transcript order, with the scene it falls in. "
        "Files live under `data/archive/botify/dark-queen-lilith/media/images/` (manifest `data/archive/botify/dark-queen-lilith/media-manifest.json`). "
        "Images attached to deleted replies are listed inside the `_alternates/` file for their scene. Prompts are the bot's own image prompts decoded from the message's `mediaId`; "
        "most messages carry none. These are Botify renderings, not approved reference art.\n\n" + "\n".join(media_rows) + "\n")
    print(f"wrote {len(scenes)} scenes; manifest entries now {len(man['files'])}")


if __name__ == "__main__":
    main()
