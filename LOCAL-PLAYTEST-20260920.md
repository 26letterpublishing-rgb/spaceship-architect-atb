# September 20 local playtest changes

Jason authorized this batch with `#local no questions`. All four implementation passes are complete locally. No commit, GitHub upload, deployment, or hosted testing was performed. Tests used isolated temporary campaigns; `data/campaigns.json` remains unchanged (202329 bytes, September 6 timestamp). Earlier local changes remain in the working tree.

## Dice, automation, and combat

- Ship AI and automated NPCs now use the existing physical 3D dice renderer. The separate AI dice tiles are removed. AI checks use gray dice and damage uses red dice; spectator confirmation controls are disabled. The server owns results and waits for the existing animation to finish before resolving the action. A stalled animation can be retried without rerolling.
- The large damage result now includes the damage multiplier. Browser evidence shows a missile rolling 6 + 4 with a large **50**, alongside the explanatory calculation.
- Surface NPC automation can use an equipped personal weapon through normal draw, aim, charge, attack, and damage handling. Adding a saved NPC to combat now preserves the actual weapon inventory. Ship NPCs can scan when no enemy contact is yet available. Existing ship automation priorities and zero-AU Ship AI rules remain.
- Wait 3 is visually separated from Hold. On a PC's turn, Combat Activity stays below the ATB; the action panel sits alongside it on desktop instead of covering it. Unavailable actions, including missile and Ion fire, display their reason beneath the button.
- Victory acknowledgment preserves the encounter, navigation, and recoverable objects so players can move and collect salvage. End Combat remains the explicit way to end the encounter.

## Ship editing and Explore Features

- Confirm Changes recognizes GM and PC ship-name edits, saves before claiming success, and synchronizes confirmed designs into the live encounter. Later encounter snapshots no longer restore the prior layout/name over that confirmation.
- Saved custom NPC templates become crew choices in Ship Details. Encounter Control has an explicit Add NPC to the selected ship action and preserves the template's weapon.
- Fuel Cells are grouped together, and Cockpits and Bridges share a purchase family. Existing Warp Drive grouping is retained.
- Explore has four additional designs for each side, alongside the original Wayfinder and Red Horizon. Their names, and exported filenames, identify the showcased equipment:
  - Ship AI, Repair Drone 5
  - VR Training, Medbay, Library, Cameras
  - Warp Drive 2, Fuel
  - Sensors, Antenna 4, Cameras
- Every new preset is checked for legal exterior placement and nonnegative construction EN. Crew/sensor demonstration variants trade away weapons and Darkveil for room and power; the crew variant has additional hull space. These are demonstration alternatives, not replacements for personal ships.
- The character-sheet Reverence field has more horizontal space and wraps appropriately on narrow screens.

## Oxygen, warp, maps, and minerals

- A ship without usable Life Support starts oxygen depletion for biological crew. An operational Cockpit protects only characters inside its own footprint. Leaving starts their oxygen timing; returning removes them from the exposed group. Existing grace and breath rules remain.
- Warp advances in real time, and GM time advancement also reduces the remaining journey. The status and console show the remaining time as well as distance.
- Fast moving stars follow thruster exhaust direction. A shared sustained warp sound respects mute preferences and avoids duplicate sound loops from embedded views. It stops when travel ends. The bottom-right status panel has persistent hide/show controls; critical Self-Destruct status forces the panel open.
- The six Map View switches share preferences across the relevant views and reloads. The navigation planner shows a subtle sensor-range circle while choosing movement.
- Analyzed ship markers reuse the existing three partial-condition icons: shields where present, gray hull circles otherwise. Enemy information still requires analysis; own-ship information remains available.
- GM Prompt/Give includes Minerals, with ship, mineral type, and quantity. Grants work during combat and are protected against duplicate retry submissions.

## Decisions made without additional approval

1. Added four demonstration variants per side while preserving the two originals. Fresh Explore sessions receive these presets; an already-running Explore session is not silently rewritten. Restart the local app server to load the code, then start a fresh Explore session to see all variants. Do not reset a personal campaign for this purpose.
2. Preserved the existing 165-second residual-air/grace behavior and individual breath timing instead of introducing a new suffocation schedule.
3. Automated dice wait for an authorized viewer's animation acknowledgment. Without a connected viewer, an automatic roll waits rather than resolving invisibly. Retry replays the same server-owned values.
4. Personal-weapon NPC automation on the shared exterior/surface uses a default distance of one Unit because that combat mode does not track positions. It does not shoot across different ships. Normal player defense prompts remain manual.
5. Map switches persist per browser/device; zoom and pan remain independent. Victory preserves normal movement and salvage rules rather than granting free movement or automatic collection.
6. Warp audio is generated through the shared browser audio system and follows existing mute/autoplay behavior. No new sound asset or external download was required.

## Verification

The final automated suite passed **452 of 452 tests**, with no failures, skips, or cancellations. Log: `test-artifacts/september20-unit-tests.txt`.

Seven browser playtests passed using isolated servers and real UI interactions:

| Playtest | Coverage |
| --- | --- |
| `playtest-ship-workflows.cjs` | PC movement, upgrades, purchases, confirmation, details, printing, EN validation, expanded layouts, map controls, preparation overlays |
| `playtest-held-turn.cjs` | Hold in GM/PC views, unstationed Hold, desktop and narrow layouts |
| `playtest-weapon-clock.cjs` | Locked/unlocked Ripple and Ion, GM/PC dice ownership, real clock progression |
| `playtest-warp-transit.cjs` | Fuel purchases, standby, activation, real travel, Return, GM time, early exit, mobile controls |
| `playtest-missile-damage-recovery.cjs` | Missile ownership, reload recovery, multipliers, manual confirmation |
| `playtest-ship-automation.cjs` | Defense/Offense, standard dice visible to GM and PC, disabled spectator controls, pause, restore, zero AU, Off during missile flight, NPC analysis |
| `playtest-september20.cjs` | GM and independently authenticated PC rename/reload, shared switches, catalog families, minerals/retry, visible PC activity, movement sensor range, custom NPC crew assignment, NPC add-to-ship with weapon, final multiplied dice, partial shield icons, directional warp and cleanup |

Screenshots and results are under `test-artifacts/september20/`, `test-artifacts/ship-automation/`, and `test-artifacts/warp-transit/`. The final PC-turn and damage screenshots were visually inspected. Browser logs use the `test-artifacts/september20-*.txt` prefix. Older failure screenshots in artifact folders are not final acceptance results.

No requested item was intentionally deferred. Limits of verification: warp audio was checked through its browser implementation and lifecycle, not a subjective listening review; post-victory preservation was covered by the automated encounter test, not a dedicated complete mouse-driven salvage journey. Existing browser suites cover related movement and combat behavior. A full multi-player live session remains a useful next playtest.

## Maintenance notes

- Reuse `PhysicalDiceRoller` for future dice. Do not invent another animation or bypass animation for rolled automatic results. Fixed awards such as VR's +0.1 remain fixed awards, not dice rolls.
- Shared implementations: `warp-effects.js` owns the warp background/audio; `ship-map-core.js` owns the six map preferences; `space-map.js` reuses `SAHealthDisplay` for marker condition; `showcase-variants.js` creates the additional presets. Existing combat validators, dice pages, and salvage rules are reused.
- Automation acknowledgment accepts only the matching server presentation from the GM or authorized crew; never accept client-supplied automatic dice values.
- Preserve live SIC impairment and transit when synchronizing confirmed ship edits. Keep tests isolated from real campaign storage.
