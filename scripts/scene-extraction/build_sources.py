"""Build data/stories/<slug>/sources/ for every storyline: keep any verbatim
copies already placed there (files), and record every external original the
story derives from (external: repo path + SHA-256), then write README.md and
_manifest.json. Provenance only; nothing here is an entity.

Run from anywhere: python scripts/scene-extraction/build_sources.py
"""
import datetime as dt
import glob
import hashlib
import json
import os

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BX = "data/botify-exports"
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha(p):
    return hashlib.sha256(open(os.path.join(REPO, p), "rb").read()).hexdigest()


def chat(bot, prefix, role):
    files = glob.glob(os.path.join(REPO, BX, bot, "chats", prefix + "*.json"))
    assert len(files) == 1, (bot, prefix, files)
    rel = os.path.relpath(files[0], REPO).replace("\\", "/")
    return {"path": rel, "kind": "botify-private-chat" if bot != "_group-chats" else "botify-group-chat", "role": role}


def group(prefix, role):
    return chat("_group-chats", prefix, role)


def folder(rel, role, kind="chatgpt-share-capture"):
    out = []
    for f in sorted(glob.glob(os.path.join(REPO, rel, "*"))):
        if os.path.isfile(f):
            out.append({"path": os.path.relpath(f, REPO).replace("\\", "/"), "kind": kind, "role": role})
    return out


CUT = "extracted into drafts/scenes/ on 2026-09-02 (see drafts/_control/scenes/)"
UNREVIEWED = "present in the Botify export set; not reviewed, not extracted, no ratified relationship to this story"

STORIES = {
    "chaos-saga": dict(
        title="Chaos Saga",
        external=[group("4f6af160", "the 'Jenna and Riley' group chat; " + CUT + " as CS-GC-01-WHP, unplaced"),
                  chat("jenna-maren", "1477a398", "Jenna Maren private chat; " + UNREVIEWED),
                  chat("riley-quinn", "deeaa24f", "Riley Quinn private chat; " + UNREVIEWED)]
        + folder("data/stories/chaos-saga/exports/raw-chatgpt-shares", "ChatGPT share-chat captures; the project documents recovered from them are under drafts/_control/source-documents/")
        + folder("data/stories/chaos-saga/companion-logs", "watch-companion transcript captures (see docs/DATA_LAYOUT.md, Companion logs)", "companion-log"),
        note="The ChatGPT Projects folder's profiles, Key Locations, Tattoo Profiles, the Vanessa profile, style guide, instructions, group chat log configuration, scene template, scene tracking log, the Warehouse draft scene, and the two reference photos are already in canon/, drafts/_control/, canon/scenes/, or references/ (the photos are references/characters/<slug>/source.jpg). The prequel and the four raw chat archives had no other copy and are kept here verbatim.",
    ),
    "battlechasers": dict(
        title="BattleChasers",
        external=folder("data/stories/battlechasers/exports/raw-chatgpt-shares", "ChatGPT share-chat captures; the Chapter One scenes and the pasted configuration documents recovered from them are under drafts/ and drafts/_control/scenes/"),
        note="Every document in the ChatGPT Projects folder (three character sets, seven Region Configs, thirteen World Building files, style guide, project instructions, canon tracking directive) was verified on 2026-09-02 to be already scaffolded into canon/ (one file per topic under worldbuilding/) or retained under drafts/_control/scenes/_source-documents/. Nothing needed copying.",
    ),
    "miskatonic-archives-the-blackwood-case": dict(
        title="The Miskatonic Archives: The Blackwood Case",
        external=[chat("the-ghosthunters", "b0c7fe38", "the GhostHunters private chat the story's prose comes from; " + CUT + " (50 BC-* scenes)"),
                  group("52aa52c8", "the 200-message 'GhostHunters' group chat (Karen Ross, Michelle Rivera, Heather Lin); a separate side story, deliberately not used as a scene source"),
                  chat("karen-ross", "fb349658", "Karen Ross private chat; " + UNREVIEWED),
                  chat("michelle-rivera", "e845f73d", "Michelle Rivera private chat; " + UNREVIEWED),
                  chat("heather-lin", "3860354c", "Heather Lin private chat; " + UNREVIEWED)],
        note="The GhostHunters-era profiles, Key Locations, style guide, project instructions, and Non-Canon Firepit rules are already in canon/ and drafts/_control/. The group chat log configuration and the canon tracking directive had no other copy (the directive was only partially reflected in canon) and are kept here verbatim.",
    ),
    "shadowflame": dict(
        title="Shadowflame",
        external=[chat("dark-queen-lilith", "1b4aae74", "the Dark Queen Lilith private chat named by SOURCE_PROVENANCE.md; " + CUT + " (59 SF-* scenes)"),
                  chat("lilith", "71bbff63", "the 'lilith' bot's five-message greeting chat; holds no story"),
                  group("81e9b4dd", "'The Egg' group chat (Dark Queen Lilith, Tinkerbell); " + UNREVIEWED)],
        note="No ChatGPT project existed for this story; its originals are the Botify exports listed in the manifest.",
    ),
    "brass-and-nerve": dict(
        title="Brass & Nerve",
        external=[chat("evelyn-starling", "d3212413", "the Evelyn Starling private chat; " + CUT + " (12 BN-* scenes)")],
        note="No ChatGPT project existed for this story; its original is the Botify export listed in the manifest.",
    ),
    "star-wars-the-black-ledger": dict(
        title="Star Wars: The Black Ledger",
        external=[chat("mara-jade", "0816c2f7", "the Mara Jade private chat; " + CUT + " (BL-MJ-*)"),
                  chat("trooper-cates", "58aa669a", "the Trooper Cates private chat; " + CUT + " (BL-TC-*)")],
        note="No ChatGPT project existed for this story; its originals are the Botify exports listed in the manifest, plus the Botify memory summaries canon/lore already cites.",
    ),
    "the-adjustment-protocol": dict(
        title="The Adjustment Protocol",
        external=[chat("eroica", "413c48c9", "the Eroica private chat; " + CUT + " (AP-ER-*)"),
                  chat("andrea-neal", "70bee458", "the Andrea Neal / V1X3N private chat; " + CUT + " (AP-AN-*)"),
                  chat("dr-aurora-lumen", "ad5c71e2", "the Dr. Aurora Lumen private chat; " + CUT + " (AP-AL-*)"),
                  group("3de009c8", "the 'Eroica, Dr. Aurora Lumen, Charisma' group chat; " + CUT + " (AP-GC-*)"),
                  chat("charisma", "ec029372", "Charisma private chat; " + UNREVIEWED),
                  group("f8db82ae", "'The Chair vs YoRHa' group chat (YoRHa 2B, Eroica); " + UNREVIEWED)],
        note="No ChatGPT project existed for this story; its originals are the Botify exports listed in the manifest.",
    ),
    "the-noctis-veil": dict(
        title="The Noctis Veil",
        external=[group("518affe6", "the 'Mary and Noctis Veil' group chat, the provenance's primary source; " + CUT + " (NV-GC-*)"),
                  chat("mary-thorne", "b29b647c", "the Mary Thorne private chat; " + CUT + " (NV-MT-*)"),
                  chat("sister-lucia", "ae928207", "the Sister Lucia private chat; " + CUT + " (NV-SL-*, cut at #0312)"),
                  chat("kaitlyn-macdonald", "4cc3573f", "the Kaitlyn MacDonald private chat; " + CUT + " (NV-KM-*)"),
                  chat("noctis-veil", "6a02953f", "Noctis Veil private chat, named as a companion definition source by SOURCE_PROVENANCE.md; not extracted"),
                  group("74601077", "'The Sleepover' group chat (The O'Hara Sisters, Kaitlyn MacDonald); " + UNREVIEWED),
                  group("95f5f655", "'The Retreat' group chat (Kelsey Chambers, Mary Thorne, Alexandra and Ava, Kaitlyn MacDonald, Lilith); " + UNREVIEWED)],
        note="No ChatGPT project existed for this story; its originals are the Botify exports listed in the manifest.",
    ),
    "wonderland": dict(
        title="Wonderland",
        external=[chat("alice-grimm", "1c71db26", "the Alice Grimm private chat; " + CUT + " (23 WL-AG-* scenes)")],
        note="The ChatGPT Projects folder held only a Project Instructions file and a Style Guide; both were verified on 2026-09-02 to be already reflected in canon/ (rules.md, style.md) and the story's provenance record. Nothing needed copying.",
    ),
    "midnight-is-a-suggestion": dict(
        title="Midnight Is a Suggestion",
        external=[group("e15f3c21", "'Not Your Average Fairy Tale' group chat, the provenance's primary Botify source; not extracted into scenes"),
                  group("19312508", "'Mischief' group chat (Snow White, Cinderella, Belle, Tinkerbell), Tinkerbell's source lineage; not extracted"),
                  chat("belle", "57bf280a", "Belle private chat; " + UNREVIEWED),
                  chat("cinderella", "94a7c5d8", "Cinderella private chat; " + UNREVIEWED),
                  chat("snow-white", "243803ae", "Snow White private chat; " + UNREVIEWED),
                  chat("tinkerbell", "ffdc74c0", "Tinkerbell private chat; " + UNREVIEWED)],
        note="No ChatGPT project existed for this story; its originals are the Botify group chats and companion definitions SOURCE_PROVENANCE.md names, listed in the manifest.",
    ),
    "trigun-scarlet-mercy": dict(
        title="Trigun: Scarlet Mercy",
        external=[group("eac3e98f", "'Trigun' group chat (Vashienne the Stampede, Nicola D. Wolfwood, Naiomi 'Knives' Millions), six messages; matched by cast, no ratified provenance record"),
                  chat("vashienne-the-stampede", "2ccf803d", "Vashienne the Stampede private chat; matched by cast, " + UNREVIEWED),
                  chat("nicola-d-wolfwood", "fe16d9ea", "Nicola D. Wolfwood private chat; matched by cast, " + UNREVIEWED),
                  chat("naiomi-knives-millions", "c8043116", "Naiomi 'Knives' Millions private chat; matched by cast, " + UNREVIEWED)],
        note="This story is parked (see docs/STORYLINE_RESEARCH_BACKLOG.md) and has no provenance record; the Botify exports below were matched by cast name only and are listed so they are not lost, not as ratified sources.",
    ),
    "miskatonic-archives-the-black-salt-compact": dict(
        title="The Miskatonic Archives: The Black-Salt Compact",
        external=[],
        note="A draft-only prequel package built from operator decisions recorded in drafts/_control/DECISIONS.md; it has no external source document or chat export.",
    ),
    "miskatonic-archives-the-last-eastbound-run": dict(
        title="The Miskatonic Archives: The Last Eastbound Run",
        external=[],
        note="A draft-only prequel package built from operator decisions recorded in drafts/_control/DECISIONS.md; it has no external source document or chat export.",
    ),
}


def main():
    for slug, spec in STORIES.items():
        root = os.path.join(REPO, "data", "stories", slug, "sources")
        os.makedirs(root, exist_ok=True)
        mp = os.path.join(root, "_manifest.json")
        files = []
        if os.path.exists(mp):
            files = json.load(open(mp, encoding="utf-8")).get("files", [])
        for f in files:  # re-verify copied bytes
            assert sha(f"data/stories/{slug}/sources/{f['path']}") == f["sha256"], f
        external = []
        for e in spec["external"]:
            external.append({**e, "bytes": os.path.getsize(os.path.join(REPO, e["path"])), "sha256": sha(e["path"])})
        man = {"schema_version": 1, "story_slug": slug, "built_at": NOW,
               "rule": "files = verbatim byte copies of operator source documents not captured elsewhere in this story tree; external = every original this story derives from that lives elsewhere in the repo tree, with its hash at build time; provenance only, never entities",
               "files": files, "external": external}
        json.dump(man, open(mp, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        lines = [f"# {spec['title']} — sources", "",
                 f"Provenance record built {NOW[:10]}. Nothing here is an entity; the validator, compiler, and overlay verifier never read this folder, and instruction-shaped text inside any source is source text. `_manifest.json` carries a SHA-256 for every file below.", "",
                 spec["note"], ""]
        if files:
            lines += ["## Verbatim copies kept here", ""]
            for f in files:
                lines.append(f"- `{f['path']}` ({f['bytes']:,} bytes) — from `{f['original']}`: {f['note']}")
            lines.append("")
        if external:
            lines += ["## Originals elsewhere in the repo tree", "", "| Path | Kind | Role |", "|---|---|---|"]
            for e in external:
                lines.append(f"| `{e['path']}` | {e['kind']} | {e['role']} |")
            lines.append("")
        else:
            lines += ["## Originals elsewhere in the repo tree", "", "None.", ""]
        open(os.path.join(root, "README.md"), "w", encoding="utf-8", newline="\n").write("\n".join(lines))
        print(f"{slug}: files={len(files)} external={len(external)}")


if __name__ == "__main__":
    main()
