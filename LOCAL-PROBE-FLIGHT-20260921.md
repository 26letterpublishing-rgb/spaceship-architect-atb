# Local probe flight controls — September 21, 2026

Implemented locally after Jason's #local authorization. No commit, push or deployment.

## Behavior

- Launch Probe and Move Probe start a destination plot. The line follows the pointer until a legal hex is clicked, then remains fixed for Confirm Launch / Confirm Move. Choose Another Hex and Cancel Plot are available; opening the plot never sends a command or consumes a turn.
- The blue boundary shows the owner's exact hex-based sensor range. Invalid destinations show a reason and cannot be confirmed. The server validates coordinates and range both when accepting the order and when its existing input delay finishes.
- Submitted routes remain visible during input and flight, including on the shared/enlarged starmap. Completed routes disappear. Enemy projections do not reveal private probe destinations.
- Retract Probe follows the owning ship's current location and docks upon arrival, even if the direct sensor link has been lost. Existing station, power, turn and command-delay requirements remain.
- A deployed probe outside the owner's sensor range automatically flies to the nearest legal integer hex in that range. It uses its normal grade speed and active ATB time, remains targetable, and survives room persistence. The route updates as the owner moves. It stops there instead of continuing an obsolete mission.
- The GM header shortcut is now Prepare Combat and hides while preparation is already displayed. The actual Begin Combat button and existing End Combat behavior remain.

## Decisions made without additional questions

- Destination selection requires a confirmation, consistent with existing movement. Coordinate entry remains available as an alternative to the mouse.
- Retraction and automatic range recovery disable an active/arming Warp Inhibitor and detach an active Hacking Bug without additional AU spending. Otherwise the inhibitor's stationary restriction would prevent the requested automatic return. Ordinary Move/Attach still require manually deactivating the inhibitor first.
- Equal shortest hex routes use the shorter geometric path as a stable tie-breaker. Automatic recovery requires a surviving operational probe, a ship in normal space, and a positive sensor range. With no working sensor range there is no valid linked hex to choose; Retract is available through an operational console when ship power permits.
- Input is cancelled with a report if the selected destination leaves range before input completes; it is not silently replaced with another destination.

## Verification

- Full automated suite: 488 tests passed. Final focused probe/HTTP/header checks: 19 passed. Syntax and whitespace checks passed.
- Mouse-tested through the existing PC console in a disposable local campaign: Launch opens a blank plot; pointer changes (5,0) to (8,-2); clicking fixes the route; further pointer movement leaves it fixed; an outside hex (25,0) is rejected; confirmed launch flies to (5,0); Move flies to (8,-2); Retract docks at the owner.
- Live recovery check: moved the disposable owner to (-15,0), leaving its holding probe at (5,0). The probe visibly entered recovery, displayed its route, flew to (-3,0), regained its direct link and removed the completed route.
- Mouse-tested GM Prepare Combat shortcut, its disappearance on preparation, the single remaining Begin Combat button, and its reappearance on Script. End Combat visibility is covered by an actual-function regression test.
- Existing normal dice scan authorization, pause, restart and foreign-command tests pass. No dice system changes.
- Both personal campaign files matched their previous SHA-256 hashes. Test campaign data used an isolated temporary directory and port 8791. Temporary tabs and server closed after verification.
- Test log: test-artifacts/probe-flight-full-tests.txt.

## Using the update

Restart Spaceship Architect with its normal local launcher (port 8790), then refresh the GM and PC pages. Existing campaigns can use the changed controls; a fresh Explore session is unnecessary.
