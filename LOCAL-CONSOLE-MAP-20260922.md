# Local console button and scan/map controls — September 22, 2026

Implemented under Jason's #local authorization. No commit, push, deployment or personal campaign edits.

## Changes
- The fixed gold PC Console View button is a wider-bottom trapezium, flush with the viewport bottom. Its upper corners are curved and lower corners sharp. Existing remembered-console, between-turn and Hold access remain. Removed the duplicate Toggle Console action from combat options; existing GM operator selectors remain available.
- Scan Area reports now list uncollected map objects within the scan range, including planets, asteroids, minerals and destroyed-planet debris. Reports retain stable object IDs through combat logs and saved sensor reports. Hovering or keyboard-focusing an object's name highlights that marker in the map. Shared escaped markup serves combat lanes, general activity, Bridge, shields and sensor reports; same-name objects remain distinct.
- The Cleanser countdown says “active seconds until cleansing.” Damage prompts, dice, sound and firing sequence are unchanged.
- Compact Move Ship popup zoom controls are visible and clickable. The bug was an absolutely positioned map using the popup instead of its own chart as its containing box, covering the controls. Plus/minus and Fit Contacts retain the selected destination and route.
- Bridge has a visible Enlarge Map button next to Navigation. Enlarged maps provide plus/minus, Fit Contacts and Close, and preserve manual zoom across live updates. Fitting includes displayed scenery and planet extent, without fitting faraway course endpoints.

## Decisions made without additional questions
- Scenery uses Scan Area's existing +50% pulse range, measured to the object's center hex, matching current map distance conventions. It does not add another dice roll or change ship Masking/detection rules.
- Destroyed planets are listed as “Name / Destroyed”; collected objects are omitted. Old reports without object IDs remain ordinary text.
- Keyboard focus highlights the same objects as hover. The button shape uses lightweight inline SVG, with no new raster image or dice animation.

## Verification
- Syntax checks passed for the edited JavaScript.
- Full automated suite: 529 passed, zero failures. Focused pre-browser suite: 60 passed. Final focused checks after excluding the hover ring from navigation marker resizing: 16 passed.
- Isolated port 8791 and temporary campaign storage; normal Spaceship Architect port 8790 and Vector untouched.
- PC browser: gold button measured 300×64 at viewport bottom 720/720 with fixed positioning; visually checked sloped sides, curved top corners, square bottom corners and gold text contrast. Duplicate combat action absent; button opened the saved console between turns. Reload/Combat restored the Bridge.
- Bridge Enlarge Map opened above the console. Zoom changed the viewBox, Fit Contacts worked, Close returned to the console. Manual zoom survived a server state update.
- Move Ship popup controls were visible and worked. Destination Q3/R1 and enabled Confirm Move remained after zoom/Fit Contacts.
- Submitted Scan Area through the PC UI with Vesper, Iron Deposit and Asteroid Belt. All three appeared in the report; mouse hover outlined Vesper on the Bridge map, and keyboard focus highlighted Iron Deposit. Final ring size survived navigation updates. No captured browser errors.
- Personal campaign SHA-256 unchanged: app/data/campaigns.json = 7B679E7F05595DFFB15F8ED08CC82DCD4961505088379330B38742D5D017E190; workspace SA-ATB Local Development Files/campaign-data/campaigns.json = B4521B48265B48345CEC463C2085F906C6F23A9A451EE2CCDBC34D73C9A387A6.
- Test logs: test-artifacts/map-console-full.txt, map-console-focused.txt and map-console-final-focused.txt. Existing dice/cinematic mechanics were regression tested; no new subjective audio audition was needed for this batch.

Restart the normal local server on port 8790 and refresh the app to load server-side scan reporting and browser changes.
