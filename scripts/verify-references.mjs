#!/usr/bin/env node
// Verify every story's visual assets against their sidecars and the hash
// cross-links introduced by docs/DATA_ARCHITECTURE_PROPOSAL.md 4.6.
//
// Usage:
//   node scripts/verify-references.mjs [<story-slug> ...]
//
// For every image under references/ and art/: a JSON sidecar with the same
// basename must exist. For every sidecar carrying image_sha256: if the image
// is present its hash must match; if it is absent the sidecar must say why
// (promoted: true, deduplicated_into, or same_bytes_as_sha256). Hash links must
// resolve: promoted_to_sha256 must name bytes that exist under references/,
// deduplicated_into and same_bytes_as must name existing files with that hash.
// Exit code 1 on any failure. Reads only; writes nothing.
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const STORIES = path.join(REPO_ROOT, "data", "stories");
const IMG = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function sha256(p) {
  return createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
}

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

async function verifyStory(slug) {
  const root = path.join(STORIES, slug);
  const failures = [];
  const files = [
    ...(await walk(path.join(root, "references"))),
    ...(await walk(path.join(root, "art"))),
  ];
  const images = files.filter((f) => IMG.has(path.extname(f).toLowerCase()));
  const sidecars = files.filter(
    (f) => path.extname(f).toLowerCase() === ".json",
  );
  const refHashes = new Map();
  for (const img of images) {
    if (rel(img).includes("/references/"))
      refHashes.set(await sha256(img), img);
  }
  let checkedLinks = 0;
  for (const img of images) {
    const sc = img.replace(/\.[^.]+$/, ".json");
    try {
      await stat(sc);
    } catch {
      failures.push(`${rel(img)}: no sidecar`);
    }
  }
  for (const sc of sidecars) {
    let d;
    try {
      d = JSON.parse(await readFile(sc, "utf8"));
    } catch (error) {
      failures.push(`${rel(sc)}: unreadable sidecar (${error.message})`);
      continue;
    }
    const base = sc.replace(/\.json$/, "");
    const img = images.find((i) => i.replace(/\.[^.]+$/, "") === base);
    if (d.image_sha256) {
      if (img) {
        if ((await sha256(img)) !== d.image_sha256)
          failures.push(`${rel(sc)}: image_sha256 does not match ${rel(img)}`);
      } else if (!(
        d.promoted === true ||
        d.deduplicated_into ||
        d.same_bytes_as_sha256
      )) {
        failures.push(`${rel(sc)}: image absent and sidecar does not say why`);
      }
    }
    if (d.promoted_to_sha256) {
      checkedLinks += 1;
      if (!refHashes.has(d.promoted_to_sha256))
        failures.push(
          `${rel(sc)}: promoted_to_sha256 names bytes not present under references/`,
        );
    }
    if (
      d.promoted_from_sha256 &&
      img &&
      (await sha256(img)) !== d.promoted_from_sha256
    ) {
      failures.push(
        `${rel(sc)}: promoted_from_sha256 does not match the reference image`,
      );
    }
    for (const key of ["deduplicated_into"]) {
      if (d[key]) {
        checkedLinks += 1;
        const target = path.join(REPO_ROOT, d[key]);
        try {
          if ((await sha256(target)) !== d.image_sha256)
            failures.push(`${rel(sc)}: ${key} target hash differs`);
        } catch {
          failures.push(`${rel(sc)}: ${key} target missing (${d[key]})`);
        }
      }
    }
    if (Array.isArray(d.same_bytes_as)) {
      for (const other of d.same_bytes_as) {
        checkedLinks += 1;
        try {
          if ((await sha256(path.join(REPO_ROOT, other))) !== d.image_sha256)
            failures.push(`${rel(sc)}: same_bytes_as ${other} hash differs`);
        } catch {
          failures.push(`${rel(sc)}: same_bytes_as target missing (${other})`);
        }
      }
    }
  }
  return {
    images: images.length,
    sidecars: sidecars.length,
    checkedLinks,
    failures,
  };
}

const args = process.argv.slice(2);
const slugs = args.length
  ? args
  : (await readdir(STORIES, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
let bad = 0;
for (const slug of slugs) {
  const r = await verifyStory(slug);
  if (r.images === 0 && r.sidecars === 0) continue;
  const status = r.failures.length ? "FAIL" : "OK";
  if (r.failures.length) bad += 1;
  console.log(
    `${status}  ${slug}: ${r.images} images, ${r.sidecars} sidecars, ${r.checkedLinks} hash links`,
  );
  for (const f of r.failures) console.log(`      - ${f}`);
}
process.exitCode = bad ? 1 : 0;
