# Local VR Training Room update — September 16, 2026

Jason requested a 3x3 room and fixed +0.1 training for skills over 4.0.

## Behavior

- Shared A-83 definition now occupies nine squares instead of 25. Existing placement anchors and owned hull remain intact; the room uses its existing artwork and two stations within the smaller footprint.
- Starting skill 4.0 or below uses the existing confirmed D4 interface, awarding +0.1 to +0.4. Starting skill above 4.0 receives exactly +0.1 with no dice dialog. The server selects the gain, ignoring supplied dice above the cutoff.
- Training remains once per character per campaign day. Physical access, out-of-combat requirement, functioning Life Support, oxygen, gravity and impairment checks remain unchanged. Custom simulations, themes, safety toggle, sounds, and room settings remain available.
- Price 7,500 credits, EN 2 and the other card statistics are unchanged.

## Interpretation

The old below-2.0 eligibility restriction was removed so the requested higher-skill rule can function. Exactly 4.0 still rolls D4 and may cross the threshold on that award. No hull was deleted or refunded automatically. A character standing at a former station outside the reduced footprint may need to walk to a new station.

## Verification

- 18 crew-room unit/HTTP tests passed, including boundary ratings, repeated-request protection, daily reset, fixed gains despite submitted scores, Endurance movement, saved layout/settings and Medbay recovery.
- Chrome crew-room playtest passed: actual construction and placement, 4.0 to 4.4 with D4, then 4.4 to 4.5 without dice, switching skills, retained custom simulation, later sheet persistence, plus Library, Meeting Room, Medbay and Ship AI workflows. Screenshots inspected.
- Seven shared ship-map tests, six edited JavaScript syntax checks and whitespace validation passed.
- Chrome ship workflow playtest passed: PC walking/upgrades/details/printing, expanded construction, energy guard, preparation controls and card layouts.

Local implementation only; no commit, push, deployment, live campaign data edits, or Gold Standard changes.
