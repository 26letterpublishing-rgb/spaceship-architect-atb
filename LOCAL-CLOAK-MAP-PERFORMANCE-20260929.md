# Cloak, starmap and performance corrections — September 29, 2026

Authorized by the user's latest `#local`. Local changes only; no commit, push or deployment.

## Changes

- Restored the existing engine-charge sound during ship movement input through the shared console sound controller. It respects pause, mute, hidden pages and disconnection, and does not start duplicate sound voices.
- Cloak activation/deactivation in combat clears the operator's ATB. Excess ATB cannot produce an immediate second turn. The station explicitly confirms that the turn was used; Deactivate and Hold are unavailable until appropriate. Retries retain receipt deduplication and do not charge AU twice. Outside-combat operation is unchanged.
- Detected enemy contacts now carry their cloak appearance into the player-filtered map without disclosing the enemy inventory. A successful scan leaves the cloak enabled. Maps update between ordinary, unknown and cloaked appearances without continually rebuilding the cloak graphic.
- Removed “simulated” from the Cleanser damage prompt, result labels and cinematic damage text. Internal damage generation and the existing dice animation remain unchanged.
- Added stable identities for ship markers, vessel artwork, navigation routes, probe routes and ambient stars during live DOM updates. Previously anonymous SVG groups could be matched to another ship and then animated between unrelated positions. This addresses the kind of repeated jumping visible in the supplied recording.
- Skip unchanged combat-map patches and unchanged shield-condition markup. Label measurement caching now distinguishes vertical offsets between map contexts.
- Reuse station floorplan geometry until the layout/inventory changes; preserve live item references and invalidate on edits. Utility commands calculate console access once instead of repeating it for each utility type.
- Stop shared console updates and sound safely when the room disappears, and close navigation/utility consoles without repeatedly throwing errors.

## Evidence and limits

- Reviewed the supplied 3.93-second recording using extracted frames. Menace visibly jumps between positions while other map elements remain mostly stationary.
- Before the ATB reinforcement, a normal 100-ATB activation already consumed the turn in the isolated browser. The reported immediate extra turn was not reproduced at that value. Regression tests now cover both 100 and 205 ATB, duplicate requests and out-of-turn rejection.
- Automated Scan Hex test submits a sufficient result, detects the cloaked target, verifies the cloak stays active and checks the player projection retains the cloak flag.
- Focused Menace benchmark: 1,000 console-access queries decreased from approximately 174.6 ms to 22.5 ms. This is a component benchmark, not a whole-application speed claim.
- Mouse-tested an isolated Explore campaign on port 8792 with Cleaning Lady, Menace, a black hole, asteroid and minerals. Activated cloak, observed AU 60 → 48, turn-used status and disabled Deactivate; returned to combat and opened/closed the enlarged map. Menace remained a faint cloaked outline at the same coordinates across subsequent updates. No browser errors were recorded in that final session.
- Movement sound selection, single-voice behavior, pause, mute and disconnect were exercised with a runtime test. Audio was not auditioned, and this pass does not claim an end-to-end browser damage-roll or successful-scan playthrough.
- Screenshots: `test-artifacts/cloak-map-pass/cloak-turn.png` and `cloaked-map.png`. Full test output: `test-artifacts/cloak-map-pass/full-suite.log`.
- Runtime syntax and CRLF-aware whitespace checks passed. Final suite result is recorded in the current handoff.

## To use

Restart the normal Spaceship Architect local server and refresh GM/PC pages. Existing campaigns can use these fixes; no new campaign is required. Personal campaigns, prior working changes, Vector and Gold Standard were preserved. The temporary browser, launcher and isolated test server are cleaned up separately from the normal server.
