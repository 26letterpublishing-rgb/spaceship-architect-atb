# Local incoming-lock, Life Support and Repair Drone pass

September 15, 2026. Jason authorized `#local`: local implementation and testing only. No commit, push, deployment, Gold Standard refresh, or personal campaign edits. Preserve the earlier uncommitted work.

## Implemented behavior

- A red `Enemy Locked On` banner stays at the top of the GM/player viewport while another ship has a lock on an owned/occupied ship. It follows tab and console changes, clears when the last lock disappears, and does not reveal the attacker's identity. Fullscreen console controls remain below it.
- Installed Life Support impairment now shuts off effective oxygen recycling and starts the existing oxygen system. The GM sees NPC timers; players receive only their own oxygen information. The existing rules remain 165 seconds of grace, then `(Health D10 count + floor(Endurance)) * 32` breath seconds, manual checks starting at difficulty 14, and the established 16-second escalation/damage cadence. Combat pauses freeze the countdown. Restoring an operational Life Support system clears the hazard without healing.
- Repair Drone 1, printed Series B card B-54, is purchasable and placeable as a 1x1 EDG system. Price 750, EN 2, Security 2, Engineering, Argol/6 hours, threshold 14; one impairment destroys it. The catalog uses generated robot and empty charging-bay artwork.
- A powered drone deploys automatically when its owner's Hull is damaged. Jason's digital timing override is Slow base 6 with Quality 1. The shared delayed-action calculation gives rate 8 and a repair every **12.5 active seconds**. Ship rounds remain 12 seconds; the new drone cadence is not a change to ship-round duration.
- Each repair automatically rolls 1D4, heals up to maximum Hull, and shows a small animated D4 result without blocking clicks or pausing other activity. All other established manual dice remain manual. At full Hull the drone returns to its bay. Its exterior animation follows the ship-map zoom, and a reduced-motion alternative is available.
- Deployed drones are independent sensor/lock/weapon targets, with robot markers beside their host ship on the starmap. Defense is 12, manual fire retains range penalties, and a valid lock skips accuracy except where a weapon already requires manual accuracy. Jason explicitly resolved the printed rules' tie ambiguity: **meeting Defense hits**. This applies to shared ship weapon resolution, including Rail; tests that deliberately exercise a miss now use scores below Defense.
- Bridge operators can spend one ATB turn to send the drone to another detected, damaged ship sharing its position. Unavailable repair choices are hidden. Commands use receipts so retries cannot restart repair progress or consume another turn. Separation sends the drone home; it resumes repairing its owner if needed. Allied ships can use this same path when added to the app.
- Drone state survives ship editing, encounter preparation, saves, backup/restore and restart. Private drone state is excluded from unrelated player projections. Frequent repair progress does not force full campaign revisions.
- A queued save from a superseded room can no longer overwrite a restored encounter. Restore cancels the old timer, and save callbacks verify that they still belong to the live room.

## Preservation and checks

The new browser playtest uses independent GM/player browsers and a disposable campaign. It covers NPC oxygen impairment/privacy/pause, the warning across views and native consoles, a natural repair interval and nonblocking D4, exterior placement at the current zoom, the targetable starmap marker, a same-position repair order, separation, market artwork/purchase, reload and an actual authenticated server restart without rerolling.

Final automated suite: **385 tests passed**. Root JavaScript and the new browser script passed 95 syntax checks. Windows-aware whitespace validation passed. The frozen Gold Standard structural comparison also passed (no missing files or unexpectedly removed HTML controls); it was read only. All disposable test servers and browsers were confirmed closed.

Existing browser gates passed: held-turn (three viewport sizes), weapon-clock, ship-workflows, missiles, mouse-audit, field-utilities, crew-rooms and live-hacking. The old oxygen browser test was updated to find Console View in the embedded ship sheet. Its retest also exposed a shared console section rule overriding the oxygen popover's fixed positioning; popovers are now excluded from that rule. The oxygen retest passed: actual switch/grace/breath timers above the console, manual rolls, cancel/reopen, GM takeover, oxygen restoration, all three Nut textures, and retained click-to-eat feedback.

The two previously discussed laser-explosion/combat-recovery browser failures remain deferred at Jason's request. They were not used as acceptance gates for this pass. This report does not claim every historical workflow was replayed.

Logs and reviewed screenshots are in ignored `test-artifacts/drone-alerts`, `test-artifacts/drone-alerts-final.log`, `test-artifacts/drone-suite-final.log`, and `test-artifacts/drone-regression-*.log`. All test servers use temporary data directories and close on completion.

## Artwork

Generated with the built-in image-generation tool, then saved as 512-pixel WebP game assets. Separate originals remain under the Codex generated-images directory.

- `repair-drone-1-sprite.webp`: transparent, orthographic overhead compact hull-repair robot; cream and teal industrial body, two treads, two articulated tool arms and a cyan lamp; readable at small icon size; no text or scenery.
- `repair-drone-1-floorplan.webp`: square orthographic overhead empty charging bay; upper exterior hatch, lower crew access, central tread charging cradle, charcoal/cream/teal machinery and caution strips; no robot or text; clear margins for a 1x1 floorplan tile.

These are the final generation briefs. The sprite is used for the SIC card, starmap marker, console and exterior repair animation; the bay asset is used for the installed floorplan.
