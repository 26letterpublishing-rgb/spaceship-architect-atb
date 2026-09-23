const test=require('node:test'),assert=require('node:assert/strict'),maps=require('../ship-map-core'),camera=require('../ship-surveillance'),stations=require('../station-access');
function fixture(){
 const ship={id:'home',title:'Home',controlType:'pc',crewCharacterIds:['pc'],crewNpcUnitIds:['ally'],ship:{gridCells:maps.rectangleCells({},42,5,5),placements:[{sicId:'cam',cell:42},{sicId:'en',cell:86},{sicId:'bridge',cell:43}],sicInventory:[{id:'cam',type:'surv-camera'},{id:'en',type:'en-engine-1'},{id:'bridge',type:'cockpit-1'}],doorStates:{'42:62':'open'}}};
 const unit={id:'pilot',characterId:'pc',characterName:'Nova',team:'pc',currentHp:20,location:{starshipId:'home',square:42,mesh:7,stationed:true,sicId:'cam'}};
 const enemy={id:'enemy',characterName:'Boarder',team:'npc',currentHp:10,location:{starshipId:'away',square:42,mesh:4}};
 return {ship,unit,enemy,room:{starships:[ship],units:[unit,enemy]}};
}
test('A-87 covers whole ship for 300 credits and has one station with printed ratings',()=>{
 const d=maps.definition('surv-camera');assert.equal(d.price,300);assert.equal(d.energyCost,1);assert.equal(d.security,4);assert.equal(d.threshold,10);assert.equal(d.stations.length,1);assert.equal(d.destroyedOnImpairment,true);assert.equal(maps.componentDefinition({type:'surv-camera',stationLayout:'corners-v1'}).stations[0].mesh,7);
 const {room,unit}=fixture();assert.equal(stations.access(room,unit,'cam').definition.surveillance,true);unit.location={starshipId:'home',square:43,mesh:0,stationed:true,sicId:'bridge'};assert.equal(stations.access(room,unit,'cam'),null);
 for(const [rotation,mesh]of [[0,7],[90,3],[180,1],[270,5]])assert.equal(maps.componentDefinition({type:'surv-camera',stationLayout:'corners-v1',rotation}).stations[0].mesh,mesh);
});
test('hostile arrival closes all actual doors once; friendly crew and allies do not trigger',()=>{
 const {room,ship,enemy}=fixture();assert.ok(camera.reconcile(room));assert.equal(camera.reconcile(room),false);assert.equal(ship.ship.surveillanceState.reports.length,0);
 room.units.push({id:'ally',team:'npc',location:{starshipId:'home',square:63}});assert.equal(camera.reconcile(room),false);
 enemy.location.starshipId='home';assert.ok(camera.reconcile(room));assert.equal(ship.ship.surveillanceState.reports.length,1);assert.ok(Object.values(ship.ship.doorStates).every(v=>v==='closed'));
 enemy.characterId='invader';assert.equal(require('../fleet-status').project(room,{role:'character',characterId:'invader'}).intrusions.length,0);assert.equal(require('../fleet-status').project(room,{role:'character',characterId:'pc'}).intrusions.length,1);
 ship.ship.doorStates['42:62']='open';assert.equal(camera.reconcile(room),false);assert.equal(ship.ship.doorStates['42:62'],'open');
 const restored=structuredClone(room);assert.equal(camera.reconcile(restored),false);
 enemy.location.starshipId='away';camera.reconcile(room);enemy.location.starshipId='home';camera.reconcile(room);assert.equal(ship.ship.surveillanceState.reports.length,2);
});
test('unpowered, impaired, uninstalled and destroyed cameras neither reveal crew nor alarm',()=>{
 for(const change of [s=>s.ship.sicInventory[0].impaired=true,s=>s.ship.sicInventory[0].disabled=true,s=>s.ship.sicInventory[0].status='destroyed',s=>s.ship.sicInventory[1].disabled=true,s=>s.ship.placements.shift()]){
  const {room,ship,unit,enemy}=fixture();change(ship);enemy.location.starshipId='home';camera.reconcile(room);assert.equal(ship.ship.surveillanceState?.reports.length||0,0);assert.throws(()=>camera.inspect(room,unit,'cam'));
 }
});
test('camera station reveals live interior positions to either side; walking away revokes access',()=>{
 const {room,unit,enemy}=fixture();enemy.location={starshipId:'home',square:63,mesh:3};let info=camera.inspect(room,unit,'cam');assert.equal(info.crew.length,2);assert.equal(info.crew[1].hostile,true);assert.equal(info.crew[1].square,63);assert.equal(info.crew[1].id,undefined);assert.equal(info.crew[1].currentHp,undefined);
 enemy.location={...unit.location};unit.location={starshipId:'home',square:64,mesh:4};info=camera.inspect(room,enemy,'cam');assert.equal(info.crew.find(c=>c.name==='Nova').square,64);assert.throws(()=>camera.inspect(room,unit,'cam'));
 enemy.location.escapePodId='pod';assert.equal(camera.occupants(room,room.starships[0]).length,1);
});
test('connected camera capture grants remote feed, bridge capture alone does not; disconnect revokes',()=>{
 const {room,ship,unit}=fixture();const target=structuredClone(ship);target.id='target';target.title='Enemy';target.controlType='gm';target.crewCharacterIds=[];target.ship.sicInventory[0].id='target-camera';target.ship.placements[0].sicId='target-camera';room.starships.push(target);
 room.units.push({id:'secret-id',characterName:'Enemy crew',team:'npc',location:{starshipId:'target',square:64,mesh:4},hackingSessions:[{password:'SECRET'}]});
 assert.throws(()=>camera.inspect(room,unit,'target-camera'));
 room.hackingGrants=[{unitId:unit.id,targetId:'target',sourceId:'home',sicId:'target-camera'}];const info=camera.inspect(room,unit,'target-camera');assert.equal(info.controlled,true);assert.equal(info.crew[0].square,64);assert.ok(!JSON.stringify(info).includes('SECRET'));assert.ok(!JSON.stringify(info).includes('secret-id'));
 room.hackingGrants[0].sicId='bridge';assert.throws(()=>camera.inspect(room,unit,'target-camera'));
 room.hackingGrants=[];assert.throws(()=>camera.inspect(room,unit,'target-camera'));
});
