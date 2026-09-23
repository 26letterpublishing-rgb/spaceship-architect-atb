# Local Hacking Foundation

September 13, 2026. Local only. This is a working practice game and hardware catalog foundation, NOT completed live-combat hacking. No GitHub upload, Render access, personal campaign changes, or Gold Standard changes.

## Ready To Try

- http://127.0.0.1:8794/hacking-practice.html
- http://127.0.0.1:8794/showcase.html now includes a Hacking Practice link that opens separately without changing the current GM/PC view or starting combat.
- CPU Security Systems 1-8 and Hacking Modules 1-5 have source-checked catalog metadata, distinct artwork, purchase cards, placement, power costs, storage and save/reload support. Their cards explicitly say combat integration is pending. Installing a CPU does NOT yet activate an incoming-hacking defense or change the aggregate ship Security readout.
- Practice supports Security 1-8, Firewall 0-8 and all five module reductions. Candidates are distinct letters, with aggregate exact/misplaced feedback, keyboard entry, editable positions, a retained attempt history and a visible solved code.
- Passwords and decoy identities stay in the local server process. Browser responses contain only candidates, guesses and aggregate feedback. Neither server-only JavaScript module is publicly served.
- A dropped submission acknowledgment can be retried without counting a guess twice. Drafts and accepted history survive a browser reload, including reload after a dropped acknowledgment. End Practice releases the server session and returns to the main menu.

Practice is deliberately independent of ATB, combat, character skills, damage, campaign storage and captured-SIC operation. It is not the live guessing action. Practice sessions expire after four inactive hours or a server restart; their bounded history is not permanent campaign storage. Eight simultaneous sessions per client address and 128 total sessions bound memory. A practice board has a 100-row resource limit, not a proposed live hacking limit.

## Still Held For Answers

Two asynchronous questions were sent this pass. No answers had arrived when this handoff was written:

1. Approve a minimum one-letter code, strongest operational CPU only, preserved existing puzzle after impairment, one action to reconnect after range loss, and power drawn from the captured SIC's physical ship?
2. Approve bridge electronic lockout while preserving physical movement/local power-off/reboot, and one earned ATB action for counter-hacking?

Earlier Decker/Reverence stacking and multiplayer shared-notes policies also remain unresolved. They have not been implemented. A practice configuration whose reduction removes the entire code is rejected with an explanation; no automatic access or unapproved one-letter floor has been silently added.

The approved live cadence remains one guess per earned ATB action, using existing Intellect/Initiative timing, one operator per module, no extra cooldown and no mechanical Fast input delay. No live ATB submission/control routes, live hacking console, forced-impairment action, counter-hacking roll dialog, reboot invalidation or captured-weapon controls were added in this foundation pass. Do not claim those are implemented. Existing combat and maintenance behaviors remain unchanged.

`hacking-puzzle.js` includes source-accurate, independently tested order-swapping and strict D6-below-Hacking comparison helpers. These are NOT connected to gameplay or automatic dice. They are preparation for the defensive loop, not a substitute for implementing that loop.

## Source Checks

Read the actual core PDF pages 67-69 again this pass. Read all thirteen card pages: A-45 through A-50, A-68 through A-70, B-34, B-35, B-49 and B-50. Preserve CPU Security's N/A security, no printed stations, module Hacking qualification separate from Computer Systems, firewall-first reduction, and the impairment distinctions. The four VXA example guesses are verified against the earlier source-checked proposal.

## Verification

- Full automated suite: 254 passing tests.
- 96 root/browser/script JavaScript syntax checks passed; diff whitespace check passed.
- Eleven new unit/HTTP tests cover all card grades, every published feedback row, 3,600 code/guess combinations, distinct random alphabets, invalid guesses, module reductions, strict fractional counter-hack comparison, practice isolation, private payloads, forbidden source serving, expiration and idempotent retries.
- Actual Chrome `playtest-hacking-practice.cjs`: deduction using public clues only; keyboard entry; editable drafts across reload; lost acknowledgment retry and reload; independent browser isolation; Module 5; zero-code guard; mobile bounds/reduced motion; all thirteen actual shop image hashes distinct; real purchases/placement/credit deductions/confirmation/reload; Explore entry preserving Script; End Practice cleanup.
- Existing Chrome `playtest-ship-workflows.cjs`: PC walking-speed comparison, upgrades, purchases, shared ship sheet, six view controls, both print modes, console previews, expansion/centering, negative EN, preparation drag/zoom/sensor overlays.
- Existing Chrome `playtest-held-turn.cjs`: natural NPC readiness while Nova holds, three viewport sizes, collapse/restore, independent GM/PC delivery without switching perspectives.
- Actual screenshots inspected: solved desktop board, maximum mobile board, Hacking Module shop picker. Screenshots under ignored `test-artifacts/hacking-practice`.

## Artwork

Generated with the built-in image generation tool, not a paid API integration. Source images are preserved; the existing atlas-packaging script creates cached WebP-backed SVG views without repainting pixels.

Final project assets:

- C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/cpu-security-tier-atlas.png
- C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/cpu-security-tier-atlas.webp
- C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/cpu-security-tiers.svg
- C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/hacking-module-tier-atlas.png
- C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/hacking-module-tier-atlas.webp
- C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/hacking-module-tiers.svg

CPU prompt:

> Create a game sprite atlas for Spaceship Architect: CPU SECURITY SYSTEM hardware floorplans, eight visibly different grades. Exactly 4 columns x 2 rows of equal square tiles, tile boundaries invisible, each tile contains one complete separate room composition centered with generous margin. Strict orthographic overhead / true top-down, no perspective, no isometric. Photorealistic sci-fi industrial floorplan miniature art, crisp grey metal floor tiles, server racks and processors in silver/graphite with green/amber lights. Row-major grade progression: 1 small single secure processor; 2 paired processor enclosure; 3 triangular three-server cluster; 4 square fortified four-server rack; 5 two connected secure cabinets; 6 two elongated cabinets with cooling loops; 7 seven vault-like modules linked into a sophisticated network; 8 large square central fortified computer with eight peripheral modules. Each grade must have clearly distinct silhouette and hardware, not just recoloring. No words, labels, numerals, people or UI. Consistent scale and lighting. Asset sheet used as eight square views in an existing game, not a poster. 2048x1024 image.

Hacking prompt:

> Create a single sprite atlas for a spaceship floorplan game, FIVE HACKING MODULE hardware grades, exactly 5 columns x 1 row of equal square tiles, each tile has a separate centered complete piece of futuristic computer intrusion hardware on grey metal tiled floor. Strict true top down overhead orthographic, no perspective or isometric. Realistic industrial sci-fi miniature. Distinct progressively more complex silhouettes: 1 compact square black computer with one luminous cyan chip; 2 two inset chips and a copper bus; 3 triangular three-processor hub with wiring; 4 paired vertically stacked computer units linked by magenta diagnostic circuitry; 5 advanced two-chamber quantum computer with five intricate cores and silver armor. Each grade clearly differs in physical hardware not just color. No text, numbers, humans, labels, UI. Equal square cells across the entire atlas with slight safe margin per cell. Flat overhead soft lighting, readable small, sharp detailed art matching a sci-fi tabletop floorplan. Width 2560 height512.

The returned hacking atlas has taller cells than requested. Complete devices remain visible in each view; the actual rendered shop assets were checked, not merely file names.

## Preview And Continuation

New isolated server: port 8794, PID 18816. Data/logs: `C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-hacking-foundation-20260913`. Earlier previews remain untouched. HEAD remains 1308466; the existing dirty worktree is intentionally preserved. Temporary test servers/browsers were closed. Do not restart or stop the earlier restricted 8788 preview.

The requested live pass remains pending the answers above. No task-complete notification should be sent while that implementation is incomplete. Once the authorized live pass is genuinely finished, send the normal completion notification as the final operational tool action.
