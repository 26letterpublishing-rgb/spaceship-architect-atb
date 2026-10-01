# Local Cleanser station and layered shields — September 22, 2026

Implemented under Jason's `#local` authorization. No commit, GitHub push, hosted deployment, or Render testing. Restart Spaceship Architect on its normal port 8790 and refresh the browser to load the server and interface changes.

## Starship targeting and aftermath

- The Planetary Cleanser target selector now includes detected, available starships as well as intact planets.
- Charging records the target's original hex. At the end of the 120 active seconds, a ship at least 3 hexes from that original hex escapes all damage. Movement for the final clock step is applied before this decision.
- The original aim remains fixed. The display identifies the target, original hex, and known displacement. Losing contact does not reveal the target's hidden current position.
- Misses still use the normal damage prompt, existing spectacular D12 presentation, result confirmation, zup audio, and explosion. The explosion strikes the original hex and leaves a dark, non-interactive map patch without debris.
- Hits use the normal ship damage system. A surviving shield-protected ship remains visibly intact in the cinematic. A destroyed starship gets ship fragments and the normal map wreck; it never becomes planetary debris.
- Planet destruction remains unchanged. Ships passing through a planet's area are not collateral targets.
- Aftermath patches persist through saves, restart, and Undo snapshots. Preparing a new encounter clears them. They render beneath ships and do not change map fitting or intercept clicks.
- Normal destruction cleanup still applies: destroyed ships stop moving, their crew are defeated, and victory/exploration behavior is retained.

## Separate shield layers and icons

- Each ordinary incoming hit affects only the operational shield with the lowest current HP. Equal current HP uses stable inventory order.
- Only that shield's damage reduction, AU protection, and impairment modifier affect the hit. Excess damage is discarded before reaching another shield or Hull.
- Remaining systems retain their HP, regeneration, and other state. Two live shields can therefore absorb two Cleanser hits without Hull damage.
- Every installed shield has its own group of three icons: 6 for two shields, 9 for three, and so on. Each group has independent full/half/empty readings.
- There is a clear 12px layout gap between groups. Groups wrap intact when necessary. Map condition displays make room for up to three groups per row.
- Depleted, disabled, or destroyed installed systems retain empty groups. Stored, uninstalled systems are excluded.
- Display order remains stable when HP changes; it does not reorder icons every time another shield becomes the weakest.
- Shared rendering covers combat headers, interior statistics, Bridge fleet panels, shield/sensor views, analysis reports, the PC Starships view, and starmap markers.
- Enemy system counts and condition groups appear only after Systems Analysis. PCs receive coarse readings for revealed systems, not exact enemy HP or later hidden installations. Cleanser events and logs also avoid revealing exact enemy shield/Hull losses or hidden escape causes.

## Cleanser station presentation

- Replaced the menu-like center with a large containment chamber using the existing generated machinery art, concentric charge rings, energy marks, and small decorative D12 outlines gathering inward.
- A waveform becomes more energetic as charge builds. The final five seconds add bright containment sparks and an urgent charge appearance.
- Instrument motion is tied to actual elapsed charge time. Pause freezes it. Closing/reopening the console restores the same charge state.
- Charge time, charge percentage, target solution, Dark Phazon, power routing, and Masking remain readable. Operator ATB has a separate footer display.
- Kept the station selector, previous/next station controls, Combat View, Hold, Leave Console, Abort, mute, read-only access between turns, and last-console restoration.
- Responsive layout keeps the controls accessible on a 760×800 viewport. Reduced-motion preferences suppress spinning and sparking effects.
- Decorative D12 outlines are instrumentation, not another dice roller. All actual rolls still use the established physical dice renderer and normal confirmation flow. The prior zup timing is unchanged: impact begins 0.5 seconds before the clip ends.

## Decisions made without another question

- Interpreted “lowest HP shield” as lowest current HP, rather than lowest maximum capacity.
- Evaluated displacement when charging completes, using the ship's continuous movement position against the recorded integer aim hex. Exactly 3 hexes escapes; less than 3 is still hit.
- Cloaking after aim is established does not erase the firing solution. Moving away, warping away, docking, or otherwise leaving the encounter can escape it. PCs do not receive hidden escape reasons.
- The shot affects its designated target only. Other ships crossing the blast hex are not implicitly hit.
- Left existing explicit exceptions intact: Ion bypasses shields, Rail retains its shield restrictions, and Ram/Skim retain their special collision formula. This pass changes ordinary layered weapon damage, not those separate printed mechanics.
- Dark patches remain for starship blasts, including shielded hits. Actual wreckage appears only if the ship is destroyed.

## Verification

- Full automated suite: **595 tests passed**, no failures.
- Final focused checks after the last eligibility/privacy fixes: **48 tests passed**, no failures.
- All **25 changed JavaScript files** passed syntax checks. Whitespace checks passed with the repository's Windows line-ending setting.
- Isolated browser playtest used port 8791 and disposable campaign data. The normal 8790 server and Vector were untouched.
- Verified target selection, actual charge start/resource use, paused mid-charge and final-four-second visuals, station switching, Combat View/Console View return, reopening the last station, and smaller-screen control visibility.
- Completed the normal Roll Damage → existing D12 animation → result → Confirm and Submit → cinematic sequence twice in the browser.
- Shielded hit: displayed damage **129,223** depleted the 10-HP layer only. The 20-HP layer and 100 Hull HP remained intact. Six icons showed one full and one empty group with a gap.
- Escape: target moved from Q3/R0 to Q6/R0. Displayed simulated damage **134,190** caused zero shield/Hull loss; the cinematic contained no debris/fragments and the map showed only a dark patch at Q3/R0.
- Verified 9 icons in 3 separate groups, including a 5/10-HP layer showing full/half/empty icons. Confirmed the aftermath patch contains no debris image and ignores pointer input.
- Automated coverage additionally verifies hit/miss boundary movement, no overflow, shield modifiers, privacy, retry idempotency, hard-paused destruction cleanup, save/restart, Undo, and new-encounter reset.
- Browser error/warning log was empty during the tested flows. Audio timing was preserved and regression tested; subjective sound balance was not auditioned in the background browser.
- Both personal campaign files retained their original SHA-256 hashes. Frozen Gold Standard was not modified.

## Source map

Core rules: `ship-cleanser.js`, `ship-shields.js`, `ship-distances.js`, `server.js`.

Shared shield presentation/intelligence: `health-display.js`, `health-display.css`, `ship-sensors.js`, `campaign-api.js`, and their existing display callers.

Station/cinematic presentation: `cleanser-ui.js`, `cleanser-station.css`, `cleanser-impact.js`, `cleanser.css`; map aftermath in `space-map.js`.
