const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const fixture=require('./helpers/field-utility-fixture.cjs'),field=require('../ship-field-utilities'),maps=require('../ship-map-core'),weapons=require('../ship-weapons');
const send=(f,sicId,kind,extra={},options={})=>field.command(f.room,f.unit,{starshipId:f.ship.id,sicId,kind,receipt:randomUUID(),...extra},{campaign:f.campaign,...options});
test('field utility source catalog, stations, exterior segments and bay resize survive placement',()=>{
 const f=fixture();assert.equal(maps.exteriorError(f.ship.ship),'');
 for(const [type,price,en]of [['tractor-beam',5300,2],['manipulation-arm',850,1],['escape-pods',300,0],['docking-bay',2000,0],['ripple-reflector',35000,4]]){const d=maps.definition(type);assert.equal(d.price,price);assert.equal(d.energyCost,en);assert.ok(d.stations.length);assert.ok(d.image.includes('sic-art-'+type+'.webp'));}
 assert.equal(maps.definition('ripple-reflector').edge,true);assert.deepEqual([maps.componentDefinition({type:'docking-bay',bayWidth:4,bayHeight:3}).width,maps.componentDefinition({type:'docking-bay',bayWidth:4,bayHeight:3}).height],[4,3]);
});
test('tractor enforces range, shields, half hull and impairment; follows host and releases on power loss',()=>{
 const f=fixture();f.target.currentShieldHp=1;assert.match(send(f,'tractor','tractor',{targetId:'target',distance:1}).error,/shields/);f.target.currentShieldHp=0;
 f.room.shipPositions[1].q=3;assert.match(send(f,'tractor','tractor',{targetId:'target',distance:1}).error,/2 units/);f.room.shipPositions[1].q=1;
 const cells=f.target.ship.gridCells;f.target.ship.gridCells=f.ship.ship.gridCells;assert.match(send(f,'tractor','tractor',{targetId:'target',distance:1}).error,/half/);f.target.ship.gridCells=cells;
 assert.equal(send(f,'tractor','tractor',{targetId:'target',distance:.5}).ok,true);assert.equal(f.room.shipPositions[1].q,.5);f.room.shipPositions[0].q=2;field.advance(f.room,1);assert.equal(f.room.shipPositions[1].q,2.5);
 f.ship.ship.sicInventory.find(i=>i.id==='tractor').impaired=true;field.advance(f.room,0);assert.equal(field.system(f.ship,'tractor').tether,null);
});
test('manipulation requires same hex and impaired arm waits two active SvS rounds',()=>{
 const f=fixture();assert.match(send(f,'arm','manipulate',{targetId:'target',text:'Retrieve cargo'}).error,/same/);f.room.shipPositions[1].q=0;f.ship.ship.sicInventory.find(i=>i.id==='arm').impaired=true;
 assert.equal(send(f,'arm','manipulate',{targetId:'target',text:'Retrieve cargo'}).ok,true);assert.match(send(f,'arm','manipulate',{targetId:'target',text:'Retrieve cargo'}).error,/24/);field.advance(f.room,23);assert.equal(send(f,'arm','manipulate',{targetId:'target',text:'Retrieve cargo'}).ok,false);field.advance(f.room,1);assert.equal(send(f,'arm','manipulate',{targetId:'target',text:'Retrieve cargo'}).ok,true);
});
test('docking requires clearance, decompression and size, suspends crew and restores them on undocking',()=>{
 const f=fixture();f.room.shipPositions[1].q=0;assert.equal(send(f,'bay','request-dock',{targetId:'target'}).ok,true);assert.match(send(f,'bay','dock',{targetId:'target',decompressed:true}).error,/GM/);assert.match(send(f,'bay','dock',{targetId:'target'},{gm:true}).error,/decompressed/);
 assert.equal(send(f,'bay','dock',{targetId:'target',decompressed:true},{gm:true}).ok,true);assert.match(f.target.escapedAt,/docked/);assert.ok(f.room.units[1].defeatedAt);
 f.ship.ship.sicInventory.find(i=>i.id==='bay').impaired=true;assert.match(send(f,'bay','undock',{decompressed:true}).error,/Repair/);f.ship.ship.sicInventory.find(i=>i.id==='bay').impaired=false;
 const restored=JSON.parse(JSON.stringify(f.room));field.advance(restored,0);assert.ok(restored.units[1].escapedAt);assert.equal(send(f,'bay','undock',{decompressed:true}).ok,true);assert.equal(f.room.units[1].defeatedAt,null);assert.equal(f.target.escapedAt,null);
});
test('door shield purchase is OOC only and retry safe',()=>{const f=fixture(),receipt=randomUUID(),before=f.ship.ship.groupCredits;assert.equal(send(f,'bay','bay-shield',{receipt}).ok,false);assert.equal(send(f,'bay','bay-shield',{receipt},{outsideCombat:true}).ok,true);assert.equal(send(f,'bay','bay-shield',{receipt},{outsideCombat:true}).duplicate,true);assert.equal(f.ship.ship.groupCredits,before-2500);});
test('escape requires physical passengers, single launch, fixed impairment damage, restart and recovery',()=>{
 const f=fixture();assert.equal(send(f,'pod','launch-pod',{passengers:['pc']}).ok,false);f.seat('pod');f.ship.ship.sicInventory.find(i=>i.id==='pod').impairmentPoints=1;
 const receipt=randomUUID();assert.equal(send(f,'pod','launch-pod',{passengers:['pc'],receipt}).ok,true);assert.equal(f.unit.currentHp,-10);assert.equal(f.unit.atb,0);assert.ok(f.ship.characterLocations.pc.escapePodId);
 const restored=JSON.parse(JSON.stringify(f.room));restored.units[0].defeatedAt=null;field.advance(restored,0);assert.ok(restored.units[0].escapedAt);assert.equal(restored.units[0].location.stationed,false);
 const npc=f.room.units[1];npc.location={...f.unit.location};f.unit.currentHp=10;f.seat('bridge');f.unit.escapedAt=null;f.unit.defeatedAt=null;f.room.activeId=f.unit.id;
 const pod=field.state(f.ship).pods[0];assert.equal(send(f,'arm','rescue-pod',{targetId:pod.id},{gm:true}).ok,true);assert.equal(pod.recovered,true);assert.equal(f.ship.characterLocations.pc.escapePodId,undefined);
});
test('field commands cannot act out of turn or bypass power and absent stations',()=>{const f=fixture();f.room.activeId='npc';assert.match(send(f,'tractor','tractor',{targetId:'target',distance:1}).error,/turn/);f.room.activeId=f.unit.id;f.ship.ship.sicInventory.find(i=>i.id==='engine').disabled=true;assert.match(send(f,'tractor','tractor',{targetId:'target',distance:1}).error,/power/);});
function reflected(impaired=false,enabled=true,range=1){const f=fixture();f.target.ship.sicInventory=[{id:'reflector',type:'ripple-reflector',impaired},{id:'engine',type:'en-engine-4'}];f.target.ship.placements=[{sicId:'reflector',cell:42},{sicId:'engine',cell:63}];f.target.ship.fieldState={systems:{reflector:{enabled}}};f.room.shipPositions[1].q=range;f.room.showcase=true;f.ship.sensorScenarioMasking=0;f.target.sensorScenarioMasking=0;assert.equal(weapons.queue(f.room,f.unit,{sicId:'gun',targetId:'target',requestId:randomUUID()}).ok,true);const roll=()=>{throw Error('Auto dice forbidden');};roll.submittedScore=50;weapons.resolveInput(f.room,f.unit,roll);return f;}
test('Ripple Reflector uses doubled distance, one manual damage roll and no reflection recursion',()=>{
 const f=reflected();assert.equal(f.unit.delayedAction.weaponDamage.count,3);assert.equal(f.ship.currentHullHp,200);assert.equal(f.target.currentHullHp,100);weapons.resolveDamage(f.room,f.unit,[2,3,4]);assert.equal(f.ship.currentHullHp,191);assert.equal(f.target.currentHullHp,100);assert.equal(f.unit.delayedAction,null);
});
test('impaired reflector takes the same damage; switched-off reflector does not reflect',()=>{let f=reflected(true);weapons.resolveDamage(f.room,f.unit,[2,3,4]);assert.equal(f.ship.currentHullHp,191);assert.equal(f.target.currentHullHp,91);f=reflected(false,false);assert.equal(f.unit.delayedAction.weaponDamage.count,4);weapons.resolveDamage(f.room,f.unit,[2,3,4,5]);assert.equal(f.ship.currentHullHp,200);assert.equal(f.target.currentHullHp,86);});
test('reflection dissipating on the return path never opens pointless damage dice',()=>{const f=reflected(false,true,4);assert.equal(f.unit.delayedAction,null);assert.equal(f.ship.currentHullHp,200);assert.equal(f.target.currentHullHp,100);});
test('pod impairment injures occupants immediately and launch does not charge the same injury twice',()=>{
 const f=fixture();f.seat('pod');f.unit.currentHp=50;f.character.character.health.current=50;const item=f.ship.ship.sicInventory.find(i=>i.id==='pod');item.impairmentPoints=1;item.impaired=true;
 assert.equal(field.hurtPod(f.room,f.ship,item,1,f.campaign),1);assert.equal(f.unit.currentHp,30);assert.equal(f.character.character.health.current,30);assert.equal(send(f,'pod','launch-pod',{passengers:['pc']}).ok,true);assert.equal(f.unit.currentHp,30);assert.equal(require('../ship-oxygen').people(f.campaign,f.room).some(p=>p.id==='pc'),false);
});
test('manual component damage invokes only the Escape Pod occupant exception',()=>{
 const f=fixture();f.target.ship.sicInventory=[{id:'target-pod',type:'escape-pods'}];f.target.ship.placements=[{sicId:'target-pod',cell:42}];f.ship.lockState={targets:[{targetId:f.target.id,sicId:'target-pod'}],reports:[],receipts:[],failures:{}};
 f.unit.delayedAction={id:'component-hit',weaponDamage:{shipId:f.ship.id,targetId:f.target.id,targetSicId:'target-pod',count:2,dieSides:8,weaponFamily:'rapid-laser'}};
 const result=weapons.resolveDamage(f.room,f.unit,[6,6],undefined,f.campaign);assert.equal(result.podInjuries,1);assert.equal(f.room.units[1].currentHp,0);assert.equal(f.campaign.npcRoster[0].currentHp,0);
});
test('destroyed carrier releases docked crew without reviving unconscious characters',()=>{
 const f=fixture();f.room.shipPositions[1].q=0;send(f,'bay','dock',{targetId:'target',decompressed:true},{gm:true});f.room.units[1].currentHp=0;f.ship.currentHullHp=0;field.advance(f.room,0);assert.equal(f.target.escapedAt,null);assert.ok(f.room.units[1].defeatedAt);assert.equal(f.room.units[1].currentHp,0);
});
test('out-of-combat utility inspection cannot reveal an unknown GM ship',()=>{
 const f=fixture();f.room.outsideCombat=true;f.ship.sensorState.contacts={};f.target.controlType='gm';assert.equal(field.inspect(f.room,f.unit,'tractor').targets.length,0);assert.equal(field.inspect(f.room,f.unit,'tractor',true).targets.length,1);assert.equal(send(f,'tractor','tractor',{targetId:f.target.id,distance:1},{outsideCombat:true}).ok,false);
 f.room.knownContacts={[f.ship.id]:{[f.target.id]:{level:'detected'}}};assert.equal(field.inspect(f.room,f.unit,'tractor').targets.length,1);
});
test('GM clearance resolves an existing docking request without spending another ATB turn',()=>{
 const f=fixture();f.room.shipPositions[1].q=0;assert.equal(send(f,'bay','request-dock',{targetId:'target'}).ok,true);f.room.activeId='other';assert.equal(send(f,'bay','dock',{targetId:'target',decompressed:true},{gm:true,clearance:true}).ok,true);assert.equal(f.unit.atb,100);
});
