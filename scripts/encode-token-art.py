"""Encode generated transparent atlases for delivery; original artwork is preserved."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'scripts/token-art-20261010.json').read_text(encoding='utf-8'))
for asset in manifest['assets']:
 source=Path(asset['source']);target=root/asset['output']
 if target.exists():continue
 image=Image.open(source).convert('RGBA')
 assert image.getextrema()[3][0]==0, f"Missing transparent background: {source}"
 image.thumbnail((768,768) if asset['id'].startswith('ship-') else (512,512),Image.Resampling.LANCZOS)
 image.save(target,'WEBP',quality=88,method=6)
 print(asset['id'],image.size,target.stat().st_size)
