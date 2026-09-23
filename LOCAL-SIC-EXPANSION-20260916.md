# Local VR and SIC expansion - September 16, 2026

Jason authorized local implementation without questions. No commit, push, deployment, live campaign file edits, or Gold Standard changes.

## VR Training Room

The 3x3 room now uses a newly generated 768x768 floorplan with larger fixtures appropriate to the smaller room and two operator chairs. The existing room art remains on disk. All map, console, card and printing consumers use the shared replacement definition.

Starting skills at 4.0 or below receive confirmed D4 tenths. Skills above 4.0 and below 6.0 receive exactly +0.1 with no roll. At 6.0 or higher there is no bonus; those skills are omitted from the training selector. Server validation prevents direct requests from bypassing the ceiling. Existing higher skills are not reduced. The obsolete under-2.0 restriction is gone. Daily limits, simulation themes/custom text, safety toggle, sound, local access, Life Support, oxygen and gravity requirements remain.

## New equipment

Printed values verified from SIC_Series_B.pdf cards B-27 through B-30, B-54 through B-58 and B-71, including representative rendered page checks.

| Repair Drone | Price | EN | Die | Defense | Threshold | Repair interval |
|---|---:|---:|---|---:|---:|---:|
| 1 (preserved) | 750 | 2 | D4 | 12 | 14 | 12.5 s |
| 2 | 1,050 | 3 | D6 | 14 | 17 | 9.09 s |
| 3 | 1,350 | 3 | D8 | 16 | 20 | 7.81 s |
| 4 | 1,650 | 3 | D10 | 18 | 23 | 6.10 s |
| 5 | 1,950 | 4 | D12 | 20 | 26 | 6.10 s |

Every drone uses a 1x1 EDG charging bay. Grades 2-5 have distinct generated robot artwork; the compatible bay interior is shared. Automatic deployment, targetable starmap markers, exterior repair animation, same-position dispatch, separation return, full-Hull docking, receipts and persistence remain shared. Dice feedback uses the correct die shape/label without blocking clicks or pausing play. One impairment destroys a drone, using its own threshold. Manual weapon accuracy, range penalties, ties hitting and locked shots remain unchanged.

Backup Generator costs 525 credits, supplies 3 EN, occupies 1x1, has Security 5 and threshold 55, and requires no operator. Impairment does not reduce its output; shutdown and destruction still stop it. It participates in normal installed power and construction budgeting. Its one-square clearance and any larger neighboring Engine clearance are enforced in construction and server validation.

| Antenna | Price | EN | Added die | Added range | Impaired die | Threshold |
|---|---:|---:|---|---:|---|---:|
| 1 | 1,200 | 2 | D6 | 1 | D4 | 9 |
| 2 | 2,400 | 2 | D8 | 2 | D4 | 9 |
| 3 | 4,800 | 3 | D10 | 3 | D6 | 11 |
| 4 | 9,600 | 4 | D12 | 4 | D6 | 13 |

Antennas occupy 1x2 EXT and have distinct generated artwork. They require an online installed Sensor to confer benefits. Bonuses enter the normal sensor dice pool and fusion; they are not flat score bonuses. Shared sensorStats drives both the ship sheet and live sensor console, including mixed-die labels and range. Uncertain scans still request confirmed manual dice; guaranteed-outcome checks use the expanded pool. Offline, destroyed or uninstalled antennas contribute nothing. Impairment changes the bonus die while retaining range, as printed. Existing detection and knowledge privacy remain enforced.

## Decisions made without another approval request

- Treat 6.0 as a hard VR ceiling: 5.9 can reach 6.0, then stops. Exactly 4.0 still uses D4.
- Preserve the established four-step Quality formula. Grades 4 and 5 share Quality 4 timing; Grade 5 improves repair dice, Defense and threshold. No fifth step was invented and no global timing formula changed.
- Each installed online antenna contributes its bonuses, since the cards specify no quantity limit. Impairment retains the printed range bonus.
- Reuse the existing charging-bay interior for all drone grades while making deployed sprites and cards visibly distinct.
- Backup Generator follows existing engine spacing: the larger of the two Engines' clearance requirements applies. Its printed immunity affects impairment, not explicit shutdown or destruction.

## Validation

408 automated tests, 20 edited JavaScript syntax checks and whitespace validation passed. Final floorplan, card and live-console screenshots were visually inspected. Eight browser runs passed: crew rooms and all nine new purchases/placements; antenna live rolls and power behavior; Drone 1; Drone 5; held-turn delivery; weapon clock; ship workflows; oxygen. Tests use disposable local campaigns and separate browser clients where applicable. Drone 1 and 5 also survived actual server restarts without changing paused progress or rerolling. Unit tests cover every drone grade, antenna states, sensor bounds, power/spacing and the VR ceiling.

The crew-room test exercises 4.0 to 4.4 with D4, 4.4 to 4.5 without dice, and 5.9 to 6.0 with disappearance from the selector. It also preserves Library, Meeting Room, Medbay and AI workflows. New-family purchases use the established collapsible family picker. No existing controls were removed.

Historical deferred laser-explosion/combat-recovery browser failures were not used as acceptance gates and are not claimed fixed. Hull Breach Repair Drone is a separate future system, outside the approved ordinary Repair Drone 2-5 expansion.

## Artwork and implementation

Ten generated WebP assets total approximately 743 KiB: vr-training-room-3x3.webp, backup-generator.webp, repair-drone-2-sprite.webp through repair-drone-5-sprite.webp, and antenna-1.webp through antenna-4.webp. The built-in image_gen tool generated them; scripts/sic-expansion-art.json records each exact final prompt and source original. Originals remain in the Codex generated-images folder. VR is 768px square, robots/generator 512px square, antennas 384x768. Transparency is preserved.

Shared changes are in ship-map-core.js, ship-power.js, ship-sensors.js, ship-drones.js, delay-rules.js and their existing UI consumers. Raw drone state remains private; detected public proxies contain only the appropriate grade, Defense and sprite. No separate subsystem or timing engine was introduced.

Logs and screenshots: test-artifacts/sic-expansion-*.log, test-artifacts/sic-expansion, test-artifacts/crew-rooms and test-artifacts/drone-alerts-1 / drone-alerts-5.
