# Spaceship Architect: Source Understanding

September 21: B-110 Planetary Cleanser implemented locally; printed500000 credits/50EN/security5/threshold23/3x6EXT+3x3EDG/oneDarkPhazon/allAU10rounds/2hrcooldown. Jason permits simulated20,000D12 spectacle; game-time charge120sec. Named7-hex planets are pass-through, with ships above and permanent debris. Zero-enemy encounters use normal ATB exploration, including after victory. See LOCAL-PLANETARY-CLEANSER-20260921.md for implementation choices and test limits.

September 21 Jason override: oxygen resistance begins at6 and increases by4 for each subsequent check (6,10,14,...), replacing old14 start. Preserve16 active seconds between checks and5HP failure. Captured SICs can be powered off without damage; defenders must physically enter the SIC and use existing local maintenance restart. Scan unknown markers remain approximate: scan chosen hex and adjacent hexes using actual locations; another ship's masking does not automatically fail all contacts. See LOCAL-MAP-CREW-HACKING-20260921.md.


September 21: page 55 Scale Ranks use normal hull counts4–26/27–50/51–100/101–200/201+. Bay capacity remains Jason's four-vessel/half-Hull override. EW-FTL B-48 and Cloaking B-61 are implemented from the printed cards; exact values and chosen timing/cost interpretations are in LOCAL-FLEET-ATMOSPHERE-20260921.md. Jason's digital atmosphere replaces old personal breath grace: ideal100%, first resistance at10%,165 active seconds100→10; closed doors isolate, open bays vent, high-res fog. Refill60 seconds10→100 is an implementation choice.


September 21 digital probe override: Jason requires launch destination selection, mouse-following/locked move lines, moves within owner sensor range, Retract that follows and docks, and automatic nearest-hex recovery when the owner leaves range. Travel uses grade speed and paused active time. Retraction/recovery disable stationary payloads so movement is possible. See LOCAL-PROBE-FLIGHT-20260921.md; older free out-of-range flight behavior is superseded.


September 21 probe sources: core PDF page 52 (printed 24L) introduces probes for remote observation; the following sensor rules defer exact abilities to SICs. Read A-71 Launcher, A-72/73/74 Probe 1-3, B-52/53 Probe 4-5, B-40 Shield Breacher, B-51 Hacking Bug, B-120 Warp Bubble Inhibitor. All nine are implemented locally; source values, ATB interpretations and unavailable future Transporter integration are recorded in LOCAL-PROBES-20260921.md. Four probes per 2x2 EDG launcher; twelve active seconds per ship round; a probe only relays within its owning ship sensor range, never through another probe. Probe defense is its Masking; one impairment destroys it. Probe modules attach inside a specific probe and share its host square without hull occupancy. Shield Breacher uses a wait round plus a breach round (24 seconds, interpretation). Hacking Bug is EN1 plus 1 AU/round after explicit activation. Inhibitor arms one round, is stationary, and blocks warp for ALL ships within 2 Units.


September 21 approved implementation: Gym B-66 is 3x3 (Jason override), with no invented automatic training award. Added Science Lab B-65 (3x3, 1,000 credits, EN2, +4 Research/Science Physics/Astronomy in its operational room, 5,000 mineral storage); Holographic Projector B-79 (Bridge (+), 400 credits, EN0, +2 Navigate aboard); Vulnerability Fortification B-116 (SIC (+), +1 threshold per purchase, 500 first then double per host); Power Core Damper B-76 (Engine (+), 1,800 credits, EN1, clearance minus one, one per host); Scramble Box B-119 (1x1, 3,000 credits, EN5, threshold13, adjacent component lock rolls minus one, boxes cannot touch, impairment disables). (+) items have no physical floorplan. Page 47 of the core PDF (printed22) supplies triangular hull rules: 300 credits, +1 Hull HP, excluded size/HSM/thrust, no crew/SIC occupancy, normal hull along both straight sides, clear diagonal exterior. Jason requested a hull toggle and automatic orientation; no Multiple Floors or Angled/Offset Squares. See LOCAL-SIC-HULL-20260921.md for decisions and checks.


September 20 local playtest batch: read LOCAL-PLAYTEST-20260920.md. All four passes are complete locally; 452 automated tests and seven browser playtests passed. Reuse the existing physical 3D dice renderer for ALL rolled results, including Ship AI/NPC automation; no separate dice animation or invisible automatic roll resolution. Automatic server-owned results wait for authorized animation acknowledgment; retry must retain values. Preserve confirmed ship edits through live synchronization, custom NPC crew/inventory, visible PC-turn activity, multiplied damage, disabled-action reasons, shared six-switch Map View, movement sensor range and analyzed partial condition icons. Missing usable Life Support exposes crew; only the actual operational Cockpit footprint protects its occupants. Warp advances in real time plus GM time and uses shared directional effects/audio. Victory acknowledgment preserves navigation/salvage; End Combat ends the encounter. Fresh Explore sessions include eight additional SIC-labeled presets, without rewriting personal or resumed campaigns. GM Give Minerals is receipt-safe. Report records decisions and verification limits. No commit, push, deployment or personal campaign changes. Older conflicting dice/victory/oxygen notes below are superseded.

September 16 Ship AI / NPC automation: read LOCAL-SHIP-AI-AUTOMATION-20260916.md. Ship AI now has 4D6 attributes, +2.5 skills, derived Speed 10.5 and Command Window 94. Preserve Defense/Offense/Off, one free Bridge station with circuit-board icon, Bridge (+) zero-floorplan overlap, zero-AU weapon/lock enforcement, NPC station/analysis/lock/weapon/repair priorities, server-owned spectator dice, normal delays and pause behavior. Automated missiles retain ownership through Off/operator removal. Undo suspends automation until resumed; it must not immediately replay the reverted action. Existing manual rolls and legacy manual AI control remain. New modes can be armed outside combat with station reservation. Tests and Chrome evidence are in the report. Local only; no commit or deployment. Earlier 2D6/skills1/speed5 AI notes below are superseded.

September 16 playtest revision: read LOCAL-PLAYTEST-REVISION-20260916.md. Jason's latest #local batch is implemented locally. Preserve unstationed Hold, shared doorway mesh routing, persistent Toggle Console, visible difficulties, out-of-range hex/Life scans (+5; Life 15), successful-detection-only scan timing, local console input/processing reduction of 10%, owner-only multiplied missile dice, validated Exertion and component targeting. Reset undoes one successful action and reopens restored dice; its checkpoint is in memory, not restart-persistent. Medbay now automatically prepares 0-HP patients for 60 seconds then heals 1 HP/3 seconds, with an uninterrupted 300-second death deadline; living patients heal 1 HP/3 seconds. Old supplies/manual medical rolls are superseded. Keep Carry, 0-HP onboard NPCs, Combat drone animation, legal bulk weapon facing, all seven Warp Drives in one purchase family, pulsing detection/shield visuals and notification dismissal. Prior conflicting timing, Medbay, no-station, hidden-difficulty and destructive-Reset notes below are historical. No commit/deployment. See the report for test evidence and defaults.

September 16 Surv. Camera: read LOCAL-SURVEILLANCE-20260916.md. A-87 is 300 credits and covers the entire ship through one 1x1 station. Preserve automatic owner-only intruder alerts/door closure, server-owned deduplicated arrival history, private authenticated crew-position feeds, physical enemy station access and direct connected camera hacks. Shared fixedStations metadata keeps the chair location through purchases/rotation. Boarding itself remains pending. The new typing indicator, roll-based delay changes and temporary Scan Area range pulse are discussion proposals, not implemented. Local only.

September 16 SIC expansion: read LOCAL-SIC-EXPANSION-20260916.md. VR retains 3x3 with a new 768px floorplan; no awards at or above 6.0, and capped skills disappear from its training list. Repair Drones 1-5 use shared grade metadata, automatic D4/D6/D8/D10/D12, Slow + Quality capped at the existing four steps. Preserve grade-specific Defense, threshold, sprites, notices and private projection. Backup Generator is a 525-credit 1x1 Engine with 3 EN, no station, and no EN impairment effect; engine spacing applies. Antennas 1-4 add ordinary sensor dice and range through shared sensorStats; installed online antennas stack and impairment changes their bonus die only. Run sic-expansion tests and playtest-sic-expansion.cjs, grade 1/5 drone browser checks and crew-room checks with the established regression gates. Local only.

September 16 VR update: read LOCAL-VR-TRAINING-UPDATE-20260916.md. Jason changed A-83 VR Training Room to 3x3. Starting skill <=4.0 uses confirmed D4 tenths; starting skill >4.0 gains exactly +0.1 without dice. This supersedes the old below-2.0 eligibility rule. Preserve once-per-character-per-campaign-day, existing room settings, two stations, physical access and environmental requirements. Existing hull squares remain owned. Local only.

September 15 Pass #2: Jason explicitly requests missile targeting of locked individual SICs. This supersedes the prohibition on printed missile cards (including A-115). Multiple component locks persist alongside the whole-ship lock. Launched missiles retain their chosen component after later lock loss; shields still protect SICs at impact. A-29 Life Support has threshold 18 (verified in SIC_Series_A.pdf page 29), now restored to the app definition. Missile speed remains +1 per 12 active seconds for grades 1–3, +2 for grades 4–5, capped at five times starting speed. Six central Meeting Room stations are a user override. See LOCAL-PASS-2-20260915.md.

Latest user-approved bridge/sensor overrides (LOCAL-CAPTURE-MOVEMENT-PASS.md): capturing a bridge grants its hacker control of the ship through all supported operational consoles, rather than only denying crew access. Use the captured ship's AU and actual Defense while retaining the operator's physical station. Crew recover through local bridge reboot/power recovery. Losing connection stops remote operations but does not automatically clear bridge ownership; explicit hacker release and encounter ending still clear it. A remotely operated hacking module depends on the upstream capture. Do not expose private puzzle or relay identifiers. Sensor checks whose outcomes cannot change skip manual dice while preserving input and report processing; empty area/hex results say "No objects detected." Uncertain character checks and all damage dice remain manual. A guaranteed analysis still waits max(1,12-sensor tier) after input.

September 11 approved timing override: powered starship movement now covers Move Speed in 10 combat seconds, without changing inertia's 12-second periods or other SvS conversions. Systems Analysis report processing is max(1,12-sensor tier) seconds after operator input; keep both stages. For future comparable fixed SIC processing delays, apply that tier subtraction and notify the user rather than silently changing unrelated timing. See SHIP-WORKFLOW-PASS-2.md.

Latest numbered targeting/weapon expansion: see TARGETING-FAMILIES-PASS.md for Lock-On Systems 1-10 and Rapid Lasers 1-5, source card IDs, dice, upkeep and approved digital timing. Its explicit-damage, Combat View and Explore conventions supersede older deferred/tier-one notes in this reference. No FTL Lock-On, Triangulator, hacking or hull-breach simulation was added.

## Shield and Bridge Digital Rules

The current user-approved Shield 1 and cockpit/bridge expansion is recorded in SHIELD-BRIDGE-PASS.md, including the exact override of printed burst restabilization to FULL Shield HP, 12-second SvS conversion, Engineering staffing overflow, 1.5-second AU input, remote access restrictions, and frozen local crew initiative. Guard/Shell/Stability/Core drafts belong to a different game and must not replace the current HP system. Printed bridge extra actions per round do not override real-time ATB. Communications, reboot and random station-destruction remain descriptive pending their corresponding systems.

## Pilot Console Follow-Up

The user superseded immediate cockpit orders with Delayed Resolution input. The pilot cannot act or leave while typing; normal ATB is held. Very Fast base 14, Performance +4, Quality equals the ceiling average of the highest two operational thruster tiers (single thruster uses its tier; existing radial caps at four), Pilot/Helm whole levels 0/1-2/3-4/5/6+ yield Ingenuity 0/1/2/3/4. All other factors neutral. Existing movement continues during input; the replacement route begins at input completion from the then-current position. Leaving the station uses normal character movement, not free Get Up. Launched movement remains independent. See `PILOT-CONSOLE-PASS.md` for implementation and print-resolution decisions.

## Cockpit and Computer-Timed Ship Movement

- Cockpit 1, Series A card A-1: 750 credits, 1 EN, security 4, 1x1 EDG, Computer Systems, Transpherion / 4 hours, threshold 20, one station and one Bridge per ship. EDG means an interior square bordering the true outer hull, not an enclosed courtyard. Printed audio/local temperature capabilities remain card text; no new communications simulation is implied.
- User-approved timing supersedes printed tabletop SvS timing: full calculated ship Move Speed takes 12 combat seconds, versus a character movement segment's 3 seconds. A cockpit order consumes the pilot's current action immediately and moves independently while combat continues.
- The pilot must actually occupy an operational cockpit station and the ship must have an operational installed thruster to issue orders. Leaving or impairment does not cancel an already accepted base order. A later pilot turn may replace the route from its exact current position, even mid-flight.
- Exhaust boosts cost 4 AU per selected thruster, Ionic boosts 2 AU; each adds its tier once per order. A new order pays for its own boosts without refunding previous spending. Impairing a boosted thruster removes its remaining powered boost contribution, without undoing traveled distance.
- On powered arrival, continue in the same direction with speed max(0, floor(previous speed / 2) - 2). Repeat that decay every 12 combat seconds until zero. The combat clock controls powered movement, drift and AU recharge. Fractional positions/routes persist; restarting the server preserves them and pauses the clock.
- The older deferrals below describe earlier passes; Cockpit 1 movement and AU boosts are now implemented. SIC-damage automation and the remaining cockpit/bridge actions are not part of this pass.

## Ionic Thruster Follow-Up

- Ionic Pulse Thrusters B-14 through B-18: tiers 1-5, prices 350/700/1050/1400/1750, EN costs 5/10/15/20/25, sizes 1x1/2x1/3x2/3x2/4x2 EXT, security 2/2/3/3/4, thresholds 8/9/10/11/12. Engineering crafting: Paradon 4 hrs, Argol 4 hrs, Mirium 5 hrs, Drakkonite 6 hrs, Mirium 8 hrs. No stations.
- Each Ionic thruster contributes tier + trunc(HSM/2) Impulse and one Evade die, with no Exhaust penalty. Printed 2-AU boost adds its tier to Move Speed once per thruster; actual ship movement and AU boosts remain deferred. Impairment removes that boost and Evade die, retaining Impulse.
- User clarification: four thrusters means four installed, combined across families. Extra copies may be purchased and stored without a count cap. Rectangular SICs may rotate 90 degrees; exterior orientation still follows their mounting hull edge.
- Core PDF page 57: Masking Level combines HSM, Exhaust and the best Darkveil modifier. Negative values are valid. Darkveil itself is not yet a catalog purchase; the shared calculation supports its metadata when introduced.
- User presentation changes: stations prefer corners and doors prefer locations away from stations. Existing saved station locations are retained; new inventory carries a corner-layout version.

## September 8: Exterior Thrusters and Space Map

- Exhaust family completed: tiers 1-5 only (no tier 6 in these catalogs). A-24: 2x1 EXT, 400 credits, EN 4, security 2, Xpidinium/3 hrs, threshold 12. A-25: 3x2 EXT, 600 credits, EN 6, security 3, Crystilium/4 hrs, threshold 14. A-26: 3x2 EXT, 800 credits, EN 8, security 3, Argol/4 hrs, threshold 16. B-13: 4x2 EXT, 1,000 credits, EN 10, security 4, Drakkonite/6 hrs, threshold 18. All have no stations; Impulse adds their tier to trunc(HSM/2); Exhaust is -(tier+1). Printed 4-AU boost grants +tier Move Speed once per thruster but remains deferred with actual ship movement. B-13's repeated +1 Evade die sentence is treated as the same single benefit, consistent with the core rule and the existing source warning.

- Exhaust Thruster 1, Series A card A-23 (PDF page 23): price 200, EN cost 2, security 2, 1x1 EXT, Engineering, Dianium/2 hours, damage threshold 10, no stations. Impulse = 1 + trunc(HSM/2); Exhaust -2; one Evade die. Four AU adds one Move Speed once per thruster. Impairment removes the AU option and one Evade die, retaining base Impulse.
- Core PDF page 56 (printed L27 spread): total all Impulse, preserve negative totals but treat them as zero movement. Divide negative HSM toward zero. Maximum four thrusters total. Evade die: speed <=3 D4, 4-7 D6, 8-11 D8, 12-15 D10, >=16 D12. AU boosts do not increase Evade die type.
- User explicitly requires EXT parts to attach outside an outer hull wall; they cannot be installed inside the ship. Exterior parts do not buy hull area, add HSM/HP, create stations, or connect interior doors.
- Approved digital map: six ships maximum, one hex step per Unit. GM sets axial positions in encounter preparation, distances derive from positions. First two ships default 25 Units apart. Old arbitrary pair distances cannot generally define a consistent hex layout; existing encounters without positions receive defaults and should be prepared again when exact positioning matters.
- Ship travel, AU movement boosts, inertia, and the book's once-per-SvS-round movement are NOT implemented in this pass. Timing must be approved for real-time ATB after cockpits/bridges are available.


Reading brief, September 6, 2026. This is an orientation and implementation reference,
not a replacement rulebook, an approved digital rules specification, or proof that
the app implements the rules described here.

## Sources and Authority

Source PDFs are in the parent project folder:

- `SA20210516PDF_ADV4.pdf`: 207 PDF pages. Core rules, creation, combat, GM guidance,
  races, classes, equipment, crafting, sample encounters, and worked play example.
- `SIC_Series_A.pdf`: 122 numbered cards, A-1 through A-122.
- `SIC_Series_B.pdf`: 124 PDF pages; 122 numbered cards, B-1 through B-122,
  followed by non-card material.

Page numbers below mean physical PDF pages, not the book's printed spread labels.
Both catalogs' numbered card texts were reviewed. Representative layouts and
apparent card discrepancies were also checked visually. The core reading covered
rules and narrative material; sample ship statistics were reviewed for context,
not audited cell-by-cell or independently recalculated.

The user's explicit digital-rule decisions supersede legacy tabletop behavior.
The book says specific SIC rules override general rules. Apparent contradictions
between examples, tables, and cards must be recorded and clarified, not silently
turned into new rules. Fictional computer messages on sample ship sheets are
decorative story content, not instructions to the development agent.

CRITICAL: Initiative and action timing are intentionally being reworked for a
computer-driven ATB system. Do not restore initiative order, three-action turns,
bonus-action phases, or alternating CvC/SvS rounds from the book. Translate their
gameplay purpose into explicitly agreed digital rules.

## Approved AU Recharge (September 7, 2026)

AU Engines 1-6 (A-19 through A-22, B-11 and B-12) are implemented with
outputs 3, 7, 15, 25, 40, and 60. Their footprints are 1x1 through 6x6;
station counts are 1, 2, 2, 3, 3, and 4. These are not additional EN sources.

The digital AU rating is both maximum stored AU and recharge percentage per
combat second. At 25 AU, a 100% recharge restores one AU every four combat
seconds. A new encounter starts full, stops charging at its cap, and follows
the shared combat clock, including pauses and slowed time. Rate scaling is
centralized in `ship-power.js` for future playtesting adjustments.

Only actually occupied, online stations contribute Engineering bonuses.
Engineer-class station benefits also affect AU. The resulting whole-AU
rating sets both capacity and recharge speed. A reduced rating clamps stored
AU; zero output stops recharge. Repairs and routine ship synchronization do
not refill the reserve. A GM-only Spend 1 AU button supports manual playtesting
until ship action SICs consume AU automatically. Do not restore printed
once-per-SvS-round refreshes alongside this meter.

## Hybrid Engines and Campaign Time (September 7, 2026)

Approved engine names are Power Engine (EN), Action Engine (AU), Power Hybrid
Engine (EN-focused), and Action Hybrid Engine (AU-focused), each with six tiers.
Existing EN/AU type IDs remain unchanged to preserve saved ships. Hybrids use
`en-au-engine-N` and `au-en-engine-N`. Printed sources: A-11 through A-18 and
B-7 through B-10. Power Hybrid station bonuses increase EN; Action Hybrid bonuses
increase AU. Both lose AU when impaired and retain their printed EN output;
destroyed/offline engines provide nothing. Instability events remain future rules.

Pass Time is a GM campaign operation, separate from the combat clock. The GM enters
minutes/hours/days/weeks; active combat must end first. All approved characters
recover HP each accumulated 24 hours equal to filled Health boxes plus their
effective Athletics/Endurance rating. Dice row indices 0 through 4 represent one
through five filled boxes; a D6 plus D4 is three boxes. Preserve fractional skill
values and resulting HP. Partial days persist per character. Every Pass Time also
uses the existing carried-item recharge rules. Elapsed campaign minutes and retry
receipts persist for future crafting integration; crafting completion itself is
not implemented by this pass.

## Product Purpose

The product is a multiplayer roleplaying companion, not only a ship builder or
combat timer. Characters develop across sessions; the crew builds, operates,
repairs, and expands a shared starship while exploring a GM-defined universe.

The captainless design is important: every player should make meaningful choices.
Ship equipment supplies capabilities, while characters supply expertise and decide
how to use those capabilities. A bridge is not a reason to give one player all
control or reduce everyone else to following orders.

The GM retains authority over narrative, hidden information, unusual actions,
custom content, and situational rulings. Automation should remove bookkeeping
without preventing improvisation. The worked example (PDF 192-205) demonstrates
negotiation, deception, emergency equipment replacement, hacking, station changes,
and a desperate escape, not simply alternating weapon attacks.

## Core Rules to Preserve

- Eight attributes use upgradeable dice pools. Ordinary checks fuse equal pairs,
  select the two highest resulting values, then add skill and modifiers. Damage
  instead sums its dice. Races and classes can change dice behavior.
- Skills include tenths. Preserve these values through calculations and display.
- Character combat has critical results; ordinary ship combat does not. Do not
  assume one critical-hit rule applies to both contexts.
- Character creation, later advancement, and equipment acquisition are distinct
  processes. Race/class changes must reverse prior grants and costs correctly.
- Race mechanics include alternate HP, anatomy, resistances, senses, advancement
  currencies, equipment restrictions, and resource recovery. They are not only text.
- NPC and monster statistics are intentionally not constrained to PC derivation
  formulas. The sample NPCs use simplified Mental/Physical skill categories.
- Reverence, Exertion, Drama Cards, and GM rulings provide resources and exceptions
  beyond ordinary action buttons. Some information, including Drama hands and
  unknown difficulties, is intentionally private.
- Weapons differ in aim, charge, range, ammunition, damage element, inventory size,
  and special effects. Do not apply one universal weapon formula without exceptions.

Core orientation: PDF 8-11 dice; 14-25 characters/creation; 26-39 character combat
and related rules; 90-121 classes/races; 122-133 weapons, gear, minerals/crafting.

## Starship Model

A ship combines several related but distinct things:

1. Hull footprint, scale, physical rooms, passages, doors, and exterior attachments.
2. Installed equipment and add-ons, with stable individual identities.
3. Registered crew, actual occupants, station assignments, and control permissions.
4. Power supply/load, expendable auxiliary power, fuel, ammunition, cargo, and credits.
5. Damage, impairments, repairs, reboots, shields, and ongoing actions.
6. What each participant has detected or learned about other ships.

The interior is part of the rules. A large engine is an engineering room with
equipment and access space, not an entirely impassable block. Exterior weapon
hardware can have a separate interior operating area. Future Custom Build shapes
mean room geometry cannot be permanently assumed to be rectangular.

EN powers online equipment; AU funds extra activation and special capabilities.
Their lifecycle is different. The legacy AU refresh cadence needs an explicit ATB
conversion, along with recurring upkeep, activation limits, recharge, and cooldowns.

Station access and active actions are not interchangeable. Engine station bonuses
can be passive; bridge stations offer broad controls; local equipment can have
specific operating functions. Only cards explicitly listing stations receive them.
The Engineer class benefit and an engine's passive Engineering bonus are different
effects and must not be conflated.

Damage to a targeted SIC may also damage hull. Impairment effects are card-specific:
loss of capability, degraded output, accumulated penalties, danger to crew,
instability, or destruction on the first impairment. Do not implement impaired as
just a universal disabled flag. Shield burst normally discards excess damage,
whereas several weapon families explicitly bypass shields or alter damage to them.

Core orientation: PDF 42-59 ship basics/building; 60-69 ship combat; 70-77 ship
operations and additional rules; 160-187 sample ships.

## SIC Families and Representative Interactions

Series A includes bridges, four engine families, exhaust thrusters, descent,
life support/nutrition, sensors, lock-on, security, shields, warp/fuel, hacking,
probes, concealment, utility rooms, weapons, mining, and salvage.

Series B extends tiers and adds transport, production, attachments, autonomous
drones, cloaking, wired power, hull upgrades, remote control, specialized weapons,
mines, information warfare, and equipment that modifies other equipment.

- A-7 to A-22 and B-5 to B-12: EN, E/A, A/E, and AU engines differ in output,
  passive station bonus resource, spacing, and impairment. Higher tier is not the
  only dimension of engine choice.
- A-29: Life Support is a 2x2 environmental system, not a cafeteria. No stations.
  A-30: Nutritional Supplement is a 1x1 paste dispenser requiring Life Support.
  No stations. Its joke is **over 20** flavors; impairment leaves one random flavor.
- A-51 to A-58 and B-36 to B-39: shields have regeneration, restabilization,
  local staffing requirements, rising multi-shield costs, and recharge add-ons.
- A-68 to A-70 and B-49 to B-51: hacking is password deduction with firewall
  decoys and skill-gated modules, not a generic success roll. A Hacking Bug bypasses
  defenses that ordinary remote hacking cannot.
- A-87 and B-73: cameras and security droids distinguish registered crew from
  intruders. Registration and physical presence must remain separate concepts.
- A-89: Ship A.I. can act as crew but still consumes a bridge station.
- B-19/B-20: transport depends on range, transponders, shield state, analysis,
  lock-on where applicable, and local scrambler coverage.
- B-21 to B-23/B-65: Science Lab hosts mineral processing and 3D printing;
  blueprints, recipes, time, inventory, compatibility, and resale rules matter.
- B-62/B-63: Wired Downgrade and cables make connectivity determine power loss.
- B-75: Separation Module creates independent versus combined ship states.
- B-76/B-77: Power Core Damper changes engine spacing; Custom Build changes shape.
- B-101/B-104: fields and traveling effects can persist independently of an action.
- B-111/B-114/B-118: hack alerts, hidden equipment, and lock-on warnings depend on
  installed capabilities. Omniscient player UI would invalidate these cards.
- B-121: shared lock-on is an equipment-enabled exception with dependent links;
  ordinary sharing of sensor information is not equivalent.

## Digital Decisions Already Given by Jason

Latest generator pass: CvC = 3 seconds and SvS = 12 seconds unless explicitly overridden. Shield generators 1-10 use printed sizes, HP, reduction and regeneration divided by 12; restabilization restores full HP over 120 powered seconds before staffing bonuses, with total AU of 20/20/30/30/40/40/50/60/70/80. Only a zero-HP shield can begin restabilization. Initial ship inertia now depends on actual powered distance: max(0, floor(distance/2)-2), then the same repeated speed decay every 12 seconds. See SHIELD-GENERATORS-PASS.md and SHIELD-BRIDGE-PASS.md for staffing and AU input rules.

These are user directions, not statements of the printed 1e rules:

- Desktop GM play is the primary focus; mobile-specific refinement comes later.
- Ship and surface encounters are separate. Ship encounters have all combatants
  aboard ships; future boarding will change physical location and targeting.
- Shared room boundaries/doors must agree in construction, GM, PC, and combat views.
- Each hull square currently uses a 3x3 combat movement mesh.
- One character per station; up to two at an ordinary movement location, both visible.
- Movement selection locks on click. Confirmation follows the displayed route.
- Crew auto-open doors, paying opening time in movement/ATB; they do not wait for
  closing. Invaders do not receive crew automatic-door access.
- Life Support impairment: immediate gravity loss, oxygen lost after 45 seconds.
- Angiluros: first three primitive weapons free; later crafting rolls duration and
  requires GM approval. They may receive other weapons through inventory transfer.
- Boarding and hacking expansion remain later work, not permission to implement now.

Consult AGENTS.md and current user messages for the rest of the UI/product decisions.

## Clarifications to Queue, Not Silently Resolve

These do not prevent understanding the game. Resolve them before the affected
feature is implemented, after checking current user-approved overrides:

- A-36 Sensors 6 lists range 18 normally but 25 impaired. B-24 to B-26 similarly
  increase range when impaired. A-36 was visually checked; not an extraction error.
- B-92 to B-96 Spread Missiles describe three smaller missiles but the effect says
  four. B-92 was visually checked and contains both statements. The authorized
  September 13 no-questions missile pass uses the explicit effect: four.
- B-13 repeats the +1 Evade Die line. Do not automatically count it twice.
- The worked example uses older/different equipment values in places. For example,
  its Ripple Cannon 4 loses 1D8 per unit; A-106 says per two units. Example prices
  also sometimes differ. Use examples to understand play, not as sole numeric data.
- B-109 Phazon Torpedo Launcher has a non-dimensional Size entry. Do not invent
  a footprint when it is added.
- B-67 Brig has an empty Security Level. Do not silently turn missing data into zero.
- Variable rounding, action-limited benefits, session/day limits, stun durations,
  regeneration, AU upkeep, and multi-step work need explicit digital timing rules.

## Engineering Implications (Analysis, Not Approved Work)

### Missile Digital Pass (Authorized September 13, 2026)

Implemented Launchers 1-5, standard/spread missiles 1-5 and flares. See LOCAL-MISSILE-PASS.md for exact source references, grades and tests. Core PDF66/printed32L governs Lock-On launch, independent homing, accelerating speed, Masking/Defense, one-damage interception and shield/hull damage. PDF71/printed34L limits each launcher to one launch per SvS round. Cards A112-118 and B88-96 provide the equipment values.

The app uses a 12-active-second launcher cooldown and missile acceleration round, separate from the approved 10-second ship movement conversion. Fast console input precedes launch; unfired ammunition survives interruption. Manual impact rolls globally freeze ATB and command deadlines. Spread uses four separate projectiles; manual flare results use heads to win and D6 for one of six hex directions. Deflected projectiles retire after 600 active seconds as a documented housekeeping choice. No automatic attack, damage or flare dice were introduced.

### Sensor Digital Pass (Authorized September 2026)

Sensors 1-9 are implemented. See SENSORS-PASS.md for exact data and coverage. User-approved impaired ranges are 4, 6, 8, 10, 12, 15, 16, 18 and 20 Units. No local sensor stations or Engineering speed bonus; operate remotely from a cockpit/bridge. Successful Systems Analysis may reveal exact ship HP, as a timestamped snapshot. Important source correction: a failed Analysis adds +1 to the next ROLL, not its difficulty.

Digital playtest assumptions: input base 8, Quality ceil(tier/2) capped at four, 12 combat seconds for a successful Analysis report to finish, and ship Masking as the defense fallback when no explicit Defense Score exists. These are recorded interpretations, not printed rules. Life Scan results remain approximate and GM-authored, with no artificial life. Lock-On equipment/actions are not part of this pass.

Use a shared ship model and shared map behavior rather than fixing each page or
each card independently. Keep art separate from collision and door geometry.
Store catalog definitions separately from each purchased equipment instance.
Model actions, passive modifiers, resources, prerequisites, and damage outcomes
explicitly; preserve card identity and source references for traceability.

Keep campaign authority and hidden information on the server. A browser's selected
tab must not determine when an action advances or who receives a notification.
Validate movement, occupancy, permissions, and costs again when an action commits,
not only while the destination is being previewed.

Test chains of play, not isolated buttons: equipment purchase -> placement -> crew
assignment -> station movement -> passive bonus -> active action -> damage/reboot
-> recalculation -> refresh/reconnect from independent GM and PC clients.

The objective is not to implement all 244 SICs at once. Establish reliable shared
behavior with the current small set, then add families and their distinctive
mechanics without rebuilding the foundation for each new card.

## Command and Maintenance Timing

See COMMAND-ACTIONS-PASS.md for the current digital interpretation of core PDF
pages 62-64 and 68-69: bridge preparations/hailing, thruster maneuvers, local SIC
repair/reboot, diagnostics and conditional orders. Team/conditional windows are
12 combat seconds after input; repair uses 9 seconds; diagnostics use 55 minutes
of GM-passed time. These concrete durations and collision snapshot rules need
playtesting. Lock-On, hull breaches, hacking and future equipment event triggers
are not simulated before their authoritative systems exist.
## Crew Room Timing And Effects

See LOCAL-CREW-ROOMS-PASS.md for A-83 through A-86 and A-89. Core PDF page26 / printed12L sets CvC at approximately eight seconds: Medbay uses eight seconds and a ten-CvC-round (80-second) recovery window, not the existing SvS or movement conversion. Manual 3D6 healing becomes 1D6 below 1HP; one Umbrexium supplies30 uses. Impairment uses a manual D4 then GM adjudication on1. The user requested added stations and OOC room consoles. VR originally required a skill below2.0; the September 16 user override replaces that restriction with D4 tenths at 4.0 or below and fixed +0.1 above 4.0, once per GM-advanced campaign day, in a 3x3 room. Ship AI has2D6 per attribute, allskills1.0, and derived ATB5 (four Intellect boxes + Initiative1). Library/node and unsafe-VR narrative limits are documented in the pass report. These choices do not revise previously approved oxygen, sensor, warp or movement clocks.

## Field Utilities Source Addendum

Latest user override (LOCAL-ART-SALVAGE-AUDIT-PASS.md): each Docking Bay has a four-vessel limit and total carried Hull squares <= one half of the carrier's Hull squares, allowing mixed sizes. This replaces the Scale Rank/one-vessel interpretation below. GM-placed minerals, asteroids and named objects are retrievable with Tractor Beam (range two) or Manipulation Arm (same hex); mineral/cargo totals persist. They are public placed beacons, not newly invented hidden-contact, collision or mining simulations. The entire Meeting Room grants console access; its visual room/occupant experience is available outside combat without a specific seat.

See LOCAL-FIELD-UTILITIES-PASS.md for A-90 through A-93, A-118 and A-122. Tractor range is two SvS units, target hull at most half the source hull, with no gripping through shields. Manipulation requires the same SvS hex; impaired every-other-round operation uses 24 active seconds. Docking permits equal/lower Scale Rank, with a 2,500-credit optional shield doorway. Escape Pods carry three and inflict fixed 20 HP per impairment on occupants. Ripple reflection uses double-distance damage falloff; impaired reflectors also receive the same manual returned damage. Flares remain three per use with manual coins and direction rolls. Added station layouts, one-vessel bay occupancy, nonrecursive reflection and narrative salvage/planetary limits are documented digital interpretations, not silently invented source rules.

# Local Warp And Self-Destruct Interpretations

See LOCAL-WARP-RAIL-DESTRUCT-PASS.md for the current implementation and source pages. Warp uses drive-specific activation (12-second source rounds), not the Sensors processing-level adjustment. Actual journeys advance through GM campaign downtime. Fuel is consumed cell-by-cell when used; early exit discards only the current cell's unused range. One source month is represented as 30 days, minimum activation is one round after Engineering stations, and impaired cells provide half range.

User overrides: Self-Destruct needs two distinct registered crewmembers instead of the printed five security inputs. Any conscious registered crew can cancel; AI and remote activation remain prohibited. Blast dice use maximum Hull HP and eligibility uses total generated EN. Oxygen rounds and other previously agreed clocks are unchanged. Rail Cannon A-119 always uses Manual Fire and one unit of Iron per shot; Lock-On never bypasses its accuracy check.


## September 15 digital overrides: Repair Drone 1 and Defense

Jason confirmed Defense is the difficulty: ties hit. Repair Drone 1 (Series B, B-54) has Masking/Defense 12, threshold 14 and is destroyed by one impairment. Preserve the printed 1x1 EDG, 750-credit, EN 2, Security 2, Engineering, Argol/6-hour specifications. The printed ship-round cadence is superseded for this drone by Slow base 6 plus level-based Quality 1 using the existing half-circle delayed-action formula: rate 8, 12.5 active seconds per automatic 1D4 Hull repair. This is an explicit exception to manual dice and its result animation must not block play. Same-position repairs of other ships take one ATB order; separation returns the drone to its owner. See LOCAL-DRONE-ALERTS-PASS.md.
