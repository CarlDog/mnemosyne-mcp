"""Move recovered scene files from canon/scenes/ into drafts/scenes/ as overlay
add operations, and their documentation into drafts/_control/scenes/.

Usage: python move_scenes_to_drafts.py <slug> [--apply]
"""
import hashlib
import json
import os
import re
import shutil
import sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")).replace("\\", "/")
BANNER = "> **DRAFT — NOT ACTIVE CANON**"
slug = sys.argv[1]
APPLY = "--apply" in sys.argv
story = f"{REPO}/data/stories/{slug}"
canon_scenes = f"{story}/canon/scenes"
drafts = f"{story}/drafts"
draft_scenes = f"{drafts}/scenes"
ctrl_scenes = f"{drafts}/_control/scenes"
manifest_path = f"{drafts}/_control/overlay.json"

# Which scene files stay in canon (export-established prose).
KEEP = {"chaos-saga": {"cs-033-01-whp--do-i-smell-trouble.md", "cs-033-02-whp--home-ground.md",
                       "cs-033-03-hlr--the-calm-after-claiming.md", "README.md", "_catalog.md",
                       "_template.md", "_source-inventory.md", "_recovery-source-manifest.tsv"},
        "miskatonic-archives-the-blackwood-case": set()}[slug]

entries = sorted(os.listdir(canon_scenes))
scene_files = [f for f in entries if f.endswith(".md") and not f.startswith("_") and f not in KEEP and f != "README.md"]
doc_entries = [f for f in entries if f not in KEEP and f not in scene_files]
print(f"{slug}: {len(scene_files)} scene files to drafts/scenes; docs to _control/scenes: {doc_entries}")


def with_banner(text):
    assert text.startswith("---\n"), "no frontmatter"
    end = text.index("\n---\n", 4) + len("\n---\n")
    head, body = text[:end], text[end:]
    assert not body.startswith(BANNER)
    return head + BANNER + "\n\n" + body


if not APPLY:
    print("dry run; pass --apply")
    sys.exit(0)

os.makedirs(draft_scenes, exist_ok=True)
os.makedirs(ctrl_scenes, exist_ok=True)
raw = open(manifest_path, "rb").read()
d = json.loads(raw)
existing = {e["path"] for e in d["files"]}
added = 0
for f in scene_files:
    src = os.path.join(canon_scenes, f)
    text = open(src, encoding="utf-8").read()
    text = text.replace('discarded_branches_file: "_alternates/', 'discarded_branches_file: "_control/scenes/_alternates/')
    text = with_banner(text)
    dst = os.path.join(draft_scenes, f)
    open(dst, "w", encoding="utf-8", newline="\n").write(text)
    os.remove(src)
    rel = f"scenes/{f}"
    h = hashlib.sha256(open(dst, "rb").read()).hexdigest()
    if rel in existing:
        for e in d["files"]:
            if e["path"] == rel:
                e["draft_sha256"] = h
    else:
        d["files"].append({"path": rel, "operation": "add", "baseline_sha256": None, "draft_sha256": h})
        added += 1
for f in doc_entries:
    src = os.path.join(canon_scenes, f)
    dst = os.path.join(ctrl_scenes, f)
    if os.path.exists(dst):
        shutil.rmtree(dst) if os.path.isdir(dst) else os.remove(dst)
    shutil.move(src, dst)
if not os.listdir(canon_scenes):
    os.rmdir(canon_scenes)
nl = "\r\n" if b"\r\n" in raw else "\n"
open(manifest_path, "wb").write((json.dumps(d, indent=2, ensure_ascii=False) + "\n").replace("\n", nl).encode("utf-8"))
print(f"manifest: {added} add entries appended; total {len(d['files'])}")
