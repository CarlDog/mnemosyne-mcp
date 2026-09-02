# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
"""Decode saved ChatGPT share HTML (turbo-stream payload) into a rendered
transcript and a JSON conversation dump. Text is copied as served."""
import re, json, os, hashlib

OUT = os.path.join(REPO, "data", "archive", "chatgpt-shares")
PAT = re.compile(r'enqueue\("((?:[^"\\]|\\.)*)"\)')
NEG = {-5: None, -7: None, -1: None, -2: None, -3: None, -4: None, -6: None}

def decode(html):
    chunks = PAT.findall(html)
    dec = "".join(json.loads('"' + c + '"') for c in chunks)
    first = dec.split("\n", 1)[0]
    data = json.loads(first)
    memo = {}
    def res(i, depth=0):
        if depth > 60:
            return None
        if i in memo:
            return memo[i]
        if isinstance(i, int) and i < 0:
            return NEG.get(i)
        v = data[i]
        if isinstance(v, dict):
            out = {}
            memo[i] = out
            for k, vv in v.items():
                key = data[int(k[1:])] if k.startswith("_") else k
                out[key] = res(vv, depth + 1) if isinstance(vv, int) else vv
            return out
        if isinstance(v, list):
            out = []
            memo[i] = out
            for x in v:
                out.append(res(x, depth + 1) if isinstance(x, int) else x)
            return out
        return v
    root = res(0)
    def walk(o, depth=0):
        if depth > 40:
            return None
        if isinstance(o, dict):
            if "linear_conversation" in o:
                return o
            for v in o.values():
                r = walk(v, depth + 1)
                if r:
                    return r
        elif isinstance(o, list):
            for v in o:
                r = walk(v, depth + 1)
                if r:
                    return r
        return None
    return walk(root)

def render(conv):
    title = conv.get("title") or ""
    out = [f"# {title}", ""]
    n = 0
    for node in conv.get("linear_conversation") or []:
        m = (node or {}).get("message") or {}
        role = ((m.get("author") or {}).get("role")) or ""
        content = m.get("content") or {}
        parts = content.get("parts") or []
        text = "\n".join(p if isinstance(p, str) else json.dumps(p, ensure_ascii=False) for p in parts if p).strip()
        if not text or role == "system":
            continue
        out.append("You said:" if role == "user" else "ChatGPT said:")
        out.append(text)
        out.append("")
        n += 1
    return "\n".join(out), title, n

index = []
for fn in sorted(os.listdir(OUT)):
    if not fn.endswith(".html"):
        continue
    sid = fn[:-5]
    html_b = open(os.path.join(OUT, fn), "rb").read()
    conv = decode(html_b.decode("utf-8", "replace"))
    rec = {"share_id": sid, "url": f"https://chatgpt.com/share/{sid}", "html_file": fn, "html_sha256": hashlib.sha256(html_b).hexdigest(), "html_bytes": len(html_b)}
    if conv:
        txt, title, n = render(conv)
        open(os.path.join(OUT, sid + ".txt"), "w", encoding="utf-8", newline="\n").write(txt)
        open(os.path.join(OUT, sid + ".json"), "w", encoding="utf-8", newline="\n").write(json.dumps(conv, ensure_ascii=False, indent=1))
        rec.update(title=title, messages=n, txt_file=sid + ".txt", txt_sha256=hashlib.sha256(txt.encode("utf-8")).hexdigest(), txt_lines=txt.count("\n") + 1, json_file=sid + ".json")
    else:
        rec["parse"] = "linear_conversation not found"
    index.append(rec)
    print({k: rec[k] for k in rec if k in ("share_id", "title", "messages", "txt_lines", "parse")})
open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="\n").write(json.dumps(index, ensure_ascii=False, indent=1))
