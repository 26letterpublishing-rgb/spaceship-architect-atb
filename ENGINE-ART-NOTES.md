# Hybrid Engine Artwork

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
