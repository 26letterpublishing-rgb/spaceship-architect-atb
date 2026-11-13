'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const viewer=require('../console-viewer'),{create}=require('../console-preview-actions');
test('interactive adapters accept only isolated fixtures and keep all simulated edits local',()=>{
 assert.throws(()=>create({}),/fixture/);assert.throws(()=>create({...viewer.visualFixture('bridge-2'),roomCode:'REAL'}),/fixture/);
 for(const entry of viewer.catalog.filter(e=>!['sensor','lock'].includes(e.route))){const a=viewer.visualFixture(entry.id),b=viewer.visualFixture(entry.id),before=JSON.stringify(b),demo=create(a);demo.request({kind:'note',title:'Example',text:'<script>literal note</script>'});assert.equal(demo.request({kind:'inspect'}).result.details.notes[0].text,'<script>literal note</script>');assert.equal(JSON.stringify(b),before);assert.throws(()=>demo.request({kind:'realCampaignMutation'}),/no game request/);demo.action({action:'playerCombatAction',kind:'holdConsole'});assert(a.units[0].consoleHold);demo.action({action:'playerCombatAction',kind:'resumeConsole'});assert.equal(a.units[0].consoleHold,false);}
});
test('simulated notes, configuration and power can be reversed without touching other fixture systems',()=>{
 const s=viewer.visualFixture('bridge-2'),demo=create(s);demo.request({kind:'note',title:'One',text:'Text'});const note=demo.info.details.notes[0];demo.request({kind:'check',noteId:note.id,checked:true});assert.equal(note.checked,true);demo.request({kind:'remove',noteId:note.id});assert.equal(demo.info.details.notes.length,0);
 const other=s.starships[0].ship.sicInventory.find(i=>i.id==='engine'),before=JSON.stringify(other);demo.action({action:'shipMaintenance',kind:'off'});assert.equal(s.starships[0].ship.sicInventory[0].disabled,true);demo.action({action:'shipMaintenance',kind:'on'});assert.equal(s.starships[0].ship.sicInventory[0].disabled,false);assert.equal(JSON.stringify(other),before);
});
test('every Warp variant uses the same local demonstration lifecycle without changing production rules',()=>{
 const maps=require('../ship-map-core');for(const entry of viewer.catalog.filter(e=>maps.definition(e.id).utility==='warp'))assert(viewer.warpPreview(viewer.visualFixture(entry.id)));
});

test('field previews provide current hex distances without mutating fixture positions',()=>{
 const distances=require('../ship-distances');for(const type of ['docking-bay','tractor-beam','manipulation-arm']){const state=viewer.visualFixture(type),before=structuredClone(state.shipPositions),demo=create(state);let result=demo.request({kind:'inspect'}).result;assert.equal(result.targets.length,type==='tractor-beam'?4:type==='manipulation-arm'?3:2);for(const target of result.targets.filter(t=>!t.kind))assert.equal(target.distance,distances.hexDistance(before[0],before.find(p=>p.id===target.id)));assert.deepEqual(state.shipPositions,before);state.shipPositions[1].q=-2;state.shipPositions[1].r=3;result=demo.request({kind:'inspect'}).result;assert.equal(result.targets.find(t=>t.id===before[1].id).distance,3);assert.equal(demo.info.targets[0].distance,3);}
 const empty=viewer.visualFixture('docking-bay');empty.starships.splice(1);empty.shipPositions.splice(1);assert.deepEqual(create(empty).request({kind:'inspect'}).result.targets,[]);
});
