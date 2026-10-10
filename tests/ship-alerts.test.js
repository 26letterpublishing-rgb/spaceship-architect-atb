const test=require('node:test'),assert=require('node:assert/strict');
const oxygen=require('../ship-oxygen');
test('lock banner projects only the recipient ship and clears with the last lock',()=>{
 const status=require('../fleet-status'),room={units:[{characterId:'pc',location:{starshipId:'own'}}],starships:[{id:'own',title:'Home',ship:{}},{id:'secret',title:'Secret enemy',ship:{},lockState:{targets:[{targetId:'own'}]}}]};
 const own=status.project(room,{role:'character',characterId:'pc'});assert.deepEqual(own.lockedShips,[{id:'own',title:'Home'}]);assert.ok(!JSON.stringify(own).includes('secret'));
 assert.deepEqual(status.project(room,{role:'character',characterId:'unrelated'}).lockedShips,[]);
 room.starships[1].lockState.targets=[];assert.deepEqual(status.project(room,{role:'gm'}).lockedShips,[]);
});
test('Life Support impairment starts NPC grace; GM sees it and unrelated PCs do not',()=>{
 const ship={id:'red',title:'Red Horizon',currentHullHp:40,ship:{sicInventory:[{id:'life',type:'life-support',impaired:true}],placements:[{sicId:'life',cell:21}],gridCells:[21,22,41,42]}};
 const npc={id:'npc',team:'npc',characterName:'Crew',physicalAttribute:2,physicalSkill:2,currentHp:20,location:{starshipId:'red'}};
 const campaign={characters:[],starships:[ship]},room={starships:[ship],units:[npc]};
 const actors=oxygen.people(campaign,room);oxygen.sync(room.starships,actors);
 assert.equal(ship.ship.oxygenState?.graceRemaining,165);
 oxygen.advance(room.starships,actors,10);assert.equal(ship.ship.oxygenState.graceRemaining,155);
 assert.equal(oxygen.project(room.starships,{gm:true})[0].crew[0].name,'Crew');
 assert.deepEqual(oxygen.project(room.starships,{characterId:'someone-else'}),[]);
 const saved=JSON.parse(JSON.stringify(ship));oxygen.sync([saved],actors);assert.equal(saved.ship.oxygenState.graceRemaining,155);
 ship.ship.sicInventory[0].impaired=false;oxygen.sync([ship],actors);assert.ok(ship.ship.atmosphereState);oxygen.advance([ship],actors,60);assert.equal(oxygen.project([ship],{gm:true}).length,0);
 oxygen.setEnabled(ship,false);oxygen.sync([ship],actors);assert.equal(ship.ship.oxygenState.graceRemaining,165);
});

test('persistent damage warnings include installed owned systems, survive outside combat and clear on repair',()=>{
 const status=require('../fleet-status'),home={id:'home',title:'Home',crewCharacterIds:['pc'],ship:{sicInventory:[{id:'life',type:'life-support',impaired:true},{id:'stored',type:'sensors-3',impaired:true}],placements:[{sicId:'life',cell:21}],gridCells:[21,22,41,42]}},enemy={...structuredClone(home),id:'enemy',title:'Secret',crewCharacterIds:[]};
 const room={starships:[home,enemy],units:[],encounterEndedAt:1};
 assert.deepEqual(status.project(room,{role:'character',characterId:'pc'}).damagedSystems.map(i=>[i.shipTitle,i.name]),[['Home','Life Support']]);
 assert.equal(status.project(room,{role:'gm'}).damagedSystems.length,2);
 assert.equal(status.project(room,{role:'character',characterId:'other'}).damagedSystems.length,0);
 home.ship.sicInventory[0].impaired=false;assert.equal(status.project(room,{role:'character',characterId:'pc'}).damagedSystems.length,0);
});
test('detection and latest activity notices remain private to crew with GM visibility',()=>{
 const at=new Date().toISOString(),home={id:'home',crewCharacterIds:['pc'],ship:{},sensorState:{reports:[{detected:true,nature:'Starship',shipClass:'III',targetId:'enemy',at},{detected:true,nature:'Missile',targetId:'missile',at}]}},other={id:'other',ship:{},sensorState:{reports:[{detected:true,nature:'Starship',shipClass:'Secret',targetId:'hidden',at}]}},room={starships:[home,other],units:[],log:[{id:'own',starshipId:'home',timestamp:at,text:'Own action'},{id:'secret',starshipId:'other',timestamp:at,text:'Secret action'}]};
 const notices=require('../fleet-status').project(room,{role:'character',characterId:'pc'});assert.deepEqual(notices.activity.map(e=>e.text),['Own action']);assert.deepEqual(notices.detections.map(e=>e.text),['Class III Starship Detected!']);assert.ok(!JSON.stringify(notices).includes('Secret'));assert.equal(require('../fleet-status').project(room,{role:'gm'}).detections.length,2);
});


test('incoming missile alerts exclude outgoing and unrelated missiles and remain private',()=>{
 const own={id:'own',title:'Home',crewCharacterIds:['pc'],ship:{},sensorState:{contacts:{incoming:{level:'detected'},outgoing:{level:'detected'},other:{level:'detected'}}}},enemy={id:'enemy',title:'Enemy',ship:{missileState:{flights:[{id:'incoming',targetId:'own',phase:'flying'},{id:'outgoing',targetId:'enemy',phase:'flying'},{id:'other',targetId:'third',phase:'flying'}]}}};
 const room={starships:[own,enemy],units:[]},status=require('../fleet-status');
 assert.deepEqual(status.project(room,{role:'character',characterId:'pc'}).critical.filter(a=>a.key.includes(':missile:')).map(a=>a.key),['own:missile:incoming']);assert.deepEqual(status.project(room,{role:'character',characterId:'outsider'}).critical,[]);
 enemy.ship.missileState.flights[0].phase='exploded';assert.equal(status.project(room,{role:'character',characterId:'pc'}).critical.length,0);
});
