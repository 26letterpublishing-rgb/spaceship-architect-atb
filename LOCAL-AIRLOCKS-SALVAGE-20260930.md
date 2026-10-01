# Airlocks, hull breaches, mining and salvage — local update

Completed September 30, 2026. Local working changes only; no commit, push or deployment. Existing unrelated work, personal saves, Vector and Gold Standard were preserved.

## Ship emergencies

- Finished ships receive an airlock on a blank hull square beside exterior space. The builder supports placing, duplicating and removing airlocks; removing the last one recreates a valid airlock. A ship without a valid blank perimeter square cannot be saved or imported until adjusted.
- Standing on an airlock exposes Open/Close Airlock. Opening requires an explicit warning confirmation. Closing uses no repair roll. Open airlocks use the same oxygen and suction system as breaches, with an open hatch instead of a hole.
- Bridge Command → Preparation → Door Adjustment opens a full interior map with zoom, Fit Ship and drag panning. Online Bridge station authorization is checked by the server. Unrestricted remote door manipulation from the ship sheet was removed; normal nearby door interaction remains.
- The door map uses floorplan art, single room labels and enlarged door hit areas. Panning excludes door and airlock controls. Open doors have a green outline.
- Four SIC impairments create a hole at a random interior square. Occupants receive a normal Dexterity + Initiative roll against 16 minus their movement distance in hull squares. The agreed fallback uses direct square distance when a valid route cannot be found.
- Failed checks eject the character outward at least one hex, show a suction animation and notify the player. Floating bodies appear on the starmap. Vacuum deals 1 HP every 2 active seconds; drift is 1 hex every 12 active seconds. These clocks pause with combat time.
- An operational Manipulation Arm automatically retrieves a floating character in its ship's hex and places them beside an airlock. Its card now explains this benefit.
- Breached rooms vent from full oxygen to zero in 24 seconds when isolated. Open doors share atmosphere with adjoining rooms; larger connected spaces dilute the loss. Closing an airlock or sealing a hole lets the existing Life Support system restore oxygen.
- Repair Hull Breach is available inside the affected room: six active seconds, Dexterity + Engineering difficulty 20, reduced by one for each attempt by any character. A newly created breach starts at 20 again.
- Brig doorways use the reinforced cell rule: three hits of at least 40 damage. Ordinary doors remain three hits of at least 10. System Repairs and Diagnostics repairs damaged doors.
- Airlock placement, opening state, breach state and extraction jobs survive campaign saves, combat preparation and encounter synchronization.

## Mining Lasers and Vulture Drone

- Mining Lasers have their own card, correctly split exterior/interior footprint, station and console. Mining takes four hours of game time, then a real D10 check against the GM's asteroid cutoff. Success proceeds through the printed random mineral chart, including percentile, mythic and quantity rolls. Results are deposited in shared ship mineral storage.
- Asteroids default to one mining attempt. The GM can set 1–50 uses. A single higher-resolution asteroid asset grows in five-use steps; exhausted asteroids disappear. This avoids ten separate images.
- Vulture Drone has its own card, floorplan and console. One 240-second salvage operation per wreck selects from installed SICs with zero impairments. A recovered SIC enters ship storage; completing salvage removes the wreck's debris marker.
- Power loss, control loss or range loss pauses eligible work. Drone impairment/destruction or disappearance of the wreck cancels salvage. Active drones are targetable, use their damage threshold and can be pulled into black holes.
- Selection and chart rolls use the normal dice interface; completion receipts prevent duplicate minerals or recovered SICs. Explore Foundry and Workshop include the new equipment.

## Console and interface polish

- Hold/Resume now retain equal width and height: a regular octagon or circle.
- Tutorial boxes use the requested dark panel/yellow border appearance. They grow before paginating, and checking Disable Tutorial Popups takes effect only after Okay.
- Crew assignment lists show names and checkboxes. Save Assignments turns green when edited and returns to gray after saving.
- Power On, Power Off, Restart SIC and Repair SIC are distinct controls on the shared console layout, including the Bridge. Existing station, power, turn and repair restrictions remain authoritative; unavailable controls explain why.
- Disabled SICs remain inspectable with desaturated, dimmed views. The controls do not bypass the requirement to occupy the station for local Power On or Repair.
- Bridge activity and fleet panels now sit inside their frame recesses. The tactical ring is higher. Long fleet lists scroll within their own area instead of burying power controls, and preview timelines omit empty ships.
- Library and related crew-room art fills the central scene. VR Training and Medbay have in-universe room views with subtle animation. Nutrition has a new dispenser scene and dispensing effect. Life Support has instruments, radials, oxygen/power meters and an animated waveform.
- Equipment-card graphics are separate from room floorplans and console scenes. New generated equipment art covers VR Training, Medbay, Gym, Library, Meeting Room, Docking Bay, Science Lab, Surveillance Camera and Gravity Absolution Field. Utility consoles also received dedicated in-universe scenes.
- Generated masters are retained; compact WebP delivery assets and their provenance are listed in ASSETS-AIRLOCKS-SALVAGE-20260930.json. Tiny hazard/body markers are delivered at appropriately small resolutions.

## Verification and limits

- Full regression run: 796 of 797 tests passed. The remaining HTTP workflow hit a five-second timeout while building the complete Explore fleet; that setup step now has a 15-second budget while ordinary requests retain five seconds. Its complete targeted rerun passed. Thus all 797 tests passed across the full run and rerun, not in a single clean full run.
- 147 application JavaScript files passed syntax validation; CRLF-aware whitespace checks passed.
- Tests cover placement/rejection/remapping, suction, paused clocks, damage/drift/rescue, repair attempts, airlock confirmation, isolated-room oxygen, reinforced doors, mineral charts, mining limits, salvage interruptions and duplicate protection. A real HTTP workflow covers multiplayer save/link flows and breach ejection.
- Browser testing used a disposable local Explore room: tutorial checkbox/Okay behavior, dirty crew assignments, station movement, console reopening, Bridge frame and maintenance controls, Life Support display, and the Door Adjustment map. Door activation was verified with keyboard input. Browser mouse automation was inconsistent, so a complete mouse-only door workflow is not claimed.
- The breach/ejection cinematic and every mining/salvage step were not replayed visually end to end; their mechanics were verified automatically. Long multiplayer endurance and performance testing remain part of the final playtesting phase.
- The remaining-SIC PDF was rendered and both pages visually inspected. The DOCX was regenerated, but its separate Word rendering could not be checked because LibreOffice is unavailable.

## First playtest

Restart the normal local server, refresh the app and reset Explore Features to obtain updated sample ships. The normal server was not interrupted during this pass.

1. Use Foundry: occupy its Bridge, open Door Adjustment, zoom/pan and open/close several doors. Verify a non-Bridge operator cannot remotely change them.
2. Open an airlock during combat, resolve suction, pause time, attempt a rescue and close the hatch remotely.
3. Destroy a room with four impairments; compare its oxygen loss with adjoining doors open versus closed. Fail a repair and confirm the next difficulty is lower.
4. Mine a multi-use asteroid using GM Pass Time; test failure, success, chart rolls and depletion. Salvage a wreck, then test power loss, drone damage and black-hole interruption.
5. Confirm new room art and maintenance buttons on your usual screen size. Test Hold/Resume and tutorial dismissal again in a fresh Explore room.

Ten in-scope SICs remain. The categorized list and implementation questions are in outputs/Remaining_SICs.pdf, .docx and .txt. Reverse Targeting, Separation Module, Custom Build and FTL-battle-only SICs are omitted.
