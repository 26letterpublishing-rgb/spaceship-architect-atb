# Local Devastation Laser pass — September 28, 2026

## Implemented
Both B-105 and B-106 are purchasable in Weapons & Targeting, with AI-generated card art and a shared generated control-room floorplan/exterior barrel. The printed mixed footprint is 2×4 exterior plus 1×2 edge control room, with one local station. They also work through an available Bridge/Cockpit or captured weapon control using the existing rules.

| | Devastation Laser 1 | Devastation Laser 2 |
|---|---:|---:|
| Price | 22,000 | 50,000 |
| EN | 5 | 10 |
| Security | 4 | 4 |
| Damage threshold | 19 | 21 |
| Charge time | 36 active seconds | 60 active seconds |
| Charge/hold upkeep | 5 AU / 12 seconds | 7 AU / 12 seconds |
| Damage | 10D8 | 10D12 |
| Cooldown after firing | 36 active seconds | 60 active seconds |
| Crafting | Carmot, 1 week | Infinium, 10 days |

Printed source: SIC_Series_B.pdf, pages/cards 105–106. Rendered source cards are in test-artifacts/devastation-pass. Both charge and cooldown use 1 SvS round = 12 seconds. Laser 2 specifically has five rounds of cooldown, not three.

## Player experience
- Begin Charging and Release Charge are available at the station outside combat. In combat they require the operator’s turn.
- Charging continues independently after the initiating command; the operator can leave the station or console. Only one charge is stored per installation.
- A dark red pulsing bar reads exactly “weapon ready to fire” when charged. The console shows charge/cooldown progress, AU upkeep and why unavailable actions are disabled. Reduced-motion preferences replace the pulse with a steady red bar.
- After firing, the bar changes to a cooldown countdown. Recharging remains unavailable until it finishes.
- Firing uses existing targeting, accuracy or controlled Lock-On, input delay, manual damage confirmation, and the standard dice animation. No new dice roller or silent damage result was introduced.
- Normal layered shields and Laser Resistance apply. Shield overflow never reaches Hull through this change.
- Explore Features includes Ember Lance (Laser 1) and Crimson Verdict (Laser 2), with enough AU generation for the installed laser’s upkeep.

## Decisions
- AU is paid immediately for the first 12-second interval, then every 12 active seconds while charging or holding readiness. At charge completion, the next holding interval is prepaid. A missed shot still expends the charge and starts cooldown.
- Loss of sufficient AU, EN, functioning weapon integrity, or normal uncloaked/non-warp operation dissipates a charge. The console states the reason. Impaired weapons cannot charge or fire; the printed “unstable” condition is retained without inventing explosion rules.
- Manually releasing an unfired charge returns it to idle without a firing cooldown and does not refund AU. Cooldown continues even if the SIC is powered down, preventing power-toggle bypasses.
- In combat, all timers follow active ATB time and stop with pauses and pending rolls. Outside combat, they follow the existing live campaign clock and GM Pass Time. No offline wall-clock catch-up is invented after the server stops.
- Charge state, upkeep progress, cooldown and command receipts persist through campaign saves and server restart. Stale ship edits and stale combat-preparation snapshots cannot restore spent charges or erase a valid precharge. Two operators cannot reserve the same ready charge for two shots.
- Automated actors skip unavailable Devastation Lasers. Ship AI may fire an already funded charge but does not spend AU to charge it.
- Large GM time jumps skip repeated stable upkeep cycles, avoiding millions of payment iterations. Idle AU recovery continues outside combat after charge release.

## Verification
- Full suite: 712 tests passed with bounded test concurrency. Final additional checks after concurrency/preparation guards: all 22 focused Devastation, HTTP and automation tests passed.
- Coverage includes printed metadata/placement, both charge and cooldown lengths, duplicate commands, precharge before combat, explicit standard damage, missed shots, impairment/shutdown, AU failure/recovery, simultaneous operators, large downtime equivalence/performance, authenticated crew access, GM time advance, stale edits, restart and stale combat preparation.
- Mouse/browser test on isolated port 8792: opened the PC Starships console, began charging outside combat, observed the countdown finish in real time and the pulsing ready banner, carried readiness into combat, fired at a locked target, rolled all ten D8s with the existing animation, confirmed 48 damage, and observed 20 shield damage / zero Hull damage and the cooldown countdown. Browser errors/warnings were empty.
- Browser testing caught and fixed the shared preview guard blocking charge buttons. An older HTTP test needed its GM authentication added because anonymous views correctly hide intruders. One timing-sensitive Cleanser test initially failed under unrestricted parallel load; it passed alone and in the complete bounded-concurrency run. No Cleanser behavior was changed.
- Evidence: test-artifacts/devastation-pass/ready.png and cooldown.png. Asset provenance: ASSETS-DEVASTATION-20260928.json. Four compact WebP assets; full generated masters remain separate.

## Delivery
Local changes only. No commit, push, deployment or personal campaign edits. The temporary test server/tab and authentication harness are cleaned up. Restart the Spaceship Architect server and refresh the GM/PC pages. Vector and Gold Standard remain untouched.
