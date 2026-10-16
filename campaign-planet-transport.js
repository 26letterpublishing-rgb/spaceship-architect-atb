'use strict';
// Recall uses the existing Transporter validator, safety dice and arrival allocator.
function begin(c,b,auth){
 const s=require('./campaign-navigation').state(c),party=s.party,ship=c.starships.find(x=>x.id===b.shipId),local=s.localPositions[b.shipId];
 if(!party?.transport||party.shipId!==ship?.id||local?.phase!=='orbit'||local.planetId!==party.planetId||local.starId!==b.starId||local.mapId!==b.mapId)throw Error('The party’s ship must remain in orbit above this planet.');
 if(!auth.gm&&!party.passengers?.includes(auth.characterId))throw Error('Only a member of the surface party may request recall.');
 const room=require('./campaign-ship-room')(c);room.shipPositions=c.starships.map(x=>({id:x.id,...(s.localPositions[x.id]||{q:10000,r:10000})}));
 const star=s.maps.find(m=>m.id===local.mapId).stars.find(x=>x.id===local.starId);room.spaceObjects=star.system;
 const aboard=room.units.filter(u=>u.location?.starshipId===ship.id&&u.currentHp>0&&!u.shipAi);
 if(!aboard.length)throw Error('At least one living character must remain aboard the orbiting ship.');
 const transport=require('./ship-transporter'),body={kind:'transport',sicId:b.sicId,targetId:ship.id,returnPlanetId:party.planetId,passengerIds:party.passengers};
 let unit,check;
 for(const candidate of aboard){try{check=transport.validate(room,candidate,body,false);unit=candidate;break;}catch{}}
 if(!unit)throw Error('Keep a living character aboard, restore the Transporter, lower shields, and keep the surface party’s transponders.');
 const risk=Math.max(0,Number(check.a.item.impairmentPoints)||(check.a.item.impaired||check.a.item.status==='impaired'?1:0)),values=b.diceResults||[];
 if(values.length!==(risk?check.passengers.length:0)+check.scramblers.length||values.some(n=>!Number.isInteger(n)||n<1||n>10))throw Error('Confirm the required Transporter safety dice.');
 s.localJourneys[ship.id]={kind:'recall',from:{q:local.q,r:local.r},to:{q:local.q,r:local.r},total:12,remaining:12,clockAt:Date.now(),operatorId:unit.id,order:{...body,shipId:ship.id,station:check.a.seat.key,risk,scramblers:check.scramblers},diceResults:values};
}
module.exports={begin};
