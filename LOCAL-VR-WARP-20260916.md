# Local VR simulations and warp console repair — September 16, 2026

Completed Jason’s request locally. No commit, GitHub push, deployment, campaign-data edit or Gold Standard update.

## VR Training Room

- Attribute dropdown follows the character sheet’s eight attribute groups. Skills are alphabetical within the selected group.
- All 60 standard skills are represented, including skills not yet saved on a character (shown as 0.0). Existing custom skills remain available under Other skills.
- Each standard skill has a distinct simulation title, activity and discovery. Examples: Projectile → Tactical Range: Target Practice; Melee → Tactical Range: Close-Quarters Sparring; Gambling → Orbital Casino Practice Table; Lift/Push/Pull → Cargo Handling Training Bay.
- Room Status names the character, describes the activity, and gives a related observation after simulation or training. The message and selected simulation survive reopening/reloading.
- Simulation names remain editable. Saved generic “Holodeck: [skill]” defaults are replaced in presentation; custom names are retained.
- The 3x3 room, safety switch, stations, manual D4 confirmation, once-per-campaign-day training, +0.1 above 4.0, and 6.0 ceiling remain intact. Skills already at 6.0 stay out of the training list. Running a practice simulation does not consume the daily training award.

Implementation: skill-catalog.js shares the character sheet’s attribute mapping with the server. vr-simulations.js centralizes descriptive content. ship-crew-rooms.js validates and persists simulation/training status; crew-room-console.js renders the categories. The skill catalog is a public browser asset; the simulation server module remains private.

## Warp console

The shared console section rule overrode the transit scene’s relative positioning. Warp artwork consequently expanded over the dialog, hiding the header and controls. A more specific transit scene rule now contains that artwork and prevents it from intercepting clicks.

The header Close Console works, and the bottom button reads Return to Ship outside combat. Both close the display while activation or travel continues. Combat Leave Console behavior remains unchanged. Closing also cleans up the console’s refresh timer and page-unload listener. Route calculation, fuel consumption, activation, travel, cancellation, early exit and self-destruct rules were not altered.

## Decisions made without asking

- Used all canonical skills as the starting list, treating absent stored ratings as 0.0; did not remove the existing 6.0 training ceiling.
- Used existing character-sheet attribute assignments, including the established default attributes for spacecraft skills; custom skills use Other skills.
- Used firing/exhaling flavor for Projectile and close-combat breathing/footwork for Melee.
- Narrative discoveries are flavor, with no extra mechanical bonuses. Practice simulation status explicitly says no training award.
- Added Return to Ship as an additional outside-combat exit; closing a console does not cancel a running journey.

## Verification

- Full automated suite: 417 tests passed, zero failures.
- Chrome crew-room playtest: all eight skill groups and their lists, missing 0.0 skills, simulation title/theme, character-specific report and reopen persistence; existing D4, +0.1 and 6.0 ceiling flows; Library, Meeting Room, Medbay, AI, and desktop/mobile console checks.
- Chrome warp playtest: actual PC console, artwork bounds and reachable close button; closing/reopening at standby, activation and during travel; cancel activation, GM travel time, animated flight, early exit, self-destruct cancellation, and mobile controls.
- Chrome ship workflow, held-turn and weapon-clock regression scripts passed.
- Syntax and whitespace checks passed. Screenshots inspected for the VR categories/status and corrected warp standby/travel screens.
- Tests used separate temporary campaigns and servers. Test-owned browsers and servers close in their cleanup handlers; the user’s server was not restarted.

Evidence is in ignored test-artifacts/crew-rooms, test-artifacts/warp-transit and test-artifacts/vr-warp-full-tests.txt. Restart the local server and refresh the browser to load the server-side VR changes.

The earlier typing-hands indicator, roll-margin timing changes and temporary Scan Area range pulse remain discussion proposals, not implemented in this pass.
