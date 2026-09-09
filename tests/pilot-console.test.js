const test=require('node:test'),assert=require('node:assert/strict');
const nav=require('../ship-navigation'),maps=require('../ship-map-core'),delay=require('../delay-rules'),power=require('../ship-power'),combat=require('../combat-engine');
function fixture(){
  const ship={id:'s',title:'Helm Test',ship:{gridCells:Array.from({length:24},(_,i)=>42+Math.floor(i/6)*20+i%6),sicInventory:[{id:'c',type:'cockpit-1'},{id:'a',type:'au-engine-1'},{id:'t1',type:'ionic-pulse-thruster-1'},{id:'t2',type:'exhaust-thruster-2'},{id:'t3',type:'exhaust-thruster-3'}],placements:[{sicId:'c',cell:42},{sicId:'a',cell:43},{sicId:'t1',cell:41},{sicId:'t2',cell:22},{sicId:'t3',cell:122}]}};
  const pilot={id:'p',characterName:'Pilot',team:'pc',atb:100,pilotSkill:0,location:{starshipId:'s',square:42,mesh:0,sicId:'c',stationed:true}};
  ship.ship.sicInventory.push({id:'en',type:'en-engine-1'});ship.ship.placements.push({sicId:'en',cell:44});
  const room={starships:[ship],shipPositions:[{id:'s',q:0,r:0}],units:[pilot],activeId:'p',threshold:100};power.refresh(room,{reset:true});return {room,ship,pilot};
}
test('pilot factors average highest two operational thrusters and map every skill boundary',()=>{
  const {room,ship,pilot}=fixture();assert.equal(maps.exteriorError(ship.ship),'');
  for(const [skill,bars] of [[0,0],[.9,0],[1,1],[2.9,1],[3,2],[4.9,2],[5,3],[6,4],[20,4]]){pilot.pilotSkill=skill;const s=nav.inputSettings(room,pilot);assert.equal(s.factors.Ingenuity,bars);assert.equal(s.quality,3);assert.equal(s.factors.Performance,4);assert.equal(s.base,14);assert.equal(s.rate,delay.calculate(s).rate);}
  ship.ship.sicInventory.find(i=>i.id==='t3').impaired=true;assert.equal(nav.inputSettings(room,pilot).quality,2);
  ship.ship.sicInventory.find(i=>i.id==='t2').impaired=true;assert.equal(nav.inputSettings(room,pilot).quality,1);
});
test('shared delay formula retains flat percentage and critical calculation',()=>{
  assert.equal(delay.calculate({base:14,factors:{Quality:1,Performance:4,Ingenuity:0}}).rate,31.3);
  assert.equal(delay.calculate({base:8,factors:{Quality:0}}).rate,8);
  assert.equal(delay.calculate({base:8,factors:{Quality:-4}}).rate,1.6);
  assert.equal(delay.calculate({base:8,factors:{Execution:1}}).rate,10);
});
test('pending orders preserve old route, launch from current location and survive serialization',()=>{
  const {room,ship,pilot}=fixture();nav.order(room,pilot,{destination:{q:50,r:0}});const old=JSON.stringify(ship.navigation);
  assert.equal(nav.queue(room,pilot,{destination:{q:10,r:10},boostIds:['t1']}).ok,true);assert.equal(JSON.stringify(ship.navigation),old);assert.equal(ship.auState.current,3);
  nav.advance(room,1);const restored=JSON.parse(JSON.stringify(room)),point={...restored.shipPositions[0]};
  assert.equal(nav.resolveInput(restored,restored.units[0]).ok,true);assert.deepEqual(restored.shipPositions[0],point);assert.equal(restored.starships[0].auState.current,1);assert.deepEqual(restored.starships[0].navigation.target,{q:10,r:10});
});
test('input blocks other actions and forced departure cancels without spending AU',()=>{
  const {room,pilot,ship}=fixture(),helpers={clearActiveCommand(){},pushLog(){},moveToNextTurnOrClock(){}};
  assert.equal(combat.resolvePlayerCombatAction(room,pilot,{kind:'wait3'},helpers).ok,false);
  nav.queue(room,pilot,{destination:{q:8,r:4},boostIds:['t1']});assert.equal(combat.resolvePlayerCombatAction(room,pilot,{kind:'move',units:1},helpers).ok,false);
  pilot.location.stationed=false;assert.equal(nav.resolveInput(room,pilot).ok,false);assert.equal(ship.auState.current,3);assert.equal(ship.navigation,undefined);
});

test('manual Station actions are rejected without consuming a turn; vehicle mounting still works',()=>{
  const {room,pilot}=fixture();pilot.location.stationed=false;
  const helpers={id:()=> 'test-vehicle',clearActiveCommand(){},pushLog(){},moveToNextTurnOrClock(){}};
  const result=combat.resolvePlayerCombatAction(room,pilot,{kind:'station',stationName:'Cockpit'},helpers);
  assert.equal(result.ok,false);assert.match(result.error,/Move to a station/);assert.equal(pilot.atb,100);assert.equal(room.activeId,pilot.id);
  pilot.items=[{id:'bike',catalogId:'one-man-vehicle',name:'Vehicle',quantity:1}];
  assert.equal(combat.resolvePlayerCombatAction(room,pilot,{kind:'station',stationMode:'mountItem',itemId:'bike'},helpers).ok,true);
  assert.equal(pilot.mountedVehicleId,'test-vehicle');assert.equal(room.vehicles[0].driverId,pilot.id);
});
test('boost impairment during input removes its cost and extra speed without canceling base order',()=>{
  const {room,pilot,ship}=fixture();nav.queue(room,pilot,{destination:{q:8,r:4},boostIds:['t1']});const base=pilot.delayedAction.shipOrder.baseSpeed;
  ship.ship.sicInventory.find(i=>i.id==='t1').impaired=true;assert.equal(nav.resolveInput(room,pilot).ok,true);assert.equal(ship.navigation.speed,base);assert.equal(ship.auState.current,3);
});
test('hull canopy reveals cockpit only while other rooms retain plating',()=>{
  const {ship}=fixture(),layout=maps.buildLayout(ship.ship);
  assert.match(maps.surfaceMarkup(layout,42),/sa-bridge-window/);assert.match(maps.surfaceMarkup(layout,42),/cockpit-1-floor-plan/);assert.doesNotMatch(maps.surfaceMarkup(layout,43),/sa-bridge-window/);
});
test('web derivatives preserve originals, proportions and never upscale',()=>{
  const fs=require('node:fs'),path=require('node:path'),manifest=require('../sic-web-assets.json'),root=path.resolve(__dirname,'..');
  assert.ok(Object.keys(manifest).length>=80);
  for(const [source,data] of Object.entries(manifest)){
    assert.equal(fs.statSync(path.join(root,source)).size,data.sourceBytes);assert.equal(fs.statSync(path.join(root,data.file)).size,data.webBytes);
    assert.ok(data.webPixels[0]<=data.sourcePixels[0]&&data.webPixels[1]<=data.sourcePixels[1]);
    assert.ok(Math.abs(data.webPixels[0]/data.webPixels[1]-data.sourcePixels[0]/data.sourcePixels[1])<.02);
  }
});
