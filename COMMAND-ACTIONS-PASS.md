# Command Actions and Interior Movement

## Scope

- Interior minimaps have 72px hull cells (24px combat mesh), panning, and an outermost-viewport expanded planner. Expanded and compact views share destination/route state. Back preserves the selection; Confirm submits once. Live occupant refresh does not replace active controls.
- Cockpit/bridge Command page: Hail, Team Execution, Preemptive Calculation, Evasive Maneuvers, Ram and Skim. Navigation and existing console art remain in place. Hails can be answered between turns.
- Obscure actions have hover help and a separate question-mark button opening compact help without spending an action.
- Share Data supports multiple recipients. Conditional orders support command operations, navigation and sensors, with movement/distance/hex triggers.
- Local SIC repair, power off and timed restart. Outside-combat diagnostics use GM Pass Time and cancel when the worker leaves the room. Combat-end locations/conditions save before clients are notified.
- Character creation guidance waits for initialization and does not appear for finalized campaign or Explore Features characters.

## Rule Sources and Playtest Interpretations

Core PDF pages 62-64 and 68-69; Cockpit/Bridge SIC restart metadata. Computer-driven timing replaces tabletop initiative. CvC rounds are 3 seconds; SvS rounds are 12 seconds.

- Team Execution window: 12 combat seconds after input; fuse one combined pool, highest associated skill, +1 per participant. Preparation cannot assist its own contributor's roll.
- Preemptive Calculation: +2 next matching roll, stacks, expires after floor(Mathematics)*12 combat seconds. Mathematics below 1 cannot create a lasting preparation.
- Bridge-only administrative input uses base 8, Quality ceil(tier/2) capped at four, Computer Systems Ingenuity bands, neutral other factors. Thruster maneuvers retain pilot movement's established input settings. These timing choices need playtesting.
- Repair SIC: 9 seconds (three CvC actions), Intellect plus associated skill against 10, removing one impairment and increasing future difficulty by 1 on success.
- Diagnostics: 55 GM-passed minutes, a concrete interpretation of "a little under an hour". No roll, outside combat only, worker remains in the SIC room.
- Conditional orders cost 2 extra AU after input, one armed order per ship, expire after 12 combat seconds. After input the operator may leave; queued orders retain their original location. Movement boosts are additionally charged at launch. Missing equipment/AU can still prevent launch.
- Ram uses pre-impact current Hull/Shield totals, simultaneous damage and one destruction-bonus pass. Skim bursting bonus uses pre-impact shield HP. These ambiguous damage details are implementation interpretations, not separately user-approved formulas.
- Evade uses max(Masking, roll + Pilot/Helm + HSM) against the next attack. A successful defense permits a one-Unit step away from the attacker. Current consuming attacks are Ram/Skim; future weapon integration must reuse this defense.
- Cockpit 1 reboot metadata: 8 SvS rounds = 96 seconds. Restart does not erase impairment; diagnostics do.

## Intentionally Deferred

Break Enemy Lock-On needs actual lock-on state/SICs. Counter Hack awaits hacking. Repair Hull Breach awaits breach state and rules, then must be visible only in the affected room. Warp, launcher and external-utility conditional triggers await those implemented event sources. Do not add apparently usable buttons that cannot resolve these actions.

## Verification

Local verification: all 128 unit/HTTP tests pass. Cockpit browser checks passed 12 PC/NPC mouse orders across fresh campaign and Explore Features station-arrival workflows. Shield browser checks passed local/remote/out-of-turn use, AU, restabilization, occupancy and restart. Extended sensor browser checks passed GM/two PCs, privacy, held clicks, analysis/share, Command tabs/help/preparation, rejection of unaffordable conditional orders without consuming a turn, expanded movement, local power-off/restart, diagnostics at 54+1 GM-passed minutes, reload and server restart. Final Render verification is pending.

Browser fixtures create finalized characters through APIs, then exercise real mouse controls; this is not a complete new-user character-creation walkthrough. Tests use isolated temporary data, never data/campaigns.json. Gold Standard is unchanged. New Command sections reuse the existing console background. Completed commands and maintenance report into the owning ship's Combat Activity.

Relevant checks: tests/ship-commands.test.js, scripts/playtest-sensors.cjs, scripts/playtest-cockpit.cjs, scripts/playtest-shields.cjs, scripts/verify-sensors-live.cjs. Final screenshot artifacts are under ignored test-artifacts directories.

Hosted follow-up: the first Render run matched all 28 code/style files and 19 images, then caught an unstyled expanded dialog while the parent-page CSS was still loading. The planner now waits for both required stylesheets, handles timeout/retry, and blocks duplicate opening while loading. A browser regression delays that CSS by 800ms and verifies no unstyled dialog is shown. Local browser and full 128-test reruns pass; hosted rerun pending.
