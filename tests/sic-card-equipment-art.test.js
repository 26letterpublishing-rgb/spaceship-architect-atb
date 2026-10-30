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
  assert.equal(manifest.assets.length,27);assert.equal(used.size,26);assert.equal(cards,81);
  assert.ok(bytes<4*1024*1024,'All replacement art stays under 4 MiB');
});

// Exact retained mappings protect other families.
const retained={
  "decent-hover": "card-decent-hover-equipment-v2.webp",
  "probe-launcher": "card-probe-launcher-equipment-v2.webp",
  "transporter": "card-transporter-equipment-v2.webp",
  "repair-drone-1": "card-repair-drone-equipment-v2.webp",
  "repair-drone-2": "card-repair-drone-equipment-v2.webp",
  "repair-drone-3": "card-repair-drone-equipment-v2.webp",
  "repair-drone-4": "card-repair-drone-equipment-v2.webp",
  "repair-drone-5": "card-repair-drone-equipment-v2.webp",
  "backup-generator": "card-backup-generator-equipment-v2.webp",
  "antenna-1": "card-antenna-equipment-v2.webp",
  "antenna-2": "card-antenna-equipment-v2.webp",
  "antenna-3": "card-antenna-equipment-v2.webp",
  "antenna-4": "card-antenna-equipment-v2.webp",
  "holographic-projector": "card-holographic-projector-equipment-v2.webp",
  "scramble-box": "card-scramble-box-equipment-v2.webp",
  "ship-ai": "card-ship-ai-equipment-v2.webp",
  "bar": "card-bar-equipment-v2.webp",
  "brig": "card-brig-equipment-v2.webp",
  "darkveil-1": "card-darkveil-equipment-v2.webp",
  "darkveil-2": "card-darkveil-equipment-v2.webp",
  "darkveil-3": "card-darkveil-equipment-v2.webp",
  "darkveil-4": "card-darkveil-equipment-v2.webp",
  "darkveil-5": "card-darkveil-equipment-v2.webp",
  "darkveil-6": "card-darkveil-equipment-v2.webp",
  "darkveil-7": "card-darkveil-equipment-v2.webp",
  "darkveil-8": "card-darkveil-equipment-v2.webp",
  "darkveil-9": "card-darkveil-equipment-v2.webp",
  "darkveil-10": "card-darkveil-equipment-v2.webp",
  "beam-laser-1": "card-beam-laser-equipment-v2.webp",
  "beam-laser-2": "card-beam-laser-equipment-v2.webp",
  "beam-laser-3": "card-beam-laser-equipment-v2.webp",
  "beam-laser-4": "card-beam-laser-equipment-v2.webp",
  "beam-laser-5": "card-beam-laser-equipment-v2.webp",
  "beam-laser-6": "card-beam-laser-equipment-v2.webp",
  "beam-laser-7": "card-beam-laser-equipment-v2.webp",
  "beam-laser-8": "card-beam-laser-equipment-v2.webp",
  "ripple-cannon-1": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-2": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-3": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-4": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-5": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-6": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-7": "card-ripple-cannon-equipment-v2.webp",
  "ripple-cannon-8": "card-ripple-cannon-equipment-v2.webp",
  "ion-pulse-cannon-1": "card-ion-pulse-cannon-equipment-v2.webp",
  "ion-pulse-cannon-2": "card-ion-pulse-cannon-equipment-v2.webp",
  "ion-pulse-cannon-3": "card-ion-pulse-cannon-equipment-v2.webp",
  "ion-pulse-cannon-4": "card-ion-pulse-cannon-equipment-v2.webp",
  "ion-pulse-cannon-5": "card-ion-pulse-cannon-equipment-v2.webp",
  "cpu-security-1": "card-cpu-security-equipment-v2.webp",
  "cpu-security-2": "card-cpu-security-equipment-v2.webp",
  "cpu-security-3": "card-cpu-security-equipment-v2.webp",
  "cpu-security-4": "card-cpu-security-equipment-v2.webp",
  "cpu-security-5": "card-cpu-security-equipment-v2.webp",
  "cpu-security-6": "card-cpu-security-equipment-v2.webp",
  "cpu-security-7": "card-cpu-security-equipment-v2.webp",
  "cpu-security-8": "card-cpu-security-equipment-v2.webp",
  "hacking-module-1": "card-hacking-module-equipment-v2.webp",
  "hacking-module-2": "card-hacking-module-equipment-v2.webp",
  "hacking-module-3": "card-hacking-module-equipment-v2.webp",
  "hacking-module-4": "card-hacking-module-equipment-v2.webp",
  "hacking-module-5": "card-hacking-module-equipment-v2.webp",
  "warp-drive-zero": "card-warp-drive-equipment-v2.webp",
  "warp-drive-1": "card-warp-drive-equipment-v2.webp",
  "warp-drive-2": "card-warp-drive-equipment-v2.webp",
  "warp-drive-3": "card-warp-drive-equipment-v2.webp",
  "warp-drive-4": "card-warp-drive-equipment-v2.webp",
  "warp-drive-5": "card-warp-drive-equipment-v2.webp",
  "warp-drive-x": "card-warp-drive-equipment-v2.webp",
  "ew-ftl-drive": "card-ew-ftl-drive-equipment-v2.webp",
  "cloaking-device": "card-cloaking-device-equipment-v2.webp",
  "missile-launcher-1": "card-missile-launcher-equipment-v2.webp",
  "missile-launcher-2": "card-missile-launcher-equipment-v2.webp",
  "missile-launcher-3": "card-missile-launcher-equipment-v2.webp",
  "missile-launcher-4": "card-missile-launcher-equipment-v2.webp",
  "missile-launcher-5": "card-missile-launcher-equipment-v2.webp",
  "ballistic-rail-cannon": "card-rail-cannon-equipment-v2.webp",
  "manipulation-arm": "card-manipulation-arm-equipment-v2.webp",
  "tractor-beam": "card-tractor-beam-equipment-v2.webp",
  "escape-pods": "card-escape-pods-equipment-v2.webp",
  "ripple-reflector": "card-ripple-reflector-equipment-v2.webp"
};
const rapidRoles={
  "rapid-laser-1": {
    "image": "rapid-laser-1-sprite.png?v=20260911-pilot-web-assets-1",
    "sprite": "rapid-laser-1-sprite.png"
  },
  "rapid-laser-2": {
    "image": "rapid-laser-2-sprite.png?v=20260911-pilot-web-assets-1",
    "sprite": "rapid-laser-2-sprite.png"
  },
  "rapid-laser-3": {
    "image": "rapid-laser-3-sprite.png?v=20260911-pilot-web-assets-1",
    "sprite": "rapid-laser-3-sprite.png"
  },
  "rapid-laser-4": {
    "image": "rapid-laser-4-sprite.png?v=20260911-pilot-web-assets-1",
    "sprite": "rapid-laser-4-sprite.png"
  },
  "rapid-laser-5": {
    "image": "rapid-laser-5-sprite.png?v=20260911-pilot-web-assets-1",
    "sprite": "rapid-laser-5-sprite.png"
  }
};
const approvedHashes=["31c520e517034416cd9c9f1c4775dc6c61c48369e175f89551b1e26759568e0c","45d8494c3822ccd3012e41a54f2805222c59afbaf173a04bc22a58528bce74df","79b51c0c72c5d6d6f8aeafec6d773ecfeaa94a676c9a598b0246bdaefabddc1d","538433626281544321ebb192ad81d367c4ada9b649b018c8882551a786743233","69447d6ba49ad63674290fc5ba5b6e2144dddfb3ef5d57fb0508a571cd3385da"];
test('approved Rapid designs retain exact bytes and non-card asset roles',()=>{
 for(const [type,file] of Object.entries(retained))assert.equal(maps.catalog[type].cardArt,file,type);
 for(let tier=1;tier<=5;tier++){
 const type='rapid-laser-'+tier,file='sic-rapid-laser-'+tier+'-approved.png',d=maps.catalog[type];assert.equal(d.cardArt,file);
 const publicFile=resolvePublicAsset(root,'/'+file);assert.ok(publicFile);const b=fs.readFileSync(publicFile);
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),approvedHashes[tier-1]);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);
 for(const field of ['image','sprite','floorplanPreview'])assert.equal(d[field],rapidRoles[type][field],type+' '+field);
 }
});
