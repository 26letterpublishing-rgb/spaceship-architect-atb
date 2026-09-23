# Local Missile Pass

Completed September 13, 2026. Authorized by the user's Missile Launcher request with "Continue without questions. #local." No commit, push, hosted testing, personal campaign edits, or Gold Standard changes.

## Implemented

- Missile Launchers 1-5, their independent EXT/EDG placement, one station each, source prices/EN/security/capacities, and destruction after one impairment.
- Standard Missiles 1-5, Spread Missiles 1-5, and Missile Flares. Purchase and load individual magazines from Ship Details or ammunition market cards. Magazine capacity, credits, permissions and retry receipts are server-validated. Ammunition is stock, not a floorplan component.
- Launcher access through its station or an authorized bridge, compact combat action and immersive console. Captured launcher access respects the hacker's accessible Lock-On systems.
- Persistent homing projectiles with acceleration, direction-facing icons, animated exhaust, visible Lock-On reticles and explosions at their actual impact/interception positions. Spread icons use display-only lanes to distinguish individual missiles; physical positions are unchanged.
- Detected missiles are targetable by weapons and Lock-On, including missile interception by another missile. Missile Masking is its Defense; one damage destroys it. Ship-only actions and SIC targeting do not treat missiles as starships.
- Manual impact damage, a global recovery prompt independent of the launching console/operator, GM takeover ownership, and authoritative ATB/command-clock freezing until resolution. Four spread hits require separate damage confirmations.
- Manual flare coin outcomes and manual direction rolls. Heads deflects; tails leaves pursuit unchanged. Three compact result rows fit the desktop action dialog, and a tails result disables its irrelevant direction input.
- Fresh Explore rooms include a Launcher 1 with two Missile 1 rounds and one flare pack on each ship. Existing campaigns are not rewritten.

## Source And Interpretations

Read the core missile rules in SA20210516PDF_ADV4.pdf, PDF page 66 / printed 32L, and the once-per-SvS-round launcher restriction on PDF page 71 / printed 34L. Warp weapon restrictions were also checked on PDF page 76 / printed 37L. Catalog sources: A-112 through A-118 and B-88 through B-96.

- Capacities by launcher grade: 3, 5, 8, 15, 25. Grades 1-2 use 1x2 EXT + 1x2 EDG; grade 3 uses 1x3 EXT + 1x2 EDG; grades 4-5 use 2x3 EXT + 1x2 EDG.
- A valid accessible Lock-On is required at launch, not throughout flight. Losing the operator, source ship or lock after launch does not remove a missile.
- The normal Fast Weapon Systems/grade input delay precedes launch. A successfully fired launcher then has a shared 12-active-second cooldown. This is the SvS round, not the user's separate 10-second ship movement conversion. Extra AU/operators cannot bypass it.
- Ammunition is consumed only when launch input succeeds. Interrupted input retains the unfired round.
- Grades 1-3 move 1 unit in their first 12-second round, 2 in their second, up to 5. Grades 4-5 use 2, 4, 6, 8, then 10. The fifth-round cap limits acceleration, not flight lifetime. Movement is interpolated continuously.
- Standard damage is 2D8 x5 against hull. Each spread projectile is 1D8 x5. Against active shields the multiplier is absent, and shield overflow is discarded. All damage totals are manually confirmed.
- Spread cards B-92 through B-96 contradict their flavor description (three) with their explicit effect (four). Used the mechanical effect: four independently targetable projectiles.
- Flares use three manually confirmed coin flips. Heads is the winning face; a manually entered D6 maps clockwise East, Southeast, Southwest, West, Northwest, Northeast. Deflected rounds coast instead of homing. As an app housekeeping choice, deflected rounds retire after 600 active seconds.
- Targets escaping into warp end pursuit. End Combat and explicit new preparation remove encounter-only flights/cooldowns while preserving purchased ammunition. No refund for fired rounds.
- Phazon Torpedo Launcher is a separate SIC and was not included in this missile-family pass.

## Additional Fixes Found

- Split-footprint area validation previously counted the enclosing rectangle. This rejected valid grade 4/5 launchers with a wider exterior segment. It now counts the actual parts.
- Impact pauses initially could be lost during a server restart before the ordinary save cadence. Launch and impact boundaries now schedule immediate persistence.
- A second gunner's outstanding damage roll could remain pending after the first gunner destroyed their shared target. Invalid target waits now cancel without releasing an intentional GM pause.
- Moving missile data no longer triggers whole-campaign broadcasts at the resource-sync interval. Live flight updates remain in encounter messages; public snapshots omit old missile receipts and archived projectiles.
- Missile presence no longer crowds ship-distance headings or alters two-ship name anchoring. Existing map controls and ship workflows were preserved.
- An existing hacking test occasionally submitted its original randomly generated guess as its supposedly different retry. The fixture now guarantees a different guess; hacking mechanics were unchanged.

## Verification

- 336 automated tests passed, including 17 missile unit scenarios and an authenticated ordinary-campaign HTTP test with a real server restart during a GM-owned impact pause.
- Actual Chrome mouse workflow: buy a grade-5 launcher, place both sections, confirm construction, purchase/reload ammunition, authenticate independent GM/PC clients, launch, wait for natural flight/impact, enter damage, resume ATB, manually shoot down a second missile with Rapid Laser 5, and deploy three manually confirmed flare outcomes against a four-missile salvo.
- Existing Chrome suites passed: ship workflows, held-turn delivery, weapon-clock, menu recovery, live hacking, warp/transit and mouse audit. Ship workflows, held-turn and weapon-clock were rerun after the final changes.
- 80 top-level JavaScript syntax checks, whitespace checks and the Gold Standard structural control audit passed. The structural audit is not proof of every historical workflow.
- Screenshots inspected in test-artifacts/missiles include launcher placement, magazine purchase, launch controls, manual damage, interception explosion, compact flare controls, separated spread flight and fresh Explore.
- Browser fixtures seed ready turns, locks and a flare salvo to isolate mechanics. Independent campaign permissions/persistence, actual button clicks, live launch delays, missile movement, damage and interception were exercised. This is not a claim to have played a complete campaign or manually placed every launcher tier.

## Local Preview

http://127.0.0.1:8799/showcase.html

GM entry: http://127.0.0.1:8799/gm.html

Isolated data: C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-missiles-20260913

Preview server session 38270 is intentionally left running. Older previews remain untouched and may use earlier server logic. Fresh Explore was visually checked in Chrome: Script tab, no combat active, room code visible.
