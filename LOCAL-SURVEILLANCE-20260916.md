# Surv. Camera — local implementation, September 16, 2026

Jason's requested A-87 digital version is implemented locally. No commit, push, deployment, personal campaign edit, or Gold Standard change.

## Behavior

- Purchasable **Surv. Camera**, 300 credits, one 1x1 interior operator station. Card wording describes distributed cameras across the entire ship, not individually purchased cameras. Retained printed EN 1, Security 4, Engineering, Dianium / 2 hours, threshold 10, and destruction at one impairment.
- New generated transparent 768px floorplan, with its chair-aligned station preserved for new purchases and all four orientations.
- Unstaffed, powered cameras detect hostile interior occupants. A new arrival closes existing ship doors and sends the owning crew/GM a red intruder banner using the established alert sound and mute preference. No recurring door closure while the same intruder remains aboard. Leaving and returning produces a new alert.
- The live surveillance console has six ship-sector monitors, crew dots, names and row/column positions, current door indicators and recent security activity. Preserves the shared console selector, mute, Hold, Leave Station, fleet status and timeline. Works in combat and outside combat.
- A conscious physical operator on either side can see interior occupants. A successful connected hack of the camera SIC grants the same remote feed through the shared console selector. Disconnecting, leaving, losing power or impairing the system removes access and clears the display.
- The authenticated feed exposes visual names and positions only, not character sheets, HP, ATB, private IDs or hacking secrets. Raw surveillanceState remains server-only. Unrelated sessions and impersonated character IDs are rejected.
- Server persistence, restart, encounter preparation/end, stale ship saves and door-coordinate remapping preserve camera state and closure. Boarding arrival uses existing authoritative locations, including GM relocation and NPC roster locations outside combat; no new boarding movement/entry rules were invented.

## Decisions made without further questions

1. Preserve all printed statistics except Jason's price/coverage/station overrides. One impairment disables the camera system under the printed destruction rule; it does not silently erase the SIC from inventory.
2. Automatic coverage does not need an operator. Closing doors is not locking them or disabling their established controls.
3. Camera monitors require the physical camera station, or a direct connected camera hack. Ordinary bridge access and bridge capture alone do not grant this local-only feed.
4. Retain automatic alarms and door closure even if the camera is hacked; Jason requested exposure of crew locations, not suppression of the alarm.
5. Until future faction/boarding rules exist, registered crew are friendly. Other assigned ships with the same control side or explicit matching affiliation are friendly; unassigned actors use their PC/NPC side. Each distinct hostile arrival is deduplicated across saves/restarts.
6. Initial coverage also detects an intruder already aboard when a working system is installed or restored to power. Camera failure clears the active presence baseline so restored coverage can warn again.

## Verification

- Full automated suite: **413 passed**. Ten focused camera/alert/public-asset tests passed after the final station-orientation and recipient-filter refinements.
- `scripts/playtest-surveillance.cjs`: real purchase/placement/confirmation, generated floorplan, desktop/mobile/laptop console, ordinary authenticated campaigns, red alert and closed doors after GM relocation, physical hostile operator, denied former/unrelated operator, successful real hacking command and captured console, disconnect, actual server restart, OOC arrival, stale-save protection and impaired feed removal. No browser errors.
- `scripts/playtest-ship-workflows.cjs`: shared PC ship details, walking, upgrades, purchase, printing and OOC console regression passed.
- `scripts/playtest-live-hacking.cjs`: independent GM/PC intrusion, counter-hack, recovery, remote helm and sensor knowledge regression passed. Its old hardcoded sensor-range expectation was still tied to the pre-redesign Explore fleet; the script now explicitly uses the established `combat-demo.cjs` laboratory fixture, retaining the original assertions.
- Whitespace checks and changed-JavaScript syntax checks passed. Tests use disposable local campaigns and close their own servers/browsers.
- Screenshots: `test-artifacts/surveillance/`. Full logs: `test-artifacts/surveillance-suite-final.log`, `surveillance-live-hacking.log`, `surveillance-ship-workflows.log`.

## Artwork

Built-in ImageGen produced `surv-camera-floorplan.webp`; source PNG was retained under Codex generated_images. The complete prompt, source path and conversion are recorded in `scripts/surveillance-art.json`. Console monitors are live code-rendered ship sectors, not fabricated camera footage.

## New discussion while this pass was finishing

Jason proposed a small typing-hands indicator, reducing post-roll delays by success margin, halving on critical success, doubling on critical failure, and a +50% Scan Area range pulse for two active seconds. These proposals were reviewed, not implemented as part of the camera pass.

Core rulebook PDF page 64: Scan Area rolls Sensor Dice + Sensor Systems + depth-in-range bonus against Masking; ordinary active scans cannot detect beyond normal range. Masking <=10 identifies automatically; 11-30 yields vague contacts. The app implements this, plus the previously authorized automatic probability sweep documented in LOCAL-LIVE-HACKING-PASS.md: every 12 active seconds, a baseline 1/4 chance of an anonymous region within twice sensor range; stationary active scans improve that chance. That extra sweep is a digital rule, not the printed Scan Area paragraph. Guaranteed-outcome scans skip dice under the existing optimization.

Recommended discussion defaults: small nonblocking typing indicator following real paused/running processing; subtract max(0, roll minus difficulty) seconds from the factor-derived input delay, then halve for critical success, with a one-second minimum; critical failure doubles the original delay. Multi-target scans need a deliberate timing rule because each target has its own hidden difficulty. Keep physical cooldowns, travel, oxygen and unrelated clocks separate. A proposed +50% active scan pulse should start after input completion, last two active seconds, not stack, still require the detection check, and retain successful contacts under ordinary retention rules. Await Jason's response to the recommendations rather than treating this note as implementation authorization.

In-memory Scan Area verification reproduced: range 12, Masking 18, distance 10 and submitted score 16 detects (16 + 2 = 18); distance 13 with score 99 does not; Masking 10 at distance 10 is detected before rolling. No timing or scan-rule changes were made. An already-running local server must be restarted to load the new server module/routes; any existing user-owned server was left untouched.
