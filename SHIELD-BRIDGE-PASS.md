# Shield, Bridge, and Usability Pass

Authorized by #commit on September 9, 2026. Baseline e1df477. Implemented and published as 8585d1d with creation-text follow-up 2def535. Verification evidence is summarized below.

## Checklist

- [x] Shared station access, Shield 1 lifecycle, AU reservations, and regression tests.
- [x] Cockpit 2 and Bridges 1-8: source-checked cards, art, floorplans, all listed stations and EDG validation.
- [x] Local/remote shield console, shared access from bridges, delayed AU input, progress and freeze presentation.
- [x] Character creation explanations/roadmap and construction-first ship workspace.
- [x] Full automated tests and realistic GM/PC browser checks.
- [x] Publish and verify Render; close test browsers and temporary servers.

## Approved Rules

- Keep decimal skills and current HP; Guard/Shell/Stability/Core proposals are for another game.
- Shield 1 A-51: 1000 credits, 5 EN, security 1, 1x1, one station, 10 Shield HP, 1 damage reduction, 1 HP per 12 combat seconds. Engineering replaces printed CPU Systems for the staffing bonus.
- Additional installed shields each require +5 EN per previous installed shield; stored copies draw no EN.
- Shield AU+: 5 AU per HP restored; 3 AU per extra damage reduction. Any stationed local or bridge operator may use these at any time without consuming their turn. Input takes 1.5 seconds while normal ATB continues. Reserve AU at submission, apply at completion; leaving original station cancels and releases reservation. One pending AU command per operator; all operators share ship AU.
- Reinforcement lasts 12 combat seconds and reduces every incoming hit. Extra purchases stack strength without extending the original expiration. If expired before new input completes, start a fresh duration.
- Burst shield restabilization restores FULL shields, overriding the printed restart-at-one-HP rule. Shield 1 requires 120 powered seconds and 20 AU before staffing bonuses. Feed incrementally; insufficient AU pauses progress, which is retained. Faster staffing consumes the same total AU faster.
- Only physically stationed shield crew grant Engineering bonuses. Normal regeneration does not freeze ATB. Restabilization freezes all occupants of that shield; leaving pauses when no operators remain, without deleting progress.
- Engineering whole level 0/1-2/3-4/5/6+ maps to 0/1/2/3/4 bars per operator. Sum; cap Ingenuity at4, overflow to Efficiency at half strength, overflow beyond Efficiency to Performance at quarter original strength. Preserve fractional bars. 14 combined bars =4 Ingenuity +4 Efficiency +0.5 Performance.
- Use the existing cumulative +2,+3,+16%,+33% timing shape, preserving exact base durations and fractions for shield timing. Do not round per update or change existing cockpit timing.
- Bridge/cockpit defaults to Pilot console, may switch to any implemented installed console. Show REMOTE ACCESS prominently. Physical-only actions never appear remotely; server must enforce this independently. Local and remote operators may use a system simultaneously.
- Shield operators get Hold/Leave/Combat View behavior consistent with stations; restabilization is busy and prevents normal actions/Hold. Out-of-turn AU input itself is not a normal delayed-action freeze.

## Scope Notes

- Implement Shield 1 only, not other shield tiers or add-ons. Burst Shield Reactivator's printed benefit is redundant under full-HP restart; defer redesign.
- Remaining cockpit/bridge cards: A-2 through A-6 and B-1 through B-4. Largest has12 stations. One installed bridge/cockpit per ship. EDG applies to complete footprint, not just its origin. Preserve existing station coordinates for old saves.
- Printed round-based extra bridge actions are superseded by current ATB. Reboot/hacking/communications and random station-destruction automation depend on future systems; retain descriptive source information without inventing implementations.
- Usability: explain disabled creation skill controls; clear creation heading, required/optional identity labels, consistent class checklist, upfront FUBS/finalization/PC-code roadmap. Make construction the first ship view, retain full ship sheet in Details, show compact live statistics. Clarify standalone design credits/hull cost.
- Protect Gold Standard and data/campaigns.json. No read-only audit repeat required this pass. Test realistic controls and a fresh campaign for new shared permissions/persistence.

## Verification

- Full automated suite: 99 passing tests.
- Cockpit browser regression: 12 mouse-driven flight orders, three NPC and three PC in a fresh campaign, repeated after station arrival in Explore Features.
- Shield browser regression: isolated fresh campaign, GM plus two PC browser sessions, local and remote consoles, out-of-turn reopening, held/double-click protection, concurrent AU reservation, insufficient AU, forced-departure cancellation, station occupancy, physical-only restabilization, frozen ATB, pause/resume, and actual server restart.
- Visual review: 1600x1000 and 1366x768 shield consoles, eight-card bridge picker, Construction workspace. Original PNGs preserved; 104 served derivatives total 13.7 MB versus 242.3 MB source assets.
- Issues found and fixed during verification: GM relocation lost station SIC identity; console switching could race dialog cleanup; continuously refreshed paused AU inputs could postpone their save indefinitely; Construction header controls overlapped its title.
- Character creation UI: first-time prompt, creation heading/roadmap, No Class selection and reload, disabled-skill explanations. Found and fixed No Class-only drafts being discarded as empty.
- Forced GM relocation onto a recovering shield now releases that character's active Command Window instead of leaving combat waiting for an unavailable action.
- These tests do not constitute exhaustive playtesting or a full new-character creation run. Publication is verified separately; inspect git history and the completion message for its outcome.
- Render: scripts/verify-shield-deployment.cjs passed against the live site. Eleven served code/style files matched local SHA-256 hashes; six new artwork responses matched optimized derivatives. A fresh hosted browser displayed all eight bridge cards and Shield 1 at 1366x768 without page errors. No hosted campaign data was changed.
- Test browsers and temporary servers were closed. Gold Standard and data/campaigns.json were not modified. The final completion notification is sent after publication of these notes and cleanup.
