# Reliability Pass 1

September 11, 2026. First of the two requested passes. The second feature/rules pass requires the user's next `#commit`.

## Changes

- Authenticated GM, PC and embedded combat views wait for their initial state before revealing default panels. Early console/feedback CSS avoids late unstyled UI. Invalid-session paths still reveal recovery controls.
- PC combat opening skips an unchanged character-save round trip and the artificial 120 ms tab delay. GM updates no longer rebuild inactive roster, ship, prompt and setup lists.
- Embedded height measurement follows the content shell rather than feeding the old iframe height back into itself. Turn panels no longer run entry animations or animate dimensions.
- Large mirrored collapse/restore tabs sit outside transformed panels, within the visible viewport. Collapse state resets for each new turn. Immediate/finished movement releases temporary action-panel hiding.
- Campaign ship maps use live encounter character locations. The PC Starships tab receives position updates from its authenticated combat frame and a small, authorized campaign position event, including before Combat has ever been opened. While combat is active, movement uses combat actions instead of allowing an unsynchronized free move. Outside combat, saved positions remain authoritative.
- Diagnostics retain completion/cancellation reports, show maintenance history, and notify the operator. Completion explains impairment removal, reset repair difficulty and unchanged power state.
- Ship-roll outcomes notify the roller after resolution, remain until acknowledged, and do not pause ATB. Input progress stays in the existing console display rather than generating extra persistent notices. Results show one at a time; OK reveals earlier unacknowledged results. GM-owned result records are filtered out of player responses.
- Ordinary D12 dice are green rather than red; damage dice retain their red palette. Console mute icons reflect state. Blocked engine centers are darker in low resolution. GM End Combat opens Prepare Combat.

## Verification

- 170 unit/HTTP tests passed, including live campaign locations, blocked free movement in combat, GM-only result ownership, diagnostics completion/cancellation and non-damage dice color.
- Chrome at 4x CPU slowdown: four GM/PC switches took 1541, 1632, 1070 and 1505 ms (about 1.44 seconds mean), transferring about 0.78 MB. This is a controlled local measurement, not a prediction for the user's laptop. Prior pass was about 1.60 seconds mean; the original pre-optimization baseline was 2.93 seconds and 33 MB.
- Browser audit: three consecutive NPC turns without perspective switching, large PC/NPC tabs, sticky-HUD clearance, collapse/restore, lower map controls, live station location in PC Starships, 200 ms network latency/500 KB/s console loading, GM-owned accuracy/damage dialogs, and result persistence beyond 7 seconds until OK.
- Fresh-campaign sensor GM/two-PC browser checks passed, including privacy, diagnostics through GM Pass Time, visible maintenance result/history and reload.
- Cockpit suite passed twelve mouse-issued orders across fresh campaigns and Explore, including actual station arrival, Hold and panel controls. Shield and laser browser suites passed.
- Syntax and whitespace checks passed. Browser screenshots reviewed. Test servers use isolated temporary campaign data; personal campaign data and Gold Standard are untouched.

Initial test iterations caught notification stacking over controls, stale test expectations for the old bottom-right arrow, and selectors that expected a free-standing token instead of the occupied station marker. These were corrected and the affected suites rerun.

Deployment verification is performed after pushing, separately from these local checks. No claim that every source of laptop lag is eliminated: iframe navigation and artwork/layout work still incur a cost.

## Next Pass

Keep the pending feature/rule list in CURRENT-HANDOFF.md. In particular, powered movement changes to a 10-second period and sensor analysis background processing changes to max(1, 12 - SIC level) seconds are NOT in this pass. Neither are ship printing, construction expansion, or out-of-combat consoles.
