# Defense And Console Follow-Up

Authorized #commit: fix minimap zoom, move PC collapse control to visible bottom-right, console pause notices, ring-only gold glow, detected-contact audio, ship-local Hold/Resume, numeric modifier formatting, prominent Defense, 20-second all-attacks evasion, and simplified Explore roster.

## Rules

- Ship Defense is calculated Masking, or the highest active Evasive Maneuvers result if higher. The same ship-sensors.defense helper is used by lasers, collisions, Analysis and displayed encounter headers. Stale ship.defenseScore overrides no longer decide rolls.
- Evasion lasts 20 combat seconds and protects every attack. Hits and misses never consume it. Multiple evasion results expire independently, using the highest still-active result. Paused combat does not advance durations. Old saved evasion entries without durations receive 20 seconds on their next combat advance.
- Detected contacts expose current Defense and evasion time to support the requested visible ship-column scores. Unknown contacts still hide them. Enemy interiors/crew/HP privacy is unchanged.
- Fresh/reset Explore Features contains Nova Vale and Space Slug only. Nova has 2.5 in Computer Systems, Engineering, Hacking, Pilot/Helm, Sensor Systems and Weapon Systems. Both ships retain their implemented SICs. The artificial Masking 18 override is removed, so nearby test ships may be passively detected. Existing personal campaigns are not migrated.

## Interface

The late combat-workspace CSS rule now respects the per-map zoom variable instead of forcing 72px. The PC collapse button tracks the visible embedded viewport bottom, avoiding the top menu. Hold controls render in their ship lanes, with a delegated Resume handler; non-ship combat retains its global tray.

console-feedback.js supplies large red pause notices with the responsible player's name, or GM for hidden/NPC/GM work. ATB glow targets the SVG ring backplate, not its surrounding panel. Newly detected reports trigger a double warning tick, respecting mute and hidden documents. Existing cockpit audio has instrumented browser coverage; the new warning was reviewed in code, not judged by ear.

Laser bonuses are rounded to suppress arithmetic noise; the shared skill bonus readout formats a negative sign correctly and rounds display to two decimals without stripping legitimate fractional skills.

## Verification

145 automated tests cover the new duration, repeated attacks, expiration, shared Defense and modifier behavior, plus existing rules. Browser suites check real minimap zoom, Defense headers, pause banners, shared laser dice, impact, PC Hold/Resume and bottom-right control, Space Slug's ship-local Resume, sensor workflows and the revised demo roster. Final publication status lives in CURRENT-HANDOFF.md.

Gold Standard and live campaign files must remain untouched. Complete #commit by pushing, verifying hosted assets, stopping owned test processes and sending ntfy last.
