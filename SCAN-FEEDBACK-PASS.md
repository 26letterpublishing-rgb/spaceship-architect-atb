# Scan Feedback And Console Layout

## Behavior

- Scan Area, Scan Hex, Systems Analysis, ship maneuvers requiring dice, and SIC repair pause at an explicit Roll Dice dialog after input. The server rolls once, retains the result for retries, and permits the authenticated GM to recover a player request. Conditional actions also prompt when triggered without replacing the character's current action.
- ship-roll-ui.js opens above native consoles. GM sees pending-roll notices and result messages; PCs see red Awaiting GM during existing adjudication states. The dice reveal uses server results, not a new physics simulation.
- New detections produce flashing red intelligence entries with available name, class and affiliation. Failed/empty scans explicitly report completion.
- Life Scan selects one hex in sensor range and automatically counts non-Android combatants on other ships there. It excludes the scanner's own ship and combines overlapping ships. This approved digital rule supersedes the earlier GM-entered 50-mile reading; legacy saved readings remain supported.
- New/reset Explore ships omit shields for Systems Analysis testing. Other equipment and the demo-only Masking modifier remain unchanged. Existing rooms need Reset Room.
- Each SIC footprint has one centered full-name label; high-resolution labels are yellow. Movement confirmation is above the scrolling map, including the older location dialog. Tactical ring stages have extra vertical clearance.
- The pilot Navigation chart fills its panel behind controls, preserving coordinate mapping during resize and zoom. Command is yellow with black text; Hail remains inside Command.

## Verification

129 unit/HTTP tests passed during development. Fresh-campaign sensor browser checks cover two PCs and GM, held clicks, visible roll prompts, unauthorized roll rejection, repeat requests, Life Scan, queued Analysis, navigation aspect ratios at 1366 and 1920 widths, and expanded movement. Cockpit regression passed 12 PC/NPC orders across fresh campaign and Explore. Shield browser regression passed. Final restart and hosted verification are recorded in CURRENT-HANDOFF.md when completed.

These are targeted automated browser checks using API-created fixtures, not an overnight or full character-creation playthrough. Gold Standard, original artwork and real campaign data are unchanged.
