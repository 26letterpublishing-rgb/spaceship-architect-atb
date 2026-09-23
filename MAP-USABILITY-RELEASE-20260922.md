# Map usability release — September 22, 2026

Jason authorized this release with `#commit`. It includes the previously accepted local Spaceship Architect passes that were still uncommitted, plus this map audit. No personal campaign data, Vector files, or frozen Gold Standard files are included. Hosted Render testing was not performed.

## What changed in this pass

### Preparation and object placement

- Adding/removing scenery reads the live preparation draft, preserving earlier drags and coordinate edits.
- Ship coordinates have a separate draft so deselecting all ships cannot erase their positions. Reopening preparation in the same tab after refresh restores them. Begin Combat clears the draft only after the server accepts the new encounter.
- Switching object types supplies the appropriate default: Asteroid, planet, named object, or the chosen mineral deposit. A custom name is preserved.
- Automatic placement suggests a nearby unoccupied hex and respects a planet's seven-hex footprint. Manually entered overlapping coordinates remain legal.
- Preparation can expand to the viewport with the live map and coordinate controls. Unshielded ships can be dragged by their artwork, rather than requiring a click on a label or ring.

### Character movement and ship building

- Move opens a centered view fitted to the walkable hull. Remote exterior equipment remains rendered and accessible, but no longer makes crew destinations unnecessarily small.
- Movement height is based on the actual outer browser window, including the fixed resource bar and confirmation controls, rather than the oversized embedded frame.
- Movement-only statistics and Map View switches are more compact. The gold Console View shortcut stays out of the way while a character is choosing a route and returns afterward.
- A Go to station chooser lists the ship's seats, numbers repeated seats, and identifies occupied/current stations. It previews the normal route and still requires confirmation; it does not teleport or bypass doors.
- Zoom, Fit Ship and enlargement are available across combat interiors, PC Starships and construction. Enlarged views retain the live grid and real movement/build controls.
- Routes remain selected when expanding and returning. Movement lines maintain a visible screen thickness.
- Construction-zone fitting and drag scaling were corrected; expanding the construction zone preserves and correctly frames existing hull squares. Default fitting limits oversized tiles to 96 pixels.
- PC Combat tab attention indicates charging ATB or a waiting decision while another tab is open. Held/inactive/defeated/ended states are excluded. Reduced-motion users get static emphasis.

### Navigation and starmaps

- Bridge navigation has a larger chart, visible fit/zoom/enlarge controls, and a useful initial fit. Move Ship from Command switches back to the actual navigation chart.
- Compact Move Ship opens a substantially taller map. AU boosts, destination, timing, arrival/drift estimate, Confirm and Cancel remain usable when expanded.
- Interactive expansion uses the existing console instead of opening a separate viewing copy. Escape first returns to the console; selected routes remain intact.
- General enlarged starmaps use the available viewport and share Fit Contacts and zoom behavior. The hex background extends across the actual visible area.
- Fits use contact locations and planet footprints rather than a distant course endpoint or the full uncertainty halo. Manual zoom is retained through live updates.
- Off-screen labels no longer get pulled onto the visible edge and appear to represent nearby objects. Labels for contacts sharing or crowding a hex stagger vertically, while their actual markers and full tooltips keep their positions.
- Ship shield rings follow ship scale at creation and during updates. Marker artwork sizes are consistent rather than changing as unrelated fit bounds change.
- Subtle twinkling stars and occasional shooting stars sit behind gameplay markers and ignore pointer input. Their phase survives map rebuilds; reduced motion removes shooting stars and leaves static stars.

### Sensors and probes

- Sensor and Probe charts get more of the console's central space. Readouts are compacted while keeping their artwork, dice, quality and progress information.
- Hex and Life Scan show the selected hex plus six neighbors. A visible Confirm/Cancel step prevents accidental submission while choosing a location.
- Typed coordinates immediately update the preview and range warning; blank, fractional or invalid coordinates cannot be confirmed.
- Scans beyond range retain the existing +5 difficulty rule and warning. Probe destinations outside the ship link remain invalid, and their warning clears when the selection becomes valid.
- Full and compact scan maps can expand with their real selection controls. Compact scan confirmation remains visible without scrolling; expanded scans put the large chart beside those controls. Mapless compact actions omit useless map controls.
- Probe launch/movement routes stay visible, and manual zoom survives flight updates. Fit Link Range frames the exact legal hex boundary rather than distant scenery.
- Sensor Fit Contacts includes known scenery. Sensor overlays survive map rebuilds.
- Ship-only analysis/sharing/action choices no longer mistake probes, repair drones or missiles for starships. Normal weapon targeting of these assets remains available.

## Decisions made without another question

- Kept intentional overlapping object placement possible; only automatic suggestions avoid occupied hexes.
- Used explicit confirmation after scan selection, matching the route-selection pattern used by movement and probes.
- Focused crew movement on walkable hull; kept exterior equipment accessible rather than removing it.
- Used a strong Combat tab pulse below two cycles per second, with reduced-motion support, instead of a rapid strobe.
- Used lightweight shared SVG/CSS star effects rather than adding large image/video assets or new sound effects.
- Preserved existing dice mechanics, animations, delays, station rules, combat state and campaign storage.

## Verification

- Full automated regression suite: **562 tests passed, zero failures**. It covers the accumulated local gameplay changes as well as new map regressions.
- New focused tests cover fitting wide/tall maps and planets, zoom centers, live enlargement and Escape, ship ring/hit areas, placement/draft restoration, coordinate validation, probe warning recovery, interior viewport budgeting, walkable-hull fitting and same-hex label spacing.
- Mouse testing used isolated campaigns on port 8791 and temporary storage. Normal Spaceship Architect port 8790 and Vector servers were left alone.
- Preparation: dragged a planet, added/removed objects, preserved custom names, dragged an unshielded ship by its artwork, refreshed/reselected ships, and began an exploration encounter with the saved coordinates.
- Bridge/Combat navigation: initial fit, pointer route, locked destination, expansion, Escape, cancellation, and successful movement submission while expanded.
- Character maps: station selection, visible route, expansion/return, actual confirmed travel to another Bridge seat, and normal walking/station completion. Starships expanded movement and construction hull edits/zone expansion were also mouse-tested.
- Probe maps: real launch to Q5/R1, arrival with the camera unchanged, invalid-to-valid destination recovery, route selection, enlargement and cancellation.
- Sensor maps: seven-hex selection, coordinate feedback, out-of-range warning, expanded submission, full/compact access and Life Scan action submission.
- General space map: enlargement, fitted planets, full background coverage, shared star styling and no browser JavaScript errors in the exercised flows.
- Syntax checks passed for all 216 changed/new JavaScript files.
- Both personal campaign files retained their original SHA-256 hashes. Release hygiene checks found no credentials/personal saves in the upload, no missing assets among 666 checked references, and no oversized GitHub files.

## Limits and operation

This is a broad map-focused audit, not a claim that every possible campaign, viewport, device and gameplay combination is bug-free. Hosted behavior, phones and multi-hour sessions were not exercised. Existing gameplay regression tests passed; unrelated weapon/dice/audio systems were preserved rather than comprehensively replayed by mouse in this pass.

A temporary browser connection limit appeared while several test tabs held live streams. Closing completed tabs allowed the same movement request to complete normally; no workaround was added to game logic.

For the normal local app, restart the Spaceship Architect launcher on port **8790**, then refresh the browser to load the release. Do not use Vector's port. The separate Vector handoff remains a snapshot of the earlier export and is not silently rewritten by this release.
