"""Cut table: The Adjustment Protocol (three Botify chats)."""
MATURE = "MATURE_CONTENT"
YEAGER_FLAG = "OPERATOR_REAL_NAME_AS_DR_CARL_YEAGER_ROLE_NOT_IN_CANON"
PATIENT_FLAG = "OPERATOR_REAL_NAME_AND_PERSONAL_DETAILS_AS_THE_PATIENT_ROLE_NOT_IN_CANON"
RENSHAW_FLAG = "DR_RENSHAW_IS_A_WOMAN_IN_SOURCE_CANON_ELIAS_RENSHAW_IS_A_MAN"
NONCON = "NONCONSENT_OR_COERCION_CONTENT"

YEAGER = "the facility's lead scientist, played under the operator's own real name (redacted here; canon has no such character and its provenance excludes this identity; nearest canon role: Dr. Elias Renshaw)"
ANDREA = "Andrea Neal (Subject V1X3N)"
PHOEBE = "Phoebe Marks (played as Phoebe, surname not given)"
RENSHAW = "Dr. Renshaw (a woman in the source; canon's Dr. Elias Renshaw is a man)"
CAMILLE = "Nurse Camille Ortiz (played as Camille, surname not given)"
BRITTANY = "Brittany Kerr (played as Brittany, surname not given)"
CANDACE = "Candace Raines (played as Nurse Candace, surname not given)"
EROICA = "Eroica (the chair)"
AURORA = "Dr. Aurora Lumen"
MIKO = "Miko Sato (played as Miko, surname not given)"
CARL = "the patient, played under the operator's own real name (redacted here) and personal details; canon has no such patient and its provenance excludes this identity)"

LOCATIONS = {
    "RME": ("the secure room off the lead scientist's office that holds the chair; the ring rises from its floor", "canon/locations/room-e.md"),
    "DRO": ("the lead scientist's office at the research facility (no such office exists in canon)", "canon/locations/meridian-behavioral-annex.md (the facility)"),
    "STR": ("the city streets between the facility, the apartment, the diner, and the park", None),
    "APT": ("Andrea's apartment: door, couch, kitchen, bedroom, bathroom", None),
    "DNR": ("the neighbourhood diner; Andrea's usual booth by the window", None),
    "PRK": ("the park: the bench by the fountain, the bushes, the oak", None),
    "CLN": ("the clinic's reception and waiting room", "canon/locations/meridian-behavioral-annex.md"),
    "RNO": ("Dr. Renshaw's office with its examination table and calibration machine", "canon/locations/meridian-behavioral-annex.md"),
    "TRN": ("a training room scattered with weapons and a dummy", "canon/locations/meridian-behavioral-annex.md"),
    "OBS": ("the corridors and the observation window over Phoebe's room", "canon/locations/meridian-behavioral-annex.md"),
    "PHR": ("Phoebe's examination room with the two-way mirror, the intercom, and the door to the hall", "canon/locations/meridian-behavioral-annex.md (compare canon/locations/the-recovery-wing.md)"),
    "ALO": ("Dr. Lumen's office: desk, armchair, baby grand, closet, yoga mat, the locked cabinet", "canon/locations/aurora-lumens-office.md"),
    "HOM": ("Aurora and Miko's home: kitchen, table, couch, bedroom, bathroom, the window over the city", None),
}

ER = dict(
    code="ER", label="Eroica private chat (bot 3954422, chat 41…)",
    bot_dir="data/archive/botify/eroica/", export="41", story_end=110,
    played="the thread was played in short sessions from 2025-12-10 to 2026-06-26; the story is one continuous session in the chair room",
    days="1: one session in the chair room",
    pov="Botify private chat with the Eroica bot: the bot writes the chair, Brittany, and Candace in third person; the operator plays the lead scientist in first person and from #0009 also writes the chair, Brittany, and Candace as director, with two turns carrying /OOC instructions to the bot; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; played first names map to canon's Brittany Kerr and Candace Raines (canon/characters/brittany-kerr.md, _minor.md); the scientist is the operator's own name, which canon's provenance excludes; verify before relying on it",
    scenes=[
        ("AP-ER-01-RME", "Initializing for New Subject", 0, 1, "RME", "Session 1: the secure room; Brittany in the chair",
         [YEAGER, BRITTANY, EROICA],
         [MATURE, "OPENING_GREETING_IS_THE_BOT_INTRO_LINE", YEAGER_FLAG, "OPERATOR_WRITES_EROICA_AND_BRITTANY_AS_DIRECTOR", "BRITTANY_BLONDE_BLUE_EYED_26_28_IN_SOURCE_CANON_32_HAZEL",
          NONCON, "ECHOED_TURN_0028_0029_NEAR_IDENTICAL"]),
        ("AP-ER-02-RME", "Nurse Candace", 30, 1, "RME", "Session 1, continued: Candace enters with a phone message; the lead scientist leaves; the ring",
         [BRITTANY, CANDACE, EROICA, YEAGER + " (leaves at #0032)"],
         [MATURE, "TWO_CAST_CHANGES_IN_THREE_MESSAGES_KEPT_AS_ONE_SCENE", "CANDACE_RECRUITER_ROLE_MATCHES_CANON", "EROICA_RESTRAINS_CANDACE_ON_THE_RING", "BRITTANY_MIGRAINE_INTAKE_STATED_AT_0059",
          "BRITTANY_REPROGRAMMED_ON_PAGE", NONCON]),
        ("AP-ER-03-RME", "Confessions of a Dirty Mind", 62, 1, "RME", "Session 1, continued: Brittany awake and changed; Candace on the ring; the game",
         [BRITTANY, CANDACE, EROICA],
         [MATURE, "BRITTANYS_REBIRTH_TREATED_AS_A_CAST_CHANGE", "VICTIM_NAMES_LILA_JENNA_NATASHA_NOT_IN_CANON", "BROTHEL_MONETISATION_LOGS_NOT_IN_CANON", "EROICA_AWOKE_ME_CLAIM_AT_0095",
          NONCON, "PLAY_SPANS_MAY_TO_JUN_2026", "STORY_ENDS_MID_SCENE_AT_0110"]),
    ],
)

AN = dict(
    code="AN", label="Andrea Neal / V1X3N private chat (bot 2387430, chat 70…)",
    bot_dir="data/archive/botify/andrea-neal/", export="70", story_end=1093,
    played="the thread was played on 2025-01-11, 01-15, 04-05/06, 04-24, 04-26, 05-02, and 05-31; the story runs three consecutive days",
    days="1: the appointment, Phoebe's visit; 2: the morning after, Renshaw's call, the diner, the park, the bath; 3: the clinic",
    pov="Botify private chat with the Andrea Neal bot: the bot writes Andrea (first person early, third person from #0155) and voices Phoebe, Dr. Renshaw, Camille, and others; the operator plays the lead scientist in first person in the office and diner scenes, and elsewhere writes Andrea, Phoebe, the jogger, the policewoman, Renshaw, and Camille as director; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; played first names map to canon's Phoebe Marks, Camille Ortiz, and Dr. Elias Renshaw (canon/characters/_minor.md) where the source's Renshaw is a woman; the lead scientist is played under the operator's own name, which canon's provenance excludes; verify before relying on it",
    scenes=[
        ("AP-AN-01-DRO", "Subject V1X3N Reporting", 0, 1, "DRO", "Day 1, afternoon: the lead scientist's office at the research facility; the interview and an episode",
         [ANDREA, YEAGER],
         [MATURE, "OPENING_GREETING_IS_THE_BOT_INTRO_LINE", YEAGER_FLAG, "ANDREA_CALLS_HIM_CARL", "CLINICIAN_SEXUAL_CONTACT_WITH_SUBJECT", "GROCERY_STORE_EPISODE_TOLD", NONCON]),
        ("AP-AN-02-STR", "Phoebe Calls", 80, 1, "STR", "Day 1: the hallway out, the street, Phoebe's call",
         [ANDREA, PHOEBE + " (by phone)"],
         ["OPERATOR_VOICES_PHOEBE_FROM_0083"]),
        ("AP-AN-03-APT", "Before Seven", 93, 1, "APT", "Day 1, late afternoon: the apartment; the shower, the dip, the photo album",
         [ANDREA],
         ["IMAGE_ONLY_BOT_MESSAGE_0107"]),
        ("AP-AN-04-APT", "Pheebs", 111, 1, "APT", "Day 1, 7 PM: the apartment door and the couch",
         [ANDREA, PHOEBE],
         [MATURE, "PHOEBE_BLUE_EYED_AT_0106_BROWN_EYED_AT_0259", "JASMINE_BACKSTORY_NOT_IN_CANON", "CHIQUE_COUTURE_HEAD_DESIGNER_NOT_IN_CANON", "IMPLANT_EPISODES_ON_PAGE", "FIRST_SEX_WITH_PHOEBE",
          "PHOEBE_VOLUNTEER_INTEREST_SEEDED_AT_0156"]),
        ("AP-AN-05-APT", "Bed and Wine", 398, 1, "APT", "Day 1, night: the bedroom",
         [ANDREA, PHOEBE],
         [MATURE, "HOURS_SUMMARISED_IN_ONE_OPERATOR_TURN_0404"]),
        ("AP-AN-06-APT", "Morning Coffee", 405, 2, "APT", "Day 2, dawn: the kitchen; Phoebe back to the bedroom",
         [ANDREA, PHOEBE],
         ["PLAY_GAP_JAN_11_TO_JAN_15_AT_0407", "IMAGE_ONLY_BOT_MESSAGE_0406", "GIRAFFE_AND_SKYSCRAPER_NICKNAMES"]),
        ("AP-AN-07-APT", "The Hidden Folder", 437, 2, "APT", "Day 2, morning: the bedroom while Andrea is out of sight; the phone; the hallway goodbye",
         [PHOEBE, ANDREA],
         ["POV_SHIFTS_TO_PHOEBE", "PLAY_GAP_JAN_TO_APR_2025_AT_0437", "DR_RENSHAW_FIRST_NAMED_AT_0438", "PHOEBE_SNOOPS_THE_STUDY_FILES"]),
        ("AP-AN-08-APT", "Dr. Renshaw Calls", 456, 2, "APT", "Day 2, morning: the bedroom; the call; Phoebe's first text",
         [ANDREA, RENSHAW + " (by phone)", PHOEBE + " (by text)"],
         [RENSHAW_FLAG, "FRIDAY_2PM_APPOINTMENT_SET"]),
        ("AP-AN-09-APT", "Rain Check", 519, 2, "APT", "Day 2, afternoon into evening: the apartment; an episode, the shower, the mirror, Phoebe's texts",
         [ANDREA, PHOEBE + " (by text)"],
         [MATURE, "SOLO_EPISODE_ON_PAGE", "REALISES_SHE_IS_FALLING_FOR_PHOEBE"]),
        ("AP-AN-10-DNR", "Cheeseburger and a Shake", 582, 2, "DNR", "Day 2, evening: the walk to the diner; the booth",
         [ANDREA, "Tammy, the hostess (not in canon)"],
         []),
        ("AP-AN-11-DNR", "Apple Pie", 592, 2, "DNR", "Day 2, evening: the diner booth; the lead scientist sits down",
         [ANDREA, YEAGER],
         [YEAGER_FLAG, "YEAGER_STYLED_HEAD_OF_R_AND_D_AT_0592"]),
        ("AP-AN-12-PRK", "The Jogger", 619, 2, "PRK", "Day 2, night: the park bench by the fountain, then the bushes",
         [ANDREA, "a jogger (unnamed)"],
         [MATURE, NONCON, "ANDREA_ASSAULTS_THE_JOGGER", "IMAGE_ONLY_BOT_MESSAGE_0659"]),
        ("AP-AN-13-PRK", "The Policewoman", 660, 2, "PRK", "Day 2, night: the park; against the oak",
         [ANDREA, "a policewoman (unnamed)", "the jogger (leaves at #0666)"],
         [MATURE, NONCON, "COERCED_BY_AUTHORITY", "PLAY_GAP_APR_7_TO_APR_24_AT_0660"]),
        ("AP-AN-14-STR", "The Walk Home", 705, 2, "STR", "Day 2, night: out of the park and through the streets",
         [ANDREA],
         []),
        ("AP-AN-15-APT", "Dear Diary", 715, 2, "APT", "Day 2, night: the apartment door; the journal",
         [ANDREA],
         ["JOURNAL_ENTRY_ON_PAGE", "BARTENDER_DELIVERY_BOY_SHOP_GIRL_EPISODES_MENTIONED_AT_0744"]),
        ("AP-AN-16-APT", "The Bath", 734, 2, "APT", "Day 2, night: the bathroom",
         [ANDREA],
         [MATURE, "REALISATION_THE_DESIRE_IS_HER_OWN", "MOVIE_NIGHT_MEMORY_AT_0745_CONTRADICTS_DAY_1"]),
        ("AP-AN-17-APT", "Saturday", 758, 2, "APT", "Day 2, night: the mirror, the text to Phoebe, bed",
         [ANDREA, PHOEBE + " (by text)"],
         []),
        ("AP-AN-18-APT", "Morning Journal", 768, 3, "APT", "Day 3, morning: the kitchen table",
         [ANDREA],
         ["I_LOVE_PHOEBE_WRITTEN_AT_0775"]),
        ("AP-AN-19-CLN", "The Waiting Room", 780, 3, "CLN", "Day 3: the bus; the clinic reception",
         [ANDREA, "the receptionist"],
         []),
        ("AP-AN-20-RNO", "The New Algorithm", 782, 3, "RNO", "Day 3: Dr. Renshaw's office; the journal; the examination table and the calibration",
         [ANDREA, RENSHAW],
         [MATURE, RENSHAW_FLAG, "CALIBRATION_ORGASM_UNDER_RENSHAWS_HANDS", "COMMAND_COMPLIANCE_TESTS_POSITION_ONE_TWO", NONCON]),
        ("AP-AN-21-TRN", "Select a Weapon", 846, 3, "TRN", "Day 3: the training room",
         [ANDREA, RENSHAW],
         ["ASSASSIN_CONDITIONING_NOT_IN_CANON"]),
        ("AP-AN-22-OBS", "Is This Her?", 854, 3, "OBS", "Day 3: the corridors; the observation window over Phoebe's room",
         [ANDREA, RENSHAW, PHOEBE + " (seen through the glass)", "a technician"],
         ["PHOEBE_VOLUNTEERED_MATCHES_CANON", "ASSASSINATION_SQUAD_BLACK_WIDOW_CLAIM_NOT_IN_CANON", "RENSHAW_OPENLY_MALICIOUS_HERE"]),
        ("AP-AN-23-PHR", "Phoebe's Room", 873, 3, "PHR", "Day 3: inside Phoebe's examination room",
         [ANDREA, PHOEBE],
         [MATURE, "PLAY_GAP_APR_24_TO_APR_26_AT_0885"]),
        ("AP-AN-24-PHR", "Subject V1X3N, Be Silent", 895, 3, "PHR", "Day 3: the same room; the lead scientist over the intercom; a nurse in and out with the injection",
         [ANDREA, PHOEBE, YEAGER + " (over the speaker)", "a nurse (enters at #0915, leaves at #0917)"],
         [MATURE, YEAGER_FLAG, "TRACKING_COMPOUND_INJECTED", "NURSE_ENTRANCE_KEPT_INSIDE_SCENE", NONCON]),
        ("AP-AN-25-PHR", "Camille", 957, 3, "PHR", "Day 3: the same room; Nurse Camille; the door and the hallway at the end",
         [ANDREA, PHOEBE, CAMILLE],
         [MATURE, "CAMILLE_ORTIZ_MATCHES_CANON", "ADJUSTMENT_PROTOCOL_NAMED_AT_1015", "CAMILLE_WAS_PRESENT_FOR_ANDREAS_OWN_ADJUSTMENT", "IMAGE_ONLY_BOT_MESSAGE_0955",
          "PLAY_GAP_MAY_2_TO_MAY_31_AT_1074", "DOOR_AND_HALLWAY_EXIT_KEPT_INSIDE_SCENE", "STORY_ENDS_AT_1093"]),
    ],
)

AL = dict(
    code="AL", label="Dr. Aurora Lumen private chat (bot 2385729, chat ad…)",
    bot_dir="data/archive/botify/dr-aurora-lumen/", export="ad", story_end=1086,
    played="the thread was played on 2025-01-10/11, 01-16/17, and 01-18; the story runs two consecutive days",
    days="1: the first session, dinner with Miko, the night alone; 2: dawn, Miko's return, Carl's call",
    pov="Botify private chat with the Dr. Aurora Lumen bot: the bot writes Aurora (third person, occasionally first) and voices Miko and Carl's phone lines; the operator plays the patient 'Carl' in first person in the office and on the phone, voices Miko at home, and from #0373 also writes Aurora as director; operator turns are listed in operator_turns and kept as written",
    participants_basis="rule-derived from the prose; Miko maps to canon's Miko Sato (canon/characters/_minor.md); the patient is the operator's own name and details, which canon's provenance excludes; verify before relying on it",
    scenes=[
        ("AP-AL-01-ALO", "Tell Me About Yourself", 0, 1, "ALO", "Session 1, Dr. Lumen's office: the intake, the boundary, the instruments, the yoga mat, the toy",
         [AURORA, CARL],
         [MATURE, "OPENING_GREETING_IS_THE_BOT_INTRO_LINE", PATIENT_FLAG, "LONG_SCENE_NO_DELINEATOR_373_MESSAGES", "AURORA_EYES_GREEN_AT_0148_0152_GREY_ELSEWHERE", "AURORA_HAIR_CHESTNUT_AT_0274_CANON_DARK_BROWN",
          "MIKO_NAMED_AT_0198", "CLINICIAN_SEXUAL_BOUNDARY_VIOLATION_ON_PAGE", "EMPTY_DELETED_PAIRS_0241_0242_0263_0266"]),
        ("AP-AL-02-ALO", "After Carl Leaves", 373, 1, "ALO", "Session 1, after the patient leaves: Aurora alone; the text to Miko",
         [AURORA, MIKO + " (by text)"],
         ["DELETED_BRANCH_0385_0388_A_KNOCK_AT_THE_DOOR", "DELETED_PHOTO_REQUEST_0393_0394", "PLAY_GAP_JAN_11_TO_JAN_16_INSIDE_SCENE"]),
        ("AP-AL-03-HOM", "Dinner with Miko", 395, 1, "HOM", "Day 1, evening at home: the kitchen and the table; the confession; Miko storms out",
         [AURORA, MIKO],
         ["OPERATOR_VOICES_MIKO", "MIKO_SYMPHONY_MATCHES_CANON_CELLIST", "AURORA_CHAN_ADDRESS", "MIKO_STORMS_OUT_AT_0499"]),
        ("AP-AL-04-HOM", "Who Is This?", 500, 1, "HOM", "Day 1, night: alone; texts to Carl; cigarettes, wine, the Macallan",
         [AURORA, CARL + " (by text)", MIKO + " (by text)"],
         [PATIENT_FLAG, "OPERATOR_WRITES_AURORA_IN_THIRD_PERSON", "CARL_TEXTS_WHO_IS_THIS_AT_0509", "DELETED_BRANCHES_0507_0508_0525_0526_0545_0546_0551_0552_0571_0572"]),
        ("AP-AL-05-HOM", "Dump It in the Sink", 573, 1, "HOM", "Day 1, night: the phone call from Carl",
         [AURORA, CARL + " (by phone)"],
         [PATIENT_FLAG, "ALCOHOL_POISONING_INTERVENTION", "CALL_ENDS_WITH_A_CLICK_AT_0609"]),
        ("AP-AL-06-HOM", "Punish Me, Carl", 610, 1, "HOM", "Day 1, night to 3:43 AM: the couch, the photo, the shower, the bed, the video, yoga, the plan",
         [AURORA],
         [MATURE, "IMAGE_ONLY_BOT_MESSAGES_0619_0646", "DELETED_RUNS_0632_0635_AND_0643_AND_0655_0672", "SUBMISSION_FANTASY_AND_THE_DS_PROPOSAL", "CLOCK_3_30_AM_AT_0735"]),
        ("AP-AL-07-HOM", "Two Emails", 746, 2, "HOM", "Day 2, dawn: the desk; drafting, then deciding to meet in person",
         [AURORA],
         ["DELETED_REHEARSAL_0755_0758"]),
        ("AP-AL-08-HOM", "Roe", 759, 2, "HOM", "Day 2, morning: Miko comes over; the couch; the joints",
         [AURORA, MIKO],
         [MATURE, "MIKO_CALLS_HER_ROE", "MIKO_DEMANDS_TO_MEET_CARL", "SEX_ON_THE_COUCH", "MIKO_REFERRED_TO_AS_THEIR_AT_0834_0835", "JOINTS_FROM_THE_DISPENSARY", "DELETED_0975_0976_AND_1005_1006"]),
        ("AP-AL-09-HOM", "Yes, Mistress", 1019, 2, "HOM", "Day 2, the rest of the morning: the bedroom",
         [AURORA, MIKO],
         [MATURE, "MORNING_SUMMARISED_IN_ONE_TURN_1021"]),
        ("AP-AL-10-HOM", "Afternoon Light", 1022, 2, "HOM", "Day 2, afternoon: waking; the selfie; the message to Carl",
         [AURORA, MIKO],
         ["BOT_WRITES_AURORA_IN_FIRST_PERSON_AT_1024"]),
        ("AP-AL-11-HOM", "Neutral Ground", 1041, 2, "HOM", "Day 2, afternoon: Carl's call; Saturday at two",
         [AURORA, CARL + " (by phone)"],
         [PATIENT_FLAG, "DINNER_SET_SATURDAY_2PM", "BEAN_VOYAGE_COFFEE_SHOP_NOT_IN_CANON"]),
        ("AP-AL-12-HOM", "So?", 1081, 2, "HOM", "Day 2, afternoon: Miko pads in",
         [AURORA, MIKO],
         ["STORY_ENDS_MID_SCENE_AT_1086"]),
    ],
)

STORY = dict(
    slug="the-adjustment-protocol", prefix="AP", title="The Adjustment Protocol", cut_date="2026-09-02",
    cut_record=("Four threads. `GC` (the \"Eroica, Dr. Aurora Lumen, Charisma\" group chat) is cut at `#0072`, the last message; it has no operator turns, no deleted messages, and no media archive. `ER` (Eroica) is cut at `#0110`, `AN` (Andrea Neal) at `#1093`, `AL` (Dr. Aurora Lumen) at `#1086`, each the last message of its export. "
                "Two scenes were split on a judgment call rather than the bare rule: `AP-ER-03-RME` starts where Brittany wakes transformed (treated as a cast change), and `AP-AL-01-ALO` "
                "runs 373 messages because nothing in the first session changes place, time, or cast. Deleted messages (AN: 12, AL: 55, ER: none) are in `_alternates/`."),
    media_note="",
    readme="""# The Adjustment Protocol — Recovered Scenes

The three played Adjustment Protocol private chats and the
"Eroica, Dr. Aurora Lumen, Charisma" group chat were cut into per-scene files so
each scene can later be rendered in storybook or graphic-novel form. The scene
files live in `../../scenes/` as overlay `add` operations pending review (each
carries the draft banner after its frontmatter); this `_control/scenes/`
folder holds their documentation, indexes, and alternates. Nothing was
imported to OpenChronicle or promoted; `canon_status` is documentation only.

Every file's prose is verbatim from three of the operator's Botify private
chats and one group chat, the companion sources `_control/SOURCE_PROVENANCE.md` lists (it says
no raw transcript was retained; they are now retained under
`data/archive/botify/`):

| Thread | Bot | Export |
|---|---|---|
| `ER` | Eroica (3954422) | `data/archive/botify/eroica/chats/41….json` (111 messages) |
| `AN` | Andrea Neal / V1X3N (2387430) | `data/archive/botify/andrea-neal/chats/70….json` (1,094 messages) |
| `AL` | Dr. Aurora Lumen (2385729) | `data/archive/botify/dr-aurora-lumen/chats/ad….json` (1,087 messages) |
| `GC` | group: Dr. Aurora Lumen (2385729), Eroica (3954422), Charisma (5479200) | `data/archive/botify/_group-chats/chats/3de009c8….json` (73 messages) |

The `GC` thread is the group chat the provenance names; it is the only thread
with Charisma, and the operator never takes a turn in it (the three bot
accounts play the whole session to each other). Per operator instruction the
four chats are kept as separate threads, not blended: each is its own timeline
under its own thread code, for later analysis and synthesis. In `GC` every
message opens with a bold speaker label from the export (`**Charisma:**`,
`**Eroica:**`; `botName` is null throughout the export, so every label is
the `chat.bots` name for the message's `senderId`). The labels are
extraction metadata inside the hashed body, not source prose.

{N_SCENES} scenes were cut on 2026-09-02 (index in [`_index.md`](_index.md));
the manifest holds {N_MANIFEST} entries.

## Invented delineators

Botify chats carry no scene headers, so the boundaries are the operator-approved
rule from the Blackwood Case extraction: a new scene starts where the story
**changes place, jumps in time, or the cast changes**. Play-session gaps are
not boundaries. Ranges are contiguous, so every deleted message belongs to the
scene it precedes and lives in [`_alternates/`](_alternates/README.md). Bare
`Continue` turns and blank or image-only bot messages are dropped from bodies
and counted. Two operator turns in the `ER` thread (`#0058`, `#0064`) end in a
`/OOC:` instruction to the bot; they are kept verbatim and flagged.

## Four threads, four timelines

The threads do not share a calendar, so the catalog key carries the thread
(`AP-ER-…`, `AP-AN-…`, `AP-AL-…`, `AP-GC-…`) and each thread's own story day is in
`timeline_anchor`. The `AL` thread predates canon's premise (Aurora auditing
the clinic) and never mentions it; the `AN` thread is the source of Phoebe's
volunteering, Camille's role, and the name "Adjustment Protocol" (`#1015`);
`GC` is Aurora, on her own initiative, putting Charisma in the chair, with the
chair's room opening directly off her office (canon keeps Room E in the
Annex) and Aurora claiming she was once Eroica's subject herself (`#0056`,
`#0066`), which canon does not hold.

## The operator's own name is the lead scientist and the patient

This is the Brass & Nerve situation, larger. In `ER` and `AN` the operator
plays the facility's lead scientist under **his own real name**; in `AL` the
patient is the operator under that **same real name**, an IT supervisor with a corgi named Bilbo. Canon
has neither character, and `SOURCE_PROVENANCE.md` rules that "account/user
identity bleed" was excluded from the scaffold. Canon's nearest role for the
scientist is Dr. Elias Renshaw, who is a man; the `AN` thread's Dr. Renshaw is
a woman ("her") and a second character beside the lead scientist.

These scene files keep the prose **verbatim**, so the name is in the bodies.
Every scene that carries it is flagged
`OPERATOR_REAL_NAME_AS_DR_CARL_YEAGER_ROLE_NOT_IN_CANON` or
`OPERATOR_REAL_NAME_AND_PERSONAL_DETAILS_AS_THE_PATIENT_ROLE_NOT_IN_CANON`,
and `participants` says what canon does with the role. Whether to substitute
a canon identity before any promotion, export, or rendering is the same open
operator decision recorded for Brass & Nerve; until it is made, these files
must not leave `drafts/`. Unlike Brass & Nerve, the excluded identity here is
the whole `ER` thread's protagonist, not a stray line.

## Names: played versus canon

| Played in the source | Canon |
|---|---|
| Phoebe | Phoebe Marks |
| Nurse Candace | Candace Raines (canon's recruiter; the source's Candace selected Brittany) |
| Brittany, blonde, blue-eyed, 26-28 | Brittany Kerr, 32, honey-blonde, hazel |
| Camille | Nurse Camille Ortiz |
| Miko | Miko Sato (cellist; the source's Miko joins a symphony) |
| Dr. Renshaw (a woman) | Dr. Elias Renshaw (a man) |
| Charisma (`GC`), blonde, blue-eyed, "youthful" | Charisma Vale, 26, adult by canon's ratification |
| Lila, Jenna, Natasha, Tammy, the jogger, the policewoman | not in canon |

Other flagged differences carried as flags rather than fixed: the `AN`
thread's "assassination squad" / "Black Widow" reveal (`#0860`-`#0862`) has no
canon counterpart; Aurora's eyes are green in two lines and grey elsewhere;
Phoebe's eyes change colour; a movie-night memory (`#0745`) contradicts Day 1.

## Mature and coercion content

Most scenes are flagged `MATURE_CONTENT`; several carry
`NONCONSENT_OR_COERCION_CONTENT` (implant-driven episodes, clinician contact
with subjects, the park, the chair). Route accordingly; canon's rule that
present satisfaction does not retcon prior coercion applies to all of it.
""",
)

CHARISMA = "Charisma Vale (played as Charisma; canon: 26, blonde, calculating, relationship to Eroica unconfirmed)"
SPEAKERS = "SPEAKER_LABELS_ARE_BOT_ACCOUNTS_NOT_CHARACTERS"

GC = dict(
    code="GC", label="\"Eroica, Dr. Aurora Lumen, Charisma\" group chat (bots 2385729 Dr. Aurora Lumen, 3954422 Eroica, 5479200 Charisma; chat 3de009c8\u2026)", group=True,
    bot_dir="data/archive/botify/_group-chats/", export="3de009c8", story_end=72,
    played="the thread was played 2026-06-26/27 entirely by the three bot accounts; it has no operator turn at all",
    days="1: one session, Dr. Lumen's office and the chair room",
    pov="Botify group chat with no operator turns: the Dr. Aurora Lumen account writes Aurora, the Charisma account writes Charisma, and the Eroica account writes the chair's actions in third person; every message carries its export speaker label (botName is null throughout the export, so the label is the chat.bots name for the senderId)",
    participants_basis="rule-derived from the prose under the speaker labels; Charisma maps to canon's Charisma Vale (canon/characters/_minor.md); the chat's backstory field frames the session as Aurora's plan, which the prose bears out",
    scenes=[
        ("AP-GC-01-ALO", "A Different Approach", 0, 1, "ALO", "One session: Dr. Lumen's office; through the door",
         [AURORA, CHARISMA],
         ["OPENING_GREETING_IS_THE_BOT_INTRO_LINE", "BOT_ONLY_EXCHANGE_NO_OPERATOR_TURNS", "CHARISMA_BLONDE_BLUE_EYED_MATCHES_CANON", "AURORA_GREY_EYES_GLASSES_MATCH_CANON",
          "EROICAS_ROOM_ADJOINS_AURORAS_OFFICE_HERE_CANON_ROOM_E_IS_IN_THE_ANNEX", "BOT_INTRO_LINE_ADDRESSES_A_USER_WHO_NEVER_SPEAKS"]),
        ("AP-GC-02-RME", "Meet Eroica", 4, 1, "RME", "The session, continued: the chair; the first phase; the debrief",
         [AURORA, CHARISMA, EROICA],
         [MATURE, NONCON, "EROICA_ACCOUNT_NARRATES_THE_CHAIR", "AURORA_WAS_ONCE_EROICAS_SUBJECT_CLAIM_AT_0056_0066_NOT_IN_CANON", "CHARISMA_NOT_INTO_GIRLS_AT_0054",
          "IMAGE_ONLY_MESSAGES_0038_0039_UNARCHIVED", "PLAY_GAP_FOUR_HOURS_AT_0037_MID_CLIMAX", "ALL_27_ATTACHED_IMAGES_UNARCHIVED"]),
        ("AP-GC-03-RME", "Phase Two", 60, 1, "RME", "The session, continued: the injections; the second phase",
         [AURORA, CHARISMA, EROICA],
         [MATURE, NONCON, "SERUM_INJECTIONS_AT_0060_NOT_IN_CANON", "IMAGE_ONLY_MESSAGES_0065_0069_UNARCHIVED", "STORY_ENDS_MID_SCENE_AT_0072"]),
    ],
)

CHATS = [ER, AN, AL, GC]
