# Targeting Families And Combat Clarity

September 11, 2026. Authorized by #commit, with an extended implementation and usability audit.

## Player Changes

- Combat View is the default action interface. Move Ship, Evasive Maneuvers and firing are the prominent, consistently sized actions. Other console actions use smaller grouped buttons and contextual help.
- Evasive Maneuvers starts the shared roll directly. Targeted actions open a compact planner with the same live controls, validation and submission as the immersive console. Canceling does not spend a turn or AU.
- Defense appears in every console header. Compact planners and the root action menu also show available AU. Existing full consoles retain their shared power and timeline areas.
- The selected immersive console and explicit Combat View choice survive reloads and perspective changes. Opening a console is optional, not a second step required to perform an action.
- Main combat activity has no flashing animation. Ship hits use an additive, approximately 1.5-screen-pixel map shake, a red flash and a quiet short impact sound. Destruction retains its separate explosion.
- Rapid Laser exterior cells are transparent. Rectangular lasers occupy and render their whole footprint and rotate toward the exterior on every mounting side.

## Numbered SIC Families

Lock-On Systems 1-10 are now implemented. Sources: Series A cards A-37 through A-44 and Series B cards B-31/B-32. FTL Lock-On and Triangulator are separate add-ons, not included in this numbered-family expansion.

| Tier | Normal Dice | Impaired Dice | Break Difficulty | Additional Target AU / 12 Seconds | Footprint |
| --- | --- | --- | --- | --- | --- |
| 1 | 2D4 | 2D2 | 13 | 4 | 1x1 |
| 2 | 3D4 | 3D2 | 14 | 4 | 1x1 |
| 3 | 2D6 | 2D4 | 15 | 3 | 1x1 |
| 4 | 3D6 | 3D4 | 16 | 3 | 1x1 |
| 5 | 2D8 | 2D6 | 17 | 2 | 2x1 |
| 6 | 3D8 | 3D6 | 18 | 2 | 2x1 |
| 7 | 2D10 | 2D8 | 19 | 1 | 2x1 |
| 8 | 3D10 | 3D8 | 20 | 1 | 2x2 |
| 9 | 2D12 | 2D10 | 21 | 0, unlimited targets | 2x2 |
| 10 | 4D12 | 2D12 | 22 | 0, unlimited targets | 2x2 |

The first target is free for each installed targeting system. Tiers 1-8 support two targets per system. Tiers 9-10 can cover every opponent within the app's six-ship encounter limit. Lock records retain the originating SIC; impairment and upkeep are tracked per system. Existing lock records acquire their source hardware during refresh. Ordinary Share Data does not transfer targeting locks.

Rapid Lasers 1-5 are implemented from A-100/A-101/A-102 and B-82/B-83. Damage dice progress D4/D6/D8/D10/D12, energy costs 1/2/3/4/5, and footprints are 1x1, 1x1, 1x2, 1x2, 1x2 exterior. All require a cockpit or bridge, with no local station. Activation is 5 AU before sacrificed dice and the existing repeat-use surcharge. The surcharge uses the selected laser's EN cost. Impairment caps damage at one die of that grade.

Both families use their grade for Quality, capped at the four available bars. Existing Ingenuity rules remain. Lock-On accuracy uses its own dice plus Weapon Systems; component targeting uses Sensor Systems. Rapid Laser accuracy uses Dexterity + Weapon Systems + the firing ship's HSM - range, and must exceed Defense. Damage always requires separate explicit red-dice confirmation, including locked shots. No automatic damage roll was added.

## Explore Features

Fresh/reset Explore ships each contain Rapid Laser 5 and Lock-On System 10, alongside the existing bridge, sensor, engine, two thrusters, life support and nutrition. Shields remain absent for analysis testing. The crew remains Nova Vale and Space Slug only.

Nova has 2,012 unspent/total XP, including the requested additional 2,000. Pilot/Helm and Weapon Systems are 6; Sensor Systems 5.5; Engineering and Computer Systems 5; Hacking and Mathematics 4. Dexterity and Perception are D10+D8+D6; Intellect is D12+D10+D6. Her seeded ATB speed is 15, Command Window 120 seconds, Move Speed 3 and HP 30, matching the actual sheet formulas. Existing real campaign characters are unchanged. Reset Room creates the upgraded demo rather than silently replacing an ongoing encounter.

## Additional Audit Fixes

1. A late action response could rewind a newer streamed combat state. In Explore this left the player showing completed scan input as busy, blocking console switches. Responses now respect state revisions; focus recovery preserves newer updates while still supporting server restart recovery.
2. Action help created inside a tall combat iframe could appear below the visible screen. Help now opens in the outermost viewport with an accessible dialog name.
3. Root actions now explain missing prerequisites in their disabled-state tooltips, including propulsion, detected contacts, Mathematics and incoming locks. Physically restricted shield restabilization is not offered remotely.
4. The hit effect referenced an ATB class that did not exist. It now targets the real meter, not the whole ship column or activity feed.
5. Nova's previous demo HP/timing values disagreed with recalculation after opening the character sheet. The new seed uses consistent derived values.
6. Tier-one-only Lock-On help and weapon repeat-cost text were generalized to the selected hardware.
7. Reopening a console during its close animation now waits for cleanup instead of silently dropping the click.

## Verification

Local unit/HTTP suite: 163 passing tests, including higher-tier dice/upkeep, independent targeting hardware, explicit tiered damage, all rectangular mounting directions, upgraded Explore fixtures and late-response regression tests.

Browser checks exercised normal and impaired Lock-On, endgame Lock-On 10/Rapid Laser 5, manual accuracy and manual damage, misses/OK, red damage dice, visible shot effects, destruction/Victory, direct Evasive Maneuvers, compact target/scan/preparation planners and cancellation, action help, console persistence, shared AU/Defense, three map zoom levels, transparent exterior cells, full family pickers, tier-10 purchase and card inspection. Screenshots were reviewed at desktop sizes and a mobile viewport.

Cross-system regression runs cover sensors with GM/two PCs, explicit rolls and delayed reports, hex Life Scan, sharing, hail acceptance, reboot, GM diagnostics/time and recovery; shields with local/remote access, shared AU and physical-only restabilization; and twelve mouse-driven cockpit movement orders across fresh campaign and Explore PC/NPC views.

The live deployment smoke test checks public code/style hashes and optimized images, creates an isolated Explore room, and exercises GM/PC scan, console switching, Command help and enlarged high-resolution interiors. Publication status is recorded in CURRENT-HANDOFF.md after deployment verification.

## Artwork And Generation Briefs

Mode: built-in image generation, not API/CLI fallback. Generated PNG masters were copied into the project; optimized WebP derivatives are served through sic-web-assets.json. Existing print masters were not resized or replaced. Laser alpha channels were inspected; the original laser's dark rectangle was a cell-background bug, not missing source alpha.

Workspace directory: `C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/`.

Saved master sets in that directory:
- `lock-on-2-card.png` through `lock-on-10-card.png`.
- `lock-on-2-floor-plan.png` through `lock-on-10-floor-plan.png`.
- `rapid-laser-2-sprite.png` through `rapid-laser-5-sprite.png`.
- `rapid-laser-2-card.png` through `rapid-laser-5-card.png`.

Each has a sibling `-web.webp` derivative. The new laser card images reuse their corresponding new exterior hardware art, consistent with Rapid Laser 1.

Normalized final generation prompt set / art direction:
- Lock-On card, one image per tier 2-10: detailed, compact science-fiction targeting hardware, centered three-quarter product view, dark neutral presentation, readable metallic housing and an illuminated targeting optic; no typography, labels, human operator or decorative frame. Distinguish each grade through housing, optic arrangement and tier accent while matching the existing SIC family. Accent progression: violet, blue, teal, red, violet, amber, blue, green, cyan.
- Lock-On floorplan, one image per tier 2-10: orthographic top-down installed targeting hardware on a practical metal ship-room floor, matching that grade's card hardware, no character stations or text. Square rooms for 2-4 and 8-10; 2:1 rooms for 5-7. Keep room edges usable for the app's independent wall/door geometry.
- Rapid Laser exterior sprite, one image per tier 2-5: crisp orthographic top-down paired-barrel science-fiction rapid laser mount pointing upward, detailed metallic machinery matching the existing first-grade mount, increasing visual sophistication by grade. True transparent background; no fire, scene, floor, frame, labels or baked shadow rectangle. Square composition for tier 2, tall 1:2 composition for tiers 3-5. Preserve transparent alpha.

These are normalized production briefs, not a verbatim tool-call transcript. The selected images were inspected before integration. No Gold Standard files or data/campaigns.json were changed.
