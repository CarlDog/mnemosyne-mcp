# DO NOT RERUN: one-off migration record (phase 4, 2026-09-02). Re-running finds no matches now; kept so the
# sidecar fields it wrote (image_sha256, promoted*, deduplicated_into, same_bytes_as) have a documented producer.
"""Phase 4 of docs/DATA_ARCHITECTURE_PROPOSAL.md: one image, one place.

- Every art/ candidate whose bytes already live under references/ (current or
  superseded) is the approved copy: the art image is staged aside and removed,
  the art sidecar becomes the ledger entry (promoted, hash-linked), and the
  reference sidecar records where it came from.
- Every references/<entity>/candidates/... image identical to that entity's
  current plate is staged aside and removed; its sidecar stays and is
  hash-linked to the surviving file.
- The one cross-entity share (Blackwood `reaper`) is declared on both
  sidecars and kept as two files.
Staged copies live in data/workspace/<date>-art-dedup/ until
scripts/verify-references.mjs passes for every story.
"""
import collections
import glob
import hashlib
import json
import os
import shutil

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
STAGE = os.path.join(REPO, "data", "workspace", "2026-09-02-art-dedup")
IMG = (".png", ".jpg", ".jpeg", ".webp")
TAG = "phase 4 visual dedup 2026-09-02 (docs/DATA_ARCHITECTURE_PROPOSAL.md 4.6)"


def h(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def rel(p):
    return os.path.relpath(p, REPO).replace("\\", "/")


def sidecar(p):
    return os.path.splitext(p)[0] + ".json"


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, d):
    raw = open(p, "rb").read()
    nl = "\r\n" if b"\r\n" in raw else "\n"
    open(p, "wb").write((json.dumps(d, indent=2, ensure_ascii=False) + "\n").replace("\n", nl).encode("utf-8"))


def stage(p):
    dst = os.path.join(STAGE, rel(p))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(p, dst)
    return dst


def main():
    ref = collections.defaultdict(list)
    art = {}
    for p in glob.glob(os.path.join(REPO, "data/stories/*/references/**/*"), recursive=True):
        if os.path.isfile(p) and p.lower().endswith(IMG):
            ref[h(p)].append(p)
    for p in glob.glob(os.path.join(REPO, "data/stories/*/art/**/*"), recursive=True):
        if os.path.isfile(p) and p.lower().endswith(IMG):
            art[p] = h(p)
    staged_bytes = 0
    n_art = n_cand = 0
    # 1. art copies of approved images
    for ap, hh in sorted(art.items()):
        if hh not in ref:
            continue
        sc = sidecar(ap)
        d = load(sc)
        d.update({"image_sha256": hh, "promoted": True, "promoted_to_sha256": hh,
                  "promoted_to_paths_at_promotion": [rel(r) for r in ref[hh]],
                  "image_removed_by": TAG, "image_staged_at": rel(os.path.join(STAGE, rel(ap)))})
        save(sc, d)
        for r in ref[hh]:
            rs = sidecar(r)
            rd = load(rs)
            rd.update({"image_sha256": hh, "promoted_from_art_sidecar": rel(sc), "promoted_from_sha256": hh})
            save(rs, rd)
        staged_bytes += os.path.getsize(ap)
        stage(ap)
        n_art += 1
    # 2. candidate copies inside references identical to the entity's current plate
    for hh, paths in ref.items():
        if len(paths) < 2:
            continue
        ents = {"/".join(rel(p).split("/")[2:6]) for p in paths}
        cur = [p for p in paths if "/candidates/" not in rel(p) and "/superseded/" not in rel(p) and "/rejected/" not in rel(p)]
        if len(ents) > 1:
            for p in paths:  # cross-entity share: declare, keep
                sc = sidecar(p)
                d = load(sc)
                d.update({"image_sha256": hh, "same_bytes_as": [rel(q) for q in paths if q != p]})
                save(sc, d)
            print("declared cross-entity share:", [rel(p) for p in paths])
            continue
        if len(cur) != 1:
            print("SKIP (no single current plate):", [rel(p) for p in paths])
            continue
        keep = cur[0]
        kd = load(sidecar(keep))
        kd.setdefault("image_sha256", hh)
        save(sidecar(keep), kd)
        for p in paths:
            if p == keep:
                continue
            sc = sidecar(p)
            d = load(sc)
            d.update({"image_sha256": hh, "deduplicated_into": rel(keep), "same_bytes_as_sha256": hh,
                      "image_removed_by": TAG, "image_staged_at": rel(os.path.join(STAGE, rel(p)))})
            save(sc, d)
            staged_bytes += os.path.getsize(p)
            stage(p)
            n_cand += 1
    print(f"art copies staged and removed: {n_art}; candidate copies staged and removed: {n_cand}; staged MB: {staged_bytes / 1e6:.1f}")


if __name__ == "__main__":
    main()
