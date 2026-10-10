"""Encode approved AI card illustrations; leave generated masters unchanged."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'scripts/sic-card-art-20261009.json').read_text())
for asset in manifest['assets']:
    with Image.open(asset['source']) as image:
        image.thumbnail((768, 768), Image.Resampling.LANCZOS)
        image.save(root / asset['file'], 'WEBP', quality=86, method=6)
print(f"Encoded {len(manifest['assets'])} card assets")
