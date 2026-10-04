# Remaining SICs

Updated October 3 2026

No in-scope SIC remains to be added. Simple: 0. Moderate: 0. Complex: 0. There are no outstanding rule questions for the implemented catalog.

## Final integration checks completed

Lock On Triangulator: asymmetric sensor range sharing, source upkeep, delayed sharing and removal of unavailable links are covered by automated tests.

Phazon Torpedo Launcher: 1x2 EDG plus 1x3 EXT, 6 EN, mineral and AU costs, speed 8, range 24, damage and duplicate-resolution protection are covered. Ordinary missiles purchased alongside a torpedo launcher now retain their storage correctly.

Remote Receiver and Remote Controller: portable pairing, saved links, hacked access, receiver visibility, Bridge maintenance permissions, relative mirrored movement and unavailable-action skipping are covered. Local Bridge access remains available.

## Excluded by request

Reverse Targeting ID, Separation Module, Custom Build, and SICs specifically for FTL battles, including FTL Burst and FTL Lock-On. Ordinary warp travel is supported by the new Galaxy Map.

## Verification and next phase

The full local regression suite passed 874 tests. GM Galaxy Map creation, solar-system editing, saved-system combat preparation, player navigation and enlarged ship interiors were inspected in the browser. This is local work; it has not been committed, pushed or deployed.

The next phase is multiplayer playtesting and optimization. Automated coverage does not replace a long session with several players, especially for simultaneous remote orders, boarding and large fleets.

Maintain this list after each catalog change. Reopen an item if playtesting finds incomplete behavior; do not add the deliberately excluded cards without a new decision.
