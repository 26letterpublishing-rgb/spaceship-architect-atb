# Local SIC and triangular hull pass — September 21, 2026

Implemented locally under Jason’s #local authorization. No commit, GitHub push, deployment, or edits to personal campaign data. Tests used disposable Explore rooms and a separate temporary server/data directory. Restart the normal Spaceship Architect server to load the updated server rules; its address remains http://127.0.0.1:8790/index.html.

## Delivered

- PC Ship tab movement previews follow the pointer after Move and remain fixed after selecting a destination. They use the existing doorway route and walking animation. Starting movement temporarily reveals the interior without overwriting saved Hull-view preferences.
- Crew figures remain humanoid through live DOM updates, including the GM and Combat views. Ship-tab figures, walking figures and live combat colors now follow the character’s current ATB color.
- Gym B-66 is 3×3, 75 credits, with exercise choices and a saved activity report.
- Science Lab B-65 is 3×3, 1,000 credits, with shared research notes and storage for 5,000 minerals. Store/withdraw explicitly transfers existing ship minerals, checks capacity/stock, and protects against duplicate requests. Eligible rolls receive +4 in the ordinary skill roller.
- Holographic Projector B-79 costs 400 credits, attaches inside a Bridge/Cockpit, adds +2 to Navigate aboard that ship, and adds a holographic visual to the Ship AI console.
- Vulnerability Fortification B-116 attaches to a threshold-bearing SIC. Each purchase adds one Damage Threshold; costs are 500, 1,000, 2,000, etc. for that host. Owned cards display the effective threshold. Direct weapons and missiles use the same threshold calculation.
- Power Core Damper B-76 costs 1,800 credits and 1 EN. It attaches inside an Engine and reduces that Engine’s required clearance by one square.
- Scramble Box B-119 costs 3,000 credits and 5 EN, occupies 1×1, and subtracts one from enemy component-lock rolls against adjacent SICs. Boxes cannot touch one another; impairment disables their effect.
- The six new cards have vector artwork. The Gym, Lab and Scramble Box also use it on the ship floorplan. (+) add-ons have no floorplan and do not block their host’s spaces. Add-ons follow their host when moved; removing a host puts its add-ons into storage, from which they can be reinstalled with that host.

## Triangular hull

Read SA20210516PDF_ADV4.pdf page 47 (printed page 22). Triangle Hull is a construction toggle, not a SIC. Placement infers orientation from the two neighboring normal hull squares and previews legal locations. Both straight sides require normal hull; the outside of the diagonal must remain clear. Invalid support removal and equipment overlap are rejected, including on the server.

Each triangle costs 300 credits and adds one Hull HP. It is excluded from normal hull size, HSM, scale and thrust calculations. It cannot hold crew, equipment or a station. Click an existing triangle in Triangle Hull mode to remove it and receive 300 credits on confirmation. Shapes persist through saves, reloads and construction-zone resizing and render through the shared ship/Combat/print map code. Multiple Floors and Angled/Offset Squares were not added.

## Decisions made without another question

- Gym exercise records recreation/training but grants no invented automatic attribute or skill award.
- The Lab’s science/research bonus applies to Research, Science/Physics and Astronomy while physically in its operational room. The GM still decides discoveries; the app does not invent findings.
- The Lab stores existing minerals through explicit transfers rather than creating a second copy of ship inventory.
- One Power Core Damper is effective per Engine. The builder prevents buying a second for the same Engine.
- Fortifications remain associated with the same host, including when stored. A stored add-on is reinstalled with its original host.
- Passive add-ons and the Scramble Box do not receive invented console stations. Gym and Lab consoles use the existing crew-room framework and normal physical access checks.

## Verification

The complete automated suite passed: **462 tests**. After strengthening the exact damage/clearance examples, the nine focused SIC/persistence checks also passed. Logs are in test-artifacts/september21-unit-tests.txt and test-artifacts/september21-final-focused.txt.

Checks included all four triangle orientations, structural rejection, non-walkability, size/HP separation, host-specific fortifications, actual weapon damage, actual engine spacing, Scramble Box integration in the normal Lock-On roll, mineral capacity and retry protection, unauthorized-save rejection, and save/restart persistence with existing hull damage preserved. **14 damage against threshold 6 produces two impairment points.** Fortifying that threshold to 8 reduces the same hit to one point.

Manual browser interaction in the local in-app browser verified:

- An empty Wayfinder corner converted to an automatically oriented triangle; the net 700-credit refund, separate 300-credit triangle removal refund, and reload persistence.
- Fortification purchase prices of 500 then 1,000 for Life Support; its displayed threshold increased from 18 to 20. Holographic Projector and Damper purchases also confirmed successfully.
- Fresh-campaign PC access after restarting the test server. Science Lab stored 10 Iron, returned 3, and saved a shared note; server records held 7 in the Lab and 18 in ship stores.
- Pointer-only movement preview, selection locking, walking through doorways, and the colored humanoid walking figure. Nova walked into the Gym and completed an endurance workout with a saved status message.
- Changing Nova from magenta to amber updated her ship marker and walking figure. The Combat interior and enlarged map retained the amber humanoid through live refreshes and High Resolution toggling.
- A Navigate roll used the existing physical dice animation and returned 11 from top dice 5+4 plus the Projector’s +2, with the bonus named in the result.

Two integration issues were found and corrected during verification: the new room controls needed the shared out-of-combat console permission marker, and triangle validation needed to run in the server’s construction-validation entry point. The focused tests cover the latter. Browser console checks showed no application errors.

This was focused verification, not a complete replay of every historical browser playtest. The print view uses the verified shared triangle renderer but physical/PDF print output was not separately exercised. The Lab bonus, Damper spacing and Scramble penalty have automated rule coverage; every possible ship arrangement was not played manually.
