# Movement, Ship Upgrades And Flexible Mounts

Completed locally on September 12, 2026. No commit, push, Render traffic, Gold Standard changes, or personal campaign-save changes. Earlier uncommitted work is preserved.

## Completed Requests

- GM Move Speed edits now save in Explore Features. The adjustment iframe carries showcase mode and reads the correct session credentials. Actual Nova edit to 9 and server persistence passed.
- Move Speed includes the complete Athletics/Endurance rating, including fractional skill levels. The formula and skill description agree. Both combat timing and the actual PC ship animation cover a three-mesh route in 3 seconds at Move 3 and 1 second at Move 9, excluding door waits.
- Fixed the first combat segment charging time for fractional steps that were not actually in the route. Subsequent segments already used actual step counts.
- Maximum D6/D8 advancement results are kept once without offering Reroll/Keep; lower results retain the existing choice.
- PC Starships movement controls occupy the spare space on the right, outside the map. The original sheet proportions and left-side Map View switches remain.
- Expand Zone adds two rows and columns to every edge. The zone supports 20-60 columns and rows; the existing 400-hull-square scale limit remains. Centering, costs, doors, crew/NPC positions, stations, printing and combat maps use the shared dimensions.
- PCs can use Upgrade Ship to enter the shared construction/SIC market, buy and confirm upgrades, then Return to Ship. Unsaved return asks before discarding. Upgrades are disabled during active combat. Campaign View behavior is unchanged.
- Break Lock-On displays installed break difficulty, not dice. Both Wayfinder sheet layouts show 22.
- Encounter Control offers saved custom NPCs, preserving their stats, with ship and starting-location selection. Preparation offers campaign ships even when unchecked; assigning an NPC also selects its ship.
- Move Ship flashes navigation green once and enables pointer route preview until the destination is selected.
- Ripple Cannons default to the maximum affordable burst and preserve a manually reduced choice.
- Destruction shows the explosion first, then debris.
- Creator tabs are Construction / SICs / Ship Details, with distinct non-blue active gradients. Installed equipment appears below Map View, newest placement/purchase first.
- All Thrusters offers common exhaust directions or the existing automatic hull-edge orientation. Four differently mounted thrusters were checked with exhaust left. Tapered mounts connect external sprites to the hull in high/low resolution.
- EXT/EDG SICs use independently rotated and positioned interior/exterior sections. Select the interior first, then the exterior. One orthogonal shared-edge pair is sufficient; corner-only contact, enclosed voids, overlaps and detached sections are rejected. It remains one purchased SIC.
- Existing rigid mounts remain valid. Remove/reinstall an existing mixed SIC to use the new split placement. Both parts persist through campaign and encounter normalization and station access.
- Incomplete split placement cannot be confirmed. Storing, refunding, changing selection, cancelling, resizing or restoring a draft clears the relevant unfinished placement. The storage case failed in Chrome before the fix and passed after.

## Additional Corrections

- Systems Analysis snapshots now retain grid dimensions, exterior-section rotation and shared thruster direction, without exposing uninstalled cargo or crew locations.
- The Analysis processing message now reports the already-approved 12-minus-sensor-level duration instead of a hard-coded 12. No new timing rule was introduced.
- Removed the duplicate Map View overlay in construction without removing the original left-hand controls.
- PC ship iframe height is based on its content rather than its own expanded scroll height, preventing an increasing empty area.
- Explore ship drafts and selections are session-scoped; PC upgrade requests use PC credentials rather than accidentally preferring a GM token.
- Dice windows now show loading status and a Retry Loading Dice button when loading stalls. The child acknowledges successful opening; duplicate setup messages preserve unfinished input. Retrying loading never rolls dice or releases ATB.
- One intermittent blank dice frame occurred during the network-interception test and passed on rerun; its original cause was not established. The harness now installs interception before navigation, and an explicitly blocked dice script verifies the visible recovery path. Do not claim the intermittent cause was identified.
- Restored existing line endings on unchanged lines in three historically mixed-ending files to avoid unrelated diff churn; code content was unchanged by this formatting correction.

## Verification

- Full Node suite: 220/220 passing, including new fractional movement, Athletics/advancement, flexible mounts, expanded campaign persistence and private Analysis snapshot coverage.
- Chrome flexible-mounts: actual GM edit/save, Wayfinder 22, two-stage mouse placement, storage cancellation, four aligned/attached thrusters, all-edge expansion, zero translation charge, confirmation/reload, desktop/mobile and exactly one visible Map View.
- Chrome ship-workflows: PC purchases/confirmation/return, all six switches and their map effects, main-sheet movement and actual 3-vs-9 animation duration, read-only consoles, one-page high/low printing, centering/crew/doors, EN guard and preparation drag/zoom/ranges.
- Chrome local-restoration: saved NPC stats/start location, cancellation, automatic NPC prompt, preserved input during impact, explosion/debris ordering, End Combat and initially unchecked ship deployment.
- Chrome new-weapons: all three weapon families with manual damage and Ripple default/manual-override behavior.
- Chrome visual-corrections: 31 distinct nonblank artwork levels, overhead four-way walking/corners, reduced motion and enlarged maps.
- Chrome cockpit: navigation green flash, PC/NPC orders, station arrival and turn visibility.
- Chrome held-turn, weapon-clock, combat-recovery and menu-recovery: natural NPC turns while Nova holds, locked/unlocked Ripple/Ion, PC/GM manual damage ownership, cancellation/reload, failed submission retry, offline takeover, blocked dice loading, overlapping prompts/defeats, unfinished form preservation and restart/authentication recovery. No perspective-switch workaround.
- 77 root/browser JavaScript files passed syntax checks. Test browsers and temporary test servers closed.

## Preview And Boundaries

Fresh isolated preview: http://127.0.0.1:8791/showcase.html
GM entry: http://127.0.0.1:8791/gm.html
Server PID: 10144.
Separate data/logs: C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-ship-upgrades-20260912.

Older servers were left alone. Use the new URL or restart the user's own local server and refresh Chrome. Current requested batch is complete. The earlier unanswered question about moving from the large PC Starships sheet during active combat is unchanged: combat movement continues through Combat, while same-sheet out-of-combat movement is verified.
