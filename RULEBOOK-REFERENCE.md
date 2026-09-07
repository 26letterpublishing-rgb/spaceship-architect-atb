# Spaceship Architect: Source Understanding

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
