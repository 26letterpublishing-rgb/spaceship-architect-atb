# Hybrid Engine Artwork

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
