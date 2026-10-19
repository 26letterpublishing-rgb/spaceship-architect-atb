'use strict';
// Local travel lives beside interstellar journeys, using the same server clock,
// ship capabilities, station checks and docking state as combat.
const {randomUUID}=require('node:crypto'),maps=require('./ship-map-core'),power=require('./ship-power'),hex=require('./ship-distances'),space=require('./space-objects');
const levels=['surface','orbit','system','galaxy'];
const commands=new Set(['navigation','enterSystem','systemMove','orbit','descend','leavePlanet','systemPosition','undock','beamDown','beamAboard','loadGalaxy']);
function state(c){const s=require('./campaign-starmaps').state(c);s.localPositions||={};s.localJourneys||={};s.navigation||={mode:'galaxy',allowed:{surface:true,orbit:true,system:true,galaxy:true}};require('./planet-grid-migration').ensure(c);return s;}
function context(c,b){const s=state(c),map=s.maps.find(m=>m.id===b.mapId),star=map?.stars.find(x=>x.id===b.starId);if(!star)throw Error('Choose a star system.');return {s,map,star};}
function objects(star){const sun={id:'object-star-'+star.id,kind:'sun',name:star.name,q:0,r:0,quantity:1,intensity:2};return star.system||[sun];}
function same(a,b){return a&&b&&hex.hexDistance(a,b)<1e-6;}
function coords(b){if(!Number.isInteger(b.q)||!Number.isInteger(b.r)||Math.abs(b.q)>10000||Math.abs(b.r)>10000)throw Error('Choose a hex on the map.');return {q:b.q,r:b.r};}
function accessible(s,level){return s.navigation.allowed?.[level]!==false;}
function working(c,ship){require('./campaign-starmaps').travelRoom(c);return ship.currentHullHp!==0&&!ship.destroyedAt&&power.output(ship,require('./campaign-starmaps').travelRoom(c).units).en>=power.demand(ship);}
function pilot(c,ship,auth){if(!auth.gm&&!require('./campaign-starmaps').canPilot(c,ship,auth.characterId))throw Error('Station on this ship’s Bridge first.');if(!working(c,ship))throw Error('Restore the ship’s power and hull first.');if(ship.ship.fieldState?.dockedIn)throw Error('Undock this ship first.');}
function cancel(c,ship){const s=state(c);delete s.journeys[ship.id];delete s.localJourneys[ship.id];if(['activating','traveling'].includes(ship.ship.warpState?.phase))Object.assign(ship.ship.warpState,{phase:'exited',currentFuel:null});if(ship.navigation)Object.assign(ship.navigation,{phase:'stopped',speed:0,remaining:0});}
function follow(c,ship){const s=state(c);for(const other of c.starships.filter(x=>x.ship.fieldState?.dockedIn?.shipId===ship.id)){s.positions[other.id]=structuredClone(s.positions[ship.id]);if(s.localPositions[ship.id])s.localPositions[other.id]=structuredClone(s.localPositions[ship.id]);else delete s.localPositions[other.id];}}
function normalizeFile(raw){
 if(raw?.format!=='sa2-galaxy'||raw.version!==1||!raw.map||!Array.isArray(raw.map.stars)||raw.map.stars.length>500)throw Error('Choose a valid Save Galaxy Map file (version 1).');
 const m=raw.map,scale=Number(m.lightYearsPerHex);if(!Number.isFinite(scale)||scale<.01||scale>1e6||Math.abs(scale*100-Math.round(scale*100))>1e-7)throw Error('Invalid map scale.');
 const text=(v,n=5000)=>String(v||'').slice(0,n),used=new Set();
 return {id:randomUUID(),name:text(m.name,80)||'Loaded Galaxy',lightYearsPerHex:scale,parsecPreset:!!m.parsecPreset&&scale===3.26,stars:m.stars.map(source=>{
  const p=coords(source),key=p.q+':'+p.r;if(used.has(key))throw Error('Two stars occupy the same hex.');used.add(key);const id=randomUUID();
  if(source.system!==undefined&&(!Array.isArray(source.system)||source.system.length>500))throw Error('Invalid solar system.');
  const original=(source.system||[]).filter(o=>o.id!=='object-star-'+source.id),system=space.normalize(original.map(o=>({...o,id:'object-'+randomUUID()}))),surfaces={};for(let i=0;i<system.length;i++)if(system[i].kind==='planet'&&source.surfaces?.[original[i].id])surfaces[system[i].id]=require('./campaign-planets').normalizeWorld(source.surfaces[original[i].id],original[i].id,system[i].size,system[i].variant);
  return {id,...p,surfaces,...(source.arrivalContent?{arrivalContent:require('./content-arrivals').normalize(source.arrivalContent)}:{}),name:text(source.name,80)||'Unnamed Star',hidden:!!source.hidden,lore:text(source.lore),gmNotes:text(source.gmNotes),planets:(Array.isArray(source.planets)?source.planets:[]).slice(0,50).map(p=>({name:text(p.name,80),hidden:!!p.hidden})),system:[{id:'object-star-'+id,kind:'sun',name:text(source.name,80),q:0,r:0,intensity:2,quantity:1},...system]};
 })};
}
function command(c,b,auth){
 if(!commands.has(b.kind))return false;const s=state(c),{gm,characterId,combatActive}=auth;
 if(b.kind==='loadGalaxy'){if(!gm)throw Error('Only the GM may load maps.');if(s.maps.length>=30)throw Error('Maximum 30 Galaxy Maps.');s.maps.push(normalizeFile(b.data));return true;}
 if(b.kind==='navigation'){
  if(!gm)throw Error('Only the GM controls campaign visibility.');if(!levels.includes(b.mode))throw Error('Choose a campaign view.');
  if(b.mode!=='galaxy'){const {star}=context(c,b);if(['surface','orbit'].includes(b.mode)&&!objects(star).some(p=>p.id===b.planetId&&p.kind==='planet'))throw Error('Choose a planet.');}
  s.navigation={mode:b.mode,mapId:b.mapId||'',starId:b.starId||'',planetId:b.planetId||'',allowed:Object.fromEntries(levels.map(l=>[l,b.allowed?.[l]!==false]))};s.navigation.allowed[b.mode]=true;if(b.mode!=='galaxy'){const {star}=context(c,b);star.hidden=false;const planet=objects(star).find(o=>o.id===b.planetId);if(planet){planet.hidden=false;for(const entry of star.planets||[])if(entry.name===planet.name)entry.hidden=false;}}return true;
 }
 const ship=c.starships.find(x=>x.id===b.shipId);if(!ship)throw Error('Choose a ship.');
 if(!gm&&(!ship.crewCharacterIds?.includes(characterId)||ship.controlType!=='pc'))throw Error('Choose a ship assigned to your crew.');
 const {map,star}=context(c,b),p=s.localPositions[ship.id];
 if(!gm&&s.party&&['enterSystem','systemMove','orbit','descend','beamDown'].includes(b.kind))throw Error('Leave the planet with the party first.');
 if(!gm&&star.hidden)throw Error('This star is undiscovered.');
 if(b.kind==='systemPosition'){
  if(!gm)throw Error('Only the GM may reposition ships.');const phase=levels.includes(b.phase)&&b.phase!=='galaxy'?b.phase:'system',planet=objects(star).find(x=>x.id===b.planetId&&x.kind==='planet');if(phase!=='system'&&!planet)throw Error('Choose a planet.');
  const point=phase==='system'?coords(b):{q:planet.q,r:planet.r};require('./planet-travel').forceAboard(c,ship,b.forceParty===true);cancel(c,ship);s.navigation={...s.navigation,mode:phase,mapId:map.id,starId:star.id,planetId:planet?.id};s.positions[ship.id]={mapId:map.id,q:star.q,r:star.r};s.localPositions[ship.id]={mapId:map.id,starId:star.id,...point,phase,planetId:planet?.id,...(b.orbitOffset&&Number.isFinite(b.orbitOffset.x)&&Number.isFinite(b.orbitOffset.y)?{orbitOffset:{x:Math.max(-4,Math.min(4,b.orbitOffset.x)),y:Math.max(-2,Math.min(2,b.orbitOffset.y))}}:{})};follow(c,ship);return true;
 }
 if(combatActive)throw Error('Use the combat map and consoles while an encounter is active.');
 if(b.kind==='enterSystem'){
  if(!gm&&!accessible(s,'system'))throw Error('The GM has not made this view available.');const at=s.positions[ship.id];if(at?.mapId!==map.id||!same(at,star)||s.journeys[ship.id])throw Error('Travel to this star first.');
  if(p?.phase==='surface')throw Error('Leave the planet surface first.');if(p?.phase==='orbit'){p.phase='system';delete p.planetId;}
  if(!p||p.starId!==star.id)s.localPositions[ship.id]={mapId:map.id,starId:star.id,q:0,r:4,phase:'system'};follow(c,ship);return true;
 }
 // Validate before placing a newly acquired ship in a planet-start campaign.
 if(s.localJourneys[ship.id])throw Error('Wait for the current movement to finish.');
 if(['descend','leavePlanet'].includes(b.kind)&&!gm){if(!ship.crewCharacterIds.some(id=>require('./campaign-starmaps').canPilot(c,ship,id)))throw Error('Station a character on this ship’s Bridge first.');pilot(c,ship,{...auth,gm:true});}else if(!['beamDown','beamAboard'].includes(b.kind))pilot(c,ship,auth);
 if(b.kind==='beamAboard'){require('./campaign-planet-transport').begin(c,b,auth);return true;}
 const startingPlanet=!p&&b.kind==='leavePlanet'&&s.navigation.mode==='surface'&&s.navigation.starId===star.id?objects(star).find(o=>o.id===s.navigation.planetId):null;
 const local=p||(startingPlanet?{mapId:map.id,starId:star.id,q:startingPlanet.q,r:startingPlanet.r,planetId:startingPlanet.id,phase:'surface'}:null);
 if(!local||local.starId!==star.id)throw Error('Enter this star system first.');
 if(b.kind==='systemMove'){
  if(local.phase!=='system'||!gm&&!accessible(s,'system'))throw Error('Leave the planet view first.');const to=coords(b),speed=maps.propulsion(ship).moveSpeed;if(!(speed>0))throw Error('Working thrusters are required.');
  const route=hex.hexDistance(local,to),total=route*12/speed;if(!total)return true;
  const direction={q:to.q-local.q,r:to.r-local.r};ship.ship.mapHeading=maps.shipHeading({navigation:{direction}});if(ship.navigation)ship.navigation.direction=direction;
  s.localJourneys[ship.id]={kind:'move',from:{q:local.q,r:local.r},to,total,remaining:total,clockAt:Date.now()};
 }else if(b.kind==='orbit'){
  if(!gm&&!accessible(s,'orbit'))throw Error('The GM has not made orbit available.');if(local.phase==='surface')throw Error('Leave the planet surface first.');const planet=objects(star).find(o=>o.id===b.planetId&&o.kind==='planet'&&!o.destroyedAt);if(!planet||!same(local,planet))throw Error('Move onto the planet’s hex first.');local.phase='orbit';local.planetId=planet.id;
 }else if(b.kind==='descend'||b.kind==='leavePlanet'){
  const landing=maps.capabilities(ship).some(x=>['hover','aerofoil'].includes(x.key)&&x.available);
  const suitable=ship.ship.sicInventory.some(i=>maps.definition(i.type).landing&&maps.operational(i)&&!i.impaired&&(ship.ship.placements||[]).some(p=>p.sicId===i.id));
  if(!landing||!suitable||maps.propulsion(ship).moveSpeed<=0)throw Error('Working descent equipment and thrusters are required.');
  const leave=b.kind==='leavePlanet';if(local.phase!==(leave?'surface':'orbit'))throw Error(leave?'The ship is not on a planet surface.':'Enter orbit first.');if(!gm&&!leave&&!accessible(s,'surface'))throw Error('The GM has not made this view available.');
  if(leave&&s.party&&!s.party.transport&&local.surfaceHex!==undefined&&!require('./planet-boarding').atShip(c,ship))throw Error('The party must return to the starship’s surface hex before leaving the atmosphere.');
  if(leave&&s.party?.transport)throw Error('The party is on the surface without this ship. Beam aboard first.');
  if(leave&&s.party&&s.party.planetId!==local.planetId)throw Error('This ship is not at the party’s planet.');
  if(leave&&s.partyJourney)throw Error('Wait for surface movement to finish.');
  if(leave){s.viewEvent={id:randomUUID(),kind:'ascend',ownerId:characterId};s.positions[ship.id]={mapId:map.id,q:star.q,r:star.r};s.localPositions[ship.id]=local;s.localJourneys[ship.id]={kind:'ascend',flightStyle:maps.capabilities(ship).some(x=>x.key==='aerofoil'&&x.available)?'aerofoil':'hover',from:{q:local.q,r:local.r},to:{q:local.q,r:local.r},total:20,remaining:20,ownerId:characterId||'',clockAt:Date.now()};}
  else {delete local.surfaceHex;delete local.regionId;delete local.regionHex;s.localJourneys[ship.id]={kind:'descend',from:{q:local.q,r:local.r},to:{q:local.q,r:local.r},total:20,remaining:20,ownerId:characterId||'',clockAt:Date.now()};}
 }else if(b.kind==='beamDown'){
  if(local.phase!=='orbit'||!accessible(s,'surface')&&!gm)throw Error('Enter orbit around an available planet first.');
  const room=transportRoom(c,star),unit=room.units.find(u=>u.id===(gm?b.operatorId:characterId));if(!unit)throw Error('Choose an operator at the Bridge or Transporter.');
  const body={kind:'transport',sicId:b.sicId,targetId:local.planetId,passengerIds:b.passengerIds},t=require('./ship-transporter'),check=t.validate(room,unit,body,false),risk=Math.max(0,Number(check.a.item.impairmentPoints)||(check.a.item.impaired||check.a.item.status==='impaired'?1:0));
  if(check.a.ship.id!==ship.id)throw Error('Operate the selected ship’s Transporter.');
  const count=(risk?check.passengers.length:0)+check.scramblers.length,values=b.diceResults||[];
  if(values.length!==count||values.some(n=>!Number.isInteger(n)||n<1||n>10))throw Error('Roll one D10 for each required transport safety check.');
  s.localJourneys[ship.id]={kind:'transport',from:{q:local.q,r:local.r},to:{q:local.q,r:local.r},total:12,remaining:12,clockAt:Date.now(),ownerId:characterId||'',operatorId:unit.id,order:{...body,shipId:ship.id,station:check.a.seat.key,risk,scramblers:check.scramblers},diceResults:values};
 }else if(b.kind==='undock'){
  const target=c.starships.find(x=>x.id===b.targetId),dock=target?.ship.fieldState?.dockedIn;if(dock?.shipId!==ship.id)throw Error('Choose a ship in this docking bay.');
  const bay=ship.ship.sicInventory.find(i=>i.id===dock.sicId);if(!bay||!maps.operational(bay)||bay.impaired)throw Error('Restore the docking bay first.');
  if(b.decompressed!==true)throw Error('Confirm the bay is sealed and decompressed.');
  const room=require('./campaign-starmaps').travelRoom(c);room.shipPositions=c.starships.map(x=>({id:x.id,...(s.localPositions[x.id]||{q:1000,r:1000})}));room.spaceObjects=objects(star);
  require('./ship-field-utilities').releaseDocked(room,ship,target,dock.sicId);
  const position=room.shipPositions.find(x=>x.id===target.id);s.positions[target.id]=structuredClone(s.positions[ship.id]);s.localPositions[target.id]={...local,q:position.q,r:position.r,phase:local.phase==='surface'?'surface':'system',planetId:local.phase==='surface'?local.planetId:undefined};
 }else return false;
 follow(c,ship);return true;
}
function transportRoom(c,star){const room=require('./campaign-ship-room')(c),s=state(c);room.shipPositions=c.starships.map(x=>({id:x.id,...(s.localPositions[x.id]||{q:10000,r:10000})}));room.spaceObjects=objects(star);return room;}
function completeTransport(c,ship,j){
 const s=state(c),p=s.localPositions[ship.id],room=transportRoom(c,context(c,p).star),unit=room.units.find(u=>u.id===j.operatorId);if(!unit)return;
 unit.delayedAction={transporterOrder:j.order,rollConfirmed:true,submittedRoll:{values:j.diceResults}};
 const message=require('./ship-transporter').resolve(room,unit);require('./ship-state').locations(c.starships,room.units);
 for(const u of room.units){const character=c.characters?.find(r=>r.id===u.characterId);if(character&&Number.isFinite(u.currentHp)){character.character.health||={};character.character.health.current=u.currentHp;}else{const npc=c.npcRoster?.find(n=>n.id===u.id);if(npc){npc.location=u.location;npc.currentHp=u.currentHp;}}}
 if(message?.startsWith('Transport completed:')){if(j.kind==='recall')require('./campaign-planets').depart(c,ship);else {const passengers=j.order.passengerIds.filter(id=>room.units.some(u=>u.id===id&&u.currentHp>0&&u.location?.environment==='surface'));if(passengers.length)require('./campaign-planets').arrival(c,ship,{ownerId:j.ownerId,transport:true,passengers});}}
 require('./campaign-starmaps').note(c,message,ship);
}
function advance(c,seconds,{onlyId,now=Date.now()}={}){const s=state(c);for(const [id,j]of Object.entries(s.localJourneys)){if(onlyId&&onlyId!==id)continue;const ship=c.starships.find(x=>x.id===id),p=s.localPositions[id];j.clockAt=now;if(!ship||!p){delete s.localJourneys[id];continue;}if(!working(c,ship)||j.kind==='move'&&maps.propulsion(ship).moveSpeed<=0||['descend','ascend'].includes(j.kind)&&!require('./campaign-planets').canLaunch(c,ship)){delete s.localJourneys[id];continue;}j.remaining=Math.max(0,j.remaining-seconds);const f=1-j.remaining/j.total;p.q=j.from.q+(j.to.q-j.from.q)*f;p.r=j.from.r+(j.to.r-j.from.r)*f;if(j.remaining===0){if(['transport','recall'].includes(j.kind))completeTransport(c,ship,j);if(j.kind==='ascend'){p.phase='orbit';require('./campaign-planets').depart(c,ship);require('./campaign-starmaps').note(c,ship.title+' reached orbit.',ship);}if(j.kind==='descend'){p.phase='surface';require('./campaign-planets').arrival(c,ship,{ownerId:j.ownerId});require('./campaign-starmaps').note(c,ship.title+' landed on '+(objects(context(c,p).star).find(x=>x.id===p.planetId)?.name||'the planet')+'.',ship);}delete s.localJourneys[id];}follow(c,ship);}}
function tick(c,now,paused){const s=state(c);let changed=false,finished=false;for(const [id,j]of Object.entries(s.localJourneys)){const elapsed=Math.max(0,now-(j.clockAt??now));j.clockAt=now;if(paused||!elapsed)continue;advance(c,elapsed/1000,{onlyId:id,now});changed=true;if(!s.localJourneys[id])finished=true;}return {changed,finished};}
module.exports={commands,state,command,advance,tick,objects,accessible,cancel,follow,normalizeFile};
