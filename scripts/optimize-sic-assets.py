"""Build web-only derivatives. Original PNGs remain unchanged for future printing."""
import json
import re
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
manifest = {}
for source in sorted(root.glob('*.png')):
    name = source.name
    if not (re.match(r'(?:au-|en-|power-)?(?:en-|au-)?engine-\d-', name)
            or re.match(r'(?:exhaust|ionic-pulse)-thruster-\d-', name)
            or name.startswith(('lock-on-', 'rapid-laser-', 'weapon-console-', 'cockpit-', 'bridge-', 'shield-', 'sensors-', 'sensor-console-', 'life-support-', 'nutritional-supplement-'))
            or name in ('hallway.png', 'starship-hull-plating.png', 'pilot-console-art.png')):
        continue
    floor = 'floor-plan' in name or name in ('hallway.png', 'starship-hull-plating.png')
    sprite = 'sprite' in name or (name.startswith('ionic-pulse-thruster') and 'graphic' in name)
    tier = int(re.search(r'-(\d+)-', name).group(1)) if re.search(r'-(\d+)-', name) else 1
    limit = max(720, tier * 256) if floor or sprite else 360
    if name.startswith('sensors-') and floor:
        limit = 720 if tier <= 4 else 1440
    if name.startswith('lock-on-') and floor:
        limit = 720 if tier <= 4 else 1440
    if name.startswith('rapid-laser-') and sprite:
        limit = 720 if tier <= 2 else 1440
    if name in ('weapon-console-background.png', 'pilot-console-art.png', 'shield-console-background.png', 'sensor-console-background.png'):
        limit = 1920
    target = source.with_name(source.stem + '-web.webp')
    with Image.open(source) as image:
        original_size = image.size
        alpha = 'A' in image.getbands()
        image = image.convert('RGBA' if alpha else 'RGB')
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=92 if floor or sprite else 90, method=6)
        manifest[name] = {'file': target.name, 'sourcePixels': list(original_size), 'webPixels': list(image.size),
                          'sourceBytes': source.stat().st_size, 'webBytes': target.stat().st_size, 'alpha': alpha}
(root / 'sic-web-assets.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
before = sum(v['sourceBytes'] for v in manifest.values())
after = sum(v['webBytes'] for v in manifest.values())
print(f'{len(manifest)} assets: {before:,} -> {after:,} bytes ({100*(1-after/before):.1f}% reduction). Originals preserved.')
