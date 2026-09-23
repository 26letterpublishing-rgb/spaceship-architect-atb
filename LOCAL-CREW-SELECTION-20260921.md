# Local crew selection fix — September 21, 2026

Jason authorized fixing the Prepare Combat blocker and renaming the additional Explore ships with `#local now`.

The same PC/NPC could be a crew member of multiple saved ships. Prepare Combat rendered its checkbox from identity alone, so selecting one membership checked every row. For NPCs, staging an already selected roster member returned early without changing its starting ship. PCs also lacked a ship-specific checkbox destination. This produced the misleading all-checked state and the “Every selected character and NPC must be aboard a selected starship” blocker.

The fix in gm.js separates saved crew membership from this encounter's starting location:

- Each roster NPC or PC is checked only under its chosen ship.
- Selecting that character aboard another ship moves its starting location and preserves one participant rather than creating a duplicate.
- Selecting a ship still selects its assigned crew; the most recently selected ship becomes their starting location.
- Clicking an individual crew checkbox includes its ship automatically, subject to the six-ship limit.
- Unchecking a ship removes only participants currently starting aboard it, including manually staged NPCs. It does not remove characters moved to another ship.
- NPC deployment dropdowns update the same selection and obey the same six-ship limit. PC deployment dropdowns also select the chosen ship.
- Permanent crew memberships are unchanged. All this selection is encounter preparation state.

## Explore names

The original Wayfinder and Red Horizon remain. The ten additional presets now use these names, with their existing SIC descriptions retained after the name:

| Role | PC ship | GM ship |
| --- | --- | --- |
| Ship AI / Repair Drone | Clockwork Guardian | Iron Warden |
| Crew facilities | Hearthlight | Sanctuary |
| Warp travel | Farstrider | Starbound Courier |
| Sensors | Farwatch | Silent Listener |
| Probes / hacking | Pathseeker | Ghost Surveyor |

Names are generated for fresh Explore sessions. Existing saved campaigns, edits, ship IDs, equipment and layouts are preserved.

## Verification

- Full automated suite: **482 passed**, zero failures. Log: test-artifacts/crew-selection-full-tests.txt.
- Added five regression checks using the actual GM selection handlers and encounter preparation function: NPC relocation/deduplication, PC relocation, individual crew selection and ship removal, six-ship enforcement, and distinct preset names.
- Mouse test in an isolated campaign with Nova and Space Slug each linked to six ships: selected Red Horizon then Iron Warden, deselected Red Horizon, unchecked/rechecked Space Slug under Iron Warden. Only that Space Slug checkbox remained selected and its Starting Ship dropdown showed Iron Warden.
- Repeated the move with Nova from Wayfinder to Farwatch; only Farwatch's Nova checkbox remained selected.
- Clicked **Begin Combat** successfully. The live encounter showed Nova aboard Farwatch and Space Slug plus the SIC-generated Ship AI aboard Iron Warden. **Engage Clock** succeeded and displayed “Clock Engaged / Nova Vale is next.” No browser console errors were recorded.
- Syntax checks and whitespace check passed (existing Git line-ending notices only). Personal campaign hashes were unchanged. No commit, push, deployment or Gold Standard changes.

Refresh the GM/Explore page and reselect ships to load the crew-selection fix. For the new preset names, restart Spaceship Architect and open a fresh Explore session. The temporary port 8791 test server and test tab were closed after verification.

## Decisions without questions

Selecting another ship moves a shared crew member's encounter placement to that ship; it never creates another copy of the same roster identity. Direct crew selection also selects that ship to prevent a hidden unselected-ship blocker. Unchecking a ship removes its staged occupants rather than retaining invalid placements. Renaming affects newly generated Explore presets only, preserving user-edited and existing campaign ships.
