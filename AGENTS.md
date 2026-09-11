# Spaceship Architect Working Guide

## Resume Entry Point

Read `CURRENT-HANDOFF.md` first for the current authorization boundary, pending requests, and a targeted reading order. This guide records durable conventions; the handoff records unfinished work. Do not mistake an earlier completed pass for verification of newly reported bugs.

Latest combat interface: `TARGETING-FAMILIES-PASS.md` supersedes the older automatic-PC-console default. Combat View is the root for PCs and GM/NPCs; immersive consoles are optional and persist only after the player chooses one. Preserve selected console and Combat View preference across reloads and perspective changes. Never auto-open a PC console for the GM. Compact and full planners share confirmation logic and server rules.

Station occupancy is entered through movement, not a free-text Station action. Keep vehicle mounting separately available. Console turn alerts use turnSerial to deduplicate audio, respect mute preferences, and show server command time as a shrinking bar. Decorative instrumentation must never obscure inputs or imply invented game values; respect reduced motion.

## Product Direction

Latest release: TARGETING-FAMILIES-PASS.md. Numbered Lock-On 1-10 and Rapid Laser 1-5 are implemented; FTL Lock-On and Triangulator remain separate future add-ons. Lock records retain source system IDs, grade-specific dice/break difficulty and independent upkeep. Rapid damage uses the selected grade's die, never automatic damage rolls. Fresh/reset Explore contains Lock-On 10/Rapid Laser 5 and veteran Nova: Weapon Systems/Pilot 6, Sensors 5.5, Engineering/Computer Systems 5, +2000 unspent XP. Her Dexterity pool is D10+D8+D6. Combat-order-ui.js reuses live console controls in compact root planners; Evasive starts directly. Every console has Defense. Main combat activity must not flash; impact movement is additive and screen-pixel bounded. Keep revision ordering on action responses: never force a slow HTTP response over a newer streamed state. Older tier-one/demo descriptions below are historical.

Latest Lock-On/combat rules: read LOCK-ON-COMBAT-PASS.md and NEWCOMER-AUDIT-2026-09-11.md. Lock-On System 1 is implemented, not deferred. ship-locks.js owns range, impairment, two-target AU upkeep and component locks; Share Data never transfers locks. Successful laser shots require separate red manual-confirmed damage dice. Locked shots skip accuracy but never skip damage confirmation. console-common.js owns shared AU/seat controls and adds timelines only when the console does not already own one. Preserve explosion/victory and lock state through synchronization. Destruction stops crew participation without changing character HP; SIC damage does not create hull breaches or crew casualties.

Latest Defense/console rules: read DEFENSE-CONSOLE-PASS.md. Defense uses actual Masking or the highest active evasion result. Evasive Maneuvers lasts 20 combat seconds for ALL attacks, never consumed on hit/miss. Detected contacts expose Defense. Fresh Explore contains only Nova Vale (six spacecraft skills at 2.5) and Space Slug; the old Masking 18 demo override is removed. This supersedes older demo/next-attack notes below.

Rapid Laser 1: ship-weapons.js owns fire through a real cockpit/bridge, Fast input and Weapon Systems Ingenuity. Use the shared skill roll before input for unlocked fire; preserve ATB freeze until roll confirmation. At input completion, a hit requests a separate damage roll; apply it once after confirmation, not through a queued effect. Weapon state and receipts survive restore/synchronization. Do not leak undetected attackers through incoming reports. Fresh Explore ships include one Rapid Laser 1 and Lock-On System 1 each. LOCK-ON-COMBAT-PASS.md supersedes RAPID-LASER-PASS.md where they differ.

Latest scan feedback: read SCAN-FEEDBACK-PASS.md. Ship dice actions now stop at an explicit authenticated roll request after input; retain retry-safe results and pending requests through restart. Life Scan is automatic per selected hex, counts non-Android combatants on other ships, and excludes the scanning ship. New/reset Explore ships intentionally have no shields for Analysis testing. Preserve one full-name label per SIC footprint and high-resolution yellow labels.

Command/interior expansion: read COMMAND-ACTIONS-PASS.md. ship-commands.js owns bridge preparations, hails, maneuvers and conditional orders; ship-cooperation.js owns fused cooperative rolls. ship-maintenance.js owns local repair/reboot and GM-time diagnostics. Expanded interior maps share the live route state and must not replace held-click controls. Keep the earliest hull cell reachable at scrollLeft zero. Future Lock-On, hull breaches and hacking remain deferred until real state exists.

Latest sensor expansion: `SENSORS-PASS.md`. `ship-sensors.js` owns observer-specific intelligence and authoritative scans. Sensors have no seats; access is through a real cockpit/bridge station. Quality changes input speed, Sensor Systems changes the roll only. Exact enemy HP is revealed only in successful Analysis snapshots. Never send enemy crew, interiors or raw inventories to player sensor views. Preserve authentication on all encounter REST/SSE requests, and preserve sensorMode after hardware loss. Impaired ranges 1-9 are 4/6/8/10/12/15/16/18/20. Keep new/reset Explore ships current with the latest SIC families; its Masking 18 override is demo-only. See the pass notes for timing/defense fallbacks that still need playtesting.

Latest follow-up: SHIELD-GENERATORS-PASS.md. Shield generators 1-10 are available; costs, regeneration and artwork must come from the selected definition. Restabilize is zero-HP-only; Reinforce requires active shields. Initial inertia now uses actual powered distance traveled, not Move Speed; subsequent drift decays as before. Standard skill names open skill-descriptions.js references in an outermost-viewport dialog, then reuse existing roll setup with the selected Attribute. Gold Standard remains frozen.

Latest shield/bridge expansion: read SHIELD-BRIDGE-PASS.md. station-access.js authorizes physical and remote console access; ship-shields.js owns shared shield HP, reinforcement, AU input reservations and restabilization. Cockpit 2 and Bridges 1-8 are installed-SIC options; one cockpit/bridge total per ship. Only local shield occupants contribute Engineering, and restabilization freezes their ATB. AU input is 1.5 seconds and uses a shared reserved pool; never allow spending reservations twice or reset damage in routine ship synchronization. Console switching must wait for dialog close cleanup. Out-of-turn Open Console selectors expose only the player's own stationed character or GM-controlled NPCs.

Spaceship Architect is a multiplayer tabletop RPG companion for campaign management, character creation, starship construction, and real-time ATB combat. The GM desktop workflow is the primary development target. Keep mobile broadly functional, especially page scrolling and core controls, but postpone mobile-only refinement until the desktop experience is stable.

Treat the existing application as one shared product. Do not create separate desktop and mobile implementations unless the user explicitly requests that architecture.

Gold Standard folders are frozen: do not edit, replace, or refresh them. Create a future Diamond Standard snapshot only after explicit user approval of a stable build. Wired Downgrade is retired; do not implement it. Connector Cable's future is undecided.

Read `RULEBOOK-REFERENCE.md` before changes involving game rules or SIC expansion. It summarizes the core rulebook and both SIC catalogs, records unresolved source discrepancies, and distinguishes printed rules from approved digital changes. Initiative and action timing are intentionally computer-driven; do not restore the book's tabletop turn order.

## How To Work

- Read the relevant implementation and reproduce the reported behavior before changing it.
- Until the user says `#commit`, proposed changes are discussion only. After that authorization, implement, verify, push GitHub, stop task-owned processes, and send the completion notification last.
- For visual or interaction bugs, verify the result in the running application with realistic mouse interaction. A passing unit test alone is not proof that a UI bug is fixed.
- Use Explore Features for rapid checks, then use a fresh campaign when the change concerns persistence, linking, crew assignment, permissions, or GM/player synchronization.
- Preserve user changes and unrelated work already present in the working tree.
- Keep changes focused, but follow a shared behavior through every view that uses it.
- Communicate in concise, non-technical language unless technical detail is useful for debugging.
- Do not claim broad playtesting unless those workflows were actually exercised.

## Important Invariants

### Starship Maps

- Exterior SICs attach outside an outer hull wall, never inside a hull square or enclosed courtyard. `ship-map-core.js` owns exterior validation and propulsion. Preserve external placements through campaign and encounter normalization; include them in view bounds, but never in walkable hull, hull cost, HSM, stations, or door generation.
- Exhaust Thrusters 1-5 (A-23 through A-26 and B-13) and Ionic Pulse Thrusters 1-5 (B-14 through B-18) are implemented. Maximum four INSTALLED thrusters combined; purchasing and storage have no count cap. Impulse uses HSM/2 rounded toward zero. Impairment removes its AU boost and Evade die, not base Impulse. Cockpit 1 now unlocks movement and boosts. Multi-cell exterior graphics render once at their origin and orient using the complete footprint's hull contacts; all occupied exterior cells remain blocked and transparent.
- The SIC market groups persistent real cards into expandable family stacks. Do not duplicate purchase controls in collapsed strips.
- Multi-tier families show a compact rotated deck with tier 1 face-up; single SICs retain a normal Purchase button. One full-viewport family picker fits all tiers at once, including from nested GM editors. Preview clones must not retain interactive card IDs or purchase controls; the picker supplies its own purchase buttons. Purchased cards uniformly scale a 350x490 poker-proportioned face to approximately 117x163; never narrow the source face and reflow its text. Their inspector Locate uses the exact inventory ID, not just SIC type. `sic-cards.css` owns the shared shop/collection/inspector face. Dialogs open in the outermost accessible viewport, clean up on editor unload and return focus to their source. Reduced-motion settings suppress animations.
- Installed-SIC duplicate purchasing uses `purchaseSic`, including the normal pending-cost check, unique inventory identity, refund flow and shared thruster limit. Credits are still deducted on Confirm Changes, never twice on purchase.
- `ship-map-core.js` owns Hull controls, outer plating and directional exterior sprites. Hull is presentation only: temporarily hide interior walls, stations, mesh and crew, preserving their settings; Labels remains independently usable. Starting character movement returns to the interior. Thruster nozzles point away from their mounting hull edge; low-res uses a silhouette, high-res/Hull uses the sprite with fire for Exhaust and outward semicircular pulses for Ionic. Emitter coordinates share the sprite's transformed assembly so wide-side mounting stays aligned. Respect reduced motion and offline state.
- `componentDefinition(item)` owns rotated footprints and station positions. Preserve inventory `rotation` and `stationLayout` through builder, campaign and encounter normalization. New purchases use `corners-v1`; legacy saves retain their existing stations to avoid relocating crew. Prefer door candidates away from stations while keeping one connection per room pair. Masking is HSM plus Exhaust plus the best applicable Darkveil modifier, including negative totals.

- Create Starship, GM View Ship, PC Starships, and combat maps must render the same ship topology and visual language.
- Low resolution uses clean, flat room colors. Do not use the old white circles inside hull squares.
- High resolution uses each SIC's floorplan artwork and the hallway texture.
- Walls are slim white boundaries. Doors are centered segments on those boundaries and must never stretch across a cell or spill from corners.
- Adjacent SICs share one boundary and at most one connecting door. Do not render duplicate doors from both rooms.
- Combat Mesh divides every hull square into a clearly visible 3x3 movement grid in both resolution modes.
- Only SIC cards that explicitly list stations receive stations. One character may occupy a station. Up to two characters may share an ordinary movement location, with both icons visible.
- A movement click must lock the destination and stop the preview line from following the pointer. Confirmation then animates the token along the displayed route.
- Crew may automatically open doors while moving. Opening delays movement and ATB timing; closing happens after passage without an additional wait.

### Combat

- Ship combat and surface combat are separate encounter modes. In ship combat, every combatant is aboard a ship.
- A combatant may target only characters aboard the same ship. Future boarding rules may move invaders between ship columns, but do not infer those rules early.
- GM and PC views must receive live turn updates without requiring a perspective switch or manual refresh.
- Embedded combat reuses its parent campaign stream through source/origin-checked messages. Do not open a second campaign EventSource inside the frame: GM and PC tabs otherwise exhaust browser HTTP/1.1 connections and stall action requests. Encounter streams remain separate.
- `ship-navigation.js` owns server-authoritative ship orders, AU spending, fractional positions, and inertia. Orders require an operational cockpit, EN output and installed operational thrusters. Full Move Speed takes 12 combat seconds. Arrival starts drift at max(0, floor(actual powered distance/2)-2), then applies max(0, floor(drift speed/2)-2) every 12 seconds. Persist the traveled counter. After input, mid-route orders replace the old route from the exact current position. AU boosts cost Exhaust 4 AU or Ionic 2 AU per selected thruster/order. Losing a boosted thruster removes remaining powered boost contribution but retains the frozen base order. Ordinary ship synchronization must preserve server navigation and spent AU.
- UPDATE: cockpit orders now enter a delayed input phase before launch. Read `PILOT-CONSOLE-PASS.md`: normal pilot ATB is frozen, other actions/Leave are blocked, existing flight continues, and AU is charged at launch. `delay-rules.js` shares the established calculation. Quality averages the top two operational thrusters (ceil, four-bar cap); Performance +4; Very Fast base 14; Pilot/Helm sets Ingenuity. Do not restore immediate launch. Forced departure cancels input, not an already launched route. Pilot console artwork is unique to the helm, not a generic skin for future weapon stations.
- `sic-web-assets.json` maps original PNG URLs to generated WebP derivatives through the server. Keep original source files unchanged for future printing; never resize the print masters to web size. `scripts/optimize-sic-assets.py` rebuilds derivatives without upscaling. Hull view exposes bridge/cockpit interiors through shared glazed canopies, not changes to EDG placement or collision.
- `prepareEncounter` replaces a battle in one validated, durable operation. Preserve saved preparation receipts on restore so retries cannot reset the encounter. Never reintroduce the client clear/add loop.
- `live-dom.js` preserves keyed live controls and unfinished input. Avoid replacing whole ATB sections during clock updates. Numeric edits must reach the server, not just remain visible in a field.
- `health-display.js` owns ship condition indicators. The GM sees exact character HP, Hull and Shields; player views show only condition icons for NPCs and ships. Keep exact totals out of player-facing tooltips and log text. Players retain their own character HP.
- `ship-power.js` owns shared EN/AU output and server-driven AU recharge. AU rating sets capacity and percent per combat second; stop at cap and obey the combat clock. Never refill spent AU during routine ship synchronization.
- Engine station bonuses use explicit `stationBonus` metadata, not the presence of AU output. Power Hybrids boost EN; Action Hybrids boost AU. Retain existing type IDs when changing display names.
- `campaign-time.js` owns GM Pass Time, daily recovery and carried-item recharge. Partial days and request receipts persist. Never trust a player save to overwrite server-owned recovery time, round away fractional recovery, or advance campaign time during active combat.
- Skill result dialogs submit only through Confirm and Submit; rerolls remain local until confirmed. Dice placement must use the visible intersection of parent frames, not the full height of an auto-sized combat frame.
- The GM must retain a visible notification, Command Window countdown, and confirmed ability to act for a disconnected player.
- Turn controls should not hide the ATB rings or ship map. Desktop action panels are compact and collapsible.

### Campaign Starships

- Creating or editing a ship from a campaign stays inside the GM Starships tab.
- Linked ships expose crew assignment to the GM. Any campaign character can be assigned, and assignments persist.
- Player Starships shows every linked ship on which that character is crew.
- `campaign.npcRoster` preserves deployed NPC identities across encounters. Ship editing, fleet assignment, and preparation must all include these NPCs, not only PCs. Never erase NPC crew when a player saves PC assignments.
- Crew assignment is not current location: `crew-overview.js` shows assigned ships, deployed location and station separately. Prefer live encounter locations over saved out-of-combat locations.
- Combat supports at most six ships. `ship-distances.js` owns axial hex positions and derived distances: one hex step equals one Unit (one Lunar Distance). The first two default positions are 25 Units apart. GM preparation uses whole hexes; live navigation preserves fractional positions. `space-map.js` renders the shared auto-fitted map and live routes. Keep its editor mounted during live updates and preserve focused inputs; the enlarged map belongs in the outermost accessible viewport.

### Demo Isolation

- Explore Features character storage is session-scoped through `character-storage.js`; never write demo characters, active-character pointers, or campaign selection into the personal library.
- The main-menu Create/View Character link opens `character.html?library=1`, without automatically resuming a campaign. Keep New Character accessible there.
- Opening a campaign character must preserve other saved characters in the personal library.

## Verification

Run the focused checks appropriate to the change and always run the full test suite before publishing:

```powershell
npm test
node --check app.js
node --check character.js
node --check ship-combat-map.js
git diff --check
```

When system Node is unavailable, use the bundled Codex Node runtime. Start the local app with `npm start` or `START ATB MULTIPLAYER SERVER.cmd` and verify the affected GM and PC workflows in a browser.

Do not edit or commit `data/campaigns.json`; it contains local playtest state.

Optional desktop mouse regression: `node scripts/playtest-cockpit.cjs` with Playwright available and Microsoft Edge installed (or SA_BROWSER_CHANNEL overridden). It starts an isolated temporary server, checks three NPC and three PC ship orders, live enlarged maps, parent campaign-stream reuse, and card dimensions/artwork; finally closes its browser and server. Screenshots go to ignored test-artifacts/cockpit. API-created character fixtures are not full character-creation UI coverage.

## Publishing

When the user says `#commit`, complete the requested work, verify it, commit it, and push `main` to `origin`. Report the commit hash and any checks that could not be run. Gold Standard remains frozen; do not refresh it.

After all task work, verification, publishing, and cleanup are complete, send the user's completion notification as the final tool action. Do not send intermediate or incomplete-task notifications:

```powershell
Invoke-RestMethod -Method Post -Uri "https://ntfy.sh/SPACESHIPATB" -Headers @{ Title = "Codex Finished" } -Body "Your Codex task is complete."
```

## Code Map

- `server.js`, `campaign-store.js`, `campaign-api.js`: server and persistence
- `app.js`, `combat-actions.js`, `combat-engine.js`: shared ATB and combat behavior
- `gm.js`: GM campaign interface
- `character.js`: character creation, player campaign interface, and PC ship view
- `starship.js`: Construction Bay and SIC placement
- `ship-map-core.js`: shared ship topology, doors, floorplans, stations, and movement helpers
- `ship-power.js`: installed engine output, occupied-station bonuses, and AU capacity/recharge
- `ship-combat-map.js`: combat ship-map presentation and interaction
- `tests/`: combat location, ship-map, and crew persistence regression tests
