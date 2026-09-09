# Pilot Console and Print-Safe Web Assets

## Rules

- Interactive cockpit stations replace normal combat choices with Pilot Console and Leave Station. The console contains Move Ship and Leave Station. Leave opens the existing character route picker; cancellation retains the station, and confirmed travel leaves it.
- Move Ship starts a real delayed action, not immediate ship movement. Normal pilot ATB is held during input. Performance is four positive bars, base speed Very Fast (14). Pilot/Helm whole skill levels map to Ingenuity 0 / 1 / 2 / 3 / 4 at 0 / 1-2 / 3-4 / 5 / 6+. NPCs use their existing general mental skill unless a pilot override is supplied.
- Quality is the rounded-up average of the highest two operational installed thruster tiers, or the lone tier. The existing radial has four positive bars, so tier-derived values above four saturate that control. Other factors remain neutral. `delay-rules.js` shares the existing flat/percentage/critical formula with the manual delay UI.
- Previously issued ship motion continues during input. At completion, the new route starts at the actual current position. AU is checked on submission and charged at launch; if the reserve has been spent meanwhile, the previous route is retained and an error is logged. Impaired boosted thrusters contribute neither extra speed nor AU cost at launch. No AU is charged for canceled input.
- Ordinary actions, including leaving, are unavailable during input. Forced GM relocation away interrupts it. Once launched, motion remains independent of the pilot. This is not a queued effect; existing queued-effect behavior is unchanged.

## Presentation

- New original built-in image-generation artwork: `pilot-console-art.png`; web display uses `pilot-console-art-web.webp`. The physical helm surrounds live fleet condition, hex map, coordinate controls, combat activity, AU cells/recharge sweep, and Performance/Ingenuity/Quality radials. Decorative calibration telemetry is marked aria-hidden and never drives rules.
- Prompt: original wide 16:9 realistic spacecraft helm from the seated pilot position, readable Star Trek flight instrumentation combined with angular layered Perfect Dark menu influence; brushed titanium and graphite, cyan lamps and restrained amber/mint accents; large empty central dark-glass screen, narrower empty auxiliary screens, physical switches and sculpted console lip; no people, logos, baked-in text, numbers or map. Live HTML supplies the instruments.
- Cockpit/bridge hull plating now has a glazed opening onto its floorplan. This is shared presentation only; EDG placement and one-square Cockpit 1 are unchanged.

## Asset Policy

- All original PNGs remain byte-for-byte intact (the new console source is additional). Gold Standard remains frozen. These source files are the future print masters; no artificial upscaling.
- `scripts/optimize-sic-assets.py` uses Pillow to create 83 proportional WebP derivatives. Card illustrations fit within 360 pixels. Floorplans/exterior sprites use at least a 720-pixel target, scaled by footprint/tier up to the source size. The source dimensions always cap output, and transparency is retained.
- Manifest `sic-web-assets.json` records original and web dimensions/bytes. The server resolves existing image URLs to derivatives with image/webp content type, covering all consumers without brittle filename replacement. A future print route must explicitly select originals rather than use this web resolver.
- Combined selected asset payload: 193,564,467 original bytes versus 10,856,838 web bytes, a 94.4 percent reduction. This measures the asset set, not a claim that each page downloads all of it.
- Planned print scale: each 3x3 combat-mesh cell is half an inch, so one large square is 1.5 inches. At 300 DPI, the desired source is 450 pixels per large square. Some large originals are below that target; preserving them does not create additional detail. Print Starship itself is not implemented here.

## Verification

Automated tests cover delay math/skill boundaries, mixed tiers, server-held input, route replacement, boost loss, serialization, forced departure, canopy markup, and source/derivative dimensions. The optional Edge script exercises repeated NPC/PC orders in a fresh fixture campaign, actual mouse destination locking, locked Leave during input, Cancel Leave, confirmed Leave, 1366/1920 desktop viewports, private player HP, card imagery, Hull canopy and Explore GM/PC views. Screenshots remain in ignored test-artifacts/cockpit. This is not exhaustive gameplay, full character-creation, mobile, PostgreSQL or hosted Render testing.
