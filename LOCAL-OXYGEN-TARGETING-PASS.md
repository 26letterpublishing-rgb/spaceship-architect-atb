# Local Oxygen, Targeting And Presentation Pass

September 13, 2026. Local implementation only. No commit, push, Render traffic, Gold Standard edits, or personal campaign edits. Earlier authorized local changes remain in the working tree.

## Completed

- Oxygen shutoff has the approved 165-second grace period, then each character's own breath reserve: (Health D10 count + floored Athletics/Endurance) x 32 seconds. Health + Endurance checks start at 14, increase by 4, and recur after 16 seconds on success. Failure immediately loses 5 HP, then repeats every 16 seconds until breathing resumes or HP reaches zero/below. Unconscious characters stop losing oxygen HP. Androids are exempt.
- Out of combat, the server advances real time. In combat, oxygen follows authoritative combat time, including pauses and slowed command-expiry time. Manual oxygen checks pause progression. GM sees all affected crew; PCs receive only their own timer/check and ship grace. No dice are rolled automatically.
- Oxygen checks support cancellation/reopening, explicit result feedback, GM resolution, retry-safe submissions, and simultaneous pending checks. Restoring oxygen cancels the hazard without healing. Destroyed ships clear orphaned checks. Unconsciousness cancels affected pending actions without erasing a deliberate GM pause.
- Timers survive preparation, ending combat, backups and server restart. Restart does not simulate offline elapsed time. A background encounter save no longer replaces unchanged campaign ship records with an older cloned copy, which could overwrite a just-applied utility setting.
- Life Support oxygen controls work outside combat. The console and capabilities reflect oxygen-off state. The timer panel remains above native console dialogs. Preview frames own their console feedback and no longer fight over another frame's console or display an active GM ATB pause outside combat.
- Explore Features opens the GM Script tab without combat active. Existing Prepare Combat and demo reset remain available.
- PC movement during combat stays on the full Starships sheet. It uses the shared mesh route planner, current turn identity, server movement validation, ordinary action timing, station occupancy and synchronized moving markers. Out-of-combat free movement remains intact.
- Completed Systems Analysis is retained in a per-target knowledge cache independent of the bounded activity/report feed. Legacy analysis reports migrate into it. Share Data carries the latest snapshot. Targeting cannot acquire hidden components from the live ship; it uses the analyzed inventory and gives distinct analysis/ship-lock/shield/offline prerequisite messages.
- Specific-SIC targeting and impairment damage were playtested through the actual player console. Saved impairment points are preserved during encounter normalization. All shared floorplans show red impairment pulses: 2.8, 1.8 and 1 seconds for one, two and three points. Destroyed SICs are distinct; reduced motion uses a steady warning.
- Darkveil market cards now use all ten distinct grade images already present in the asset catalog, instead of the same hard-coded floorplan image.
- Exterior equipment artwork is nudged against its actual hull-facing edge using measured opaque image bounds. Gray mount cones are removed. Placement, collision, stations, hull cost and legal footprints are unchanged. Shared thruster direction and both map resolutions remain supported.
- NUT dispenses a texture-dependent blob above its puddle. Clicking Eat Paste removes the blob, leaves the puddle, plays a short synthesized chewing effect when unmuted, and displays "Tastes like chicken". Silky, thick and chunky are visibly different. This is synthesized audio, not a human voice recording.

## Verification

Full automated suite: 243 passing tests. All 135 JS/CJS files passed syntax checking at the final broad check. Focused oxygen tests include exact boundaries, simultaneous requests, receipt replay, privacy, no healing, Androids, destroyed ships, unconsciousness and serialization. The new HTTP test uses a separate saved campaign and a real server restart; it verifies timer transfer, HP persistence, an explicit GM pause, and natural ATB recovery.

Actual Chrome workflows exercised:

- `playtest-oxygen.cjs`: real PC oxygen toggle, timer visible over Life Support, private breath reserve, manual Health/Endurance submission, Cancel/reopen, GM takeover, explicit pass/fail result, oxygen restoration, and all three edible paste textures.
- `playtest-large-map-combat.cjs`: click Move on the embedded full sheet, select an exact mesh destination, confirm a server-owned timed action, watch the moving marker, and arrive without leaving Starships.
- `playtest-component-targeting.cjs`: actual Systems Analysis, ship lock, specific-SIC lock, manual Rapid Laser damage and resulting impairment, with independent GM/PC clients. Originally run from the ignored diagnostic script before being promoted unchanged into scripts.
- `playtest-ship-art.cjs`: actual market picker, ten distinct rendered Darkveil image hashes, high/low/Hull exterior mounts, parallel thrusters, actual pixel-changing impairment pulse and reduced-motion fallback. Screenshots were inspected.
- Existing `playtest-decent-utilities.cjs`, `playtest-held-turn.cjs`, `playtest-weapon-clock.cjs`, `playtest-combat-recovery.cjs`, and `playtest-menu-recovery.cjs` passed. These include three held-turn viewport sizes, natural-clock Ripple/Ion damage, dropped dice loading/submissions, GM takeover, unrelated NPC defeats, nested menus and authenticated server restart.

Artifacts are under ignored `test-artifacts/oxygen`, `ship-art`, `large-map-combat`, `component-diagnostic`, and the named recovery directories. Test campaigns and servers are disposable. This does not claim every historical app workflow was manually replayed.

Fresh isolated preview: http://127.0.0.1:8793/showcase.html, PID12032. Its actual Chrome startup was checked: Script active, combat inactive. Saves/logs live in C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-oxygen-targeting-20260913, separate from personal data and earlier previews.

## Next Pass

Hacking implementation is intentionally separate, as discussed. `../HACKING-PROPOSAL.md` records the approved timing: one guess per earned ATB action, no added 12-second module cooldown or mechanical Fast input delay, cosmetic typing only, one operator per module, and no free guesses from switching. Intellect + Initiative determines action cadence. The remaining proposal decisions are not silently treated as approved. CPU Security and Hacking Module SICs are not implemented by this pass.

Recheck unusual missing-health NPC profiles and nonparticipant crew policies when expanding environmental combat rules. Current tests use ordinary populated PC/NPC health profiles. Oxygen time advances only while the local server is running.
