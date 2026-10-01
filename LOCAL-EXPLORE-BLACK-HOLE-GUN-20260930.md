# Explore fixes and Black Hole Gun

Completed locally September 30 2026. No commit, push or deployment. Earlier uncommitted work and personal campaign data were preserved. Tests used a separate data directory and port 8792; the normal server on 8790 was not modified or stopped.

## Explore and combat flow

- Explore NPC automation can continue while you play Nova. Personal attack and First Aid rolls use the existing dice animation and wait for its completion. Explore automatically handles their GM difficulty/damage confirmation gates; normal campaigns retain GM control. Player-owned rolls still require the player. GM-authored custom delay requests are not turned into automatic decisions.
- Console View reacts immediately to combat-state and visibility changes instead of waiting only for the old polling interval.
- Victory acknowledgement accepts acknowledgement-only responses and always offers an escape from the notification, including a failed request.
- Missiles receive unique serial labels. Duplicate ship names receive numbered suffixes when saved.
- Spread missiles start as one projectile, then split into four during flight. The chosen split point is halfway along the original launch-to-target distance. The children retain the parent's travel progress.
- Starship wreck icons wait for the destruction presentation. Ships with completely depleted shields use Hull circles in the attack-map display.
- SIC Maintenance is available from the shared console header. A Bridge can remotely power off or restart installed systems. Power On and Repair require the actual system's station. Captured-console maintenance returns to the hacking controls; it does not accidentally operate your own Bridge.

## Loading and maps

- Explore sends lightweight summaries for unselected ships, rather than all their layouts, inventory and saved floorplan images. Begin Combat fetches the selected layouts with visible loading feedback. Explicit ship inspection and a ship already crewed by the PC can also load its details. The full sample definitions remain stored on the server.
- Expanded ship interiors receive their own floorplan-snapshot stylesheet so images cannot escape the proper map layer.
- Zoom buttons preserve the center of the view and have an upper zoom limit. Fit Ship remains available; Enlarge / Character focuses the current PC or selected combatant at about fifteen interior squares across.
- Interior and starmap views support drag panning. Construction placement and GM object dragging retain their separate interactions. A movement threshold separates dragging from destination selection.
- Interior camera position survives a map redraw or High Res toggle. Character focus now finds the current PC even before a separate Move dialog has selected that character.
- Black Hole Gun targeting initially frames the firing ship and its five-unit range instead of fitting distant contacts. The expanded view retains intensity, coordinates, cost and launch controls.

## Campaign and Crew Logs

- The GM Campaign Clock is at the top of Script. The PC Campaign view uses more of the available width.
- A Crew Log drawer appears in the PC Campaign tab. Players can rename it, select an existing session, save, submit to a connected GM, export an entry, and import an entry with a replacement confirmation when that session already has different text.
- Unsaved drafts persist locally by campaign, character and session. Server revisions prevent a stale browser from silently overwriting a newer entry.
- The GM reviews submitted logs in Prompt / Give. Approval sends one claimable +1 Reverence reward to the PC Inbox. Repeated approval or repeated Receive requests cannot duplicate it.
- Library consoles show logs from characters crewed on that ship. The GM can publish a titled Data Entry to all Libraries.
- Library, Gym and Surveillance consoles have new AI-generated eye-level room artwork and restrained display animations. The Gym displays its current gravity state. All six new art assets are optimized WebP files, approximately 641 KiB combined.

## Black Hole Gun

- Added B-104 to purchasing, placement, fabrication and station controls, with generated card art, an interior control room and exterior barrel.
- Costs one Dark Phazon per launch. Intensity costs follow n(n+1)/2 AU: 1, 3, 6, 10, 15 and so on. The console displays the cost before firing.
- Select a fixed hex within five units. The glowing purple orb travels one hex per twelve active combat seconds.
- Arrival creates a temporary black hole at the purchased intensity. Every five active seconds it loses one intensity, disappearing at zero. Deliberate combat pauses pause these timers.
- Uses the existing smooth gravity, destruction and object-consumption rules. The launching ship is not immune; Gravity Absolution still protects ships.
- A hacked gun spends the captured ship's AU and Dark Phazon, and can be aimed at that ship's own hex. Access and resource checks remain on the server.
- Retained the printed 360-second cooldown, EN 4, Security 4, threshold 17, price 345,000 and Aethion / three-week crafting recipe. Cooldown also progresses through campaign time outside combat.
- Uses a two-by-five exterior barrel and one-by-two interior control room. Fixed the new barrel's rendering so it uses the weapon-art layout rather than the thruster assembly layout.
- Launch consumes the operator's turn. Duplicate submissions cannot spend resources twice. Flight, decay and cooldown data survive saving and reloading.
- Fresh Explore rooms include the gun on Cleaning Lady. Launching requires an active encounter; an enemy-free encounter is sufficient.

## Verification and practical limits

The final full automated suite passed 760 tests with zero failures. An additional 22 focused map, console and gun tests passed during the final camera corrections, followed by 12 gun/map checks after correcting the barrel aspect ratio. Syntax validation covered 142 root JavaScript files; whitespace validation passed.

Mouse checks in the isolated Explore room covered ship selection/deployment, switching GM/Nova, gun console opening, intensity selection, a real launch spending 6 AU and one Dark Phazon, turn consumption and cooldown, expanded targeting, target-line selection, drag panning without changing that selection, remote maintenance availability, interior expansion, character focus and High Res toggling. A Crew Log was saved through the PC interface. NPC automation continued through scan and lock acquisition while Nova was selected.

Automated integration tests cover journal submission/approval/claim permissions, offline submission refusal, backup/reload, Library sharing, lazy ship data, NPC animation acknowledgement, captured gun resources, pause/reload, travel and decay, friendly destruction and Gravity Absolution. The complete journal approval-to-Inbox journey, all three new room consoles, and every possible console/map combination were not individually replayed by mouse. These are useful first playtests; passing automated checks is not a promise that every multiplayer or display configuration is flawless.

The Word backlog was rendered with Microsoft Word because the bundled document renderer could not find LibreOffice. All three output pages were visually reviewed after correcting page breaks.

## How to test locally

Restart the usual Spaceship Architect server on port 8790 and refresh the app. Start or reset Explore Features to get the revised Cleaning Lady. Deploy it, put Nova at its Bridge or Black Hole Gun station, and select Black Hole Gun from the console list. Intensity 3 should display 6 AU plus one Dark Phazon and a 15-active-second black-hole lifetime. A target three hexes away takes 36 active seconds for the orb to reach.

The maintained backlog is REMAINING-SICS-20260928.md, with updated Word, PDF and text copies in outputs. It now lists 19 remaining candidates; previously excluded or held SICs remain omitted. The next straightforward practical addition is Ionic Force Displacers, while Reverse Targeting ID still needs a distinct benefit beyond the warning already built into the app.
