# DO NOT RERUN: one-off repair record (2026-09-02); re-running is a no-op on repaired files but the
# history records it writes are dated to that day. See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8.
"""One-off provenance repair of retired editorial exports (exports/archive/),
2026-09-02, per docs/LIVING_CANON_STANDARD.md section 13 step 11:

- notes that never name the revision they belong to get the prefix
  "Revision N: " (N is the file's own editorial_revision.revision);
- a missing final_entity_count is set to the actual entities array length
  (the verifier's own definition of the field).
Nothing else in any file changes (key order and formatting are preserved by
a targeted textual edit, not a JSON re-dump). A revision number that is
absent is NOT invented; a file with no editorial_revision block at all is
left alone. Every edit is recorded in the story's history/.
"""
import glob
import json
import os
import re

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
records = {}
for p in sorted(glob.glob(os.path.join(REPO, "data/stories/*/exports/archive/*.json"))):
    p = p.replace("\\", "/")
    slug = p.split("/")[-4]
    raw = open(p, "rb").read()
    d = json.loads(raw)
    rev = d.get("editorial_revision")
    if not rev:
        records.setdefault(slug, []).append(f"- `{os.path.basename(p)}`: no `editorial_revision` block; left alone (its provenance is `history/2026-08-26-living-canon-pass.md`).")
        continue
    text = raw.decode("utf-8")
    edits = []
    n = rev.get("revision")
    num = n if isinstance(n, int) else (int(n) if isinstance(n, str) and n.isdigit() else None)
    notes = rev.get("notes")
    if num is not None and isinstance(notes, str) and not re.search(rf"\bRevision\s+{num}\b", notes, re.I):
        old = json.dumps(notes, ensure_ascii=False)
        new = json.dumps(f"Revision {num}: {notes}", ensure_ascii=False)
        # the notes string appears once as a JSON value under editorial_revision
        assert text.count(old) == 1, (p, "notes value not unique in file")
        text = text.replace(old, new)
        edits.append(f"notes prefixed with `Revision {num}: `")
    if rev.get("final_entity_count") in (None, "") and isinstance(d.get("entities"), list):
        count = len(d["entities"])
        # insert final_entity_count right after "revision" inside the block, matching the file's indentation
        m = re.search(r'("editorial_revision":\s*\{\s*\n)(\s*)', text)
        if m:
            text = text.replace(m.group(1), m.group(1) + f'{m.group(2)}"final_entity_count": {count},\n', 1)
        else:  # single-line block: insert right after the opening brace
            m = re.search(r'("editorial_revision":\s*\{)', text)
            assert m, (p, "cannot place final_entity_count")
            text = text.replace(m.group(1), m.group(1) + f'"final_entity_count": {count}, ', 1)
        edits.append(f"`final_entity_count` set to {count} (the entities array length)")
    if num is None:
        edits.append("`revision` number absent and NOT invented (the file predates numbered revisions); still fails the check when named explicitly")
    if edits:
        json.loads(text)  # must still parse
        if text != raw.decode("utf-8"):
            open(p, "wb").write(text.encode("utf-8"))
        records.setdefault(slug, []).append(f"- `{os.path.basename(p)}`: " + "; ".join(edits) + ".")
for slug, lines in records.items():
    h = os.path.join(REPO, "data/stories", slug, "history", "2026-09-02-export-provenance-repair.md")
    os.makedirs(os.path.dirname(h), exist_ok=True)
    open(h, "w", encoding="utf-8", newline="\n").write(
        "# Retired export provenance repair (2026-09-02)\n\nOn operator instruction the retired editorial exports under `exports/archive/` were repaired so `scripts/verify-provenance.mjs` reads them as intended (`docs/LIVING_CANON_STANDARD.md` section 13, step 11): notes that never named their own revision now open with `Revision N: `, and a missing `final_entity_count` was set to the actual entities array length. No other byte in any file changed; nothing was invented (an absent revision number stays absent). The server-written backups in `exports/` carry no editorial block by design and are skipped by the verifier's default run since the same day.\n\n" + "\n".join(lines) + "\n")
    print(slug, len(lines), "records")
print("done")
