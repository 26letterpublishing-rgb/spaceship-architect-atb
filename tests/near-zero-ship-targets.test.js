const test=require('node:test'),assert=require('node:assert/strict');
const targets=require('../ship-targets'),locks=require('../ship-locks'),sensors=require('../ship-sensors'),weapons=require('../ship-weapons'),commands=require('../ship-commands'),power=require('../ship-power');
function fixture(){
 const make=id=>({id,title:id==='b'?'Cinderwake':'Observer',currentHullHp:96,maximumHullHp:96,sensorScenarioMasking:1,ship:{gridCells:Array.from({length:24},(_,i)=>42+Math.floor(i/6)*20+i%6),sicInventory:[{id:'c',type:'cockpit-1'},{id:'en',type:'en-engine-1'},{id:'sn',type:'sensors-3'},{id:'t',type:'exhaust-thruster-1'},{id:'lock',type:'lock-on-1'},{id:'gun',type:'beam-laser-1'}],placements:[{sicId:'c',cell:42},{sicId:'en',cell:43},{sicId:'sn',cell:44},{sicId:'t',cell:41},{sicId:'lock',cell:45},{sicId:'gun',cell:27}]}});
 const a=make('a'),b=make('b'),unit={id:'u',team:'pc',atb:100,pilotSkill:2,weaponSystemsSkill:2,dexterityDice:[6,6],intellectDice:[6,6],location:{starshipId:'a',square:42,mesh:0,sicId:'c',stationed:true}};
 const room={showcase:true,activeId:'u',units:[unit],starships:[a,b],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0}],threshold:100,log:[]};
 power.refresh(room,{reset:true});sensors.refresh(room);locks.state(a).targets=[{targetId:'b',systemId:'lock',sicIds:[]}];return {room,a,b,unit};
}
test('rounded contact condition is not authoritative destruction; real HP and object thresholds remain authoritative',()=>{
 for(const analyzed of [true,false]){const contact={currentHullHp:0,maximumHullHp:6,contactLevel:'detected',analyzedContact:analyzed,contactOnly:!analyzed};assert.equal(targets.destroyed(contact),false);assert.equal(targets.destroyed({...contact,destroyedAt:'wreck'}),true);for(const kind of ['isDrone','isProbe','isMissile','isMine','isFloatingBody'])assert.equal(targets.destroyed({...contact,[kind]:true}),true);}
 assert.equal(targets.destroyed({currentHullHp:0}),true);assert.equal(targets.destroyed({currentHullHp:2}),false);
});
for(const analyzed of [false,true])test(`living 2/96 target retains lock, detection and Beam/Ram authority (${analyzed?'analyzed':'unanalyzed'})`,()=>{
 const {room,a,b,unit}=fixture();if(analyzed)sensors.report(a,{analysis:true,targetId:'b',text:'Systems Analysis',layout:structuredClone(b.ship),hull:{current:94,maximum:96},shield:{current:0,maximum:0,layers:[]}});
 b.currentHullHp=2;sensors.refresh(room);locks.refresh(room);assert.equal(a.sensorState.contacts.b.level,'detected');assert.equal(locks.locked(room,a,'b'),true);
 const pc=sensors.view(room,'a'),enemy=pc.starships.find(s=>s.id==='b');assert.equal(enemy.currentHullHp,0);assert.equal(enemy.maximumHullHp,6);assert.equal(targets.destroyed(enemy),false);assert.equal(locks.locked(pc,pc.starships[0],'b'),true);assert.ok(weapons.weaponLock(pc,pc.units[0],pc.starships[0],'b'));
 const fired=weapons.queue(room,unit,{sicId:'gun',targetId:'b',boosts:0,sacrifice:0,requestId:'near-zero-beam'});assert.equal(fired.ok,true,JSON.stringify(fired));
 const copy=JSON.parse(JSON.stringify(room));copy.units[0].delayedAction=null;copy.units[0].delayTimer=null;copy.units[0].timedAction=null;
 assert.match(commands.queue(copy,copy.units[0],{kind:'ram',targetId:'b',sicId:'c',requestId:'far-ram-check'}).error,/same hex/);copy.shipPositions[1].q=0;
 const ram=commands.queue(copy,copy.units[0],{kind:'ram',targetId:'b',sicId:'c',requestId:'near-zero-ram'});assert.equal(ram.ok,true,JSON.stringify(ram));
 assert.equal(b.currentHullHp,2);assert.equal(a.sensorState.contacts.b.level,'detected');assert.equal(JSON.parse(JSON.stringify(pc)).starships[1].currentHullHp,0);
});
test('truly destroyed targets still lose locks and reject Beam/Ram',()=>{
 const {room,a,b,unit}=fixture();b.currentHullHp=0;b.destroyedAt='wreck';sensors.refresh(room);locks.refresh(room);assert.equal(locks.locked(room,a,'b'),false);
 const pc=sensors.view(room,'a');assert.equal(targets.destroyed(pc.starships.find(s=>s.id==='b')),true);
 assert.equal(weapons.queue(room,unit,{sicId:'gun',targetId:'b',requestId:'dead-beam'}).ok,false);assert.match(commands.queue(room,unit,{kind:'ram',targetId:'b',sicId:'c',requestId:'dead-ram'}).error,/Choose a detected ship/);
});


