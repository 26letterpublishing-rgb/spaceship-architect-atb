# Local mine and gravity pass — September 28, 2026

Implemented locally under `#local`. No commit, push or deployment. Existing work and personal campaign data were preserved. Restart the Spaceship Architect server and refresh GM/PC tabs to load the server changes.

## Mine system

- Added Mine Launcher, Space Mines 1–3, Static Electron Web and Magnetic Seeker from Series B cards 97–102. Each has new generated card art; the launcher has a separate generated 1×2 floorplan and station. Optimized WebPs are 384px card images and a 384×512 floorplan; masters are retained. See ASSETS-MINES-20260928.json.
- Purchases auto-fill matching launchers; surplus and seeker upgrades stay in storage. Missile ammunition cannot fill mine launchers or vice versa. Reload requires the physical launcher station and uses the existing input-delay/action system.
- Launch places a mine in the ship's current hex after input resolves. One launch per 12 active seconds; three mines maximum per hex. Both deployment and moving mines enforce the cap.
- The launching ship never triggers its own mines. Other ships trigger them on entry, including forced movement and traversing the hex between updates. Detection reveals danger but does not grant immunity.
- A single weapon hit reaching the mine's threshold detonates it. Smaller hits do not accumulate. Mine damage uses the existing manual dice/impact flow, with GM takeover and restart recovery. Each mine is a separate hit; shield overflow is discarded per hit.
- Black holes pull mines smoothly and consume them at the center. Seekers consume one stored upgrade and pursue other ships within five units at two units per 12 active seconds. Webs open after 12 seconds, cover the adjacent hexes, expire after another 120 seconds, and modify scans by +12 into/out of the web or +6 across it.
- New Explore ships: **Trailwarden** and **Briar Sentinel**. Remaining unimplemented candidates: 28.

### Decisions

The printed launcher has no magazine capacity. This implementation uses **four rounds**. Electron Web opens automatically 12 seconds after launch; no second remote-detonation action was added. All FTL-only mine text/effects were omitted as requested. Mine ammunition and seeker attachments live inside the launcher/storage and have no individual floorplans.

## Other pending fixes completed

- **Gravity:** sample intensity minus rounded hex distance, then distribute that pull across **24 active ATB seconds**. Resample at the next cycle. This uses the simulation clock and stops with it. Fractional positions and cycle progress survive saves; ships keep their powered destination rather than having gravity move the destination itself. Visual ship transforms interpolate between updates. Gravity does not turn an idle/drifting ship toward the hole. The movement penalty remains hidden from the player's vector.
- **GM feedback:** Quick Prompt and Story Console results now produce visible, dismissible GM notifications above dialogs. Story Console also immediately acknowledges that the request was sent. The original notice element lacked visible positioning; it could end up below the page.
- **Destroyed labels:** the supplied video exposed competing update paths: one appended `[DESTROYED]`, the other restored the plain title. Both now use the same label and avoid unnecessary text replacement.
- **Keyboard movement:** WASD/arrows and SIC Power appear to the right of the embedded ship map, below Diagnostics. Removed duplicate full-width controls. Keyboard mode hides the click route and destination highlight. Console controls are green when usable at a station and gray when unavailable.
- **Out-of-combat power:** the local SIC Power control is accessible without entering combat. Occupied rooms can power off and start their normal reboot; consoles remain unavailable while off/rebooting.
- **Starting crew:** Begin Combat opens a ship-by-ship positioning dialog before preparing the paused encounter. The GM can drag crew or select a name and click a precise position. Existing encounter/saved ship locations are preferred, with valid fallback positions and station occupancy checks. Back returns to preparation without starting combat.

## Validation

**All 690 automated tests passed**, along with 21 runtime syntax checks and CRLF-aware whitespace validation. New checks cover mine storage, launcher separation, owner immunity, detected mines, crossed hexes, thresholds, three-per-hex limits, seeker movement, web duration/scan penalties, gravity consumption, hidden-contact privacy, separate shield-layer hits, HTTP ownership, restart recovery and GM takeover. Existing campaign, movement, weapon, manual-dice and clock tests also passed.

Gravity tests compare tick partitions and save/reload continuity, preserve the commanded destination and check paused time. In the tested stationary intensity-three scenario starting two hexes from center, destruction occurs after approximately 30 active seconds: enough for one full Speed-5 ATB from zero. This is not a universal grace period—stronger fields and starting nearer the center remain much more dangerous.

Paired GM/PC mouse testing used an isolated disposable room/server:

- Quick Prompt: PC rolled the normal animated dice and submitted 18, Success; GM received a dismissible result popup.
- Story Console: immediate Request Sent feedback; PC submitted 10 through the normal dice flow; GM received the result popup.
- PC launched a mine with a seeker attached; magazine/storage decreased correctly and the deployed mine appeared on the starmap.
- Outside combat, powered Bridge off, reopened the power menu to verify Off, and started its reboot. Enabled arrow-key movement beside the map; moving off the station disabled Toggle Console.
- Dragged Nova to a new starting position and confirmed; encounter prepared paused. Both ship maps and confirmation controls fit the dialog.
- Reviewed all seven generated images and checked PC browser errors (none recorded).

Browser evidence is under `test-artifacts/mines-pass/`: `gm-result.png`, `ship-sidebar.png`, `crew-deployment.png`. The regression output is `final-tests.txt`. Gravity timing/ownership edge cases were validated programmatically rather than every combination being manually replayed in a live campaign. No personal campaign or Vector server was used.

## Suggested playtest

Use Trailwarden/Briar Sentinel to deploy three mines, cross with the opposing ship, and submit each damage roll. Try shooting a detected mine below and at its threshold; reload from the physical launcher station. Then test a glancing powered course past a black hole while pausing/resuming ATB. These expose the most important player-facing interactions without redesigning a ship.
