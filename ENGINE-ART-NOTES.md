# Hybrid Engine Artwork

## Ionic Pulse Thrusters

`ionic-pulse-thruster-1-graphic.png` through `ionic-pulse-thruster-5-graphic.png` are transparent generated field emitters shared by cards and exterior sprites. All five were visually inspected and alpha channels verified. Top mounting rails and downward-facing shallow dishes distinguish these from Exhaust rocket bells. Effects are CSS semicircular pulses, not baked into the images. Generated with the built-in image tool; originals remain in this task's Codex generated-images directory.

Prompt specifications:
- Tier 1: compact sci-fi ion-field emitter, not a flared rocket nozzle. Orthographic top-down silver/graphite mounting bracket at top, shallow semicircular dish at bottom facing down, light-blue glowing concentric electrodes. Symmetric machined metal, square transparent-alpha composition, fills 85 percent, crisp realistic hard-surface game asset. No flame, pulse waves, floor, text, backdrop or scene.
- Tier 2: wide silver/graphite field emitter, top mounting rail, two shallow round dishes facing down, purple concentric electrodes. Symmetric orthographic top-down machined metal, transparent RGBA, 2:1 silhouette with small margin. No rocket bells, flames, waves, floor, text or background.
- Tier 3: advanced silver/graphite field emitter, two shallow circular dishes along lower edge linked to a top rail by intricate magnetic coils and coolant conduits. Blue concentric electrodes with green/purple accent conduits. Symmetric top-down realistic hard-surface render, landscape 3:2 transparent frame. No rocket bells, flames, waves, text, floor or background.
- Tier 4: advanced silver/graphite assembly, broad top rail, two shallow semicircular downward-facing dishes, greenish-blue concentric electrodes, turquoise coils, extra symmetric radiator fins and conduits. Orthographic top-down realistic render, 3:2 silhouette with minimal transparent padding. No rocket bells, flames, waves, text, floor or background.
- Tier 5: true transparent-alpha gunmetal/silver field emitter, two shallow circular dishes on the bottom with crimson concentric light, red magnetic rings and intricate exotic stabilizer fins. Horizontal top rail, symmetric top-down 2:1 design, high-detail game equipment cutout, minimal padding. No rocket cones, flames, waves, floor, backdrop or text.

Sprite-local emitter coordinates in `ship-map-core.js` keep pulses and exhaust jets aligned through footprint rotation and hull-facing transforms. Reduced motion disables moving effects.

## Exhaust Family Completion and Digital Cards

Card artwork: `exhaust-thruster-2-graphic.png` through `exhaust-thruster-5-graphic.png` are copies of the corresponding existing `en-engine-N-graphic.png`, following the user's approved reassignment. Original assets are preserved.

New workspace sprites: `exhaust-thruster-2-sprite.png`, `exhaust-thruster-3-sprite.png`, `exhaust-thruster-4-sprite.png`, and `exhaust-thruster-5-sprite.png`. Generated with the built-in image tool, not the API/CLI fallback. All four were inspected and their RGBA alpha channels verified. Originals remain under Codex generated_images.

Final prompt set:
- Tier 2: transparent-background polished realistic sci-fi exterior sprite; orthographic top-down compact broad silver twin-nozzle assembly, mounting crossbar at top, exhaust bells pointing down, purple conduits, symmetric black steel detailing, 2:1 composition. No flames, text, floor, border or background.
- Tier 3: transparent-background heavy silver twin-nozzle assembly, top mounting crossbar, downward bells, blue conduits with green/purple highlights, ribbed cooling and dense pipes, symmetric 3:2 composition. No flames, text, floor or border. Nozzle centers at quarter and three-quarter width.
- Tier 4: transparent PNG advanced armored twin-nozzle sprite, silver/black metal, emerald-turquoise coolant conduits, enhanced heat shields and radiators, overhead view, top crossbar, downward bells, symmetric 3:2 composition. No backdrop, shadow, text, floor or flames; transparent space between nozzles.
- Tier 5: transparent RGBA heavy advanced twin-bell exterior thruster, overhead view, top mounting crossbar, silver/black armor, red coolant pipes, magnetic collars and thermal radiators, symmetric 2:1 composition. No backdrop, cast shadow, floor, text or flames; nozzle centers at 25% and 75% width.

Shared CSS supplies separate tier-colored exhaust animation. A single sprite spans each SIC's printed footprint, rather than repeating it per cell. The card face is shared across the shop, rotated collection, and outer-viewport inspector; hover lift, deck spread/fold, floating detail and edge glow all respect reduced motion. These are presentation effects, not new game actions.

## Exterior Presentation, September 8

Built-in image generation produced two new repository assets. The thruster card image is unchanged; the ship views now use a separate sprite. Original files remain in Codex generated_images.

- `exhaust-thruster-1-sprite.png`: single orthographic top-down sci-fi exhaust thruster on genuine transparency, mounting collar at top and flared nozzle pointing down. Symmetric dark titanium and brushed silver, cyan conduits, machined ribbing; no flame, floor, text or surrounding shadow. Game presentation rotates this sprite away from the adjacent hull and adds the animated flame separately.
- `starship-hull-plating.png`: seamless square material texture, orthographic exterior starship armor, brushed titanium silver and graphite rectangular plates, fine recessed seams and rivets, even lighting. No interiors, machinery, glow, text, perspective or border.

Reference: core PDF page 48, exterior thruster drawing. This is a visual layer only; no ship movement or AU boost action has been added.

## Power Reactors and Thruster Reassignment, September 8

Built-in image generation produced `power-engine-1-graphic.png` through `power-engine-6-graphic.png` in this repository. Existing EN engine floorplans are unchanged. Original `en-engine-{1..6}-graphic.png` assets are reserved for thrusters; the first is also copied to `exhaust-thruster-1-graphic.png` for its card and exterior representation.

Prompt set: one square, realistic three-quarter sci-fi RPG item render per tier, internal electrical power generator, vertically oriented sealed reactor chamber, cable bus connections, cooling systems, industrial gunmetal/silver housing. Whole object centered with eight percent margin against black. No exhaust nozzle, rocket jet, propeller, text, border, room, or floorplan. Consistent family of vertically mounted reactors, readable at thumbnail size.

Tier details: (1) light blue plasma, compact housing; (2) purple plasma, double containment; (3) blue plasma with green/purple conduits, triple containment; (4) greenish blue plasma, elaborate cooling manifolds; (5) red plasma, advanced armor and energy arcs; (6) black-hole purple singularity and exotic gravitational hoops.


Generated with the built-in image generation tool, September 7, 2026.
Project assets: `en-au-engine-{1..6}-{graphic,floor-plan}.png` and
`au-en-engine-{1..6}-{graphic,floor-plan}.png` in the repository root.
Original outputs remain in the Codex generated-images directory.

## Prompt Set

Each family/tier received a separate card illustration and floorplan request.

- Power Hybrid: a primary circular electrical turbine reactor with smaller
  auxiliary capacitor cylinders connected at its sides as one machine.
- Action Hybrid: two long hexagonal auxiliary capacitor banks flanking a smaller
  circular electric generator, connected as one machine.
- Tier colors: 1 light blue; 2 purple; 3 blue with green/purple highlights;
  4 greenish blue with enhanced cooling/containment; 5 red with enhanced armor/fins;
  6 black-hole purple with exotic field coils and singularity containment.
- Card composition: square, realistic three-quarter product render, isolated on
  near-black, centered fully visible machinery occupying about 80% of the frame;
  silver/gunmetal hardware, no text, room, floorplan, people, borders, or watermark.
- Floorplan composition: square full bleed, strictly overhead orthographic gray
  metal engineering deck; centered machinery and surrounding clear walking space
  to all four edge midpoints, small edge/corner consoles; no outer walls, doors,
  grid lines, text, people, or perspective. Shared map code supplies topology,
  stations, and collision rather than interpreting art pixels.

## Cockpit and Ionic Card-Art Pass

Generated with the built-in image-generation tool. Original generated PNGs were copied without modifying the existing placement sprites. Final assets are in the repository root:

- ionic-pulse-thruster-1-card.png through ionic-pulse-thruster-5-card.png
- cockpit-1-card.png
- cockpit-1-floor-plan.png

Prompt set: each Ionic card is a square product render on black, realistic bright machined silver/graphite machinery in a three-quarter perspective, fully visible and filling roughly 85 percent of the frame. No labels, frames, people, floorplan, or flames. Magnetic aperture rings emit semicircular ion pulses. Tier 1 uses one light-blue aperture; tier 2 twin purple apertures; tier 3 blue with green/purple conduits; tier 4 teal with extra fins and suspended focusing rings; tier 5 red with heavy armor and capacitor banks. Preserve strong silhouette and thumbnail readability while making each tier progressively more advanced.

Cockpit card prompt: one empty pilot chair with a wraparound cyan console, joystick, throttle and forward viewport, realistic three-quarter cutaway on black, complete compact single-person station, no text or people.

Cockpit floorplan prompt: perfectly overhead orthographic square gray metal floor, no outer walls, doors, grid, labels or people. Compact chair and console in the upper-left corner (around 22 percent across, 25 percent down), open walking floor elsewhere. Shared renderer supplies station markers and boundaries.
