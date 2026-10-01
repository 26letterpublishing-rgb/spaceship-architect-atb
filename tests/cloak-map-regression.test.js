const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const maps=require('../ship-map-core'),sensors=require('../ship-sensors'),cloak=require('../ship-cloaking'),power=require('../ship-power');
function fixture(){const f=require('./helpers/field-utility-fixture.cjs')();f.ship.ship.sicInventory.find(i=>i.id==='engine').type='en-engine-6';f.ship.ship.sicInventory.find(i=>i.id==='au').type='au-engine-6';f.ship.ship.sicInventory.push({id:'cloak',type:'cloaking-device'});f.ship.ship.placements.push({sicId:'cloak',cell:190});power.refresh(f.room,{reset:true});return f;}
test('successful detection preserves cloak, publishes only its appearance, and survives analysis',()=>{
 const f=fixture();assert.equal(cloak.command(f.room,f.unit,{sicId:'cloak',enabled:true,receipt:'cloak-visible-test'}).ok,true);
 f.target.ship.sicInventory=[{id:'sensor',type:'sensors-9'}];f.target.ship.placements=[{sicId:'sensor',cell:42}];
 sensors.detect(f.room,f.target,f.ship);let view=sensors.view(f.room,f.target.id),contact=view.starships.find(s=>s.id===f.ship.id);
 assert.equal(maps.cloaked(f.ship),true);assert.equal(contact.isCloaked,true);assert.equal(contact.ship.cloakState,undefined);assert.equal(contact.ship.sicInventory.length,0);
 sensors.knowledge(f.target).analyses[f.ship.id]={layout:structuredClone(f.ship.ship)};sensors.detect(f.room,f.target,f.ship);contact=sensors.view(f.room,f.target.id).starships.find(s=>s.id===f.ship.id);assert.equal(contact.isCloaked,true);
 f.ship.ship.cloakState.active=false;sensors.detect(f.room,f.target,f.ship);assert.equal(sensors.view(f.room,f.target.id).starships.find(s=>s.id===f.ship.id).isCloaked,false);
});
test('station queries reuse layout while edits and replacement items remain live',()=>{
 let builds=0;const context={module:{exports:{}},require:()=>({...maps,buildLayout:s=>{builds++;return maps.buildLayout(s);}})};vm.runInNewContext(fs.readFileSync(require.resolve('../station-access'),'utf8'),context);const access=context.module.exports,f=fixture();
 for(let n=0;n<100;n++)assert.ok(access.station(f.room,f.unit));assert.equal(builds,1);
 const replacement=structuredClone(f.ship.ship.sicInventory);f.ship.ship.sicInventory=replacement;assert.equal(access.station(f.room,f.unit).cell.item,replacement.find(i=>i.id==='bridge'));
 replacement.find(i=>i.id==='bridge').disabled=true;assert.equal(access.station(f.room,f.unit),null);assert.equal(builds,2);
 replacement.find(i=>i.id==='bridge').disabled=false;f.ship.ship.placements.find(p=>p.sicId==='bridge').cell=500;assert.equal(access.station(f.room,f.unit),null);assert.equal(builds,3);
});

test('a successful Scan Hex reveals an active cloak without disabling it',()=>{
 const f=fixture();f.target.ship=structuredClone(f.ship.ship);f.target.ship.cloakState={active:true,sicId:'cloak'};
 f.room.shipPositions[1].q=3;f.room.showcase=true;
 assert.equal(maps.cloaked(f.target),true);
 assert.equal(sensors.queue(f.room,f.unit,{sicId:'sensor',kind:'hex',hex:{q:3,r:0},requestId:'cloak-hex-scan'}).ok,true);
 const roll=()=>6;roll.submittedScore=100;sensors.resolveInput(f.room,f.unit,roll);
 assert.equal(f.ship.sensorState.contacts.target.level,'detected');assert.equal(maps.cloaked(f.target),true);
 assert.equal(sensors.view(f.room,f.ship.id).starships.find(s=>s.id==='target').isCloaked,true);
});
test('map patch identities keep stars, vessels and routes separate',()=>{
 const source=fs.readFileSync(require.resolve('../live-dom'),'utf8'),context={};vm.runInNewContext(source.slice(source.indexOf('  function key('),source.indexOf('  function patch(')),context);
 const node=attrs=>({nodeType:1,localName:'g',hasAttribute:k=>k in attrs,getAttribute:k=>attrs[k]??null});
 const first=context.key(node({'data-space-ship':'cleaning-lady'}));assert.notEqual(first,context.key(node({'data-space-ship':'menace'})));assert.notEqual(first,context.key(node({'data-star-ambience':''})));assert.notEqual(context.key(node({'data-vessel-body':''})),context.key(node({})));
});
