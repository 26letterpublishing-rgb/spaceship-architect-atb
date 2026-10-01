# Local crafting, card zoom and gravity fixes — September 28, 2026

Implemented locally; no commit, push or deployment.

## Changes
- An Angiluros ancestral weapon selection now asks “Would you like to craft [weapon]?” before opening the existing dice animation. The initial free creation choices remain free choices.
- Craft requests track fictional minutes. GM Pass Time advances them; only completed work exposes GM approval. Approval adds exactly one weapon to storage, updates the character revision and notifies the player. Storage and weapon selectors label it Crafted. Returning/storing a crafted weapon preserves its identity. Old in-flight PC saves cannot silently erase a newly delivered weapon.
- SIC inspection expands as the mouse wheel zooms. At maximum zoom the card spans the available screen width, without horizontal clipping. Tall cards scroll vertically; Back stays available.
- Explore Features disables the campaign export button and also guards its handler.
- Black holes pull minerals, asteroids, named objects and planets on the same 12-active-second cadence as ships. Strength is intensity minus hex distance. Objects disappear at the center; black holes do not consume each other. Partial countdowns survive saves. Hidden objects are not announced in public logs.
- Saved-encounter startup waits for console/map dependencies to finish loading; a browser error log exposed a race with the sensor script.
- Rejected non-finite navigation time before gravity slicing to avoid an unbounded loop.

## Large-encounter performance
Reproduced a browser crash with Last Word, Menace, a planet and a black hole while the server remained responsive. Large interior render work was repeated during unchanged ATB/AU updates, and the drone overlay measured every hull square even with no drones. The changes cache unchanged interior presentation, update statistics separately, skip idle drone geometry, isolate interior layout and reuse bounded label measurements.

Temporary browser timing traces showed roughly 250–400 ms of render/column work before these changes and approximately 50–65 ms afterward in the live large-map view (some inactive-map updates were lower). These are diagnostic measurements on this computer, not a universal frame-rate guarantee. Diagnostic tracing was removed.

## Verification
- Complete automated suite: 677 passed, 0 failed.
- 13 edited/new runtime JavaScript syntax checks passed.
- Git whitespace check passed with CRLF recognized as line endings.
- Added tests for fictional crafting progress, premature/unauthorized approval, duplicate approval, storage delivery, stale-save preservation, inventory transfer, persisted progress, scenery pull/consumption, invalid time input, a real HTTP large-ship encounter and idle drone rendering.
- Corrected an existing randomized hacking test: Z can be a valid candidate, so it was not a reliable invalid-letter fixture.
- Isolated browser checks: large encounter clock controls; expanded starmap and zoom; switch to ship editor and return to Combat; pause; refresh and reopen; Reset response; max-width SIC card zoom without horizontal overflow. Test planet disappeared into the black hole. Explore export disabled was observed. The final startup check had no browser console errors.
- Full crafting approval/storage lifecycle was checked through campaign APIs; a complete manual character-creation/crafting UI session was not repeated.
- Older diagnostic tabs became unresponsive during investigation and were closed before the final browser recovery checks. A previously crashed diagnostic tab could not be closed through the browser tool’s URL policy; it is temporary and not a saved campaign.

## Timing decision
Crafting uses fictional campaign time advanced by the GM, not hours of leaving a browser open. The existing normal dice animation still determines the crafting duration. Combat gravity uses active simulation seconds and respects pauses.

## Local use
Restart the Spaceship Architect server on port 8790 and refresh GM and PC pages to load all changes. Test data/logs are isolated under the ignored qa-crafting-gravity folder. Personal campaigns, Vector and Gold Standard were not edited.
