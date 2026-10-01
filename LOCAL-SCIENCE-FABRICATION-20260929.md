# Local Science Lab and fabrication pass — September 29, 2026

Implemented locally only. No commit, push, deployment, Gold Standard update, personal campaign edit or Vector change.

## Features

- Science Lab uses a 2×3 floorplan and 1 EN. Its +4 Research, Science/Physics and Astronomy room bonus applies to every character inside the operational room. Console shows shared ship minerals, with no separate 5,000-unit lab store.
- 3D Printer and Mineral Processor attach inside a Science Lab without adding floor space. They consume 3 EN and 5 EN respectively, in addition to the lab's 1 EN.
- Small blue Buy blueprint controls appear on craftable SICs and their inspector. The confirmation card names its target, for example Blueprint (Sensors 7). Blueprints cost 1,000 credits and are shared by all printers on that ship.
- Each printer holds six jobs including the active one. Machines run concurrently. Minerals are consumed exactly when each job starts; waiting jobs do not reserve resources. Missing-mineral recipes are desaturated with an explanation. Cancelled active work does not refund consumed minerals.
- Printing has confirmation, a progress meter, percentage and remaining fictional time. Completed components enter ship storage and notify both PC and GM. Printing never invents or bypasses a dice roll.
- Processor implements all 18 page-132 recipes with six queued cycles, shared storage, progress and automatic output. A cycle creates one unit. Large GM time advances correctly carry time through successive jobs and across simultaneous machines.
- Offline/rebooting, impaired or insufficient-EN equipment pauses. Destruction clears unfinished work and loses already-consumed minerals. Jobs persist across campaign saves/restarts, edits and combat preparation. Completed prints raise the ship revision so stale editing cannot erase the item.
- Printed SICs resell for 25% of original price and become licensed to their ship when installed. Stored printed add-ons can select a compatible host without buying the component again.
- Added Matterwright (PC) and Crucible (GM) science showcase variants. New generated printer, processor and blueprint artwork plus a correctly proportioned Science Lab floorplan are small WebP assets; provenance is in ASSETS-SCIENCE-20260929.json.

## Rules and decisions

Sources visually checked: SIC Series B cards 21, 22, 23 and 65; main rulebook page 132. User's lab dimensions, EN, shared minerals, shared blueprints and six-job queue override printed rules. The 3D Printer card's explicit quarter-price resale is used where the book's wording differs. One month is 30 fictional days. The processor also uses six queue slots. Once started, work does not require a character to remain at the station. Leaving the app closed does not manufacture offline elapsed time; use GM Pass Time for fictional travel and downtime.

Legacy mineral spellings remain usable without duplicating their quantity. Power Engine, Life Support and Nutritional Supplement crafting data previously existed only on static cards; it is now available to the server as well. Nutritional Supplement's Paradom typo is normalized to Paradon.

## Verification

- Focused tests cover six-slot limits, duplicate requests, material consumption, parallel printers, missing minerals, cancel, pause/destruction, all processor recipes, restart recovery, stale edits, authorization, notices, shared catalog recipes and combat preparation/completion.
- Mouse/browser checks used disposable Explore data on isolated port 8792. Verified the new console, printer progress after a three-day GM advance, processor confirmation and Zennium output, missing-mineral disabled recipes, named blueprint purchase and Confirm Changes persistence, plus both GM and PC completion popups.
- Browser screenshots: test-artifacts/science-pass/console-progress.png and blueprint-purchase.png. The latter is an intermediate catalog capture; the progress screenshot is the useful visual proof. An early browser tab stalled on native confirmation; replaced fabrication confirmation with the styled in-app dialog and verified that route successfully.
- All 724 full-suite tests passed, with 11 focused fabrication tests. Runtime syntax and CRLF-aware whitespace checks passed. Personal saved campaign files were not used.

## How to playtest

Restart the Spaceship Architect server and refresh GM/PC tabs. Start a fresh Explore Features room and choose Matterwright or Crucible with Science Lab, Blueprints, 3D Printer and Mineral Processor. Station a character in the lab and open its console. Select a printer and confirm a blueprint; use GM Pass Time to advance its printed duration. Check storage and both completion notices. Switch to the processor and run Zennium. Try a seven-day Sensors 7 job, pause the lab, resume, and verify the meter retains progress.
