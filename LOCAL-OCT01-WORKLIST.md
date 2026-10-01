# October 1 active work

User authorized #local, then #commit after completion. Finish all below, verify, commit and push main to origin; no hosted testing. Send ntfy only as the final tool action after cleanup/push verification. Preserve pre-existing authorized dirty work, personal campaign data, Vector and Gold Standard. Do not spawn agents.

- [x] Durable encounter checkpoints and recovery; destructive reset/replacement confirmation and stale/duplicate protection; Resume cannot create defaults.
- [x] GM tab persistence; no automatic return to Scripts; entering Combat restores live view.
- [x] Unified latest ship state in/out of combat: doors, airlocks, locations/stations, HP/shields/impairments/power, AU, cooldowns/ammo, resources/jobs, cloak/probes/drones/docking.
- [x] Outside-combat escape pod/airlock prepares single-current-ship empty encounter before departure; preserve occupants, active ATB rescue; pod passengers removed from interior.
- [x] PC tab accurate active encounter status, including pause; attention flash when clock running on another tab.
- [x] Analysis → Life Scan → subsequent Analysis creates persistent read-only latest per-target timestamped snapshot; exact ship/room stats and detectable crew only; repeat refresh, available out of range, no live updates.
- [x] Breathing-independent race immunity to ship oxygen checks/damage and vacuum damage, not ejection/drift/attacks.
- [x] Visible airlock add/reposition/remove in GM new ship and upgrades; valid blank exterior edge highlight, cancel rollback.
- [x] Hull Breach Repair Drone B122: 12000 credits, EN1, security3, 1x1EDG, Engineering, Endernium2days, threshold25. PDF visually read; user replaces travel12sec with physical mesh movement at PC Move Speed 7, including doors; first check 12 active seconds after arrival; D6 success>=5, failures increase die size each12sec. User override: auto oldest breach first; interior immune bot cannot be targeted; active bot continues regardless host shutdown/destruction; disappears when queue empty if host damaged/missing, no airlock interaction. Use normal animated roll pipeline, active ATB timing. Resolve die cap using established D4/D6/D8/D10/D12 system.
- [x] Analysis Screening B114: 2000 credits, EN1, anySIC(+), SensorSystems, Drakkonite10h; D6 each Analysis 1–4 hides host. Host last-known retained; snapshot room Unknown SIC hides identity/exact condition/instrumentation; detectable Life Scan crew remain. Card impairment N/A. New AI equipment/floorplan/console art as applicable.
- [x] New samples, remaining-SIC list now8 and outputs DOCX/PDF/TXT, detailed report/handoff/rules.
- [x] Focused/full tests, syntax, whitespace, isolated fresh campaign and Explore browser checks. Publication and notification requested; completion is recorded in the release commit and final response.

Read AGENTS/RULEBOOK-REFERENCE; latest prior report LOCAL-AIRLOCKS-SALVAGE-20260930.md. Node/Python bundled runtime under C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/{node/bin/node.exe,python/python.exe}. PDF sources ../SIC_Series_B.pdf pages114,122; renders qa-oct01/card-*.png. Normal local server8790 must not be interrupted unless explicitly needed; isolated test8792 temporary data. Imagegen and PDF skills read/announced. CUA required for browser (read skill before use).
