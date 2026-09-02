# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
"""Fetch the seven ChatGPT share links and export each as raw HTML plus a
rendered transcript in the same 'You said:/ChatGPT said:' shape as the
OneDrive raw archive. Nothing is interpreted; text is copied as served."""
import json, os, re, sys, urllib.request, hashlib

OUT = r"D:\GitHub\mnemosyne-mcp\data\stories\chaos-saga\exports\raw-chatgpt-shares"
LINKS = [
    "https://chatgpt.com/share/6a8fdec8-ae48-83ea-b0c1-07263b5ebc93",
    "https://chatgpt.com/share/6a8fdeb2-fc50-83ea-a47c-e10fa1e903a1",
    "https://chatgpt.com/share/6a8fdea1-d8b8-83e9-ab5b-3628aba85e91",
    "https://chatgpt.com/share/6a8fde8e-b1a8-83ea-8bdc-f6d16149654a",
    "https://chatgpt.com/share/6a8fde79-e314-83ea-bab0-33f21eb85fdc",
    "https://chatgpt.com/share/6a97a769-cc38-83ea-bbba-7be7f1fba700",
    "https://chatgpt.com/share/6a97a778-bfd0-83ea-a0af-83c77ee566cc",
]
os.makedirs(OUT, exist_ok=True)

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def find_conversation(html):
    """The share page streams a turbo-stream payload inside
    window.__reactRouterContext.streamController.enqueue("...") calls.
    Decode every enqueue string, join, and locate the JSON object that
    carries linear_conversation."""
    chunks = re.findall(r'enqueue\("((?:[^"\\]|\\.)*)"\)', html)
    if not chunks:
        return None, "no enqueue chunks"
    decoded = "".join(json.loads('"' + c + '"') for c in chunks)
    try:
        data = json.loads(decoded)
    except Exception:
        return None, "payload not json"
    # turbo-stream: list where objects reference other indices; resolve by walking
    def resolve(v, depth=0):
        if depth > 40:
            return v
        if isinstance(v, int) and 0 <= v < len(data) and not isinstance(data[v], int):
            return resolve(data[v], depth + 1)
        if isinstance(v, list):
            return [resolve(x, depth + 1) for x in v]
        if isinstance(v, dict):
            return {k: resolve(x, depth + 1) for k, x in v.items()}
        return v
    # find the dict that has a linear_conversation key
    for i, item in enumerate(data):
        if isinstance(item, dict) and any(k == "linear_conversation" or (isinstance(k, int) and data[k] == "linear_conversation") for k in item):
            return resolve(item), "ok"
    # fallback: resolve everything and search
    full = resolve(data)
    def walk(o):
        if isinstance(o, dict):
            if "linear_conversation" in o:
                return o
            for v in o.values():
                r = walk(v)
                if r: return r
        elif isinstance(o, list):
            for v in o:
                r = walk(v)
                if r: return r
    r = walk(full)
    return (r, "ok") if r else (None, "linear_conversation not found")

def render(conv):
    title = conv.get("title") or ""
    out = [f"# {title}", ""]
    for msg in conv.get("linear_conversation", []):
        m = msg.get("message") or msg
        author = ((m.get("author") or {}).get("role")) or ""
        content = m.get("content") or {}
        parts = content.get("parts") or []
        text = "\n".join(p if isinstance(p, str) else json.dumps(p, ensure_ascii=False) for p in parts).strip()
        if not text or author == "system":
            continue
        out.append("You said:" if author == "user" else "ChatGPT said:")
        out.append(text)
        out.append("")
    return "\n".join(out), title

index = []
for url in LINKS:
    sid = url.rsplit("/", 1)[1]
    html = fetch(url)
    hpath = os.path.join(OUT, f"{sid}.html")
    open(hpath, "wb").write(html)
    conv, status = find_conversation(html.decode("utf-8", "replace"))
    rec = {"share_id": sid, "url": url, "html_file": os.path.basename(hpath), "html_sha256": hashlib.sha256(html).hexdigest(), "html_bytes": len(html), "parse": status}
    if conv:
        txt, title = render(conv)
        tpath = os.path.join(OUT, f"{sid}.txt")
        open(tpath, "w", encoding="utf-8", newline="\n").write(txt)
        rec.update(title=title, txt_file=os.path.basename(tpath), txt_lines=txt.count("\n") + 1, messages=len(conv.get("linear_conversation", [])))
        jpath = os.path.join(OUT, f"{sid}.json")
        open(jpath, "w", encoding="utf-8", newline="\n").write(json.dumps(conv, ensure_ascii=False, indent=1))
        rec["json_file"] = os.path.basename(jpath)
    index.append(rec)
    print(rec)
open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="\n").write(json.dumps(index, ensure_ascii=False, indent=1))
