# Astra Cleanup

## Cockpit Navigation and Card Proportions Pass

- Canonical 350x490 SIC faces across shop, picker, inspector and collection. Purchased thumbnails uniformly scale to approximately 117x163, preserving poker proportions and staying within the shelf.
- New distinct Ionic Pulse Thruster card artwork for all five tiers; existing ship placement sprites unchanged. Cockpit 1 has its own card and overhead artwork, printed construction values, outer-edge placement and one-Bridge limit.
- Server-authoritative cockpit movement, AU boost selection, continuous fractional routes, mid-flight replacement orders, repeated inertia, impairment handling and restart persistence. Pilot actions resolve immediately so ATB continues independently.
- Fixed duplicate embedded campaign event subscriptions that exhausted HTTP/1.1 browser connections with GM and PC tabs open, stalling new resources and movement confirmation. Parent frames now relay campaign updates with origin/source checks; encounter streams remain live.
- Verification: 74 automated tests passed, including fresh GM/two-PC fixture joins, both ship-link workflows, repeated PC/NPC orders, permissions, AU preservation, route persistence through actual server restart, and renewed GM login afterward. Optional Edge mouse regression completed three NPC and three PC ship orders, click-lock/one-click confirmation, mid-route changes, live enlarged map, station departure, card measurements and all five loaded Ionic images.
- Tests use temporary campaigns, not repository campaign data. Fresh PCs were API-created fixtures, not full character-creation journeys. Local results do not establish Render/PostgreSQL correctness, exhaustive gameplay coverage, or mobile polish. Gold Standard remains untouched.
- Final Explore Features smoke check: opened GM combat, resumed the prepared encounter, engaged the clock, switched to Nova Vale, and verified the live two-ship map appears in PC combat without page errors. New cockpit movement was exercised in the separate fresh campaign, not claimed as an Explore movement test.

## Scope

Preserve Gold Standard and the computer-driven ATB rules. Incrementally consolidate the active application, not a rewrite. No new SIC expansion during this pass.

## Progress

- Baseline: 14 existing tests pass. Isolated local server uses temporary campaign storage, never data/campaigns.json.
- Browser baseline: Explore Features GM combat loads; maps sit below rings/logs, with excessive vertical travel. Combat doors have different geometry from the builder.
- Code-confirmed: player map renders a full wall behind a door instead of two wall segments. Player map hides station occupants when Stations is unchecked; mesh zero falls back to center.
- Shared boundary markup/CSS now serves builder, combat, and player views: slim walls, centered two-leaf doors, flat low-resolution rooms, clearer combat mesh, and visible occupied stations.
- Builder clipping and stacking fixes restore multi-square utility-room edges. Focus no longer scrolls the clipped grid viewport away from its fitted position. New ships start in Build mode.
- Desktop combat uses compact controls and paired ship workspaces with maps alongside ATB/logs. Nested-frame popup positioning intersects all ancestor viewports.
- Movement previews preserve map hit targets. Player noncombat selection updates in place, locks on click, guards pending confirmation, animates seated-character departures, and preserves mesh zero. Player door controls use shared door states.
- Linked-ship crew management is exposed to authenticated GMs in both builder entry paths. GM ship viewing suppresses character-only chrome and hands editing back to the campaign workspace. Fleet EN uses SIC definitions rather than counting all SICs as engines.
- SIC catalog/expanded cards use content-fit sizing. Gold Standard remains untouched; no Diamond snapshot or new SICs were added.
- Startup no longer deletes campaigns or browser saves based on epoch metadata. Invalid local campaign data fails startup rather than overwriting it. Static serving excludes private server/data files.

## Verification Performed

- 24 automated tests pass, including fresh HTTP GM/two-PC joins, both ship-link workflows, crew permissions/persistence, private-file rejection, station occupancy, closed-door movement timing, same-ship targeting, corner mesh-zero preservation, and non-replacing player destination updates.
- All changed application JavaScript passes syntax checks; git diff whitespace checks pass.
- Explore Features: clock engagement; three NPC movement confirmations including station arrival and occupied-station rejection; Nova PC movement; GM notification observed before switching to the PC; compact maps/rings and collapsible prompts inspected.
- Fresh isolated campaign S2H9: two approved fixture PCs; standalone utility ship linked with Aster assigned; GM-created cutter linked with Bram assigned; campaign tabs retained; assignments persisted and player view showed the correct assigned ship.
- Browser-tested repeated Aster noncombat station arrivals/departures with single-click selection and confirmation, including a corner destination. Restarted the test server and verified the corner position persists.
- GM viewer sizing uses content bounds to avoid iframe height feedback. Visually verified its stable height and a direct mouse click opening Edit Ship in the campaign editor while closing the viewer. Fleet EN now shows 5 for the utility ship, matching its detailed view.
- Utility ship inspected in high/low resolution and combat mesh: EN1, 2x2 Life Support, and 1x1 Nutritional Supplement artwork and boundaries; compact Life Support and Engine6 cards inspected.
- All campaign fixtures use temporary local storage, never repository campaign data.

## Limits / Next Pass

- These are local checks, not verification of a live Render deployment or PostgreSQL integration.
- Fresh PCs were approved test fixtures, not two complete character-creation UI journeys. One PC combat move and repeated noncombat PC moves were exercised; this is not exhaustive multiplayer endurance testing.
- Mobile-specific polish and complete combat/state architectural extraction remain future work. This pass reduces duplicated presentation and unstable rerendering, not a wholesale rewrite.

## Verification Policy

Record browser workflows actually performed, not inferred from tests. Local verification is not evidence of successful Render deployment. Stop agent-started servers and test tabs at completion.
