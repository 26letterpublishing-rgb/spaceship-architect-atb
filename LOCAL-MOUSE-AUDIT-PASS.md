# Local Mouse And Room-Parity Audit

Completed locally on 2026-09-13. No commit, push, Render access, Gold Standard modification, or personal campaign-file edits.

## Reproduced And Corrected

- Explore hid its room code by default. Fresh rooms now show the real code using the same campaign setting as permanent campaigns; the GM can still deliberately hide it.
- Reloading Explore silently created a different room. A tab now resumes its existing room and perspective while that room remains available. Explicit Reset Room creates a new room and clears the old session credentials. Server restart/expiration creates a fresh demo, not a false promise of permanent demo storage.
- Nova initially opened Combat with an inactive clock even before combat began. Out-of-combat Explore now opens the player Campaign tab. Active encounters still open Combat, and explicit Starships links take precedence.
- Console View at an unoccupied station looked unresponsive because its message was placed in the hidden Advancement section. Character notices now also appear in the outer visible viewport, including while a large embedded ship sheet is scrolled. Notices are nonmodal, dismissible, and expire normally; existing inline notices remain.
- Out-of-combat console help was disabled along with combat actions. Help remains available, and standby labels no longer imply the player is waiting for an ATB turn outside combat. Action authorization and disabled combat controls are unchanged.
- Adding the second ship to preparation retained the one-ship framing, leaving the new ship outside the map. Ship selection now fits automatically until the GM manually zooms. Position changes and drag/drop still preserve the chosen zoom; Fit Ships restores automatic selection framing.
- Beginning combat from the bottom of preparation left its clock controls off-screen. Successful preparation scrolls to the combat frame. It still waits for the GM to engage the clock intentionally.
- Joining Explore through a plain room/character URL could persist its campaign selection/cache in personal browser storage. Server redirects select demo storage before page scripts execute; room-code form loading also switches to demo mode before caching. Ordinary permanent campaigns retain normal persistence and authentication.

## Mouse Exploration

Used visible installed Chrome at 1366x768: fresh Explore, GM settings and tabs, PC tabs, large ship sheet scrolling, station movement, console selection, Sensors zoom/help, preparation ship selection/Fit Ships/Begin Combat/Engage Clock, and NUT dispensing/eating. The NUT blob disappeared on click and displayed the existing taste result. Created a normal campaign using the GM form. Browser errors were collected during the new automated workflow.

The new repeatable `scripts/playtest-mouse-audit.cjs` verifies:

- Explore's visible code, out-of-combat landing, refresh preservation and explicit reset.
- Visible map-action feedback, all six map toggles, movement to a real bridge station, console access, Sensors zoom and actual help opening/closing.
- Both ships initially visible in preparation, manual zoom preserved after coordinate edits, and clock controls visible after preparation.
- Permanent room creation through the real GM form and a separately authenticated PC with matching ship controls, Upgrade Ship and print access.
- Independent access to a demo using its normal room/character URL, PC-code unlock, and no persistent personal library/campaign selection writes.

Character entry/approval and ship population in the permanent-room portion use API fixtures. This is not a claim that every race/class creation path was entered by hand. Automated tests use isolated temporary data; screenshots are under ignored `test-artifacts/mouse-audit`.

## Verification

- Full suite after final backend changes: 317 passed, zero failed.
- New mouse audit: passed, including independent demo login and storage isolation.
- `playtest-ship-workflows.cjs`: passed; six toggles, PC upgrades/purchase/confirmation/return, both print modes, movement timing, construction expansion/centering/negative EN, preparation dragging, and purchased-card layouts.
- `playtest-held-turn.cjs`: passed at desktop/laptop/compact sizes and independent PC Hold to GM NPC turn without switching perspectives.
- `playtest-weapon-clock.cjs`: passed Ripple/Ion locked/unlocked, PC/GM ownership, manual damage freeze and natural ATB recovery.
- `playtest-menu-recovery.cjs`: passed cancellation/retry, hidden-tab First Aid, overlapping NPC defeats, damage presentation, stale forms and reconnect/auth recovery.
- `playtest-live-hacking.cjs`: passed independent GM/PC intrusion/capture/counter-hack/recovery, enemy bridge navigation, sensor knowledge and mobile board bounds.
- `playtest-warp-transit.cjs`: passed purchase/stores, PC consoles, warp animation/travel/exit, self-destruct cancellation, reload and mobile controls.
- Gold Standard static preservation check: no missing files or newly missing named controls. The previously documented intentional `enterCombatStation` replacement remains the sole excluded legacy ID. This is a structural check, not exhaustive behavioral proof.

No game rules, dice ownership or ATB timing were changed in this audit. No feature was deliberately removed. These checks substantially cover the requested paths but do not prove every possible campaign state or physical-laptop performance characteristic.

## Preview

Use http://127.0.0.1:8798/showcase.html or http://127.0.0.1:8798/gm.html.

The restarted current server is intentionally running, terminal session 7401. Its isolated data directory is `C:\Users\zombi\AppData\Local\SpaceshipArchitect\local-mouse-audit-20260913`. Older previews were not modified; only this pass's own 8798 process was restarted for the final backend.
