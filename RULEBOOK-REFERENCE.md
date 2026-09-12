# Spaceship Architect: Source Understanding

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
  four. B-92 was visually checked and contains both statements.
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
