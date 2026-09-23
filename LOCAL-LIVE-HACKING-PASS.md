# Local Live Hacking, Sensor Knowledge And Combat Access

Completed locally, September 13, 2026. No commit, push, hosted testing, personal campaign edits or Gold Standard changes.

## Implemented

- CPU Security 1-8 and Hacking Modules 1-5 now support live combat, not only practice. Strongest installed operational CPU supplies firewall; impairment reduces its effective level. Ship Security readouts use the shared hardware calculation.
- Bridge/cockpit access exposes Hack SIC in Combat View and the Hacking console in the shared selector. Hacking skill reaches live units from the actual character sheet. Detect and Systems Analyze an installed, online SIC before opening its puzzle. CPU Security's N/A Security is not a hackable password.
- One submitted guess costs one earned ATB action, with no extra input delay or cooldown. Board drafting is free. Minimum one letter. One operator per module. Feedback is aggregate exact/misplaced letters, never the answer. Current puzzles retain their original challenge after impairment.
- Successful intrusion captures the SIC and blocks its ship's ordinary electronic controls. The defender sees CONSOLE COMPROMISED with restrained chromatic jitter and a local maintenance entry. Physical movement, local power-off, reboot and local counter-hacking remain available. This follows the latest unusable-console request; there is no earlier optional leave-crew-in-control branch.
- Captured supported consoles appear immediately in the selector without reopening it. Weapons, Lock-On, Shields, Sensors and Life Support use their physical ship's hardware/AU. Captured sensors expose their sensor picture, not raw enemy crew or server data. Capturing a weapon alone does not confer unrelated targeting locks. Hardware without an operational console still supports forced impairment. A captured bridge blocks electronic operations, rather than becoming a remote helm.
- Leaving the operator station, losing the sensor connection, unconsciousness, or taking hardware offline removes control. Returning requires another earned guess. Power-off/reboot invalidates the old password. Counter-hacking is a manual D6 strictly below Hacking, followed by a choice of two positions. Changing the password does not silently revoke an established connection.
- Live sessions, original passwords and retry receipts survive a real server restart. Public state does not contain passwords, decoys or private secret IDs. Portable campaign exports intentionally omit active intrusion secrets/sessions; ordinary server persistence retains them. Reset/new preparation cannot reuse stale captured access.
- Automatic probability sweep every 12 active combat seconds: 1/4 within twice effective sensor range, with anonymous ten-unit-radius regions centered within ten units of the object. Stationary Scan Area input raises the chance to at most 4/4. Ship movement resets the bonus, including movement during input. Existing identification rules remain in place.
- Sensors consoles have persistent manual zoom and Fit Contacts, with effective range and passive-search range. Combat ship headers show sensor range too.
- GM NPC-knowledge observer selector defaults to the active NPC ship. Unidentified opposing ships are gray and 50% transparent with (unknown); separate text indicates whether their interiors were analyzed. The enlarged map matches. GM administrative information remains available; the indicator distinguishes knowledge instead of deleting GM controls.
- Begin Combat replaces End Combat outside combat and opens preparation. PCs have a combat-state badge in their main tab bar, independent of hiding the resource HUD.
- PC Starships has Move, Console View, and System Repairs and Diagnostics on the right of its map. No duplicate visible Move button. All six map switches, upgrades, printing and movement remain accessible.
- Move Speed appears in tabbed Substats alongside ATB Speed, Command Window, maximum/current HP, permanent HP and Damage Reduction. Other resources retain their existing Resources tab.
- Zero-HP/unconscious PCs stop gaining ATB and cannot act or operate stations. Sheet HP saves now reach the encounter immediately. Healing resumes initiative without changing GM/player views. Unconscious PCs remain in the roster.

## Additional Bugs Found

- A stale character object caused switching to a newly captured console to fall back to Bridge, despite the selector listing it. Console switching now resolves the latest actor and grants.
- Preparation discarded some existing NPC identities and registered-crew IDs, preventing legitimate local power-off/reboot. These are preserved without granting maintenance rights to intruders.
- Captured weapons displayed an unrelated enemy lock as usable. UI and server now share the controlled-lock check; captured Lock-On release cannot remove another system's lock.
- In-flight commands recheck compromised access. Pending shield reservations and bridge input cannot continue through a new electronic lockout.
- A no-observer sensor projection could throw after combat cleanup. Historical analysis without optional Hull/Shield data is also tolerated.
- NPC-knowledge controls initially overlapped the small starmap header. They now occupy their own stable row, and marker colors recover when knowledge changes.

## Verification

- Full automated suite: 268 passing. Syntax: 144 JS/CJS files. Git whitespace check passes.
- New live-hacking Chrome test uses independent GM and PC browser contexts. Actual Systems Analysis, natural earned readiness, capture, dynamic console switching, defender lockout, manual counter-roll pause, position swap and registered local power-off all pass. No perspective-switch recovery.
- The same test verifies mobile hacking bounds, unknown-ship opacity/interior status in both maps, PC status with HUD hidden, tabbed Substats, and GM Begin Combat navigation. No page errors.
- HTTP tests verify real server restart/private persistence/idempotent retry, and immediate sheet-HP/unconsciousness/healing propagation. Unit tests cover captured-weapon physical AU/manual damage, targeting privileges, one-letter floor, module/firewall impairment, local bridge counter-hack, anonymous sweeps and stationary probability bonuses.
- Existing Chrome practice, held-turn, weapon-clock, combat-recovery and ship-workflow suites pass. Includes lost-response practice retry, all thirteen hardware artworks/purchases, unchanged-GM NPC turn delivery, unlocked/locked Ripple and Ion with PC/GM rolls, blocked dice loading recovery, disconnected-PC takeover, six map switches, both print modes, upgrades and speed-dependent walking.
- Captured weapon/Lock-On rules have engine coverage; not every captured SIC grade/console combination has been exercised by hand in Chrome. No assurance that all possible campaign combinations are bug-free.
- Decker/Reverence stacking and shared hacking notes remain deferred; the unanswered enhancements were not assumed.

## Preview And Next Pass

Fresh preview: http://127.0.0.1:8795/showcase.html
GM entry: http://127.0.0.1:8795/gm.html
PID 18084. Separate disposable data/logs: C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-live-hacking-20260913.
Older servers were not stopped and may retain older server logic. Use this new URL for the current pass. Explore starts on Script without combat; install a Hacking Module through ship upgrades to try it in your own setup.

Keep the new HTTP and independent-client browser tests in future regression runs. Preserve private server hacking state separately from client snapshots, manual dice ownership, hard pauses and all existing UI entry points. No fresh question blocks this completed batch. Completion notification must be the final operational action.
