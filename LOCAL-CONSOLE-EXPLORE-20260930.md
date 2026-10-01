# Explore, SIC cards and consoles — local pass

September 30, 2026. Local source changes only; no commit, push or deployment.

## What changed

1. Explore now offers contextual tutorial dialogs for the main tabs, maps, preparation, cards, campaign tools and station consoles. Longer explanations have Previous/Next pages. Each popup has Okay and a small Disable Tutorial Popups checkbox, using the existing tutorial preference. Switching station consoles can show the relevant guidance.
2. Purchase categories start collapsed. Manually opened/closed categories are remembered for the session; existing construction and owned-card defaults are retained.
3. Transporter range increased from 3 to 8 space units, including server validation, console and card text.
4. Buy blueprint moved outside the enlarged card on its left. A gray Preview Console button sits above it where that SIC has a console. Both remain fixed-size as the card zooms.
5. Console previews are full-size frozen copies of the actual console, with disabled controls and no continuing console animation. Back to SIC Card returns to the same inspector. Bridge-only weapons and add-ons receive a representative bridge host. Preview data is local and does not alter a campaign.
6. Restored sensor rings for compact Explore ship records, including Peekaboo and Scout. Compact summaries now retain sensor reach and hull size, avoiding loading full floorplans just to draw the preparation map.
7. Added Orion Reed as a second PC, plus Civilian, Security Guard and Final Boss NPCs alongside Space Slug. Their starting positions are separated. GM assignment controls can distribute them among the sample ships.
8. Thrusters now require a complete straight attachment edge against ordinary hull. Partial corner contact and triangle contact cannot support a thruster. The generated Explore fleet uses that same placement rule.
9. GM combat ship headers now include Remove from Combat. A separate confirmation explains that the ship and aboard crew leave the encounter while campaign records and assignments remain. Server authorization and cleanup protect the action; related pending orders are cancelled.
10. Shield consoles show a large current / maximum shield HP reading immediately left of Field Stable.
11. Shared console dropdown memory restores the last valid selection when reopening the same character/system console during the session. Invalid or unavailable saved choices are ignored.
12. Ordinary firing-impact reports hold displayed shield/Hull indicators through the firing presentation, then release them. Authoritative damage remains immediate; only its visual display is deferred. Existing Cleanser resolution timing remains separate.
13. Black Hole Gun holes now lose one intensity every 15 active seconds, tripling their former lifetime. Intensity 15 lasts 225 active seconds after formation. Gravity still uses its existing five-second timing.
14. SIC Maintenance is integrated into each console's power/control area, including standalone consoles.
15. Powered-off floorplans and consoles are desaturated and dimmed 10%. Their consoles remain available for inspection and maintenance, with normal operations blocked. Power On still requires the appropriate local station. Fixed the out-of-combat maintenance recovery button so it remains usable.

Also corrected misleading Cleanser text claiming nearby ships were unaffected by a planet blast.

## Verification

- Full automated suite: 777 passed, zero failures.
- All 143 root JavaScript files passed syntax checks.
- Final focused presentation checks passed; CRLF-aware whitespace validation passed.
- Added regression checks for strict thruster attachment, compact sensor summaries and scale, eight-unit Transporter range, longer black-hole lifetime, delayed health display, browser inspection of offline consoles with server-side operations still blocked, expanded Explore crew and authorized ship removal preserving campaign data.
- Existing tests with two-character assumptions were isolated from the newly expanded Explore cast. Old partial-edge thruster fixtures were corrected without removing their original mechanical assertions.

Mouse/browser checks used disposable data on port 8792, separate from the normal app and personal saves:

- Peekaboo + Scout sensor rings and ship sizes in enlarged preparation map.
- New PC perspective and all four NPC choices.
- Collapsed purchase categories, opening the shield family, enlarged card, fixed-size left-side buttons and mouse-wheel card zoom.
- Opening a real shield preview from the shop and returning to the same card.
- Static Shield, Ship AI, Transporter, Planetary Cleanser, bridge-only Rapid Laser and Science Lab console previews; sampled pages reported no browser errors.
- Tutorial page navigation and disabling further popups.
- Actual GM combat header removal button, separate confirmation and removal of Bruiser/aboard crew from the disposable encounter.

Limits: this was not a full multiplayer playthrough of every console or every dropdown. Offline console permission transitions and damage-display timing were checked automatically; a full live power-off/reboot cycle and every weapon's visual timing were not mouse-tested. Nested iframe auto-scrolling interfered with some automated clicks; visible GM controls were tested by mouse coordinates where needed. These checks do not establish a new app-wide performance benchmark.

## How to see the changes

Restart the normal Spaceship Architect local server, refresh the app, and use Reset Room in Explore Features to receive the revised sample crew and valid rebuilt layouts. Existing personal ships are not automatically rearranged. A previously saved partial-edge thruster mount must be repositioned when edited.

No personal campaign file, Vector project or Gold Standard copy was changed by this pass. No new SICs were introduced, so the remaining-SIC count is unchanged.

## Visual evidence

- qa-console-explore/sensor-rings.png
- qa-console-explore/shield-preview.png
- qa-console-explore/card-zoom.png
- qa-console-explore/tutorial.png
- qa-console-explore/remove-confirmation.png

Automated results: qa-console-explore/final-tests.txt and final-presentation.txt.
