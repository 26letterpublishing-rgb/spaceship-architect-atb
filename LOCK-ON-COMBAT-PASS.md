# Lock-On And Combat Clarity

September 11, 2026. Authorized by #commit. Gold Standard and real campaign data remain untouched.

## Rules And Scope

- Lock-On System 1: Series A page 37, 560 credits, 1 EN, security 1, 1x1, Paradon/6 hours, Sensor Systems, damage threshold 3, no physical station. Access through an operational cockpit or bridge.
- Core reference: PDF pages 62-73; Lock-On on page 65, impairment and zero-Masking caveats on pages 72-73. Rapid Laser 1: Series A page 100. Printed rounds use the approved 12 combat seconds conversion.
- Ship lock rolls 2D4 + Weapon Systems against Defense, with equality succeeding. Failure grants +1 on the next attempt against that ship. Impaired System 1 rolls 2D2. A new impairment, power loss, destruction, or leaving sensor range breaks locks.
- First target is free. A second target consumes 4 AU per prepaid 12-second block. The acquisition attempt commits the first block; failed attempts do not refund committed AU. Simultaneous acquisitions cannot bypass this cost. Empty AU drops only the extra target.
- Fast input, Quality 1, skill-derived Ingenuity. Roll confirmation comes first and freezes input/ATB; the result resolves after input. Release Target is a free administrative operation between turns, but cannot interrupt pending input.
- Component lock requires an existing ship lock, completed Systems Analysis, shields down, and a selected installed online component. Roll uses Sensor Systems. Shields returning or the component going offline removes the component lock, not the ship lock.
- Break Lock-On uses Evade Dice + Pilot/Helm against 13, requires operational thrusters, and remains available at the helm even without an onboard Lock-On SIC. Masking at zero or below requires escaping sensor range instead.
- A locked Rapid Laser shot skips accuracy and starts from 4D4 damage, before conservation and impairment limits. Losing its lock during input cancels the shot. Unlocked accuracy retains the previous strict-greater-than-Defense rule.
- Every successful damaging shot now requests a separate explicit damage roll or physical-dice total. Damage dice are red, all dice are summed, and damage dice never fuse. Empty and mismatched submissions are rejected. No damage is applied before confirmation.
- Component hull damage grants floor(damage / threshold) impairment points; four points destroy the SIC. No hull breaches or crew casualties are created by SIC destruction in this pass.
- Ship destruction stops its movement and crew participation without changing character HP. Wreck markers remain. A sole surviving PC-occupied ship receives a one-time Victory notification. This does not implement escape pods, boarding, rescue, or automatic character death.

## Interface

- Every console has a shared AU display, combat timeline, Hold/Resume, Leave Console, Combat View, and left/right console selection in consistent locations.
- Lock-On console provides Ship, Component and Incoming tabs, rules-help buttons, acquisition feedback, target status and reports. New card/floorplan art includes preserved PNG masters and web derivatives.
- Combat View exposes direct buttons for available station actions. They open the appropriate target/confirmation controls; they never fire merely because the shortcut was clicked.
- Navigation Auto Zoom tracks visible ships only. Manual zoom removes the previous gameplay bounds, retaining numerical safety guards. Interior zoom can go down to a one-pixel cell and has no previous maximum cap.
- Active ring outlines have a large pulsing gold halo. Five rapid blaster bolts replace the single laser stroke. Impacts shake/flash map icons, column ATB and console rings; destruction adds an explosion and wreck presentation.
- Misses require an OK acknowledgement. Newly detected contacts enter the Combat Activity log with red emphasis. Unknown condition is explicit instead of looking like empty HP.
- User-provided explosion audio is integrated, respects mute, and is attributed in AUDIO-CREDITS.md. No new subscription or paid API was used.
- Shared timeline rendering avoids redundant redraws on consoles that already own their rings. Reduced-motion preferences suppress the large motion effects.

## Verification

- 156 unit/HTTP tests passed locally, including Lock-On cost, retry, range, impairment, component prerequisites, explicit damage, no-own-lock evasion and simultaneous-acquisition AU checks.
- Browser laser checks exercise fresh authenticated GM/player campaigns, actual shared dice UI, red damage, manual damage, rejected empty/invalid submissions, impaired 2D2, misses/OK, locked fire, explosion/Victory, and desktop/mobile layouts.
- Sensor GM/two-player regression includes privacy, explicit rolls, queued analysis, Life Scan, Share Data, Command help, movement, diagnostics/Pass Time, and restart recovery.
- Shield and 12-order cockpit browser regressions were run. Current run results and hosted verification are recorded in CURRENT-HANDOFF.md when the release closes.
- Fresh-user creation audit: NEWCOMER-AUDIT-2026-09-11.md. The audit used only visible UI during the walkthrough; prior project knowledge cannot literally be erased.

## Boundaries

Lock-On 2+ and triangulators are not implemented. Share Data shares intelligence, never targeting locks. Existing Explore saves are not destructively reset; new/reset Explore rooms receive Lock-On 1 on both ships. Real campaign saves and frozen baseline folders are never test fixtures.
