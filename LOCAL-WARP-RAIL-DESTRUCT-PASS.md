# Local Warp, Rail Cannon And Self-Destruct Pass

Authorization: user's #local, followed by "please continue". No commit, GitHub upload, hosted testing, Gold Standard edits, or personal campaign edits.

## Delivered

- Warp Drive Zero, 1-5 and X: source catalog dimensions, prices, EN, thresholds, compatibility, passive stations, activation and travel speeds. Each has a distinct code-native equipment graphic.
- Fuel F/D/C/B/A/S: market purchases and bulk ship-store purchases; quantities in the FTL Fuel sheet, not installed-card inventory. Purchases spend Group Credits. GM stock adjustments include the mineral inventory and Iron.
- Warp console: light-year route planning, compatible largest-fit cells, activation/cancellation, animated travel, early exit and exit report. Bridge chart has fast-moving stars during warp.
- Actual travel advances only through GM campaign Pass Time. Activation uses active ATB seconds during combat, real seconds outside combat. A cell is consumed when its segment starts; early exit discards only its unused range. Later cells remain untouched.
- Combat escape removes ship markers and combat columns, deactivates aboard combatants, cancels their unfinished waits, drops detection/locks and disconnects hacking. Ships in warp cannot enter another battlefield or spend AU.
- Ballistic Rail Cannon A-119: independent 1x3 EXT + 1x1 EDG sections, manual accuracy despite Lock-On, 6D6 minus 2D6 per impairment, one Iron per accepted shot including misses, no EN/AU cost and no shield damage. Damage remains manual.
- Self Destruct A-88: Bridge/Cockpit add-on with no extra floor footprint. Two distinct registered crew physically at their own bridge approve the same countdown. Code/key activation animation. AI and remote hacking cannot authorize it. Any conscious registered crewmember can cancel without a turn or station requirement, including registered PCs omitted from the encounter.
- Blast uses floor(maximum Hull HP / 4)D12, range two units, and requires generated EN greater than 15. The manual damage total is requested at zero; ATB stays paused until confirmed or cancelled. Current target IDs and blast ID are retained to prevent stale/repeated settlement.
- Persistent status/recovery controls in GM and PC campaign pages, including closed-console cancellation and manual blast entry. Exit reports explicitly show spent fuel and discarded current-cell range.

## Verification

Final full automated run: **317 passed, zero failed**. New Chrome workflow and existing held-turn/weapon-clock workflows passed. Syntax checks and `git diff --check` passed.

- 28 transit-engine and 15 rail-cannon tests cover all drive grades, compatibility, impairments, fuel planning, passive stations, permissions, receipts, interruption, manual damage and serialization.
- New HTTP integration test exercises actual campaign authorization, duplicate fuel purchases, forbidden PC free stock, stale builder protection, real activation timer, GM-time travel, early exit, combat warp escape, pending blast ATB freeze, cancellation recovery, stale damage rejection and real server restart.
- Chrome script `scripts/playtest-warp-transit.cjs`: real market purchases/placement/confirmation, bulk fuel, Iron editing, reload, independent PC login and console selection, route calculation, activation/cancel, animated warp, GM downtime, early exit, closed-console cancellation and narrow-screen controls. Test fixtures alone shorten activation before verifying the real timer; production drive timing is unchanged.
- Existing held-turn Chrome regression passes at desktop/laptop/small sizes, including NPC readiness while a PC holds without role switching.
- Existing weapon-clock Chrome regression passes unlocked Ripple/Ion, locked Ripple, and GM-owned locked Ion damage on the natural clock.
- Test data and screenshots are isolated in temporary directories and ignored `test-artifacts/warp-transit`.

## Boundaries

- A source "month" is treated as 30 days. Qualified engineers cannot reduce activation below one 12-second round. Impaired cells supply half normal range. These are explicitly recorded implementation interpretations, not additional rules read verbatim from the book.
- Warp is narrative travel, not a destination galaxy simulator. No real-time journey completion occurs while users are offline.
- Self-Destruct damage accepts a manually rolled total. It does not generate dice results, hull breaches, crew casualties, or atmospheric consequences.
- Every grade's mechanics have automated coverage; not every grade has a separate full browser combat playthrough.
- Source material: core printed 31L / 36L (PDF pages 65 / 74-75); SIC A-60..66, A-88, A-119, B-41..46. Local source PDFs and extraction were checked; no web substitutes.

## Preservation Requirements

Transit fields are server-owned: warpState, destructState, warpFuel, minerals and transitReceipts. Preserve them in campaign saves, encounter normalization, preparation, synchronization and End Combat. Never let a stale builder restore spent fuel/Iron or pre-purchase credits. Resource receipts remain on the saved ship.

Current isolated preview: http://127.0.0.1:8797/showcase.html. Data directory: `C:\Users\zombi\AppData\Local\SpaceshipArchitect\local-warp-rail-destruct-20260913`. Older local preview ports are not this pass's backend. The preview intentionally remains running. Browser scripts/CSS return HTTP 200; server-only ship-transit.js correctly returns 404.

Keep countdowns separate from GM campaign time. Do not resume an intentional GM pause when resolving a blast. Do not hide cancellation inside a console. Shared console CSS must not make the warp scene's absolutely positioned stars cover the entire interface; its scene is explicitly positioned. Preview guards must allow the persistent recovery panel.
