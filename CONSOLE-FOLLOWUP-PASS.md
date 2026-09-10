# Console Follow-Up

Authorized by the latest #commit. Gold Standard and data/campaigns.json remain untouched.

## Implemented

- Ship checks use the real character skill dialog in an isolated iframe, including physical dice, manual scores and Confirm and Submit. Server requests remain authenticated and retry-safe. Concurrent GM completion closes the stale player prompt.
- Scan Hex and Life Scan select a hex after the action button. Learned Masking and failed-roll bounds inform difficulty labels. Analysis has its own defense knowledge.
- Hails notify receiving crews; accepted calls report to both ships and the GM.
- Console choice survives perspective reloads. Pilot standby identifies visible actors or says Awaiting GM action. Unclicked navigation previews clear on mouse leave, while committed destinations remain.
- Navigation text keeps screen-sized labels. The enlarged rotating Vector Array fits the available footer space. Chart text is not selectable; browser-owned selection menus are not globally disabled.
- Successful Analysis reveals a sanitized interior snapshot without crew positions. Known biological life counts reveal anonymous actual ATB progress, never character identities or squares.
- GM View Ship opens read-only Ship Details, without the library/construction tabs. Older linked ships without confirmed snapshots use their saved layout for statistics.
- Power On, Power Off and Restart have distinct availability. Offline SICs are gray; boot timers appear on maps/console, and a seated PC regains console access after restart. Compact action windows retain the combat display behind them.

## Verification

132 unit/HTTP tests passed. Fresh campaign GM/two-PC sensor browser suite passed, including the shared physical dice window, roll retry/restart, Analysis/Life Scan, remembered console, bridge power cycle and read-only details. Cockpit browser suite passed all 12 orders and two desktop sizes; shield browser regressions passed. JavaScript syntax and diff whitespace checks passed.

Fixtures are API-created; these checks are not a full new-user character creation playthrough. Render verification follows publishing. Browser screenshots are in ignored test-artifacts directories.

## Maintenance Notes

Ship roll descriptors are server-provided; ship checks do not spend the temporary host character's resources. Preserve this isolation from personal/demo character storage. Anonymous crew and analyzed layouts must remain observer-filtered. Do not restore the earlier unconditional observer-id equality shortcut: undefined observer IDs must never bypass filtering.
