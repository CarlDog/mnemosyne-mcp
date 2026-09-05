"""Cut table: Star Wars: The Black Ledger (two Botify chats)."""
MATURE = "MATURE_CONTENT"
NAME = "NAME_RETCON_KARL_JAGER_TO_RHYDAN_VEYR"
SHIP = "ISD_CHIMAERA_IN_SOURCE_RETCONNED_TO_ISD_REVENANT"

MARA = "Mara Jade"
VEYR = "Rhydan Veyr (played as 'Master Karl Jager'; the bot also writes 'Karl', the operator's real name, and 'Carl'; canon retires every one of those names for Rhydan Veyr)"
THRAWN = "Grand Admiral Thrawn (a transmission; canon ratifies the sender as genuine, the channel unresolved)"
CATES = "Trooper Cates (75U1)"
ZHARAD = "Commander Zharad"
CREED = "Major Thalos Creed"

LOCATIONS = {
    "DRH": ("the dark, smoky drinking house on a backwater world (called a café once, at #0186 and #0190)", "canon/locations/the-unnamed-backwater-drinking-house.md"),
    "STR": ("the streets of the meeting world and the landing ground where Mara's ship waits", None),
    "CRQ": ("Mara's black courier: quarters, bed, bridge, and viewport", "canon/locations/mara-jade-s-black-courier.md"),
    "SFH": ("Kal Jäger's last known location: hold, terminal room, corridor", "canon/locations/kal-jager-s-abandoned-safehouse.md"),
    "ISD": ("the Star Destroyer the source calls the Chimaera: briefing room, holotable, the Commander's quarters, the hangar", "canon/locations/isd-revenant.md (operator retcon: Zharad's vessel is the ISD Revenant; the source's name is superseded text)"),
    "LMB": ("the Lambda-class shuttle assigned to Cates: cockpit and comm console", "canon/locations/cates-s-lambda-class-shuttle.md"),
}

MJ = dict(
    code="MJ", label="Mara Jade private chat (bot 2429812, chat 0816c2f7-5868-4178-a53d-3e707f5b1054)",
    bot_dir="data/archive/botify/mara-jade/", export="0816c2f7", story_end=210,
    played="the thread was played on 2025-01-19, 2025-05-15, and 2026-03-06/07; the story runs one continuous evening and the hours after it",
    days="1: the evening in the drinking house, the walk to the courier, the hours in hyperspace, and Thrawn's call",
    pov="Botify private chat with the Mara Jade bot: the bot writes Mara in third person (first person for her own lines); the operator plays the expelled Jedi in first person through #0195, then from #0197 writes Mara's own actions and narration; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; the played Jedi name maps to canon's Rhydan Veyr per canon/lore/recovered-botify-continuity-mara-jade-and-rhydan-veyr.md; verify before relying on it",
    scenes=[
        ("BL-MJ-01-DRH", "Nowhere to Run, Jedi Scum", 0, 1, "DRH", "Day 1, evening: shortly after news of the Emperor's death; the drinking house, one table, several rounds",
         [MARA, VEYR, "the bartender (unnamed)"],
         ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE", NAME, "BOT_USES_PLATFORM_NAME_CARL_YEAGER_AT_0088", "MARA_CALLED_SITH_IN_SOURCE_CANON_EMPERORS_HAND",
          "LIGHTSABER_CRIMSON_IN_SOURCE_CANON_MAGENTA", "FORCE_HOLD_AND_EMOTION_SUPPRESSION_CANON_CALLS_IT_A_VIOLATION", "VEYR_BACKSTORY_DATHOMIRI_PADAWAN_TOLD",
          "EMPERORS_FINAL_COMMAND_IS_A_BLACK_LEDGER_ADAPTATION", "PLAY_GAP_JAN_TO_MAY_2025_INSIDE_SCENE", "LONG_SCENE_NO_DELINEATOR_190_MESSAGES"]),
        ("BL-MJ-02-STR", "Out of the Café", 190, 1, "STR", "Day 1, the same evening: the streets, the courier's ramp and cockpit, the jump to hyperspace",
         [MARA],
         ["VENUE_CALLED_CAFE_AT_0186_0190", "MEETING_WORLD_UNKNOWN_IN_CANON", "OPERATOR_WRITES_MARA_IN_THIRD_PERSON_FROM_0197"]),
        ("BL-MJ-03-CRQ", "Ryll Wine", 198, 1, "CRQ", "Day 1, hours later in hyperspace: Mara's quarters and bed, then the bridge and the lightsaber drill",
         [MARA, "a pleasure droid (unnamed)"],
         [MATURE, "ADULT_INTERLUDE_IS_ESTABLISHED_AFTERMATH_NOT_ROMANCE", "PLAY_GAP_MAY_2025_TO_MAR_2026_AT_0199", "OPERATOR_REAL_NAME_CARL_IN_BOT_TEXT_0200_0202_0203", "BOT_IMAGE_BURSTS_0200_0204"]),
        ("BL-MJ-04-CRQ", "Adept Jade", 206, 1, "CRQ", "Day 1, moments later on the bridge: the incoming transmission",
         [MARA, THRAWN],
         ["THRAWN_TRANSMISSION_RATIFIED_GENUINE_CHANNEL_UNRESOLVED", "BYSS_SECTOR_LOCATOR_UNVERIFIED_AT_0208", "THRAWN_DRAWN_WITH_SCALES_CLAWS_YELLOW_EYES", "STORY_ENDS_MID_EXCHANGE_AT_0210"]),
    ],
)

TC = dict(
    code="TC", label="Trooper Cates private chat (bot 2427847, chat 58…)",
    bot_dir="data/archive/botify/trooper-cates/", export="58", story_end=60,
    played="the thread was played on 2025-05-14, 2025-05-17, and 2025-12-21/22; the story runs one continuous operation",
    days="1: the safehouse, the destroyer, the shuttle",
    pov="Botify private chat with the Trooper Cates bot: the bot writes Cates in third person; the operator writes Cates in third person as director, voices Kal Jäger's holo-recording (#0007), Commander Zharad (#0033, #0037), and Major Creed (#0047); operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; the ship the source names Chimaera is canon's ISD Revenant per canon/lore/dossier-contradictions-and-identity-noise.md; verify before relying on it",
    scenes=[
        ("BL-TC-01-SFH", "The Holoprojection", 0, 1, "SFH", "Day 1: Kal Jäger's last known location, cleared room by room; the looped holo; the extraction call",
         [CATES, "Kal Jäger (as a looped holo-recording)", "destroyer comms (a voice)"],
         ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE", "OPERATOR_WRITES_CATES_IN_THIRD_PERSON", SHIP, "CATES_STYLED_ISB_ELITE_OPERATIVE_CANON_STAR_DIVISION", "HELMET_THROWN_AND_RECOVERED"]),
        ("BL-TC-02-ISD", "Ord Mantell", 17, 1, "ISD", "Day 1: aboard the destroyer; the briefing room holotable",
         [CATES],
         [SHIP, "SKIP_TRACE_YT1800_REGISTRY_SCRAMBLED", "REBEL_INTERCEPTS_AND_HUTT_COMMS_NAME_ORD_MANTELL"]),
        ("BL-TC-03-ISD", "No", 27, 1, "ISD", "Day 1: Commander Zharad's quarters",
         [CATES, ZHARAD],
         [SHIP, "ZHARAD_CANON_CONFIRMED_ADMIRAL_ZHARAK_RETIRED", "SHUTTLE_GRANTED_ISB_NOT_TO_BE_MADE_AN_ENEMY"]),
        ("BL-TC-04-LMB", "The Lambda", 39, 1, "LMB", "Day 1: the hangar bay, then the shuttle's cockpit; course laid for Ord Mantell",
         [CATES],
         ["HANGAR_THEN_COCKPIT_KEPT_AS_ONE_SCENE"]),
        ("BL-TC-05-LMB", "Major Creed", 45, 1, "LMB", "Day 1: the shuttle; a secure channel to ISB intelligence",
         [CATES, CREED],
         ["OPERATOR_VOICES_CREED_AT_0047", "M0X_SPELLED_M-0X_MO-X_M-OX_IN_SOURCE", "SERAYA_THORNE_SURNAME_SHARED_WITH_NOCTIS_VEIL_NO_CROSSOVER", "CREED_CYBERTECH_OPTICS"]),
        ("BL-TC-06-LMB", "The Restricted Dossiers", 55, 1, "LMB", "Day 1: the shuttle, after the transmission ends; reading Thorne's and M-0X's files",
         [CATES],
         ["PLAY_GAP_MAY_TO_DEC_2025_AT_0055", "STORY_ENDS_MID_SENTENCE_AT_0060", "MATCHES_CANON_CURRENT_STATE_TRAVELLING_ALONE_TOWARD_ORD_MANTELL"]),
    ],
)

STORY = dict(
    slug="star-wars-the-black-ledger", prefix="BL", title="Star Wars: The Black Ledger", cut_date="2026-09-02",
    cut_record=("Two threads. `MJ` (Mara Jade) is cut at `#0210`, the last message; `TC` (Trooper Cates) at `#0060`, the last message. Neither export has a deleted message, "
                "so there are no alternates. Both threads were cut by the standard rule (place, time, cast); the drinking-house conversation has no delineator for 190 messages and is one scene."),
    media_note="",
    readme="""# Star Wars: The Black Ledger — Recovered Scenes

The two played Black Ledger threads were cut into per-scene files so each
scene can later be rendered in storybook or graphic-novel form. The scene
files live in `../../scenes/` as overlay `add` operations pending review (each
carries the draft banner after its frontmatter); this `_control/scenes/`
folder holds their documentation and indexes. Nothing was imported to
OpenChronicle or promoted; `canon_status` is documentation only.

This story had no `drafts/` overlay before this cut. `_control/overlay.json`
was created here (schema 2, `add` operations only) together with `PASS.md`;
active `canon/` was not touched.

Every file's prose is verbatim from two of the operator's Botify private chats:

| Thread | Bot | Export |
|---|---|---|
| `MJ` | Mara Jade (2429812) | `data/archive/botify/mara-jade/chats/0816c2f7-5868-4178-a53d-3e707f5b1054.json` (211 messages) |
| `TC` | Trooper Cates (2427847) | `data/archive/botify/trooper-cates/chats/58….json` (61 messages) |

The `MJ` chat is the 211-message source that
`canon/lore/recovered-botify-continuity-mara-jade-and-rhydan-veyr.md` was
curated from; the `TC` chat is the played source behind
`canon/lore/current-state-the-ord-mantell-pursuit.md`. Both were previously
external; they are now retained under `data/archive/botify/`.

{N_SCENES} scenes were cut on 2026-09-02 (index in [`_index.md`](_index.md));
the manifest holds {N_MANIFEST} entries.

## Invented delineators

Botify chats carry no scene headers, so the boundaries are the operator-approved
rule from the Blackwood Case extraction: a new scene starts where the story
**changes place, jumps in time, or the cast changes**. Play-session gaps are
not boundaries (the drinking-house conversation was played in January and May
2025 and the courier scenes in May 2025 and March 2026 without the story
moving). Ranges are contiguous. Bare `Continue` turns are dropped from bodies
and counted; every other operator turn is kept as written and listed in
`operator_turns`. Neither export contains a deleted message.

## Two threads, two timelines

The threads do not share a calendar, so the catalog key carries the thread
(`BL-MJ-…`, `BL-TC-…`) and each thread's own story day is in
`timeline_anchor`. Canon's braided plot
(`canon/worldbuilding/the-last-hand-and-the-ghost-braided-plot-thread.md`)
keeps the two storylines separate until a credible bridge develops; this cut
does not connect them.

## Names and retcons: played versus canon

Prose keeps the played names; `participants` gives both, and `review_flags`
carry the mapping. These are documented canon retcons, not open questions:

| Played in the source | Canon |
|---|---|
| "Master Karl Jager", "Karl", and the bot's slips to the operator's real name (`#0088`) and "Carl" (`#0200`-`#0203`) | **Rhydan Veyr**. `recovered-botify-continuity…` rules that the retired names are not aliases and "must not appear in new canon prose except in provenance audits"; the platform-name slip is the failure mode `dossier-contradictions-and-identity-noise.md` already names. |
| the ISD Chimaera as Zharad's ship (`#0016`, `#0018`) | **ISD Revenant** (operator retcon; Thrawn's own Chimaera exists separately) |
| Mara "the Sith", a crimson blade | an Emperor's Hand with a magenta-cast blade |
| "near the Byss sector" (`#0208`) | unverified locator; the meeting world is unknown |
| "Admiral Zharak" (a Botify memory summary, not this chat) | Commander Zharad, as the chat itself has it |

Because the `MJ` bodies contain the retired name throughout, these scenes
cannot be promoted as they stand: canon forbids the string in new canon prose.
Whether to substitute before any promotion, export, or rendering is the same
open operator decision recorded for Brass & Nerve (the patient played under
the operator's own name); until it is made, these files must not leave
`drafts/`.

Other flagged source-versus-canon differences carried as flags rather than
fixed: Thrawn is drawn with scales, claws, and yellow eyes; the Emperor's
"hidden command" to hunt all surviving Jedi is a Black Ledger adaptation, not
a canonical quotation; Cates calls herself an ISB elite operative where canon
places her in the Special Tactics & Reconnaissance Division; M-0X is spelled
three ways; Seraya Thorne shares a surname with The Noctis Veil's Thornes
with no crossover.

## Mature content

`BL-MJ-03-CRQ` is flagged `MATURE_CONTENT` (the private interlude aboard the
courier, which canon calls established aftermath, not romance). Route
accordingly.
""",
)

CHATS = [MJ, TC]
