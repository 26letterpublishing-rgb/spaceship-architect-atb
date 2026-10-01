# Local performance and navigation pass — September 29, 2026

Local changes only. No commit, push or deployment. Restart the Spaceship Architect server and refresh GM/PC pages to use all changes. Personal campaign data, Vector, Gold Standard and previous uncommitted work were preserved. Browser testing used a disposable server on port 8792.

## Six priorities completed

1. **Persistent maps.** Weapon, sensor, probe, lock, navigation, enlarged and main combat maps now update existing SVGs and markers. Movement no longer rebuilds the map and its ship artwork. Main combat rendering also avoids generating map markup that would immediately be discarded. Changed contacts, cloaking, destruction and scenery still update their appearance; tractor/pod/flare overlays remain live.
2. **Smooth motion.** A shared animation loop interpolates the received authoritative coordinates. It handles ships, moving scenery, mines/probes represented as contacts and uncertainty halos. It stops when paused or disconnected and does no work for stationary markers. Rendering never advances game time.
3. **Less hidden work.** Combat interiors skip layout work while hidden behind another tab or station console; they catch up when shown again. The crew-token observer now reacts to relevant crew/oxygen changes instead of all interface mutations. This also reduces work while menus, dice and ATB effects update.
4. **Static graphic reuse.** Cached compiled floorplans are reused before revalidating a saved image. Existing map artwork and geometry remain mounted across position updates, rather than repeatedly loading/recreating them.
5. **Cheaper synchronization.** Each server broadcast computes the authorized encounter view once per matching viewer identity. Shared snapshots are reused for connections with the same permissions. Client delta application copies each changed branch once; unchanged ship hardware remains shared. PC visibility filtering, reconnect snapshots and manual roll ownership remain intact.
6. **Prepared standard dice.** Ship-action dice use a prepared, reusable instance of the existing character dice window. Repeated rolls no longer reload that page. Retry/ownership/result validation remains in place. No alternate roller or automatic result was introduced; out-of-combat preview windows do not prewarm unused dice.

## Other requested changes

- Five colored action groups: Movement; Sensors & Comms; Targeting & Weapons; Defense; Utilities. Existing maintenance and disabled-reason explanations remain. Ram and Skim are in Movement; Break Lock-On and Evasive Maneuvers are in Defense.
- Hold is a red octagon; Resume becomes a green circle. Leave Console uses a right-arrow silhouette. Styles cover the turn panel and station/navigation consoles.
- Fullscreen starmaps support drag-panning. Dragging does not confirm a movement destination. Fit Contacts clears the manual camera. Preparation-map marker dragging remains separate from background panning.
- Transporter has four stations and preselects stationed passengers. Existing five-person room capacity remains; four stationed crew can transport together. Non-operator passengers on Hold are allowed and leave Hold after transport.
- Zero-HP crew use a prone silhouette in their own color. Combat and ship-detail views receive the relevant health state, including visible NPCs; hidden intruder filtering remains in force.
- Gravity now spreads each sampled pull across **5 active ATB seconds**, replacing 24. Pull adds inward displacement to powered travel instead of slowing every heading indiscriminately. The selected destination is retained. Old cadence samples restart using the new period; new samples survive saves. Ship facing is not changed by gravity alone.

## Verification

- Full automated suite: **736 passed, 0 failed** (final run approximately 58 seconds).
- Focused gravity, mine, Transporter and weapon checks: **55 passed**. Includes inward acceleration, old cadence handling and four stationed/holding passengers.
- Added movement regression tests for intermediate coordinates, stationary markers, pause and disconnected-node cleanup.
- Browser movement harness: 30 position updates, **zero SVG/marker/artwork replacements**, and intermediate positions on all 30. Median frame interval 16.7 ms, 95th percentile 16.8 ms, zero intervals above 50 ms. This is an isolated renderer check, not an FPS guarantee for every fleet or device.
- Mouse/browser checks: grouped NPC actions and submenus; enlarged navigation; drag-panning; Fit Contacts after dragging; destination locking/confirmation; cancel and return; repeated PC Character Sheet/Settings/Starships/Combat switching; collapsible character reference panel; GM Characters/Starships/Combat switching.
- Two real weapon-input rolls completed through the standard animated dice UI and Confirm and Submit. The second reused the prepared dice window. No browser errors were observed in those GM/PC checks. Visible top-level sheet/fleet images reported no missing or pending images during inspected menu transitions.
- Follow-up visual inspection caught and fixed the existing button skin overriding category colors. Expanded navigation retained its movement controls after panning.

Evidence: `test-artifacts/performance-pass/action-categories.png`, `map-measurements.json`, `verified-suite.log`, `focused-final.log`. Temporary test launchers and server are removed/stopped after verification.

## Playtest focus / limits

Five seconds is deliberately much stronger: 24/5 = **4.8 times** the prior pull rate at equal sampled strength. In the unattended intensity-3 test starting at distance 2, the ship reached the center in about **6.3 active seconds**. A character charging at 5% per second from zero gets no full turn in that interval. Pausing ATB pauses suction; approaching the center can still be rapidly fatal.

The isolated renderer measurement cannot establish an overall before/after speed ratio for the recorded encounter. The browser tests cover the changed workflows and repeated navigation, not every SIC combination or every device. Please prioritize a large multi-ship encounter, movement alongside a black hole, and repeated station/dice/character-sheet switching in the next playtest.
