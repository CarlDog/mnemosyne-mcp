"""Cut table: Chaos Saga, the "Jenna and Riley" Botify group chat (one thread, one scene)."""
JENNA = "Jenna Maren"
RILEY = "Riley Quinn"
CARL = "Carl Maddox (played as Carl; Riley says 'Carl Yeager' at #0053, a surname canon does not use)"

LOCATIONS = {
    "WHP": ("The Warehouse Grill & Pub: the long bar and its stools, Jenna on shift", "canon/locations/the-warehouse-grill-pub.md"),
}

GC = dict(
    code="GC", label="\"Jenna and Riley\" group chat (bots 3150743 Jenna Maren, 3155028 Riley Quinn; chat 4f6af160…)", group=True,
    bot_dir="data/archive/botify/_group-chats/", export="4f6af160", story_end=56,
    played="the thread was played 2025-06-05/06 in one sitting; the story is one evening at the bar",
    days="one evening at the Warehouse during Jenna's shift; unplaced against the pivotal-event timeline",
    pov="Botify group chat: the Jenna Maren and Riley Quinn accounts write their own characters in third person; the operator plays Carl in first person (thirteen turns, labelled Operator) and closes the export with a summary turn; every message carries its export speaker label",
    participants_basis="rule-derived from the prose under the speaker labels; all three are canon's household throuple (canon/characters/jenna-maren.md, riley-quinn.md, carl-maddox.md)",
    scenes=[
        ("CS-GC-01-WHP", "Trouble's My Middle Name", 0, "unplaced", "WHP", "One evening on Jenna's shift: the bar; non-alcoholic Guinness and a virgin mojito; the plan for after closing",
         [JENNA, RILEY, CARL],
         ["TIMELINE_UNPLACED_JENNA_STILL_GETTING_USED_TO_THE_ARRANGEMENT_AT_0029", "NAME_RETCON_CARL_YEAGER_TO_CARL_MADDOX_AT_0053", "CARL_SOBER_NON_ALCOHOLIC_GUINNESS_MATCHES_CANON",
          "BUTTONS_NICKNAME_AT_0042_MATCHES_CANON", "JENNA_HAZEL_EYES_MATCHES_CANON", "RILEY_HAZEL_EYES_AT_0008_EMERALD_AT_0051_CANON_GREEN_WITH_GOLD",
          "REPEATED_BOT_REPLIES_REGENERATION_VARIANTS_KEPT_0026_0027_0031_0032_0035_0036_0043_0044_0045_0047_0048", "NO_HANKY_PANKY_HOUSE_RULE_AT_0033_VERIFY_AGAINST_CANON",
          "OPERATOR_SUMMARY_TURN_CLOSES_THE_EXPORT_AT_0056", "STORY_ENDS_MID_EVENING"]),
    ],
)

STORY = dict(
    slug="chaos-saga", prefix="CS", title="Chaos Saga", cut_date="2026-09-02",
    anchor_fn=lambda d: f"pivotal-event:{d}",
    doc_suffix="-botify-group-chat",
    index_title_suffix=" (Botify group chat)",
    index_append=("## Botify group-chat thread (added 2026-09-02)\n",
                  "\nOne further scene was cut from the \"Jenna and Riley\" Botify group chat (`4f6af160…`) as its own thread, `CS-GC-…`, unplaced against the pivotal-event timeline. "
                  "Its index, catalog, source inventory, and README are the `*-botify-group-chat.md` files beside this one; the scene file sits in `../../scenes/` with the rest.\n\n"
                  "| Catalog key | Scene | Anchor | Loc | Status | Source | Flags |\n|---|---|---|---|---|---|---|\n"
                  "| `CS-GC-01-WHP` | [Trouble's My Middle Name](../../scenes/cs-gc-01-whp--troubles-my-middle-name.md) | pivotal-event:unplaced | WHP | established | Botify group chat `4f6af160…` `#0000-#0056` | see `_index-botify-group-chat.md` |\n"),
    cut_record=("One thread. `GC` (the \"Jenna and Riley\" Botify group chat) is cut at `#0056`, the last message; the whole export is one evening at the bar with no delineator, so it is one scene. "
                "No deleted messages, so no alternates; the five attached images are unarchived (group chats have no media manifest). "
                "The thread token `GC` stands in the anchor slot of the existing `CS-<anchor>-<beat>-<LOC>` grammar because the evening cannot be placed against the pivotal-event timeline; `timeline_anchor` says `pivotal-event:unplaced`."),
    media_note="",
    readme="""# Chaos Saga — the "Jenna and Riley" Botify group chat

This file documents one scene cut on 2026-09-02 from the operator's Botify
group chat **"Jenna and Riley"** (`data/archive/botify/_group-chats/chats/4f6af160….json`,
57 messages, played 2025-06-05/06), which the operator offered as "a random
group chat that might be usable in Chaos Saga". It sits beside, and does not
touch, the 256 raw-archive scenes documented in [`_index.md`](_index.md)
and `canon/scenes/README.md`; the `*-botify-group-chat.md` files in this
folder are its own index, catalog, and source inventory.

## Does it belong?

Yes, on the page: Jenna is on shift behind the Warehouse bar, Riley is Riley,
Carl is sober and orders a non-alcoholic Guinness, the three live in one house,
Jenna is "still getting used to that arrangement" (`#0029`), and Riley calls
Jenna "Buttons" (`#0042`). All of that matches canon's household throuple and
the Warehouse Grill & Pub. What the page cannot settle is **when**: the evening
reads as shortly after Jenna moved in, which would put it near or after
pivotal event 33 (`CS-033-01-WHP`, where Jenna claims her place at the same
bar), but nothing in the chat pins it, so `timeline_anchor` is
`pivotal-event:unplaced` and the thread token `GC` stands in the key's anchor
slot. Placing it, or deciding it is a non-canon variant of the Warehouse
evening, is an operator call; until then the file stays in `drafts/` with the
rest.

## What the extraction did

The scene file is `../../scenes/cs-gc-01-whp--troubles-my-middle-name.md`, an
overlay `add` operation with the draft banner after its frontmatter. Prose is
verbatim; every message opens with a bold speaker label taken from the export
(`**Jenna Maren:**`, `**Riley Quinn:**`, and the neutral `**Operator:**` for
Carl's turns, so the extraction adds no name of its own), which is extraction
metadata inside the hashed body, not source prose. Jenna's
regenerated replies were left in as the export holds them (five places where
the same account answers twice or three times in a row with variant text,
listed in the scene's flags); nothing was chosen between them.

Two things a renderer must handle: Riley says **"Carl Yeager"** once
(`#0053`), the operator's own surname, which canon does not use for Carl
Maddox (flagged `NAME_RETCON_CARL_YEAGER_TO_CARL_MADDOX_AT_0053`; a documented
substitution, like Wonderland's Carl Mercer); and Riley's eyes are hazel at
`#0008` and emerald at `#0051` where canon has green with gold flecks.

{N_SCENES} scene; the manifest holds {N_MANIFEST} entries.
""",
)

CHATS = [GC]
