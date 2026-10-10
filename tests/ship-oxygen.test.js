const test=require('node:test'),assert=require('node:assert/strict');
const oxygen=require('../ship-oxygen'),utilities=require('../ship-utilities'),maps=require('../ship-map-core');
function fixture(){
  const ship={id:'s',title:'Test ship',ship:{gridCells:[21,22,41,42],sicInventory:[{id:'life',type:'life-support'}],placements:[{sicId:'life',cell:21}]},crewCharacterIds:['a','b'],characterLocations:{a:{square:21},b:{square:22}}};
  const character=id=>({id,character:{identity:{characterName:id,raceId:'human'},attributes:{health:[3,2,0,-1]},skills:{'Athletics':{tenths:25}},health:{current:12}}});
  const campaign={starships:[ship],characters:[character('a'),character('b')]};
  oxygen.setEnabled(ship,false);const actors=oxygen.people(campaign);oxygen.sync([ship],actors);
  return {ship,campaign,actors,data:ship.ship.oxygenState};
}
test('room air reaches 10 percent at 165 seconds and requires a roll without a breath reserve',()=>{
  const {ship,actors,data}=fixture();assert.equal(data.graceRemaining,165);
  oxygen.advance([ship],actors,164);assert.equal(data.graceRemaining,1);assert.equal(data.crew.a.request,null);
  oxygen.advance([ship],actors,1);assert.ok(data.crew.a.request);assert.ok(Math.abs(data.crew.a.oxygen-10)<1e-7);assert.equal(data.crew.a.remaining,0);
});

test('breath exhaustion pauses at manual rolls, including simultaneous checks, without rolling dice',()=>{
  const {ship,actors,data}=fixture();oxygen.advance([ship],actors,1000);
  assert.ok(data.crew.a.request);assert.ok(data.crew.b.request);assert.equal(actors[0].hp,12);
  const saved=JSON.stringify(data);oxygen.advance([ship],actors,400);assert.equal(JSON.stringify(data),saved);
  const a=data.crew.a.request;assert.deepEqual(a.dice,[10,8,4]);assert.equal(a.skill,2.5);assert.equal(a.difficulty,6);
  oxygen.resolve([ship],actors,{actorId:'a',rollId:a.id,score:14});oxygen.advance([ship],actors,400);assert.equal(data.crew.a.remaining,16);
});
test('each success schedules a new check after 16 seconds and increases difficulty by 4',()=>{
  const {ship,actors,data}=fixture();actors.pop();oxygen.advance([ship],actors,261);
  for(const difficulty of [6,10,14]){
    assert.equal(data.crew.a.request.difficulty,difficulty);
    const result=oxygen.resolve([ship],actors,{actorId:'a',rollId:data.crew.a.request.id,score:difficulty});assert.equal(result.crew.result.success,true);
    oxygen.advance([ship],actors,15.9);assert.equal(data.crew.a.request,null);
    oxygen.advance([ship],actors,.1);assert.equal(data.crew.a.request.difficulty,difficulty+4);
  }
});
test('failure immediately loses 5 HP, repeats every 16 seconds, then stops at unconsciousness',()=>{
  const {ship,actors,data}=fixture();actors.pop();oxygen.advance([ship],actors,261);const rollId=data.crew.a.request.id;
  const first=oxygen.resolve([ship],actors,{actorId:'a',rollId,score:0});assert.equal(first.events[0].damage,5);assert.equal(actors[0].hp,7);
  assert.equal(oxygen.resolve([ship],actors,{actorId:'a',rollId,score:0}).duplicate,true);assert.equal(actors[0].hp,7);
  oxygen.advance([ship],actors,16);assert.equal(actors[0].hp,2);oxygen.advance([ship],actors,16);assert.equal(actors[0].hp,-3);assert.equal(data.crew.a.phase,'unconscious');
  oxygen.advance([ship],actors,500);assert.equal(actors[0].hp,-3);
});
test('oxygen restoration cancels checks and HP loss without healing, stale submissions are rejected',()=>{
  const {ship,actors,data}=fixture();oxygen.advance([ship],actors,261);const rollId=data.crew.a.request.id;
  oxygen.setEnabled(ship,true);assert.equal(oxygen.pending([ship]),false);assert.ok(ship.ship.atmosphereState);
  assert.equal(oxygen.resolve([ship],actors,{actorId:'a',rollId,score:0}).ok,false);oxygen.advance([ship],actors,1000);assert.equal(actors[0].hp,12);
  oxygen.setEnabled(ship,false);oxygen.sync([ship],actors);assert.equal(ship.ship.oxygenState.graceRemaining,165);
});
test('repeated oxygen-off setting cannot reset timers; saved state retains pending roll IDs and remainders',()=>{
  const {ship,actors,data}=fixture();oxygen.advance([ship],actors,12.5);oxygen.setEnabled(ship,false);assert.equal(data.graceRemaining,152.5);
  const restored=JSON.parse(JSON.stringify(ship));oxygen.advance([restored],actors,248.5);assert.ok(restored.ship.oxygenState.crew.a.request);
  const again=JSON.parse(JSON.stringify(restored));assert.deepEqual(again.ship.oxygenState,restored.ship.oxygenState);
});
test('PC projection excludes other crew and ships; GM sees all affected timers',()=>{
  const {ship,actors}=fixture();oxygen.advance([ship],actors,100);
  assert.equal(oxygen.project([ship],{gm:true})[0].crew.length,2);
  const own=oxygen.project([ship],{characterId:'a',paused:true});assert.equal(own[0].crew.length,1);assert.equal(own[0].crew[0].id,'a');assert.equal(own[0].paused,true);
  assert.deepEqual(oxygen.project([ship],{characterId:'stranger'}),[]);assert.deepEqual(oxygen.project([ship]),[]);
});
test('Androids are exempt; leaving the affected ship clears orphaned checks',()=>{
  const {ship,campaign}=fixture();campaign.characters[1].character.identity.raceId='android';let actors=oxygen.people(campaign);oxygen.advance([ship],actors,261);
  assert.deepEqual(Object.keys(ship.ship.oxygenState.crew),['a']);
  ship.characterLocations={};actors=oxygen.people(campaign);oxygen.sync([ship],actors);assert.equal(oxygen.pending([ship]),false);
});
test('offline or unseated operators cannot turn oxygen off; ready Life Support uses command receipt',()=>{
  const {ship}=fixture();oxygen.setEnabled(ship,true);const unit={id:'u',location:{starshipId:'s',square:21,mesh:0,sicId:'life',stationed:true}};
  const room={starships:[ship],units:[unit],activeId:'u'},body={sicId:'life',kind:'oxygen',enabled:false,receipt:'oxygen-off-receipt'};
  assert.equal(utilities.setGravity(room,unit,body).ok,true);assert.equal(utilities.setGravity(room,unit,body).duplicate,true);
  ship.ship.sicInventory[0].disabled=true;assert.equal(utilities.setGravity(room,unit,{...body,enabled:true}).ok,false);
});

test('destroyed ships cannot retain orphaned oxygen rolls',()=>{
  const {ship,actors}=fixture();oxygen.advance([ship],actors,261);assert.equal(oxygen.pending([ship]),true);
  ship.destroyedAt='destroyed';oxygen.sync([ship],actors);assert.equal(oxygen.pending([ship]),false);assert.equal(ship.ship.oxygenState,null);
  oxygen.advance([ship],actors,100);assert.equal(ship.ship.oxygenState,null);
});
test('impairment warning accelerates smoothly, persists on interior and exterior, and destroyed is distinct',()=>{
  const ship={gridCells:[42,43,62,63],sicInventory:[{id:'life',type:'life-support',impairmentPoints:1}],placements:[{sicId:'life',cell:42}]};
  for(const [points,period] of [[1,'2.8'],[2,'1.8'],[3,'1']]){
    ship.sicInventory[0].impairmentPoints=points;const layout=maps.buildLayout(ship);
    for(const square of ship.gridCells)assert.ok(maps.surfaceMarkup(layout,square).includes(`--impairment-period:${period}s`));
  }
  ship.sicInventory[0].impairmentPoints=4;assert.match(maps.surfaceMarkup(maps.buildLayout(ship),42),/is-destroyed/);
});


test('saved oxygen escalation migrates to base six once without resetting timers or rolls',()=>{
 const {ship,actors,data}=fixture();oxygen.advance([ship],actors,165);
 data.baseDifficulty=14;data.crew.a.difficulty=18;data.crew.a.request.difficulty=18;const id=data.crew.a.request.id;
 oxygen.sync([ship],actors);assert.equal(data.crew.a.difficulty,10);assert.equal(data.crew.a.request.difficulty,10);assert.equal(data.crew.a.request.id,id);
 oxygen.sync([ship],actors);assert.equal(data.crew.a.request.difficulty,10);
});
