# Local probe SIC pass — September 21, 2026

Jason authorized: “create the Probe Launcher SIC and all the probe SICs,” `#local no questions`. Implemented locally; no commit, push, deployment, or Gold Standard changes.

## Added cards and equipment

Nine cards are available in the existing shipyard, with new SVG artwork:

- Probe Launcher A-71: 4,700 credits, EN 2, Security 3, threshold 20, 2x2 EDG and one station. Four assigned probes maximum, including deployed probes. One launch per 12 active ATB seconds. Each new launcher impairment destroys one docked probe.
- Probe 1–5: A-72/73/74 and B-52/53. Prices 100/250/450/700/1,000; thresholds 10/15/20/25/30; Masking and Defense 10/12/14/16/18; movement 4/6/8/10/12 Units per ship round; sensor pools 3D8/3D10/4D10/3D12/4D12. One impairment destroys a probe. They attach to a launcher without occupying hull squares.
- Shield Breacher B-40: 900 credits, EN 0, Security 3, Probe (+).
- Hacking Bug B-51: 275 credits, EN 1, Security 3, Probe (+), 1 AU per active ship round.
- Warp Bubble Inhibitor B-120: 1,750 credits, no EN/AU charge, Probe (+), one-round activation and two-Unit radius affecting all ships.

Probe attachments belong to an individual probe, may share its square, and do not consume launcher slots. Construction validates the complete Launcher → Probe → attachment chain. A stored probe cannot bypass the four-slot limit when reinstalled. Probe destruction destroys its attached equipment too.

## Operation

Use a Probe Launcher station or its remote Bridge console during an encounter. The shared console includes launch, move, scan and recall, a clickable hex plot, direct-link and probe sensor circles, disabled-action explanations, status reports, input progress, Hold and Leave Console. Deployed probes appear as satellite icons on the starmap and can be targeted by the existing lock-on, weapon and missile systems.

Sensor range equals the owner's current sensor range. A deployed probe must remain within that range to relay data or receive new orders; probes cannot relay through one another. An issued route continues if communication is lost. Return orders home toward the moving owner while linked. Scans use the existing physical dice animation, confirmed roll submission, visible difficulty and Sensor Systems skill. Private sensor information remains restricted to the owning crew/GM.

For a Hacking Bug, choose a detected target and use **Attach Bug to Ship**. A shielded target requires a Shield Breacher. Once the probe reaches the hull, **Activate Bug** starts its AU upkeep. Continue through the existing Hacking Module interface; it still requires the normal operator, analyzed target SIC and puzzle. Loss of link, power, host or available AU stops the bug. Recall detaches it.

Activate an inhibitor only after its probe reaches a stationary position. Its twelve-second activation and all flight, breach, cooldown and upkeep clocks use active simulation time. The inhibitor blocks warp activation for enemies, allies and the owner within two Units; it can interrupt an activation already underway. Deactivate it before moving or recalling the probe. A purple field circle is displayed for detected active inhibitors.

Fresh Explore Features sessions have PC and GM presets named **Probe Launcher, Probes 1-5, Probe Attachments, Hacking**. Each includes four loaded probes, Probe 2 in storage, all three attachments on Probe 5, and a Hacking Module. Existing campaigns and original ship designs are preserved.

## Decisions made without asking

- Reused the established Average input base (8), Engineering-to-Ingenuity factors, and +1 Quality per probe grade capped at the existing four-step limit. The local station's existing 10% input reduction applies. This is input time; printed movement, launch cooldown and payload clocks remain separate.
- Recall makes undamaged probes reusable. No extra AU cost is added for ordinary probe orders.
- Interpreted Shield Breacher's “next round” and “following round” as twelve seconds waiting plus twelve seconds breaching after arrival. Moving away from that position restarts the approach. Breaching itself adds no enemy detection alert; normal passive detection still applies.
- Hacking Bugs are explicitly activated after attachment. They charge 1 AU immediately and every twelve active seconds thereafter, stopping when payment fails. Ship AI cannot activate the AU-spending bug.
- An active stationary inhibitor remains active if communication is lost, provided its probe and attachment are still operational. It does not pull ships already traveling in warp back into the encounter.
- Probe commands currently use the encounter starmap/ATB. Free-roaming probes outside an encounter and Transporter delivery of Hacking Bugs are not implemented; Transporter itself is not yet present. Static Shield/Wired Downgrade bypass is recognized by the hacking connection, but those two cards have not been added in this pass.

## Verification

- Full automated suite: **477 passed**, zero failures (`test-artifacts/probes-full-tests-final.txt`).
- Final focused probe, HTTP/restart and Explore checks: **16 passed** after the last preset update.
- Covered four-slot construction, nested attachments, grade metadata, receipt ownership, station access/loss, delayed input, movement and recall, direct-link loss, ordinary scan dice, private projection, Defense ties, threshold destruction, launcher impairments, pause behavior, breach timing, AU upkeep/loss, inhibitor radius including allies, warp rejection and persisted pending rolls.
- Mouse-tested GM shipyard cards; rejected fifth probe; stored one grade and purchased another; confirmed purchase and exact credit debit. Purchased a Hacking Bug onto Probe 1, confirmed the nested attachment, and verified saved data and its 275-credit charge. Stored-probe reinstall correctly refused a full launcher.
- Mouse-tested PC launch, physical 3D D8 scan and confirmation, scan report, recall, map hex selection/out-of-range warning, inhibitor activation, movement restriction and deactivation. No browser console errors in the tested PC and builder tabs.
- Fixed a scout-map/coordinate overlap found during mouse testing. The GM native confirmation initially stalled the browser automation; PC interaction and authenticated HTTP checks covered the live command flow. A later construction rejection came from an oversized test-only replacement engine; correcting that fixture to its original 4x4 footprint allowed confirmation. Neither issue was concealed as a passed check.
- Syntax checks passed for changed runtime files and the required app/character/combat-map entry points. `git -c core.whitespace=cr-at-eol diff --check` passed; Git reports the existing mixed-line-ending normalization warnings.
- Tests used an isolated temporary campaign/server on 8791. Normal campaign files retained their original sizes and modification timestamps. Test-created browser tabs were closed; pre-existing tabs were left alone. The temporary server was stopped.

Restart the normal Spaceship Architect server using **Start Spaceship Architect** to load the backend changes, then refresh the app at `http://127.0.0.1:8790`. Start a fresh Explore Features session to see the new probe presets.
