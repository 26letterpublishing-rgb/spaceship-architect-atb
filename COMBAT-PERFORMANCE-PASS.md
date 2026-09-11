# Combat Performance And Layout Pass

## September 11, 2026

- Minimap zoom/fullscreen controls are small rectangles below the map. Movement Cancel and Station/Confirm sit immediately below the map with contrasting red/gold colors.
- PC collapse/restore controls stay at bottom right; turn panels clear the parent character HUD. Console View is gold with black text.
- Main Combat Activity detection entries no longer receive the repeatedly restarted flashing class. Console intelligence alerts remain available.
- GM-initiated PC actions retain GM ownership for follow-up accuracy/damage rolls, including delayed ship orders. Player submissions to GM-owned rolls are rejected.
- Pending ship dice freeze combat progression and active decision timers; manual Step cannot bypass the roll. Damage is still explicitly rolled, never automatically resolved.
- Console styles load before the interface appears, preventing oversized unstyled buttons during slow GM/PC transitions.
- Hidden character speed previews stop animating. Unchanged ship layouts are reused across incremental combat updates. Selecting the current Explore perspective no longer reloads it.

## Bandwidth And Performance

The supplied email concerns Render outbound bandwidth, not GitHub repository storage. Repository assets were about 456 MB, including roughly 433 MB of original PNG artwork and 25 MB of web derivatives. No artwork masters, campaign data, or Git history were deleted.

Public static assets now support gzip and conditional browser caching (ETag/304). They revalidate so deployments remain fresh; private API responses remain uncached. The server asset cache is bounded at 32 MiB.

Combat streams opt into incremental state updates after the first snapshot. Differences are calculated only after per-viewer privacy filtering. Reconnects start with a fresh full snapshot; older clients remain compatible. Clock-only broadcasts are limited to five per second, while simulation still ticks ten times per second and action broadcasts remain immediate.

Controlled local Chrome testing with 4x CPU throttling and four GM/PC switches:

| Measurement | Before (1274b2d) | After |
| --- | --- | --- |
| Downloaded during four switches | 32,992,994 bytes | 785,121 bytes |
| Mean switch time | 2.93 seconds | 1.60 seconds |

This is approximately 98% less repeated-switch transfer and 45% faster switching in this test, not a guaranteed laptop frame rate or reduction of the entire monthly bill. Initial visits still download required assets. Local testing avoids spending hosted bandwidth unnecessarily.

## Verification

166 automated tests pass. The new HTTP test checks gzip/304, private incremental streams, GM-owned accuracy and damage, rejected PC submissions, frozen ATB, and an actual second PC's decision timer while damage is pending.

Chrome UI auditing covers scrolled HUD clearance, collapse/restore, below-map controls, zoom behavior, slow-network console styling, GM/PC transitions, and GM-owned shared dice. Existing sensor GM/two-PC, shield, twelve-order cockpit, and locked/unlocked laser browser regressions pass. Screenshots are under ignored test-artifacts/performance.

Run scripts/audit-combat-performance.cjs with SA_VERIFY_UI=1 for local regression. SA_AUDIT_BASE can target Render for one bounded disposable Explore smoke test. Avoid repeatedly downloading all artwork to verify deployments.

New combat-wire.js is public browser code; static-response.js remains server-only. Gold Standard and data/campaigns.json are untouched.

## Hosted Verification

Application 71e093b is pushed to main and verified on Render. Hosted combat-wire.js matched the local source and its conditional request returned 304. The live Chrome walkthrough passed the compact map controls, HUD clearance, collapse/restore, slow-network console layout and both GM-owned dice prompts with no browser errors. Four live GM/PC switches transferred 463,030 bytes (not directly comparable to the controlled local baseline). The audit now waits for the current player frame instead of retaining a potentially detached frame during navigation. Temporary baseline checkout and test browsers/servers were closed.
