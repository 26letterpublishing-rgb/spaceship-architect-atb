# Local Decent And Utility Consoles

Authorization: #local only. No commit, push, hosted traffic, Gold Standard update, or edits to personal campaign saves.

## Implemented

- Shared Ship Capabilities section in Construction, Ship Details and the full PC Starships sheet. Installed equipment drives landing, atmosphere, gravity and food capabilities; stored copies do not count. AI is not claimed without an actual AI SIC. Operational restrictions are separate from ownership.
- A-27 Decent (Aerofoil): 675 credits, 2 EN, Security 4, threshold 25, Engineering, Crystilium/5 hours, maximum 200 hull squares. Hull-only mirror symmetry across either axis; equipment need not match. Wings follow the existing hull, consume no interior squares and receive Hull-view plating. Runway landing requires Move 5 (200 MPH); atmospheric maximum is Move x 40 MPH.
- A-28 Decent (Hover): 5,375 credits, 5 EN, Security 4, threshold 12, Engineering, Endernium/2 days, maximum 450 hull squares. The general builder still supports at most 400 hull squares. One inventory item and one placement record contain four independent 1x1 exterior mounts. Each touches an outer hull wall and cannot overlap another mount or SIC. Partial placement cannot confirm and can be cancelled or stored. Atmospheric maximum is Move x 10 MPH.
- Both cards retain the impaired atmospheric-entry 8D10 Heat hull damage warning. This pass adds landing capabilities and equipment, not an atmospheric-flight encounter simulator. It never rolls or applies that damage automatically. Space propulsion calculations are unchanged.
- Life Support and Nut Supplement each gain one physical station, with remote access from an occupied bridge/cockpit under existing station rules. Existing stations and SIC entry points remain.
- Life Support console: real gravity toggle in and out of combat; combat toggle consumes the active character's turn, with no invented AU price or dice roll. Server validates station access, ownership, pending rolls, impairment and receipt identity. The Combat root also exposes Enable/Disable Gravity directly.
- Zero gravity halves movement speed in combat and the PC Starships sheet, suppresses walking gait and preserves facing. In-flight combat routes retime without losing progress or doubling door waits. Move 1 still makes a positive mesh step at half speed; no zero-length route can stall the clock. The character's permanent Move stat is not overwritten.
- Nut console: 22 base/blend flavors, three textures, colored dispensing paste, a meal ticket and an eight-part cartoon sound. Impairment limits it to one stable house flavor. Cosmetic only: no costs, healing or character-stat changes. Sound stops on mute, close and page hiding; reduced-motion preference suppresses animation.
- Both consoles retain shared Defense, AU, tactical rings, mute, console switching and Hold/Resume/Leave placement. Outside-combat combat actions remain disabled; only the explicitly authorized utility controls work there.

## Additional Fixes

- Fit Ship leaves room around the hull for exterior placement rather than clipping edge squares.
- Missing page scripts now have an automatic public-asset allowlist check.
- An asynchronously loading utility console cannot be mistaken for a closed preview while its stylesheet arrives.
- Muting an out-of-combat console no longer redraws the hidden combat interface. Zero-AU meters cannot receive a non-finite progress value and no longer say Fully Charged.
- Builder saves preserve server-owned gravity and SIC impairment, power and repair status; upgrading a ship cannot reset these operations.
- Four-mount geometry survives builder saves, campaign normalization, combat preparation, resizing, sensor snapshots and shared rendering. Duplicate placement records for one SIC are rejected.
- Out-of-combat walking has an elapsed-time completion fallback when Chrome delays off-screen animation completion. Playback speed changes only when gravity changes, preventing redundant animation retiming.

## Explicitly Deferred

Oxygen shutoff is disabled. No suffocation timer, forced roll, unconsciousness, or oxygen damage is implemented. Do not infer answers to the pending questions:

1. Seconds per damage round, and whether the first 5 HP loss is immediate or after an interval.
2. Whether a failed resistance roll immediately causes unconsciousness or uses normal HP/knockout rules.
3. Whether the outside-combat timer pauses for a manually entered roll.
4. Whether manual oxygen shutoff starts breath-holding immediately or uses the old 45-second impairment grace period.

Use the user's replacement oxygen rule when those are answered: (Health D10 count + floor(Endurance)) x 32 seconds of breath, then manual Health + Endurance against 14, increasing by 4 every 16 seconds. Failure loses 5 HP each round until breathing resumes. Do not substitute the old rulebook passage.

The older unanswered question about moving directly on the large PC Starships sheet during active combat also remains unchanged. Combat movement still uses the Combat interface.

## Verification

- Final suite: 230 automated tests passed, none skipped. All 86 root JS and test-script CJS files passed syntax checks; diff whitespace checks passed.
- Eight Chrome suites passed: ship-workflows, flexible-mounts, cockpit, held-turn, weapon-clock, combat-recovery, menu-recovery and decent-utilities. Ship-workflows and decent-utilities were repeated after the off-screen walking fix.
- The new Chrome suite passed actual purchases, cancellation, four separate clicks, confirmation, save/reload, expansion, API persistence, PC capabilities, real utility controls, half-speed floating, separate GM/PC root actions, natural-clock route completion and End Combat persistence.
- Final runs also passed delayed stylesheet loading, reduced motion, active audio playback/mute shutdown, muted dispensing and laptop/mobile control bounds. Screenshots were visually inspected. Screenshots/logs remain under ignored test-artifacts/decent-*.
- Fresh isolated preview: http://127.0.0.1:8792/showcase.html (GM: http://127.0.0.1:8792/gm.html), PID 3152. Data/logs: C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-decent-utilities-20260913. Older previews remain untouched. HEAD remains 1308466; nothing was committed or uploaded.
