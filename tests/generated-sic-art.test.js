const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const maps=require('../ship-map-core'),ammo=require('../missile-ammunition'),manifest=require('../scripts/generated-sic-art.json');
test('recent SIC catalog uses distinct generated WebP assets with a bounded download size',()=>{
  const hashes=new Set();let bytes=0;
  assert.equal(manifest.length,27);
  for(const entry of manifest){
    const name=entry.id==='vr-training-room'?'vr-training-room-3x3.webp':'sic-art-'+entry.id+'.webp',data=fs.readFileSync(path.join(__dirname,'..',name));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
    const hash=require('node:crypto').createHash('sha256').update(data).digest('hex');assert.ok(!hashes.has(hash),entry.id+' must have distinct art');hashes.add(hash);bytes+=data.length;
    if(entry.id==='meeting-room-console')continue;
    const definition=ammo.catalog[entry.id]||maps.catalog[entry.id];assert.ok(definition,entry.id);
    const selected=definition.cardArt||definition.image;
    assert.ok(selected.includes(name)||selected===`card-${entry.id}-equipment.webp`,entry.id+' uses its generated equipment image');
    if(selected===`card-${entry.id}-equipment.webp`)assert.ok(fs.existsSync(path.join(__dirname,'..',selected)));
  }
  assert.ok(bytes<3*1024*1024,'All 27 assets together stay under 3 MiB');
});
