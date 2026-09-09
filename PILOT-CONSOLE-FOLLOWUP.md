# Pilot Console Follow-Up

## Turn Alerts Follow-Up (pilot-console-3)

- Removed normal Station and legacy map Enter Station controls. Movement confirmation still seats the character at a station. The old shared menu's vehicle operations remain as a contextual Vehicle button; no free-text SIC station option. Server rejects manual Station actions without consuming a turn. Validated legacy enterStation API remains compatible, but is no longer exposed as a UI shortcut.
- Full/compact consoles show a prominent turn banner in the pilot's ATB color. A long, left-anchored command bar shrinks from its right edge using server command remaining/total, freezes when paused, empties during input/standby and marks low time. Numeric countdown removed from the console header, not from GM oversight elsewhere.
- Turn sounds use the existing audio system and respect the existing mute preference. Console sound icon can enable/mute them; outer-document pointer/keyboard gestures resume the combat frame's audio context. Turn identity includes turnSerial, avoiding missed consecutive turns and repeated redraw cues. Enabling audio during a turn plays only one cue.
- Decorative waveform below AU, calibration traces around the Tactical Rings and rotating vector array beneath Leave Console. No gameplay values are fabricated; these graphics are aria-hidden, noninteractive, and disabled by reduced motion.
- Verification: 82 tests; repeated twelve-order mouse suite; added real AudioContext/tone scheduling checks, one cue per turn, mute silence, draining/frozen command bar, input-state banner and reduced-motion checks. Desktop screenshots retain 1366x768 and 1920x1080 coverage. This is not a physical-speaker listening test.

## Behavior

- Stationed NPCs default to ordinary GM controls. Stationed PCs default to the full console. GM views never auto-open a PC console; manual Console View remains available.
- Ordinary controls: Move Ship, Leave Console, Console View. Move Ship opens a compact planner sharing full-console selection/submission. Leave starts character movement; cancel retains the station.
- Combat View preference persists for the station visit, across turns. Departure clears it. Console stays open through input/intervening turns; actions remain turn-gated. Hidden campaign tabs do not auto-open it.
- Six factors: Environment (Situation), Uplink (Execution), Drive Grade (Quality), Response (Performance), Throughput (Efficiency), Helm Sync (Ingenuity). Tooltips/accessibility retain rule names. Delay math is unchanged.
- Live observation-only rings reuse the shared renderer. Styling is scoped to the outer-document console and exposes no GM action buttons.
- Scan sweep, AU glow, input data flow and lock pulse respect reduced motion. Existing console artwork is retained without extra image payload.
- Main starmap overlaps the inner ends of the first ship headers. Title padding prevents overlap; single-ship/narrow views retain ordinary flow.

## Movement Reliability

Click locks the destination. Submission snapshots destination/boosts before disabling controls. Validation and explanatory availability feedback stay inside the console. Unfinished timed actions block orders consistently with the server. Unchanged factor and destination markup survive redraws. Console state observation runs only after accepting a current revision, so stale packets cannot clear the player's view preference.

The original already-seated tests passed before these changes; they did not reproduce the historical hosted Nova failure. Do not claim a proven historical root cause. This pass extends checks to actual station arrival, both planners, separate browser contexts, request latency and held/repeated clicks. User retesting on Render remains important.

## Demo Ships

Each new Explore ship has Power Hybrid Engine 2 (9 EN / 2 AU), Cockpit 1, Exhaust Thruster 1 and Ionic Pulse Thruster 1. Tests check exterior mounting, cockpit access, positive unboosted movement and Ionic boost capacity. Exhaust boosting needs more AU than this engine stores; feedback explains insufficient reserves.

Reset Room or reopen Explore for new fixtures. Do not overwrite personal ships or an existing demo's manual edits.

## Verification

- Full suite: 81 tests, including expanded HTTP demo checks.
- Optional Edge script: fresh isolated campaign and separate GM/player contexts; three NPC and three PC orders; actual Explore cockpit arrival followed by three Nova and three NPC orders. Both planners, persistence, live rings, AU, Leave cancel/completion, 1366/1920 desktop screenshots, reduced motion and parent stream reuse.
- Pointer crosses map to confirmation, holds across redraws, encounters 700ms request latency, and rapid repeat clicks must send only one order.
- Temporary server/browser cleanup is in finally. Screenshots are ignored under `test-artifacts/cockpit`.
- Not exhaustive gameplay, full character-creation UI, mobile, PostgreSQL or hosted gameplay coverage. GitHub push and hosted deployment are separate verification steps.

## Files

`ship-navigation-ui.js` / `.css`: full/compact views, defaults, local preference, feedback, animation. `combat-actions.js`: menu. `app.js`: read-only shared rings. `space-map.css`: inset layout. `campaign-api.js`: new demo ships. Changed browser assets use `pilot-console-2` cache keys. Rules, print masters and Gold Standard are unchanged.
