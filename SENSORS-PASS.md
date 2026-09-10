# Sensors / Contact Intelligence Pass

Current behavior overrides: see SCAN-FEEDBACK-PASS.md. Dice scans prompt after input; Life Scan now counts non-Android combatants in the selected hex without GM entry. New/reset Explore ships omit shields. The original implementation history below is retained for context, not as the current Life Scan specification.

## Implemented

- Sensors 1-9 (A31-A36, B24-B26), unique cards and floorplans, no physical sensor stations, one installed system; stored spares allowed.
- Corrected impaired ranges: 4, 6, 8, 10, 12, 15, 16, 18, 20 Units. Impaired dice step down as printed.
- Bridge/cockpit remote sensor console: Scan Area, Scan Hex, Systems Analysis, Life Scan (ship or described 50-mile area), and Share Data to a selected detected ship.
- Unknown contacts reveal approximate sectors, not names, inventories, interiors, crew, HP, or movement orders. Detection reveals identity, position, hull size and affiliation. Analysis adds a timestamped exact-HP and active-SIC snapshot, not live enemy telemetry.
- GM overview remains complete. Player encounter REST, action responses and event streams use their current ship's intelligence. Sensor-enabled encounters remain private after hardware removal; old encounters without sensors retain their prior presentation.
- Sensor input freezes the operator's ATB. Successful Analysis then queues a 12-combat-second report while ordinary ATB resumes. Forced departure interrupts input, not a report already queued.
- Life Scan requests a GM biological reading, excluding artificial life. The GM can answer from the ship's Combat Activity section without opening a player console.
- Receipts prevent duplicate commands. AU input cannot overlap pilot or sensor console input. Intelligence, queued reports and privacy mode survive encounter persistence.
- Builder and combat Detection values use installed, operational sensor stats.

## Rules And Interpretations

Source: core rulebook PDF page 64, Sensor SICs A31-A36 and B24-B26. These are digital timing adaptations, not tabletop turn order.

- Masking <=10 passively detects identity; 11-30 creates a vague contact; >30 requires active scanning. A zero-or-negative Masking target doubles detection range.
- Detected contacts track until twice their effective detection range. Offline sensors lose tracking.
- Scan Area: sensor dice plus Sensor Systems, plus one per Unit inside effective range, versus Masking.
- Scan Hex: target Masking minus 10, plus two per whole Unit away from the selected hex. Fractional offsets round up. This resolves ambiguous off-center wording as a playtest interpretation.
- Matching original dice pairs fuse once, then the highest two results are added. Fused results do not fuse again.
- Systems Analysis uses explicit ship Defense Score when available, otherwise current Masking as a fallback until ship defense is fully automated. Failed attempts add +1 to the NEXT ROLL, as the core book states, not +1 difficulty. Success resets that retry bonus.
- Sensor input uses neutral base 8 and Quality bands ceil(tier/2), capped at four. This is a tunable playtest mapping across nine tiers, not a newly printed rule. Sensor Systems contributes to the roll, never input speed. No Engineering/staffing speed bonus.
- Life Scan area coordinates remain descriptive and GM-adjudicated: the starmap uses Lunar Distances, not 50-mile local terrain.
- Share Data currently selects one receiving ship per command; there is no Lock-On implementation. It transfers current intelligence, not live access to another ship.

## Explore Features

Both new/reset ships contain Power Hybrid Engine 4, Bridge 1, Exhaust Thruster 1, Ionic Pulse Thruster 1, Sensors 3, Shield 1, Life Support and Nutritional Supplement. The 8x7 hull provides room and sufficient EN.

Ships begin 10 Units apart. A demo-only Masking 18 scenario modifier gives vague contacts despite the large test hull's ordinary low Masking; it never changes real campaigns. New encounter preparation preserves this demo modifier. The initial demo log explains the scenario.

Keep future Explore fixtures current with newly implemented SIC families where the ship can support them. Existing demo sessions require Reset Room or a new Explore session for this layout.

## Verification

- Full unit/HTTP suite: 117 passing tests.
- scripts/playtest-sensors.cjs: API-created fresh campaign and two finalized PCs, actual GM/player browser controls, held/double mouse click, scan, queued analysis, GM life reading, shared data, reload, card family, demo unknown contacts and server restart. Includes authenticated REST/SSE visibility and real-time input freeze checks.
- scripts/playtest-cockpit.cjs: 12 mouse ship orders passed, including three PC and three NPC station-arrival orders in Explore Features.
- scripts/playtest-shields.cjs: fresh GM/two-player shield controls, shared AU, local/remote stations, occupancy, recovery, restart, shipyard and skill regressions passed.
- Sensor cards visually inspected at 1366x768; sensor console inspected at 1366x768 and captured at 1920x1080. Original print images preserved; optimized web images generated.

These are targeted automated browser playtests, not an overnight session or full character-creation walkthrough. Publication and hosted checks must be confirmed from git history and the task completion message, not assumed from this file.

Release 762b94a was pushed and verified on Render: 19 code/style files and 19 optimized images matched their local hashes. The hosted browser opened all nine cards, switched Explore GM to Nova Vale, displayed an unknown contact, and completed a Sensor Hex scan. The live random roll failed to resolve that contact (a valid result); successful detection and queued exact-HP analysis were exercised in the local fresh-campaign test. A follow-up normalizes header button styling across parent pages.

## Code Map

- ship-sensors.js: rules, command validation, intelligence and viewer filtering.
- sensor-console-ui.js / .css: persistent remote console.
- server.js: authoritative timing, sessions, event filtering and GM Life Scan readings.
- ship-map-core.js: catalog, placement restriction and sensor stats.
- campaign-api.js: current demo fixtures.
- SENSOR-ART.md: asset generation specifications and prompts.
