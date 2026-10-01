# Local campaign, SIC and black-hole pass — September 28, 2026

Implemented locally. No commit, push or deployment. Earlier uncommitted work was preserved. Vector and Gold Standard were not changed. Testing used a separate server on port 8791 with disposable data.

## Campaign and import workflow

- Hidden room codes use real bullet characters again.
- The GM header has a red **Export Campaign Save File** button immediately before Mute.
- Campaign Backup now has **Load Campaign**, with confirmation before replacing the current game. A rejected/invalid file does not close the current room.
- The lobby offers **Choose Saved Character** and **Import Character File**. Imports reach a persistent GM approval notice; Review Requests opens Settings. Players see an explicit pending message, then **Set Password and Play** after approval.
- A saved character with real identity/attribute data can be reviewed even if its old creation phase is not finalized. The GM is told that approving a draft accepts its current stats as playable. Approval clears stale pending creation rolls. This is an intentional as-is approval decision; it does not silently create missing skill rolls.
- A browser already linked to a different live campaign receives **Leave current campaign first**. Leaving unlinks the player and invalidates their room sessions, including across restart.
- Tutorial prompts have a Settings toggle and an **Okay** dismissal. Dismissal does not disable future tutorial prompts.

## Ship building and station power

- Upgrade Ship is green. Purchased and purchase-category headers collapse with +/− and remember the choice on this device during the session.
- Mouse-wheel zoom works over the enlarged SIC card.
- Darkveil numbered cards precede Cloaking Device in their stack.
- Bridge/Cockpit reboot durations are displayed in seconds. Power-on/restart uses the installed Bridge/Cockpit's duration (for example Bridge 1: 72 seconds).
- Every interior SIC floorplan has at least one station. Turning off a SIC disables its function and releases its EN demand. Registered crew must occupy that SIC's station to change power. Exterior-only equipment remains remote-only and can be powered through a Bridge/Cockpit station.
- Outside combat, **SIC Power** appears on the ship header and becomes available at a station. The power chooser indicates restarting systems. Online console controls are unavailable away from a station or while that SIC is off.
- Keyboard walking no longer refits the map on every step. The walking figure retains its sprite styling and stays at arrival until the save completes, avoiding an old-position flash. Newly assigned crew have a visible initial location before their first saved move. WASD/arrows also forward from the enlarged interior map. Keyboard movement is blocked while upgrading a ship.
- Fused dice results stay upright while the visual core spins. Hacking Practice accepts repeated letters; End Practice tries to close the practice tab and falls back to the main menu if the browser prevents closing it.

## Cloaking

- +50 Masking stationary; +25 during powered or inertia movement; +10 when shields are active.
- Costs 12 AU on activation and automatically every 12 seconds; shuts down if upkeep cannot be paid.
- Shields may remain active and protect the ship while cloaked. Their icons reflect actual shield HP.
- The starmap uses a faint blue outline for a cloaked vessel. Card and console text describe the revised values.
- Explore Features includes **Nightglass** and **Blue Phantom** cloak-equipped variants.

## Black holes and Gravity Absolution Field

- GM object placement includes **Black Hole**, a name and integer intensity (1–100). Default intensity is 3. A generated, transparent, low-resolution sprite marks the center; purple ripples extend to the pull-1 boundary. Reduced-motion preferences suppress the ripple animation.
- Final user rule: pull = max(0, intensity − hex distance). Intensity 15 at distance 3 pulls 12 units. Intensity 3 at distance 3 pulls zero; at distance 2 it pulls one.
- Pull applies every 12 active seconds and never overshoots the center. It does not rotate the vessel. Its movement-speed penalty is applied internally without changing the PC's displayed movement vector or showing the numeric pull strength.
- Entering the center sets Hull HP to zero regardless of shields. Fast travel paths are checked so a vessel cannot jump over the center between updates.
- Gravity Absolution Field (B-78): 4×4, 5 EN, security 3, threshold 15, 175,000 credits; generated floorplan/card art and console activation. Requires an operational shield system, costs 3 AU on activation and per 12 seconds, suspends shield protection, and makes the vessel immune to pull, speed penalty and center destruction. Shield HP is retained while protection is suspended. Impairment, unavailable power/shields or insufficient upkeep removes immunity.
- Interpretation: the printed optional stronger-field AU surcharge has no usable formula; the digital immunity uses the defined base 3 AU. No arbitrary intensity surcharge was invented.
- Overlapping black holes resolve strongest first, then stable object ID. Their movement penalty uses the strongest current field rather than adding penalties together.

## Land Wheels and Menace

- Land Wheels (B-72): 200 credits, four independent 1×1 exterior mounts, threshold 5, base 1 EN. The Ship Capabilities section explains narrative surface speed: at 1–6 EN, maximum Move = 10×EN and MPH = 20+10×EN; begins at Move 1 and gains one per movement action. Each impairment removes 25% of the undamaged maximum. This is reference-only surface movement, as requested.
- **Menace — Large Hull, Cloaking, Gravity Field, Planetary Cleanser** is available in Explore Features. Its 343-square layout is inspired by rulebook pages 186–187 and validated against placement/engine-clearance rules. This is a playable approximation: Transporter and Devastation Laser are omitted because those SICs are not implemented. It includes operational alternatives, large engines, shields and the new field for stress testing.
- Separation Module and Custom Build are excluded. The current remaining list is in REMAINING-SICS-20260928.md: 34 active candidates, plus two retired/on-hold cards separately noted.

## Validation and limits

- Full automated suite: **668 passed, zero failed/skipped**, final run in qa-next-pass/full-tests-final.log.
- New focused checks cover pull timing and distance, center destruction, heading preservation, hidden movement penalty, field immunity and loss, upkeep and receipt safety, suspended shields, cloak bonuses/upkeep, four-mount validation, legal Menace placement, draft approval/linking, and leave/restart behavior.
- **96 changed/new JavaScript files passed syntax checks**; changed-file whitespace checked after cleanup.
- Real browser checks in disposable campaigns covered GM import notification/approval and the player's approved state, correct room-code bullets and Load/Export controls, Explore preset availability, Black Hole placement/intensity/art/ripples, PC keyboard steps and saved positions, station selection/arrival, enabling console/power controls, sensor shutdown and completion of a Bridge-timed reboot, upgrade/cancel, category collapse, mouse-wheel card zoom, and submitting H-H-H in Hacking Practice. Browser error logs were empty during these checks.
- Most button interactions in this browser harness used keyboard activation; the mouse wheel was directly exercised. This was not an exhaustive physical-mouse playthrough of every pre-existing feature. Black-hole timing/field interactions were verified by automated tests, not an extended multiplayer battle.
- Generated assets total about 104 KiB (128px map icon, 512px field room, 256px wheels); provenance is in ASSETS-BLACK-HOLES-20260928.json.

## Launch

Use the normal Spaceship Architect launcher on port 8790. Restart that local server and refresh open tabs to load the updated server logic and UI. The isolated 8791 test server is stopped after testing. Existing personal campaign files were not used for testing.
