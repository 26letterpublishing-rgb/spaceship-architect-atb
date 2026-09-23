# Local fleet, artwork and atmosphere pass — September 21, 2026

Completed locally under Jason's authorization for all three passes. No commit, push or deployment. Existing personal campaigns were not edited.

## Delivered

- Cockpit 1 and 2 precede Bridge 1 onward in the purchase picker. Warp Drive X is last. EW-FTL Drive is with Warp Drives; Cloaking Device is with Darkveil.
- EW-FTL B-48: 850,000 credits, 12 EN, 4x4, security 5, threshold 16. Activation consumes all current AU and two Grade S fuel cells, takes 120 active seconds, then instantly completes the chosen light-year distance. Impairment requires a confirmed D8 through the existing physical dice interface; a result at or below impairment points destroys the ship.
- Cloaking B-61: 185,000 credits, 5 EN, 2x2, security 4, threshold 20, Sensor Systems. Costs 12 AU for +25 Masking; drops shields and blocks weapon firing and other AU spending. Can be switched off. Impairment or loss of adequate power disables it. Receipt retries cannot double-charge.
- 23 generated bitmap assets, including five ships, EW-FTL/Cloak rooms, triangular hull, and replacements for earlier utility/probe placeholders. Preserved existing generated artwork and zero-footprint (+) attachment rules. The manifest records prompts and original image paths in scripts/generated-fleet-atmosphere-art.json. SVG atlases that wrap generated raster art remain in use.
- Purchase-art hover shows the actual floorplan to its left. Attachments without floorplans do not invent new footprints.
- Five map silhouettes use page 55's normal-hull Scale Ranks: 4–26, 27–50, 51–100, 101–200, 201+. Triangles do not affect rank. Icons face current/last movement, show powered-only exhaust, running lights and colored glow. GM color controls are available in preparation and both normal/enlarged combat maps.
- In response to the size feedback: ranks 1–4 have a maximum dimension of 128 pixels; rank 5 is 256 pixels. All five WebP files total **23,118 bytes**, down from 297,796 bytes. Original generated images remain separate. The conversion script preserves these smaller limits.
- Occupied Docking Bays show the same ship sprites. Capacity remains four ships with combined normal Hull at most half the carrier's Hull. Capturing a bay (or its Bridge) permits opening the exterior door and forced docking on the same hex; capacity rules remain enforced.
- Room atmosphere persists and follows door connections. An open unshielded bay vents connected open rooms; closed doors isolate them. Operational Cockpits protect their own sealed room. An installed bay doorway shield prevents venting.
- Low resolution displays a small O2 counter per SIC room or connected hallway. High resolution uses progressive fog below crew and interaction controls. Hull view hides room air overlays.
- Room O2 goes from 100% to 10% over 165 active seconds without supply. At 10%, the existing Health + Endurance roll is required immediately; there is no additional old breath reserve. Existing subsequent 16-second checks, difficulty increases and HP loss remain. GM Pass Time stops at the first required oxygen check, with a visible explanation and receipt-safe retry.

## Decisions made without further questions

- Chose 60 seconds to refill from 10% to 100% after effective air supply returns. A still-open vent overrides Life Support. Connected compartments mix by normal hull-square volume when doors connect them; this is game logic, not a physical airflow simulation.
- Cockpit local air does not supply the rest of a ship. Opening it into unsupported areas allows mixing and loss of protection while connected.
- EW-FTL's ten ship rounds remain a fixed 120 seconds; normal Warp Drive Engineering station discounts do not shorten it. Requires at least one available AU, consumes AU/fuel at activation, and does not refund cancellation. The impairment D8 occurs before activation is committed; a fatal result is immediate.
- Default glow colors are stable choices from a small palette until the GM chooses a color. Maps without a travel history initially face north. Rank 5 gets the larger 256-pixel asset for its footprint spanning adjacent hexes.
- Refilling cancels the immediate suffocation sequence in the supplied compartment; unsafe compartments remain affected. Medbay treatment requires room O2 above 10%, preventing healing loops in an airless room.
- Kept large generated masters outside the served app assets. The manifest retains their locations for future printing or edits.

## Verification and limits

- Full automated suite: **500 passed, zero failed** (test-artifacts/fleet-complete-tests.txt). Additional focused checks covered room isolation/refill, first-roll timing, forced docking through captured access, cloak costs/power loss, EW fuel/timing/fatal D8, restore persistence, and GM-only colors.
- All application JavaScript passed syntax checking. Whitespace validation passed.
- Mouse-tested purchase family order, the left-side floorplan hover, new cards, preparation color changes, Begin/Resume Combat, regular and enlarged map color editors, PC cloak on/off, bay exterior door vent feedback, low-resolution oxygen numbers and high-resolution fog. The smaller icons were visually checked on the actual enlarged map.
- The browser automation could not accept the native EW-FTL activation confirmation. Route calculation was verified, and normal/fatal EW-FTL activation was covered by automated checks; the complete impaired-drive D8 animation was not manually completed in this pass. It uses the existing character dice iframe and result handshake, not a new roller.
- Tests ran against disposable fixtures and an isolated port 8791 server. No long-duration multi-client playtest or production deployment was performed.
- Both real campaign files retain their original SHA-256 hashes: app/data/campaigns.json 7B679E7F05595DFFB15F8ED08CC82DCD4961505088379330B38742D5D017E190; SA-ATB Local Development Files/campaign-data/campaigns.json B4521B48265B48345CEC463C2085F906C6F23A9A451EE2CCDBC34D73C9A387A6.

Restart the normal Spaceship Architect server on port 8790 and refresh the browser to load backend changes. Vector's ports were left alone.
