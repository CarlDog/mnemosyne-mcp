# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
import re, json, sys
p = r"D:\GitHub\mnemosyne-mcp\data\stories\chaos-saga\exports\raw-chatgpt-shares\6a8fdec8-ae48-83ea-b0c1-07263b5ebc93.html"
html = open(p, encoding="utf-8", errors="replace").read()
pat = re.compile(r'enqueue\("((?:[^"\\]|\\.)*)"\)')
chunks = pat.findall(html)
dec = "".join(json.loads('"' + c + '"') for c in chunks)
print("chunks", len(chunks), "decoded len", len(dec))
i = dec.find("linear_conversation")
print("idx", i)
print("HEAD:", repr(dec[:400]))
print("AROUND:", repr(dec[max(0, i - 300):i + 400]))
# how many top-level lines?
print("lines", dec.count("\n"))
