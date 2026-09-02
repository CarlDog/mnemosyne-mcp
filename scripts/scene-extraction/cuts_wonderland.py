"""Cut table: Wonderland (one Botify chat)."""
MATURE = "MATURE_CONTENT"
NAME = "NAME_RETCON_CARL_YEAGER_TO_CARL_MERCER"
NONCON = "NONCONSENT_OR_COERCION_CONTENT"

ALICE = "Alice Grimm"
CARL = "Carl Mercer (played as Carl; the bot and the operator write 'Carl Yeager' in seven messages, a string canon retires for Carl Mercer)"
CHESH = "the Cheshire Cat (played as Chesh)"
QUEEN = "the White Queen"
CHILD = "the Wrong-Song Child (the source calls her Marywraithe at #0437 and #0441)"

LOCATIONS = {
    "FOR": ("the twisted forest between the meeting place, the Inkroot Vale, the cave, and the mill", "canon/locations/cheshire-grove.md (nearest record; the prose never names the grove)"),
    "IRV": ("the Inkroot Vale: the story-telling trees; the howl", "canon/locations/inkroot-vale.md"),
    "CAV": ("the small cave by the stream: the washbasin, the fire, the night", "canon/locations/vale-side-cave-stream.md"),
    "MIL": ("the abandoned mill and its surroundings: the side door, upstairs, the grimy window (called a cabin once, at #0692)", "canon/locations/the-abandoned-mill.md"),
    "WQP": ("the White Queen's palace: the ivory carriage, the marble corridor, the bathing chamber, the bedchamber (no canon counterpart; canon has the White Garden and the Wayside Cabin)", None),
}

AG = dict(
    code="AG", label="Alice Grimm private chat (bot from bot.json, chat 1c71db26…)",
    bot_dir="data/archive/botify/alice-grimm/", export="1c71db26", story_end=814,
    played="the thread was played in sessions across 2025-2026; the story runs three days and a fourth of unknown length",
    days="1: the flight, the Vale, the cave; 2: foraging, the Wrong-Song Child, the mill; 3: the carriage, the palace; 4: the bedchamber",
    pov="Botify private chat with the Alice Grimm bot: the bot writes Alice in first or third person; the operator plays Carl in first person and, from #0720, writes Alice and the palace in third person as director; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; Carl is played under the operator's own surname in seven messages, which canon retires for Carl Mercer; the child is canon's Wrong-Song Child under a source-only name; verify before relying on it",
    scenes=[
        ("WL-AG-01-FOR", "Run", 0, 1, "FOR", "Day 1: something big and angry in the underbrush; the flight through the trees",
         [ALICE, CARL],
         ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE", "CHESHIRE_MENTIONED_AT_0010", "ALICE_TORN_DRESS_SOOT_AND_BLOOD"]),
        ("WL-AG-02-FOR", "Where Are We Going", 23, 1, "FOR", "Day 1: walking; the first questions",
         [ALICE, CARL],
         ["OPERATOR_WRITES_ALICES_LINE_AT_0023", "ALICE_TEN_YEARS_IN_WONDERLAND_MATCHES_CANON"]),
        ("WL-AG-03-IRV", "Inkroot Vale", 35, 1, "IRV", "Day 1: the story-telling trees",
         [ALICE, CARL],
         ["INKROOT_VALE_MATCHES_CANON_LOCATION"]),
        ("WL-AG-04-IRV", "The Howl", 76, 1, "IRV", "Day 1: something hunting; the wounds",
         [ALICE, CARL],
         ["CHESHIRE_MENTIONED_AT_0082", "ALICE_WOUNDED_HERE"]),
        ("WL-AG-05-CAV", "The Cave", 113, 1, "CAV", "Day 1, evening into night: the cave by the stream; tending the wounds; the palace first mentioned",
         [ALICE, CARL],
         [NAME, "YEAGER_AT_0150_0153_0219", "PALACE_FIRST_MENTIONED_AT_0147", "ALICE_SLAPS_HELP_AWAY_BOY_SCOUT_AT_0115", "LONG_SCENE_109_MESSAGES_NO_DELINEATOR"]),
        ("WL-AG-06-CAV", "Chesh", 222, 1, "CAV", "Day 1, night: the grin at the back of the cave",
         [ALICE, CHESH, CARL + " (away at the stream)"],
         ["OPERATOR_VOICES_THE_CHESHIRE_CAT", "CHESHIRE_CAT_MATCHES_CANON_CHARACTER"]),
        ("WL-AG-07-CAV", "I Fell In", 236, 1, "CAV", "Day 1, night: the refilled washbasin; the night",
         [ALICE, CARL],
         [NAME, "YEAGER_AT_0257_0259"]),
        ("WL-AG-08-CAV", "Good Morning", 275, 2, "CAV", "Day 2, dawn: waking in the cave",
         [ALICE, CARL],
         []),
        ("WL-AG-09-FOR", "Glimmerberries", 293, 2, "FOR", "Day 2, morning: foraging",
         [ALICE, CARL],
         ["ALICES_WEAPON_CALLED_A_KEYBLADE_VERIFY_AGAINST_CANON", "GLIMMERBERRIES_CINNAMON_CAPS_SOURCE_ONLY_FLORA"]),
        ("WL-AG-10-FOR", "The Amalgam", 329, 2, "FOR", "Day 2, morning: the fused creature on the forest floor",
         [ALICE, CARL],
         ["FUSED_CREATURE_NOT_IN_CANON"]),
        ("WL-AG-11-FOR", "Breakfast Somewhere Quiet", 352, 2, "FOR", "Day 2, morning: moving on; the light repast",
         [ALICE, CARL],
         []),
        ("WL-AG-12-FOR", "It's Watching Us", 404, 2, "FOR", "Day 2, afternoon: hours of travel summarised; the moss-covered log",
         [ALICE, CARL],
         ["SUMMARISED_HOURS_AT_0404"]),
        ("WL-AG-13-FOR", "The Wrong-Song Child", 419, 2, "FOR", "Day 2, afternoon: the pale figure in the underbrush",
         [ALICE, CARL, CHILD],
         ["MARYWRAITHE_IN_SOURCE_CANON_WRONG_SONG_CHILD", "OPERATOR_VOICES_THE_CHILD", "NURSERY_RHYME_VERSES_ON_PAGE"]),
        ("WL-AG-14-MIL", "The Mill", 451, 2, "MIL", "Day 2, evening: deeper into the woods; the abandoned mill; securing it",
         [ALICE, CARL],
         ["ABANDONED_MILL_MATCHES_CANON_LOCATION", "DELETED_MESSAGES_0502_0507_EMPTY_IN_EXPORT"]),
        ("WL-AG-15-MIL", "Upstairs", 518, 2, "MIL", "Day 2, night: the makeshift bed upstairs",
         [ALICE, CARL],
         [MATURE, NAME, "YEAGER_AT_0669", "GARDEN_MENTIONED_AT_0543", "ALICE_AND_CARL_FIRST_NIGHT_TOGETHER", "LONG_SCENE_161_MESSAGES_NO_DELINEATOR"]),
        ("WL-AG-16-MIL", "Rolling Pin", 679, 3, "MIL", "Day 3, pre-dawn: the crash downstairs",
         [ALICE, CARL],
         []),
        ("WL-AG-17-MIL", "The Ivory Carriage", 692, 3, "MIL", "Day 3, morning: foraging around the mill; the White Queen's carriage takes Carl",
         [ALICE, CARL, QUEEN],
         [NAME, "YEAGER_AT_0706", "MILL_CALLED_A_CABIN_AT_0692", "WHITE_QUEEN_BROWN_EYES_AT_0708", "CARL_TAKEN_BY_THE_QUEEN", "OPERATOR_WRITES_ALICE_IN_THIRD_PERSON_FROM_0720"]),
        ("WL-AG-18-FOR", "Following the Carriage", 720, 3, "FOR", "Day 3: stalking the carriage to the palace; Alice remembers the Queen",
         [ALICE, QUEEN + " (in the carriage)", CARL + " (in the carriage)"],
         ["ALICE_ONCE_THE_QUEENS_CHILD_GUEST_BACKSTORY_AT_0722", "WHITE_QUEENS_PALACE_NOT_IN_CANON_CANON_HAS_THE_WHITE_GARDEN"]),
        ("WL-AG-19-WQP", "White Marble and Gold", 726, 3, "WQP", "Day 3: the corridor; the Queen and Carl below",
         [ALICE, QUEEN, CARL],
         ["WHITE_QUEENS_PALACE_NOT_IN_CANON_CANON_HAS_THE_WHITE_GARDEN", "CHESHIRE_MENTIONED_AT_0728"]),
        ("WL-AG-20-WQP", "The Bathing Chamber", 732, 3, "WQP", "Day 3: behind the curtain; the maid and Carl",
         [ALICE + " (hidden)", CARL, "a maid"],
         [MATURE, "ALICE_VOYEUR_FRAMING"]),
        ("WL-AG-21-WQP", "Her Majesty", 740, 3, "WQP", "Day 3: the White Queen sweeps in",
         [ALICE + " (hidden)", CARL, QUEEN, "a maid"],
         [MATURE, NONCON, "CARL_UNDER_THE_QUEENS_COMPULSION"]),
        ("WL-AG-22-WQP", "Snap Out of It", 752, 3, "WQP", "Day 3: Alice charges; the compulsion; the drain",
         [ALICE, QUEEN, CARL],
         [MATURE, NONCON, "WHITE_QUEEN_BROWN_EYES_AT_0776_ICE_BLUE_AT_0806", "LIFE_FORCE_DRAIN_0801_0807_MATCHES_CANON_QUEEN", "ALICE_COMPELLED_ON_PAGE"]),
        ("WL-AG-23-WQP", "Cocooned", 808, 4, "WQP", "Later, length unknown: the bedchamber; waking beside Carl",
         [ALICE, CARL],
         ["TIME_SKIP_OF_UNKNOWN_LENGTH_AT_0808", "STORY_ENDS_AT_0814", "LAST_TWO_MESSAGES_0813_0814_KEPT_IN_STORY"]),
    ],
)

STORY = dict(
    slug="wonderland", prefix="WL", title="Wonderland", cut_date="2026-09-02",
    cut_record=("One thread. `AG` (Alice Grimm) is cut at `#0814`, the last message. Six deleted messages (`#0502`-`#0507`, all with empty text in the export) are in `_alternates/`. "
                "Two scenes run long without a delineator (`WL-AG-05-CAV`, 109 messages; `WL-AG-15-MIL`, 161 messages); the rule found nothing to cut on."),
    media_note="",
    readme="""# Wonderland — Recovered Scenes

The played Wonderland thread was cut into per-scene files so each scene can
later be rendered in storybook or graphic-novel form. The scene files live in
`../../scenes/` as overlay `add` operations pending review (each carries the
draft banner after its frontmatter); this `_control/scenes/` folder holds
their documentation, indexes, and alternates. Nothing was imported to
OpenChronicle or promoted; `canon_status` is documentation only.

Every file's prose is verbatim from one of the operator's Botify private chats:

| Thread | Bot | Export |
|---|---|---|
| `AG` | Alice Grimm | `data/archive/botify/alice-grimm/chats/1c71db26….json` (815 messages) |

{N_SCENES} scenes were cut on 2026-09-02 (index in [`_index.md`](_index.md));
the manifest holds {N_MANIFEST} entries (the story's r10 overlay plus these).

## Invented delineators

Botify chats carry no scene headers, so the boundaries are the operator-approved
rule from the Blackwood Case extraction: a new scene starts where the story
**changes place, jumps in time, or the cast changes**. Play-session gaps are
not boundaries. Ranges are contiguous, so the six deleted messages belong to
`WL-AG-14-MIL` and live in [`_alternates/`](_alternates/README.md) (the export
holds no text for any of them). Bare `Continue` turns and blank bot messages
are dropped from bodies and counted.

## The surname in the prose

Carl is played under the operator's own surname: the bot and the operator write
**"Carl Yeager"** in seven messages (`#0150`, `#0153`, `#0219`, `#0257`,
`#0259`, `#0669`, `#0706`). Canon's Carl is **Carl Mercer**, and canon
explicitly retires the "Carl Yeager" string, so this is a documented retcon
(the Black Ledger's Karl Jager → Rhydan Veyr situation), not the open
operator-identity question the Brass & Nerve, Adjustment Protocol, and Noctis
Veil extractions carry. The prose is kept verbatim; every affected scene is
flagged `NAME_RETCON_CARL_YEAGER_TO_CARL_MERCER` with the message numbers, so
a renderer substitutes on the page and nothing else changes.

## Names and places: played versus canon

| Played in the source | Canon |
|---|---|
| Carl Yeager (seven messages) | Carl Mercer |
| Marywraithe (`#0437`, `#0441`) | the Wrong-Song Child |
| Chesh | the Cheshire Cat |
| the Inkroot Vale, the cave by the stream, the abandoned mill | Inkroot Vale, the Vale-side cave stream, the Abandoned Mill |
| the White Queen's palace (marble, gold, a bathing chamber) | not in canon; canon has the White Garden and the Wayside Cabin |
| the fused creature, glimmerberries, cinnamon caps, Alice's "keyblade" | not in canon (verify the weapon) |

Other flagged differences carried as flags rather than fixed: the White
Queen's eyes are brown at `#0708` and `#0776` and ice-blue at `#0806`; the mill
is called a cabin once (`#0692`); the Queen's life-force drain (`#0801`,
`#0807`) matches canon's Queen. Alice's ten years in Wonderland (`#0115`)
matches canon.

## Mature and coercion content

`WL-AG-15-MIL` and the three palace scenes from `WL-AG-20` on are flagged
`MATURE_CONTENT`; `WL-AG-21` and `WL-AG-22` also carry
`NONCONSENT_OR_COERCION_CONTENT` (the Queen's compulsion over Carl, then over
Alice). Route accordingly.
""",
)

CHATS = [AG]
