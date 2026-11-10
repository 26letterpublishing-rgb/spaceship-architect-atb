const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),maps=require('../ship-map-core');
test('Beam atlas retains original bytes, eight exact cells and unrelated card mappings',()=>{
 const b=fs.readFileSync('beam-laser-tier-atlas.png');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'8feae02b5b1b2b0233504755c3121c22ef1ac351cc19d333c1da2f454d73d297');assert.equal(b.readUInt32BE(16),1536);assert.equal(b.readUInt32BE(20),1024);
 const entries=Object.entries(maps.catalog).filter(([id,d])=>id.startsWith('beam-laser-')&&d.cardArtAtlas);assert.equal(entries.length,8);
 for(let tier=1;tier<=8;tier++){const d=maps.catalog['beam-laser-'+tier];assert.deepEqual(d.cardArtAtlas,{src:'beam-laser-tier-atlas.png',columns:4,rows:2,index:tier-1,cellWidth:384,cellHeight:512});assert.equal(d.cardArt,'card-beam-laser-equipment-v2.webp');assert.equal(d.sprite,'weapon-floorplan-beam-laser-'+tier+'.webp');}
});
test('invalid atlas metadata keeps ordinary image fallback without constructing markup',()=>{
 const context={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync('sic-card-factory.js','utf8'),context);
 for(const cardArtAtlas of [null,{}, {src:'../private.png',columns:4,rows:2,index:0,cellWidth:384,cellHeight:512},{src:'atlas.png',columns:4,rows:2,index:8,cellWidth:384,cellHeight:512}]){const img={tagName:'IMG'};context.window.SASicCards.applyArt({querySelector:()=>img},{name:'Beam',cardArt:'fallback.webp',cardArtAtlas});assert.equal(img.src,'fallback.webp');assert.equal(img.alt,'Beam equipment');}
});
test('Ripple atlas retains original bytes, eight exact cells and unrelated card mappings',()=>{
 const b=fs.readFileSync('ripple-cannon-tier-atlas.png');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'ceddeb97f803d53bdf2a9d16db10aba630770b63ccd04636cb56873f04c31fab');assert.equal(b.readUInt32BE(16),1536);assert.equal(b.readUInt32BE(20),1024);
 const entries=Object.entries(maps.catalog).filter(([id,d])=>id.startsWith('ripple-cannon-')&&d.cardArtAtlas);assert.equal(entries.length,8);
 for(let tier=1;tier<=8;tier++){const d=maps.catalog['ripple-cannon-'+tier];assert.deepEqual(d.cardArtAtlas,{src:'ripple-cannon-tier-atlas.png',columns:4,rows:2,index:tier-1,cellWidth:384,cellHeight:512});assert.equal(d.cardArt,'card-ripple-cannon-equipment-v2.webp');assert.equal(d.sprite,'weapon-floorplan-ripple-cannon-'+tier+'.webp');}
});

test('Ion crops preserve original bytes and only select measured source rectangles',()=>{
 const b=fs.readFileSync('ion-pulse-cannon-tier-atlas.png');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'922c12fa489d8f04f55f11678c4d72d0ee4ecd75ed40c6f69fb36bac3a1389a2');assert.equal(b.readUInt32BE(16),2172);assert.equal(b.readUInt32BE(20),724);
 const rects=[[0,0,400,724],[400,0,380,724],[780,0,455,724],[1235,0,425,724],[1660,0,512,724]];for(let n=1;n<=5;n++){const d=maps.catalog['ion-pulse-cannon-'+n];assert.deepEqual(d.cardArtAtlas,{src:'ion-pulse-cannon-tier-atlas.png',sourceWidth:2172,sourceHeight:724,rect:rects[n-1]});assert.equal(d.cardArt,'card-ion-pulse-cannon-equipment-v2.webp');assert.equal(d.sprite,'weapon-floorplan-ion-pulse-cannon-'+n+'.webp');}
});
test('malformed and out-of-bounds rectangles retain the ordinary fallback',()=>{
 const context={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync('sic-card-factory.js','utf8'),context);
 for(const rect of [[-1,0,10,10],[0,-1,10,10],[0,0,0,10],[0,0,10,-1],[90,0,11,10],[0,90,10,11],[0,0,Infinity,10],[0,0,10],{},[0,0,'10',10]]){const img={tagName:'IMG'};context.window.SASicCards.applyArt({querySelector:()=>img},{name:'Ion',cardArt:'fallback.webp',cardArtAtlas:{src:'atlas.png',sourceWidth:100,sourceHeight:100,rect}});assert.equal(img.src,'fallback.webp');assert.equal(img.alt,'Ion equipment');}
});

test('CPU cards retain original machine atlas bytes and existing installed floorplans',()=>{
 const b=fs.readFileSync('cpu-security-tier-atlas.png');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'f2aeda81e4572f95109e235666f9449b165482f1de239d84e3f4a476dcf43e2c');assert.equal(b.readUInt32BE(16),1774);assert.equal(b.readUInt32BE(20),887);
 for(let n=1;n<=8;n++){const d=maps.catalog['cpu-security-'+n];assert.deepEqual(d.cardArtAtlas,{src:'cpu-security-tier-atlas.png',columns:4,rows:2,index:n-1,cellWidth:443.5,cellHeight:443.5});assert.equal(d.cardArt,'card-cpu-security-equipment-v2.webp');assert.ok(d.image.startsWith('cpu-security-tiers.svg?'));assert.ok(d.image.endsWith('#tier-'+n));}
});

test('Hacking cards retain original atlas and installed artwork with measured device crops',()=>{
 const b=fs.readFileSync('hacking-module-tier-atlas.png');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'3f5e302b0bdd93c76a5a6e31bf6aee35d857ef3d118a65266dfc9feb7a04f0d8');assert.equal(b.readUInt32BE(16),1983);assert.equal(b.readUInt32BE(20),793);
 for(let n=1;n<=5;n++){const d=maps.catalog['hacking-module-'+n];assert.deepEqual(d.cardArtAtlas,{src:'hacking-module-tier-atlas.png',sourceWidth:1983,sourceHeight:793,rect:[(n-1)*396.6,120,396.6,520]});assert.equal(d.cardArt,'card-hacking-module-equipment-v2.webp');assert.ok(d.image.startsWith('hacking-module-tiers.svg?'));assert.ok(d.image.endsWith('#tier-'+n));}
});

test('Darkveil cards retain original machines and installed floorplans',()=>{
 const b=fs.readFileSync('darkveil-tier-atlas.png');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'05ef3532accfd0cc36c85a9dc79dd12bc462ef62a69b8fe2788c63ed77cfad02');assert.equal(b.readUInt32BE(16),1983);assert.equal(b.readUInt32BE(20),793);
 for(let n=1;n<=10;n++){const d=maps.catalog['darkveil-'+n];assert.deepEqual(d.cardArtAtlas,{src:'darkveil-tier-atlas.png',columns:5,rows:2,index:n-1,cellWidth:396.6,cellHeight:396.5});assert.equal(d.cardArt,'card-darkveil-equipment-v2.webp');assert.ok(d.image.startsWith('darkveil-tiers.svg?'));assert.ok(d.image.endsWith('#tier-'+n));}
});

test('every explicit catalog card override has a unique primary identity and existing asset',()=>{
 const seen=new Map();for(const [id,d]of Object.entries(maps.catalog).filter(([,d])=>d.cardArt)){const a=d.cardArtAtlas,key=a?JSON.stringify(a):crypto.createHash('sha256').update(fs.readFileSync(d.cardArt.split('?')[0])).digest('hex');assert.ok(!seen.has(key),id+' duplicates '+seen.get(key));seen.set(key,id);if(a)assert.ok(fs.existsSync(a.src),id+' missing atlas');}assert.equal(seen.size,127);
});
