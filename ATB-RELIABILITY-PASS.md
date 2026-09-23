# ATB And Menu Reliability: Local Pass

## Scope

September 12, 2026. User authorized local investigation and fixes for frozen ATB and missing turn/action menus. No GitHub upload, Render access, Gold Standard changes, or personal campaign edits. Existing unfinished work is preserved.

Tests use disposable campaigns and local servers. Separate GM and player browser contexts are used for the menu/reconnect investigation. Switching roles is not a recovery step.

## Reproduced And Fixed

| Failure | Correction |
| --- | --- |
| A final NPC-ready update could be dropped by the clock's network throttle. | Retain the trailing update even when the clock stops for the NPC. Previously implemented fix retested. |
| A weapon could remain at 00:00 and stop all combat progress. | Cross floating-point event boundaries with bounded positive progress. Previously implemented fix retested. |
| GM takeover of an existing player roll left follow-up dice with the absent player. | Retain GM ownership through ship damage, character attack damage, and First Aid healing. Resolving an NPC defender does not take over the PC attacker. |
| Removing a First Aid healer or patient erased the prompt but left its pause. | Cancel the resolution and release only its associated pause. |
| Automatic NPC defeat removal could strand deferred-action or First Aid pauses. | Cleanup recognizes every affected resolution, not just an active turn or attack. |
| An automatic completion behind a manual resolution could leave the clock stopped. | Continue dispatch after automatic completions instead of returning as though a new prompt had opened. |
| Simultaneous completions could lose First Aid's second prompt. | Save completed treatments in `pendingTimedResolutions` until each is dispatched. Multiple treatments and saved/reloaded pending treatments resolve sequentially. |
| Destroyed crew could retain rolls or trigger later conditional orders, freezing surviving ships. | Disarm destroyed ships and cancel unavailable crew's pending work and associated pauses. Reconcile older saved destruction states too. Character HP is not rewritten. |
| A saved locked shot could lose its lock when the encounter was restored. | Preserve lock, AU, destruction, and victory state alongside the existing combat state. Paid locked input still reaches manual damage. |
| Failed character combat/First Aid submissions closed the player window and falsely reported submission. | Wait for the server acknowledgment. Keep the same result visible with Retry Submit on failure; do not reroll or silently discard it. |
| Restarted servers reset revision numbers, leaving connected clients rejecting every new state. | Distinguish server epochs and accept a fresh snapshot from the current stream. Reject old in-flight HTTP responses and retired stream callbacks. |
| Expired credentials looked like a connected game with missing menus. | Show explicit expired-access feedback, including the embedded PC view that previously hid connection errors. Reauthentication remains required; no authorization checks are bypassed. |
| A GM form opened for one character could submit for the next character. | Bind forms to the originating character, room, server epoch, and turn serial. Stale forms retain input, warn, disable submission, and leave Cancel available. The server rejects an old turn serial. |
| Defeat animations could discard an unsubmitted roll result or forget an already hidden prompt. | Suspend and restore unfinished skill/damage results, including pending submissions, failed-submit retry, and two overlapping defeats. |

## Preserved Behavior

- Pending dice still freeze ATB and command timers until explicit submission.
- GM hard pause survives cleanup, destruction, and encounter restoration.
- Hold remains local to the character and never blocks the whole room.
- No automatic damage rolls or invented replacement results.
- Action and roll requests have bounded waits; failed submissions remain retryable.
- Encounter reset removes old pending rolls and treatments.
- No features or view controls were removed.

## Verification

- Full automated suite: 210 passing tests.
- `combat-orphan-recovery-http.test.js`: removal, automatic defeat, simultaneous completions, destruction, conditional orders, explicit pauses, reset, and pending locked input restoration.
- `combat-roll-takeover-http.test.js`: First Aid/character attack ownership, defender isolation, and stale-turn rejection.
- `playtest-combat-recovery.cjs`: independent GM/PC windows, ship-roll cancellation/reopening, PC reload, interrupted damage submission, offline PC takeover, natural input/damage recovery, and unchanged GM view.
- `playtest-menu-recovery.cjs`: 15 passing checks, zero page errors. Real campaign, independent GM/PC contexts, failed To-Hit/Defense/damage/First Aid submissions, modal queuing/cancellation, unfinished results and submissions overlapping two defeat animations, stale GM forms, and authenticated reconnect with late-response rejection.
- Existing Chrome suites: held-turn, weapon-clock, cockpit, sensors, shields, and lasers all pass.
- Earlier failing cases were reproduced before their product corrections. Tests never use private campaign saves or hosted servers.

The automated checks intentionally use short disposable timer fixtures for rare simultaneous boundaries. Browser checks also exercise natural-clock workflows and actual mouse submissions; GM Step is not the proof that timing works.

Final menu screenshots/results: `test-artifacts/menu-recovery-07IvUV`. Full suite log: `test-artifacts/atb-deep-unit-final.log`. Ship recovery log: `test-artifacts/combat-recovery-browser-final.log`. Connection warnings were visually checked inside the embedded frames and outer viewport. Test servers and browsers closed.

## Local Preview

Fresh test copy: http://127.0.0.1:8790/showcase.html. Server PID 25280 uses separate saves in C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-atb-reliability-20260912. Existing local servers were not stopped and need a restart to load server-side fixes. The preview is intentionally left running; personal campaigns are untouched.

## Limits

This verifies the listed workflows, not every possible campaign combination or real-world network failure. Credentials expire when the server restarts and must be renewed normally. No fixes force time forward through a legitimate pending decision or GM pause. The older question about movement inside the large PC Starships sheet during active combat remains unchanged by this reliability pass.
