# Shield recovery SICs — local implementation

Implemented B-38 Burst Shield Reactivator and B-39 Emergency Shield Recharger after reading their original JPG cards. Both are Shield (+) attachments with no independent room/floorplan. Both have 0 EN, Security 3 and no damage threshold. Each shield accepts one of each; the pair can occupy the same host square with other (+) upgrades.

- Burst: 2,000 credits; Drakkonite / 10 hours crafting. Automatic collapsed-field recovery after 120 funded active seconds, returning at ceil(maximum Shield HP / 3). Prepays 2 AU for each 12 seconds. Insufficient AU pauses recovery.
- Emergency: 3,000 credits; Phazon / 16 hours crafting. Recovery takes 48 active seconds and returns at 1 HP. Diverts all available AU, including regeneration, until complete. Existing command reservations are retained. Burst can use the diverted supply and upgrades the returning HP to one third.
- Together: 48 funded seconds, one-third HP. Timers follow the ATB clock, not wall time. Powered-down, impaired, gravity-field-suppressed and warping hosts suspend recovery. Cleanser charging has priority. Turning off the host releases the Emergency reservation.
- Existing local manual restabilization keeps its full-HP behavior and takes priority over automatic recovery. This deliberate adaptation avoids changing existing shield repair rules while adding the source-card automatic restart behavior. Automatic recovery starts when the installed host shield collapses; no additional operator is needed.
- Each layer tracks its own recovery. The original rule that shield overflow never reaches the next layer or Hull remains unchanged.
- Shield console shows recovery state, remaining time, returning HP, progress and AU diversion. Purchase cards explain the adapted behavior and support the existing blueprint/fabrication workflow.
- Hothead and Sunburn in a fresh Explore Features session include both add-ons.

## Artwork
Two individual AI-generated equipment illustrations, reduced to 768×512 WebP: burst-shield-reactivator.webp (119,536 bytes), emergency-shield-recharger.webp (108,290 bytes). Original PNG masters retained under C:/Users/zombi/.codex/generated_images/01a0a7de-5eb2-78d1-846e-920d46b20f50/ (exec-5d61201f-b9b7-4c60-9126-44663320e286.png and exec-8e6a4000-6ec6-4188-9197-00290a58fc79.png). No invented floorplan for these (+) cards.

## Verification
Full suite: 743 tests passed. Seven new mechanics tests cover source metadata/crafting, 120-second Burst and AU cost, 48-second Emergency/all-AU diversion, combined behavior, starvation/pause/offline/save recovery, duplicate prevention, and large-step versus fine-step equivalence with a second shield layer untouched.

Browser on isolated port 8792: purchased Shield 1, bought its hull square, installed it, purchased and attached both upgrades to the same shield, checked duplicate rejection, refreshed and inspected both art/card previews. Missing-host purchase correctly gives an explanatory message. Screenshot: test-artifacts/emergency-shield-card.png. Combat recovery timings were verified by automated mechanics tests, not by waiting through a live multiplayer battle.

Existing personal campaign data and normal port 8790 server were not modified. Restart the normal local server and refresh clients to load the new server-side mechanics. No commit, push or deployment.
