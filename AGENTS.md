# Spaceship Architect Working Guide

## Product Direction

Spaceship Architect is a multiplayer tabletop RPG companion for campaign management, character creation, starship construction, and real-time ATB combat. The GM desktop workflow is the primary development target. Keep mobile broadly functional, especially page scrolling and core controls, but postpone mobile-only refinement until the desktop experience is stable.

Treat the existing application as one shared product. Do not create separate desktop and mobile implementations unless the user explicitly requests that architecture.

Gold Standard folders are frozen: do not edit, replace, or refresh them. Create a future Diamond Standard snapshot only after explicit user approval of a stable build. Wired Downgrade is retired; do not implement it. Connector Cable's future is undecided.

Read `RULEBOOK-REFERENCE.md` before changes involving game rules or SIC expansion. It summarizes the core rulebook and both SIC catalogs, records unresolved source discrepancies, and distinguishes printed rules from approved digital changes. Initiative and action timing are intentionally computer-driven; do not restore the book's tabletop turn order.

## How To Work

- Read the relevant implementation and reproduce the reported behavior before changing it.
- For visual or interaction bugs, verify the result in the running application with realistic mouse interaction. A passing unit test alone is not proof that a UI bug is fixed.
- Use Explore Features for rapid checks, then use a fresh campaign when the change concerns persistence, linking, crew assignment, permissions, or GM/player synchronization.
- Preserve user changes and unrelated work already present in the working tree.
- Keep changes focused, but follow a shared behavior through every view that uses it.
- Communicate in concise, non-technical language unless technical detail is useful for debugging.
- Do not claim broad playtesting unless those workflows were actually exercised.

## Important Invariants

### Starship Maps

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
- `ship-power.js` owns shared EN/AU output and server-driven AU recharge. AU rating sets capacity and percent per combat second; stop at cap and obey the combat clock. Never refill spent AU during routine ship synchronization.
- The GM must retain a visible notification, Command Window countdown, and confirmed ability to act for a disconnected player.
- Turn controls should not hide the ATB rings or ship map. Desktop action panels are compact and collapsible.

### Campaign Starships

- Creating or editing a ship from a campaign stays inside the GM Starships tab.
- Linked ships expose crew assignment to the GM. Any campaign character can be assigned, and assignments persist.
- Player Starships shows every linked ship on which that character is crew.

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
