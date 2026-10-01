# Local Transporter and intruder pass — September 28, 2026

## Delivered
- Transporter SIC B-19: 20,000 credits, 15 EN, Security 4, threshold 18, 3×3 floorplan, Engineering/Carmot/one week. Includes newly AI-generated card art and floorplan, a usable station, purchase information, normal power/hacking controls, and a passenger/destination console.
- Explore Features adds Threshold Voyager and Silent Arrival with Transporter and Security Camera equipment.
- Up to five living passengers inside the Transporter can board another ship within three units. Both ships must have shields down; the destination must be locked onto and have Systems Analysis completed. The operator chooses an arrival square. Planet surfaces are also valid destinations.
- Hostile NPC locations aboard PC-controlled ships are removed from PC/spectator snapshots until a friendly conscious occupant shares their room or an operational Security Camera reveals them. Friendly NPC crew remain visible. The GM retains all locations. Discovered intruders trigger the red “Intruders detected!” banner.
- Personal firearm/melee attack lists include accessible doors. A damage result below 10 does nothing; each result of 10 or more causes exactly one breach point. Three qualifying hits break the door open. Broken doors cannot be closed until repaired. Completing System Repairs and Diagnostics repairs all doors.
- Door attacks use the existing damage roller and its animation. Melee requires adjacency; firearm range is measured from the character to the door.
- Door damage, Transporter state and intruder discovery persist in campaign/encounter data. Transported PCs retain their own marker and do not acquire duplicate home-ship markers.

## Decisions made
- Transporting consumes one turn with a 12-active-second sequence, no additional AU cost. Range, shields, power, station access, lock and analysis are checked again at completion. Invalid conditions cancel without relocating anyone.
- The fifty included reusable transponders are assigned automatically to passengers. A passenger reusing that Transporter keeps their assignment. No manual transponder inventory screen was added.
- Each impairment point gives each passenger a 10% fatality risk, capped at 100%. The standard roller supplies one D10 per passenger; each individual result at or below the impairment count is fatal. Its combined score is ignored. No invisible death roll is generated.
- Arrival uses available non-station positions in the selected room, with existing two-character mesh capacity. Transport does not alter permanent crew assignments.
- Conscious, stationary passengers only; no Ship AI or carried patients. Transport requires an active exploration/combat encounter. There is no remote beam-back from arbitrary rooms: departing passengers must be in a Transporter room.
- Planet arrivals use the existing surface location system, not a new planetary map. Probe-linked remote Transporter functions and Transport Scrambler remain separate future work.
- Intruder awareness persists after visual contact is lost, while known intruders remain aboard. Their exact location hides again unless a camera or friendly occupant can see them.
- Stationary doors do not roll defense or require an accuracy roll; roll ordinary weapon damage. Enormous hits still cause only one breach point. Diagnostics uses its existing completion time and leaves repaired doors in their current open state.

## Verification
- Full existing and new suite: 703 tests passed. After the final visibility refinement, all 14 focused Transporter/intruder/HTTP tests passed (including the newly added spectator/other-PC privacy case).
- HTTP regression exercised authenticated PC versus GM views, room-entry discovery, normal personal attack resolution, four door damage submissions (9, 10, 14, 100), and damaged-door restore.
- Mouse/browser playtest on an isolated server: opened the PC Transporter console, selected Nova, energized, and verified her arrival aboard Red Horizon after 12 active seconds. Verified that an unseen Space Slug was absent, and that entering Nova’s room revealed its marker and banner. Selected a door through Fire Gun, used Roll for Me, watched the standard animation, and verified 9 damage yielded 0/3 breach points.
- Automated checks additionally cover shields/range/lock/analysis rejection, interrupted transport, individual impairment death dice, planet destinations, transponder reuse, camera disable, Diagnostics repairs, duplicate commands and PC self-visibility after boarding.
- Visual evidence: test-artifacts/transporter-pass/console.png and intruder.png. Source card inspection: transporter-card.png. Asset provenance: ASSETS-TRANSPORTER-20260928.json.

## Local delivery
No commit, push or deployment. Personal campaigns, the existing server on 8790, Vector and Gold Standard were left untouched. Restart the Spaceship Architect server and refresh its GM/PC tabs to load the new server code. Temporary test tabs, authentication harnesses and the isolated 8792 server were removed after testing.
