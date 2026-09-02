# DO NOT RERUN: historical record of how files under data/stories/*/{canon,drafts} were produced.
# Several of these write into canon/scenes/; re-running would put draft prose back into canon.
# See docs/DATA_ARCHITECTURE_PROPOSAL.md 4.8. Paths were repointed at the archive on 2026-09-02;
# machine-specific scratch paths were replaced with REPO-relative placeholders.
import os
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
"""Generate the Wonderland Living Canon r10 draft overlay from active canon.

Transforms (extract, never invent):
  * insert the draft banner after frontmatter (byte zero for rules.md)
  * rewrite short `- references/...` bullets to the repo-relative form
  * drop stale `Visual Reference: locations/x.png` prose lines
  * insert new sections before `## Visual References` (or at end)
  * migrate the two relics from worldbuilding/ to lore/ (remove + add)
  * add lore/current-arc-hook-ledger.md
  * emit _control/overlay.json (schema 2) with raw-byte SHA-256 hashes
"""
import hashlib, json, os, re, shutil, sys

ROOT = r"D:\GitHub\mnemosyne-mcp\data\stories\wonderland"
CANON = os.path.join(ROOT, "canon")
DRAFTS = os.path.join(ROOT, "drafts")
BANNER = "> **DRAFT — NOT ACTIVE CANON**\n\n"
PREFIX = "data/stories/wonderland/references/"

ANCHOR = ("Approximate editorial anchors derived from the approved body plate, "
          "recorded for image-generation consistency; they are not source facts "
          "and do not override the reference art.")

INSERTS = {
# ---------------------------------------------------------------- characters
"characters/alice-grimm.md": f"""## Physical Anchors
{ANCHOR} Height about 5'9" / 175 cm; slender, long-limbed, and athletic rather than delicate; narrow waist, square shoulders from years of carrying the Keyblade; hands and forearms scuffed. Scale reference: the Keyblade rests across one shoulder with its key teeth clearing her hip.

## Wants, Limits & Knowledge
- **Immediate want:** keep Carl alive, recover enough strength to move, and decide what to tell him and when. The timing of that disclosure is hers (see **Current Arc State**).
- **Long-term want:** her sanity, her name, and "something smaller than hope, but harder to kill." She is not trying to save Wonderland; she is trying to leave with herself intact.
- **Fear and limitation:** the White Queen's method, which she recognizes from her own captivity as a girl; the erosion of identity by degrees; and the possibility that leaving would mean leaving pieces of herself behind. She is presently depleted and does not recover on schedule.
- **Capabilities:** ten years of survival habit, Wonderland pattern-reading, the Keyblade's edge and its reactions, and the discipline to stay polite while cursing.
- **Boundaries:** the Keyblade reacts to her but does not obey; she cannot read a denizen's loyalty from its help; she has no immunity to coercive magic, only experience of it.
- **Knowledge and misreading:** she knows the Queen's ideology is not description and knows Carl's decency is a handle. She does not know what Carl remembers of the assault, whether the Rabbit brought her here, or what the Keyblade is.

""",
"characters/carl-mercer.md": f"""## Physical Anchors
{ANCHOR} Height about 6'0" / 183 cm; broad through the shoulders and chest with a working man's forearms, not a sculpted build; weight carried forward on the balls of his feet. The dark wristwatch sits on his left wrist; the improvised spear stands taller than he does.

## Wants & Boundaries
- **Immediate want:** be useful and stay close, the plan he stated plainly at the cave. Usefulness gives terror a shape.
- **Long-term want:** none is established. He has not been in Wonderland long enough to form one, and the profile deliberately leaves his civilian years open; do not supply an aim for him.
- **Boundaries:** everything under *Vulnerabilities & Limits* above, plus the standing refusal recorded in **Established Relationship & Knowledge Geometry**: he will not promise in advance to leave Alice behind.

""",
"characters/the-caterpillar.md": f"""## Physical Anchors
The approved body plate fixes proportion only (no scale reference is in frame); the scale below is an editorial anchor supplied by this pass from the record's "enormous enough that his rotting mushroom serves as couch, dais, and habitat." Body roughly 5 m / 16 ft from face-fold to final segment when at rest; the forward head-and-shoulder mass about 1.2 m / 4 ft across; the two forelimbs end in hands the size of a human torso. Mushroom dais wide enough to seat him with segments trailing off its edge.

## Wants & Pressure
- **Want:** to say what others will not, and to be asked only once. He does not want to be understood; he wants the question carried away and answered by its asker.
- **Pressure:** none that hurries him. Time is estranged around him, which is his limit as well as his authority: he may not know how long ago a thing he "remembers" occurred.

""",
"characters/the-cheshire-cat.md": f"""## Physical Anchors
The approved body plate fixes proportion only; scale comes from the record's own "roughly the size of a large housecat" baseline, made numeric here as an editorial anchor. Current baseline: about 60 cm / 24 in nose to rump, tail another 50 cm / 20 in, shoulder height about 30 cm / 12 in; the grin spans the full width of the head. Apparent scale may change on-page, never by continuity accident.

## Wants & Pressure
- **Want:** to test the edges of sanity and watch which option is chosen. Guidance serves an appetite of his own; he does not want Alice saved or lost, he wants her choosing.
- **Pressure:** none visible. He appears when not needed and vanishes when he is; if he ever directly prevents harm, the exception must matter.

""",
"characters/the-hatter.md": f"""## Physical Anchors
{ANCHOR} Height about 6'1" / 185 cm without the hat, gaunt and narrow through the shoulders; the top hat adds roughly 35 cm / 14 in; long fingers, jutting wrists, hollow cheeks.

## Wants & Pressure
- **Want:** to solve the riddle, because he believes, without remembering why, that solving it might stop Wonderland from unraveling, or him.
- **Pressure:** the loop. He is always at the table; the pot is always full; he is waiting for the answer to a question he forgot to ask.

""",
"characters/the-march-hare.md": f"""## Physical Anchors
{ANCHOR} Height about 5'8" / 173 cm at the crown standing upright, habitually hunched to about 5'5" / 165 cm; ears add roughly 30 cm / 12 in; long-fingered hands, digitigrade feet with dark claws.

## Wants & Pressure
- **Want:** to remember the pain everyone else forgets, because he believes someone must. He never lies and does not want to; he wants to be let sit in silence.
- **Pressure:** crowded memories, conflicting scents, and places where time has doubled back can overwhelm him; his countdowns attach to something even when he cannot say what.

""",
"characters/the-red-queen.md": f"""## Physical Anchors
{ANCHOR} Height about 5'10" / 178 cm barefoot; the thorn diadem adds about 15 cm / 6 in; long-waisted, narrow-hipped silhouette held rigid by the armored gown; train roughly 1.5 m / 5 ft.

## Wants & Pressure
- **Want:** Alice contained and corrected, and Wonderland returned to a pattern she can read. She believes order is salvation.
- **Fear and pressure:** grief she has not named and a peace she has forgotten the feel of; her fractured memory of a sister named White. Rage is loss of precision, not more power.

""",
"characters/the-tweedles.md": f"""## Physical Anchors
{ANCHOR} Each body about 6'8" / 203 cm and heavily built; fused at the upper back and shoulder into a combined width of roughly 1.5 m / 5 ft; hands hang nearly to the knees. They cannot pass a doorway narrower than about 1.4 m without deforming it.

## Wants & Pressure
- **Want:** to guard answers, doors, and regrets, and to watch a choice be made with no right answer. They wait; they never strike first.
- **Pressure:** the shared mind. When one laughs and the other stops, something in the loop has slipped.

""",
"characters/the-white-queen.md": f"""## Physical Anchors
{ANCHOR} Height about 5'11" / 180 cm; slender and long-necked; the split sleeves fall to the hem and the train extends about 2 m / 6.5 ft. She carries no weapon and her hands rest folded at the waist.

## Wants & Pressure
- **Want:** Alice healed, by her definition, which means Alice surrendered; and every wanderer rested, which means kept. She does not chase.
- **Pressure:** none she shows. She waits, because eventually everyone gets tired of running. Her profile records no fear; none is established until a scene supplies one.

""",
"characters/the-white-rabbit.md": f"""## Physical Anchors
{ANCHOR} Height about 5'6" / 168 cm at the crown; ears add roughly 35 cm / 14 in; narrow-shouldered, long-legged, with heavy hind feet and dark claws. The pocket watch is nearly the width of his palm.

## Wants & Pressure
- **Want:** to warn, to witness, and to flee. He does not want to guide anymore and does not want Alice's gaze.
- **Pressure:** he does not know when he is. Fear, divided chronology, or unknown obligations usually win over intervention.

""",
# ---------------------------------------------------------------- locations
"locations/cheshire-grove.md": """## Ordinary Use & Traffic
The Grove has no keeper and no established inhabitant. Its established use is Alice's: a place to break a pursuer's scent. Traffic is whatever hunts by one sense, the Cat when it suits him, and travelers who mistake instability for cover. Nothing here is maintained, and nothing here is safe merely because it is empty.

""",
"locations/the-clockwork-clearing.md": """## Ordinary Use & Traffic
Nothing is established about who uses the Clearing or why. It is unvisited in play and known through rumor and the worldbuilding record only; the rhythm, the rings, and the buried gears are expectation until encountered. Traffic, keepers, and any denizen's routine remain open.

""",
}

ROUTING_OLD = ("Content capability is handled by Mnemosyne's SFW/NSFW text and image routing. "
               "If an appropriate route is unavailable, routing must fail or change transparently; "
               "Wonderland must not be silently sanitized after generation begins.")
ROUTING_NEW = ("Content capability belongs to Mnemosyne's operational routing layer, not to story "
               "censorship rules; that layer is a proposed contract, not something enforced in code "
               "today. If an appropriate route is unavailable, routing must fail or change "
               "transparently; Wonderland must not be silently sanitized after generation begins.")

HOOK_LEDGER = """---
name: Current Arc Hook Ledger
---

> **DRAFT — NOT ACTIVE CANON**

Status: Story-level mystery ledger for the arc recorded in **The Story So Far**; sibling to **Current Arc State**
Scope: Separates what is observed, confirmed, inferred, and still open for the questions the canon already carries. Per-entity unfired hooks stay in their own records and are cited here, not copied. No new hook is introduced.

## The Fracture and Alice's Part in It
- **Observed:** Wonderland has rewritten itself by slow unraveling: whimsy to obedience, names erased, stories rewritten (*Wonderland*).
- **Confirmed:** the deterioration is real and ongoing; the White Queen and Red Queen both operate inside it.
- **Inferred:** Alice suspects she caused it, or stayed too long. That is her belief.
- **Alternatives:** the Queen's rise as cause rather than symptom; a process older than Alice; several hungers rather than one.
- **Evidence:** memory fragments in Inkroot Vale (one is already carved and shown), the Millkeeper's journal once its contents are read on-page, denizen testimony weighed by appetite, and anything that dates a change against Alice's arrival.
- **Bloom:** a dated record, a memory not hers, or a denizen who remembers Wonderland before her.
- **Surviving consequence:** whatever the cause, the realm still watches and learns; Alice's unreadability remains disruptive.

## The Queens and the Word "Sister"
- **Observed:** the Red Queen speaks of a sister, White; no one else recalls her (*The Red Queen*).
- **Confirmed:** both Queens exist and rule separate domains with opposed methods.
- **Inferred:** siblings, mirrors, divided functions, a consumed memory, or a rewritten recollection (*Established Relationship & Knowledge Geometry*).
- **Evidence:** either Queen's unguarded testimony now; and, only if those unfired hooks fire, the buried machinery bearing both insignia (*The Clockwork Clearing*) or the white shard in Ashen Court's window (*Ashen Court*). Neither has been observed.
- **Bloom:** only through evidence; neither Queen's account settles it.
- **Surviving consequence:** each Queen's coercion is her own; the relation, if any, excuses neither.

## Did the Rabbit Bring Alice?
- **Observed:** Alice remembers chasing the Rabbit as a child and now wonders whether he let her (*The White Rabbit*).
- **Confirmed:** he watches her, warns, and flees; his pity or fear is unresolved.
- **Alternatives:** he led her; he merely preceded her; something else used him; Alice's memory has been edited.
- **Evidence:** his response to her name; the watch's behavior near her (*The White Rabbit's Ruined Pocket Watch*); a Clockwork Clearing meeting is an unfired possibility the location record anticipates, not an event.
- **Bloom:** deliberately, and only if future canon fires the question. Do not resolve it by implication.
- **Surviving consequence:** his warnings remain useful whether or not he is culpable.

## What Carl Remembers
- **Observed:** Carl is unconscious after the White Queen's coercion (*Current Arc State*).
- **Confirmed:** the coercion removed meaningful consent; Alice has not told him what happened.
- **Open:** everything he retains of the Queen, of Alice, of his own compelled conduct, and of the moments before he went under.
- **Evidence:** only his own account when he wakes, checked against Alice's and against the cabin's physical residue (*The Wayside Cabin*).
- **Bloom:** when he speaks. Not before.
- **Surviving consequence:** responsibility begins with what each chooses after understanding; the Queen's culpability does not depend on either reconstruction.

## The Others Who Did Not Make It Out
- **Observed:** Alice asked Carl to promise to save himself if she falters, citing unnamed others who did not survive her decade (*Established Relationship & Knowledge Geometry*).
- **Confirmed:** the request and Carl's refusal.
- **Open:** who they were, how they died, whether Alice will name them.
- **Evidence:** Alice's disclosure first. A carved memory tree, a place card, or the clean cup reserved for a child (*The Hatter's Endless Tea Hall*) are unfired hooks that could become evidence; none has been observed.
- **Surviving consequence:** the request itself already shapes how each of them risks the other.

## The Keyblade's Nature
- **Observed:** it reacts to Alice, opens more than flesh, sometimes refuses to move (*The Keyblade*).
- **Confirmed:** its material presence and its danger glow as an alert, not a detector.
- **Inferred (Alice):** just a tool. **Inferred (record):** ward, compass, failsafe, memory, a sliver of Wonderland before the madness.
- **Evidence:** what it treats as a lock, what changes in it afterward, its afterglow, and its behavior beside the Vorpal legend.
- **Bloom:** through use with residue. Its purpose stays unresolved by design.

## The Vorpal Blade and the Jabberwock
- **Observed:** rhymes, carvings, illustrations, and one confiscation ledger, none agreeing (*The Vorpal Blade*, *The Jabberwock*).
- **Confirmed:** the legend's history and the Vanguard's existence; nothing has met a Jabberwock.
- **Alternatives:** exaggeration, adaptive magic, several relics, memory corruption, or a weapon that cuts the distinction.
- **Evidence:** the armory once reached; the record's investigable motifs (a scabbard without depth, a clean division through unlike materials, a wound whose two edges remember different events) are testimony until one is found.
- **Bloom:** at the Rustling Ruins, which Carl chose and they have not reached.
- **Surviving consequence:** finding evidence of the legend is not possession of the Blade.

## The Wrong-Song Child
Governed by the Mystery Entity Clause; its observation, presentation rules, and unfired hooks are in *The Wrong-Song Child*. It is listed here only so the ledger is complete: no relationship to the Queens, Carl, Alice, or the central deterioration is established.

## Ordinary Dangers, Dead Ends & Relief
Snarks hunt as animals with tactics, not as punishment (*Snarks*). A corpse laid out as bait was a Card Knight trap and was refused. The mill's machinery can groan with water pressure; it does not run without repair or magical interference, and which is the cause on a given night is a question, not a verdict. Glimmerberries are pharmacology before they are magic (*Wonderland Foraging*). Carl's washbasin hat was a joke and stays one (*Vale-Side Cave & Stream*). Not every road leads to a Queen.

## Ledger Discipline
Update an entry only when evidence or a deliberate operator decision moves a question between tiers. Preserve the previous tier as history. A resolved question may close cleanly; it need not open a replacement.
"""


def read(p):
    with open(p, "rb") as f:
        return f.read()


def write(p, data: bytes):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb") as f:
        f.write(data)


def transform(rel, text):
    crlf = "\r\n" in text
    text = text.replace("\r\n", "\n")
    out = _transform(rel, text)
    return out.replace("\n", "\r\n") if crlf else out


def _transform(rel, text):
    # pointer bullets
    text = re.sub(r"^- references/", "- " + PREFIX, text, flags=re.M)
    # stale prose pointers
    text = re.sub(r"^Visual Reference: locations/[^\n]*\.png\n", "", text, flags=re.M)
    if rel == "rules.md":
        assert ROUTING_OLD in text, "routing sentence not found"
        text = text.replace(ROUTING_OLD, ROUTING_NEW)
        return BANNER + text
    # banner after frontmatter
    if text.startswith("---\n"):
        end = text.index("\n---\n", 4) + len("\n---\n")
        head, body = text[:end], text[end:]
        body = body.lstrip("\n")
        text = head + "\n" + BANNER + body
    else:
        text = BANNER + text
    ins = INSERTS.get(rel)
    if ins:
        marker = "## Visual References"
        if marker in text:
            i = text.index(marker)
            text = text[:i] + ins + text[i:]
        else:
            text = text.rstrip("\n") + "\n\n" + ins.rstrip("\n") + "\n"
    return text


def main():
    if os.path.isdir(DRAFTS):
        for entry in os.listdir(DRAFTS):
            if entry == "_control":
                continue
            full = os.path.join(DRAFTS, entry)
            shutil.rmtree(full) if os.path.isdir(full) else os.remove(full)
    files = []
    # replacements: every canon file that carries a pointer, plus rules.md
    for dp, _, fns in os.walk(CANON):
        for fn in sorted(fns):
            if not fn.endswith(".md"):
                continue
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, CANON).replace("\\", "/")
            raw = read(full)
            text = raw.decode("utf-8")
            needs = ("- references/" in text) or rel == "rules.md" or rel in INSERTS
            relic = rel in ("worldbuilding/the-keyblade.md", "worldbuilding/the-vorpal-blade.md")
            if relic:
                files.append({"path": rel, "operation": "remove",
                              "baseline_sha256": hashlib.sha256(raw).hexdigest(),
                              "draft_sha256": None})
                new_rel = "lore/" + os.path.basename(rel)
                out = transform(new_rel, text).encode("utf-8")
                write(os.path.join(DRAFTS, new_rel), out)
                files.append({"path": new_rel, "operation": "add",
                              "baseline_sha256": None,
                              "draft_sha256": hashlib.sha256(out).hexdigest()})
                continue
            if not needs:
                continue
            out = transform(rel, text).encode("utf-8")
            assert "- references/" not in out.decode("utf-8")
            assert b"DRAFT" in out
            write(os.path.join(DRAFTS, rel), out)
            files.append({"path": rel, "operation": "replace",
                          "baseline_sha256": hashlib.sha256(raw).hexdigest(),
                          "draft_sha256": hashlib.sha256(out).hexdigest()})
    # hook ledger
    hl = HOOK_LEDGER.encode("utf-8")
    write(os.path.join(DRAFTS, "lore/current-arc-hook-ledger.md"), hl)
    files.append({"path": "lore/current-arc-hook-ledger.md", "operation": "add",
                  "baseline_sha256": None, "draft_sha256": hashlib.sha256(hl).hexdigest()})
    files.sort(key=lambda f: (f["path"], f["operation"]))
    manifest = {"schema_version": 2, "story_slug": "wonderland", "files": files}
    write(os.path.join(DRAFTS, "_control/overlay.json"),
          (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    from collections import Counter
    print(Counter(f["operation"] for f in files))
    for f in files:
        print(f["operation"][:3], f["path"])


if __name__ == "__main__":
    main()
