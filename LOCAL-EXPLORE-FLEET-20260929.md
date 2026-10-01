# Explore fleet revision — September 29, 2026

Local only. Restart the Spaceship Architect server and create a fresh Explore Features room. Existing campaign data, personal ships, Vector and Gold Standard were not changed.

## Fleet

24 short-named ships, 256–343 hull squares, with 93 distinct SIC types across all seven shop categories. Standard designs have dual power/AU engines, Bridge, sensors, shields, lock-on, four thrusters, repairs, Life Support, nutrition, CPU security, Medbay, Meeting Room, Gym, Library, escape pods and surveillance. Role-specific systems supplement this foundation. Menace preserves its page-inspired capital layout.

| Ship | Side | Hull squares | SIC focus | Color |
|---|---|---:|---|---|
| Jackpot | PC | 256 | Mixed weapons, missiles, repairs & layered shields | #35c9ff |
| Bruiser | GM | 256 | Mixed weapons, missiles, repairs & layered shields | #ff806a |
| Foundry | PC | 256 | Fabrication, mineral processing & research | #48d9eb |
| Hothead | PC | 324 | Charged lasers, rail weapons & layered shields | #fa9c68 |
| Gatecrasher | PC | 256 | Boarding, cameras, brig & escape pods | #b39cff |
| Breadcrumbs | PC | 256 | Mines, missiles, flares & salvage | #f1d16a |
| Peekaboo | PC | 256 | Cloaking, Darkveil, hacking & security | #73d9a2 |
| Autopilot | PC | 256 | Ship AI, repairs, defenses & backup power | #79a8ff |
| Clubhouse | PC | 324 | Crew rooms, training, medicine & survival | #f39bc3 |
| Road Trip | PC | 324 | Warp, gravity immunity, docking & land travel | #b9d56f |
| Lookout | PC | 256 | Sensors, antenna, hacking & reflected fire | #ee7b85 |
| Scout | PC | 256 | All probe grades, attachments, hacking & salvage | #94c9e7 |
| Workshop | GM | 256 | Fabrication, mineral processing & research | #58d2b3 |
| Sunburn | GM | 324 | Charged lasers, rail weapons & layered shields | #f5b576 |
| Party Crasher | GM | 256 | Boarding, cameras, brig & escape pods | #c4a6ed |
| Tripwire | GM | 256 | Mines, missiles, flares & salvage | #d6c269 |
| Hideaway | GM | 256 | Cloaking, Darkveil, hacking & security | #a8cfb9 |
| Handyman | GM | 256 | Ship AI, repairs, defenses & backup power | #91b3ef |
| Lifeboat | GM | 324 | Crew rooms, training, medicine & survival | #e9a7d2 |
| Long Haul | GM | 324 | Warp, gravity immunity, docking & land travel | #c8d78a |
| Radar Love | GM | 256 | Sensors, antenna, hacking & reflected fire | #f19c91 |
| Busybody | GM | 256 | All probe grades, attachments, hacking & salvage | #b5d5e8 |
| Cleaning Lady | PC | 324 | Planetary Cleanser, layered shields & self-destruct | #d99bff |
| Menace | GM | 343 | Capital ship: Cleanser, cloaking, gravity & heavy weapons | #ec738d |

## Presentation and supplies

- Ship names no longer carry long SIC suffixes. Focus descriptions appear separately under the name in Prepare Combat, with side and hull count.
- All 24 ships have distinct saved map/combat-display colors. Selection titles, borders, checkboxes and selected outlines use the same color; GM ship cards do too. Color controls are compact swatches. Character ATB colors remain personal character settings; ships do not have independent ATB meters.
- The normal GM crew-assignment workflow is preserved. Jackpot and Bruiser start with Nova and Space Slug. Assign crew to another sample ship from the GM Starships tab to test it. Avoided linking Nova to every ship, which would load a dozen full interiors in her Starships tab.
- Minerals are preloaded at 1,000 each on rebuilt samples, fuel includes 20 cells of every grade, mine/missile ships have loaded magazines and spare ammunition, and fabrication ships have six useful blueprints. Samples are test benches rather than price-balanced starter purchases.
- Four probes are installed with Probe 2 in storage, respecting launcher capacity; probe attachments share the grade-5 probe.
- Printed/new layouts use existing generated SIC artwork. This pass adds no new artwork or dice renderer.

## Verification

Fleet assertions check unique names/colors, all seven categories, hull sizes, meaningful SIC coverage, no component overlap, exterior legality, positive unstaffed EN, movement, and isolation between generated rooms. HTTP tests now identify sample ships by stable IDs; combat-mechanics fixtures explicitly use their own fixed grid and missile stores. This avoids silently changing combat-test assumptions when the sample fleet changes.

Mouse/browser checks on disposable port8792 verified colored selection, compact swatches, selecting Jackpot/Bruiser, starting crew positions and successful Begin Combat, plus Foundry ship details and enlarged interior. Browser error log was empty. This is fleet/layout verification, not a replay of every SIC mechanic. Final full suite: 725/725 passed with test concurrency 4; syntax and CRLF-aware whitespace checks passed. One prior saturated run missed a Cleanser presentation timing window; the final complete run passed it. Screenshots are in test-artifacts/fleet-pass/selection.png and foundry-floorplan.png.
