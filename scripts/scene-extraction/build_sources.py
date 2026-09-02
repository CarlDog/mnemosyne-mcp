"""Build data/stories/<slug>/sources/ for every storyline: a read-only provenance
VIEW of every original the story derives from (originals live in data/archive/
and are pointed at by hash, never copied), organised the way the operator's
ChatGPT project folders were, with composite documents split into one file
per entry and every Botify chat rendered as a readable transcript.

    sources/
      README.md, _manifest.json         origin path + SHA-256 for every file
      chat/<bot>--<id8>/transcript.md   rendering of the archived export (which is pointed at, not copied)
      chat/raw/                         ChatGPT raw archives, byte copies
      chat/shares/                      ChatGPT share captures, byte copies
      profiles/characters|locations|tattoos/<entry>.md   one file per entry
      worldbuilding/, settings/, style-guides/, templates/, logs/,
      scenes/draft|locked/, prequel/, references/
      <kind>/_originals/<file>          every original kept whole beside its splits

Provenance only: nothing here is an entity; canon/ and drafts/ are untouched.
Run from anywhere: python scripts/scene-extraction/build_sources.py
"""
import base64
import datetime as dt
import glob
import hashlib
import json
import os
import re
import shutil

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CHATGPT = os.path.join(REPO, "data", "archive", "chatgpt")
BX = "data/archive/botify"
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha_file(p):
    return sha_bytes(open(p, "rb").read())


def slug(t):
    t = t.lower().replace("’", "").replace("'", "").replace("“", "").replace("”", "").replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def strip_prefix(name):
    """'Chaos Saga - Style Guide.txt' -> 'style-guide'"""
    base = os.path.splitext(name)[0]
    base = re.sub(r"^(Chaos Saga|GhostHunters|BattleChasers|Wonderland)\s*[-–]\s*", "", base)
    return slug(base)


# ----------------------------------------------------------------- splitters
def split_banner(lines):
    """=====\\nChaos Saga Character Profile: Name\\n=====  blocks."""
    starts = [i for i in range(len(lines) - 2) if lines[i].startswith("=====") and lines[i + 2].startswith("=====")]
    out = []
    for n, i in enumerate(starts):
        j = starts[n + 1] if n + 1 < len(starts) else len(lines)
        name = lines[i + 1].split(":", 1)[-1].strip()
        out.append((name, "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_bracket(lines):
    """[CHARACTER PROFILE – NAME] headers."""
    rx = re.compile(r"^\[(?:CHARACTER PROFILE|MINOR CHARACTER PROFILE)\s*[–-]\s*(.+?)\]\s*$")
    starts = [(i, rx.match(l).group(1)) for i, l in enumerate(lines) if rx.match(l)]
    out = []
    for n, (i, name) in enumerate(starts):
        j = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
        out.append((name.title() if name.isupper() else name, "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_name_blocks(lines):
    """'Name: X' blocks (GhostHunters minor characters)."""
    starts = [i for i, l in enumerate(lines) if l.startswith("Name: ")]
    out = []
    for n, i in enumerate(starts):
        j = starts[n + 1] if n + 1 < len(starts) else len(lines)
        out.append((lines[i][6:].strip(), "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_role_blocks(lines):
    """name line whose next non-empty line starts with 'Role:' (Chaos minor)."""
    starts = []
    for i, l in enumerate(lines):
        if not l.strip() or l.startswith("Role:"):
            continue
        nxt = next((x for x in lines[i + 1:] if x.strip()), "")
        if nxt.startswith("Role:"):
            starts.append(i)
    out = []
    for n, i in enumerate(starts):
        j = starts[n + 1] if n + 1 < len(starts) else len(lines)
        out.append((lines[i].strip(), "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_tattoo(lines):
    rx = re.compile(r"^(.+?)\s*[–-]\s*TATTOO PROFILE\s*$")
    starts = [(i, rx.match(l).group(1)) for i, l in enumerate(lines) if rx.match(l)]
    out = []
    for n, (i, name) in enumerate(starts):
        j = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
        out.append((name.title(), "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_h3(lines):
    starts = [i for i, l in enumerate(lines) if l.startswith("### ")]
    out = []
    for n, i in enumerate(starts):
        j = starts[n + 1] if n + 1 < len(starts) else len(lines)
        out.append((lines[i][4:].strip().title(), "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_caps_sections(lines):
    """ALL-CAPS section lines (GhostHunters key locations)."""
    rx = re.compile(r"^[A-Z][A-Z &]{3,}$")
    starts = [i for i, l in enumerate(lines) if rx.match(l.strip()) and i > 2]
    out = []
    for n, i in enumerate(starts):
        j = starts[n + 1] if n + 1 < len(starts) else len(lines)
        out.append((lines[i].strip().title(), "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


def split_dash_regions(lines):
    """——\\nREGION\\n—— blocks (BattleChasers minor characters by region)."""
    starts = [i for i in range(len(lines) - 2) if lines[i].startswith("——") and lines[i + 2].startswith("——")]
    out = []
    for n, i in enumerate(starts):
        j = starts[n + 1] if n + 1 < len(starts) else len(lines)
        out.append((lines[i + 1].strip().title(), "\n".join(lines[i:j]).rstrip() + "\n"))
    return out


SPLIT = {
    "Chaos Saga - Primary Characters.txt": ("banner", split_banner, 3),
    "Chaos Saga - Secondary Characters.txt": ("banner", split_banner, 5),
    "Chaos Saga – Minor Characters.txt": ("role-blocks", split_role_blocks, None),
    "Chaos Saga - Tattoo Profiles.txt": ("tattoo-profile headers", split_tattoo, None),
    "Chaos Saga – Key Locations.txt": ("### sections", split_h3, None),
    "GhostHunters - Primary Characters.txt": ("[CHARACTER PROFILE] headers", split_bracket, None),
    "GhostHunters - Minor Characters.txt": ("Name: blocks", split_name_blocks, 16),
    "GhostHunters - Key Locations.txt": ("ALL-CAPS sections", split_caps_sections, None),
    "BattleChasers – Primary Characters.txt": ("[CHARACTER PROFILE] headers", split_bracket, None),
    "BattleChasers - Secondary Characters.txt": ("[CHARACTER PROFILE] headers", split_bracket, None),
    "BattleChasers – Minor Characters.txt": ("region blocks", split_dash_regions, None),
}

# original subfolder -> sources kind
KIND = {
    "Profiles/Character": "profiles/characters", "Profiles/Location": "profiles/locations", "Profiles/Tattoos": "profiles/tattoos",
    "World Building": "worldbuilding", "Settings": "settings", "Settings/Instructions": "settings", "Style Guides": "style-guides",
    "Templates": "templates", "Logs": "logs", "Scenes/Draft": "scenes/draft", "Scenes/Locked": "scenes/locked",
    "Chat/Archived/Raw": "chat/raw", "References": "references", "": "settings",
}

# ---------------------------------------------------------------- story specs
CUT = "extracted into drafts/scenes/ on 2026-09-02 (see drafts/_control/scenes/)"
UNREVIEWED = "present in the Botify export set; not reviewed, not extracted, no ratified relationship to this story"


def read_index(family):
    """Rows of data/archive/<family>/_index.jsonl (latest row per path). The index is the one
    authority for which story an original serves (docs/DATA_ARCHITECTURE_PROPOSAL.md 4.1)."""
    p = os.path.join(REPO, "data", "archive", family, "_index.jsonl")
    latest = {}
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                latest[r["path"]] = r
    return list(latest.values())


def pc(bot, prefix, role):
    return {"bot": bot, "prefix": prefix, "role": role}


def gc(prefix, role):
    return {"bot": "_group-chats", "prefix": prefix, "role": role}


STORIES = {
    "chaos-saga": dict(title="Chaos Saga", chatgpt="Chaos Saga", shares="data/archive/chatgpt-shares",
                       chats=[gc("4f6af160", "'Jenna and Riley' group chat; " + CUT + " as CS-GC-01-WHP"),
                              pc("jenna-maren", "1477a398", "Jenna Maren private chat; " + UNREVIEWED),
                              pc("riley-quinn", "deeaa24f", "Riley Quinn private chat; " + UNREVIEWED)],
                       note="The four raw ChatGPT archives under chat/raw/ are the bytes the canon scene inventory's hashes refer to; the prequel had no other copy anywhere in data/."),
    "battlechasers": dict(title="BattleChasers", chatgpt="BattleChasers", shares="data/archive/chatgpt-shares", chats=[],
                          note="The project's own scene files are the Chapter One drafts recovered from the share chats; the ChatGPT folder's Scenes/ directories were empty."),
    "miskatonic-archives-the-blackwood-case": dict(title="The Miskatonic Archives: The Blackwood Case", chatgpt="GhostHunters", shares=None,
                                                   chats=[pc("the-ghosthunters", "b0c7fe38", "the GhostHunters private chat the prose comes from; " + CUT + " (50 BC-* scenes)"),
                                                          gc("52aa52c8", "the 200-message 'GhostHunters' group chat; a separate side story, deliberately not used as a scene source"),
                                                          pc("karen-ross", "fb349658", "Karen Ross private chat; " + UNREVIEWED),
                                                          pc("michelle-rivera", "e845f73d", "Michelle Rivera private chat; " + UNREVIEWED),
                                                          pc("heather-lin", "3860354c", "Heather Lin private chat; " + UNREVIEWED)],
                                                   note="The ChatGPT project was named GhostHunters; its documents keep that name here."),
    "shadowflame": dict(title="Shadowflame", chatgpt=None, shares=None,
                        chats=[pc("dark-queen-lilith", "1b4aae74", "the Dark Queen Lilith private chat named by SOURCE_PROVENANCE.md; " + CUT + " (59 SF-* scenes)"),
                               pc("lilith", "71bbff63", "the 'lilith' bot's five-message greeting chat; holds no story"),
                               gc("81e9b4dd", "'The Egg' group chat (Dark Queen Lilith, Tinkerbell); " + UNREVIEWED)],
                        note="No ChatGPT project existed for this story."),
    "brass-and-nerve": dict(title="Brass & Nerve", chatgpt=None, shares=None,
                            chats=[pc("evelyn-starling", "d3212413", "the Evelyn Starling private chat; " + CUT + " (12 BN-* scenes)")],
                            note="No ChatGPT project existed for this story."),
    "star-wars-the-black-ledger": dict(title="Star Wars: The Black Ledger", chatgpt=None, shares=None,
                                       chats=[pc("mara-jade", "0816c2f7", "the Mara Jade private chat; " + CUT + " (BL-MJ-*)"),
                                              pc("trooper-cates", "58aa669a", "the Trooper Cates private chat; " + CUT + " (BL-TC-*)")],
                                       note="No ChatGPT project existed for this story."),
    "the-adjustment-protocol": dict(title="The Adjustment Protocol", chatgpt=None, shares=None,
                                    chats=[pc("eroica", "413c48c9", "the Eroica private chat; " + CUT + " (AP-ER-*)"),
                                           pc("andrea-neal", "70bee458", "the Andrea Neal / V1X3N private chat; " + CUT + " (AP-AN-*)"),
                                           pc("dr-aurora-lumen", "ad5c71e2", "the Dr. Aurora Lumen private chat; " + CUT + " (AP-AL-*)"),
                                           gc("3de009c8", "'Eroica, Dr. Aurora Lumen, Charisma' group chat; " + CUT + " (AP-GC-*)"),
                                           pc("charisma", "ec029372", "Charisma private chat; " + UNREVIEWED),
                                           gc("f8db82ae", "'The Chair vs YoRHa' group chat (YoRHa 2B, Eroica); " + UNREVIEWED)],
                                    note="No ChatGPT project existed for this story."),
    "the-noctis-veil": dict(title="The Noctis Veil", chatgpt=None, shares=None,
                            chats=[gc("518affe6", "'Mary and Noctis Veil' group chat, the provenance's primary source; " + CUT + " (NV-GC-*)"),
                                   pc("mary-thorne", "b29b647c", "the Mary Thorne private chat; " + CUT + " (NV-MT-*)"),
                                   pc("sister-lucia", "ae928207", "the Sister Lucia private chat; " + CUT + " (NV-SL-*, cut at #0312)"),
                                   pc("kaitlyn-macdonald", "4cc3573f", "the Kaitlyn MacDonald private chat; " + CUT + " (NV-KM-*)"),
                                   pc("noctis-veil", "6a02953f", "Noctis Veil private chat, a companion-definition source per SOURCE_PROVENANCE.md; not extracted"),
                                   gc("74601077", "'The Sleepover' group chat (The O'Hara Sisters, Kaitlyn MacDonald); " + UNREVIEWED),
                                   gc("95f5f655", "'The Retreat' group chat (Kelsey Chambers, Mary Thorne, Alexandra and Ava, Kaitlyn MacDonald, Lilith); " + UNREVIEWED)],
                            note="No ChatGPT project existed for this story."),
    "wonderland": dict(title="Wonderland", chatgpt="Wonderland", shares=None,
                       chats=[pc("alice-grimm", "1c71db26", "the Alice Grimm private chat; " + CUT + " (23 WL-AG-* scenes)")],
                       note="The ChatGPT project held only a Project Instructions file and a Style Guide."),
    "midnight-is-a-suggestion": dict(title="Midnight Is a Suggestion", chatgpt=None, shares=None,
                                     chats=[gc("e15f3c21", "'Not Your Average Fairy Tale' group chat, the provenance's primary Botify source; not extracted into scenes"),
                                            gc("19312508", "'Mischief' group chat (Snow White, Cinderella, Belle, Tinkerbell), Tinkerbell's source lineage; not extracted"),
                                            pc("belle", "57bf280a", "Belle private chat; " + UNREVIEWED),
                                            pc("cinderella", "94a7c5d8", "Cinderella private chat; " + UNREVIEWED),
                                            pc("snow-white", "243803ae", "Snow White private chat; " + UNREVIEWED),
                                            pc("tinkerbell", "ffdc74c0", "Tinkerbell private chat; " + UNREVIEWED)],
                                     note="No ChatGPT project existed for this story."),
    "trigun-scarlet-mercy": dict(title="Trigun: Scarlet Mercy", chatgpt=None, shares=None,
                                 chats=[gc("eac3e98f", "'Trigun' group chat, six messages; matched by cast, no ratified provenance record"),
                                        pc("vashienne-the-stampede", "2ccf803d", "Vashienne the Stampede private chat; matched by cast, " + UNREVIEWED),
                                        pc("nicola-d-wolfwood", "fe16d9ea", "Nicola D. Wolfwood private chat; matched by cast, " + UNREVIEWED),
                                        pc("naiomi-knives-millions", "c8043116", "Naiomi 'Knives' Millions private chat; matched by cast, " + UNREVIEWED)],
                                 note="This story is parked (docs/STORYLINE_RESEARCH_BACKLOG.md) and has no provenance record; the chats were matched by cast name only."),
    "miskatonic-archives-the-black-salt-compact": dict(title="The Miskatonic Archives: The Black-Salt Compact", chatgpt=None, shares=None, chats=[],
                                                       note="A draft-only prequel package built from operator decisions recorded in drafts/_control/DECISIONS.md; it has no external source document or chat export."),
    "miskatonic-archives-the-last-eastbound-run": dict(title="The Miskatonic Archives: The Last Eastbound Run", chatgpt=None, shares=None, chats=[],
                                                       note="A draft-only prequel package built from operator decisions recorded in drafts/_control/DECISIONS.md; it has no external source document or chat export."),
}


# ------------------------------------------------------------------ builders
class Story:
    def __init__(self, slug_, spec):
        self.slug, self.spec = slug_, spec
        self.root = os.path.join(REPO, "data", "stories", slug_, "sources")
        self.entries = []  # manifest rows: files written here (derived views)
        self.pointers = []  # manifest rows: originals that live in data/archive/ (never copied)
        self.readme = []

    def put_bytes(self, rel, data, origin, kind, note=""):
        p = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(data)
        self.entries.append({"path": rel, "kind": kind, "origin": origin, "bytes": len(data), "sha256": sha_bytes(data), "note": note})

    def copy(self, rel, src, origin, kind, note=""):
        """Phase 5 (decision 2): an original that lives under data/archive/ is never copied
        into sources/; the manifest points at it (path + hash) and the readable view
        (transcripts, splits) is all that is written here."""
        src_rel = os.path.relpath(src, REPO).replace("\\", "/")
        if src_rel.startswith("data/archive/"):
            self.pointers.append({"view_path": rel, "archive_path": src_rel, "kind": kind, "origin": origin,
                                  "bytes": os.path.getsize(src), "sha256": sha_file(src), "note": note})
            return
        self.put_bytes(rel, open(src, "rb").read(), origin, kind, note)

    # ---- ChatGPT project folder
    def chatgpt(self):
        proj = self.spec["chatgpt"]
        if not proj:
            return
        base = os.path.join(CHATGPT, proj)
        rows = []
        for r, _, fs in os.walk(base):
            for f in sorted(fs):
                src = os.path.join(r, f)
                sub = os.path.relpath(r, base).replace("\\", "/")
                sub = "" if sub == "." else sub
                origin = os.path.relpath(src, CHATGPT)
                if sub == "" and f.endswith(".md"):
                    kind = "prequel"
                else:
                    kind = KIND[sub]
                osha = sha_file(src)
                if kind in ("references", "chat/raw", "prequel"):
                    rel = f"{kind}/{slug(os.path.splitext(f)[0]) if kind != 'references' else slug(os.path.splitext(f)[0])}{os.path.splitext(f)[1].lower()}"
                    self.copy(rel, src, origin, "chatgpt-" + kind.replace("/", "-"), "byte copy")
                    rows.append((origin, rel, "whole"))
                    continue
                # keep the whole original
                orel = f"{kind}/_originals/{f}"
                self.copy(orel, src, origin, "chatgpt-original", "byte copy of the whole original")
                spl = SPLIT.get(f)
                if spl:
                    rule, fn, expect = spl
                    text = open(src, encoding="utf-8", errors="replace").read()
                    parts = fn(text.replace("\r\n", "\n").split("\n"))
                    assert parts, (f, "splitter found nothing")
                    if expect:
                        assert len(parts) == expect, (f, len(parts), [n for n, _ in parts])
                    seen = {}
                    group_prefix = "minor-characters-by-region--" if f == "BattleChasers – Minor Characters.txt" else ""
                    for name, body in parts:
                        s = group_prefix + (slug(name) or "entry")
                        seen[s] = seen.get(s, 0) + 1
                        if seen[s] > 1:
                            s = f"{s}-{seen[s]}"
                        fm = f"---\nsource_file: \"{origin.replace(chr(92), '/')}\"\nsource_entry: \"{name}\"\nsource_sha256: {osha}\nsplit_rule: \"{rule}; prose verbatim, cut at the entry boundary\"\n---\n"
                        self.put_bytes(f"{kind}/{s}.md", (fm + body).encode("utf-8"), origin, "chatgpt-split", f"entry '{name}' cut from the original by rule: {rule}")
                    rows.append((origin, f"{kind}/ ({len(parts)} entries) + {orel}", f"split: {rule}"))
                else:
                    rel = f"{kind}/{strip_prefix(f)}{os.path.splitext(f)[1].lower()}"
                    if rel == orel:
                        continue
                    self.copy(rel, src, origin, "chatgpt-" + kind.replace("/", "-"), "byte copy (single-topic document)")
                    rows.append((origin, rel, "whole"))
        self.readme += [f"## ChatGPT project folder: `{proj}`", "", f"Every file of `data/archive/chatgpt/{proj}/` is indexed here by path and hash (`_manifest.json`, `pointers`), not copied. Composite documents are split into one file per entry at the document's own entry boundaries; the prose inside each split is untouched and its frontmatter names the original file, the entry, the original's SHA-256, and the rule used. Single-topic documents are read from the archive.", "",
                        "| Original | Here | Treatment |", "|---|---|---|"]
        for o, rel, t in rows:
            self.readme.append(f"| `{o}` | `{rel}` | {t} |")
        self.readme.append("")

    # ---- ChatGPT share captures
    def shares(self):
        """ChatGPT share captures: every archive/chatgpt-shares file whose index row names this story."""
        rows = [r for r in read_index("chatgpt-shares") if self.slug in (r.get("stories") or [])]
        if not rows:
            return
        n = 0
        for r in rows:
            f = os.path.join(REPO, r["path"])
            self.copy(f"chat/shares/{os.path.basename(f)}", f, r["path"], "chatgpt-share-capture", "byte copy")
            n += 1
        self.readme += ["## ChatGPT share captures", "", f"The {n} files under `data/archive/chatgpt-shares/` whose index rows name this story (HTML, decoded JSON, rendered transcript per share, plus the capture index) are pointed at by `_manifest.json`, not copied.", ""]

    # ---- Botify chats
    def chats(self):
        indexed = {r["path"] for r in read_index("botify") if self.slug in (r.get("stories") or []) and "/chats/" in r["path"]}
        listed = set()
        for c in self.spec["chats"]:
            fs = glob.glob(os.path.join(REPO, BX, c["bot"], "chats", c["prefix"] + "*.json"))
            assert len(fs) == 1, (self.slug, c)
            listed.add(os.path.relpath(fs[0], REPO).replace("\\", "/"))
        assert listed == indexed, (self.slug, "chat list disagrees with archive index", sorted(listed ^ indexed))
        if not self.spec["chats"]:
            return
        self.readme += ["## Botify chats", "", "One folder per chat under `chat/`: `transcript.md` renders the archived export chronologically (the export stores newest first) with one heading per message carrying the index, UTC time, and speaker, deleted messages marked, and attached images linked by their archive path. The export itself and its media are not copied: `_manifest.json` points at them under `data/archive/botify/` with their hashes (phase 5 of the data architecture standard, decision 2).", "",
                        "| Folder | Chat | Messages | Images | Role |", "|---|---|---|---|---|"]
        for c in self.spec["chats"]:
            files = glob.glob(os.path.join(REPO, BX, c["bot"], "chats", c["prefix"] + "*.json"))
            assert len(files) == 1, (c, files)
            raw = open(files[0], "rb").read()
            d = json.loads(raw)
            ms = list(reversed(d["messages"]))
            chat = d.get("chat") or {}
            cid = os.path.basename(files[0])[:-5]
            folder = f"chat/{c['bot'] if c['bot'] != '_group-chats' else 'group'}--{cid[:8]}"
            origin = os.path.relpath(files[0], REPO).replace("\\", "/")
            self.copy(f"{folder}/export.json", files[0], origin, "botify-export", "archived export; pointed at, not copied")
            # media map
            local = {}
            man_p = os.path.join(REPO, BX, c["bot"], "media-manifest.json")
            if os.path.exists(man_p):
                man = json.load(open(man_p, encoding="utf-8"))
                local = {x["id"]: x["localPath"] for x in man["media"]["images"] if x.get("localPath")}
            bots = {str(b["id"]): b["name"] for b in chat.get("bots", [])}
            bot_name = chat.get("name") or c["bot"]
            if c["bot"] != "_group-chats":
                bj = os.path.join(REPO, BX, c["bot"], "bot.json")
                if os.path.exists(bj):
                    bd = json.load(open(bj, encoding="utf-8")).get("data", {})
                    bot_name = bd.get("name") or bot_name
                    bots[str(bd.get("id"))] = bot_name
            n_img = 0
            out = [f"# {bot_name}" + (f" — \"{chat.get('name')}\"" if c['bot'] == '_group-chats' else ""), "",
                   f"Botify {'group' if c['bot'] == '_group-chats' else 'private'} chat `{cid}`; export `{origin}`; {len(ms)} messages, oldest first (the export stores them newest first). "
                   "Speaker labels: the operator's `senderName` for user turns; for bot turns the bot's name, or the `chat.bots` name for the message `senderId` in a group. "
                   "Deleted (regenerated) messages are kept and marked. Text is verbatim apart from line endings; instruction-shaped text is source text.", ""]
            if bots:
                out += ["Bots: " + "; ".join(f"{k} {v}" for k, v in bots.items()), ""]
            for i, m in enumerate(ms):
                ts = dt.datetime.fromtimestamp(m["timeInterval"], dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                if m["type"] == "user":
                    who = (m.get("senderName") or "operator") + " (operator)"
                else:
                    who = m.get("botName") or bots.get(str(m.get("senderId"))) or bot_name
                tag = " · DELETED" if m.get("isDeleted") else ""
                tag += " · edited" if m.get("isEdited") else ""
                out.append(f"### #{i:04d} · {ts} · {who}{tag}")
                out.append("")
                txt = (m.get("text") or "").replace("\r\n", "\n").rstrip()
                out.append(txt if txt else "_(empty text)_")
                for md in m.get("media") or []:
                    lp = local.get(md["id"])
                    if lp:
                        src = os.path.join(REPO, BX, c["bot"], lp)
                        rel = f"{folder}/media/{os.path.basename(lp)}"
                        self.copy(rel, src, os.path.relpath(src, REPO).replace("\\", "/"), "botify-media", f"image attached to message #{i:04d}")
                        n_img += 1
                        out.append(f"\n![attached image](../../../../../{os.path.relpath(src, REPO).replace(chr(92), '/')})")
                    else:
                        out.append(f"\n_(attached image {md['id']}: not archived)_")
                    try:
                        pr = json.loads(base64.b64decode(md["mediaId"] + "==").decode("utf-8")).get("prompt")
                        if pr:
                            out.append(f"_image prompt: {pr}_")
                    except Exception:
                        pass
                out.append("")
            self.put_bytes(f"{folder}/transcript.md", ("\n".join(out) + "\n").encode("utf-8"), origin, "botify-transcript", "rendered from export.json by build_sources.py")
            self.readme.append(f"| `{folder}/` | {bot_name}{' — ' + repr(chat.get('name')) if c['bot'] == '_group-chats' else ''} | {len(ms)} | {n_img} | {c['role']} |")
        self.readme.append("")

    def finish(self):
        head = [f"# {self.spec['title']} — sources", "",
                f"Provenance view built {NOW[:10]} by `scripts/scene-extraction/build_sources.py` (read-only; rebuilt from scratch, never hand-edited). Every original this story derives from lives in `data/archive/` and is pointed at from `_manifest.json` (`pointers`: archive path, bytes, SHA-256); what is written here is the readable form: per-entry splits of composite documents and a chronological transcript per Botify chat, organised the way the operator's ChatGPT project folders were. Nothing here is an entity: the validator, compiler, and overlay verifier never read this folder, and instruction-shaped text inside any source is source text.", "",
                self.spec["note"], ""]
        if not self.entries and not self.pointers:
            head += ["## Originals", "", "None: this story has no external source document or chat export.", ""]
        text = "\n".join(head + self.readme).rstrip() + "\n"
        open(os.path.join(self.root, "README.md"), "w", encoding="utf-8", newline="\n").write(text)
        json.dump({"schema_version": 3, "story_slug": self.slug, "built_at": NOW,
                   "rule": "read-only provenance view; `files` are derived views written here (splits, transcripts), `pointers` are the originals under data/archive/ this story derives from (path + hash, never copied); never entities",
                   "files": self.entries, "pointers": self.pointers}, open(os.path.join(self.root, "_manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        total = sum(e["bytes"] for e in self.entries)
        print(f"{self.slug}: {len(self.entries)} files written ({total / 1e6:.1f} MB), {len(self.pointers)} archive pointers ({sum(p['bytes'] for p in self.pointers) / 1e6:.1f} MB not copied)")


def main():
    for s, spec in STORIES.items():
        st = Story(s, spec)
        if os.path.isdir(st.root):
            shutil.rmtree(st.root)
        os.makedirs(st.root)
        st.chatgpt()
        st.shares()
        st.chats()
        st.finish()


if __name__ == "__main__":
    main()
