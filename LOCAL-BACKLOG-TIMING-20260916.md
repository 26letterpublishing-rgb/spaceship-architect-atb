# Local backlog and timing pass — September 16, 2026

Jason authorized reviewing and completing unfinished work locally without questions. No commit, push or deployment. Existing campaign files, artwork, Gold Standard and accumulated local changes were preserved.

## Implemented in this pass

- Small hands-on-keyboard indicator at the bottom left of an open console during input. It follows the real timer, stops animating while paused, remains visible when sound is muted, cannot intercept clicks, and respects reduced-motion preferences. Existing keyboard sounds remain.
- Shared post-roll input timing in `delay-rules.afterRoll`, applied once by the server after confirmation. Successful rolls subtract their positive margin in seconds. Critical success then halves the remainder; critical failure doubles the original input time. The existing factor/half-circle calculation still supplies the original duration. Submitted-roll retries cannot apply the adjustment again.
- Scan Area now reaches 150% of ordinary sensor range when its input completes, with a pulse lasting two active ATB seconds. It reuses the confirmed result for targets entering range, never rerolls and never stacks multiple pulses. Pauses stop the pulse. The sensor console displays its range and remaining time. Detection still checks Masking and depth in range; a failed roll does not guarantee discovery. Ordinary lock/hacking ranges and the existing passive sweep/contact-retention rules remain intact.
- Repeated weapon impacts replace their previous shake instead of adding multiple displacements. Flash, explosion, sound and the underlying map position are preserved.

This range pulse is Jason's digital extension, not a claim about the printed Scan Area rule. Previously the active scan could not reach beyond ordinary range; the separate passive probability sweep already could.

## Decisions made without asking

- A one-second minimum preserves visible input feedback even when the success margin exceeds the original time.
- Critical success subtracts the margin first, then halves the remainder. Critical failure doubles the original duration. Existing critical-result thresholds are retained.
- Area and hex scans use a disclosed difficulty of 10 **only for input timing**. Their actual detection checks still use each target's rules. Using hidden enemy difficulty to set a visible timer would reveal information and give one multi-target action several conflicting durations.
- Actions with no fixed difficulty retain their original input time. Physical cooldowns, travel, oxygen, repair-drone cadence and the separate Systems Analysis report-processing interval are unchanged. There is no second application to a later stage of the same action.
- Guaranteed-outcome scans keep their existing no-dice behavior and original input duration. Conditional orders retain their existing prepare/trigger cadence.
- The pulse begins after input, lasts two active seconds, and replaces an existing pulse rather than adding duration. Successfully discovered contacts then follow ordinary retention rules.

## Backlog audit

| Request group | Current status |
| --- | --- |
| Historical handoff missile dice/multiplier, lock warning, oxygen visibility, impairment warnings, missile facing and damage reports | Implemented in the September 15 passes; the old pending heading is now marked historical. |
| Detection/activity banners, duplicate guards, component targeting, impact/debris behavior, condition icons, Meeting Room seats and Explore tab memory | Implemented; see LOCAL-PASS-2-20260915.md. |
| Approximately 300,000-credit Wayfinder/Red Horizon with valid EN | Implemented; supersedes the original equipment-only request. See LOCAL-PASS-3-20260915.md. |
| Repair Drones 1–5, Backup Generator, Antennas 1–4, revised VR size/limits and Surv. Camera | Implemented; see the SIC expansion, VR and surveillance reports. |
| VR attribute categories, complete standard skill list, specific simulations/status prose and trapped warp console | Implemented in LOCAL-VR-WARP-20260916.md. |
| GM Library delivery, assigned-PC inbox notices and readable Library entries | Implemented in LOCAL-LIBRARY-DELIVERY-20260916.md. |
| Typing icon, roll-adjusted input and Scan Area pulse | Implemented in this pass. |
| Boarding resolution, hull-breach/crew-casualty rules | Future mechanics; no complete rules were supplied. Existing surveillance groundwork remains. |
| Decker/Reverence stacking and shared hacking notes | Still deferred enhancements; the earlier proposal did not establish final mechanics. |
| Other unimplemented SICs | Roadmap recommendations, not a request to add the entire catalog. See SIC-ROADMAP-20260915.md. |
| Whole-computer/Codex slowdown and crashes | Cause remains unproven. This pass does not claim to fix those reports. |

## Verification

- All 427 automated tests pass, including success/critical timing, scan range/expiry/nonstacking/privacy, normal contact retention and existing combat recovery.
- The deferred combat-recovery browser test now uses the stable combat laboratory instead of outdated assumptions about Explore equipment. Blocked dice loading, cancel/reopen, player reload, interrupted submission and GM takeover all pass.
- The laser browser test passes strict impact anchoring, sub-two-pixel shake, shared dice, damage and responsive-console checks. It now tests overlapping impacts at three zoom levels and verifies return to the original position. The test brings the measured page forward and waits for the initial animation to finish, avoiding a background-throttled baseline. Production also prevents stacking its own shake animations. These address concrete risks found while investigating the old intermittent failure; the original historical run cannot be reconstructed with certainty.
- All seven Chrome suites pass: roll timing, sensors, combat recovery, lasers, held turns, weapon clock and ship workflows. The timing suite checks real PC roll submission, margin/critical-failure durations, duplicate receipts, muted/paused/reduced-motion typing, early detection, pulse expiry and paused persistence across a normal campaign restart. The sensor suite covers independent GM/two-PC privacy, physical dice, canceled/reopened rolls, deterministic confirmed results, queued analysis, Life Scan, data sharing, movement, maintenance, diagnostics, cards and restart/GM recovery.
- The sensor fixture now stores its intended skill in the canonical character record, equips a valid-powered concealed target so checks remain uncertain, follows the embedded diagnostics and accessible market controls, and checks the redesigned Explore fleet's real Masking. These are test corrections, not weakened gameplay rules.
- Syntax and whitespace checks pass. Screenshots of the new indicator and pulse are in `test-artifacts/roll-timing/`; full automated results are in `test-artifacts/backlog-full-tests.txt`. All task-owned browser/server processes exited.

The focused browser fixtures use disposable campaigns. Their setup was updated to require genuinely uncertain sensor rolls rather than accidentally testing guaranteed outcomes. No production rule was weakened to make a test pass.
