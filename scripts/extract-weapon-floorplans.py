"""Extract web floorplans from canonical tier atlases; never alter the source SVGs."""
from pathlib import Path
from PIL import Image
import base64
import io
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {'beam-laser-1': 'beam-laser-tiers.svg#tier-1', 'beam-laser-2': 'beam-laser-tiers.svg#tier-2', 'beam-laser-3': 'beam-laser-tiers.svg#tier-3', 'beam-laser-4': 'beam-laser-tiers.svg#tier-4', 'beam-laser-5': 'beam-laser-tiers.svg#tier-5', 'beam-laser-6': 'beam-laser-tiers.svg#tier-6', 'beam-laser-7': 'beam-laser-tiers.svg#tier-7', 'beam-laser-8': 'beam-laser-tiers.svg#tier-8', 'ripple-cannon-1': 'ripple-cannon-tiers.svg#tier-1', 'ripple-cannon-2': 'ripple-cannon-tiers.svg#tier-2', 'ripple-cannon-3': 'ripple-cannon-tiers.svg#tier-3', 'ripple-cannon-4': 'ripple-cannon-tiers.svg#tier-4', 'ripple-cannon-5': 'ripple-cannon-tiers.svg#tier-5', 'ripple-cannon-6': 'ripple-cannon-tiers.svg#tier-6', 'ripple-cannon-7': 'ripple-cannon-tiers.svg#tier-7', 'ripple-cannon-8': 'ripple-cannon-tiers.svg#tier-8', 'ion-pulse-cannon-1': 'ion-pulse-cannon-tiers.svg#tier-1', 'ion-pulse-cannon-2': 'ion-pulse-cannon-tiers.svg#tier-2', 'ion-pulse-cannon-3': 'ion-pulse-cannon-tiers.svg#tier-3', 'ion-pulse-cannon-4': 'ion-pulse-cannon-tiers.svg#tier-4', 'ion-pulse-cannon-5': 'ion-pulse-cannon-tiers.svg#tier-5'}
for name, source in SOURCES.items():
    filename, fragment = source.split('#')
    svg = ET.fromstring((ROOT / filename).read_text())
    view = next(e for e in svg if e.tag.endswith('view') and e.get('id') == fragment)
    x, y, width, height = map(int, view.get('viewBox').split())
    image = next(e for e in svg if e.tag.endswith('image'))
    atlas = Image.open(io.BytesIO(base64.b64decode(image.get('href').split(',')[1]))).convert('RGBA')
    tile = atlas.crop((x, y, x + width, y + height))
    tile = tile.crop(tile.getbbox())
    tile.save(ROOT / ('weapon-floorplan-' + name + '.webp'), 'WEBP', quality=85, method=6)
