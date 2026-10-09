# Hands-on dice tutorial — October 8, 2026

The Attribute tutorial now uses the actual sheet dice artwork, row styling, purchase progression and refund interaction. Its separate 225 sample EXP pool never changes a real character. Clicking the next die purchases it; clicking the last purchased die refunds that step. The two starting D4s remain free. Short instructions and a live dice-pool summary replace the old Try/Reset walkthrough.

Changed Attribute Points, Skill Points and EXP totals flash white, fading to black over 0.5 seconds. Pale readout backgrounds preserve contrast on the dark sheet. Initial rendering, unchanged values and character switches do not flash; repeated purchases restart the animation. The same feedback applies during normal advancement and refunds.

The opening introduction now uses the actual continuous rainbow Next Step animation. Its Next Step and OK buttons share one confirmation handler, closing the introduction and returning focus without scrolling.

## Verification

- Full test suite: 981 passed, zero failed/skipped (concurrency 4). Log: test-artifacts/oct08-dice-practice-tests.txt.
- Focused practice/purchase tests: 6 passed. New tests cover practice costs, budget limits, refunds, free dice, sequential progression, animation timing/restarts/scope, and identical intro confirmation behavior.
- Syntax checks passed for character.js, app.js and ship-combat-map.js. CRLF-aware Git whitespace check passed.
- Local browser on isolated port 8798: intro rainbow animation and clickable confirmation; sample purchase/refund/extra die; real character budget unchanged by practice; real Attribute purchase; Skill purchase/refund; all 195 starting Attribute Points allocated; two skill packages; Human finalization using Finish Now; normal EXP purchase 200→185 and undo 185→200.
- Browser computed styles captured intermediate fade colors for Attribute, Skill and EXP changes, then the black endpoint. No browser console errors observed.
- Screenshots in ../outputs: Hands_On_Dice_Practice_2026-10-08.png and Next_Step_Intro_2026-10-08.png. Visually checked at the browser's normal approximately 1265×720 viewport.

## Scope and limits

Client-side update; refresh the local app to load it. No hosted/Render test, full combat playtest, separate narrow-screen browser pass or audio audition was performed for this focused change. Existing purchase sounds are reused. Disposable test character/data were kept separate from personal campaigns. Gold Standard and unrelated QA/scripts were not changed. User authorized commit and push to main.
