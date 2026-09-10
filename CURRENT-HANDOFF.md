# Current Recovery Handoff

## Start Here

Read this file, then `AGENTS.md`, then `SHIELD-GENERATORS-PASS.md`. Read `PILOT-CONSOLE-PASS.md` for delayed-input implementation and `RULEBOOK-REFERENCE.md` for game rules. Load relevant code/tests instead of rereading every PDF or reconstructing the entire conversation.

The user authorized the Shield Generators / Shipyard / Skills pass with #commit. Previous published baseline: `6472c14`. Inspect git status/log and the task completion message to establish whether publishing finished; this document alone is not proof of a push or Render deployment.

Completed and published in b0aeca9: 104 tests, expanded fresh-campaign shield/skill browser checks, actual restart, and 12 cockpit mouse orders passed. GitHub push succeeded; Render matched 18 code/style files and 24 artwork hashes, with live Bridge and Shield picker checks at 1366x768. See SHIELD-GENERATORS-PASS.md for actual coverage. Wait for feedback and the next #commit; do not restart this completed pass.

## Latest Pass

Shield generators 2-10 complete the family with unique art and tier-aware consoles. Restabilize only at zero HP (not Reinforce). Larger Construction map, centered green confirmation, Details without construction tools, ascending expanded cards, prominent rainbow console selector, distance-based initial inertia, engine charge audio, copy-edited lore, and clickable skill references with default/alternate Attribute roll setup. Art provenance: SHIELD-GENERATOR-ART.md. Prior shield/bridge foundation remains documented in SHIELD-BRIDGE-PASS.md.

The earlier UI-only usability audit was completed in the prior pass; its three follow-up improvements are part of this pass. Do not restart that historical audit automatically. This pass's browser scripts use API-created finalized PC fixtures, then exercise actual GM/player interfaces. They are not full character-creation playthroughs.

## Retained Features

- Harden movement confirmation and test actual station arrival, not only pre-seated fixtures.
- NPC/GM default: ordinary Move Ship, Leave Console, Console View controls.
- PC default: full console, persistent between turns. Combat View opts out for the station visit. GM never automatically sees a PC console.
- Compact movement planner and full console share submission; Leave Console means character movement.
- Live Tactical Rings, all six delayed-resolution factors with console names, extra reduced-motion-aware animations.
- Both new Explore ships have Power Hybrid Engine 2, Cockpit 1, Exhaust Thruster 1 and Ionic Pulse Thruster 1.
- Main starmap inset between the first ship headers. Existing console background art retained.

Do not restart historical requests automatically. After completion, wait for feedback and the next #commit. A request to write handoff documentation does not authorize unrelated application changes or publication.

## Boundaries

- Gold Standard is frozen. Diamond Standard requires explicit approval.
- Never modify or commit `data/campaigns.json`; isolate tests in temporary directories.
- #commit means implement, verify, commit, push main, stop task-owned processes, then ntfy as the final tool action. Never send intermediate completion notifications.
- Preserve original PNG print masters. WebP derivatives are for web display. Print Starship is not implemented; intended scale is half an inch per small combat-mesh cell.
- Desktop first. Timing is computer-driven, not printed tabletop initiative.
- Crew assignment differs from live location. One occupant per station, two per ordinary location with both tokens visible.
- Exact NPC/ship condition numbers are GM-only, including logs/tooltips.

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
