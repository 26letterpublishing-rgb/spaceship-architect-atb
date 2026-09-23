# Ship AI and NPC automation — local pass

Implemented Jason's Ship AI / optional NPC automation request locally. No commit, push or deployment. Real campaign storage was not used for tests.

## What changed

- Updated the existing Ship AI SIC and console instead of adding a duplicate. Its eight attribute pools are 4D6; supported skills are +2.5. Derived Speed is 10.5 and Command Window is 94 seconds under the existing formulas. Normal skill fusion and action modifiers remain in effect.
- Bridge (+) remains an add-on inside the Bridge, with no floorplan or occupied floor area. Verified that Ship AI and Self Destruct can share the same host square. The existing one-Ship-AI-per-Bridge limit remains.
- Added Defense, Offense and Automation Off to the Ship AI console and GM combat controls, in both circular and bar ATB views. GM NPC controls have Automate NPC / Automation Off.
- Automation reserves one free Bridge station and displays the newly generated circuit-board icon in combat and the PC's full Starships view. Full or reserved Bridge stations produce exactly **Free up one station first**. Off releases the station. Outside combat, choosing a mode reserves a station and arms the setting; actions begin with combat turns.
- Defense tries incoming Break Lock-On first, then Evasive Maneuvers. It turns off when neither can be performed.
- Offense tries Lock-On against shielded enemies, then fires. Against an unshielded enemy it prefers a loaded missile launcher, falling back to another weapon. Ordinary targeting, detection, ammo, station access and timing rules still apply.
- Ship AI chooses the highest-level usable zero-AU weapon, skips empty damage pools and repeat-shot AU surcharges, and never pays for an extra lock. Both the policy and authoritative weapon/lock validators enforce its AU restriction.
- NPC automation seeks a free Bridge station first, otherwise a random reachable station; then attempts Systems Analysis, Lock-On, a random usable weapon, and local SIC repair. Movement uses the shared doorway route planner, including rotated/split weapon-room stations. NPCs can walk to an impaired interior SIC before repairing it.
- Automatic dice are server-owned, use normal result calculations and input delays, and have a compact spectator display with animated dice, result, visible difficulty where applicable, disabled Roll/Confirm buttons and synthesized beeps. The GM and owning ship's PCs see the same results. Sound and reduced-motion preferences are respected. Human-owned rolls stay manual.
- Committed missile automation survives switching the mode off and removal of its launching NPC. Results and presentation stages are saved with encounter state. Ordinary weapon damage dice are preserved.
- Existing manual GM Ship AI control, Ship Assessment and intrusion detection remain. Existing installations/settings with no selected automation mode retain their manual behavior; explicitly choosing Automation Off releases their station.

## Decisions made while Jason was AFK

1. NPC “Scan” means **Systems Analysis**, since the requested priority skips ships already scanned/analyzed.
2. **4D6 +2.5 applies to Ship AI skill checks.** Damage uses the weapon/missile SIC's own dice. Distance, ship handling, retry and preparation modifiers still apply where the normal rules require them.
3. Automation selects the nearest detected hostile ship using the current PC/GM ship allegiance groups. It does not attack undetected contacts or ships in its own group, and does not expose hidden enemy crew/actions to unrelated PCs.
4. An already acquired lock leads to firing instead of repeatedly requesting Lock-On. If Break Lock cannot be attempted, Defense falls back to evasion.
5. A ship with installed weapons but no current target, ammunition or usable zero-AU shot waits for another turn. Offense switches off when the ship has no installed weapons. This avoids turning the mode off just because a firing cooldown is still running.
6. Missile launch still requires the normal usable lock. The AI does not invent a lock or waive ammo requirements; without one it tries another weapon. Loaded missile grades are considered highest first.
7. NPCs may pay normal weapon AU costs. Neither automation spends Exertion or buys AU boosts automatically. A stranded NPC with no legal action finishes its turn and retries later.
8. GM Undo suspends automation so it cannot immediately repeat the action just undone. Existing state remains restored; select the Ship AI mode again, or use **Resume Automation** for an NPC. A restored dice wait can also be resolved manually.
9. Automation is optional and encounter-based for NPCs, with settings retained in saved active encounters. No campaign-wide NPC behavior or boarding rules were added.

## Difficulties resolved

- The GM's default circular ATB layout uses different controls from the bar layout. Both now expose automation.
- Fallback stations cannot be calculated from a weapon card's overall dimensions: rotated and split floorplans differ. Station selection now reads the shared finished layout.
- Turning an AI off must release its physical station without cancelling an already launched missile's future damage. Missile automation is retained on the projectile itself.
- Automated actions use the same serialized server action queue as human actions. Clients cannot submit replacement results for an automatic roll or issue competing turn actions while automation controls that actor.
- Undo initially risked causing immediate automatic replay. The suspension/resume behavior prevents that loop.

## Validation

- **449 automated tests passed**, including 13 focused automation tests for stats, modes, full/reserved stations, plus-card overlap, route legality, priorities, zero-AU enforcement, pause/manual-roll priority, serialization and orphaned missiles.
- **Six real Chrome suites passed:** Ship AI automation, held turns, weapon clocks, crew rooms, ship workflows and missiles.
- The new browser pass exercised GM controls with real clicks; independent GM/Nova read-only dice; the generated station icon in the PC ship view; 4D6 +2.5 Defense; ordinary lock/weapon/damage progression; missiles completing after Off; NPC Systems Analysis; unauthorized-control rejection; Undo suspension; interruption cleanup; and retaining the same dice after encounter restore. No browser errors were reported.
- **220 JavaScript files passed syntax checks.** Whitespace checks passed.
- Evidence: `test-artifacts/ship-automation/`, including `browser.txt`, `unit-tests.txt`, `result.json`, screenshots and individual regression logs.
- Test servers used temporary data directories and were stopped afterward. Real `data/campaigns.json` remained 202,329 bytes with its September 6 modification time.

## Artwork

Generated with the built-in imagegen tool, then copied into the app as `ship-ai-station.png`. The PNG is 1254×1254 with a real alpha channel; the interface displays it as a small station icon. Existing SIC card artwork was retained.

Final generation prompt:

> Create a small transparent-background game sprite for Spaceship Architect, a detailed science-fiction starship tabletop app. One isolated top-down circuit board icon to overlay a bridge station: square dark green circuit board, clearly readable central silver microchip, bright cyan circuit traces and a few gold contacts. Bold silhouette legible at28by28 pixels, restrained realistic game-art shading, no text, no letters, no floorplan, no chair, no background, no glow outside the board. Board centered with generous transparent padding. Deliver as a single PNG with real alpha transparency.

## Maintenance notes

`ship-automation.js` holds selection and movement policy. `automation-runner.js` stages automatic results and uses the existing action handlers. `ship-ai.js` owns AI stats, modes and station reservation. `automation-ui.js` presents read-only automatic dice. Preserve the ordinary manual dice paths and the generated station sprite when extending this work.
