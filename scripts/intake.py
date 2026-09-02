"""Intake tool for data/archive/ — the one master of every original we receive.

The archive is owned by the operator and written only through this tool
(docs/DATA_ARCHITECTURE_PROPOSAL.md §4.1). Nothing here is an entity; nothing
here is read by story retrieval.

Commands (run from anywhere; paths are repo-relative):

  python scripts/intake.py index <family>
      Walk data/archive/<family>/ and append an index row for every file not
      yet indexed (sha256, bytes, received=null for retroactive rows,
      indexed=now). Idempotent: existing rows are kept, changed files get a
      new row with `supersedes`.

  python scripts/intake.py ingest <family> <src-file-or-dir> [--origin TEXT]
                                  [--stories a,b] [--dest REL] [--received ISO]
      Copy an original into data/archive/<family>/<dest or basename>/...,
      never overwriting: an existing file at the destination is moved to
      _history/<name>.<stamp>.<ext> first. Appends index rows.

  python scripts/intake.py verify <family>
      Re-hash every indexed file and report any mismatch or missing file.

  python scripts/intake.py snapshot <label> [tree ...]
      Write data/workspace/snapshots/<label>.sha (sha256 of every file under
      the given trees, default: every story's canon/, references/, art/ and
      data/archive/).

  python scripts/intake.py diff <label-a> <label-b>
      Print the paths whose hash differs between two snapshots.

Index rows (JSON Lines, append-only, one file per family:
data/archive/<family>/_index.jsonl):
  {"path", "sha256", "bytes", "received", "indexed", "origin", "stories",
   "role", "supersedes"}
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
ARCHIVE = os.path.join(REPO, "data", "archive")
WORKSPACE = os.path.join(REPO, "data", "workspace")
FAMILIES = ("botify", "chatgpt", "chatgpt-shares", "companion", "operator")


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def rel(p):
    return os.path.relpath(p, REPO).replace("\\", "/")


def family_root(family):
    if family not in FAMILIES:
        sys.exit(f"unknown family {family!r}; one of {FAMILIES}")
    return os.path.join(ARCHIVE, family)


def index_path(family):
    return os.path.join(family_root(family), "_index.jsonl")


def read_index(family):
    p = index_path(family)
    rows = []
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    rows.append(json.loads(line))
    return rows


def append_rows(family, rows):
    os.makedirs(family_root(family), exist_ok=True)
    with open(index_path(family), "a", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def walk_files(root):
    for r, dirs, fs in os.walk(root):
        dirs[:] = sorted(d for d in dirs)
        for f in sorted(fs):
            p = os.path.join(r, f)
            if os.path.basename(p) == "_index.jsonl":
                continue
            yield p


def latest_by_path(rows):
    latest = {}
    for r in rows:
        latest[r["path"]] = r
    return latest


def cmd_index(args):
    family = args.family
    root = family_root(family)
    if not os.path.isdir(root):
        sys.exit(f"no such family folder: {rel(root)}")
    latest = latest_by_path(read_index(family))
    new = []
    for p in walk_files(root):
        r = rel(p)
        h = sha_file(p)
        prev = latest.get(r)
        if prev and prev["sha256"] == h:
            continue
        new.append({"path": r, "sha256": h, "bytes": os.path.getsize(p), "received": None, "indexed": now(),
                    "origin": args.origin, "stories": args.stories.split(",") if args.stories else [],
                    "role": None, "supersedes": prev["sha256"] if prev else None})
    append_rows(family, new)
    print(f"{family}: {len(new)} rows appended ({len(latest)} already indexed)")


def cmd_verify(args):
    family = args.family
    latest = latest_by_path(read_index(family))
    bad = 0
    for r, row in latest.items():
        p = os.path.join(REPO, r)
        if not os.path.exists(p):
            print("MISSING", r); bad += 1; continue
        if sha_file(p) != row["sha256"]:
            print("MISMATCH", r); bad += 1
    unindexed = [rel(p) for p in walk_files(family_root(family)) if rel(p) not in latest]
    for u in unindexed:
        print("UNINDEXED", u)
    print(f"{family}: {len(latest)} indexed, {bad} bad, {len(unindexed)} unindexed")
    return 1 if bad or unindexed else 0


def place(family, src, dest_rel, origin, stories, received, rows):
    dst = os.path.join(family_root(family), dest_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst):
        if sha_file(dst) == sha_file(src):
            return  # identical original already archived
        hist = os.path.join(os.path.dirname(dst), "_history")
        os.makedirs(hist, exist_ok=True)
        base, ext = os.path.splitext(os.path.basename(dst))
        moved = os.path.join(hist, f"{base}.{stamp()}{ext}")
        shutil.move(dst, moved)
        rows.append({"path": rel(moved), "sha256": sha_file(moved), "bytes": os.path.getsize(moved), "received": None,
                     "indexed": now(), "origin": "previous version displaced by intake", "stories": stories, "role": "history", "supersedes": None})
    shutil.copyfile(src, dst)
    rows.append({"path": rel(dst), "sha256": sha_file(dst), "bytes": os.path.getsize(dst), "received": received,
                 "indexed": now(), "origin": origin, "stories": stories, "role": None, "supersedes": None})


def cmd_ingest(args):
    family = args.family
    stories = args.stories.split(",") if args.stories else []
    rows = []
    src = os.path.abspath(args.src)
    if os.path.isdir(src):
        base = args.dest or os.path.basename(src.rstrip("\\/"))
        for p in walk_files(src):
            place(family, p, os.path.join(base, os.path.relpath(p, src)), args.origin, stories, args.received, rows)
    else:
        place(family, src, args.dest or os.path.basename(src), args.origin, stories, args.received, rows)
    append_rows(family, rows)
    print(f"{family}: {len(rows)} rows appended from {args.src}")


def default_trees():
    trees = [os.path.join(REPO, "data", "archive")]
    stories = os.path.join(REPO, "data", "stories")
    for s in sorted(os.listdir(stories)):
        for sub in ("canon", "references", "art"):
            t = os.path.join(stories, s, sub)
            if os.path.isdir(t):
                trees.append(t)
    return trees


def cmd_snapshot(args):
    trees = [os.path.abspath(t) for t in args.trees] or default_trees()
    os.makedirs(os.path.join(WORKSPACE, "snapshots"), exist_ok=True)
    out = os.path.join(WORKSPACE, "snapshots", f"{args.label}.sha")
    n = 0
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        for t in trees:
            if not os.path.isdir(t):
                continue
            for p in walk_files(t):
                f.write(f"{sha_file(p)}  {rel(p)}\n"); n += 1
    print(f"snapshot {args.label}: {n} files -> {rel(out)}")


def load_snapshot(label):
    p = os.path.join(WORKSPACE, "snapshots", f"{label}.sha")
    d = {}
    for line in open(p, encoding="utf-8"):
        if line.strip():
            h, path = line.rstrip("\n").split("  ", 1)
            d[path] = h
    return d


def cmd_diff(args):
    a, b = load_snapshot(args.a), load_snapshot(args.b)
    changed = sorted(p for p in a if p in b and a[p] != b[p])
    removed = sorted(p for p in a if p not in b)
    added = sorted(p for p in b if p not in a)
    for p in changed: print("CHANGED", p)
    for p in removed: print("REMOVED", p)
    for p in added: print("ADDED", p)
    print(f"changed={len(changed)} removed={len(removed)} added={len(added)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("index"); p.add_argument("family"); p.add_argument("--origin", default=None); p.add_argument("--stories", default=None); p.set_defaults(fn=cmd_index)
    p = sub.add_parser("verify"); p.add_argument("family"); p.set_defaults(fn=cmd_verify)
    p = sub.add_parser("ingest"); p.add_argument("family"); p.add_argument("src"); p.add_argument("--origin", default=None); p.add_argument("--stories", default=None); p.add_argument("--dest", default=None); p.add_argument("--received", default=None); p.set_defaults(fn=cmd_ingest)
    p = sub.add_parser("snapshot"); p.add_argument("label"); p.add_argument("trees", nargs="*"); p.set_defaults(fn=cmd_snapshot)
    p = sub.add_parser("diff"); p.add_argument("a"); p.add_argument("b"); p.set_defaults(fn=cmd_diff)
    args = ap.parse_args()
    rc = args.fn(args)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
