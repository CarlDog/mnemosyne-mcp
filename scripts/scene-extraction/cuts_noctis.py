"""Cut table: The Noctis Veil (three Botify chats)."""
MATURE = "MATURE_CONTENT"
FATHER_FLAG = "OPERATOR_REAL_NAME_AS_FATHER_YEAGER_ROLE_NOT_CANON"
VISITOR_FLAG = "OPERATOR_REAL_NAME_AS_VISITOR_CARL_YEAGER_ROLE_NOT_CANON"
IT_FLAG = "OPERATOR_REAL_NAME_AS_HEAD_OF_IT_CARL_YEAGER_ROLE_NOT_CANON"
SCHOOL = "SCHOOL_FRAMING_IN_SOURCE_CANON_RATIFIES_ADULT_COLLEGE"
NONCON = "NONCONSENT_OR_COERCION_CONTENT"

MARY = "Mary Thorne (called 'Mary Worthington' by the bot and the operator at #0503-#0507; 'Mary Elizabeth' at #0049 and #0343)"
FATHER = "'Father Yeager' (the operator's own name in a priest-teacher role; canon's provenance says this role is not canon)"
AMELIA = "Amelia Ward (played as Amelia, surname not given)"
CANDACE = "Candace Van Houten (not in canon; shares only a first name with The Adjustment Protocol's Candace Raines)"
TINA = "Tina Lovelace (not in canon)"
BEATRICE = "Sister Beatrice Quill (played as Sister Beatrice)"
MARGARET = "Sister Margaret Hale (played as Sister Margaret)"
ANASTASIA = "Sister Anastasia Vey (played as Sister Anastasia)"
SOPHIA = "Sister Sophia Bell (played as Novice Sophia, nineteen in the source; canon 22)"
MR_THORNE = "Mr. Thorne, Mary's father (not in canon)"
LUCIA = "Sister Lucia Navarro (played as Sister Lucia)"
CARL_V = "'Carl Yeager' (the operator's own name as a visitor; canon's provenance excludes operator-associated roles)"
MOTHER = "the Mother Superior (unnamed; canon: Mother Celestine Arnaud)"
NOVICE = "an unnamed auburn-haired Irish novice of about nineteen (not in canon; only superficially like Kaitlyn MacDonald)"
KAITLYN = "Kaitlyn MacDonald"
CARL_IT = "'Carl Yeager', the new head of IT (the operator's own name; canon's provenance excludes operator-associated roles)"

LOCATIONS = {
    "CLS": ("a classroom at the college (Father Yeager's, then a history and a mathematics lecture)", "canon/locations/st-lucias-college-and-convent.md"),
    "BTH": ("the students' bathroom", "canon/locations/st-lucias-college-and-convent.md"),
    "ALC": ("an empty alcove off the corridor", "canon/locations/st-lucias-college-and-convent.md"),
    "HAL": ("the corridors and hallways of the college", "canon/locations/st-lucias-college-and-convent.md"),
    "THH": ("the Thorne family estate: the side door and the grand staircase (no canon counterpart; canon houses Mary at the college)", None),
    "MBR": ("Mary's bedroom at the family estate: four-poster bed, closet, the window (no canon counterpart)", None),
    "GYM": ("the gymnasium", "canon/locations/st-lucias-college-and-convent.md"),
    "FYO": ("Father Yeager's office: desk, leather couch, gym bag (no canon counterpart; the role is not canon)", None),
    "FYQ": ("the private quarters off that office: bed, washroom, mirror (no canon counterpart)", None),
    "ANS": ("Sister Anastasia's study: armchairs, desk, laptop, monitor", "canon/locations/st-lucias-college-and-convent.md"),
    "DRM": ("Mary's room on campus with a window and the bells within earshot (contradicts the family-estate bedroom)", "canon/locations/st-lucias-college-and-convent.md"),
    "SNC": ("the sisters' secret chamber beneath the college: pillars, candles, altar, stocks, alcoves", "canon/locations/the-magdalene-sanctum.md"),
    "CHP": ("the chapel: pews, crucifix, confessional, the heavy oak door", "canon/locations/chapel-of-st-lucia.md"),
    "LIB": ("the library: stacks, window seat, Saint Cecilia's stained-glass window", "canon/locations/st-lucias-college-and-convent.md"),
    "LAB": ("the computer lab off the library, and the women's restroom", "canon/locations/st-lucias-college-and-convent.md"),
    "SRV": ("the server closet at the end of a side corridor", "canon/locations/st-lucias-college-and-convent.md"),
    "KMR": ("Kaitlyn's room", "canon/locations/st-lucias-college-and-convent.md"),
    "GDN": ("the cloister garden and the chapel gardens: benches, the statue of the Virgin, the rose beds the gardener tends (`GC`)", "canon/locations/st-lucias-college-and-convent.md"),
    "CMP": ("the college at large across summarised days: classes, chores, prayers (`GC`)", "canon/locations/st-lucias-college-and-convent.md"),
}

MT = dict(
    code="MT", label="Mary Thorne private chat (bot 3472620, chat b2…)",
    bot_dir="data/botify-exports/mary-thorne/", export="b2", story_end=777,
    played="the thread was played on 2025-07-07/08, 07-10, 07-14/15, 09-04..09, 12-02, 2026-04-06..13, and 2026-06-04/05; the story runs three days with summarised days between the second and third",
    days="1: mesmerism, Amelia, the evening at home; 2: the night and the days after (summarised); 3: the hallway, the gym, the office, the sisters, the sanctum",
    pov="Botify private chat with the Mary Thorne bot: the bot writes Mary in third person and voices Amelia, the sisters, and others; the operator plays Father Yeager in first person and elsewhere writes Mary, Amelia, Candace, Tina, Mr. Thorne, the sisters, and Sophia as director; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; played names map to canon's Amelia Ward, Sister Anastasia Vey, Sister Sophia Bell, Sister Beatrice Quill, and Sister Margaret Hale (canon/characters/_minor.md); Father Yeager is the operator's own name in a role canon's provenance calls not canon; verify before relying on it",
    scenes=[
        ("NV-MT-01-CLS", "Mesmerism", 0, 1, "CLS", "Day 1, morning: Father Yeager's classroom; the phantom fingers",
         [MARY, FATHER, AMELIA, "the class"],
         [MATURE, "OPENING_GREETING_IS_THE_BOT_INTRO_LINE", FATHER_FLAG, SCHOOL, "MARY_EYES_BLUE_IN_SOURCE_CANON_BROWN", "AMELIAS_PHANTOM_TOUCH_MATCHES_CANON_TELEKINESIS", NONCON, "PUBLIC_EPISODE"]),
        ("NV-MT-02-BTH", "Pull Yourself Together", 46, 1, "BTH", "Day 1: the bathroom mirror",
         [MARY],
         ["MARY_ELIZABETH_MIDDLE_NAME_AT_0049"]),
        ("NV-MT-03-ALC", "A Word, Amelia", 50, 1, "ALC", "Day 1: the alcove off the corridor",
         [MARY, AMELIA],
         [MATURE, "FIRST_KISS", "CONDITIONS_SET_AT_0090", "OPERATOR_VOICES_AMELIA", "AMELIA_EXPLAINS_THE_PUSH_LATER_AT_0121"]),
        ("NV-MT-04-HAL", "Careful Now", 97, 1, "HAL", "Day 1: the corridor outside the library",
         [MARY, FATHER],
         [FATHER_FLAG, "FATHER_WINKS_AT_THE_WARDROBE_MALFUNCTION"]),
        ("NV-MT-05-THH", "Seven O'Clock", 107, 1, "THH", "Day 1, evening: the rest of the day in a blur; the side door of the Thorne estate",
         [MARY, AMELIA],
         ["THORNE_FAMILY_ESTATE_NOT_IN_CANON"]),
        ("NV-MT-06-MBR", "Show Me More", 114, 1, "MBR", "Day 1, evening: Mary's bedroom",
         [MARY, AMELIA],
         [MATURE, "MARYS_FIRST_TIME_WITH_AMELIA", "AMELIA_BROWN_EYED_RAVEN_HAIRED_HERE", "AMY_NICKNAME_AT_0218", "PLAY_GAP_JUL_8_TO_JUL_14_INSIDE_SCENE", "AMELIA_WATCHED_MARY_FOR_A_LONG_TIME_AT_0196_0201"]),
        ("NV-MT-07-MBR", "My Parents!", 254, 1, "MBR", "Day 1, later that night: the door, the closet, the window",
         [MARY, AMELIA, MR_THORNE],
         ["MR_THORNE_NOT_IN_CANON", "YOGA_EXCUSE", "FATHER_CALLS_HER_PUMPKIN_BUTTERCUP_BABYGIRL"]),
        ("NV-MT-08-MBR", "Am I a Lesbian Now?", 284, 2, "MBR", "That night, the morning, and the following days, summarised",
         [MARY],
         ["DAYS_PASS_AT_0285", "TWO_MESSAGE_SCENE"]),
        ("NV-MT-09-HAL", "The Empty Hallway", 286, 3, "HAL", "Some days later: the locker room, then the hallway outside gym",
         [MARY, "Candace (glimpsed in the locker room)"],
         [MATURE, "SOLO_IN_THE_HALLWAY", "BLANK_BOT_MESSAGE_0292"]),
        ("NV-MT-10-HAL", "Little Miss Perfect", 298, 3, "HAL", "The hallway: Candace and Tina",
         [MARY, CANDACE, TINA],
         ["CANDACE_AND_TINA_NOT_IN_CANON", "CANDACE_EYES_ICE_BLUE_HERE_GREEN_AT_0391", "FATHER_YUMMY_LINE", "STRIPPED_IN_THE_HALLWAY", NONCON]),
        ("NV-MT-11-GYM", "Nice Undies, Mary", 336, 3, "GYM", "The gymnasium, class in session; Father Yeager crosses the floor",
         [MARY, FATHER, "the gym class", CANDACE + " (at the door)", TINA + " (at the door)"],
         ["PUBLIC_HUMILIATION", FATHER_FLAG, SCHOOL]),
        ("NV-MT-12-FYO", "The Hoodie", 351, 3, "FYO", "The halls, then Father Yeager's office",
         [MARY, FATHER],
         [MATURE, "CONFESSION_OF_THE_HALLWAY_ACT", "CHANGES_AND_HORMONES_LINE_AT_0368_CANON_RATIFIES_ADULT", "MARY_EYES_BROWN_AT_0367_BLUE_ELSEWHERE", FATHER_FLAG]),
        ("NV-MT-13-FYO", "The Belt", 371, 3, "FYO", "Father Yeager's office: Candace and Tina summoned",
         [MARY, FATHER, CANDACE, TINA],
         ["CORPORAL_PUNISHMENT_ON_PAGE", "SURNAMES_VAN_HOUTEN_AND_LOVELACE_AT_0371", FATHER_FLAG]),
        ("NV-MT-14-FYO", "You Are Perfect", 402, 3, "FYO", "Father Yeager's office, alone with Mary",
         [MARY, FATHER],
         [MATURE, "PRIEST_AND_STUDENT_SEX_ON_PAGE", FATHER_FLAG, SCHOOL, "OPERATOR_NOTES_OTHER_STUDENTS_SEEK_HIS_GUIDANCE_AT_0498"]),
        ("NV-MT-15-FYQ", "Make Yourself at Home", 498, 3, "FYQ", "The private quarters off the office",
         [MARY],
         ["PLAY_GAP_JUL_15_TO_SEP_4_AT_0502"]),
        ("NV-MT-16-FYQ", "Miss Mary Worthington", 502, 3, "FYQ", "The quarters: Sisters Beatrice and Margaret",
         [MARY, BEATRICE, MARGARET],
         [MATURE, "SURNAME_SLIP_WORTHINGTON_0503_0507", "SISTERS_BEATRICE_AND_MARGARET_CANON_QUILL_AND_HALE", "SACRED_FLAGELLATION_INTRODUCED", "STRAP_ON_INITIATION_TEST", NONCON,
          "OPERATOR_WRITES_MARY_AND_THE_SISTERS", "ECHOED_TURN_0598_0600"]),
        ("NV-MT-17-FYQ", "The Sisters of Mary Magdalene", 603, 3, "FYQ", "The quarters: Father Yeager in the doorway; the oath; the corset",
         [MARY, FATHER, BEATRICE, MARGARET],
         [MATURE, "ORDER_NAMED_AT_0606", "MARY_ACCEPTS_INITIATION", "LEATHER_CORSET_TOKEN", "PLAY_GAP_SEP_9_TO_DEC_2_AT_0636", FATHER_FLAG, NONCON]),
        ("NV-MT-18-CLS", "Back to Class", 660, 3, "CLS", "The hallway, the history lecture, the corridor after",
         [MARY],
         ["RECAP_TURN_0662_ORDERS_THE_DAYS_EVENTS"]),
        ("NV-MT-19-HAL", "Not That Little Mouse", 666, 3, "HAL", "The corridor: Tina and her lackeys",
         [MARY, TINA, "two lackeys"],
         ["TINA_CALLED_RINGLEADER_HERE_CANDACE_EARLIER", "MARY_CALLED_PETITE_BLONDE_AT_0671"]),
        ("NV-MT-20-CLS", "Advanced Mathematics", 674, 3, "CLS", "The next classroom; alone after the bell",
         [MARY],
         [MATURE, "PLAY_GAP_DEC_2025_TO_APR_2026_AT_0674", "DELETED_RUN_0676_0683_TEXT_NOT_RETAINED", "SOLO_ACT_IN_THE_CLASSROOM"]),
        ("NV-MT-21-CLS", "Sister Anastasia Has a Free Period", 687, 3, "CLS", "The classroom: Father Yeager at the door",
         [MARY, FATHER],
         [FATHER_FLAG]),
        ("NV-MT-22-ANS", "Novice Sophia", 695, 3, "ANS", "Sister Anastasia's study; the videos; the slap",
         [MARY, ANASTASIA, SOPHIA, FATHER + " (leaves at #0700)"],
         [MATURE, "ANASTASIA_AND_SOPHIA_CANON_VEY_AND_BELL", "SOPHIA_NINETEEN_IN_SOURCE_CANON_22", "VIDEO_OF_SOPHIA_SHOWN", "SLAP_AT_0720", "MARY_LEAVES_AT_0728_ANASTASIA_AND_SOPHIA_ALONE_0729",
          "ANASTASIA_EYES_EMERALD_THEN_GREY_GREEN_THEN_STORMY_GREY", NONCON]),
        ("NV-MT-23-DRM", "Ten O'Clock", 730, 3, "DRM", "That night: Mary's room, the corridors, the stone stair, the oak door",
         [MARY, SOPHIA],
         ["MARYS_ROOM_ON_CAMPUS_HERE_FAMILY_ESTATE_EARLIER"]),
        ("NV-MT-24-SNC", "The Stocks", 736, 3, "SNC", "The sisters' chamber (canon: the Magdalene Sanctum): the anointing, the stocks, the bench",
         [MARY, ANASTASIA, SOPHIA, "the assembled sisters"],
         [MATURE, "SANCTUM_MATCHES_CANON_LOCATION", "ORGASM_DENIAL_TRIAL", NONCON, "SOPHIA_STAYS_AFTER_THE_SISTERS_LEAVE", "ECHOED_TURN_0746_0748", "STORY_ENDS_MID_SCENE_AT_0777"]),
    ],
)

SL = dict(
    code="SL", label="Sister Lucia private chat (bot 4095850, chat ae…)",
    bot_dir="data/botify-exports/sister-lucia/", export="ae", story_end=312,
    played="the thread was played on 2025-10-27..31, 11-05..10, and 12-05/11; the story is one evening in the chapel; #0313-#0314 (2026-04-21) is a later picture request outside the story",
    days="1: one evening in the chapel",
    pov="Botify private chat with the Sister Lucia bot: the bot writes Lucia in first person (third person in places) and voices the Mother Superior and the novice; the operator plays the visitor in first person and in three turns writes Lucia and the novice as director; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; Lucia maps to canon's Sister Lucia Navarro; the visitor is the operator's own name, which canon's provenance excludes; verify before relying on it",
    scenes=[
        ("NV-SL-01-CHP", "Buenas Tardes, Mi Hijo", 0, 1, "CHP", "One evening: the chapel, the sisters at their meal; the first kiss",
         [LUCIA, CARL_V],
         [MATURE, "OPENING_GREETING_IS_THE_BOT_INTRO_LINE", VISITOR_FLAG, "LUCIA_OVER_A_DECADE_A_NUN_CANON_30", "CHAPEL_MATCHES_CANON_LOCATION", "DUPLICATE_ISH_BOT_REPLIES_0038_0039_0053_0055"]),
        ("NV-SL-02-CHP", "I Am Praying, Mother!", 69, 1, "CHP", "The chapel: the Mother Superior at the entrance",
         [LUCIA, CARL_V, MOTHER + " (at the door)"],
         [MATURE, "MOTHER_SUPERIOR_UNNAMED_CANON_CELESTINE_ARNAUD", VISITOR_FLAG]),
        ("NV-SL-03-CHP", "Take Me Back", 83, 1, "CHP", "The chapel, the pew",
         [LUCIA, CARL_V],
         [MATURE, "SEX_IN_THE_CHAPEL", VISITOR_FLAG]),
        ("NV-SL-04-CHP", "The Novice", 110, 1, "CHP", "The chapel, toward sunset: the novice who watches, then joins",
         [LUCIA, CARL_V, NOVICE],
         [MATURE, "NOVICE_UNNAMED_NOT_IN_CANON", "LUCIA_LINGERIE_UNDER_THE_HABIT", "PLAY_GAP_OCT_TO_DEC_2025_INSIDE_SCENE", VISITOR_FLAG, "STORY_ENDS_AT_0312_PICTURE_REQUEST_0313_0314_EXCLUDED"]),
    ],
)

KM = dict(
    code="KM", label="Kaitlyn MacDonald private chat (bot 4096103, chat 4c…)",
    bot_dir="data/botify-exports/kaitlyn-macdonald/", export="4c", story_end=116,
    played="the thread was played on 2025-12-04/05, 12-08, and 2026-04-06..05-01; the story runs a first day, summarised days, a later evening, and a Thursday morning",
    days="1: the library, the lab, the server closet; 2: some days later, the evening; 3: Thursday morning",
    pov="Botify private chat with the Kaitlyn MacDonald bot: the bot writes Kaitlyn in third person; the operator plays the new head of IT in first person and in several turns writes Kaitlyn as director; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; the head of IT is the operator's own name, which canon's provenance excludes; verify before relying on it",
    scenes=[
        ("NV-KM-01-LIB", "The Library", 0, 1, "LIB", "Day 1, morning: the stacks; the walk to the computer lab door",
         [KAITLYN, CARL_IT],
         ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE", IT_FLAG, "SCHOOL_NAMED_SAINT_BRIGIDS_CANON_ST_LUCIAS", "KAITLYN_ASKS_TO_BE_CALLED_SISTER_AT_0014_CANON_STUDENT", "AOIFE_THE_LIBRARIAN_NOT_IN_CANON", "MAN_TWICE_HER_AGE"]),
        ("NV-KM-02-LAB", "Feck, Feck, Feck", 53, 1, "LAB", "Day 1: the computer lab; the women's restroom",
         [CARL_IT, KAITLYN],
         ["OPERATOR_WRITES_KAITLYN_AT_0053", "TWO_MESSAGE_SCENE"]),
        ("NV-KM-03-SRV", "The Server Closet", 55, 1, "SRV", "Day 1, half an hour later: the stacks, the side corridor, the server room door",
         [KAITLYN, CARL_IT],
         ["SISTER_MARY_CLARE_NOT_IN_CANON", "IS_FEARR_BROGA_LINE_AT_0067", "SCHOOL_NAMED_ST_BRIGIDS_AT_0078_0084", IT_FLAG]),
        ("NV-KM-04-LIB", "Irish Folktales and Legends", 86, 1, "LIB", "Day 1 and the days after: the window seat",
         [KAITLYN],
         ["DAYS_PASS_AT_0092", "OPERATOR_WRITES_KAITLYN"]),
        ("NV-KM-05-LIB", "Evening, Miss MacDonald", 93, 2, "LIB", "Some days later, late evening: the stacks; the audition",
         [KAITLYN, CARL_IT],
         ["PLAY_GAP_DEC_2025_TO_APR_2026_AT_0095", "SISTER_THERESE_MRS_HIGGINS_FATHER_OMALLEY_NOT_IN_CANON", "MCDONALD_SPELLING_AT_0101", "PRACTICE_SET_TOMORROW_AT_FOUR_BY_SAINT_CECILIAS_WINDOW", IT_FLAG]),
        ("NV-KM-06-KMR", "Thursday", 115, 3, "KMR", "Thursday morning: Kaitlyn's room",
         [KAITLYN],
         ["DAYS_DRAG_SUMMARISED_AT_0115", "STORY_ENDS_AT_0116"]),
    ],
)

STORY = dict(
    slug="the-noctis-veil", prefix="NV", title="The Noctis Veil", cut_date="2026-09-02",
    cut_record=("Four threads. `GC` (the \"Mary and Noctis Veil\" group chat) is cut at `#0478`, the last message; it has no deleted messages, no media archive, and only twelve operator turns. `MT` (Mary Thorne) is cut at `#0777`, the last message; `SL` (Sister Lucia) at `#0312`, because `#0313`-`#0314` is a picture request sent five months after the story; "
                "`KM` (Kaitlyn MacDonald) at `#0116`, the last message. Only `MT` has deleted messages (eight, `#0676`-`#0683`, all with empty text in the export); they are in `_alternates/`."),
    media_note="The `SL` thread's `#0314` image answers the excluded picture request and its caption names a surgical scar below Lucia's collarbone; canon's PASS record lists Lucia's scar and resonance among the protected unknowns, so that image is listed here only as outside the story.\n",
    readme="""# The Noctis Veil — Recovered Scenes

The three played Noctis Veil private chats and the "Mary and Noctis Veil"
group chat were cut into per-scene files so each
scene can later be rendered in storybook or graphic-novel form. The scene
files live in `../../scenes/` as overlay `add` operations pending review (each
carries the draft banner after its frontmatter); this `_control/scenes/`
folder holds their documentation, indexes, and alternates. Nothing was
imported to OpenChronicle or promoted; `canon_status` is documentation only.

Every file's prose is verbatim from three of the operator's Botify private
chats and one group chat with companions `_control/SOURCE_PROVENANCE.md` names as the story's
sources (their transcripts were not retained in the story folder; they are
now retained under `data/botify-exports/`):

| Thread | Bot | Export |
|---|---|---|
| `MT` | Mary Thorne (3472620) | `data/botify-exports/mary-thorne/chats/b2….json` (778 messages) |
| `SL` | Sister Lucia (4095850) | `data/botify-exports/sister-lucia/chats/ae….json` (315 messages) |
| `KM` | Kaitlyn MacDonald (4096103) | `data/botify-exports/kaitlyn-macdonald/chats/4c….json` (117 messages) |
| `GC` | group: Mary Thorne (3472620), Noctis Veil (4080268), Kaitlyn MacDonald (4096103), Sister Lucia (4095850) | `data/botify-exports/_group-chats/chats/518affe6….json` (479 messages) |

The `GC` thread is the group chat canon's provenance names as the story's
primary source and the only thread in which Noctis Veil appears; the three
private chats never mention the Vestment, the Order's relics, or Noctis. Per
operator instruction the four chats are kept as separate threads, not
blended: each is its own timeline under its own thread code, for later
analysis and synthesis.

In `GC` every message opens with a bold speaker label from the export
(`**Mary Thorne:**`, `**Noctis Veil:**`, and so on; the operator's own turns
are labelled `**Operator:**`). The label names the **bot
account**, not always the character: the Mary Thorne account writes Sister
Lucia's half of the garden and window-seat scenes (`#0088`-`#0201`) and her
entrance at `#0324`; the
Sister Lucia account itself first speaks at `#0229`. Scenes where the label
and the speaker part ways are flagged
`SPEAKER_LABELS_ARE_BOT_ACCOUNTS_NOT_CHARACTERS`. The labels are extraction
metadata inside the hashed body, not source prose.

{N_SCENES} scenes were cut on 2026-09-02 (index in [`_index.md`](_index.md));
the manifest holds {N_MANIFEST} entries.

## Read this first: the source's framing versus canon's ratifications

Canon's provenance ratifies St. Lucia's as an **adult collegiate institution**
and **every potentially sexualised participant as an adult**, and says the
source's "identity bleed involving an operator-associated priest/teacher/father
role is not canon and was not retained." The `MT` thread is exactly that
material: the operator plays **"Father Yeager"**, a priest who teaches Mary's
class, and the prose is framed as a school (uniforms and ties, a class that
giggles, parents at home, "Catholic schoolgirl", and at `#0368` "your body is
going through a lot of changes"). The source never states Mary's age; the only
ages it states are Sophia's (nineteen) and the novice's (about nineteen).
Every `MT` scene with that framing carries
`SCHOOL_FRAMING_IN_SOURCE_CANON_RATIFIES_ADULT_COLLEGE`, and a renderer must
read the prose under canon's ratification (Mary is 19, St. Lucia's is a
college), not the other way round.

The same operator identity appears as a **visitor named "Carl Yeager"** in
`SL`, as the **new head of IT, "Carl Yeager"**, in `KM`, and as the convent's
**new gardener, "Mr. Yeager"**, in `GC` (Kaitlyn's fantasy object from
`#0410`, and the operator's only turns in that thread, `#0453`-`#0477`). Canon
has none of these roles. As with Brass & Nerve and The Adjustment Protocol, the prose is
kept verbatim and every affected scene is flagged
(`OPERATOR_REAL_NAME_AS_FATHER_YEAGER_ROLE_NOT_CANON`,
`…_AS_VISITOR_CARL_YEAGER…`, `…_AS_HEAD_OF_IT_CARL_YEAGER…`,
`…_AS_THE_GARDENER_MR_YEAGER…`); whether to
substitute before any promotion, export, or rendering is the same open
operator decision, and until it is made these files must not leave `drafts/`.
Here the excluded role is the `MT` thread's second lead across the whole
thread, not a stray line.

## Invented delineators

Botify chats carry no scene headers, so the boundaries are the operator-approved
rule from the Blackwood Case extraction: a new scene starts where the story
**changes place, jumps in time, or the cast changes**. Play-session gaps are
not boundaries. Ranges are contiguous. Bare `Continue` turns and blank bot
messages are dropped from bodies and counted. Two operator turns are pure
instructions to the bot (`MT #0303` "describe the two women…", `SL #0144`
"craft a response from the novice…"); they are dropped from bodies and listed
in `source_directive_turns`. Turns that mix prose with an `/OOC:` instruction
(`MT #0700`, `#0710`) are kept verbatim and flagged. Two bot lines end in the
model artifact `<|user|>` (`SL #0046`, `#0147`); they are kept verbatim and
flagged `TOKEN_ARTIFACT_IN_BOT_TEXT`.

## Four threads, four timelines

The threads do not share a calendar, so the catalog key carries the thread
(`NV-MT-…`, `NV-SL-…`, `NV-KM-…`, `NV-GC-…`) and each thread's own story day is in
`timeline_anchor`. Nothing connects the threads on the page except the
college, and `KM` calls it Saint Brigid's. `GC` is the only thread with the
relic: Mary finds it in the chapel, it feeds on blood and essence and grants
strength, and its black-and-violet strapped ensemble matches canon's
description; its Sister Lucia is a recent postulant who danced naked in the
graveyard, its convent tolerates trysts, and its Mother Superior is rumoured
to have had a bishop (none of which canon holds).

## Names: played versus canon

| Played in the source | Canon |
|---|---|
| Amelia (brunette, "pushes" sensations into Mary's head) | Amelia Ward (telekinetic episodes) |
| Sister Beatrice, Sister Margaret | Sister Beatrice Quill, Sister Margaret Hale |
| Sister Anastasia, Novice Sophia (nineteen) | Sister Anastasia Vey, Sister Sophia Bell (22) |
| the sisters' chamber beneath the college | the Magdalene Sanctum |
| Sister Lucia (Spanish, "over a decade" a nun) | Sister Lucia Navarro (30) |
| the Mother Superior | Mother Celestine Arnaud |
| Saint Brigid's (`KM`) | St. Lucia's College and Convent |
| "Mary Worthington" (`MT #0503`-`#0507`), "Mary Elizabeth" | Mary Thorne |
| Candace Van Houten, Tina Lovelace, Mr. Thorne, the unnamed novice, Aoife, Sister Therese, Sister Mary Clare, Mrs. Higgins, Father O'Malley | not in canon |

Other flagged differences carried as flags rather than fixed: Mary's eyes are
blue almost everywhere (canon: deep brown), Mary lives at a family estate on
Day 1 and in a campus room on Day 3, Kaitlyn once asks to be called "Sister
Kaitlyn" (canon: a student), and Candace's eye colour changes. The `MT`
thread's Candace shares only a first name with The Adjustment Protocol's
Candace Raines; canon's cross-story guardrail applies.

## Mature and coercion content

Most `MT`, all `SL`, and half the `GC` scenes are flagged `MATURE_CONTENT`; many `MT` scenes
also carry `NONCONSENT_OR_COERCION_CONTENT` (the phantom touch in class, the
hallway stripping, the sisters' tests, the sanctum). Route accordingly; canon
reframes involuntary response and institutional power with explicit agency
logic, and nothing here changes that.
""",
)

NOCTIS = "Noctis Veil (the living garment; the Noctis Veil bot account)"
GARDENER_FLAG = "OPERATOR_REAL_NAME_AS_THE_GARDENER_MR_YEAGER_ROLE_NOT_CANON"
SPEAKERS = "SPEAKER_LABELS_ARE_BOT_ACCOUNTS_NOT_CHARACTERS"
GARDENER = "'Carl Yeager', the convent's new gardener (the operator's own name; the operator's only turns in the thread; canon's provenance excludes operator-associated roles)"

GC = dict(
    code="GC", label="\"Mary and Noctis Veil\" group chat (bots 3472620 Mary Thorne, 4080268 Noctis Veil, 4096103 Kaitlyn MacDonald, 4095850 Sister Lucia; chat 518affe6\u2026)", group=True,
    bot_dir="data/botify-exports/_group-chats/", export="518affe6", story_end=478,
    played="the thread was played 2025-10-22..27 almost entirely by the bot accounts talking to each other (467 of 479 messages); the operator's twelve turns are all the gardener at #0453-#0477",
    days="1: the chapel, the dormitory; 2-7: the week after, summarised; 7: the garden, the window seat; 8: the gardens, evening prayers, the corridor, Mary's room, Kaitlyn's room; ~12: the days after, the garden, lights-out",
    pov="Botify group chat: four bot accounts write their own characters in third person and sometimes each other's (the Mary Thorne account writes Sister Lucia's half of #0088-#0201 and her entrance at #0324; the Sister Lucia account itself first speaks at #0229); the operator plays the gardener 'Carl Yeager' in first person at #0453-#0477 only, labelled Operator; every message carries its export speaker label",
    participants_basis="rule-derived from the prose, read under the speaker labels (which name the bot account, not always the character speaking); the gardener is the operator's own name in a role canon's provenance excludes; verify before relying on it",
    scenes=[
        ("NV-GC-01-CHP", "Someone... or Something", 0, 1, "CHP", "Day 1, night: the empty chapel; the relic wakes and feeds",
         [MARY, NOCTIS],
         [MATURE, NONCON, "BOT_ONLY_EXCHANGE_NO_OPERATOR_TURNS", "NOCTIS_FEEDS_ON_BLOOD_AND_ESSENCE_MATCHES_CANON_RELIC", "BLACK_AND_VIOLET_GARMENT_MATCHES_CANON",
          "MARY_FINDING_THE_RELIC_IS_ONLY_STATED_LATER_AT_0083", "NOCTIS_OFFERS_ENHANCED_STRENGTH_SPEED_HEALING_AT_0037"]),
        ("NV-GC-02-DRM", "The Drab Nightgown", 48, 1, "DRM", "Day 1, night into 3:47 AM: the walk back, the third-floor room, the mirror, the closet",
         [MARY, NOCTIS],
         [MATURE, SCHOOL, "MARY_POOR_VISION_WITHOUT_GLASSES_AT_0002_MATCHES_CANON", "NOCTIS_GOES_SILENT_0075_0082", "ADAMS_APPLE_LINE_AT_0058_IS_A_BOT_SLIP"]),
        ("NV-GC-03-CMP", "A Mask of Normality", 83, 2, "CMP", "Day 2 morning, then the rest of the week, summarised",
         [MARY],
         [SCHOOL, "SUMMARISED_DAYS_0086_0087", "FINDING_THE_RELIC_MENTIONED_AT_0083"]),
        ("NV-GC-04-GDN", "Mind If I Join You", 88, 7, "GDN", "Day 7, lunch: the cloister garden; Sister Lucia's rebel youth",
         [MARY, LUCIA],
         [SPEAKERS, "MARY_THORNE_ACCOUNT_VOICES_SISTER_LUCIA_THROUGHOUT", "LUCIA_DANCED_NAKED_IN_THE_GRAVEYARD_BACKSTORY_NOT_IN_CANON", "LUCIA_SPANISH_ENDEARMENTS_MATCH_CANON_NAVARRO"]),
        ("NV-GC-05-DRM", "Secrets of the Holy House", 117, 7, "DRM", "Day 7, night: the window seat; Noctis on the Mother Superior; a knock",
         [MARY, NOCTIS],
         ["MOTHER_SUPERIOR_AND_BISHOP_RUMOUR_NOT_IN_CANON", "MOTHER_SUPERIOR_UNNAMED_CANON_MOTHER_CELESTINE_ARNAUD"]),
        ("NV-GC-06-DRM", "Lessons at the Window Seat", 126, 7, "DRM", "Day 7, night: Sister Lucia in Mary's room",
         [MARY, LUCIA, NOCTIS + " (from the closet)"],
         [MATURE, SPEAKERS, "MARY_THORNE_ACCOUNT_VOICES_SISTER_LUCIA_THROUGHOUT_0126_0201", "FIRST_KISS_MARY_LUCIA_AT_0149", "SISTER_THERESE_NOT_IN_CANON",
          "CLOISTER_TRYSTS_COMMON_MOTHER_SUPERIOR_BLIND_EYE_AT_0155_0157_NOT_IN_CANON", "CONTINUITY_SLIP_DAWN_AT_0196_THEN_NIGHT_RESUMES_AT_0197"]),
        ("NV-GC-07-DRM", "Bound in the Deepest of Ways", 202, 7, "DRM", "Day 7, later that night: Noctis and Mary alone",
         [MARY, NOCTIS],
         [MATURE, "NOCTIS_SAYS_MARYS_PASSIONS_SUSTAIN_IT_MATCHES_CANON"]),
        ("NV-GC-08-GDN", "Did You Sleep Well", 228, 8, "GDN", "Day 8, morning: the chapel gardens; the rest of the day summarised",
         [MARY, LUCIA],
         ["SISTER_LUCIA_ACCOUNT_FIRST_SPEAKS_AT_0229", "SUMMARISED_DAY_AT_0239"]),
        ("NV-GC-09-CHP", "Evening Prayers", 240, 8, "CHP", "Day 8, evening prayers: Kaitlyn notices",
         [MARY, KAITLYN],
         [SCHOOL, "KAITLYN_EMERALD_EYES_FRECKLES_RED_HAIR_MATCH_CANON", "KAITLYN_CALLED_FELLOW_NOVICE_AT_0241", "NEW_EX_MILITARY_GARDENER_INTRODUCED_AT_0257_NAMED_MR_YEAGER_AT_0410"]),
        ("NV-GC-10-HAL", "The Altar Cloths", 271, 8, "HAL", "Day 8, evening: the corridor to the chapel; Kaitlyn carries Sister Lucia's basket",
         [KAITLYN, LUCIA],
         ["LUCIA_NOTES_TWO_YOUNG_WOMEN_IN_ONE_DAY_AT_0293"]),
        ("NV-GC-11-DRM", "Best Friends Become Lovers", 294, 8, "DRM", "Day 8, night: Mary's room; Noctis worn again; the feeding and the blood offering",
         [MARY, NOCTIS],
         [MATURE, "NOCTIS_ENSEMBLE_STRAPS_GARTERS_GLOVES_NEAR_CANON_DESCRIPTION", "BLOOD_OFFERING_RITUAL_AT_0312", "IMAGE_ONLY_MESSAGE_0302_UNARCHIVED"]),
        ("NV-GC-12-DRM", "You Weren't Ready", 324, 8, "DRM", "Day 8, night: Sister Lucia checks on Mary",
         [MARY, LUCIA, NOCTIS + " (worn, hidden)"],
         [SPEAKERS, "MARY_THORNE_ACCOUNT_VOICES_SISTER_LUCIA_AT_0324", "LUCIA_APOLOGISES_FOR_THE_WINDOW_SEAT_AT_0327"]),
        ("NV-GC-13-KMR", "I Crave You", 343, 8, "KMR", "Day 8, late night: Kaitlyn's room; the confession; Kaitlyn's first time",
         [MARY, KAITLYN, NOCTIS + " (worn, whispering)"],
         [MATURE, NONCON, "NOCTIS_DIRECTS_MARY_ON_PAGE", "KAITLYN_FIRST_ORGASM_AT_0386", "KAITLYNS_BORROWED_MENS_SHIRT_DETAIL_AT_0345"]),
        ("NV-GC-14-KMR", "Plowing Furrows", 390, 8, "KMR", "Day 8, late night, continued: Kaitlyn tastes; the gardener fantasy; the hallway after",
         [MARY, KAITLYN, NOCTIS + " (worn)"],
         [MATURE, GARDENER_FLAG, "KAITLYN_FANTASISES_THE_GARDENER_ON_PAGE_0410_0426", "KITKAT_NICKNAME_AT_0440", "MARY_DOMINANT_PERSONA_SHIFT", "HALLWAY_CODA_0449_0450"]),
        ("NV-GC-15-GDN", "A White Rose", 451, 12, "GDN", "The days after, summarised; one afternoon: the garden; the gardener and Kaitlyn",
         [KAITLYN, GARDENER],
         [GARDENER_FLAG, SCHOOL, "SUMMARISED_DAYS_0451_0452", "FIRST_OPERATOR_TURN_AT_0453", "KAITLYN_GRADUATING_SOON_AT_0457", "STAFF_FRATERNISATION_FROWNED_ON_AT_0471", "KAITLYN_ASKS_THE_GARDENER_OUT"]),
        ("NV-GC-16-KMR", "Open Up", 478, 12, "KMR", "That evening, after lights-out: Kaitlyn's door",
         [MARY],
         ["SINGLE_MESSAGE_SCENE", "STORY_ENDS_MID_SCENE_AT_0478"]),
    ],
)

CHATS = [MT, SL, KM, GC]
