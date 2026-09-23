# Planetary Cleanser and exploration — local pass, September 21, 2026

Implemented locally. No commit, GitHub push, deployment, or personal campaign changes.

## What is available

- Prepare Combat accepts a PC ship with no NPCs or NPC ships. A **Begin Exploration?** confirmation explains the choice. ATBs, active game time, movement, equipment and mineral collection continue normally. The existing victory acknowledgment keeps this same encounter running until the GM ends it.
- **Planet (7 hexes)** appears beside Minerals and Asteroid in the GM's Space Objects editor. Name the planet, place it, and receive one persistent random ocean/desert/ice/volcanic appearance. Ships can pass through its area and render above it and its debris.
- Planetary Cleanser B-110 is purchasable, with generated card art and separate exterior-barrel/interior-room art. Price 500,000; EN 50; security 5; threshold 23; 3x6 EXT plus 3x3 EDG; Aethion / three weeks crafting. The console works locally or remotely through a Bridge.
- Select an intact GM-placed planet. Charging consumes one Dark Phazon, reserves the whole AU supply, sets Masking to zero, and takes 120 active seconds (ten 12-second ship rounds). Pauses stop the charge. Loss of the operational weapon/power/target interrupts it. Successful firing starts a two-hour game-time cooldown.
- Every connected GM/PC receives the same roughly 20-second beam, rupture, shockwave and debris sequence. New original charge and firing audio follows existing mute settings. Existing physical dice rendering supplies the illustrative D12 animation; the large result is explicitly labeled simulated. The server owns one result and automatically releases the cinematic pause.
- Destroyed planets remain as dark debris. Passing ships are not damaged. Planets/debris do not appear as collectible cargo.
- New generated mineral and asteroid sprites replace their basic map symbols. Final map outputs: planets and debris **256x256**, minerals **64x64**, asteroids **96x96**. All seven map images total **114,638 bytes**; generation masters remain outside the served application assets.
- Fresh Explore Features includes **Last Word — Planetary Cleanser, Dark Phazon**, a legal 198-Hull ship with positive EN, usable thrust and three charges' worth of mineral. Assign Nova to it before preparation; existing memberships and personal ships are preserved.

## Decisions made without another question

- The illustrative 20,000D12 result is randomized from 100,000 through 160,000, with three visible D12s using the existing dice renderer. It is a cinematic number, not a rolled total or ordinary ship damage.
- Dark Phazon is spent when charging starts; aborting or interruption loses charge progress without a mineral refund. Cooldown begins at firing and uses active game time / the existing GM time passage system.
- Existing mineral stores spell the item “Dark Phaeon.” Both spellings are accepted; the catalog and old inventory are not renamed.
- No range restriction, trajectory collision or extra planet HP was introduced. Only intact, GM-placed planets can be selected. They remain pass-through scenery.
- The seven-hex footprint is a circular sprite approximately three hexes across, centered on its chosen hex; no extra movement obstacles are created.
- No-enemy sessions retain the familiar Combat interface and its turn/clock controls, with the exploration warning at preparation.

## Verification

- Full regression suite: **514 passed, zero failed**. After the final privacy/confirmation refinements, **17 focused tests passed**, including the additional exploration-cancel test.
- Tested charge receipt retries, one-time mineral spending, AU reservation, zero Masking, turn/power/target rejection, interruption, abort, cooldown, legal split placement, usable preset propulsion, compact assets and map layer order.
- Isolated HTTP checks verified solo-PC ATB advancement, hard-pause charging, unauthorized-action rejection, shared results, cinematic ATB freeze, automatic completion, no ship damage, preserved victory exploration, and restart persistence.
- Browser: assigned Nova, prepared a ship without enemies, accepted the exploration warning, engaged time, moved to a Bridge station, switched to the Cleanser console, selected Vesper and started charging. Visually checked the console, beam/rupture effects, persistent debris and compact mineral/asteroid map markers. No captured browser script errors.
- Browser limitation: the existing native Hold confirmation blocked automation in the first test tab. A separate isolated fixture was used to inspect firing; the full 120-second Hold workflow and audible quality were not manually confirmed end to end. Dice reuse is verified by integration with the established renderer; a settled-dice screenshot was not captured.
- Both personal campaign files retained their original SHA-256 hashes. Test campaigns used separate temporary storage. Temporary browser tabs closed.

## Try it

Restart Spaceship Architect using its existing launcher (port **8790**) and refresh the browser. Open a fresh Explore Features session; assign Nova to **Last Word**, select it in Prepare Combat, add/name/place a Planet, then Begin Combat and accept Begin Exploration. Engage the clock, station Nova on the Bridge or Cleanser, open its console and start charging. Use Hold to let active time pass. End Combat remains the way to end exploration.
