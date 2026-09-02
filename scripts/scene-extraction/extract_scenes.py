"""Shared engine: cut one or more Botify private-chat exports into per-scene
draft files under data/stories/<slug>/drafts/scenes/ as overlay `add`
operations, with documentation, indexes, media index, and alternates under
drafts/_control/scenes/.

Usage: python extract_scenes.py <config-module> [--write]

The config module (cuts_<story>.py, same folder) declares STORY, LOCATIONS,
and CHATS. Each chat has its own thread code, story-end index, and cut table.
Invented delineators are the same as every earlier extraction: a new scene
where the story changes place, jumps in time, or the cast changes; play-session
gaps are not boundaries; ranges are contiguous so every deleted message lands
in the scene it precedes. Prose is verbatim (line endings normalised).

Dropped from bodies, counted in frontmatter: bare `Continue` / `*` / `0` /
empty operator turns; pure-directive operator turns (text starting with `/`
or `\\`, listed in `source_directive_turns`); image-only or blank bot
messages; every `isDeleted` message (each one, paired or not, is written to
the scene's `_alternates/` file, with "text not retained by the export" when
Botify exported an empty string).
"""
import base64
import datetime as dt
import glob
import hashlib
import importlib
import json
import os
import re
import sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")).replace("\\", "/")
SCRATCH = os.path.dirname(os.path.abspath(__file__))
BANNER = "> **DRAFT — NOT ACTIVE CANON**"
MATURE = "MATURE_CONTENT"
WRITE = "--write" in sys.argv


def sha(b):
    return hashlib.sha256(b).hexdigest()


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jstr(s):
    return json.dumps(s, ensure_ascii=False)


def slugify(t):
    t = t.lower().replace("'", "").replace("\u2019", "").replace(",", "").replace("!", "").replace("?", "")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def clean(t):
    return (t or "").replace("\r\n", "\n").replace("\r", "\n").rstrip()


def is_directive(t):
    return t.startswith("/") or t.startswith("\\")


def dropped_turn(m):
    t = (m["text"] or "").strip()
    return m["type"] == "user" and t in ("Continue", "*", "0", "")


def directive_turn(m):
    t = (m["text"] or "").strip()
    return m["type"] == "user" and bool(t) and is_directive(t)


def empty_bot(m):
    return m["type"] == "bot" and not (m["text"] or "").strip()


def load_chat(chat):
    files = glob.glob(f"{REPO}/{chat['bot_dir']}chats/{chat['export']}*.json")
    assert len(files) == 1, (chat["export"], files)
    export_rel = os.path.relpath(files[0], REPO).replace("\\", "/")
    raw = open(files[0], "rb").read()
    d = json.loads(raw)
    ms = list(reversed(d["messages"]))
    group = bool(chat.get("group"))
    if group:
        local, n_archived = {}, 0
    else:
        man = json.load(open(f"{REPO}/{chat['bot_dir']}media-manifest.json", encoding="utf-8"))
        local = {x["id"]: chat["bot_dir"] + x["localPath"] for x in man["media"]["images"] if x.get("localPath")}
        n_archived = len(man["media"]["images"])
    media = {}
    for i, m in enumerate(ms):
        for md in m.get("media") or []:
            try:
                prompt = json.loads(base64.b64decode(md["mediaId"] + "==").decode("utf-8")).get("prompt")
            except Exception:
                prompt = None
            media.setdefault(i, []).append({"id": md["id"], "path": local.get(md["id"]), "prompt": prompt})
    if group:
        bots = {str(b["id"]): b["name"] for b in (d.get("chat") or {}).get("bots", [])}
        assert bots, "group export without chat.bots"
        for m in ms:
            if m["type"] == "bot":
                m["_speaker"] = m.get("botName") or bots.get(str(m.get("senderId"))) or f"bot {m.get('senderId')}"
            else:
                m["_speaker"] = "Operator"
        bot_id, bot_name = "group", "; ".join(f"{k} {v}" for k, v in bots.items())
    else:
        bot = json.load(open(f"{REPO}/{chat['bot_dir']}bot.json", encoding="utf-8"))
        bd = bot.get("data", bot)
        bot_id, bot_name = bd.get("id"), bd.get("name")
    info = {"export_rel": export_rel, "file_sha": sha(raw), "chat_id": os.path.basename(files[0])[:-5],
            "bot_id": bot_id, "bot_name": bot_name, "n": len(ms), "group": group, "chat_name": (d.get("chat") or {}).get("name"),
            "chat_type": (d.get("chat") or {}).get("type"), "images_archived": n_archived,
            "n_bot": sum(1 for m in ms if m["type"] == "bot"), "n_user": sum(1 for m in ms if m["type"] == "user"),
            "n_deleted": sum(1 for m in ms if m.get("isDeleted")),
            "n_continue": sum(1 for m in ms if dropped_turn(m)),
            "n_directive": sum(1 for m in ms if directive_turn(m) and not m.get("isDeleted")),
            "n_empty_bot": sum(1 for m in ms if empty_bot(m) and not m.get("isDeleted")),
            "n_media": sum(len(v) for v in media.values()),
            "first_at": iso(min(m["timeInterval"] for m in ms)), "last_at": iso(max(m["timeInterval"] for m in ms)),
            "sender": next((m.get("senderName") for m in ms if m["type"] == "user" and m.get("senderName")), None)}
    return ms, media, info


def build_chat(story, chat):
    ms, media, info = load_chat(chat)
    end = chat["story_end"]
    scenes = chat["scenes"]
    out = []
    covered = set()
    prev = None
    for n, (key, title, a, day, loc, story_time, participants, flags) in enumerate(scenes):
        assert key.startswith(story["prefix"] + "-" + chat["code"] + "-"), key
        assert loc in story["locations"], (key, loc)
        b = scenes[n + 1][2] - 1 if n + 1 < len(scenes) else end
        assert a <= b, key
        rng = range(a, b + 1)
        deleted = [i for i in rng if ms[i].get("isDeleted")]
        live = [i for i in rng if not ms[i].get("isDeleted") and not dropped_turn(ms[i]) and not directive_turn(ms[i]) and not empty_bot(ms[i])]
        directives = [i for i in rng if not ms[i].get("isDeleted") and directive_turn(ms[i])]
        n_drop = sum(1 for i in rng if not ms[i].get("isDeleted") and dropped_turn(ms[i]))
        n_empty = sum(1 for i in rng if not ms[i].get("isDeleted") and empty_bot(ms[i]))
        assert live, key
        for i in live:
            assert i not in covered, (key, i)
            covered.add(i)
        if chat.get("group"):
            body = "\n\n".join(f"**{ms[i]['_speaker']}:** " + clean(ms[i]["text"]) for i in live) + "\n"
        else:
            body = "\n\n".join(clean(ms[i]["text"]) for i in live) + "\n"
        fl = list(flags)
        for i in live:
            t = (ms[i]["text"] or "")
            if ms[i]["type"] == "user" and re.search(r"(?m)^[ \t]*[/\\](OOC|ooc|describe|craft)", t) and not is_directive(t.strip()):
                fl.append(f"OOC_DIRECTIVE_INSIDE_OPERATOR_TURN_{i:04d}")
        if "<|user|>" in body:
            fl.append("TOKEN_ARTIFACT_IN_BOT_TEXT")
        for x, y in zip(live, live[1:]):
            if ms[x]["type"] == "bot" and ms[y]["type"] == "bot" and clean(ms[x]["text"]) == clean(ms[y]["text"]):
                fl.append(f"DUPLICATE_BOT_REPLY_{y:04d}")
        if deleted:
            fl.append("HAS_DISCARDED_MESSAGES")
        out.append(dict(key=key, title=title, a=a, b=b, day=day, loc=loc, story_time=story_time, participants=participants,
                        flags=fl, live=live, deleted=deleted, directives=directives, n_drop=n_drop, n_empty=n_empty, body=body,
                        op=[f"#{i:04d}" for i in live if ms[i]["type"] == "user"],
                        media=[x for i in rng for x in media.get(i, []) if not ms[i].get("isDeleted")],
                        first_id=ms[live[0]]["id"], last_id=ms[live[-1]]["id"],
                        created_at=iso(ms[live[0]]["timeInterval"]), last_at=iso(ms[live[-1]]["timeInterval"]),
                        n_edited=sum(1 for i in live if ms[i].get("isEdited")), follows=prev, chat=chat, info=info))
        prev = key
    story_live = [i for i in range(0, end + 1) if not ms[i].get("isDeleted") and not dropped_turn(ms[i]) and not directive_turn(ms[i]) and not empty_bot(ms[i])]
    assert not [i for i in story_live if i not in covered]
    spans = [(s["a"], s["b"]) for s in out]
    assert spans[0][0] == 0 and spans[-1][1] == end
    assert all(spans[i][1] + 1 == spans[i + 1][0] for i in range(len(spans) - 1))
    tail = [(i, ms[i]["type"], iso(ms[i]["timeInterval"]), len(media.get(i, []))) for i in range(end + 1, len(ms))]
    return ms, media, info, out, tail


def fname(s):
    return f"{s['key'].lower()}--{slugify(s['title'])}.md"


def altname(s):
    return f"alt-{s['key'].lower()}--discarded-messages.md"


def render_scene(story, s):
    chat, info, L = s["chat"], s["info"], story["locations"]
    fm = [
        f"catalog_key: {jstr(s['key'])}", f"name: {jstr(s['title'])}", "canon_status: established",
        f"timeline_anchor: {jstr(story.get('anchor_fn', lambda d: 'story-day:%d' % d)(s['day']))}", f"story_time: {jstr(s['story_time'])}",
        f"location_code: {s['loc']}",
        f"location_basis: {jstr('prose; see _control/scenes/_catalog.md (' + L[s['loc']][0] + ')')}",
        f"participants: {jstr(s['participants'])}",
        f"participants_basis: {jstr(chat['participants_basis'])}",
        f"pov: {jstr(chat['pov'])}",
        f"operator_turns: {jstr(s['op'])}",
    ]
    if s["follows"]:
        fm.append(f"follows: {jstr(s['follows'])}")
    fm += [
        f"created_at: {jstr(s['created_at'])}",
        f"created_at_basis: {jstr('Botify timeInterval of the first live message in the range (UTC); ' + chat['played'])}",
        f"source_last_message_at: {jstr(s['last_at'])}",
        "pinned: false", "tags: []",
        f"review_flags: {jstr(s['flags'])}",
        f"source_thread: {jstr(chat['code'] + ' = ' + chat['label'])}",
        f"source_chat_kind: {jstr('Botify group chat; every message in the body opens with a bold speaker label taken from the export (the chat.bots name for the message senderId, since botName is null throughout these exports; the neutral label Operator for the operator turns, whose senderName is recorded in _source-inventory.md); the labels are extraction metadata, not source prose, and are inside the hashed body' if info['group'] else 'Botify private chat; bodies are the message texts alone')}",
        f"source_bot: {jstr((info['bot_name'] if info['group'] else str(info['bot_id']) + ' ' + str(info['bot_name'])))}",
        f"source_export: {jstr(info['export_rel'])}",
        f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}",
        "source_message_range_basis: " + jstr("chronological index into the export's messages array reversed (the export stores newest first); deleted messages, bare 'Continue'/'*'/'0' turns, pure-directive operator turns, and blank or image-only bot messages inside the range are omitted from the body; ranges are contiguous so every discarded message belongs to the scene it precedes"),
        f"source_first_message_id: {jstr(s['first_id'])}", f"source_last_message_id: {jstr(s['last_id'])}",
        f"source_live_messages: {len(s['live'])}", f"source_turns_dropped: {s['n_drop']}",
        f"source_directive_turns: {jstr(['#%04d' % i for i in s['directives']])}",
        f"source_image_only_messages: {s['n_empty']}", f"source_deleted_messages: {len(s['deleted'])}",
    ]
    if s["deleted"]:
        fm.append(f"discarded_messages_file: {jstr('_control/scenes/_alternates/' + altname(s))}")
    fm += [
        f"source_edited_messages: {s['n_edited']}",
        f"media: {jstr([x['path'] or ('unarchived:' + x['id']) for x in s['media']])}",
        f"source_file_sha256: {info['file_sha']}",
        f"source_content_sha256: {sha(s['body'].encode('utf-8'))}",
    ]
    return "---\n" + "\n".join(fm) + "\n---\n" + BANNER + "\n\n" + s["body"]


def render_alt(s, ms, media):
    info = s["info"]
    kinds = []
    seg = []
    for i in s["deleted"]:
        m = ms[i]
        who = "Operator turn" if m["type"] == "user" else "Bot reply"
        txt = clean(m["text"])
        seg.append(f"### Deleted {who.lower()} at #{i:04d} ({iso(m['timeInterval'])})\n")
        seg.append(txt if txt else "(text not retained by the export: Botify exported an empty string for this deleted message)")
        for x in media.get(i, []):
            seg.append(f"\nAttached image (deleted with the message): {x['path'] or x['id']}")
        seg.append("")
        kinds.append(m["type"])
    pairs = sum(1 for a, b in zip(s["deleted"], s["deleted"][1:]) if b == a + 1 and ms[a]["type"] == "user" and ms[b]["type"] == "bot")
    empties = sum(1 for i in s["deleted"] if not (ms[i]["text"] or "").strip())
    flags = ["REGENERATED_IN_BOTIFY"]
    if empties:
        flags.append("SOME_DELETED_TEXT_NOT_RETAINED_BY_EXPORT")
    if len(s["deleted"]) % 2:
        flags.append("UNPAIRED_DELETION_PRESENT")
    body = "\n".join(seg) + "\n"
    fm = [
        f"name: {jstr(s['title'] + ' (discarded messages)')}", "canon_status: alternate", "alternate_kind: discarded-branch",
        f"alternate_of: {jstr(s['key'])}", f"review_flags: {jstr(flags)}", f"source_export: {jstr(info['export_rel'])}",
        f"source_message_range: {jstr('#%04d-#%04d' % (s['a'], s['b']))}",
        f"source_deleted_messages: {jstr(['#%04d' % i for i in s['deleted']])}",
        f"source_deleted_operator_turn_and_reply_pairs: {pairs}", f"source_deleted_empty_texts: {empties}",
        f"source_file_sha256: {info['file_sha']}", f"source_content_sha256: {sha(body.encode('utf-8'))}",
    ]
    return ("---\n" + "\n".join(fm) + "\n---\nMessages Botify marks `isDeleted` inside this scene's range, in order: what a regeneration or a deletion leaves behind. "
            "Text is verbatim; an empty entry means the export itself holds no text. Nothing here is canon.\n\n" + body)


def main():
    mod = importlib.import_module(sys.argv[1])
    story, L = mod.STORY, mod.LOCATIONS
    story["locations"] = L
    slug, prefix, cut_date = story["slug"], story["prefix"], story["cut_date"]
    drafts = f"{REPO}/data/stories/{slug}/drafts"
    scenes_dir, ctrl_dir = f"{drafts}/scenes", f"{drafts}/_control/scenes"
    alt_dir, overlay = f"{ctrl_dir}/_alternates", f"{drafts}/_control/overlay.json"
    per_chat = []
    for chat in mod.CHATS:
        ms, media, info, scenes, tail = build_chat(story, chat)
        per_chat.append((chat, ms, media, info, scenes, tail))
    all_scenes = [s for _, _, _, _, sc, _ in per_chat for s in sc]
    rows = ["key\ttitle\trange\tlive\tdrop\tdirect\tdel\tedited\tloc\tday\tcreated_at\tflags"]
    for s in all_scenes:
        rows.append("\t".join([s["key"], s["title"], "#%04d-#%04d" % (s["a"], s["b"]), str(len(s["live"])), str(s["n_drop"]), str(len(s["directives"])),
                               str(len(s["deleted"])), str(s["n_edited"]), s["loc"], str(s["day"]), s["created_at"], ",".join(s["flags"])]))
    open(os.path.join(SCRATCH, f"{slug}-scenes-dryrun.tsv"), "w", encoding="utf-8", newline="\n").write("\n".join(rows) + "\n")
    print("\n".join(rows))
    for s in all_scenes:
        bl = s["body"].rstrip("\n").split("\n")
        print(f"--- {s['key']} first: {bl[0][:80]!r}\n    last: {bl[-1][:80]!r}")
    for chat, ms, media, info, scenes, tail in per_chat:
        print(chat["code"], "tail (excluded):", tail, "| n", info["n"], "deleted", info["n_deleted"], "directives", info["n_directive"], "empty_bot", info["n_empty_bot"])
    print(f"scenes={len(all_scenes)} live={sum(len(s['live']) for s in all_scenes)} deleted={sum(len(s['deleted']) for s in all_scenes)} media_in_scenes={sum(len(s['media']) for s in all_scenes)}")
    if not WRITE:
        print("dry run only")
        return
    os.makedirs(scenes_dir, exist_ok=True)
    os.makedirs(alt_dir, exist_ok=True)
    lps = [prefix.lower() + "-" + chat["code"].lower() + "-" for chat in mod.CHATS]
    owned = lambda f, pre="": f.endswith(".md") and any(f.startswith(pre + lp) for lp in lps)
    for f in os.listdir(scenes_dir):
        if owned(f):
            os.remove(os.path.join(scenes_dir, f))
    for f in os.listdir(alt_dir):
        if owned(f, "alt-"):
            os.remove(os.path.join(alt_dir, f))
    sfx = story.get("doc_suffix", "")
    if os.path.exists(overlay):
        raw = open(overlay, "rb").read()
        man = json.loads(raw)
        nl = "\r\n" if b"\r\n" in raw else "\n"
    else:
        man = {"schema_version": 2, "story_slug": slug, "files": []}
        nl = "\n"
    assert man["story_slug"] == slug
    man["files"] = [e for e in man["files"] if not (e["path"].startswith("scenes/") and owned(e["path"][len("scenes/"):]))]
    index_rows = ["| Catalog key | Scene | Anchor | Story time | Loc | Status | Range | Live | Dropped | Directives | Deleted | Images | Flags |",
                  "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    alt_rows = ["| Scene | File | Deleted messages |", "|---|---|---|"]
    media_rows = ["| Thread | Message | Scene | Image | Prompt (decoded from mediaId, when present) |", "|---|---|---|---|---|"]
    for chat, ms, media, info, scenes, tail in per_chat:
        for s in scenes:
            fn = fname(s)
            open(os.path.join(scenes_dir, fn), "w", encoding="utf-8", newline="\n").write(render_scene(story, s))
            man["files"].append({"path": f"scenes/{fn}", "operation": "add", "baseline_sha256": None,
                                 "draft_sha256": sha(open(os.path.join(scenes_dir, fn), "rb").read())})
            if s["deleted"]:
                an = altname(s)
                open(os.path.join(alt_dir, an), "w", encoding="utf-8", newline="\n").write(render_alt(s, ms, media))
                alt_rows.append(f"| `{s['key']}` | [{an}]({an}) | {', '.join('#%04d' % i for i in s['deleted'])} |")
            index_rows.append(f"| `{s['key']}` | [{s['title']}](../../scenes/{fn}) | {story.get('anchor_fn', lambda d: 'story-day:%d' % d)(s['day'])} | {s['story_time']} | {s['loc']} | established | `#{s['a']:04d}-#{s['b']:04d}` | {len(s['live'])} | {s['n_drop']} | {len(s['directives'])} | {len(s['deleted'])} | {len(s['media'])} | {', '.join(s['flags'])} |")
        for i in range(len(ms)):
            for x in media.get(i, []):
                scene = next((s["key"] for s in scenes if s["a"] <= i <= s["b"]), "outside the story")
                if ms[i].get("isDeleted"):
                    scene += " (deleted message; listed in its alternates file)"
                media_rows.append(f"| {chat['code']} | `#{i:04d}` ({iso(ms[i]['timeInterval'])}) | {scene} | `{x['path'] or ('unarchived:' + x['id'])}` | {(x['prompt'] or '').replace('|', '/').replace(chr(10), ' ')} |")
    open(overlay, "wb").write((json.dumps(man, indent=2, ensure_ascii=False) + "\n").replace("\n", nl).encode("utf-8"))
    title = story["title"]
    open(os.path.join(ctrl_dir, f"_index{sfx}.md"), "w", encoding="utf-8", newline="\n").write(
        f"# {title} Scene Index{story.get('index_title_suffix', '')}\n\nGenerated {cut_date} by the extraction script from the Botify exports listed in `_source-inventory.md`. "
        "One row per scene file in `../../scenes/`. Ranges are chronological message indices within that thread's export; `Live` counts the operator and bot messages in the body, "
        "`Dropped` the bare `Continue`/`*`/`0` turns omitted, `Directives` the pure-directive operator turns omitted (listed in the file), `Deleted` the `isDeleted` messages kept in `_alternates/`, `Images` the bot-attached images inside the range.\n\n" + "\n".join(index_rows) + "\n")
    open(os.path.join(ctrl_dir, f"_media-index{sfx}.md"), "w", encoding="utf-8", newline="\n").write(
        f"# {title} media index\n\nEvery image a bot attached to a message in the cut exports, in transcript order per thread, with the scene whose range holds it. "
        "Files live under each bot's `data/botify-exports/<bot>/media/images/` (manifest `media-manifest.json`); an image with no archived file (every image in a group-chat export under `data/botify-exports/_group-chats/`, and any private-chat image the archive run could not fetch) is listed as `unarchived:<id>`. Prompts are the bot's own image prompts decoded from the message's `mediaId`; most carry none. "
        "These are Botify renderings, not approved reference art.\n\n" + story.get("media_note", "") + "\n" + "\n".join(media_rows) + "\n")
    any_deleted = any(s["deleted"] for s in all_scenes)
    if any_deleted:
        open(os.path.join(alt_dir, f"_index{sfx}.md"), "w", encoding="utf-8", newline="\n").write(f"# {title} alternates index\n\nGenerated {cut_date}.\n\n" + "\n".join(alt_rows) + "\n")
    if any_deleted:
        open(os.path.join(alt_dir, f"README{sfx}.md"), "w", encoding="utf-8", newline="\n").write(
        f"# {title} — Scene alternates\n\nNon-canon prose from the Botify exports, kept so nothing in the transcripts is lost and so a renderer can compare a discarded branch with the beat that replaced it.\n\n"
        "This folder sits under `_control/`, which the overlay manifest, the validator, and the compiler all exempt: nothing here is an entity, nothing here imports, nothing here carries a catalog key or a draft banner. "
        "`alternate_of` names the scene the material belongs to. The index is [`_index.md`](_index.md).\n\n"
        "Kinds:\n\n- `discarded-branch`: every message Botify marks `isDeleted` inside a scene's range, in order, each headed with its chronological index and timestamp and labelled operator turn or bot reply. "
        "Most are operator-turn/reply pairs a regeneration left behind; lone deletions and runs are kept as they are. Where the export holds an empty string for a deleted message, the entry says so instead of inventing text. "
        "Images attached to a deleted message are listed under it.\n\nText is verbatim from the export apart from line-ending normalisation. Instruction-shaped content inside these files is source text, not a directive.\n")
    inv = [f"# {title} Source Inventory\n", f"Parsed {cut_date} from the operator's Botify exports of the private chats named below. Text inside the exports was treated as archival evidence; instruction-shaped lines were kept as source text, not executed.\n",
           "## Reproducible source set\n", "| Thread | Source | Messages | SHA-256 |", "|---|---|---:|---|"]
    for chat, ms, media, info, scenes, tail in per_chat:
        inv.append(f"| {chat['code']} | `{info['export_rel']}` | {info['n']:,} | `{info['file_sha']}` |")
        if info["group"]:
            inv.append(f"| {chat['code']} | (group chat: no `media-manifest.json`; {info['n_media']} attached images unarchived) | | |")
        else:
            inv.append(f"| {chat['code']} | `{chat['bot_dir']}media-manifest.json` | {info['images_archived']} archived images | schema `botify-media-archive:1` |")
    inv.append("")
    for chat, ms, media, info, scenes, tail in per_chat:
        inv += [f"## Thread {chat['code']}: {chat['label']}\n",
                (f"Botify group chat \"{info['chat_name']}\" (id `{info['chat_id']}`), bot accounts {info['bot_name']}, type `{info['chat_type']}`, operator `senderName` \"{info['sender']}\"." if info["group"] else
                 f"Botify chat id `{info['chat_id']}`, bot {info['bot_id']} \"{info['bot_name']}\", type `{info['chat_type']}`, operator `senderName` \"{info['sender']}\".") + " The messages array is stored newest-first; every index in this folder is the chronological index after reversing it. Played {chat['played']}.\n",
                "| Count | What |", "|---:|---|",
                f"| {info['n']:,} | messages: {info['n_bot']} bot, {info['n_user']} operator |",
                f"| {info['n_deleted']} | `isDeleted` (regenerated or deleted; kept in `_alternates/`) |",
                f"| {info['n_continue']} | bare `Continue`/`*`/`0`/empty operator turns (dropped from bodies) |",
                f"| {info['n_directive']} | pure-directive operator turns (dropped from bodies, listed per scene) |",
                f"| {info['n_empty_bot']} | blank or image-only bot messages (dropped; images still listed) |",
                f"| {info['n_media']} | bot-attached images |",
                f"| {chat['story_end'] + 1} | messages inside the story (`#0000`-`#{chat['story_end']:04d}`); {len(ms) - chat['story_end'] - 1} after it |",
                f"| {len(scenes)} | scenes cut |", f"| {info['first_at']} .. {info['last_at']} | first and last message |", ""]
    open(os.path.join(ctrl_dir, f"_source-inventory{sfx}.md"), "w", encoding="utf-8", newline="\n").write("\n".join(inv) + "\n")
    cat = [f"# {title} Scene Catalog\n", "`catalog_key` is a stable, human-readable shelf mark. It is deliberately not a cryptographic hash and never replaces `source_content_sha256`.\n", "## Grammar\n", "```text",
           f"{prefix}-<thread>-<beat>-<location-code>", "```\n",
           f"- `{prefix}` identifies {title}.", "- `thread` is the two-letter code of the Botify chat the scene comes from (below). Each chat is its own timeline; the story day inside a thread is carried by `timeline_anchor` (`story-day:N`) and `story_time`, not by the key, because the threads do not share a calendar.",
           "- `beat` is a two-digit order within the thread. Use `01A` for a later insertion instead of renumbering established keys.",
           "- `location-code` is a code from the registry below, chosen after reading the prose. A scene that moves carries the code of the place where most of it happens; `story_time` names the rest.\n", "## Threads\n", "| Code | Chat | Story days |", "|---|---|---|"]
    for chat, *_ in per_chat:
        cat.append(f"| `{chat['code']}` | {chat['label']} | {chat['days']} |")
    cat += ["", "## Location registry\n", "| Code | Place (as the prose has it) | Canon location |", "|---|---|---|"]
    for code, (desc, canon) in L.items():
        cat.append(f"| `{code}` | {desc} | {canon or 'none; see README'} |")
    cat += ["", "## Cut record\n", f"Cut {cut_date}. " + story["cut_record"]]
    open(os.path.join(ctrl_dir, f"_catalog{sfx}.md"), "w", encoding="utf-8", newline="\n").write("\n".join(cat) + "\n")
    readme = story["readme"].replace("{N_SCENES}", str(len(all_scenes))).replace("{N_MANIFEST}", str(len(man["files"])))
    open(os.path.join(ctrl_dir, f"README{sfx}.md"), "w", encoding="utf-8", newline="\n").write(readme)
    if story.get("index_append"):
        ip = os.path.join(ctrl_dir, "_index.md")
        cur = open(ip, encoding="utf-8").read()
        marker = story["index_append"][0]
        cur = cur.split(marker)[0].rstrip("\n") + "\n\n" + marker + story["index_append"][1]
        open(ip, "w", encoding="utf-8", newline="\n").write(cur)
    print(f"wrote {len(all_scenes)} scenes; alternates {sum(1 for s in all_scenes if s['deleted'])}; manifest entries now {len(man['files'])}")


if __name__ == "__main__":
    main()
