const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),power=require('../ship-power'),stations=require('../station-access'),utilities=require('../ship-utilities'),engine=require('../combat-engine');
const {CampaignApi}=require('../campaign-api');
test('every local page script is available through the public asset allowlist',()=>{
  const fs=require('node:fs'),path=require('node:path'),{resolvePublicAsset}=require('../public-assets'),root=path.resolve(__dirname,'..');
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html')))for(const match of fs.readFileSync(path.join(root,file),'utf8').matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)){
    const url=new URL(match[1],'http://localhost/');if(url.origin!=='http://localhost')continue;
    assert.ok(resolvePublicAsset(root,url.pathname),`${file} must be able to load ${url.pathname}`);
  }
});
const hull=()=>maps.rectangleCells({},105,4,4);
function hover(){return {gridCells:hull(),sicInventory:[{id:'hover',type:'decent-hover'}],placements:[{sicId:'hover',cell:85,mountCells:[85,109,188,164]}]};}
function room(){
  const ship={id:'s',ship:{gridCells:hull(),sicInventory:[{id:'life',type:'life-support'},{id:'nut',type:'nutritional-supplement'}],placements:[{sicId:'life',cell:105},{sicId:'nut',cell:108}]}};
  const unit={id:'u',characterId:'c',moveSpeed:3,location:{starshipId:'s',sicId:'life',square:105,mesh:0,stationed:true}};
  return {starships:[ship],units:[unit],activeId:'u',vehicles:[],threshold:100};
}
test('Hover is one four-mount SIC with one EN demand and four attached renderings',()=>{
  const ship=hover(),item=ship.sicInventory[0];
  assert.equal(maps.exteriorError(ship),'');assert.equal(maps.multiMountPlacement(ship,item,ship.placements[0].mountCells),true);
  assert.equal(power.demand({ship}),5);assert.equal(maps.buildLayout(ship).footprint.size,4);
  for(const n of ship.placements[0].mountCells)assert.match(maps.surfaceMarkup(maps.buildLayout(ship),n),/sa-hover-pod/);
  for(const cells of [[85],[85,109,188],[85,85,188,164],[85,109,188,200],[85,109,188,105]])assert.equal(maps.multiMountPlacement(ship,item,cells),false);
  assert.equal(maps.multiMountPlacement(ship,item,[85,109],false),true);
  const resized=maps.resizeZone(ship,24,24,2,2);assert.equal(maps.exteriorError(resized),'');
  assert.deepEqual(resized.placements[0].mountCells,ship.placements[0].mountCells.map(n=>maps.remapSquare(n,ship,resized)));
  assert.equal(maps.capabilities({ship}).find(c=>c.key==='hover').available,true);
});
test('Aerofoil checks hull mirrors, not internal equipment or construction-zone alignment',()=>{
  const ship={gridCells:hull(),sicInventory:[{id:'wings',type:'decent-aerofoil'},{id:'nut',type:'nutritional-supplement'}],placements:[{sicId:'wings',cell:105},{sicId:'nut',cell:108}]};
  assert.match(maps.exteriorError(ship),/Land Wheels/);ship.sicInventory.push({id:'wheels',type:'land-wheels'});ship.placements.push({sicId:'wheels',cell:85,mountCells:[85,109,188,164]});
  assert.deepEqual(maps.hullSymmetry(ship),{horizontal:true,vertical:true,symmetric:true});
  assert.equal(maps.exteriorError(ship),'');assert.equal(power.demand({ship}),6);assert.equal(maps.buildLayout(ship).footprint.size,5);
  ship.gridCells=ship.gridCells.filter(n=>n!==105);assert.equal(maps.hullSymmetry(ship).symmetric,false);assert.match(maps.exteriorError(ship),/symmetrical/);
  ship.gridCells=hull().filter(n=>![105,108].includes(n));assert.equal(maps.hullSymmetry(ship).vertical,true);
  ship.gridCells=hull().filter(n=>![105,165].includes(n));assert.equal(maps.hullSymmetry(ship).horizontal,true);
  ship.gridCells=maps.rectangleCells({},0,20,11);assert.match(maps.exteriorError(ship),/200 hull/);
});
test('capabilities exclude stored SICs and distinguish gravity setting from capability',()=>{
  const state=room(),ship=state.starships[0];
  assert.equal(stations.consoles(state,state.units[0])[0].kind,'utility');
  assert.equal(maps.capabilities(ship).length,3);
  ship.ship.gravityEnabled=false;assert.equal(maps.capabilities(ship).find(c=>c.key==='gravity').available,false);
  ship.ship.oxygenEnabled=false;assert.equal(maps.capabilities(ship).find(c=>c.key==='oxygen').available,false);
  ship.ship.placements=[];assert.equal(maps.capabilities(ship).length,0);
  assert.equal(maps.capabilities(ship).some(c=>c.key==='ai'),false);
});
test('atmospheric MPH does not change space movement, and impaired entry is only a manual damage warning',()=>{
  const ship={gridCells:hull(),sicInventory:[85,86,87,88].map((cell,i)=>({id:'t'+i,type:'exhaust-thruster-1'})),placements:[85,86,87,88].map((cell,i)=>({sicId:'t'+i,cell}))};
  const speed=maps.propulsion(ship).moveSpeed;assert.equal(speed,20);
  ship.sicInventory.push({id:'h',type:'decent-hover',impaired:true},{id:'a',type:'decent-aerofoil'});ship.placements.push({sicId:'h',cell:104,mountCells:[104,124,144,164]},{sicId:'a',cell:105});
  assert.equal(maps.propulsion(ship).moveSpeed,speed);
  assert.equal(maps.capabilities(ship).find(c=>c.key==='aerofoil').available,false);ship.sicInventory.push({id:'wheels',type:'land-wheels'});ship.placements.push({sicId:'wheels',cell:105});
  const caps=maps.capabilities(ship);assert.match(caps.find(c=>c.key==='hover').detail,/200 MPH.*8D10/);assert.match(caps.find(c=>c.key==='aerofoil').detail,/800 MPH/);
  assert.equal(caps.find(c=>c.key==='aerofoil').available,true);
  ship.placements.push({...ship.placements.at(-2)});assert.match(maps.exteriorError(ship),/only once/);
});
test('gravity changes require station access, a ready turn and a unique receipt; unknown controls are rejected',()=>{
  const state=room(),unit=state.units[0],body={sicId:'life',kind:'gravity',enabled:false,receipt:'gravity-receipt'};
  unit.consoleHold=true;assert.equal(utilities.setGravity(state,unit,body).ok,false);delete unit.consoleHold;
  state.attackResolution={id:'manual-roll'};assert.equal(utilities.setGravity(state,unit,body).ok,false);delete state.attackResolution;
  assert.equal(utilities.setGravity(state,unit,{...body,kind:'unknown'}).ok,false);
  assert.equal(utilities.setGravity(state,unit,body).ok,true);assert.equal(engine.effectiveMoveSpeed(state,unit),1.5);
  state.activeId=null;assert.equal(utilities.setGravity(state,unit,body).duplicate,true);
  assert.equal(utilities.setGravity(state,unit,{...body,receipt:'another-receipt'}).ok,false);
  unit.location.stationed=false;assert.equal(utilities.setGravity(state,unit,body,{outsideCombat:true}).ok,false);
});
test('gravity retimes ongoing walking without snapping progress or changing door waits',()=>{
  const action={kind:'move',total:6.6,remaining:4.5,moveSpeed:1,doorDelay:.6,routeSegment:[{doorKey:'1:2'},{}]};
  maps.updateMovementGravity(action,.5);
  assert.equal(action.total,12.6);assert.equal(action.remaining,9);assert.equal(action.moveSpeed,.5);
  maps.updateMovementGravity(action,.5);assert.equal(action.remaining,9,'no repeated halving');
  maps.updateMovementGravity(action,1);assert.equal(action.total,6.6);assert.equal(action.remaining,4.5);
  const duringDoor={kind:'move',total:3.6,remaining:3.3,moveSpeed:1,doorDelay:.6,routeSegment:[{doorKey:'1:2'}]};
  maps.updateMovementGravity(duringDoor,.5);assert.ok(Math.abs(duringDoor.remaining-6.3)<1e-9);
});
test('Move 1 under zero gravity still advances one mesh step and never creates a zero-length route',()=>{
  const state=room(),unit=state.units[0];unit.moveSpeed=1;state.starships[0].ship.gravityEnabled=false;
  unit.timedAction={id:'walk',kind:'move',total:6,remaining:.01,units:1,moveSpeed:.5,gravityScale:.5,destination:{starshipId:'s',square:107,mesh:4},routeSegment:[{starshipId:'s',square:107,mesh:4}]};
  unit.travelRoute=[{starshipId:'s',square:108,mesh:4}];
  engine.tickCombatTimers(unit,.1,1,state);assert.equal(unit.timedAction.units,1);assert.equal(unit.timedAction.total,6);assert.equal(unit.travelRoute.length,0);
});
test('walking finishes even when off-screen Chrome never finishes painting, without repeated playback resets',async()=>{
  const animation={finished:new Promise(()=>{}),updatePlaybackRate(){throw Error('An unchanged rate must not be reset.');}},walking=[];
  await maps.playWalkingAnimation(animation,30,()=>false,value=>walking.push(value));
  assert.equal(animation.playbackRate,.5);assert.deepEqual(walking,[false,false]);
});
async function request(api,path,body){let response;await api.handle({method:'POST'},{},new URL('http://localhost'+path),async()=>body,(_res,status,payload)=>response={status,payload});return response;}
test('outside-combat gravity persists through upgrades and blocks unseated, foreign and in-combat requests',async()=>{
  const data=new Map(),store={create:async c=>{data.set(c.code,structuredClone(c));return true;},findByName:async name=>[...data.values()].filter(c=>c.name===name),get:async code=>structuredClone(data.get(code)),save:async c=>data.set(c.code,structuredClone(c))};let inCombat=false;
  const api=new CampaignApi({store,storageMode:'memory',canPassTime:()=>!inCombat});
  const created=await request(api,'/api/campaign/create',{name:'Utility test',gmCode:'utility-gm'}),{token,campaign:{code}}=created.payload;
  const campaign=await api.campaign(code);campaign.characters=[{id:'c',character:{identity:{characterName:'Crew'}}}];
  const ship=room().starships[0];ship.ship.sicInventory.push({id:'en',type:'en-engine-1'});ship.ship.placements.push({sicId:'en',cell:168});ship.crewCharacterIds=['c'];ship.characterLocations={c:{square:105,mesh:0,stationed:true}};campaign.starships=[ship];await api.save(campaign);
  const player=api.newSession(code,'character','c'),body={code,token:player,characterId:'c',starshipId:'s',sicId:'life',kind:'gravity',enabled:false};
  assert.equal((await request(api,'/api/campaign/starship/utility',{...body,token:'wrong'})).status,403);
  assert.equal((await request(api,'/api/campaign/starship/utility',body)).status,200);assert.equal(campaign.starships[0].ship.gravityEnabled,false);
  const saved=await request(api,'/api/campaign/starship/save',{code,token,starshipId:'s',starship:{...ship.ship,gravityEnabled:true}});
  assert.equal(saved.status,200);assert.equal(saved.payload.starship.ship.gravityEnabled,false,'builder cannot overwrite live gravity');
  inCombat=true;assert.equal((await request(api,'/api/campaign/starship/utility',body)).status,409);inCombat=false;
  campaign.starships[0].characterLocations.c.stationed=false;assert.equal((await request(api,'/api/campaign/starship/utility',body)).status,409);
});
