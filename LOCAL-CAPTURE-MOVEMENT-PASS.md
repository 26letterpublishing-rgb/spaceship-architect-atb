# Local Capture And Movement Pass

## Request Inventory

- Purchased SIC cards now wrap into rows with at most ten cards per row, fewer on smaller screens. All inventory remains visible. Cards retain native proportions and have enlarged names. The market's full-size inspection cards are unchanged.
- Returning to the GM Combat tab enters the live encounter automatically when combat is active. Explicit Encounter Setup and preparation remain available; deliberate GM pauses are never silently released.
- Sensors have compact, visible minus/plus/Fit Contacts controls below the contact map. Zoom changes persist across redraws. The old shared fixed map height no longer overlaps the toolbar or coordinate fields at laptop size.
- Hex Q/R are axial map coordinates, relabeled Column (Q)/Row (R). Clicking a hex fills them automatically; their tooltip explains this.
- Empty scans say "No objects detected." Rolls are requested only when their result can change the outcome. Guaranteed successes and impossible checks retain normal console input, processing and result notifications. Analysis retries and stationary Scan Area probability improvements are preserved. No automatic character or damage dice were added.
- A selected captured hacking target shows CAPTURED in red. Remote enemy consoles have a red treatment and an Operating Via HACK banner. Defense, AU and commands use the operated ship.
- A captured bridge grants all installed operational console types already supported by the app: pilot, hacking, weapons, sensors, locks, shields and utilities. Physical seat identity remains on the hacker's own ship. Bridge capture denies crew operation until local recovery; no hidden enemy crew or puzzle secrets are exposed.
- Bridge ownership persists after lost range, but remote actions stop until connected. Individual SIC captures retain their previous lost-connection release rule. Local reboot/power recovery and explicit release revoke control. Relayed hacking modules depend on the parent capture, so rebooting that bridge revokes dependent remote access.
- Cancel during out-of-combat walking stops on the reached route mesh and saves/broadcasts the position, rather than completing the destination or returning to the start. Door waits, gravity and background completion remain supported.
- Actual GM Move Speed edits immediately update existing encounter actors. Move 15 is five times as fast as Move 3 for the same unobstructed distance in both combat and out of combat.

## Additional Bugs Fixed

- GM map relocation previously called full unit synchronization with only a location. That reset Move Speed and could also reset dice, skills and loadout. Relocation now preserves the full existing unit.
- Enabling the walking Cancel button was insufficient: the parent submission guard also swallowed Cancel. Both layers now allow cancellation while preserving combat-submission protection.
- Captured-ship result feedback now reads the acting ship's report stream, not always the operator's home ship.
- Remote maneuver and Break Lock completion revalidate the selected captured console. Bridge reboot cannot leave an already queued action authorized against a revoked grant.
- Automatic live entry initially intercepted the explicit Encounter Setup button. A separate explicit-setup flag preserves that existing entry point without requiring Resume during ordinary tab navigation.

## Verification

- Full automated suite: 273 passed, zero failed or skipped.
- Final syntax checks: 146 JavaScript files passed. Git diff whitespace checks passed.
- New sensor HTTP test: empty scan retains its delay, never pauses for pointless dice, produces a player notification and recovers the clock. Uncertain analysis still requests manual dice and freezes ATB. Relocation preserves speed, dice, skills, weapons and held weapon.
- Live-hacking unit coverage: full bridge grants, actual navigation/maneuvers, range loss, reboot, controlled projection, deterministic scans, analysis processing/retries and chained-module revocation.
- Independent Chrome GM/PC live-hacking script: earned ATB turns, stable puzzle, capture selector updates, defender lockout, manual counter-hack pause, local recovery, bridge capture, CAPTURED banner, red enemy helm, actual delayed enemy navigation, zoom changes/persistence and laptop bounds. No browser errors.
- New Chrome movement-edit script: real GM adjustment dialog and Save Changes; already-open PC Starship tab; 3000ms versus 600ms per square out of combat; Cancel mid-route persists the stopping position; actual combat movement takes 3 versus 0.6 seconds; normal GM tab return is automatic while explicit Encounter Setup remains accessible.
- Ship-workflow Chrome script: existing toggles, upgrades, print, movement and construction preserved. More than twenty purchased cards remain present, wrap with no more than ten per row and keep correct scaled bounds at 1920, 1366 and 390 widths.
- Held-turn, weapon-clock and combat-recovery Chrome scripts pass, including independent GM/PC clients, natural NPC readiness, manual damage, blocked dice loading/retry and failed-submission recovery.
- Existing synthetic sensor recovery fixtures now include a real SIC identity and genuinely uncertain skill/target difficulty. They continue testing manual-roll recovery rather than expecting dice on newly automatic guaranteed outcomes.
- Screenshots and test output are under ignored test-artifacts. The latest full-suite output is test-artifacts/local-capture-tests.log. Relay-chain revocation is unit-tested, not claimed as a full browser chain playtest.

## Preview And Boundaries

Fresh local preview: http://127.0.0.1:8796/showcase.html. GM entry: http://127.0.0.1:8796/gm.html.

Server PID2540, terminal session99802. Isolated local data: C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-capture-movement-20260913. Actual Chrome verified fresh Explore opens Script with combat inactive. Older previews may still run older server code. The background launcher was blocked; the ordinary local server is running in a tool terminal.

Local files only. No commit, push, hosted testing, Render usage, Gold Standard edits or personal campaign changes. Do not remove or revert the substantial pre-existing local changes. Preserve the approved rules and regression inventory in AGENTS.md. The completion notification is sent only as the final operational action.
