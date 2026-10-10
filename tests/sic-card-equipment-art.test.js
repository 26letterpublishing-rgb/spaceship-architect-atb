const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const maps=require('../ship-map-core'),manifest=require('../scripts/sic-card-art-20261009.json');
const {resolvePublicAsset}=require('../public-assets'),root=path.resolve(__dirname,'..');
test('replacement equipment art is public, distinct and separated from every floorplan and sprite',()=>{
  const used=new Set(),hashes=new Set();let bytes=0,cards=0;
  for(const asset of manifest.assets){
    const file=resolvePublicAsset(root,'/'+asset.file);assert.ok(file,asset.id);
    const data=fs.readFileSync(file);assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
    const hash=crypto.createHash('sha256').update(data).digest('hex');assert.ok(!hashes.has(hash),asset.id);hashes.add(hash);bytes+=data.length;
    for(const [type,d] of Object.entries(maps.catalog))if(d.cardArt===asset.file){
      used.add(asset.id);cards++;for(const field of ['image','sprite','floorplanPreview'])assert.notEqual(d[field]?.split('?')[0],asset.file,type+' '+field);
    }
  }
  assert.equal(used.size,manifest.assets.length);assert.equal(cards,86);
  assert.ok(bytes<4*1024*1024,'All replacement art stays under 4 MiB');
});
