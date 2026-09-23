# Local playtest revision — September 16, 2026

Authorized by Jason's #local after clarification. No commit or deployment. Preserve existing controls, art, sounds and campaign data except explicitly requested replacements.

## Checklist

- [x] Hold while unstationed.
- [x] Actual doorway mesh crossing.
- [x] Persistent Toggle Console preference; Combat View turns it off.
- [x] Unknown Object Detected!! pulsing red banner and short alarm.
- [x] Out-of-range hex scan +5, warning and range circle; adjacent hex results. Life Scan automatic in range, difficulty 15 outside.
- [x] Latest notification OK dismisses earlier notifications.
- [x] Explain guaranteed/impossible scans when dice are skipped.
- [x] Remove previous movement line after course change.
- [x] Green shield ring on named starmap ships; readable shield HP.
- [x] Reveal actual roll difficulties with large bold pulsing values.
- [x] Missile damage opens owner-only shared dice, with multiplied displayed result.
- [x] Locked component choices for every eligible weapon including missiles.
- [x] AU/Exertion weapon dice mismatch and retry recovery.
- [x] Repair drones visible in Combat ship view.
- [x] No Cancel on required to-hit/damage rolls.
- [x] Reset undoes the last action, preserving other state.
- [x] Interior console SIC stations; direct operation reduces input/processing by 10%. EXT-only weapons remain remote.
- [x] Bulk weapon facing, individually reject illegal rotations.
- [x] Nutrition top display shows dispensed flavor combination.
- [x] Conscious oxygen sufferers retain movement and Life Support recovery actions.
- [x] Character defeat uses a sad tone rather than slash sound.
- [x] Carry 0-HP characters from the same square, normal movement speed.
- [x] Medbay revision and card: five-minute 0-HP death deadline, 60-second revival preparation, then 1 HP/3 seconds; living patients heal immediately at that rate. Deadline continues during preparation. Combat time pauses with ATB.
- [x] Warp Drive Zero/X in the numbered drive purchasing stack.
- [x] Scan timing considers successful detections only; multiple successes use the highest successful difficulty, no success retains base delay unless all attempted checks critically fail.

All requested changes are implemented locally. This pass supersedes older notes describing hidden difficulties, fixed difficulty-10 scan timing, no Sensors/Lock-On stations, the former Medbay dice/supply rules, and destructive Reset behavior.

## Validation and final decisions

### Decisions made without another question

- Out-of-range Life Scan uses difficulty **15** (base 10 plus the requested 5). In-range Life Scan remains automatic. Both scans cover the chosen hex and its six neighbors.
- For scan timing, use the highest difficulty among successful detections. Ignore failed targets when anything succeeds. With no successes, retain the base input time unless every attempted check critically fails; then double it. The existing margin and critical-success formula remains unchanged.
- Carrying uses normal walking speed. Pickup/drop does not spend an additional ATB action; combat turn and unfinished-action restrictions still apply. The patient is released on revival or carrier incapacitation. This covers existing onboard movement; intership boarding remains a future mechanic.
- Medbay preparation takes 60 seconds, then its first 1 HP arrives three seconds later (**63 seconds total**). At 300 seconds without positive HP, death wins any timing tie. Leaving the room or losing working medical power interrupts preparation. Impaired/unpowered Medbays cannot heal. Existing mechanical-crew exclusion is retained.
- The new Medbay replaces the old Umbrexium consumption, manual healing dice and treatment lock. Existing stored records are preserved, but obsolete treatment jobs no longer block play. Ordinary care runs automatically while the patient is physically inside the room.
- NPC ship-roll Exertion defaults to one point when older NPC records lack that resource, matching the dice interface's previous default. Confirmed rolls consume it once; duplicate submissions do not.
- Shield HP is displayed to one decimal place, with unnecessary trailing zeroes removed. Actual HP retains its precision.
- For older weapons with joined interior/exterior layouts, bulk rotation first separates the sections only when every interior cell and station remains identical. Any rotation that violates placement rules is skipped individually.

### Recovery and preservation

Reset now restores the encounter snapshot immediately before its last successful action, including pending rolls and Exertion. Failed requests and repeated roll receipts do not overwrite that checkpoint. End Combat remains separate. Undoing a roll reopens the same required dice prompt automatically. Reset is one action deep; its checkpoint is kept in server memory, so after a server restart it reports that no previous action is available rather than destroying the encounter. It restores the saved encounter moment, including its timer values.

Required combat rolls cannot be cancelled or escaped away. Loading and submission retries remain available. Optional VR training can still be closed without spending its daily award. Missile prompts belong to the firing player or GM-controlled NPC; the GM retains explicit takeover for player rolls. Damage displays its multiplier before confirmation and is applied once.

Toggle Console remembers the character's preference and selected console across stations and reloads. Leaving a station temporarily shows movement without switching that preference off; Combat View turns it off. Out-of-combat ship controls use the same Toggle Console wording.

A failed oxygen check with HP remaining was verified to allow Move and leave the character conscious. The historical screenshot's exact lost-button state was not reproducible; no new incapacitation rule was invented. A stationed character still uses **Leave Console** to choose a walking destination.

The defeat sound is now a short descending three-note tone and retains mute controls. It was checked in code; subjective listening quality is still for Jason to judge.

### Verification

Final validation: **all 436 automated tests passed**. All **15 Chrome browser suites** below passed; the combat-recovery suite was rerun after fixing restored-roll reopening. Whitespace checks and syntax checks for all 212 JavaScript/test/script files passed. All isolated test servers exited. Personal campaign storage remains untouched (last modification September 6, 2026).

Real Chrome playtests used disposable local campaigns, including independent GM/PC views:

| Coverage | Browser suites |
| --- | --- |
| Weapons, targeting, physical dice, multiplied missiles, owner/reload/retry recovery, Reset | `playtest-weapon-clock`, `playtest-component-targeting`, `playtest-missiles`, `playtest-missile-damage-recovery`, `playtest-combat-recovery`, `playtest-revision-npc-dice` |
| Unstationed Hold, natural ATB progression, ship construction/details/movement | `playtest-held-turn`, `playtest-ship-workflows` |
| Out-of-range Life Scan, visible difficulty, range warning/circle, real doorway walking, console preference, detection timing/pulse | `playtest-sensors`, `playtest-roll-timing` |
| Medbay, VR preservation, carrying/revival, legal/illegal bulk rotation, Warp family stack, notification dismissal | `playtest-crew-rooms`, `playtest-revision-ui` |
| Combat-interior repair drone, unknown/detection/activity banners, contrast, nutrition flavor and sound controls | `playtest-drone-alerts`, `playtest-pass2-ui`, `playtest-decent-utilities` |

The map component check confirms the old course path is replaced and the shield ring pulses; it uses controlled map state rather than a full second flight. Medical unit/HTTP tests cover the five-minute deadline, power/impairment, pause/resume, large time advances and restart persistence. The NPC regression actually rolls Rapid Laser 4 dice with Exertion in Chrome, submits successfully, and clicks GM Reset to restore that roll without clearing the ships.

Screenshots were reviewed for the multiplied missile result, Medbay patient preparation, Combat-interior drone and sensor interface. Browser artifacts and logs are in ignored `test-artifacts/`.

Everything stays local. No commit, GitHub push, deployment, personal campaign edit or Gold Standard change. Existing unrelated work is retained. Remaining limitations: undo history does not survive a server restart; intership carrying awaits boarding rules; the exact historical oxygen-button state could not be recreated.
