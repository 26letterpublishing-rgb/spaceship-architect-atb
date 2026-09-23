# Local Visual And Preservation Correction

Authorization: continued local correction requested by the user. No GitHub upload or Render testing. The user withdrew the report about escaping the standalone ship builder; its exit behavior was not changed.

## What Was Wrong

- The September 9 commit b0aeca9 separated Construction and Ship Details and hid the entire construction sidebar in Details. Map View was a child of that sidebar, so display controls disappeared along with purchasing tools. Removing construction tools from Details was requested; removing display controls was not.
- The September 11 commit e1b389e embedded the shared sheet in the PC Starships tab and hid the old map layout and control strip. The previous local pass restored the old strip above the sheet, but did not put the original Map View panel next to the map. Its completion claim was too broad.
- Construction's original fieldsets remain in the current HTML. The new browser checks verify their actual visibility and operation instead of assuming that source presence proves accessibility.
- New SIC levels previously shared the same family artwork. Each of the 31 levels now selects a distinct generated machine or room view. Weapon control-room flooring remains shared; the mounted weapon and card equipment artwork are level-specific. All Darkveil room layouts are distinct.
- The old humanoid SVG had an upright torso and feet beneath the head. The replacement is a direct overhead silhouette: helmet above shoulders, foreshortened arms and alternating boots. Combat was replacing moving nodes every update, defeating a previous-node direction heuristic. Facing now comes from the route segment, including corners and door approach. Walking pauses at door delays.

## Corrections

- Reuse the original six-switch Map View fieldset and styling on the left of Ship Details, independent of construction-only controls. Construction retains its original left fieldset. The same panel works in embedded PC details. Hull temporarily disables the relevant interior switches without discarding their saved preferences.
- Preserve PC same-map movement, all view toggles, console preview, cards, crew, printing, map effects and tab navigation. The standalone builder still exits the same way.
- Entering Details no longer retains an active SIC placement's forced low-resolution view. The placement draft remains available when returning to Construction.
- Hide the idle Move button while a move is selected; underlying actions remain available when appropriate. This corrects CSS overriding the native hidden state.
- Combat route selection now uses the expanded construction height instead of rejecting crossings beyond row 20. Browser coverage selects a route across that former boundary.
- New artwork is packaged as four cached raster-backed SVG atlases, with individually addressable views for all 31 levels. Original generated PNGs are retained. The delivered atlas SVGs total about 2.56 MB before HTTP compression; this is not zero-cost media and must not be advertised as reducing total app bandwidth.

## Verification

- `audit-gold-controls.cjs` compares original JS/HTML files, original static HTML IDs and builder Map View keys against the frozen September 6 Gold Standard. No missing files; only intentionally removed enterCombatStation. It explicitly does not certify every historical function.
- `playtest-ship-workflows.cjs` clicks all six toggles in Construction, Details and PC Starships; checks map effects and left-side positioning; tests tab persistence, same-map movement and overhead ghost, console access, purchased cards, both print modes, construction/EN/centering and preparation controls.
- `playtest-visual-corrections.cjs` decodes every tier in Chrome, checks nonblank and distinct pixel hashes, inspects the atlas gallery, checks actual rendered combat facing right/down/left/up and route corners, and verifies reduced motion.
- Existing new-weapon shots, restoration, cockpit, sensor and unit suites are rerun as appropriate. Final outcomes belong in CURRENT-HANDOFF.md.

Active-combat movement from the PC Starships tab still routes to Combat, preserving its existing turn/ATB restrictions. The user was asked whether to keep movement on the large sheet during combat; no answer has arrived as of this correction record. Outside-combat same-map movement is verified. Do not imply this unresolved routing choice has been implemented.

## Prevention

For every future UI move: identify each entry point and audience first, keep display controls independent of edit permissions, then click the preserved controls in the real GM and PC views. A screenshot, existing DOM ID, or broad test count alone is not acceptance. Report unchecked workflows and incomplete requests explicitly. Do not delete/hide functionality merely to simplify a layout. No special user prompt or additional plugin is required to follow this process.
