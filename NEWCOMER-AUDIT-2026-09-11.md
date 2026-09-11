# Newcomer-Style Walkthrough

An isolated browser/server with fresh storage was used. During this walkthrough, I used only player-facing controls and text, not source code or documentation. I already know this project, so this is a usability audit from a newcomer perspective, not a claim of genuine first-time ignorance. Combat was tested separately with authenticated GM/player browser scenarios.

## Chronological Log

1. Main menu: assumed Create/View Character starts a personal character and Create Starship starts construction. Both were correct. A stray action-panel arrow appeared before combat; its initial visibility is now fixed.
2. Created Aster Reed, player Test Pilot, Human. The character was a fresh draft, not an Explore character. Race appearance and description were accessible.
3. Human promised +200 Experience while the draft displayed zero. Assumed the reward arrives later, but the description did not say so. Confirmed it arrives on finalization; copy now explicitly says this.
4. Next Step listed outstanding requirements. This was useful. The initial 195/195 attribute points needed a second look to distinguish remaining from spent; the next-step text clarified it.
5. Attribute upgrades cost 15 points. A rapid automated click sequence did not count every click; paced visible-state interaction worked. This is recorded as an observation, not a proven ordinary-user bug.
6. Skill upgrades stopped at rating 3. Initially assumed a button had stopped responding, then its Creation Maximum 3 tooltip explained the limit. No rule change was made.
7. Allocated Pilot/Helm, Weapon Systems, Sensor Systems, Engineering, Computer Systems and Initiative to 3, with Awareness and Athletics/Endurance at 1. Skill descriptions were accessible.
8. Finalization warned about optional FUBS being permanently skipped. The warning prevented an uninformed click, but the acronym remains a learning hurdle. I chose to skip it for this test character.
9. Finalization rolled skill decimals with a remaining-work indicator. Waited for completion rather than assuming a frozen page. Character became FINALIZED with 200 Experience.
10. Created First Light with a 3x3 hull. Assumed hull selection defines the interior and outer edges; the map behaved that way.
11. Confirmed Ship Statistics remained unchanged during edits while working HSM changed. The confirmed/working distinction is accurate, but still requires attention.
12. Purchased Life Support. The UI returned to construction and identified the active placement. Initially surprising, then clear from the placement message.
13. Installed Life Support, Cockpit 1, Power Engine 1 and Action Engine 1. EDG's outer-wall requirement was explained. The cockpit card's CPU Systems label differed from the character's Computer Systems; the card now uses the consistent name.
14. Tried placing Exhaust Thruster 1 inside on purpose. The interface rejected it with a clear exterior-attachment explanation. Placing it outside the hull worked. This mistake was handled well.
15. Confirmed Changes. The saved ship had 9 hull squares, 5 EN, 3 AU, Move 8 and Masking 13. Its cockpit, propulsion and life support made it a functional basic ship. The construction charge was 14,400 credits.
16. Its 3 AU capacity cannot afford the Exhaust Thruster's 4 AU boost, but base movement remains usable. The card is accurate; a future capability summary could make this tradeoff more obvious.
17. Ship Details showed the saved sheet without construction controls. Personal character and ship creation completed without entering Explore Features or editing a real campaign.

## Combat Follow-Up Findings Fixed

- Unknown enemy condition looked like empty health. It now says Condition unknown until analysis supplies data.
- An analyzed ship without a Life Scan could look as if it had no crew. The timeline now identifies that Life Scan is required.
- Console notices could cover the selector. They were moved away from it, and headers gained room for wrapped controls.
- Too many direct actions could enlarge the turn panel over the map. The action list is now bounded and scrollable.
- Lock-On's less familiar operations now have rules-help buttons. Break Lock-On is available from the helm without needing your own targeting SIC.
- Misses, required damage rolls, AU, turn state and successful destruction now have distinct visible feedback rather than relying on log interpretation.

## Three Future Improvements

1. A compact ship readiness summary: show base flight, life support, weapon readiness and boost affordability separately. This would explain a usable ship with an unaffordable optional boost without calling it broken.
2. A selectable guided Explore scenario: detect, analyze, acquire lock, fire, roll damage. Keep the ordinary sandbox available, but give new testers one clear objective at a time.
3. A short combat reference opened from any console: define Defense, Masking, AU and input delay together, with links to the relevant actions. This should complement the future rulebook rather than replace it.
