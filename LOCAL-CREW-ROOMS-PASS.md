# Local Crew Rooms Pass

September 14, 2026. Authorized by the VR Training Room, Medbay, Library, Meeting Room and Ship AI request ending in #local. No commit, push, Render use, personal campaign edits or Gold Standard changes.

## Added

- Five purchasable SICs with source prices, EN, security, size, crafting and impairment information; distinct original top-down floorplan artwork; installed-card and ship-capability entries.
- VR Training Room: two stations, named/custom simulations, safety-protocol setting and manual D4 daily skill training. Requires working Life Support, oxygen and gravity. Out of combat only.
- Medbay: one station, Umbrexium stock loading, patient selection, visible treatment progress, cancellation, manual healing and impaired-room adjudication. Patients must be physically in the room. Works in and out of combat.
- Library: two stations, shared local research archive, search, completion markers and GM-confirmed information-node updates. Out of combat only; unavailable when impaired. The AI does not ingest or memorize the archive.
- Meeting Room: four stations, shared private crew briefings and an agenda checklist. Out of combat only. Records persist, and only the author or GM can delete an entry.
- Ship AI: bridge add-on and configuration/ship-assessment console. A GM-controlled digital crewmember occupies a free bridge station, uses ordinary earned ship actions and manual rolls, and reports bridge intrusion. Standby never displaces physical crew or blocks encounter setup. It is not an online chatbot and requires no external subscription.

Existing ships are not automatically rebuilt to fit these large rooms. Purchase and place them through SICs; use their local room stations through the PC Starships interface. Ship AI is reached through the bridge. The small existing Explore ships and personal campaigns retain their layouts.

## Sources And Digital Choices

Read SIC_Series_A.pdf pages/cards A-83, A-84, A-85, A-86 and A-89, the extracted source text, and the relevant core timing. Medbay source page was also rendered and inspected.

- Core SA20210516PDF_ADV4.pdf PDF page 26 / printed 12L defines a CvC round as approximately eight seconds. Medbay therefore takes eight active seconds; its ten-round recovery window is 80 seconds. This does not change the existing SvS clocks, sensor processing or movement conversion. These are unleveled rooms, so no SIC-level reduction was invented.
- One Umbrexium gives 30 uses. One use is spent when treatment starts, with no refund on cancellation. Normal healing is manual 3D6; a patient below 1 HP uses manual 1D6. The patient must still be within the recovery window when treatment finishes. Restoring power, valid location and patient state is checked again while waiting.
- An impaired Medbay requests a manual D4. A 1 replaces normal recovery with a GM-decided consequence; the GM enters HP loss, or zero for a narrative consequence. Other results proceed to normal manual healing. Players cannot cancel away an already-required GM consequence. Androids and digital AI cannot receive biological healing.
- Treatment uses active combat time or real time outside combat. In combat, pending healing/adjudication freezes ATB and decision clocks. Global recovery controls survive a closed console, reload, removed operator and restart; GM takeover owns subsequent rolls. A restarted server still retains its normal deliberate GM pause.
- VR awards 1-4 tenths to one base skill below 2.0, once per character per campaign day. Campaign days are 1,440 minutes advanced by the GM, not local computer dates. Eligibility is tested before the gain, so 1.9 plus four tenths becomes 2.3. No XP is charged. Impaired VR training is blocked; unsafe/glitchy simulation consequences remain GM narration rather than automatic damage.
- The added station counts are interface choices requested by the user, not printed card counts. VR, Library, Meeting Room and Medbay require physical room access; an occupied bridge does not remotely grant them. Hacking a bridge does not expose these private crew-service records.
- Ship AI has all eight attribute pools at 2D6 and supported skills at 1.0. ATB speed is 5%/second: four filled Intellect boxes plus Initiative 1.0, following the existing character formula. It cannot leave its bridge station and is excluded from oxygen and biological Life Scans. Its internal actor HP sentinel is not presented as a biological HP pool. Ordinary NPCs retain all existing editing controls.
- Library information nodes are narrative locations, not yet objects in the navigation model. The GM confirms a node update; the local archive is crew-entered research, not a fabricated complete galactic encyclopedia. Meeting Room does not add voice chat or combat modifiers.

## Reliability Fixes

- Fixed the character-sheet HP baseline after a clean external update. Without this, receiving healing and later saving/navigating could apply the same healing again.
- A stale Medbay malfunction submission cannot be reused as the next healing roll. Completed treatment cannot award HP twice.
- Restore patient-treatment flags before readiness checks. Cancel invalid waits after power loss, destruction, patient departure or full recovery. Protect unconscious patients in Medbay from the ordinary NPC cleanup timer.
- Cap incapacitation tracking after its recovery window; avoid endless full campaign broadcasts for an unconscious character.
- Persist NPC recovery as well as PC HP, and keep room state through construction, preparation and encounter saves.
- Close room consoles cleanly even while their initial data request is delayed. Disable room inputs until that request succeeds. Keep the medical scan animation within its display and use compact readable record checkboxes.
- A late campaign snapshot cannot dismiss an entered healing roll merely because its pending-roll list is behind the combat stream. Close automatically only for an explicitly settled/cancelled treatment; the server still validates the submitted stage and controller.
- Ship AI standby removes its active turn without regenerating the actor on the next snapshot; unavailable AI clears pending ship waits. Its fixed stats are displayed honestly rather than through generic NPC attribute conversion.

## Verification

- 350 automated tests pass. New unit tests cover catalog/stations, local access, daily training and replay protection, room records, supplies, conscious/unconscious healing, impairment, wrong-controller rejection, recovery serialization, power interruption and AI station behavior.
- New HTTP test uses an ordinary room code, real active-clock Medbay treatment, explicit GM ownership, frozen ATB, server restart, stale-result rejection, single healing, resumed NPC ATB and AI standby from an active turn.
- New Chrome mouse test purchases and places all five SICs, uses actual PC stations, custom simulation input and manual training, archives/searches records, checks briefing items, resolves OOC and combat healing after closing the console, keeps a separate GM view, and checks AI settings. It also checks training/HP after later navigation, delayed initial-load closure and laptop/mobile layouts.
- Existing Chrome held-turn, weapon-clock, ship-workflows, live-hacking, missile and mouse-audit regression scripts pass. Fixture setup uses isolated API-created/restored campaigns; these are focused workflows, not a multi-session campaign or every possible multiplayer interleaving.
- 84 root JavaScript syntax checks pass. Gold Standard structural audit retains all original files, non-intentionally-replaced HTML IDs and map controls. No whitespace errors from git diff --check.
- Screenshots and logs are in ignored test-artifacts/crew-rooms. Browsers/test servers are closed after each test.

Fresh preview: http://127.0.0.1:8800/showcase.html. GM entry: http://127.0.0.1:8800/gm.html. Preview PID 24328 uses isolated C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-crew-rooms-20260914 data. Chrome verified fresh Explore opens on Script with no page errors. Older preview processes were left alone.
