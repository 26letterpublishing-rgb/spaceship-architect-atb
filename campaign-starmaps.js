'use strict';
const {randomUUID}=require('node:crypto'),maps=require('./ship-map-core'),transit=require('./ship-transit'),space=require('./space-objects'),hex=require('./ship-distances');
const clone=structuredClone,id=()=>randomUUID(),state=c=>c.starmaps||={maps:[],positions:{},journeys:{},receipts:[]};
const text=(s,max=2000)=>String(s||'').trim().slice(0,max);
function point(p){if(!Number.isInteger(p?.q)||!Number.isInteger(p?.r)||Math.abs(p.q)>10000||Math.abs(p.r)>10000)throw Error('Choose whole hex coordinates between -10000 and 10000.');return {q:p.q,r:p.r};}
function note(c,message,ship){c.privateNotes||=[];c.privateNotes.push({id:id(),direction:'to-gm',kind:'system',message,createdAt:new Date().toISOString(),readAt:null});for(const characterId of ship?.crewCharacterIds||[])c.privateNotes.push({id:id(),direction:'to-character',kind:'system',characterId,message,createdAt:new Date().toISOString(),readAt:null});}
function view(c,gm){
 require('./campaign-navigation').state(c);const s=clone(state(c));delete s.receipts;s.recallShipIds=(s.party?.transport?c.starships:[]).filter(ship=>(gm||ship.controlType==='pc')&&ship.id===s.party.shipId&&s.localPositions?.[ship.id]?.phase==='orbit'&&require('./campaign-starmaps').travelRoom(c).units.some(u=>u.location?.starshipId===ship.id&&!u.shipAi&&require('./station-access').conscious(u))).map(ship=>ship.id);s.launchableShipIds=c.starships.filter(ship=>(gm||ship.controlType==='pc')&&require('./campaign-planets').canLaunch(c,ship)&&(!s.party||s.localPositions?.[ship.id]?.surfaceHex===undefined||require('./planet-boarding').atShip(c,ship))).map(ship=>ship.id);
 if(!gm){
  const ids=new Set(c.starships.filter(x=>x.controlType==='pc').map(x=>x.id));
  for(const type of ['positions','journeys','localPositions','localJourneys'])for(const key of Object.keys(s[type]||{}))if(!ids.has(key))delete s[type][key];
  const n=s.navigation;
  if(n.allowed.galaxy===false){s.maps=s.maps.filter(m=>m.id===n.mapId);for(const m of s.maps)m.stars=m.stars.filter(star=>star.id===n.starId);}
 }
 for(const m of s.maps)m.stars=m.stars.filter(x=>gm||!x.hidden).map(x=>{
  if(!gm){const hiddenPlanets=(x.planets||[]).filter(p=>p.hidden);delete x.gmNotes;delete x.systemScars;x.planets=(x.planets||[]).filter(p=>!p.hidden);
   x.system=require('./campaign-navigation').objects(x).filter(o=>!o.hidden&&!hiddenPlanets.some(p=>p.name===o.name));
   if(s.navigation.allowed.system===false)x.system=x.id===s.navigation.starId?x.system.filter(o=>o.id===s.navigation.planetId):[];
  }return x;
 });return require('./campaign-planets').project(s,gm);
}
function canPilot(c,ship,characterId){const loc=ship.characterLocations?.[characterId];if(loc?.environment==='surface')return false;if((c.characters?.find(r=>r.id===characterId)?.character.health?.current??1)<=0||!ship.crewCharacterIds?.includes(characterId)||!loc?.stationed)return false;const cell=maps.buildLayout(ship.ship).footprint.get(loc.square);return Boolean(cell&&maps.definition(cell.type).bridge&&maps.operational(cell.item));}
const travelRoom=require('./campaign-ship-room');
function quote(c,shipId,starId,mapId,fuelCounts){const s=state(c),ship=c.starships.find(x=>x.id===shipId),m=s.maps.find(x=>x.id===mapId),star=m?.stars.find(x=>x.id===starId),from=s.positions[shipId];if(!ship||!star||!from||from.mapId!==mapId)throw Error('Choose a ship placed on this map and a destination star.');if(ship.ship.fieldState?.dockedIn)throw Error('Docked ships travel with their carrier.');const distanceLY=hex.hexDistance(from,star)*m.lightYearsPerHex;const p=transit.plan(ship,distanceLY,{fuelCounts,allowPartial:true});if(!p.ok)throw Error(p.error);return {ship,m,star,from,plan:p};}
function command(c,b,{gm,characterId,combatActive}){
 const s=state(c),kind=b.kind;
 if(kind==='quote'){if(!gm&&state(c).navigation?.allowed?.galaxy===false)throw Error('The GM has not made the Galaxy Map available.');const q=quote(c,b.shipId,b.starId,b.mapId,b.fuelCounts);if(!gm&&(q.star.hidden||q.ship.controlType!=='pc'))throw Error('Destination is undiscovered.');return {quote:{...q.plan,driveName:maps.definition(q.ship.ship.sicInventory.find(i=>i.id===q.plan.sicId)?.type).name,fuelOptions:(maps.definition(q.ship.ship.sicInventory.find(i=>i.id===q.plan.sicId)?.type).warpFuelGrades||[]).map(grade=>({grade,available:q.ship.ship.warpFuel?.[grade]||0,rangeLY:transit.FUEL_PARSECS[grade]*transit.PARSEC_LY/q.plan.fuelMultiplier})),activationSeconds:transit.activationSeconds(travelRoom(c),q.ship,q.plan)}};}
 if(typeof b.receipt!=='string'||b.receipt.length<8)throw Error('Missing operation receipt.');if(s.receipts.includes(b.receipt))return {};
 if(require('./planet-travel').command(c,b,{gm,characterId,combatActive})){s.receipts=[...s.receipts,b.receipt].slice(-200);return {};}
 if(require('./campaign-planets').command(c,b,{gm,characterId,combatActive})){s.receipts=[...s.receipts,b.receipt].slice(-200);return {};}
 if(!gm&&s.party&&['travel','orbit','enterSystem','systemMove'].includes(kind))throw Error('Leave the planet with the party first.');
 if(require('./campaign-navigation').command(c,b,{gm,characterId,combatActive})){s.receipts=[...s.receipts,b.receipt].slice(-200);return {};}
 if(!['travel','exit'].includes(kind)&&!gm)throw Error('Only the GM may edit Starmaps.');
 const m=s.maps.find(x=>x.id===b.mapId);
 if(kind==='create'){if(s.maps.length>=30)throw Error('Maximum 30 Galaxy Maps.');s.maps.push({id:id(),name:text(b.name,80)||'Galaxy Map',lightYearsPerHex:transit.PARSEC_LY,parsecPreset:true,stars:[]});}
 else if(kind==='scale'){if(!m)throw Error('Choose a map.');if(Object.values(s.journeys).some(j=>j.mapId===m.id))throw Error('Wait for journeys on this map to finish before changing its scale.');const n=b.parsecPreset?transit.PARSEC_LY:Number(b.scale);if(!Number.isFinite(n)||n<.01||n>1000000||Math.abs(n*100-Math.round(n*100))>1e-7)throw Error('Use 0.01 or more light-years, with at most two decimal places.');m.lightYearsPerHex=n;m.parsecPreset=Boolean(b.parsecPreset);}
 else if(kind==='star'){if(!m)throw Error('Choose a map.');if(m.stars.length>=500&&!b.starId)throw Error('Maximum 500 stars.');const old=m.stars.find(x=>x.id===b.starId),p=point(b);if(old&&(old.q!==p.q||old.r!==p.r)&&Object.values(s.journeys).some(j=>j.starId===old.id))throw Error('Finish or cancel journeys to this star before moving it.');if(m.stars.some(x=>x.id!==old?.id&&x.q===p.q&&x.r===p.r))throw Error('A star already occupies that hex. Choose an empty hex.');const star={...old,id:old?.id||id(),name:text(b.name,80)||'Unnamed Star',...p,lore:text(b.lore,5000),gmNotes:text(b.gmNotes,5000),hidden:Boolean(b.hidden),planets:(Array.isArray(b.planets)?b.planets:[]).slice(0,50).map(p=>({name:text(p.name,80),hidden:Boolean(p.hidden)}))};if(star.system)star.system=star.system.map(o=>o.id==='object-star-'+star.id?{...o,name:star.name}:o);if(old)m.stars[m.stars.indexOf(old)]=star;else m.stars.push(star);}
 else if(kind==='moveStar'){const star=m?.stars.find(x=>x.id===b.starId);if(!star)throw Error('Choose a star.');const p=point(b);if(Object.values(s.journeys).some(j=>j.starId===star.id))throw Error('Finish or cancel journeys to this star before moving it.');if(m.stars.some(x=>x.id!==star.id&&x.q===p.q&&x.r===p.r))throw Error('A star already occupies that hex. Choose an empty hex.');Object.assign(star,p);}
 else if(kind==='deleteStar'){const star=m?.stars.find(x=>x.id===b.starId);if(!star)throw Error('Choose a star.');if(Object.values(s.journeys).some(j=>j.starId===star.id))throw Error('Finish or cancel journeys to this star before deleting it.');if(c.activeSystem?.starId===star.id&&combatActive)throw Error('End the current encounter before deleting its star.');m.stars=m.stars.filter(x=>x.id!==star.id);if(c.activeSystem?.starId===star.id)delete c.activeSystem;}
 else if(kind==='position'){const ship=c.starships.find(x=>x.id===b.shipId);if(!ship||!m)throw Error('Choose a ship and map.');const destination=point(b);require('./planet-travel').forceAboard(c,ship,b.forceParty===true);require('./campaign-navigation').cancel(c,ship);delete s.localPositions?.[ship.id];s.positions[ship.id]={...destination,mapId:m.id};require('./campaign-navigation').follow(c,ship);}
 else if(kind==='system'||kind==='openSystem'){const star=m?.stars.find(x=>x.id===b.starId);if(!star)throw Error('Choose a star.');if(combatActive)throw Error('End the current encounter before editing or opening a saved system.');const sun={id:'object-star-'+star.id,kind:'sun',name:star.name,q:0,r:0,quantity:1,intensity:2};if(kind==='system')star.system=space.normalize([sun,...(b.objects||[]).filter(x=>x.id!==sun.id)]);else{star.system||=[sun];c.activeSystem={mapId:m.id,starId:star.id};c.spaceObjects=clone(star.system);}}
 else if(kind==='travel'){
  if(!gm&&state(c).navigation?.allowed?.galaxy===false)throw Error('The GM has not made the Galaxy Map available.');if(combatActive)throw Error('End combat before Galaxy Map travel.');const q=quote(c,b.shipId,b.starId,b.mapId,b.fuelCounts),{ship,star,plan}=q;
  if(!gm&&(!canPilot(c,ship,characterId)||star.hidden))throw Error('Station on this ship’s Bridge to travel to a known star.');if(s.journeys[ship.id]||['activating','traveling'].includes(ship.ship.warpState?.phase))throw Error('Drop out of the current journey first.');
  if(!plan.instantWarp&&!(plan.coveredLY>0))throw Error('Select at least one compatible fuel cell.');if(plan.partial&&!b.acceptPartial)throw Error('Confirm the partial journey warning before entering warp.');const room=travelRoom(c),hardware=transit.hardware(room,ship,plan.sicId);if(!hardware.ok)throw Error(hardware.error);if(plan.instantWarp&&plan.impaired)throw Error('Repair the impaired EW-FTL drive before campaign travel.');
  if(s.localPositions?.[ship.id]?.phase==='surface'||s.localJourneys?.[ship.id])throw Error('Leave the planet and finish local travel before entering warp.');
  delete s.localPositions?.[ship.id];const total=transit.activationSeconds(room,ship,plan);
  if(plan.instantWarp){require('./ship-power').refresh(room);if(!(ship.auState?.available>0)||!require('./ship-power').spend(room,ship.id,ship.auState.available))throw Error('EW-FTL requires available AU.');ship.ship.warpFuel.S-=2;}
  if(ship.navigation)Object.assign(ship.navigation,{phase:'stopped',speed:0,remaining:0});
  ship.ship.warpState={phase:'activating',campaignClock:true,id:id(),sicId:plan.sicId,remaining:total,total,targetLY:plan.targetLY,traveledLY:0,elapsedSeconds:0,secondsPerParsec:plan.secondsPerParsec,plan:plan.plan,planIndex:0,planUsed:0,currentFuel:null,fuelUsed:{F:0,D:0,C:0,B:0,A:0,S:plan.instantWarp?2:0},instantWarp:plan.instantWarp};
  const direction={q:star.q-q.from.q,r:star.r-q.from.r};ship.ship.mapHeading=maps.shipHeading({navigation:{direction}});if(ship.navigation)ship.navigation.direction=direction;
  s.journeys[ship.id]={mapId:m.id,starId:star.id,from:clone(q.from),to:point(star),totalSeconds:total+plan.travelSeconds,clockAt:Date.now()};note(c,`${ship.title} entered warp toward ${star.name}. ${plan.partial?'Fuel runs out before the destination':'Arrival'} in ${((total+plan.travelSeconds)/60).toFixed(2)} minutes. Travel advances automatically outside combat; GM Pass Time can fast-forward it.`,ship);
 }else if(kind==='exit'){const ship=c.starships.find(x=>x.id===b.shipId);if(!ship||!s.journeys[ship.id])throw Error('No active journey.');if(!gm&&!canPilot(c,ship,characterId))throw Error('Use the ship’s Bridge.');delete s.journeys[ship.id];ship.ship.warpState.phase='exited';ship.ship.warpState.currentFuel=null;note(c,ship.title+' dropped out of warp at its current position. Spent fuel remains spent.',ship);}
 else throw Error('Unknown Starmap operation.');
 s.receipts=[...s.receipts,b.receipt].slice(-200);return {};
}
function advance(c,minutes,{shipId:onlyId,now=Date.now()}={}){if(!Number.isFinite(minutes)||minutes<0)throw Error('Invalid elapsed time.');const s=state(c);if(!onlyId)require('./campaign-navigation').advance(c,minutes*60,{now});for(const [shipId,j]of Object.entries(s.journeys)){if(onlyId&&shipId!==onlyId)continue;j.clockAt=now;const ship=c.starships.find(x=>x.id===shipId),w=ship?.ship.warpState;if(!w||!['activating','traveling'].includes(w.phase)){delete s.journeys[shipId];continue;}let seconds=minutes*60;if(w.phase==='activating'){const used=Math.min(seconds,w.remaining);w.remaining-=used;seconds-=used;if(w.remaining<=1e-8){w.phase=w.instantWarp?'arrived':'traveling';if(w.instantWarp)w.traveledLY=w.targetLY;}}
 if(w.phase==='traveling')transit.passTime(ship,seconds/60);const t=Math.min(1,(w.traveledLY||0)/w.targetLY);s.positions[shipId]={mapId:j.mapId,q:j.from.q+(j.to.q-j.from.q)*t,r:j.from.r+(j.to.r-j.from.r)*t};for(const carried of c.starships.filter(x=>x.ship.fieldState?.dockedIn?.shipId===shipId))s.positions[carried.id]=clone(s.positions[shipId]);
 if(w.phase==='arrived'||w.phase==='interrupted'){const star=s.maps.find(m=>m.id===j.mapId)?.stars.find(x=>x.id===j.starId);note(c,`${ship.title}: ${w.phase==='arrived'?'arrived at '+(star?.name||'destination'):'warp interrupted; check fuel'}.`,ship);delete s.journeys[shipId];}}
}
// The server clock owns travel, independent of connected pages. Combat freezes it.
function tick(c,now=Date.now(),paused=false){
 const s=state(c),local=require('./campaign-navigation').tick(c,now,paused);const surface=require('./planet-travel').tick(c,now,paused);let changed=local.changed||surface.changed,finished=local.finished||surface.finished;
 for(const [shipId,j]of Object.entries(s.journeys)){
  const elapsed=Math.max(0,now-(j.clockAt??now));j.clockAt=now;
  if(paused||!elapsed)continue;
  advance(c,elapsed/60000,{shipId,now});changed=true;
  if(!s.journeys[shipId])finished=true;
 }
 return {changed,finished};
}
function travelPacket(c,gm,now=Date.now(),paused=false){
 const visible=c.starships.filter(s=>gm||s.controlType==='pc');
 const ids=new Set(visible.map(s=>s.id)),s=state(c);
 return {serverNow:now,paused,partyJourney:s.partyJourney||null,localPositions:Object.fromEntries(Object.entries(s.localPositions||{}).filter(([id])=>ids.has(id))),localJourneys:Object.fromEntries(Object.entries(s.localJourneys||{}).filter(([id])=>ids.has(id))),positions:Object.fromEntries(Object.entries(s.positions).filter(([id])=>ids.has(id))),journeys:Object.fromEntries(Object.entries(s.journeys).filter(([id])=>ids.has(id))),ships:visible.filter(s=>s.ship.warpState?.campaignClock).map(s=>({id:s.id,warpState:s.ship.warpState}))};
}
function saveSystem(c,encounter){const a=c.activeSystem,star=a&&state(c).maps.find(m=>m.id===a.mapId)?.stars.find(x=>x.id===a.starId);if(star&&Array.isArray(encounter.spaceObjects)&&encounter.spaceObjects.some(o=>o.id==='object-star-'+star.id)){star.system=clone(encounter.spaceObjects.filter(o=>!o.gunOrb&&!o.gunDecay&&!['projection'].includes(o.kind)));star.systemScars=clone(encounter.cleanserScars||[]);c.spaceObjects=clone(star.system);}}
function seedShowcase(c){
 if(!c.showcase||state(c).maps.length)return false;
 const map={id:id(),name:'Frontier Sector',lightYearsPerHex:3.31,parsecPreset:false,stars:[]};
 const examples=[
  {name:'Haven',q:0,r:0,lore:'A friendly port and the starting point for your test fleet. Select another star to plan a journey.',planets:[{name:'Harbor',hidden:false},{name:'Verdant',hidden:false},{name:'Frostline',hidden:false}]},
  {name:'Ember',q:3,r:-1,lore:'A red star with rich asteroid fields. Useful for mining and salvage practice.',planets:[{name:'Cinder',hidden:false},{name:'Ashfall',hidden:false}]},
  {name:'Farpoint',q:21,r:0,lore:'69.51 light-years from Haven. Protos needs all five starting fuel cells for a direct trip.',planets:[{name:'Wayfarer',hidden:false}]}
 ];
 for(const [index,example]of examples.entries()){
  const star={id:id(),hidden:false,gmNotes:'',...example};
  star.system=space.normalize([{id:'object-star-'+star.id,kind:'sun',name:star.name,q:0,r:0,quantity:1,intensity:2},
    ...star.planets.map((p,j)=>({id:'object-'+id(),kind:'planet',name:p.name,q:[4,-7,5,-3][j],r:[-1,2,5,-8][j],quantity:1,hidden:p.hidden,variant:[['temperate','ocean','ice'],['volcanic','desert'],['moon']][index][j]})),
    {id:'object-'+id(),kind:'asteroid',name:'Asteroid Field',q:-4,r:3,quantity:5,miningTarget:6}]);
  for(const planet of star.system.filter(o=>o.kind==='planet')){
   const world=require('./campaign-planets').surface(star,planet),base=require('./planet-terrain').generate(world.seed,planet.variant),hex=String(base.findIndex((t,i)=>i>180&&t!=='ocean')<0?315:base.findIndex((t,i)=>i>180&&t!=='ocean'));
   world.hexes[hex]={city:true,label:planet.name+' Landing',description:'A welcoming settlement around a small landing field. Dock crews trade local news at the public market.',gmNotes:'A quiet mechanic knows the location of a hidden survey cache. The party can earn their trust by helping the town.',terrain:planet.variant==='ocean'?'temperate':planet.variant};
   world.regions[hex]={name:planet.name+' Landing District',seed:planet.id+'/district',type:world.hexes[hex].terrain,hexes:{'82':{city:true,label:'Market Square',description:'Food stalls, repair workshops and an expedition outfitter ring the plaza.',gmNotes:'The outfitter is a former survey pilot and recognizes the cache coordinates.'},'65':{label:'Survey Station',description:'An old research outpost overlooks the landing field.',gmNotes:'Its archive contains an incomplete map of the surrounding territory.'},'98':{label:'Landing Field',description:'A clear, level area for visiting starships.'}}};
   if(planet.name==='Harbor')world.regions[hex].hexes['82'].shop=require('./campaign-shops').normalize({id:'harbor-outfitter',name:'Harbor Outfitter',defaultAvailable:true,maxSicLevel:2,active:false});
  }
  map.stars.push(star);
 }
 state(c).maps.push(map);
 for(const ship of c.starships||[])if(ship.controlType==='pc')state(c).positions[ship.id]={mapId:map.id,q:0,r:0};
 return true;
}
module.exports={travelRoom,note,state,view,command,advance,tick,travelPacket,saveSystem,quote,canPilot,seedShowcase};
