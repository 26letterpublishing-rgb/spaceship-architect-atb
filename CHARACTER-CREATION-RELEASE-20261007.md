# Character creation release — October 7, 2026

This release includes the preceding local character-sheet, skill-package and audio pass, plus the requested follow-up refinements.

## Changes

- Next Step continuously runs its original bright rainbow sweep; guidance outlines remain until clicked. The introduction is restored for drafts that have not acknowledged it.
- Race cards with subtypes show a small white (+). The No Class card and Class popup Skip This Step control are removed as requested; Class remains optional.
- The skill tutorial explains Packages versus Custom Allocation, scrolls to the two method buttons and highlights them with rounded animated borders. Choosing a method highlights its selectors or available SP buttons.
- Twelve packages use the existing point budgets, purchase costs and starting level cap. Pooled leftover points try the chosen package skills, then important skills beginning with Dodge/Block and Awareness. Points are retained only when no legal available allocation remains.
- Learned skills (displayed rating at least 0.1) are green in the sheet, advancement, reference drawer and printed sheet. Reference drawer skill labels remain visible and clickable through their row.
- Identity Auto Fill offers three editable suggestions for each of 25 races (75 total), with subtype adaptations for Android, Antropic and Yuhorn Symitron. Suggestions use race lore for physique and homeworlds, retain Race/Class/Player Name and choose a random ATB color. Sex values are restricted to Male, Female or Androgynous. Auto Fill is disabled until a supported race is chosen.
- Finish Now replaces Skip remaining animations. All remaining decimal rolls resolve as one batch, retaining any result already revealed; the sheet updates once. Finalization plays a short synthesized science-fiction fanfare alongside the character-name animation and honors mute.
- Earlier local changes included here: quiet attribute/skill purchases and scroll preservation; alphabetical default sorting and Importance/Level wording; larger sheet/race/skill text; advantages/disadvantages in two columns; Settings returns to the previous tab and scroll; shared sound gain/compression boosts quiet effects while preserving the combat alarm and explosion balance.

## Verification

- Full repository regression suite: 973 passed, zero failures, cancellations or skipped tests (117.8 seconds, concurrency 4).
- Final targeted regression checks cover allocation, identities, Finish Now, fanfare/mute, purchase feedback, audio and reference/inventory behavior.
- All 144 package pairs checked at 13 representative budgets: full legal allocation, correct point costs and no starting levels above 3.
- Identity tests cover all 25 races, every listed subtype and all three suggestions, including edit independence and allowed gender values.
- Mouse-only browser workflow on a disposable local server: new-character introduction, disabled Auto Fill before race choice, subtype badges, Human selection, editable autofill, optional Class popup, real attribute purchases, Skills guidance, both allocation methods, package application, normal first decimal roll, Finish Now and finalized save/reload.
- Computer Nerd + Starship Specialist with 38 SP spent all 38, including fallback Dodge/Block; 13 learned skills displayed green. The finalized character survived refresh with edited identity and ratings intact.
- No browser console errors in the tested workflow. Screenshots: Creation_Guidance_2026-10-07.png and Creation_Green_Skills_2026-10-07.png in outputs.
- JavaScript syntax and CRLF-aware Git whitespace checks completed before publishing.

## Coverage limits

The fanfare and mixer were checked through their scheduling, gain and mute behavior; their subjective loudness was not auditioned. The campaign-only reference drawer was reviewed in code and existing regression tests, not exercised through a campaign browser session in this follow-up. This was a character-creation release, not another exhaustive all-tab/combat playtest. No hosted/Render testing was performed. Personal campaigns, Vector and the frozen Gold Standard were preserved.
