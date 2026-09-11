# Rapid Laser 1

## Scope

Authorized by the user's latest #commit: Rapid Laser 1, Fast input, Weapon Systems Ingenuity despite having no local station, tier-based Quality, immediate damage at input completion with a cosmetic laser/impact animation. Gold Standard and live campaign data remain untouched.

Sources: SIC Series A page/card 100; core PDF pages 66 and 70-72; Damage Dice section (sum all damage dice). Source originals remain in the parent project folder.

- Card A-100: 450 credits, 1 EN, Security 1, 1x1 EXT, Weapon Systems, Crystilium/4 hours, threshold 4. No station; use an operational cockpit/bridge.
- Manual fire: Dexterity + Weapon Systems + own HSM - distance. Strictly exceed target Defense to hit. Current defense uses Evasive Maneuvers when active, explicit ship Defense if present, otherwise the same Masking fallback used by Analysis.
- 5 AU; optionally sacrifice 1-3 damage D4s to save the same AU. A weak hit may lose all damage. Impaired maximum is 1D4 before sacrifice. Successful margin grants +1D4 per 2 above Defense, up to +3D4; server rolls and sums damage.
- Fast base 10, Quality 1, Weapon Systems Ingenuity 1/2/3/4 bars at skill 1/3/5/6. Other factors neutral. Roll in the existing skill UI first; actor ATB/input waits for confirmation. Then input runs; damage applies once at completion, with no queued countdown.
- Shared AU spending respects shield reservations. AU commits when the order is submitted, explicitly disclosed in the console. Forced interruption consumes committed AU but causes no damage. This is a playtest interpretation, not a newly approved universal SIC rule.
- Repeat activation of the same laser within its 12-combat-second window adds 1 AU (its EN cost). The window starts on the first committed order and does not slide on repeats. This adapts the printed extra-activation rule without restoring tabletop initiative.
- Shield reduction/protection and impairment use ship-shields.damage. Shield overflow does not spill onto hull. Existing Evasive Maneuvers protection ends on the attack.
- Lock-On and targeted component damage remain unimplemented; card explicitly identifies Lock-On as unavailable. This is manual ship fire, not the entire future weapon subsystem.

## Implementation

ship-weapons.js owns rules, validation, receipts and report state. Server preserves weaponState through restore and routine synchronization. Unit weaponSystemsSkill is synchronized from GM/player/demo records. Skill prompt now accepts the requested Attribute (Dexterity for laser, Intellect default for existing callers).

weapon-console-ui.js/css provide a separate bitmap-backed weapons console, target selection, AU conservation, shared dice, delayed input, Hold, Leave and remembered console selection. Incoming reports do not disclose an undetected attacker's identity or exact enemy HP. Cosmetic effects are client-only and respect reduced motion. No new background service.

Both fresh/reset Explore ships include one exterior Rapid Laser 1. Existing user ships are not modified. Sensor detection is still required before targeting.

New generated art: rapid-laser-1-card.png, rapid-laser-1-sprite.png, weapon-console-background.png. Card and placement originals share the generated hardware image; WebP derivatives are 360px card and 720px sprite, with the original print assets preserved. The console uses a unique generated gunmetal/red/amber frame.

## Verification

tests/ship-weapons.test.js covers card metadata, skill factors, duplicate spending, delayed damage, strict Defense comparison, impairment, sacrifice, unavailable access/AU, forced departure, shield overflow and repeat-window serialization.

scripts/playtest-lasers.cjs creates an isolated campaign through the API, then uses actual GM/player browser controls and the shared physical dice UI. Checks include roll freeze, before/after damage, GM separation, a real card/image, desktop/mobile screenshots. This is not a full new-user character-creation playthrough. Audio uses the existing shared console feedback and has not been judged by ear.

Publication and final verification status are recorded in CURRENT-HANDOFF.md.
