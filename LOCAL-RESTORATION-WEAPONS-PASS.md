# Local Restoration and Weapon Families

Authorization: #local, September 12, 2026. Local files and isolated local tests only. No commit, push, Render use, Gold Standard edits or personal campaign changes.

## Added Hardware

- Darkveil 1-10: printed Masking bonus, one installed per ship, -5 Masking for each impairment point. Powered-down/destroyed hardware contributes nothing. Storage remains available.
- Beam Laser 1-8: requires a live target lock; printed damage dice and flat bonuses; 3 AU per additional damage die. Impairment removes base dice and flat bonus, leaving AU-funded dice.
- Ripple Cannon 1-8: printed D8 pool; 3 AU per additional D8; stepped distance increases accuracy and decreases damage dice. Impairment removes AU damage boosts, including if incurred during input.
- Ion Pulse Cannon 1-5: printed AU cost and D8 pool, bypassing shields and all shield reduction without consuming shields. Impairment removes one die.
- Beam/Ripple have one physical station; Ion has none. Bridge/cockpit remote access remains available. Mixed mounts have a two-square interior and grade-specific exterior barrel; all four rotations preserve station and collision coordinates.
- Fresh/reset Explore ships retain their existing systems and add one of each new family at grade 1, without reinstalling shields or changing personal saves.

## Rules and Interpretations

Source cards: SIC_Series_A.pdf A75-A82, A94-A99, A103-A111; SIC_Series_B.pdf B59-B60, B80-B81, B84-B87. Core SA20210516PDF_ADV4.pdf supplies general ship attacks, repeated SIC activation and impairment rules.

- New weapons use the established Fast input delay, grade-based Quality and Weapon Systems Ingenuity, with no extra queued damage delay. This follows the existing Rapid Laser convention.
- Ripple's printed positive range modifier replaces the ordinary negative range modifier. It does not cancel against an additional ordinary range penalty. Incomplete distance bands round down. Accuracy and damage use the selected order's range consistently.
- Repeated firing within the existing 12-second activation window adds AU equal to the selected SIC's EN cost. A free base activation is valid when no surcharge or boost applies.
- Every successful damaging shot still requires an explicit manual-confirmed damage roll. GM-initiated roll ownership and the global pending-roll ATB freeze remain intact. Printed flat damage bonuses apply exactly once, including typed final totals.
- The existing 100-dice submission ceiling is enforced before accepting weapon orders. No automatic damage rolls were introduced.

## Interface and Preservation

See GOLD-STANDARD-FUNCTION-AUDIT-20260912.md for the comparison and restoration evidence. Main-map PC movement retains path validation, station occupancy, door handling, view controls, crew roster, cards and printing. Crew markers use ATB-colored top-down humanoids with walking limbs; reduced-motion preferences suppress walking effects.

All consoles share consistent sound icon state. Temporary tactical impact presentation uses the already authorized viewer state, restores underlying windows/input, and respects mute/reduced motion. Main Combat Activity remains non-flashing. Rapid Laser low-res mode is a flat silhouette, while high-res/Hull retain the detailed sprite.

The embedded PC sheet merges the current encounter positions over saved campaign positions, matching Combat when an older campaign refresh arrives. This does not overwrite saved campaign data. The sensor browser regression replays a stale campaign event to exercise this ordering.

New artwork preserves original PNG masters; five web derivatives total about 349 KB. The optimizer accepts optional filename prefixes so adding assets does not rewrite unrelated derivatives. Shared console CSS no longer applies panel dimensions to the nested starmap. Weapon factor markup is updated only when it changes.

## Regression Coverage

- tests/new-weapon-families.test.js: card metadata/artwork, four-way split placement, local station access, Darkveil impairment, Beam locking/bonuses, Ripple range/impairment, Ion piercing, repeated AU costs and roll ownership.
- scripts/playtest-local-restoration.cjs: fresh NPC editor, custom mid-combat arrival and cancelled draft, automatic NPC prompt, unobstructed damage presentation with preserved input, End Combat navigation.
- scripts/playtest-ship-workflows.cjs: shared-map movement, crew marker, both print modes, previews, construction expansion/centering/EN guard, saved positions and preparation-map controls.
- scripts/playtest-new-weapons.cjs: actual Chrome consoles and manual dice for Beam 4, Ripple 4, Ion 2; serialization, lock prerequisites, active shield bypass, desktop/mobile layouts, all 31 purchase cards and artwork.
- Existing laser, cockpit, sensors, shields and performance scripts cover the unchanged neighboring workflows; final execution outcomes are recorded in CURRENT-HANDOFF.md.

The Chrome performance audit reported four perspective switches at 2.16, 2.21, 1.57 and 2.22 seconds, about 822 KB transferred, and no browser errors. This is not a claim that all switch latency or low-end laptop stutter is resolved.
