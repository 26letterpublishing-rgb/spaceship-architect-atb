# Local campaign and Starships follow-up — September 28, 2026

Implemented locally under #local. No commit, push or deployment. Existing unrelated work is preserved.

## PC navigation and retained Starships options

Compared the current tab with the committed Starships implementation. The tab was hidden when a campaign had no ships; it now stays available to linked PCs. Removed the separate Encounter indicator and placed In Combat / Out of Combat on Combat itself.

Added Create Starship and Import Starship to the PC tab and creation to the room lobby. Create starts a fresh recoverable draft, carries the room code into the linking form and offers Back to Campaign. Imports retain GM approval and GM-only crew assignment. Corrected the import helper's unauthenticated state lookup.

Retained assigned-ship maps, crew locations, view/zoom controls, character movement, WASD/arrows, Upgrade Ship / return / cancel, ship details, printing and the builder's existing saved-ship, duplicate, import/export, purchasing and layout tools. Restored console-preview and System Repairs and Diagnostics buttons that the detailed-floorplan wrapper had hidden. Did not restore player-controlled crew assignment.

## Prompts and presence

Campaign character EventSource connections now count toward connected-PC status independently of deployed combat units. Connecting/disconnecting broadcasts the updated status. Duplicate streams do not duplicate characters.

New submitted roll results produce a GM notification showing character, attribute/skill, score, difficulty and outcome. Existing results stay available in Prompt / Give. Loading existing history is silent; OK clears accumulated result notices.

## Missiles

Purchases work without a launcher. Installed launchers auto-fill in inventory order; surplus stays in separate missileStorage. Storage and loaded magazines are displayed separately and travel through campaign saves, construction state and encounter preparation/normalization.

Reload from Storage is a launcher-console action. Requires the operator physically stationed at that launcher; remote Bridge/captured access cannot reload. Uses the existing launcher input delay, consumes one turn and costs no AU. Transfers stock only on completion; leaving the station or losing the launcher interrupts without consuming stored ammunition. Reload fills available slots in catalog order. No automatic reload on firing. These are implementation decisions for unspecified timing/order.

## Cleanser

Blast damages every real, present ship less than three axial units from the locked aim hex, including friendly ships, the firing ship and ships overlapping the target planet. Exactly three or farther remains safe, preserving the earlier explicit escape rule. One shield layer still absorbs one hit with no overflow into Hull. Added a visible friendly-fire/radius explanation.

Combat Activity reports 90, 60, 30, 10 and 5 seconds remaining, including thresholds crossed by a large time advance, without repeats. Beam starts at the end of the decoded 2.88288-second zup clip, with rupture 0.05 seconds later. Existing dice/result-first sequencing remains.

## Readability

Set explicit contrasting dialog/default button colors and corrected Tutorial / Hold popups. Audited CSS light-button declarations and visible fleet buttons; no light-on-light button pairs were found in the checked fleet view. This is not a claim that every possible application state was manually inspected.

## Validation

- Full suite: 657 tests passed, zero failed.
- Additional final focused checks: eight preparation/HTTP tests and seven Cleanser presentation tests passed after the last follow-ups.
- Four added tests cover campaign presence, ammo purchase/storage, physical reload/idempotency, and charge milestones. Existing tests updated for blast and audio timing; preparation test now checks storage retention.
- JavaScript syntax checks passed; CRLF-aware whitespace check passed. Preserved committed mixed line endings in gm.js.
- Isolated server on 8791, disposable new campaign HBB4: menu creation, joining/claiming, empty-fleet tab, new blank ship, copied ship confirmation/link/GM approval/crew assignment, Upgrade/Return, and purchase of ten missiles without a launcher all exercised through the UI.
- Scripting All PCs produced a request before combat. Quick Prompt used the existing animated dice and Confirm and Submit; GM visibly received Nova QA's score 9 vs difficulty 10, Failure.
- Explore Features: tutorial visibility/contrast, starting solo exploration, Combat status and Hold popup checked. Screenshot evidence in qa-followup.
- Browser error logs checked: empty.

Limits: live station reload and blast/shield mechanics were tested automatically, not as a full mouse-played combat sequence. The audio timeline was validated in tests; speaker output was not independently auditioned. Test server/tabs are closed; the normal 8790 app and Vector servers were not restarted or changed. Restart Spaceship Architect and refresh its GM/PC pages to load the updated server and UI.
