# Local Transit Artwork Fix

Completed September 14, 2026. Authorized by `#local`; no commit, upload or Render access.

## Corrected Scope

The preceding 27-image pass omitted the older warp, rail, self-destruct, landing and fuel families. Those definitions still explicitly generated or referenced geometric placeholder graphics; this was not a browser-cache issue.

- Added 17 distinct generated raster images: Warp Zero, 1-5 and X; Ballistic Rail Cannon; Self-Destruct; Decent Hover and Aerofoil; fuel grades F, D, C, B, A and S.
- Shared catalog definitions now use these images. Rail retains its separate interior control-room floorplan and uses the generated exterior sprite.
- Warp and Self-Destruct consoles show their equipment artwork. Warp retains its animated star window and hides the machinery during travel.
- Warp X displays `10 minutes / parsec`, rather than the recurring decimal in hours. Stored duration remains 600 seconds; no mechanics changed.
- Low-resolution silhouettes, existing card controls, stations, placement geometry and resource consumption remain unchanged.

## Assets

Generated with the built-in image-generation tool. Prompts and original source paths are recorded in `scripts/generated-transit-art.json`, including the Warp 3 transparency edit. Original PNGs remain under the Codex generated-images directory. The app-ready copies are the root `sic-art-<id>.webp` files listed by that manifest.

The existing encoder now accepts an optional manifest argument. Resizing and WebP encoding used Sharp, not semantic image editing. These 17 app images total 2,113,058 bytes (about 2.02 MiB). Alpha checks confirmed transparent corner pixels and nonopaque image data for every asset. The earlier 27-image manifest is unchanged.

## Verification

- Full automated suite: 376 passed, zero failed. Output: `test-artifacts/transit-art-tests.log`.
- New tests check all 17 definitions, distinct image hashes, WebP validity, aggregate size, unchanged Warp X timing and removal of inline geometric primary artwork.
- Real Chrome: decoded all 17 catalog images, checked Warp X wording, bought/placed Warp Zero, Self-Destruct and Rail, enabled high resolution with its actual label control, purchased fuel, updated mineral stock and reloaded.
- Independent PC in an ordinary campaign: warp equipment displayed; route calculation, activation/cancellation, animated travel, bridge stars, GM downtime, early exit report, Self-Destruct approval and registered cancellation passed. Existing mobile control-bound checks also passed; this is not a comprehensive mobile layout audit.
- Inspected desktop catalog, high-resolution floorplan and console screenshots under `test-artifacts/warp-transit/`.
- 89 root JavaScript syntax checks passed. Gold Standard structural preservation check and whitespace check passed. Personal `data/campaigns.json` unchanged.

The initial added screenshot check needed to click the custom toggle's label instead of its overlaid checkbox; the final browser run passed. The image-decode check explicitly requests eager loading for off-screen catalog images. Neither test-harness correction changes app behavior.

## Playtest

Fresh isolated preview: http://127.0.0.1:8803/showcase.html

PID 17204; data directory `C:/Users/zombi/AppData/Local/SpaceshipArchitect/local-transit-art-20260914`. Earlier previews and personal campaigns were left untouched. The older preview processes may retain server-side catalog definitions in memory; use the fresh URL for this pass.

Logs: `test-artifacts/transit-art-preview.log` and `test-artifacts/transit-art-preview-error.log`.
