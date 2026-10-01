const test=require('node:test'),assert=require('node:assert/strict');
const drones=require('../ship-breach-drones'),maps=require('../ship-map-core');
function fixture(){
 const ship={id:'s',title:'Test',currentHullHp:100,ship:{gridCells:Array.from({length:10},(_,i)=>21+i),sicInventory:[{id:'bot',type:'hull-breach-repair-drone'}],placements:[{sicId:'bot',cell:21}],doorStates:{},breachState:{holes:{old:{id:'old',square:25,createdAt:1},new:{id:'new',square:23,createdAt:2}}}}};
 return {starships:[ship],units:[{id:'crew',currentHp:10,location:{starshipId:'s',square:21}}]};
}
test('speed 7 travels actual mesh route, opens doors and repairs oldest breach before the nearer new one',()=>{
 const r=fixture(),ship=r.starships[0];drones.advance(r,0);let d=drones.entries(r)[0].drone;
 assert.equal(d.hazardId,'old');assert.equal(d.location.square,21);
 const route=maps.meshRoute(maps.buildLayout(ship.ship),d.location,d.destination);assert.equal(route.length,12);
 drones.advance(r,1);assert.notEqual(d.location.square,25);assert.equal(d.phase,'moving');
 drones.advance(r,5);assert.equal(d.location.square,25);assert.equal(d.phase,'repairing');assert.ok(d.remaining<12&&d.remaining>11);
 drones.advance(r,12);assert.equal(d.phase,'awaiting-roll');assert.equal(r.units[0].pendingShipRolls[0].rollSpec.sides[0],6);
 drones.resolve(r,{shipId:'s',droneId:d.id},[5]);assert.equal(ship.ship.breachState.holes.old.sealed,true);assert.equal(d.hazardId,'new');assert.equal(d.phase,'moving');
});
test('travel and repairs do not advance on paused time, failures escalate dice, active bot survives bay loss',()=>{
 const r=fixture(),ship=r.starships[0];drones.advance(r,1);const d=drones.entries(r)[0].drone,paused=structuredClone(d);drones.advance(r,0);assert.deepEqual(d,paused);
 ship.ship.sicInventory[0].status='destroyed';ship.ship.sicInventory[0].impairmentPoints=4;
 drones.advance(r,30);assert.equal(d.phase,'awaiting-roll');drones.resolve(r,{shipId:'s',droneId:d.id},[1]);assert.equal(d.die,8);
 drones.advance(r,12);drones.resolve(r,{shipId:'s',droneId:d.id},[2]);assert.equal(d.die,10);
 drones.advance(r,12);drones.resolve(r,{shipId:'s',droneId:d.id},[3]);assert.equal(d.die,12);
 drones.advance(r,12);drones.resolve(r,{shipId:'s',droneId:d.id},[4]);assert.equal(d.die,12);
 drones.advance(r,12);drones.resolve(r,{shipId:'s',droneId:d.id},[8]);assert.equal(d.hazardId,'new');
 drones.advance(r,30);drones.resolve(r,{shipId:'s',droneId:d.id},[6]);assert.equal(drones.entries(r).length,0);
});
test('no path waits without teleporting; airlocks are not repair jobs',()=>{
 const r=fixture(),ship=r.starships[0];ship.ship.gridCells=[21,25];ship.ship.breachState.holes={old:{id:'old',square:25,createdAt:1}};
 drones.advance(r,1000);const d=drones.entries(r)[0].drone;assert.equal(d.location.square,21);assert.equal(d.phase,'moving');assert.equal(d.remaining,12);
 ship.ship.breachState.holes={};ship.ship.airlocks=[{id:'a',square:21}];ship.ship.airlockStates={a:{open:true}};drones.advance(r,100);assert.equal(d.phase,'docked');assert.equal(ship.ship.airlockStates.a.open,true);
});
test('partial travel and repair state survives serialization without a new 12 second travel wait',()=>{
 const r=fixture();drones.advance(r,2.13);const saved=JSON.parse(JSON.stringify(r));drones.advance(r,3.7);drones.advance(saved,3.7);assert.deepEqual(saved.starships[0].ship.breachDroneState,r.starships[0].ship.breachDroneState);
});
