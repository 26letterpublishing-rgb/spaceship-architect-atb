const test=require('node:test'),assert=require('node:assert/strict');
const cleanser=require('../ship-cleanser'),shields=require('../ship-shields'),distances=require('../ship-distances');
function fixture({shield=false,hull=60}={}){
 const source=require('../showcase-cleanser')(),target={id:'target',title:'Moving Target',currentHullHp:hull,maximumHullHp:hull,ship:{gridCells:[21,22,23,24],sicInventory:shield?[{id:'shield-a',type:'shield-1'},{id:'shield-b',type:'shield-1'}]:[],placements:shield?[{sicId:'shield-a',cell:21},{sicId:'shield-b',cell:22}]:[],doorStates:{}}};
 const unit={id:'nova',characterId:'nova',team:'pc',currentHp:30,atb:100,location:{starshipId:source.id,sicId:source.id+'-bridge',square:141,mesh:0,stationed:true}};
 const room={starships:[source,target],units:[unit],activeId:unit.id,spaceObjects:[],shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:10,r:0}]};
 source.sensorState={contacts:{target:{id:'target',level:'detected'}}};shields.refresh(room);if(shield){target.shieldSystems['shield-a'].hp=8;target.shieldSystems['shield-b'].hp=2;shields.refresh(room);}
 const body={sicId:source.id+'-cleanser',kind:'cleanser-charge',targetId:target.id,receipt:'cleanser-starship-test'};
 const start=()=>assert.equal(cleanser.command(room,unit,body).ok,true);
 const fire=()=>{cleanser.advance(room,120);const e=room.planetaryEvent;for(const kind of ['roll','shown','confirm'])cleanser.resolve(room,{eventId:e.id,kind},{unit});return e;};
 return {source,target,unit,room,body,start,fire,position:room.shipPositions[1]};
}
test('shared hex snapping chooses the actual axial hex, including diagonals and negative zero',()=>{
 assert.deepEqual(distances.roundHex({q:.49,r:.49}),{q:0,r:1});assert.deepEqual(distances.roundHex({q:-.49,r:-.49}),{q:0,r:-1});assert.deepEqual(distances.roundHex({q:-0,r:0}),{q:0,r:0});assert.equal(distances.roundHex({q:NaN,r:0}),null);
});
test('Cleanser starship targeting requires a detected real available other vessel before spending fuel',()=>{
 for(const mutate of [f=>f.body.targetId=f.source.id,f=>f.source.sensorState.contacts.target.level='unknown',f=>f.target.isProbe=true,f=>f.target.isDrone=true,f=>f.target.isMissile=true,f=>f.target.currentHullHp=0,f=>f.target.ship.warpState={phase:'traveling'},f=>f.target.dockedIn='carrier']){
  const f=fixture();mutate(f);assert.equal(cleanser.command(f.room,f.unit,f.body).ok,false);assert.equal(f.source.ship.minerals['Dark Phaeon'],3);
 }
});
test('Begin Charge snapshots the original integer hex and ignores target movement until charge completion',()=>{
 const f=fixture();Object.assign(f.position,{q:10.49,r:.49});f.start();assert.deepEqual(f.source.ship.cleanserState.aimHex,{q:10,r:1});f.position.q=30;cleanser.advance(f.room,60);assert.equal(f.source.ship.cleanserState.remaining,60);assert.deepEqual(f.source.ship.cleanserState.aimHex,{q:10,r:1});
 Object.assign(f.position,{q:10,r:1});const e=f.fire();assert.equal(e.hit,true);assert.deepEqual(e.aimHex,{q:10,r:1});assert.equal(e.targetKind,'starship');
});
test('ship displacement at or beyond three axial units misses, just inside still hits',()=>{
 for(const [q,r,hit] of [[12.999,0,true],[13,0,false],[11,2,false],[7,0,false],[12,-1,true]]){
  const f=fixture();f.start();Object.assign(f.position,{q,r});const e=f.fire();assert.equal(e.hit,hit,`${q},${r}`);assert.equal(e.impactPreview.hit,hit);assert.equal(e.q,10);assert.equal(e.r,0);
  cleanser.finish(f.room,e.endsAt);assert.equal(f.target.currentHullHp,hit?0:60);assert.equal(f.room.cleanserScars.length,1);assert.equal(f.room.cleanserScars[0].q,10);
 }
});
test('warping and disappearing targets finish the charge as a miss rather than refunding or cancelling it',()=>{
 for(const [reason,mutate] of [['warped',f=>f.target.ship.warpState={phase:'traveling'}],['unavailable',f=>f.room.starships=f.room.starships.filter(s=>s!==f.target)]]){
  const f=fixture();f.start();mutate(f);const e=f.fire();assert.equal(e.phase,'firing');assert.equal(e.missReason,reason);assert.equal(e.visualOutcome,'miss');assert.equal(f.source.ship.minerals['Dark Phaeon'],2);assert.equal(f.source.ship.cleanserState.cooldown,7200);cleanser.finish(f.room,e.endsAt);assert.equal(f.room.cleanserScars.length,1);assert.equal(f.target.currentHullHp,60);
 }
});
test('one simulated Cleanser blast uses one shield layer; preview does not apply damage and finish applies it once',()=>{
 const f=fixture({shield:true});f.start();const e=f.fire();assert.equal(e.visualOutcome,'shielded');assert.deepEqual(e.impactPreview,{hit:true,shieldDamage:2,hullDamage:0,survived:true,destroyed:false});assert.equal(f.target.shieldSystems['shield-b'].hp,2);assert.equal(f.target.shieldSystems['shield-a'].hp,8);
 assert.equal(cleanser.finish(f.room,e.endsAt),true);assert.deepEqual(e.outcome,e.impactPreview);assert.equal(f.target.shieldSystems['shield-b'].hp,0);assert.equal(f.target.shieldSystems['shield-a'].hp,8);assert.equal(f.target.currentHullHp,60);assert.equal(f.target.destroyedAt,undefined);
 const saved=structuredClone(f.room);assert.equal(cleanser.finish(saved,e.endsAt+1000),false);cleanser.resolve(saved,{eventId:e.id,kind:'confirm'},{unit:f.unit});assert.equal(saved.cleanserScars.length,1);assert.equal(saved.starships[1].shieldSystems['shield-a'].hp,8);
});
test('blast hull damage equals the displayed result and damages ships passing through the aimed hex',()=>{
 const f=fixture({hull:500000}),bystander=structuredClone(f.target);bystander.id='bystander';bystander.currentHullHp=100;f.room.starships.push(bystander);f.room.shipPositions.push({id:bystander.id,q:10,r:0});f.start();const e=f.fire();assert.equal(e.visualOutcome,'damaged');assert.equal(e.impactPreview.hullDamage,e.damage);assert.equal(f.target.currentHullHp,500000);cleanser.finish(f.room,e.endsAt);assert.equal(f.target.currentHullHp,500000-e.damage);assert.equal(bystander.currentHullHp,0);assert.equal(f.source.currentHullHp,198);assert.match(e.resultText,/survived/);
});

test('cloaking after charging does not evade a blast still aimed at the same hex',()=>{
 const f=fixture();f.start();f.target.ship.sicInventory.push({id:'cloak',type:'cloaking-device'});f.target.ship.placements.push({sicId:'cloak',cell:23});f.target.ship.cloakState={active:true,sicId:'cloak'};f.source.sensorState.contacts={};const e=f.fire();assert.equal(e.hit,true);assert.equal(e.targetDistance,undefined);assert.equal(e.visualOutcome,'destroyed');cleanser.finish(f.room,e.endsAt);assert.equal(f.target.currentHullHp,0);
});

test('Cleanser requires sensor range only at activation; departure never cancels a committed hex',()=>{const f=fixture();f.position.q=100;const denied=cleanser.command(f.room,f.unit,f.body);assert.equal(denied.ok,false);assert.match(denied.error,/sensor range/i);assert.equal(f.source.ship.minerals['Dark Phaeon'],3);f.position.q=10;f.start();f.position.q=100;cleanser.advance(f.room,120);assert.equal(f.room.planetaryEvent.phase,'awaitingRoll');assert.equal(f.room.planetaryEvent.hit,false);assert.deepEqual(f.room.planetaryEvent.aimHex,{q:10,r:0});});
