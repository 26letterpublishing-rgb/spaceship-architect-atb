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
  assert.equal(manifest.assets.length,27);assert.equal(used.size,22);assert.equal(cards,60);
  assert.ok(bytes<4*1024*1024,'All replacement art stays under 4 MiB');
});

// Exact retained mappings protect other families.
const retained={
  "decent-hover": "card-decent-hover-equipment-v2.webp",
  "probe-launcher": "card-probe-launcher-equipment-v2.webp",
  "transporter": "card-transporter-equipment-v2.webp",
  "repair-drone-1": "repair-drone-1-sprite.webp",
  "repair-drone-2": "repair-drone-2-sprite.webp",
  "repair-drone-3": "repair-drone-3-sprite.webp",
  "repair-drone-4": "repair-drone-4-sprite.webp",
  "repair-drone-5": "repair-drone-5-sprite.webp",
  "backup-generator": "card-backup-generator-equipment-v2.webp",
  "antenna-1": "antenna-1.webp",
  "antenna-2": "antenna-2.webp",
  "antenna-3": "antenna-3.webp",
  "antenna-4": "antenna-4.webp",
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
  "warp-drive-zero": "sic-art-warp-drive-zero.webp",
  "warp-drive-1": "sic-art-warp-drive-1.webp",
  "warp-drive-2": "sic-art-warp-drive-2.webp",
  "warp-drive-3": "sic-art-warp-drive-3.webp",
  "warp-drive-4": "sic-art-warp-drive-4.webp",
  "warp-drive-5": "sic-art-warp-drive-5.webp",
  "warp-drive-x": "sic-art-warp-drive-x.webp",
  "ew-ftl-drive": "card-ew-ftl-drive-equipment-v2.webp",
  "cloaking-device": "card-cloaking-device-equipment-v2.webp",
  "missile-launcher-1": "sic-art-missile-launcher-1.webp",
  "missile-launcher-2": "sic-art-missile-launcher-2.webp",
  "missile-launcher-3": "sic-art-missile-launcher-3.webp",
  "missile-launcher-4": "sic-art-missile-launcher-4.webp",
  "missile-launcher-5": "sic-art-missile-launcher-5.webp",
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
test('Missile Launcher cards reuse five distinct original tier images without changing placement art',()=>{
 const expectedHashes=['2bd9e23de428589ac7cebae88cb77087d598bba6ac0f3e65cfd8ced1436ec44e','649f917ed8c0a82b1080fa847a15b0c2e23fb5698e0ccf9bed111ba2f2c57273','72feb6404c9c1896ecf051c4496b449bbd5bfc6dd8950a7fb11903e582e710f9','1a47c1f1c582fce02111269cc2d3c3e44cfb98051470a5b446d09678154b981d','cfc9041e0e7d082e5d3723b6537f7c6ca5734b6cd6cd034a6cb68609dc6c3d1a'];
 const hashes=new Set();
 for(let tier=1;tier<=5;tier++){
  const type=`missile-launcher-${tier}`,d=maps.catalog[type],file=`sic-art-missile-launcher-${tier}.webp`;
  assert.equal(d.cardArt,file);assert.equal(d.sprite,file);
  assert.equal(d.image,'weapon-room-floor-plan.png?v=20260911-pilot-web-assets-1');
  const publicFile=resolvePublicAsset(root,'/'+file);assert.ok(publicFile);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(publicFile)).digest('hex');
  assert.equal(digest,expectedHashes[tier-1]);hashes.add(digest);
  assert.deepEqual(Object.entries(maps.catalog).filter(([,entry])=>entry.cardArt===file).map(([key])=>key),[type]);
 }
 assert.equal(hashes.size,5);
});
test('Antenna cards reuse distinct original tier equipment and retain exterior roles',()=>{
 const expectedHashes=['f709fee41c78edcfa92a4ba879441dae9f494d501a7fee8a5f70ccec6001a9d2','7c89ad5299000faa3c5dd544a37ad822f1e8507b5fdb15ee2c054b986af3347e','a6186bdfad4728427cf595de320befe3e9917c452649e23e10f95c84c17c089b','19777c84ba997512d94d6d6eeb612637bbdc2b4aea02d8dceb8a61fadf9198bc'];
 const hashes=new Set();
 for(let tier=1;tier<=4;tier++){
  const type=`antenna-${tier}`,d=maps.catalog[type],file=`${type}.webp`;
  assert.equal(d.cardArt,file);assert.equal(d.sprite,file);
  assert.equal(d.image,file+'?v=20260911-pilot-web-assets-1');
  const publicFile=resolvePublicAsset(root,'/'+file);assert.ok(publicFile);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(publicFile)).digest('hex');
  assert.equal(digest,expectedHashes[tier-1]);hashes.add(digest);
  assert.deepEqual(Object.entries(maps.catalog).filter(([,entry])=>entry.cardArt===file).map(([key])=>key),[type]);
 }
 assert.equal(hashes.size,4);
});
test('Warp Drive cards reuse seven distinct original reactors without changing EW FTL or floorplan art',()=>{
 const tiers=['zero',1,2,3,4,5,'x'];
 const expectedHashes=['41d3080653cd1e4bc68c37d0d60a9fe64c6e59bd42dc8db79c9298a3fda1bd68','22fa486145fe5811b6e12584a4599950a5d28ad1f3738f75559701b8f20fedf0','35601ea264b47fbcbab186a1415a9d499a90ecd827e9e931f3a8b30bd72fa86c','77e022fc716a1ad2c0b6b3905fea6f582a5886c3a2b484fb1bd88bd4c223ce29','392b627864b3266bf0e5f79a4f263697e87168750abf9266feec0a9bd7131fdf','5390a41abec529ff5ecf82a6450343fc32e9c576f37a47b6fd52e91b8243a256','d7499379ac418486fef482bc28d0bb6fd2f219c4c01fce36697f6bb15aea6289'];
 const hashes=new Set();
 tiers.forEach((tier,index)=>{
  const type=`warp-drive-${tier}`,d=maps.catalog[type],file=`sic-art-${type}.webp`;
  assert.equal(d.cardArt,file);assert.equal(d.image,file+'?v=20260911-pilot-web-assets-1');
  const publicFile=resolvePublicAsset(root,'/'+file);assert.ok(publicFile);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(publicFile)).digest('hex');
  assert.equal(digest,expectedHashes[index]);hashes.add(digest);
  assert.deepEqual(Object.entries(maps.catalog).filter(([,entry])=>entry.cardArt===file).map(([key])=>key),[type]);
 });
 assert.equal(hashes.size,7);assert.equal(maps.catalog['ew-ftl-drive'].cardArt,'card-ew-ftl-drive-equipment-v2.webp');
});
test('Repair Drone cards reuse five original robots and retain their drone and bay mappings',()=>{
 const expectedHashes=['7c916931c314ff349f84f72ac58285431893d5263431565916426c28d59c136a','9f3bd7602b319b34dc389e0df92b328e9450fd70551820e9a83de6d716a3584b','7534399631cdcae371d629d8b63860b20f44a1ec1f453e752ce92a03be3d8bfd','3e1a0ddf2bf709825d67b4212ec4cbdcdd300455ea4413de05c5a13579e97673','c02e46b3d43f3dd2711f86968f8daa638b6f3c0c34be6c50e576fc6881f01394'];
 const hashes=new Set();
 for(let tier=1;tier<=5;tier++){
  const type=`repair-drone-${tier}`,d=maps.catalog[type],file=`${type}-sprite.webp`;
  assert.equal(d.cardArt,file);assert.equal(d.droneSprite,file);
  assert.equal(d.image,'repair-drone-1-floorplan.webp?v=20260911-pilot-web-assets-1');
  const publicFile=resolvePublicAsset(root,'/'+file);assert.ok(publicFile);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(publicFile)).digest('hex');
  assert.equal(digest,expectedHashes[tier-1]);hashes.add(digest);
  assert.deepEqual(Object.entries(maps.catalog).filter(([,entry])=>entry.cardArt===file).map(([key])=>key),[type]);
 }
 assert.equal(hashes.size,5);
});
test('approved Rapid designs retain exact bytes and non-card asset roles',()=>{
 for(const [type,file] of Object.entries(retained))assert.equal(maps.catalog[type].cardArt,file,type);
 for(let tier=1;tier<=5;tier++){
 const type='rapid-laser-'+tier,file='sic-rapid-laser-'+tier+'-approved.png',d=maps.catalog[type];assert.equal(d.cardArt,file);
 const publicFile=resolvePublicAsset(root,'/'+file);assert.ok(publicFile);const b=fs.readFileSync(publicFile);
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),approvedHashes[tier-1]);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);
 for(const field of ['image','sprite','floorplanPreview'])assert.equal(d[field],rapidRoles[type][field],type+' '+field);
 }
});
