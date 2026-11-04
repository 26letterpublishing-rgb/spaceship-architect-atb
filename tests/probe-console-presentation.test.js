const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../probe-console.js'),'utf8'),probes=require('../ship-probes');
const context={window:{SAShipProbes:probes}};vm.runInNewContext(source.slice(source.indexOf(' function probePointerPoint('),source.indexOf(' function open(')),context);
const point=context.probePointerPoint;
function fixture(){const p={id:'probe',ownerId:'owner',launcherId:'launcher',phase:'flying',position:{q:99,r:99}},picture={starships:[{id:'probe',isProbe:true,probeOwnerId:'owner',contactLevel:'detected'}],shipPositions:[{id:'probe',q:2,r:3}]};return {p,picture};}
test('pointer uses disclosed coordinates for this owner and launcher, across every active phase',()=>{
 const {p,picture}=fixture();for(const phase of ['flying','holding','returning','recovering','approaching','breaching','attached'])assert.equal(point({...p,phase},'owner','launcher',picture),picture.shipPositions[0]);
 for(const phase of ['docked','destroyed','unavailable',undefined])assert.equal(point({...p,phase},'owner','launcher',picture),null);
});
test('pointer never reveals another owner, launcher, absent contact or stale/unknown contact',()=>{
 const {p,picture}=fixture();assert.equal(point({...p,ownerId:'enemy'},'owner','launcher',picture),null);assert.equal(point({...p,launcherId:'other'},'owner','launcher',picture),null);
 assert.equal(point(p,'owner','launcher',{starships:[],shipPositions:picture.shipPositions}),null);
 for(const patch of [{probeOwnerId:'enemy'},{contactLevel:'last-known'},{contactLevel:'unknown'},{isProbe:false},{destroyedAt:1}])assert.equal(point(p,'owner','launcher',{...picture,starships:[{...picture.starships[0],...patch}]}),null);
 for(const q of [undefined,NaN,Infinity,'2'])assert.equal(point(p,'owner','launcher',{...picture,shipPositions:[{id:p.id,q,r:0}]}),null);
});
test('real probe launch and sensor view authorize only the owners current active probe',()=>{
 const f=require('./helpers/crew-room-fixture.cjs')(),power=require('../ship-power'),sensors=require('../ship-sensors');
 f.ship.ship.sicInventory.push({id:'launcher',type:'probe-launcher'},{id:'sensors',type:'sensors-3'},{id:'probe0',type:'probe-1',attachTo:'launcher'});
 f.ship.ship.placements.push({sicId:'launcher',cell:33},{sicId:'sensors',cell:111},{sicId:'probe0',cell:33});f.room.shipPositions=[{id:f.ship.id,q:0,r:0}];f.seat('bridge');power.refresh(f.room,{reset:true});probes.reconcile(f.room);
 const p=f.ship.ship.probeState.probes.probe0,view=()=>sensors.view(f.room,f.ship.id);
 assert.equal(point(p,f.ship.id,'launcher',view()),null);
 const result=probes.command(f.room,f.unit,{sicId:'launcher',kind:'launch',probeId:p.id,destination:{q:4,r:0},receipt:'pointer-launch'});assert.equal(result.ok,true);
 assert.equal(point(p,f.ship.id,'launcher',view()),null,'pending input is still docked');probes.resolveInput(f.room,f.unit);probes.advance(f.room,6);sensors.refresh(f.room);
 assert.equal(point(p,f.ship.id,'launcher',view()).q,2);
 f.room.hardPaused=true;probes.advance(f.room,6);sensors.refresh(f.room);assert.equal(point(p,f.ship.id,'launcher',view()).q,2);
 f.room.hardPaused=false;probes.advance(f.room,6);sensors.refresh(f.room);assert.equal(point(p,f.ship.id,'launcher',view()).q,4);
 probes.hit(f.room,p.id,100);sensors.refresh(f.room);assert.equal(point(p,f.ship.id,'launcher',view()),null);
});

test('new Probe presentation selectors require the dedicated launcher class',()=>{
 const css=fs.readFileSync(require.resolve('../probe-console.css'),'utf8').split('/* Probe-only presentation:')[1];
 assert.ok(css);assert.equal(css.includes('.probe-console'),false);
 assert.match(source,/view.className='sensor-console probe-console probe-launcher-console'/);
 assert.equal(fs.readFileSync(require.resolve('../black-hole-gun-console.js'),'utf8').includes('probe-launcher-console'),false);
});
