# Local crew, defense and Rail Repeater SIC pass — September 22–23, 2026

Completed Jason's authorized `#local` batch: eight SICs, their generated artwork, and categories in purchasing and purchased inventory. Restart Spaceship Architect on port 8790 and refresh to load the complete update. This pass remains local: no commit, GitHub push or deployment.

**Verification status:** all 641 automated tests passed; all 51 changed/new JavaScript files passed syntax checks; whitespace checks passed. Isolated GM/PC browser playtesting is complete, with coverage and limits below. Both personal campaign files retain their original SHA-256 hashes.

## Printed cards and preserved specifications

Values were checked against `SIC_Series_A.pdf`, `SIC_Series_B.pdf` and `tmp/sic_extract/sic_cards_extracted.json` in the parent project folder. Card numbers match their PDF page numbers.

| SIC | Source | Price | EN | Printed size | Security / Damage Threshold |
| --- | --- | ---: | ---: | --- | --- |
| Bar | B-64 | 1,000 | 0 | 5×5 | 2 / 13 |
| Hibernation Chamber | A-67 | 300 | 1 | 1×1 | 4 / N/A |
| Brig | B-67 | 100 | 0 | 1×1, enlargement free | Unspecified / 13 |
| c.r. Ballistic Rail Repeater | B-103 | 800 | 0 | 1×2 EXT + 1×1 EDG | 2 / 18 |
| Hull Plating | B-68 | 450 per Hull square | 0 | Hull (+) | N/A / N/A |
| Heat Resistance | B-69 | 75 per Hull square | 0 | Hull (+) | N/A / N/A |
| Laser Resistance | B-70 | 300 per Hull square | 0 | Hull (+) | N/A / N/A |
| Static Shields | A-59 | 35,000 | 3 | Shield (+) | 3 / N/A |

The Brig's blank Security Level remains unspecified. No Security 0 value was invented. The four (+) cards have no floorplan and occupy no additional Hull squares.

## Bar, Hibernation Chamber and Brig

These rooms extend the existing crew-services console rather than adding separate navigation or dice systems. Each has a physical station, and entering its room makes its console available. Normal doors, movement mesh, maps, console switching and ship ownership remain in use.

### Bar

- Crew can name a drink, place an order and turn the optional robotic bartender on or off.
- Orders and bartender settings are available outside combat. Disabled controls explain that restriction.
- An impaired robotic bartender uses the existing physical D6 animation: 1–3 gives the wrong order; 4–6 gives the requested drink. This implements the printed 50% malfunction chance.
- Manual service does not perform that robot malfunction roll. Healthy robotic orders likewise need no chance roll.
- The shared room history preserves recent orders and outcomes. Retrying a submission keeps its original receipt and, for rolled orders, its original result.
- Drinks and intoxication remain roleplayed. There are no invented automatic skill, healing or attribute bonuses.

### Hibernation Chamber

- One living occupant can enter hibernation outside combat when the chamber, ship power, Life Support and room oxygen are usable.
- Sleep state and elapsed active travel time persist through saves and restart. There is no invented healing or training benefit.
- Wake Now remains available without requiring an ATB turn. A sleeper can read their chamber status and wake even when ordinary console controls have been captured; this does not grant other control or create a hacking alarm. Moving while asleep is rejected with an instruction to wake first.
- Entering an encounter triggers an emergency wake. Other triggers include chamber removal/offline state, Life Support or power failure, unsafe oxygen, incoming lock-on, ship/shield damage, personal damage, or a medical emergency.
- Impairment while occupied removes 25% of the sleeper's **current HP**, rounded up, and wakes the occupant. It is applied once to that sleeping period, not repeatedly on each update.
- The occupant receives a persisted private wake notice. Unrelated crews do not receive the ship's room state.

### Brig

- The GM can record a prisoner, add custody notes, release a recorded prisoner and describe the Brig's condition.
- Crew can read the local register. Only authenticated GM requests may change custody or condition records.
- Impairment displays the printed general-destruction warning; the GM records its consequences. No escape, prisoner-combat or boarding subsystem was invented.
- Width and Height controls appear with the purchased Brig. Dimensions are retained through construction saves and combat normalization, and the station rotates with its footprint.
- Enlarging the Brig adds no SIC charge. Its complete footprint still needs purchased Hull and cannot overlap another SIC or run beyond the grid. Invalid resizing is rejected.
- Atmosphere topology now notices changes to variable Brig and Docking Bay dimensions instead of reusing a stale room layout.

## Ballistic Rail Repeater

- One attack begins a burst of up to four shots against the selected ship/component.
- Every shot requires its own ordinary manual To-Hit roll, even when the target is locked on. The target's Defense gains +1 per Unit of distance; distance is not also subtracted a second time from accuracy.
- Every successful unshielded shot uses the established damage prompt and physical dice animation: 1D10 normally or 1D6 while impaired.
- The Repeater cannot damage shields. Shielded hits preserve shield and Hull HP.
- One Iron is consumed when each shot begins. A ship with fewer than four Iron can fire that many shots; unused Iron is retained if the target becomes unavailable/destroyed or the operator loses weapon access.
- The burst uses one ordinary Fast input delay and one ATB action. Follow-up shots use fresh dice prompts without spending more turns or repeating the initial input delay.
- The weapon spends no AU. GM/PC roll ownership, automatic-actor animation acknowledgment, pause behavior and retry protection remain part of the normal weapon pipeline.
- The 1×1 EDG control compartment has a station under the existing console policy. The two exterior squares are weapon machinery, not walkable crew space. Rotation and mixed-footprint checks remain enforced.

## Hull upgrades and Static Shields

### Hull Plating, Heat Resistance and Laser Resistance

- Each is limited to one copy per ship and attaches to the whole Hull with no physical floorplan or storage slot.
- Hull Plating adds `floor(base Hull HP × Scale Rank / 10)` HP. It does not itself increase Scale Rank.
- Heat Resistance reduces Heat damage reaching Hull by 75%. The printed card has no rounding instruction; quarter damage retains fractions.
- Laser Resistance halves Laser damage reaching Hull and rounds down as printed.
- Shield protection resolves before Hull resistance. Attacks that legitimately bypass shields still receive applicable Hull resistance.
- Existing Beam and Rapid Laser damage carries the Laser type; rail projectiles carry Ballistic. GM damage controls can select Standard, Laser, Heat or Ballistic.
- Prices multiply the printed rate by Hull sections, including triangular sections. Later Hull growth adds each installed coating's per-square surcharge; legal reductions refund it through construction accounting.
- Server normalization enforces the calculated prices. Confirmed equipment sales use the established half-price rule and the last confirmed cost.

### Static Shields

- Installs inside one Shield system as a zero-footprint (+) add-on.
- An active, usable host shield supplies +4 Masking and prevents ordinary incoming hacking and audio/video communications.
- The bonus is nonstacking across multiple active Static Shields. Each host accepts one Static Shields add-on.
- The protection stops when its host is depleted, disabled or otherwise unusable. Existing Hacking Bug bypass remains valid.
- Sensor-data sharing is permitted; it is not treated as the printed audio/video communications restriction.

## Purchasing and artwork

- Purchasing and purchased inventory use shared SIC categories: Core & Propulsion; Shields, Stealth & Hull; Weapons & Targeting; Sensors & Probes; Hacking & Security; Crew & Life Support; Repair, Cargo & Utilities.
- Existing within-family ordering, purchase controls, duplicate/refund behavior and equipment identity are preserved.
- The batch contains **17 AI-generated assets**: eight card illustrations, three crew-room floorplans, two Repeater interior/exterior assets, and four (+) installation previews. The served WebP files total **1,050,432 bytes**, about 1 MB; large generation masters are not served by the app.
- Asset source files, prompts and served output names are recorded in `ASSETS-CREW-DEFENSE-20260922.json`.
- Hover previews for Hull/Shield (+) cards show their generated installation/surface artwork. These are explanatory previews, not purchasable rooms or extra floorplans.
- Art is separate from footprint, collision and doorway geometry. Existing maps and movement remain authoritative.

## Issues corrected during playtesting

- The Bar's impaired-order prompt initially sent its display title as a skill key, so the established dice window could load without opening a roll. It now supplies valid host metadata while retaining the ordinary D6 animation and Bar title. The same existing issue was corrected in the EW-FTL integrity D8 caller; EW-FTL mechanics are unchanged.
- Growing a Brig could hide a neighboring SIC behind the Brig's own placement lookup. Resize validation now checks every other footprint, restores rejected dimensions, retains the previous state for Undo and commits valid numeric changes on blur.
- A newly opened room no longer borrows another room's latest ship-wide status message.
- Hull upgrades and Static Shields are now registered in the actual purchasing catalog, preserving their correct rules, EN, artwork and identity through Confirm Changes and reopening the builder.
- Purchase errors now appear in the visible shop. Successful whole-Hull/host installations identify their destination and remind the player to confirm changes; duplicate coatings receive a clear warning.
- Repeater previews use an analyzed contact's disclosed Defense instead of recomputing it from a deliberately hidden layout. The preview and actual roll now agree.
- Ordinary weapon damage results now show the damage number in large text even when the multiplier is one. Multiplied results still display their final damage, while submission retains the raw roll to prevent double multiplication.

## Decisions made without additional questions

- Bar malfunction uses D6 halves to represent an exact 50% chance through the existing dice renderer. Robot service starts enabled and can be switched off.
- Hibernation is a long-trip activity outside combat. Encounter entry is an emergency wake event, including when combat begins paused. Sleep introduces no combat turn-skipping or healing subsystem.
- “25% of HP” means current HP, rounded up. This interpretation is printed on the in-app card text and uses one loss followed by waking.
- Brig operations are GM-managed narrative custody. The card does not supply escape, interrogation or prisoner-AI rules, so those were not invented.
- Repeater ammunition is one Iron per shot; bursts with limited ammunition stop at the available count. All shots retain the initially chosen target/component.
- Whole-Hull upgrade pricing includes triangular Hull sections. Heat fractions are preserved, and Static Shields' +4 does not stack.
- Hull/Shield (+) images are installation previews only, honoring the existing rule that these cards have no separate floorplans.

## Verification completed

The final full suite passed **641/641 tests**, with no failures, skips or cancellations. All **51** changed/new JavaScript files passed syntax checks, and the final whitespace check passed. The suite log is retained at `test-artifacts/new-sics-20260923/final-full-suite.log`.

Browser checks used an isolated server on port 8791 and a disposable campaign, leaving the normal 8790 server, Vector, frozen Gold Standard and personal campaigns unchanged. The GM/PC checks covered:

- Categorized purchasing and owned-card layout, readable card rules and generated art; no vertical rule-text clipping on the tested desktop layout.
- Whole-Hull purchase pricing (80 sections × 75 = 6,000 for Heat Resistance), zero extra footprint, duplicate warning, and Confirm Changes/reopen preservation.
- Brig enlargement from 3×2 to 4×2, overlap rejection at width 5, rollback to width 4, and saving the legal footprint without charging for its expansion or dropping other SICs.
- Healthy Bar orders and an impaired bartender's normal animated D6 result (6), followed by successful order submission.
- Hibernation entry, elapsed travel-time display, manual wake, and the PC's read-only Brig register.
- A complete four-shot Repeater burst through four normal accuracy rolls and four normal animated D10 damage rolls. Damage results were 5, 7, 3 and 8; each result required confirmation and the fourth shot completed the burst. Iron fell from 1,000 to 996, AU remained 60, and no roll was left pending.
- Refreshing and returning to Combat reopened the remembered weapon console. The corrected preview displayed Defense −2, matching the actual roll (disclosed Defense −3 plus one Unit of range).
- Both browser tabs reported no captured JavaScript warnings or errors at the final inspection.

All 17 served asset URLs returned successfully. Generated outputs were visually inspected. Hover-preview metadata and asset delivery were checked automatically; a dedicated mouse-hover pass and every shield/resistance combination were not repeated in the browser. The latter are covered by the unit/HTTP tests below. The EW-FTL caller correction is covered automatically, but its D8 was not manually rolled in this pass.

The following focused gates passed independently; their counts overlap and must not be added together:

- **43 crew-room checks:** new card rules, exact Bar chance split, standard dice iframe/protocol and retry, hibernation safety/persistence (including manual wake from a captured chamber), GM Brig authorization, actual builder resize/rollback, room-specific status, resized footprint/atmosphere behavior, and existing VR/Medbay/Library regressions.
- The crew HTTP tests used isolated temporary campaign storage. They verified outsider privacy, blocked sleeping movement, retained room state through stale builder save and restart, safe wake after Life Support removal, and rejection of unsupported Brig expansion.
- The existing Medbay HTTP test confirmed ATB pause/restart behavior remains intact.
- **136 hull-upgrade/Static Shields focused checks**, including eleven new unit/HTTP tests. Covered pricing, resizing, typed damage, host availability, hacking/communications restrictions, privacy and authorization.
- A later **15-test Hull/Static/category gate** includes four added tests for actual market-card registration, confirm/reopen serialization, categories and generated-asset references. This overlaps the prior Hull/Static gate.
- **61 Repeater focused checks**, including nine new unit tests and one HTTP test. Covered separate hit/miss stages, ownership, retries, ammo, clock freezing, restart mid-burst and one-action ATB accounting.
- **12 EW-FTL/fleet checks** include the actual integrity-roll button handler and shared character host's skill resolver; existing D8 failure, activation, fuel and travel rules remain covered.
- Additional regressions cover projected-contact Defense, standard/multiplied damage presentation, shared purchase feedback, categories and floorplan previews; these are included in the 641-test total.

## Source map

- Shared catalog, dimensions and passive rules: `ship-map-core.js`.
- Construction, prices, categories and previews: `starship.js`, `starship.html`, `sic-categories.js`, `sic-cards.css`, `campaign-api.js`.
- Shared rooms and safety/persistence: `ship-crew-rooms.js`, `crew-room-console.js`, `crew-room-console.css`, `ship-atmosphere.js`, `campaign-api.js`, `server.js`.
- Weapon burst and ordinary dice stages: `ship-weapons.js`, `weapon-console-ui.js`, `ship-automation.js`, `server.js`.
- Hull/shield defenses and affected operations: `ship-shields.js`, `ship-hacking.js`, `ship-commands.js`, `ship-command-ui.js`, `app.js`, `server.js`.
- Asset allowlist and provenance: `public-assets.js`, `ASSETS-CREW-DEFENSE-20260922.json`.
