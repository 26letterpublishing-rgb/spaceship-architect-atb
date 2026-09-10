# Current Recovery Handoff

## Authorized Pass In Progress

Scan feedback and console layout are authorized by the latest #commit. Implementation and local checks are complete; GitHub publication and hosted verification are next. Read SCAN-FEEDBACK-PASS.md. 129 tests passed, plus sensor browser checks including pending-roll restart/GM recovery, 12 cockpit orders and shield regressions. Do not treat historical hosted completion below as verification of this pass. Gold Standard and live campaign data remain untouched.

## Start Here

Read this file, then `AGENTS.md`, then `COMMAND-ACTIONS-PASS.md`. Read `PILOT-CONSOLE-PASS.md` for delayed-input implementation and `RULEBOOK-REFERENCE.md` for game rules. Load relevant code/tests instead of rereading every PDF or reconstructing the entire conversation.

The authorized Command Actions and Interior Movement pass is COMPLETE. Application commits eaf99ac and 7740d93 are pushed to GitHub and verified on Render. The first hosted walkthrough caught a stylesheet-loading race in the expanded interior; 7740d93 fixes it, with an 800ms-delayed CSS browser regression. The hosted rerun passed and all task-owned test/browser/server processes exited. Wait for feedback and the next #commit; do not restart this historical pass.

Verification passed: 128 unit/HTTP tests; fresh-campaign GM/two-PC sensor workflow plus Command help/Team preparation, enlarged held-click interior movement, local power-off/restart, diagnostics through GM Pass Time, shield regressions, and 12 cockpit mouse orders. Eleven command/maintenance unit checks include conditional navigation/analysis after departure. Render matched 28 code/style files and 19 optimized images; hosted cards, GM/PC switch, scan, Command help and expanded interior passed. See COMMAND-ACTIONS-PASS.md for interpretations and deferred features.

## Latest Pass

Expanded interior movement with stable confirmation and a 24px minimum combat-mesh target. Cockpit/bridge Command tabs for Hail, Preparation and Maneuvers; help dialogs; multi-recipient Share Data; conditional movement/sensor/command orders; local repair/reboot and outside-combat diagnostics via GM Pass Time. Combat-end conditions and positions persist before client notification. Explore/finalized characters no longer receive draft creation guidance. Lock-On, hacking, hull-breach repair and future equipment triggers remain explicitly deferred.

Sensors 1-9, remote sensor console, observer-specific unknown/detected contacts, exact-HP analysis snapshots, GM Life Scan readings, shared intelligence, updated demo ships and reduced impaired ranges. No physical sensor stations. Sensor skill affects rolls, not input speed; Quality is tier-based. All new graphics have web derivatives and preserved print masters. Player REST/SSE encounter requests now carry the authenticated character token; GM requests require their token to see the complete sensor-enabled battle.

Shield generators 2-10 complete the family with unique art and tier-aware consoles. Restabilize only at zero HP (not Reinforce). Larger Construction map, centered green confirmation, Details without construction tools, ascending expanded cards, prominent rainbow console selector, distance-based initial inertia, engine charge audio, copy-edited lore, and clickable skill references with default/alternate Attribute roll setup. Art provenance: SHIELD-GENERATOR-ART.md. Prior shield/bridge foundation remains documented in SHIELD-BRIDGE-PASS.md.

The earlier UI-only usability audit was completed in the prior pass; its three follow-up improvements are part of this pass. Do not restart that historical audit automatically. This pass's browser scripts use API-created finalized PC fixtures, then exercise actual GM/player interfaces. They are not full character-creation playthroughs.

## Retained Features

- Harden movement confirmation and test actual station arrival, not only pre-seated fixtures.
- NPC/GM default: ordinary Move Ship, Leave Console, Console View controls.
- PC default: full console, persistent between turns. Combat View opts out for the station visit. GM never automatically sees a PC console.
- Compact movement planner and full console share submission; Leave Console means character movement.
- Live Tactical Rings, all six delayed-resolution factors with console names, extra reduced-motion-aware animations.
- Both new/reset Explore ships have Power Hybrid Engine 4, Bridge 1, Exhaust Thruster 1, Ionic Pulse Thruster 1, Sensors 3, Shield 1, Life Support and Nutritional Supplement. Start 10 Units apart with a disclosed demo-only Masking 18 modifier. Keep future demo layouts current with implemented SIC families.
- Main starmap inset between the first ship headers. Existing console background art retained.

Do not restart historical requests automatically. After completion, wait for feedback and the next #commit. A request to write handoff documentation does not authorize unrelated application changes or publication.

## Boundaries

- Gold Standard is frozen. Diamond Standard requires explicit approval.
- Never modify or commit `data/campaigns.json`; isolate tests in temporary directories.
- #commit means implement, verify, commit, push main, stop task-owned processes, then ntfy as the final tool action. Never send intermediate completion notifications.
- Preserve original PNG print masters. WebP derivatives are for web display. Print Starship is not implemented; intended scale is half an inch per small combat-mesh cell.
- Desktop first. Timing is computer-driven, not printed tabletop initiative.
- Crew assignment differs from live location. One occupant per station, two per ordinary location with both tokens visible.
- Exact NPC/ship condition numbers are GM-only, including logs/tooltips, except timestamped ship HP snapshots explicitly obtained by successful Systems Analysis.

## Rules To Preserve

Cockpit 1 is 1x1 interior, EDG touching a true outer wall. Ship orders require operational cockpit, EN and thrusters. Maximum four installed thrusters; unlimited purchases/storage.

Ship movement interval is 12 combat seconds, character movement 3. Input is delayed: pilot ATB freezes, Leave and other actions are blocked, existing flight continues. At completion the new route starts from the actual position. Forced relocation may cancel input; launched flight remains independent of the pilot.

Performance +4, Very Fast base 14. Pilot/Helm Ingenuity: 0 -> 0; 1-2 -> 1; 3-4 -> 2; 5 -> 3; 6+ -> 4. Quality averages the highest two operational thruster tiers, rounded up, or the sole tier. Four-bar saturation above tier four is an implementation assumption, not an explicitly settled user rule. Other factors stay neutral; do not change delay math to populate visuals.

Boosts charge at launch: Exhaust 4 AU, Ionic 2 AU, tier speed once per selected thruster. Preserve old route if AU is insufficient at launch. Impairment removes affected boost, not frozen base movement. Drift repeatedly becomes max(0, floor(speed/2)-2) every 12 seconds. New orders can replace ongoing flight. Queued effects remain separate future behavior.

## Testing Honesty

See follow-up notes for coverage. Original local pre-seated tests passed before this pass; the historical hosted confirmation failure has no proven root cause. New coverage includes actual Explore station arrival, separate GM/PC sessions, pointer travel, held clicks, request latency and repeat clicks. This is not exhaustive or overnight testing.

Reproduce new reports against the actual workflow and deployed version. Existing Explore rooms need Reset Room for new ship fixtures. A push is not proof of Render deployment; local success is not proof of live gameplay.

## Environment

- Repo: `C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer`.
- GitHub: https://github.com/26letterpublishing-rgb/spaceship-architect-atb.git
- Hosted: https://spaceship-architect-atb.onrender.com
- PowerShell; bundled Node: `C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.
- Playwright uses Edge (`channel: 'msedge'`). Optional test: `scripts/playtest-cockpit.cjs`.
- Preserve line endings; stage deliberately with `git -c core.autocrlf=false add` when needed.

Final notification after completed work, publishing and cleanup:

```powershell
Invoke-RestMethod -Method Post -Uri "https://ntfy.sh/SPACESHIPATB" -Headers @{ Title = "Codex Finished" } -Body "Your Codex task is complete."
```

Fresh-task opener: "Read AGENTS.md and CURRENT-HANDOFF.md, then summarize the current state and any questions. Wait for #commit before application changes. Protect Gold Standard."

Keep this file as current state, not a transcript. Put detailed completed-pass notes in focused documents. This reduces catch-up work, not necessarily chat latency.
