# Notification and attribute-dice tutorial update — October 8, 2026

## Changes
- Top-of-screen notification rails are combat-only. Ordinary notices, result cards, fleet warnings and embedded-console announcements are suppressed outside combat. Suppressed results are not queued for a later encounter.
- Ending combat hides mounted alerts and releases the reserved page/dialog space. Pausing an active encounter continues to permit combat alerts. Console previews, catalog previews and preparation do not count as active combat.
- Embedded consoles use their GM/PC campaign shell's combat state. Explore perspective boundaries retain their separate state. Identical state updates do not trigger extra notice-layout work.
- Banner Exits is the PC default when no valid preference is saved, including storage-reset fallback. Explicit choices remain respected. The GM's exit-enabled default already matched this behavior.
- The Attribute purchase tutorial now explains all four rows, the two free D4s, left-to-right upgrades, adding separate dice, per-step costs, refunds and keeping the highest two rolled results. It displays the character's actual Attribute allowance, including the Spiddix allowance.
- An interactive Dexterity example progresses from D4 + D4 through D6 and D8 upgrades, then adds a third die: D8 + D4 + D4 for 60 points. Reset restores the example. This practice does not modify the character or spend points. Prices come from the same cost table used by the sheet.

## Verification
- Final full regression run: 978 passed, no failures/skips/cancellations (116.2 seconds). An earlier run exposed an older test harness missing the new notice API; updated its mock and added assertions for combat-state propagation before the successful full rerun.
- Final focused run: 15 passed. Covers outside-combat suppression, no delayed replay, end-combat cleanup with an open console, paused encounters, previews, embedded/Explore boundaries, default preference preservation and existing character creation behavior.
- Mouse-tested a disposable local character: Banner Exits selected by default; toggling Show Banner then Banner Exits produced no top notice and no reserved page gap. No browser errors.
- Mouse-tested every tutorial example step and Reset; checked the pool/cost display and verified real Attribute Points remained 195/195. Got It returned to the sheet. Inspected the final layout with the example controls visible inside the dialog at the normal browser size.
- JavaScript syntax and CRLF-aware whitespace checks passed.

Screenshots in outputs: No_Outside_Combat_Banners_2026-10-08.png and Attribute_Dice_Tutorial_2026-10-08.png.

Existing tutorial/confirmation dialogs and inline form feedback remain available; this removal targets the top notification banners identified by the user. Combat alert behavior was regression-tested, not manually played through in a full new encounter in this pass. No hosted/Render testing. Personal campaign data and unrelated work were preserved.
