const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const maps=require('../ship-map-core'),manifest=require('../scripts/generated-transit-art.json');

test('warp, rail, destruct, landing and fuel artwork uses distinct generated assets',()=>{
  assert.equal(manifest.length,17);const hashes=new Set();let bytes=0;
  for(const entry of manifest){
    const name='sic-art-'+entry.id+'.webp',data=fs.readFileSync(path.join(__dirname,'..',name));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
    const hash=crypto.createHash('sha256').update(data).digest('hex');assert.ok(!hashes.has(hash),entry.id+' needs distinct art');hashes.add(hash);bytes+=data.length;
    const definition=entry.id.startsWith('warp-fuel-')?maps.fuelCatalog[entry.id.at(-1).toUpperCase()]:maps.catalog[entry.id];
    assert.ok(definition,entry.id);assert.ok([definition.cardArt,definition.image,definition.sprite].some(url=>url?.includes(name)),entry.id+' retains its generated artwork for its original role');
  }
  assert.ok(bytes<3*1024*1024,'The 17 images together must remain below 3 MiB');
});

test('primary SIC artwork has no inline geometric placeholders',()=>{
  for(const [id,definition] of Object.entries(maps.catalog))assert.ok(!(definition.cardArt||definition.image||'').startsWith('data:image/svg'),id);
  assert.ok(maps.catalog['ballistic-rail-cannon'].sprite.includes('sic-art-ballistic-rail-cannon.webp'));
  assert.ok(maps.catalog['ballistic-rail-cannon'].image.includes('lock-on-1-floor-plan.png'),'retain the interior control room');
  assert.equal(maps.catalog['warp-drive-x'].warpSecondsPerParsec,600,'artwork must not change travel time');
});
