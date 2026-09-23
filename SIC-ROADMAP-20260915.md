# SIC additions recommended after Pass #3

September 16 camera update: Surv. Camera (A-87) is now implemented at Jason's 300-credit, ship-wide coverage specification. See LOCAL-SURVEILLANCE-20260916.md. Catalog representation is now 178 of 244 identities, with 66 remaining. Earlier gap listings below are historical.

September 16 update: the user authorized priorities 1-3, now implemented locally. See LOCAL-SIC-EXPANSION-20260916.md. Repair Drone 2-5, Backup Generator and Antenna 1-4 add nine catalog identities: 177 represented, 67 remaining. The original audit below is historical; its nine corresponding gap entries are no longer missing. Hull Breach Repair Drone remains a separate future mechanic.

Reviewed September 16, 2026 against SIC_Series_A.pdf and SIC_Series_B.pdf and the actual app catalogs. The two series contain 244 numbered cards. 168 card identities are represented by catalog systems, ammunition or fuel; 76 have no corresponding purchasable entry. This is a catalog comparison, not a claim that every paragraph of every implemented card is automated. Some missing entries overlap deliberate digital features or retired ideas. No new SICs were implemented in this review.

## Suggested implementation order

| Priority | SICs | Why next | Scope / rule considerations |
|---|---|---|---|
| 1 | **Repair Drone 2–5 (B-55–58)** | Completes a working family with immediate ship-upgrade value. | Reuse deployed targets, automatic dice feedback, same-hex repair and return logic. Cards advance repair dice D6/D8/D10/D12 and Masking 14/16/18/20. Extend the approved Slow base + SIC level Quality timing; do not restore tabletop turns. |
| 2 | **Backup Generator (B-71)** | Directly helps power budgeting and emergency resilience. | 525 credits, 3 EN, 1×1, one-square engine clearance, no impairment effect. Use shared engine placement and EN calculation. No need to invent automatic priority-based power shedding. |
| 3 | **Antenna 1–4 (B-27–30)** | Adds useful sensor upgrades without buying an entirely new Sensor SIC. | Add actual sensor dice and range bonuses, not a flat score bonus; use the same manual roll and guaranteed-outcome checks. Retain masking/privacy and impairment effects. |
| 4 | **Vulnerability Fortification (B-116)** | Gives players a direct response to targeted Life Support or weapon damage. | Attached SIC receives +1 threshold per purchase; first costs 500 and each later purchase on that SIC doubles. Needs shared per-instance threshold handling across attacks, missiles, cards and reports. |
| 5 | **Science Lab (B-65)** | Best foundation for exploration and future crafting. | 1,000 credits, 2 EN, 3×3; printed +4 research/science and capacity for 5,000 minerals. Reuse crew-room and mineral interfaces; the GM still determines narrative information. |
| 6 | **Vulture Drone (A-121)** | Turns the existing wrecks and salvage stores into a satisfying post-combat reward. | Reuse drone targets and wreck identity. One use per wreck, printed 20 SvS rounds, GM-approved salvage pool and a random SIC result. The drone rule's automatic repair-roll exception should not silently authorize automatic salvage rolls. |
| 7 | **Mining Laser (A-120), Mineral Processor (B-21), 3D Printer + Blueprint (B-22–23)** | Creates a complete resource-to-upgrade progression. | Implement Science Lab first for its add-ons. Use GM Pass Time for four-hour mining/crafting, manual mining results and the mineral chart, receipt-safe costs and one-quarter sale value for printed items. |
| 8 | **Probe Launcher + Probe 1–5 (A-71–74, B-52–53)** | Makes the space map useful for scouting and opens several future attachments. | Reuse persistent small targets, but keep probe sensor coverage distinct from the parent ship's own sensors. Adds movement, range links, launches and privacy tests; larger work than a new drone tier. |

For the smallest next pass, I would choose **Repair Drone 2–5 + Backup Generator + Antennas**. For a broader exploration pass, choose **Science Lab + Vulture Drone**, followed by mining and manufacturing. These are recommendations only.

## Later candidates and deliberate holds

- Hull Plating (B-68) is useful, but changes maximum HP, scale-based calculations and the cost of later hull expansion. Build it after per-instance upgrades are centralized. Heat/Laser Resistance belong with a shared damage-type pipeline.
- Hack Alert (B-111) fits the live hacking system, but its D4 per password guess needs an explicit private manual-roll flow or a separately approved automatic-roll exception.
- Reverse Targeting I.D. (B-118) overlaps Jason's deliberately universal **Enemy Locked On** banner. Do not gate or remove that established alert to sell this card.
- Burst Shield Reactivator / Emergency Shield Recharger (B-38–39) refer to older shield recovery behavior. Their benefits need a deliberate conversion around the approved full-shield restoration rule before implementation.
- Hull Breach Repair Drone (B-122) repairs a distinct hull-breach system, which is not yet implemented. Ordinary hull HP repair and impaired Life Support are not substitutes for that mechanic.
- Wired Downgrade (B-62) remains retired. Connector Cable (B-63) depends on it, so it is not a next-step recommendation.
- Transporter, minefields, advanced cloaking, ship separation, remote piloting and devastation weapons introduce substantial new movement/visibility/damage rules. Leave them for focused feature passes.
- Bar, Gym, Brig, Surveillance Camera and Holographic Projector can enrich interiors, but several need narrative decisions or boarding/security systems before their full mechanics can be automated. Do not invent training awards for Gym from its descriptive text.

## Complete catalog gap inventory

Page numbers in each source PDF match its numbered card pages. Names below normalize the print extraction's spacing; identifiers are the authoritative reference. Entries in this inventory are not all recommendations, as explained above.

| Card | Card name |
|---|---|
| A-59 | Static Shields |
| A-67 | Hibernation chamber |
| A-71 | Probe Launcher |
| A-72 | Probe 1 |
| A-73 | Probe 2 |
| A-74 | Probe 3 |
| A-87 | Surv.  Camera |
| A-120 | Mining Laser |
| A-121 | Vulture Drone |
| B-19 | Transporter |
| B-20 | Transport Scrambler |
| B-21 | Mineral Processor |
| B-22 | 3D Printer |
| B-23 | Blueprint |
| B-27 | Antenna 1 |
| B-28 | Antenna 2 |
| B-29 | Antenna 3 |
| B-30 | Antenna 4 |
| B-33 | FTL LockOn |
| B-38 | Burst Shield Reactivator |
| B-39 | Emerg. Shield recharger. |
| B-40 | Shield Breacher |
| B-47 | FTL Burst |
| B-48 | EW-FTL Drive |
| B-51 | Hacking Bug |
| B-52 | Probe 4 |
| B-53 | Probe 5 |
| B-55 | Repair Drone 2 |
| B-56 | Repair Drone 3 |
| B-57 | Repair Drone 4 |
| B-58 | Repair Drone 5 |
| B-61 | Cloaking Device |
| B-62 | Wired Downgrade |
| B-63 | Connector Cable |
| B-64 | Bar |
| B-65 | Science Lab |
| B-66 | Gym |
| B-67 | Brig |
| B-68 | Hull Plating |
| B-69 | Heat Resistance |
| B-70 | Laser Resistance |
| B-71 | Backup Generator |
| B-72 | Land Wheels |
| B-73 | Security Droid |
| B-74 | Sensor Lure/Illusion |
| B-75 | Separation Module |
| B-76 | Power Core Damper |
| B-77 | Custom Build |
| B-78 | Gravity Absolution Field |
| B-79 | Holo. Projector |
| B-97 | Mine Launcher |
| B-98 | Space Mine 1 |
| B-99 | Space Mine 2 |
| B-100 | Space Mine 3 |
| B-101 | Static Electron Web |
| B-102 | Magnetic Seeker |
| B-103 | c.r. Ballistic Rail Repeater |
| B-104 | Black Hole Gun |
| B-105 | Devastation Laser |
| B-106 | Devastation Laser 2 |
| B-107 | Ion Disruptor |
| B-108 | Ionic Force Displacers |
| B-109 | Phazon Torpedo Launcher |
| B-110 | Planetary Cleanser |
| B-111 | Hack Alert |
| B-112 | Remote Controller |
| B-113 | Remote Receiver |
| B-114 | Analysis Screening |
| B-115 | Pulse Relay echo Reverberator |
| B-116 | Vulnerability Fortification |
| B-117 | Relay Pulse Sub-Triangulator |
| B-118 | Reverse Targeting  I.D. |
| B-119 | Scramble Box |
| B-120 | Warp Bubble Inhibitor |
| B-121 | Lock-On Triangulator |
| B-122 | Hull Breach Repair Drone |
