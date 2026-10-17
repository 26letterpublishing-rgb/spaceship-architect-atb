'use strict';
const {randomUUID}=require('node:crypto'),terrain=require('./planet-terrain');
const commands=new Set(['planetTravelRequest','planetTravelDecision']);
const locationKey=p=>p&&[p.mapId,p.starId,p.planetId,p.hex,p.regionId||'',p.regionHex||''].join('/');
function route(from,to,region=false){
 const width=region?15:30,cell=k=>{const r=Math.floor(Number(k)/width);return {q:Number(k)%width-(r-(r&1))/2,r};},a=cell(from),b=cell(to);
 const distance=(x,y)=>(Math.abs(x.q-y.q)+Math.abs(x.r-y.r)+Math.abs(x.q+x.r-y.q-y.r))/2;
 const options=region?[b]:[-width,0,width].map(n=>({...b,q:b.q+n}));const end=options.sort((x,y)=>distance(a,x)-distance(a,y))[0];
 return {from:a,to:end,distance:distance(a,end)};
}
function notify(c,message,characterId,kind='system'){
 c.privateNotes||=[];const note={id:randomUUID(),kind,direction:characterId?'to-character':'to-gm',...(characterId?{characterId}:{}),message,createdAt:new Date().toISOString(),readAt:null};c.privateNotes.push(note);return note;
}
function begin(c,next,{kind='walk',ownerId='',duration}={}){
 const s=c.starmaps;if(s.partyJourney)throw Error('Wait for the party’s current journey to finish.');
 const p=s.party,regional=!!next.regionId,r=route(regional?p.regionHex:p.hex,regional?next.regionHex:next.hex,regional),total=duration??Math.max(1.5,Math.min(120,r.distance*(regional?2:4)));
 s.partyJourney={id:randomUUID(),kind,from:structuredClone(p),to:structuredClone(next),route:r,total,remaining:total,clockAt:Date.now(),ownerId};
 s.viewEvent={id:s.partyJourney.id,kind};return s.partyJourney;
}
function command(c,b,{gm,characterId,combatActive}){
 if(!commands.has(b.kind))return false;
 if(combatActive)throw Error('Finish combat before requesting surface travel.');
 const s=c.starmaps,planets=require('./campaign-planets');s.travelRequests||=[];
 if(b.kind==='planetTravelRequest'){
  if(gm||!c.characters.some(r=>r.id===characterId))throw Error('A linked player must request travel.');
  const p=s.party,{region,planet,chart}=planets.target(c,b);if(!p||p.awaitingLanding||p.mapId!==b.mapId||p.starId!==b.starId||p.planetId!==b.planetId||(p.regionId||'')!==(b.regionId||''))throw Error('Request a destination on the party’s current map.');
  if(s.partyJourney||Object.values(s.localJourneys||{}).some(j=>['ascend','descend'].includes(j.kind)))throw Error('Wait for current travel to finish.');
  if(!terrain.validHex(b.hex,!!region))throw Error('Choose a destination inside this map.');const hex=String(Number(b.hex));
  if(hex===(region?p.regionHex:p.hex))throw Error('The party is already here.');
  const to={...p,...(region?{regionHex:hex}:{hex})};
  if(s.travelRequests.some(r=>r.status==='pending'&&locationKey(r.from)===locationKey(p)&&locationKey(r.to)===locationKey(to)))throw Error('A travel request for that hex is already pending.');
  const label=(chart.hexes[hex]?.label||'Hex '+(Number(hex)+1))+' · '+(region?.name||planet.name),who=c.characters.find(r=>r.id===characterId)?.character.identity?.characterName||'The party';
  const note=notify(c,who+' requests party travel to '+label+'.',null,'surface-travel');note.characterId=characterId;note.characterName=who;
  s.travelRequests=[...s.travelRequests.filter(r=>r.status==='pending').slice(-49),{id:note.id,from:structuredClone(p),to,status:'pending',characterId,label}];
 }else{
  if(!gm)throw Error('Only the GM can approve party travel.');const request=s.travelRequests.find(r=>r.id===b.requestId);if(!request||request.status!=='pending')throw Error('This request has already been resolved.');
  if(b.approve){if(locationKey(s.party)!==locationKey(request.from))throw Error('The party has moved since this request. Decline it and request a new destination.');if(Object.values(s.localJourneys||{}).some(j=>['ascend','descend'].includes(j.kind)))throw Error('Wait for current travel to finish.');begin(c,request.to,{ownerId:request.characterId});request.status='approved';}
  else request.status='declined';
  const note=c.privateNotes.find(n=>n.id===request.id);if(note)note.readAt=new Date().toISOString();notify(c,'Travel to '+request.label+' '+request.status+'.',request.characterId);
  if(b.approve)for(const other of s.travelRequests)if(other.status==='pending'){other.status='superseded';const n=c.privateNotes.find(n=>n.id===other.id);if(n)n.readAt=new Date().toISOString();}
 }
 return true;
}
function tick(c,now,paused){
 const s=c.starmaps,j=s?.partyJourney;if(!j)return {changed:false,finished:false};const elapsed=Math.max(0,now-(j.clockAt??now));j.clockAt=now;if(paused||!elapsed)return {changed:false,finished:false};
 j.remaining=Math.max(0,j.remaining-elapsed/1000);
 if(j.remaining===0){
  // Cancel safely if a GM relocation replaced the starting location during travel.
  if(locationKey(s.party)===locationKey(j.from)){
   if(j.kind==='landing'){const p=s.localPositions[j.to.shipId];if(p)Object.assign(p,{surfaceHex:j.to.hex,regionId:'',regionHex:''});}
   try{require('./campaign-planets').place(c,j.to);}catch(error){notify(c,'Surface travel could not complete: '+error.message);}
  }
  delete s.partyJourney;return {changed:true,finished:true};
 }
 return {changed:true,finished:false};
}
function forceAboard(c,ship,confirmed){
 const s=c.starmaps;if(!s.party||ship.controlType!=='pc')return;
 if(!confirmed)throw Error('Confirm moving the party aboard and leaving the current planet or region.');
 const maps=require('./ship-map-core'),layout=maps.buildLayout(ship.ship),pilot=c.characters.find(r=>(r.character.health?.current??1)>0);
 const seat=[...layout.footprint.entries()].flatMap(([square,cell])=>maps.definition(cell.type).bridge&&maps.operational(cell.item)?cell.stations.filter(st=>st.x===cell.column&&st.y===cell.row).map(st=>({square,station:st})):[]).find(seat=>!(c.npcRoster||[]).some(n=>n.location?.starshipId===ship.id&&n.location.square===seat.square&&n.location.mesh===seat.station.mesh));
 if(!seat||!pilot)throw Error('A free working Bridge station and conscious PC are required to relocate the party aboard.');
 const p=s.localPositions[ship.id]||{};s.localPositions[ship.id]={...p,...s.party,phase:'surface',surfaceHex:s.party.hex};
 for(const vessel of c.starships){for(const id of c.characters.map(r=>r.id))if(vessel.characterLocations?.[id])vessel.characterLocations[id].environment='surface';}
 require('./planet-boarding').reconcile(c,{...s.party,transport:false,awaitingLanding:false});
 const station=seat.station;
 ship.characterLocations[pilot.id]={environment:'starship',starshipId:ship.id,square:seat.square,mesh:station.mesh,stationed:true,stationSlot:station.slot??0};
 delete s.party;delete s.partyJourney;delete s.shopArrival;delete s.surfaceReturnPolicy;
 s.navigation={mode:'galaxy',allowed:{surface:true,orbit:true,system:true,galaxy:true}};s.viewEvent={id:randomUUID(),kind:'relocation'};
}
module.exports={command,begin,tick,route,forceAboard,locationKey};
