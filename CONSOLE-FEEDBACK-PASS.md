# Console Feedback And Roll Timing

## Behavior

- PC audio defaults on when no preference exists. Explicit mute choices remain respected; browser gesture requirements still apply.
- Shared console feedback adds quiet cyclic ATB charging audio, a golden ring-panel outline, ship-input sound and Analysis processing sound. Paused/hidden/muted consoles stop their audio. Reduced-motion preferences disable decorative animation.
- Direct ship checks now request dice before input. The actor's ATB and input countdown remain frozen until Confirm and Submit. The recorded roll then runs through the input delay; the outcome appears on completion. Analysis keeps its additional 12-second processing phase, with a feed countdown. Conditional effects retain their existing trigger-time roll behavior.
- Ship skill dialogs show unknown/known/lower-bound difficulty in the difficulty field, defer outcome display, and show the included retry bonus. Analysis totals include that bonus once, including submitted rolls.
- Scan hover is yellow; selected hexes pulse white through resolution. Failed/successful sensor reports use red/green status text.
- GM Add NPC/PC opens a ship/square picker before adding the unit. Occupied mesh positions are avoided. Incoming hails offer an out-of-turn Accept incoming call shortcut to bridge/cockpit occupants.
- Conditional orders support within-range triggers (relative to the observing ship) and map-picked trigger hexes. Preview interiors have zoom controls while retaining the minimum station target size. Ship statistics use larger, inline labels/values.

## Verification

134 unit/HTTP tests passed; syntax and whitespace checks passed. Browser suites passed for sensors (fresh GM/two PCs, actual GM Add picker, out-of-turn hail acceptance, hover highlight, roll-first ATB/input freeze, retry/restart, Analysis and Life Scan), all 12 cockpit mouse orders, and shield regressions. Screenshots inspected for hover selection, skill difficulty and sensor reports. Audio lifecycle is instrumented in the cockpit tests; subjective volume/timbre still needs human playtesting.

Fixtures use API-created characters, not a complete new-user character creation walkthrough. Render verification follows publishing. Gold Standard and data/campaigns.json are untouched.

## Maintenance

console-feedback.js must remain in the public asset allowlist. Its top-level document event handlers/audio are removed on pagehide. Do not advance a pending roll's input or ATB; do not count the retry bonus twice. Preserve explicit mute settings and the enlarged interior's cell-size override when changing preview zoom.
