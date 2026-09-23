# Local Field Utilities Pass

## Scope

Implemented Tractor Beam, Manipulation Arm, Escape Pods, Docking Bay and Ripple Reflector, including purchasing, placement, artwork, stations and consoles. Existing Missile Flares remain supported through Missile Launchers, with an added three-flare map burst. Local only: no commit, upload, hosted testing or personal campaign changes.

## Sources

- SIC Series A PDF pages 90-93: Manipulation Arm, Tractor Beam, Docking Bay and Escape Pods.
- SIC Series A PDF page 118: Missile Flares. Page 122: Ripple Reflector, also visually checked against the rendered card.
- Core PDF page 201: consensual docking needs no roll; salvage outcomes remain GM-adjudicated. These additions do not change prior ATB, oxygen, medical or movement timing.

## Implemented Behavior

- Tractor Beam captures detected ships within two units, at most half the source hull size, without active shields. The selected separation follows the carrier. Independent movement is blocked while held; impairment, power loss, shields or departure release the hold.
- Manipulation Arm operates on targets in the same hex, records the operation and can recover escape pods. Its impaired every-other-SvS-round cadence is represented as 24 active seconds, with real-time recovery outside combat.
- Docking Bay permits same-hex docking up to the carrier's Scale Rank. PCs request clearance; a persistent notice lets the GM approve from the main interface after confirming consent and bay safety. Ordinary doors require decompression confirmation. The optional doorway shield costs 2,500 Group Credits once. A bay can be enlarged in construction without an additional SIC charge; ordinary hull costs still apply.
- Docked vessels follow the carrier and cannot take independent combat actions. Undocking restores eligible crew at zero ATB, not unconscious crew. Impaired bays prohibit entry and exit. Occupied bays cannot be removed by ship editing.
- Escape Pods carry up to three physical passengers. Launch stops their combat participation, records their evacuation across saves/restarts and creates a distress-beacon map marker. Recovery moves them aboard the receiving ship; foreign crew transfer requires GM approval. Each impairment deals the printed fixed 20 HP to occupants, without charging the same impairment again at launch. Evacuated passengers are no longer affected by the source ship's oxygen system.
- Ripple Reflector returns Ripple damage using double-distance falloff. A healthy reflector protects its ship; an impaired reflector also takes that same returned damage. A single manual damage roll resolves the event, without recursive reflection. Out-of-range returns require no meaningless damage roll.
- Missile Flares retain three flares per use, manual coin checks and manual deflection-direction dice. They remain ammunition, not a separate station.

## Explicit Digital Interpretations And Limits

- Added utility stations/consoles are interface provisions, not extra printed card bonuses. Escape Pods require physical passengers even when an enemy bridge is captured.
- Docking currently stores one vessel per bay and uses the carrier's Scale Rank. Enlarging the footprint does not invent extra capacity. Nested carriers are rejected. Destruction causes emergency separation with wreckage consequences left to the GM.
- Manipulation/salvage and planetary Tractor Beam effects are recorded narrative operations, not automatic resource awards or a terrain simulation.
- Escape Pod atmospheric entry, parachutes and rescue AI are listed capabilities, not a planetary flight simulation. Pods have persistent visual markers but no invented independent Hull HP or targetable missile-style combat profile. A recovered launched pod is not automatically rearmed.
- Impaired reflection uses one manual return-damage result for both ships. No additional independent or automatically rolled damage is introduced.
- Existing Explore ships are not rebuilt to preinstall these SICs. Purchase and install them through the normal ship builder.

## Reliability And Privacy

- Server-owned fieldState survives campaign/encounter/builder normalization. Unrelated players do not receive private field records or undetected GM ships through utility target lists.
- Outside-combat utility operations persist positions with ships instead of creating an incomplete encounter record.
- Evacuated locations and docked/escaped ATB flags are reconstructed after restart. Recovery does not revive unconscious crew.
- A newly created manual weapon-damage wait is persisted immediately. Previously, the clock could pause before its next periodic save, restoring the earlier input stage after restart.
- Utility commands are receipt-protected against duplicate spending/launches. Global GM docking clearance is a follow-up to an existing request, not a second earned turn, and cannot bypass pending manual rolls.

## Verification

- 366 automated tests pass, including 15 new utility unit tests and a real HTTP/restart test for manual reflected damage, GM ownership, frozen/resumed ATB and persistent evacuation.
- Actual Chrome mouse workflows purchase/place all five additions, operate their physical PC stations, capture/release a tractor target, journal an arm operation, buy the doorway shield, request docking, approve it from a separate GM page, undock, change reflection settings and launch a pod. Laptop and mobile console bounds are checked.
- Existing Chrome held-turn, weapon-clock, ship-workflow, missile and crew-room regression workflows pass. Field utilities and live hacking are rerun after the final access changes.
- Campaign fixtures are isolated and use ordinary room authentication. These focused tests are not a claim to cover every possible long-running multiplayer interleaving.
- Screenshots and logs are in ignored test-artifacts/field-utilities. Test browsers and servers close after their runs.
- Final checks: 87 root JavaScript files passed syntax checks; the structural Gold Standard audit found no unintended missing files or controls; git diff --check passed. Fresh Explore opened on Script in Chrome without page errors.

Local preview: http://127.0.0.1:8801/showcase.html, hidden server PID12056. Its separate data folder is C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-field-utilities-20260914. Earlier previews and personal data remain untouched.
