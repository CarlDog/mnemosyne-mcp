# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
import json, os, hashlib
SH = os.path.join(REPO, "data", "archive", "chatgpt-shares")
OUT = r"D:\GitHub\mnemosyne-mcp\data\stories\chaos-saga\drafts\_control\source-documents"
SCR = os.path.join(REPO, "data", "workspace", "2026-09-02-scene-extraction")
os.makedirs(OUT, exist_ok=True)

def yq(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

def save(fn, title, sid, a, b, text, kind, note=""):
    sha = hashlib.sha256(text.encode()).hexdigest()
    fm = ["---", f"name: {yq(title)}", "record: source-document", f"document_kind: {kind}",
          f"source_export: {yq('data/archive/chatgpt-shares/' + sid + '.txt')}",
          f"source_share_url: {yq('https://chatgpt.com/share/' + sid)}", f"source_lines: \"{a}-{b}\"",
          f"source_content_sha256: {sha}"]
    if note:
        fm.append(f"note: {yq(note)}")
    fm += ["---", ""]
    open(os.path.join(OUT, fn), "w", encoding="utf-8", newline="\n").write("\n".join(fm) + text.rstrip("\n") + "\n")
    print("wrote", fn, a, b)

B = "6a97a769-cc38-83ea-bbba-7be7f1fba700"
F = "6a97a778-bfd0-83ea-a0af-83c77ee566cc"
d1 = json.load(open(os.path.join(SCR, "directives.json"), encoding="utf-8"))
d2 = json.load(open(os.path.join(SCR, "directives_fr.json"), encoding="utf-8"))
n = 0
for o in d1:
    n += 1
    save(f"canon-tracking-directive-v{n}.md", f"Canon Tracking Directive, version {n} (Boundary-Pushing chat)", B, o["start"], o["end"], o["text"],
         "canon-tracking-directive", "Defines the Timeline File and Story Beats Log formats; the worked examples are GhostHunters entries, and no Chaos Saga log content exists in any export")
for o in d2:
    n += 1
    save(f"canon-tracking-directive-v{n}.md", f"Canon Tracking Directive, version {n} (File Redundancies chat)", F, o["start"], o["end"], o["text"],
         "canon-tracking-directive", "Later revision adding modular file rollover (Timeline 2.txt); still no log content")

L = open(os.path.join(SH, F + ".txt"), encoding="utf-8").read().split("\n")

def block(i):
    j = i
    while j < len(L) and L[j].strip() not in ("You said:", "ChatGPT said:") and not L[j].strip().startswith("```"):
        j += 1
    return "\n".join(x.rstrip("\r") for x in L[i - 1:j]).rstrip("\n"), j

for i, fn, title, kind in (
    (1047, "primary-character-profiles-share-v1.md", "Primary Character Profiles, share version 1", "character-profiles"),
    (1251, "primary-character-profiles-share-v2.md", "Primary Character Profiles, share version 2", "character-profiles"),
    (1452, "secondary-character-profiles-share-v1.md", "Secondary Character Profiles, share version", "character-profiles"),
    (1765, "key-locations-share-v1.md", "Key Locations, share version 1", "key-locations"),
    (1951, "key-locations-share-v2.md", "Key Locations, share version 2", "key-locations"),
):
    t, j = block(i)
    save(fn, title, F, i, j, t, kind, "Earlier than the OneDrive copy and differs from it; see ../SOURCE_VALIDATION_2026-09-02.md")
