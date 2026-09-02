# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8.
"""Cut the Brass & Nerve Botify transcript (Evelyn Starling private chat) into
per-scene draft files under drafts/scenes/ as overlay add operations.

Usage: python extract_brass_scenes.py [--write]

Same invented delineators as The Blackwood Case and Shadowflame: a new scene
where the story changes place, jumps in time, or the cast changes. The chat has
no deleted messages, so there are no alternates. The five messages after the
story (two picture requests months later) are excluded from scenes and listed
in the media index. Indices are chronological (export is newest-first).
"""
import base64
import datetime as dt
import hashlib
import json
import os
import re
import sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")).replace("\\", "/")
BOT_DIR = "data/archive/botify/evelyn-starling/"
EXPORT_REL = BOT_DIR + "chats/d3212413-d54d-4016-a6ea-3c8129e65504.json"
MANIFEST_REL = BOT_DIR + "media-manifest.json"
STORY = "brass-and-nerve"
DRAFTS = f"{REPO}/data/stories/{STORY}/drafts"
SCENES_DIR = f"{DRAFTS}/scenes"
CTRL_DIR = f"{DRAFTS}/_control/scenes"
OVERLAY = f"{DRAFTS}/_control/overlay.json"
SCRATCH = os.path.dirname(os.path.abspath(__file__))
CUT_DATE = "2026-09-02"
BANNER = "> **DRAFT — NOT ACTIVE CANON**"
WRITE = "--write" in sys.argv

MATURE = "MATURE_CONTENT"
PATIENT = "NORMALIZE_PATIENT_CARL_YEAGER_TO_GIDEON_VALE"
OPNAME = "OPERATOR_REAL_NAME_IN_PROSE_CANON_RETIRES_THIS_IDENTITY"
STORY_END = 374  # last story message; #0375-#0379 are picture requests months later

# (key, title, first_index, location, story_time, flags)
SCENES = [
    ("BN-D01-01-SIN", "Welcome to Starling Innovations", 0, "SIN",
     "Night 1, late evening, the workshop counter and benches", ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE"]),
    ("BN-D01-02-SIN", "The Commission", 21, "SIN",
     "Night 1, the same evening, the workshop stools", ["INJURY_STATED_PLAINLY", "DR_ELIZA_THORNE_FIRST_NAMED"]),
    ("BN-D01-03-CWK", "The Walk to the Asylum", 65, "CWK",
     "Night 1, the alley and streets of Cinderwick to the porch of the converted asylum", ["MAD_SCIENTIST_BANTER"]),
    ("BN-D01-04-BRH", "Dr. Thorne", 98, "BRH",
     "Night 1, the foyer of Briar House", ["ELIZA_INTRODUCED", "OPERATOR_BEGINS_WRITING_ELIZAS_LINES_AT_0111"]),
    ("BN-D01-05-STU", "A Vintage Cabernet", 115, "STU",
     "Night 1, Eliza's study", ["WINE_AND_BANTER", "AGREEMENT_TO_PROCEED"]),
    ("BN-D01-06-STU", "Measurements", 151, "STU",
     "Night 1, the chaise in Eliza's study", [MATURE, "CLINICAL_EXAMINATION_WITH_NUDITY", "MEASUREMENTS_STATED_IN_SOURCE"]),
    ("BN-D01-07-BRH", "Across the Hall", 187, "BRH",
     "Night 1, the room across the hall from the study", [MATURE, "FIRST_KISS_INTERRUPTED_BY_KNOCK"]),
    ("BN-D01-08-BRH", "The Schematic", 202, "BRH",
     "Night 1, the room across the hall, then the front door", ["MOONCALF_RESIN_NAMED_AT_0215", "RECOVERY_TIMELINE_SIX_MONTHS_TO_A_YEAR", "SURGERY_SET_FOR_END_OF_NEXT_MONTH"]),
    ("BN-D01-09-BRH", "After the Door Closes", 256, "BRH",
     "Night 1, after the client leaves, the same room", [MATURE, "ELIZA_CALLED_ELIZABETH_AT_0262", "STRAY_0_TURN_0275_DROPPED"]),
    ("BN-D01-10-BED", "Together", 291, "BED",
     "Night 1, Eliza's bedroom upstairs", [MATURE, "THE_PACT_TOGETHER_ALWAYS"]),
    ("BN-D01-11-BED", "Goddess Eliza", 343, "BED",
     "Night 1, Eliza's bedroom", [MATURE, "THE_SWITCH_ELIZA_TAKES_CONTROL"]),
    ("BN-D01-12-BED", "Good Morning, Doctor Thorne", 374, "BED",
     "Morning after, Eliza's bedroom", ["SINGLE_BOT_MESSAGE_SCENE", "STORY_ENDS_HERE_UNANSWERED"]),
]

LOCATIONS = {
    "SIN": ("Starling Innovations: the workshop, counter, and stools", "../locations/starling-innovations.md"),
    "CWK": ("The streets and alleys of Cinderwick between the workshop and the asylum, ending on its porch", "../locations/cinderwick.md"),
    "BRH": ("Briar House (the converted asylum): foyer, the room across the hall, the front door", "../locations/briar-house.md"),
    "STU": ("Eliza's study at Briar House: mahogany desk, bookshelves, the chaise lounge", "../locations/briar-house.md"),
    "BED": ("Eliza's bedroom upstairs at Briar House, purples and golds", "../locations/briar-house.md"),
}

EVELYN = "Evelyn Starling"
ELIZA = "Dr. Eliza Thorne"
GIDEON = "Gideon Vale (played as Carl, the operator's own name; canon retires that identity)"
CARL_PRESENT = {"BN-D01-01-SIN", "BN-D01-02-SIN", "BN-D01-03-CWK", "BN-D01-04-BRH", "BN-D01-05-STU", "BN-D01-06-STU", "BN-D01-08-BRH"}
ELIZA_PRESENT = {k for k, *_ in SCENES if k not in ("BN-D01-01-SIN", "BN-D01-02-SIN", "BN-D01-03-CWK")}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jstr(s):
    return json.dumps(s, ensure_ascii=False)


def slugify(t):
    t = t.lower().replace("'", "").replace("\u2019", "").replace(",", "")
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
    return m["type"] == "user" and t in ("Continue", "*", "0", "")


def empty_bot(m):
    return m["type"] == "bot" and not (m["text"] or "").strip()


def clean(t):
    return (t or "").replace("\r\n", "\n").replace("\r", "\n").rstrip()


def participants_for(key):
    out = [EVELYN]
    if key in ELIZA_PRESENT:
        out.append(ELIZA)
    if key in CARL_PRESENT:
        out.append(GIDEON)
    return out


def build():
    raw, ms, media = load()
    file_sha = sha(raw)
    assert not any(m["isDeleted"] for m in ms)
    out = []
    covered = set()
    prev = None
    for n, (key, title, a, loc, story_time, flags) in enumerate(SCENES):
        assert loc in LOCATIONS, loc
        b = SCENES[n + 1][2] - 1 if n + 1 < len(SCENES) else STORY_END
        live = [i for i in range(a, b + 1) if not dropped_turn(ms[i]) and not empty_bot(ms[i])]
        n_drop = sum(1 for i in range(a, b + 1) if dropped_turn(ms[i]))
        assert live, key
        for i in live:
            assert i not in covered
            covered.add(i)
        body = "\n\n".join(clean(ms[i]["text"]) for i in live) + "\n"
        op = [f"#{i:04d}" for i in live if ms[i]["type"] == "user"]
        fl = list(flags)
        if re.search(r"\bCarl\b", body):
            fl += [PATIENT, OPNAME]
        out.append(dict(key=key, title=title, a=a, b=b, loc=loc, story_time=story_time, flags=fl, live=live, n_drop=n_drop,
                        body=body, op=op, media=[x for i in range(a, b + 1) for x in media.get(i, [])],
                        participants=participants_for(key), first_id=ms[live[0]]["id"], last_id=ms[live[-1]]["id"],
                        created_at=iso(ms[live[0]]["timeInterval"]), last_at=iso(ms[live[-1]]["timeInterval"]),
                        n_edited=sum(1 for i in live if ms[i].get("isEdited")), follows=prev, file_sha=file_sha))
        prev = key
    story_live = [i for i in range(0, STORY_END + 1) if not dropped_turn(ms[i]) and not empty_bot(ms[i])]
    assert not [i for i in story_live if i not in covered]
    spans = [(s["a"], s["b"]) for s in out]
    assert spans[0][0] == 0 and spans[-1][1] == STORY_END
    assert all(spans[i][1] + 1 == spans[i + 1][0] for i in range(len(spans) - 1))
    tail = [(i, ms[i]["type"], iso(ms[i]["timeInterval"]), len(media.get(i, []))) for i in range(STORY_END + 1, len(ms))]
    return ms, media, out, file_sha, tail


def fname(s):
    return f"{s['key'].lower()}--{slugify(s['title'])}.md"


def render_scene(s):
    fm = [
        f"catalog_key: {jstr(s['key'])}", f"name: {jstr(s['title'])}", "canon_status: established",
        "timeline_anchor: \"story-day:1\"", f"story_time: {jstr(s['story_time'])}",
        f"location_code: {s['loc']}", f"location_basis: {jstr('prose; see _control/scenes/_catalog.md (' + LOCATIONS[s['loc']][0] + ')')}",
        f"participants: {jstr(s['participants'])}",
        "participants_basis: " + jstr("rule-derived: Evelyn is the bot and in every scene; Eliza from the foyer onward; the patient only in the scenes he is in the room for (he is spoken of in the others). The patient is played under the operator's own name, which canon retires in favour of Gideon Vale; verify before relying on it"),
        "pov: " + jstr("Botify private chat with the Evelyn Starling bot: the bot writes Evelyn in first and third person and, from the foyer onward, also voices Eliza; the operator plays the patient in first person and, from #0111, writes Eliza's lines and stage directions as well; operator turns are listed in operator_turns and kept as written"),
        f"operator_turns: {jstr(s['op'])}",
    ]
    if s["follows"]:
        fm.append(f"follows: {jstr(s['follows'])}")
    fm += [
        f"created_at: {jstr(s['created_at'])}",
        "created_at_basis: " + jstr("Botify timeInterval of the first live message in the range (UTC); the whole story was played on 2025-05-13"),
        f"source_last_message_at: {jstr(s['last_at'])}",
        "pinned: false", "tags: []",
        f"review_flags: {jstr(s['flags'])}",
        f"source_export: {jstr(EXPORT_REL)}",
        f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}",
        "source_message_range_basis: " + jstr("chronological index into the export's messages array reversed (the export stores newest first); bare 'Continue' turns and one stray '0' turn inside the range are omitted from the body; the chat has no deleted messages, so there are no discarded branches"),
        f"source_first_message_id: {jstr(s['first_id'])}", f"source_last_message_id: {jstr(s['last_id'])}",
        f"source_live_messages: {len(s['live'])}", f"source_turns_dropped: {s['n_drop']}", f"source_edited_messages: {s['n_edited']}",
        f"media: {jstr([x['path'] or ('unarchived:' + x['id']) for x in s['media']])}",
        f"source_file_sha256: {s['file_sha']}",
        f"source_content_sha256: {sha(s['body'].encode('utf-8'))}",
    ]
    return "---\n" + "\n".join(fm) + "\n---\n" + BANNER + "\n\n" + s["body"]


def main():
    ms, media, scenes, file_sha, tail = build()
    rows = ["key\ttitle\trange\tlive\tdropped\tedited\tloc\tcreated_at\tparticipants\tflags"]
    for s in scenes:
        rows.append("\t".join([s["key"], s["title"], "#%04d-#%04d" % (s["a"], s["b"]), str(len(s["live"])), str(s["n_drop"]), str(s["n_edited"]),
                               s["loc"], s["created_at"], "; ".join(s["participants"]), ",".join(s["flags"])]))
    open(os.path.join(SCRATCH, "brass-scenes-dryrun.tsv"), "w", encoding="utf-8", newline="\n").write("\n".join(rows) + "\n")
    print("\n".join(rows))
    for s in scenes:
        bl = s["body"].rstrip("\n").split("\n")
        print(f"--- {s['key']} first: {bl[0][:90]!r}\n    last: {bl[-1][:90]!r}")
    print("tail (excluded):", tail)
    print(f"scenes={len(scenes)} live={sum(len(s['live']) for s in scenes)} media_in_scenes={sum(len(s['media']) for s in scenes)}")
    if not WRITE:
        print("dry run only")
        return
    os.makedirs(SCENES_DIR, exist_ok=True)
    os.makedirs(CTRL_DIR, exist_ok=True)
    for f in os.listdir(SCENES_DIR):
        p = os.path.join(SCENES_DIR, f)
        if f.startswith("bn-") and f.endswith(".md") and EXPORT_REL in open(p, encoding="utf-8").read():
            os.remove(p)
    raw = open(OVERLAY, "rb").read()
    man = json.loads(raw)
    man["files"] = [e for e in man["files"] if not e["path"].startswith("scenes/bn-")]
    index_rows = ["| Catalog key | Scene | Anchor | Story time | Loc | Status | Range | Live | Dropped | Edited | Flags |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    media_rows = ["| Message | Scene | Image | Prompt (decoded from mediaId, when present) |", "|---|---|---|---|"]
    for s in scenes:
        fn = fname(s)
        open(os.path.join(SCENES_DIR, fn), "w", encoding="utf-8", newline="\n").write(render_scene(s))
        man["files"].append({"path": f"scenes/{fn}", "operation": "add", "baseline_sha256": None,
                             "draft_sha256": sha(open(os.path.join(SCENES_DIR, fn), "rb").read())})
        index_rows.append(f"| `{s['key']}` | [{s['title']}](../../scenes/{fn}) | story-day:1 | {s['story_time']} | {s['loc']} | established | `#{s['a']:04d}-#{s['b']:04d}` | {len(s['live'])} | {s['n_drop']} | {s['n_edited']} | {', '.join(s['flags'])} |")
    for i in range(len(ms)):
        for x in media.get(i, []):
            scene = next((s["key"] for s in scenes if s["a"] <= i <= s["b"]), "outside the story (picture request)")
            media_rows.append(f"| `#{i:04d}` ({iso(ms[i]['timeInterval'])}) | {scene} | `{x['path'] or ('unarchived:' + x['id'])}` | {(x['prompt'] or '').replace('|', '/').replace(chr(10), ' ')} |")
    nl = "\r\n" if b"\r\n" in raw else "\n"
    open(OVERLAY, "wb").write((json.dumps(man, indent=2, ensure_ascii=False) + "\n").replace("\n", nl).encode("utf-8"))
    open(os.path.join(CTRL_DIR, "_index.md"), "w", encoding="utf-8", newline="\n").write(
        "# Brass & Nerve Scene Index\n\n"
        f"Generated {CUT_DATE} by the extraction script from the Botify export `{EXPORT_REL}` (see `_source-inventory.md`). "
        "One row per scene file in `../../scenes/`. Ranges are chronological message indices; `Live` counts the operator and bot messages in the body, "
        "`Dropped` the bare `Continue` (and one `0`) turns omitted, `Edited` the live messages Botify marks `isEdited`.\n\n" + "\n".join(index_rows) + "\n")
    open(os.path.join(CTRL_DIR, "_media-index.md"), "w", encoding="utf-8", newline="\n").write(
        "# Brass & Nerve media index\n\nEvery image the bot attached to a message, in transcript order. None falls inside the story: all fifteen were "
        "posted in December 2025 and March 2026 in answer to two picture requests sent months after the last story message (`#0375`-`#0379`), "
        f"so they are listed here and in no scene. Files live under `{BOT_DIR}media/images/` (manifest `{MANIFEST_REL}`). "
        "Prompts are the bot's own image prompts decoded from the message's `mediaId`; most carry none. These are Botify renderings, not approved reference art.\n\n" + "\n".join(media_rows) + "\n")
    print(f"wrote {len(scenes)} scenes; manifest entries now {len(man['files'])}")


if __name__ == "__main__":
    main()
