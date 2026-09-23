"""Package generated atlases into cached SVG views without repainting their pixels."""
import base64
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
for family, columns, rows in [('beam-laser', 4, 2), ('ripple-cannon', 4, 2), ('ion-pulse-cannon', 5, 1), ('darkveil', 5, 2), ('cpu-security', 4, 2), ('hacking-module', 5, 1)]:
    source = root / f'{family}-tier-atlas.png'
    with Image.open(source) as artwork:
        w, h = artwork.size
        if family not in ('darkveil', 'cpu-security', 'hacking-module'):
            assert artwork.mode == 'RGBA' and artwork.getchannel('A').getextrema()[0] == 0, f'{family} needs actual transparency'
        artwork.save(root / f'{family}-tier-atlas.webp', 'WEBP', quality=93, method=6)
    data = base64.b64encode((root / f'{family}-tier-atlas.webp').read_bytes()).decode('ascii')
    cw, ch = w / columns, h / rows
    views = ''.join(f'<view id="tier-{n+1}" viewBox="{n%columns*cw:g} {n//columns*ch:g} {cw:g} {ch:g}"/>' for n in range(columns*rows))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{cw:g}" height="{ch:g}" viewBox="0 0 {cw:g} {ch:g}">{views}<image width="{w}" height="{h}" href="data:image/webp;base64,{data}"/></svg>'
    (root / f'{family}-tiers.svg').write_text(svg, encoding='ascii')
    print(f'{family}: {columns*rows} distinct views, {len(svg):,} cached bytes')
