# Local Artwork, Salvage And Regression Pass

Authorized by the user's latest #local. No Git commit, upload, Render access or personal campaign edits.

## Artwork

Generated 27 detailed raster assets using the built-in image-generation tool:

- Tractor Beam, Manipulation Arm, Escape Pods, Docking Bay and Ripple Reflector.
- VR Training Room, Medbay, Library, Meeting Room and Ship AI.
- Missile Launchers 1-5, Missiles 1-5, Spread Missiles 1-5 and Missile Flares.
- A separate panoramic Meeting Room console scene.

These cover the newly added SIC families from the recent utility, crew-room and missile passes. The fourth preceding pass was a mouse audit, not a SIC expansion. Existing artwork elsewhere in the catalog, including older warp/rail/self-destruct graphics, was not replaced in this pass.

Runtime files are root-level sic-art-*.webp. All 27 total 2,659,174 bytes, approximately 2.66 MB. Exterior assets have actual transparent pixels; the meeting panorama is intentionally opaque. Top-down room/device images are reused on their cards and applicable high-resolution floorplans; launcher interiors retain the existing separate control-room artwork. Low-resolution silhouettes remain available.

scripts/generated-sic-art.json records the complete prompt set and selected original local PNG paths. scripts/prepare-generated-sic-art.cjs performs size/format encoding only. Generated images were visually inspected; two unsuitable Launcher 4 versions were rejected before selecting the final transparent version. No external paid API or plugin was used.

## Approved Rule Changes

- Each Docking Bay permits up to four vessels with combined Hull squares no greater than half the carrier's Hull squares. Mixed sizes are allowed. This supersedes the previous Scale Rank/one-vessel interpretation.
- Select a particular docked vessel to release it. Existing consent, decompression/shield doorway, impairment and crew suspension rules remain.
- Escape Pods remain untargetable.
- The GM can place mineral deposits, asteroids and named objects in Prepare Combat. Objects can be dragged or positioned by coordinates without changing manual zoom.
- These GM-authored objects are visible map beacons, not hidden sensor contacts or additional combat ships. Asteroids do not gain invented HP, collision or mining rules.
- Tractor retrieval requires range two; Manipulation Arm retrieval requires the same hex. Minerals enter existing mineral stores. Other objects enter a persistent recovered-cargo list. Collected objects cannot be awarded twice, including after restart.
- Every Meeting Room floor square grants access without occupying a particular seat. Its console shows a generated room, moving stars, animated screen and current occupants. Prior saved briefings remain readable; no new meeting interaction is required.

## Bugs Found And Fixed

- A missile input could finish after its target entered warp and still spend ammunition. Resolution now revalidates target departure and launcher impairment.
- Encounter preparation omitted saved field-utility state. It now preserves that server-owned state.
- Whole-room access passed the station service but was rejected by the out-of-combat console loader's old seat requirement.
- Navigation assumed every map marker contained a ship circle. Object markers now render without that exception.
- Sensor/navigation maps now notice object changes; out-of-combat campaign updates remove collected markers.
- Recovered named cargo now has a lasting visible list rather than only a transient operation report.
- The GM's stale preparation draft could recreate collected objects. Server changes now reconcile with that draft while preserving unrelated unsaved additions, deletions and moved objects.

## Verification

- Full automated suite: 374 passed, zero failed. Includes all ten standard/spread missile grades pursuing repeatedly moving targets, serialization during flight, target departure without ammo loss, docking capacity, object validation, recovery and generated-asset bindings.
- HTTP recovery test: collect minerals during combat, restart the server, repeat the same receipt and verify no duplicate minerals.
- Chrome missile workflow: separate authenticated GM and PC; target drifts across the original flight path; missile turns toward its updated position; hard pause freezes ship and missile; player reload preserves flight; manual impact, interception and all three manual flare outcomes remain usable.
- Chrome crew rooms: purchases/placement, manual daily VR award, Library records/search, Meeting Room access without a seat and moving stars, Medbay inside/outside combat with closed-console manual healing, AI and laptop/mobile layouts.
- Chrome field utilities: purchases/split placement, high-resolution map, decoding all 27 assets, tractor/arm commands, docking clearance and release, reflector settings, pod launch, responsive controls, object creation/removal/dragging, mineral and named-cargo recovery.
- Chrome mouse audit: Explore room persistence, ordinary room-code parity, six map toggles, ship walking/station access, Sensors zoom/help and preparation controls.
- All 89 root JavaScript files pass syntax checks. Gold Standard structural audit passes; it is not claimed as proof of every historical behavior.
- Additional Chrome gates all passed: held-PC/NPC natural turns at three window sizes, Ripple/Ion delayed attacks and GM damage ownership, PC upgrades/movement/printing, captured bridge navigation and counter-hacking, warp travel/early exit/cancellation, and dropped-request/restart/modal-overlap recovery.
- Final field/mouse runs also verified that recovered objects disappear from GM preparation and stay absent after GM reload, while unsaved new placements remain intact.

Tests use isolated temporary campaign storage. Fixtures set up realistic saved ships/characters and some combat states; mouse actions then exercise the actual interfaces. This does not claim every character-creation path, every SIC combination, or a subjective audio-quality review.

## Local Preview

http://127.0.0.1:8802/showcase.html

Hidden server PID27396. Isolated storage:
C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-art-salvage-20260914

Fresh Explore was checked to open Script with a real room code and no active combat. Earlier preview servers and the Gold Standard folder were left alone.
