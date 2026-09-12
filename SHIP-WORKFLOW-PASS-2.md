# Ship Workflow Pass 2

Authorized by the second September 11 #commit, following Reliability Pass 1.

## Player Workflows

- The PC Starships tab embeds the shared Ship Details sheet, purchased SIC cards and Locate behavior. Crew markers update from the same saved/live positions as Combat. The Campaign tab's View behavior is unchanged.
- Move opens the existing precise interior movement controls. Diagnostics and their pending/completed results remain accessible outside combat.
- Stationed PCs can browse their consoles outside combat, including the console selector and operation tabs. The preview cannot send combat commands, spend AU, run the clock or reconnect to the live encounter on focus. It is visibly marked as a preview.
- Victory acknowledgment by the surviving PC crew ends combat and returns to Starships, allowing ordinary movement and maintenance. The server verifies the victory and the character's authorization.
- Stored weapons appear with Items in Storage. Root Combat View help is on the action buttons themselves, without separate question-mark buttons.

## Construction And Print

- Expand Zone adds ten rows at a time, up to a 20-column by 60-row working zone. Existing cell IDs and old saves retain their 20-column stride. The current 400-hull-square scale limit remains; this adds room for longer layouts, not a new above-400 scale rule.
- Center Ship moves the hull and installed exterior/interior SICs together, preserving door keys and saved crew positions. It is blocked during active combat. Undo restores the prior offset.
- Negative EN blocks confirmation, flashes the affected rating, and displays the reason alongside the top confirmation button. Working construction statistics are enlarged and show the pending design; Ship Details continues to show confirmed ratings.
- Mobile Construction prioritizes the map and construction inventory rather than showing the complete statistics sheet first. Ship Details retains the complete sheet.
- Print Starship offers high- or low-resolution floorplans, one landscape Letter page, using the shared walls, doors and exterior graphics. Small mesh squares print at half an inch when the ship fits; larger ships shrink to fit one page. Print dialogs are hosted in the visible outer window. Printing does not overwrite saved designs or change artwork masters.

## Movement And Feedback

- Powered travel covers Move Speed in **10 combat seconds**. Inertia remains on **12-second** periods, starting from actual distance traveled and repeatedly applying `max(0, floor(previous / 2) - 2)`.
- Full Pilot Console: Move Ship, choose a hex, inspect the solid powered route and dotted final inertia endpoint, then Confirm Move. The compact root planner starts at destination selection. The estimate includes input plus powered arrival time, then drift distance/time. No idle mouse-follow route.
- Systems Analysis retains operator input followed by report processing. The second stage now takes `max(1, 12 - sensor tier)` seconds: Sensors 1 = 11 seconds, Sensors 3 = 9, Sensors 9 = 3. This does not change character rounds, AU regeneration, shield timing or inertia. Future comparable fixed SIC processing delays should use the approved tier subtraction and explicitly notify the user.
- Console input uses quiet synthesized keyboard clicks, respecting mute/pause and stopping with the action. Console changes slide out for 500 ms and in for 500 ms, following arrow direction; reduced-motion preferences bypass the animation.
- Lock-On uses the shared starmap, with a stable visible gold target reticle. Unchanged targeting maps are not rebuilt every refresh.
- Explosions are anchored inside the destroyed marker's own SVG coordinates. Debris retains the marker color. Impact tests verify small screen-pixel shakes and the explosion's center at multiple zooms.
- Resume controls pulse. When there is no detected opposing ship, the empty combat column shows a nonflashing activity log.
- Prepare Combat ships drag to a hex and commit on release without refitting the map. Zoom and Fit Ships are explicit. Range overlays show base range and the doubled range against Masking <= 0; the legend explains that automatic identification also depends on Masking, not distance alone.

## Additional Reliability Fixes

Browser testing found and fixed preview focus recovery overwriting preview state, a missing sensor-report collection in read-only previews, print doors missing their shared dimensions, a tall expanded grid affecting its viewport size, EDG validation retaining the old boundary, and preview dialogs opening outside the visible viewport. Embedded ship loading now waits for its correct record, retries the parent handshake, and reports failure instead of showing an unrelated local draft.

## Verification

- 174 unit/HTTP tests; JavaScript syntax and whitespace checks.
- Chrome 4x CPU audit: repeated GM/PC switching, three consecutive NPC prompts, sticky HUD, mirrored action tabs, compact lower map controls, slow-network console styling, GM-owned dice and persistent results. Four switches transferred approximately 0.79 MB; measured switch times across two checks were 1.15-1.82 seconds on this machine.
- Twelve cockpit orders across fresh campaigns and Explore, with compact/full planners, Hold and shared state.
- Sensor GM/two-PC suite, including explicit rolls, queued analysis, Life Scan, diagnostics, pending-roll restart and recovery.
- Shield suite: remote/local access, shared AU, occupancy, restabilization and restart.
- Laser/Lock-On suite: direct root actions, explicit damage dice, anchored impact, destruction, Victory and responsive consoles.
- New `scripts/playtest-ship-workflows.cjs`: shared PC details, crew marker, print modes, read-only preview, movement entry, centering/doors/crew persistence, negative EN, desktop/mobile, preparation drag/zoom/range rings. Both PDFs were inspected and contain one Letter page.

These are API-created fixtures followed by browser interaction, not a new source-blind character-creation usability run. Browser timing is not a guarantee of identical laptop performance. No personal campaign data, artwork masters or Gold Standard files were edited. Hosted publication verification is recorded in CURRENT-HANDOFF.md.
