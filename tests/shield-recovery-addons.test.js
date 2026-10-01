const test=require('node:test'),assert=require('node:assert/strict');
const shields=require('../ship-shields'),maps=require('../ship-map-core'),power=require('../ship-power'),fabrication=require('../ship-fabrication');
function fixture(types=['burst-shield-reactivator']){
 const ship={id:'s',currentHullHp:100,ship:{gridCells:[21,22,23,41,42,43],sicInventory:[{id:'shield',type:'shield-2'},{id:'au',type:'au-engine-6'}],placements:[{sicId:'shield',cell:21},{sicId:'au',cell:80}]}},room={units:[],starships:[ship]};
 for(const type of types){ship.ship.sicInventory.push({id:type,type,attachTo:'shield'});ship.ship.placements.push({sicId:type,cell:21});}
 shields.refresh(room);ship.shieldSystems.shield.hp=0;shields.refresh(room);return {room,ship,s:ship.shieldSystems.shield};
}
test('recovery cards are craftable Shield (+) add-ons with source costs',()=>{
 for(const [t,price,seconds] of [['burst-shield-reactivator',2000,36000],['emergency-shield-recharger',3000,57600]]){
 const d=maps.definition(t);assert.equal(d.addon,'shield');assert.equal(d.price,price);assert.equal(d.energyCost,0);assert.equal(d.security,3);assert.equal(d.stations.length,0);assert.equal(fabrication.recipe(t).seconds,seconds);
 }
});
test('Burst reactivates only its own layer at 120 seconds with rounded one-third HP, costing 20 AU',()=>{
 const {room,ship,s}=fixture();const r=s.addonRecovery;shields.advance(room,119.9);assert.equal(s.hp,0);shields.advance(room,.1);assert.ok(Math.abs(s.hp-7)<1e-6);assert.equal(r.auSpent,20);assert.equal(s.addonRecovery,null);assert.equal(ship.currentHullHp,100);
});
test('Emergency restores 1 HP in 48 seconds, diverts all AU and frees it afterward',()=>{
 const {room,ship,s}=fixture(['emergency-shield-recharger']);assert.equal(ship.auState.available,0);assert.equal(power.spend(room,'s',1),false);shields.advance(room,47);assert.equal(s.hp,0);shields.advance(room,1);assert.equal(s.hp,1);assert.equal(ship.auState.current,0);shields.advance(room,5);assert.ok(ship.auState.available>0);
});
test('combined add-ons restore one-third HP at 48 seconds with Burst exception funded',()=>{
 const {room,s}=fixture(['burst-shield-reactivator','emergency-shield-recharger']);shields.advance(room,48);assert.ok(Math.abs(s.hp-7)<1e-6);assert.equal(s.addonRecovery,null);
});
test('starvation, hard pause, host off and save/reload preserve progress',()=>{
 let {room,ship,s}=fixture();ship.auState.current=0;ship.ship.sicInventory.find(i=>i.id==='au').disabled=true;shields.advance(room,30);assert.equal(s.addonRecovery.elapsed,0);
 ship.ship.sicInventory.find(i=>i.id==='au').disabled=false;power.refresh(room,{reset:true});shields.advance(room,10);assert.ok(Math.abs(s.addonRecovery.elapsed-10)<1e-6);
 room.hardPaused=true;shields.advance(room,30);assert.ok(Math.abs(s.addonRecovery.elapsed-10)<1e-6);room.hardPaused=false;
 ship.ship.sicInventory[0].disabled=true;shields.advance(room,30);assert.ok(Math.abs(s.addonRecovery.elapsed-10)<1e-6);
 room=JSON.parse(JSON.stringify(room));ship=room.starships[0];s=ship.shieldSystems.shield;ship.ship.sicInventory[0].disabled=false;shields.advance(room,110);assert.ok(Math.abs(s.hp-7)<1e-6);
});
test('storage/disabled add-ons do not recover shields and cannot duplicate on one host',()=>{
 const {room,ship,s}=fixture();ship.ship.sicInventory.at(-1).disabled=true;shields.advance(room,200);assert.equal(s.hp,0);assert.equal(s.addonRecovery,null);
 ship.ship.sicInventory.at(-1).disabled=false;ship.ship.sicInventory.push({id:'duplicate',type:'burst-shield-reactivator',attachTo:'shield'});ship.ship.placements.push({sicId:'duplicate',cell:21});assert.match(maps.exteriorError(ship.ship),/one of each recovery/);
});
test('large time step agrees with fine stepping and second shield is untouched',()=>{
 const a=fixture(['burst-shield-reactivator','emergency-shield-recharger']),b=fixture(['burst-shield-reactivator','emergency-shield-recharger']);
 for(const x of [a,b]){x.ship.ship.sicInventory.push({id:'other',type:'shield-1'});x.ship.ship.placements.push({sicId:'other',cell:100});shields.refresh(x.room);x.ship.shieldSystems.other.hp=0;}
 shields.advance(a.room,100);for(let i=0;i<1000;i++)shields.advance(b.room,.1);assert.ok(Math.abs(a.s.hp-b.s.hp)<1e-6);assert.equal(a.ship.shieldSystems.other.hp,0);assert.equal(a.ship.auState.current,b.ship.auState.current);
});
