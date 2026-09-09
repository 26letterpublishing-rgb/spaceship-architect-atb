# Integrated Console and Hold

## Rules

- Hold is available on consoles during the character's turn, not during input, recovery, movement, or another unresolved action. It sets initiative to 99% of the room threshold and stops ONLY that character's initiative gain.
- Resume works outside the character's active turn, filling the final 1% at normal speed when the combat clock runs. It never selects a turn directly, interrupts someone else's action, or bypasses a pause. Ship movement/recharge and independent effects continue normally.
- Confirmation explains those rules and preservation of remaining Command Window time. Resume does not replenish time. Expired time stays zero; NPCs retain their existing no-command-window behavior.
- State persists with the unit. Defeat, forced departure, or forced delays release Hold; reset clears it. GM nudge asks the GM to Resume first. A Combat View tray allows permitted players/GM to resume without returning to the console.
- The shared console-hold module supports occupied station locations without tying the mechanic to a particular thruster or pilot stat. New console types should expose the same toggle.

## Presentation

- Full console uses pilot-console-integrated.png, generated with the built-in image generator. The source is retained in the Codex generated_images folder as exec-771a2f02-f8a1-48e9-9857-a3aaf03c4774.png. Earlier console art remains untouched.
- Final generation prompt: front-facing orthographic starship console backing plate, graphite metal and silver beveled edges, cyan seams and occasional amber lamps; one empty header display plus six empty recessed displays in three columns/two rows, dominant center column; no room, exterior, hands, logos, text, charts or baked-in UI. Live layout is aligned to the resulting screen openings rather than covering unrelated cockpit scenery.
- Yellow vector dot follows a fixed ellipse with a CSS motion path. Reduced-motion disables motion.
- YOUR TURN flashes red once/second with a synchronized soft tick. Sound preference is respected. Pauses, hidden document, input, Hold, submission, and expired Command Window stop the repeating cue. Reduced-motion uses steady red.
- Unaffordable unchecked AU boosts use aria-disabled plus muted styling while allowing a pointer/keyboard attempt to explain failure: 'not enough Auxiliary power', with red AU warning. Already-selected boosts stay removable. Selection costs are combined and reevaluated against live AU. Server launch validation remains authoritative.
- AU display markup changes only when values change, avoiding animation restarts and detached nodes on every 200ms redraw.

## Verification

New unit coverage: Hold lifecycle, command carry, pause, invalid action states, serialization, departure and expired command. Existing full suite and scripts/playtest-cockpit.cjs must run before publishing. Extended browser checks include fresh separate GM/PC sessions, repeated movement and real station arrival in Explore, warning clicks with actual mouse coordinates, Hold cancel/accept/resume via Combat View, continued flight, retained command time, and repeat tick stopping under pause. Screenshots include 1366x768 and 1920x1080. See task completion for final pass/deployment results; this file is not itself proof of publication.

Post-upload player-only usability report is a separate deliverable, not this scripted regression suite. Do not fix findings during that audit.
