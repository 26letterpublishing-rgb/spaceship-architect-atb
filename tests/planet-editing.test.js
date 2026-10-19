'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),T=require('../planet-terrain'),M=require('../planet-grid-migration'),P=require('../campaign-planets');
const key=(x,y,size='large')=>T.hexAt(x,y,false,size);
function fixture(){const planet={id:'p',kind:'planet',name:'Harbor',size:'large',variant:'temperate',q:3,r:0},world={seed:'p',size:'large',gridVersion:2,hexes:{},regions:{}},star={id:'s',system:[planet],surfaces:{p:world}},map={id:'m',stars:[star]},c={starships:[],characters:[],starmaps:{maps:[map],positions:{},journeys:{},localPositions:{},receipts:[]}};return{c,planet,world,star,map,args:{mapId:'m',starId:'s',planetId:'p'},auth:{gm:true}};}
test('shrink trims unoccupied surroundings, preserving city/region spacing, contents and linked locations',()=>{
 const f=fixture(),a=key(85,28),b=key(95,32);f.world.hexes[a]={city:true,label:'Port',gmNotes:'SECRET',attachments:{story:{format:'sa2story',version:1,chapters:[{id:'c',name:'Chapter',script:'Story'}]}}};f.world.regions[b]={name:'District',hexes:{'4':{label:'Plaza'}}};
 f.c.starmaps.party={...f.args,hex:a};f.c.starmaps.localPositions.ship={...f.args,phase:'surface',surfaceHex:b};
 P.command(f.c,{...f.args,kind:'planetType',size:'small',terrain:'temperate',name:'New Harbor'},f.auth);
 const w=f.star.surfaces.p,m=w.resizeBackup.mapping,ca=T.cell(m[a],false,'small'),cb=T.cell(m[b],false,'small');
 assert.equal(cb.column-ca.column,10);assert.equal(cb.row-ca.row,4);assert.deepEqual(w.hexes[m[a]],{...f.world.hexes[a],terrain:T.terrain('p','temperate',f.world.hexes)[a]});assert.deepEqual(w.regions[m[b]],f.world.regions[b]);assert.equal(f.c.starmaps.party.hex,m[a]);assert.equal(f.c.starmaps.localPositions.ship.surfaceHex,m[b]);
 assert.equal(f.planet.size,'small');assert.equal(M.liveState(f.c.starmaps).maps[0].stars[0].surfaces.p.resizeBackup,undefined);assert.ok(P.normalizeWorld(w,'p').resizeBackup);
});
test('shrink compacts unused gaps before warning and leaves distinct landmarks distinct',()=>{
 const f=fixture();for(const [x,y]of [[0,0],[119,39],[60,20]])f.world.hexes[key(x,y)]={city:true,label:`${x}/${y}`};
 const result=M.planResize(f.world,'moon');assert.equal(result.atRisk,false);assert.equal(Object.values(result.world.hexes).filter(h=>h.city).length,3);assert.equal(new Set(Object.keys(f.world.hexes).map(k=>result.mapping[k])).size,3);
});
test('impossible placement warns before mutation and confirmation retains recovery data',()=>{
 const f=fixture();for(let x=0;x<61;x++)f.world.hexes[key(x,0)]={city:true,label:'City '+x};
 const before=JSON.stringify(f.c);assert.throws(()=>P.command(f.c,{...f.args,kind:'planetType',size:'small',terrain:'desert',name:'Changed',description:'Changed'},f.auth),new RegExp(M.resizeWarning));
 // Navigation initializes absent containers, but authored planet/world data must not mutate.
 assert.equal(f.planet.name,'Harbor');assert.equal(f.planet.variant,'temperate');assert.equal(f.planet.size,'large');assert.equal(f.world.description,undefined);assert.equal(Object.values(f.world.hexes).filter(h=>h.city).length,61);
 P.command(f.c,{...f.args,kind:'planetType',size:'small',terrain:'desert',confirmResize:true},f.auth);assert.equal(f.planet.size,'small');assert.equal(Object.values(f.star.surfaces.p.hexes).filter(h=>h.city).length,61);assert.deepEqual(f.star.surfaces.p.resizeBackup.world.hexes,f.world.hexes);
});
test('terrain fill is atomic, preserves authored content and regions, and is GM-only',()=>{
 const f=fixture(),k=key(4,3);f.world.hexes[k]={city:true,label:'City',description:'Lore',gmNotes:'Private',terrain:'ice'};f.world.regions[k]={name:'District',hexes:{}};
 const edits=T.cells().map(({key:hex})=>({hex,terrain:'moon',expected:f.world.hexes[hex]?.terrain||''}));
 assert.throws(()=>P.command(f.c,{...f.args,kind:'planetPaint',edits},{gm:false}),/Only the GM/);
 const invalid=structuredClone(edits);invalid.at(-1).expected='ice';assert.throws(()=>P.command(f.c,{...f.args,kind:'planetPaint',edits:invalid},f.auth),/changed/);assert.equal(Object.keys(f.world.hexes).length,1);
 P.command(f.c,{...f.args,kind:'planetPaint',edits},f.auth);assert.equal(Object.keys(f.world.hexes).length,4800);assert.ok(Object.values(f.world.hexes).every(h=>h.terrain==='moon'));assert.equal(f.world.hexes[k].label,'City');assert.equal(f.world.hexes[k].gmNotes,'Private');assert.equal(f.world.regions[k].name,'District');
});
test('planet repositioning is authorized, validated and carries orbit coordinates without changing surface locations',()=>{
 const f=fixture();f.c.starmaps.localPositions.ship={...f.args,phase:'orbit',q:3,r:0,surfaceHex:'12'};
 assert.throws(()=>P.command(f.c,{...f.args,kind:'planetPosition',q:4,r:1},{gm:false}),/Only the GM/);assert.throws(()=>P.command(f.c,{...f.args,kind:'planetPosition',q:Infinity,r:1},f.auth),/valid/);
 P.command(f.c,{...f.args,kind:'planetPosition',q:4,r:1},f.auth);assert.equal(f.planet.q,4);assert.equal(f.c.starmaps.localPositions.ship.q,4);assert.equal(f.c.starmaps.localPositions.ship.surfaceHex,'12');
});

test('stale map edits cannot target a newly resized grid',()=>{
 const f=fixture();P.command(f.c,{...f.args,kind:'planetType',size:'small',terrain:'temperate'},f.auth);
 const before=JSON.stringify(f.star.surfaces.p);
 assert.throws(()=>P.command(f.c,{...f.args,kind:'planetPaint',expectedSize:'large',edits:[{hex:'0',terrain:'moon'}]},f.auth),/was resized/);
 assert.equal(JSON.stringify(f.star.surfaces.p),before);
});
test('confirmed over-capacity shrink reserves traveler locations before disposable city cells',()=>{
 const f=fixture();for(const cell of T.cells())f.world.hexes[cell.key]={city:true,label:'City '+cell.key};
 const end=key(119,39);f.c.starmaps.party={...f.args,hex:end};f.c.starmaps.localPositions.ship={...f.args,phase:'surface',surfaceHex:end};
 assert.throws(()=>P.command(f.c,{...f.args,kind:'planetType',size:'moon',terrain:'temperate'},f.auth),new RegExp(M.resizeWarning));
 P.command(f.c,{...f.args,kind:'planetType',size:'moon',terrain:'temperate',confirmResize:true},f.auth);
 const w=f.star.surfaces.p,to=f.c.starmaps.party.hex;assert.ok(T.validHex(to,false,'moon'));assert.equal(f.c.starmaps.localPositions.ship.surfaceHex,to);assert.equal(w.hexes[to].label,'City '+end);assert.equal(Object.keys(w.hexes).length,300);assert.equal(Object.keys(w.resizeBackup.world.hexes).length,4800);
});
