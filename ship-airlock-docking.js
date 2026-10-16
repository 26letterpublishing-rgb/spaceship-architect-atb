'use strict';
const maps=require('./ship-map-core'),navigation=require('./ship-navigation');
const data=ship=>ship.ship.airlockDocking||={links:[],transfers:[],receipts:[]};
function eligible(room,a,b){return Boolean(a&&b&&a.id!==b.id&&!a.destroyedAt&&!b.destroyedAt&&!a.escapedAt&&!b.escapedAt&&!(a.currentShieldHp>0)&&!(b.currentShieldHp>0)&&a.ship.airlocks?.length&&b.ship.airlocks?.length&&require('./ship-commands').sameHex(room,a,b));}
function command(room,unit,body){
 const seat=navigation.station(room,unit,body.sicId);if(!seat||!maps.definition(seat.cell.type).shipControl||seat.cell.item.disabled||['offline','powered-down','destroyed','impaired'].includes(seat.cell.item.status))throw Error('Operate an available Bridge or Cockpit to dock.');
 const ship=seat.ship,store=data(ship);
 const targets=room.starships.filter(s=>eligible(room,ship,s)&&(room.outsideCombat&&s.controlType==='pc'||s.controlType==='pc'||(ship.sensorState?.contacts?.[s.id]?.level==='detected'||room.knownContacts?.[ship.id]?.[s.id]?.level==='detected')||unit.team==='npc')).map(s=>({id:s.id,title:s.title}));
 if(body.kind==='airlock-inspect')return {targets,links:store.links};
 const target=room.starships.find(s=>s.id===body.targetId);if(!targets.some(t=>t.id===body.targetId))throw Error('Both ships must share a hex, have airlocks, and have shields off.');
 const receipt=String(body.receipt||'');if(!/^[\w-]{8,100}$/.test(receipt))throw Error('A docking command receipt is required.');
 if(store.receipts.includes(receipt)||store.links.some(l=>l.targetId===target.id))return {text:'Docking is already active.'};
 const from=ship.ship.airlocks[0],to=target.ship.airlocks[0];
 // One connection per airlock prevents ambiguous boarding destinations.
 if(store.links.some(l=>l.square===from.square)||data(target).links.some(l=>l.square===to.square))throw Error('This airlock is already connected.');
 store.links.push({targetId:target.id,square:from.square,targetSquare:to.square,remaining:20,ready:false});
 data(target).links.push({targetId:ship.id,square:to.square,targetSquare:from.square,remaining:20,ready:false});
 store.receipts.push(receipt);store.receipts=store.receipts.slice(-100);return {text:'Airlock docking started: 20 seconds.'};
}
function boarding(room,shipId,targetId,square){const ship=room.starships.find(s=>s.id===shipId),target=room.starships.find(s=>s.id===targetId),link=ship?.ship.airlockDocking?.links?.find(l=>l.targetId===targetId&&l.ready&&l.square===square);if(!link||!eligible(room,ship,target))throw Error('This airlock is no longer docked.');return {ship,target,link};}
function reserve(room,unit,targetId,square){const {ship,link}=boarding(room,unit.location.starshipId,targetId,square),store=data(ship),id=unit.characterId||unit.id;if(store.transfers.some(t=>t.id===id))throw Error('This character is already boarding.');store.transfers.push({id,unitId:unit.id,targetId,square,targetSquare:link.targetSquare,phase:'walking',remaining:5});}
function advance(room,seconds,campaign){let changed=false;
 for(const ship of room.starships){const store=ship.ship.airlockDocking;if(!store)continue;
  const links=store.links||[];store.links=links.filter(l=>eligible(room,ship,room.starships.find(s=>s.id===l.targetId)));if(links.length!==store.links.length)changed=true;
  for(const link of store.links)if(!link.ready){link.remaining=Math.max(0,link.remaining-seconds);link.ready=link.remaining===0;changed=true;}
  for(const transfer of [...(store.transfers||[])]){
   const unit=(room.units||[]).find(u=>u.id===transfer.unitId||(u.characterId||u.id)===transfer.id),loc=ship.characterLocations?.[transfer.id]||unit?.location;
   if(transfer.phase==='walking'){
    if(unit?.defeatedAt||unit?.currentHp<=0){store.transfers=store.transfers.filter(t=>t!==transfer);changed=true;continue;}
    if(!store.links.some(l=>l.ready&&l.targetId===transfer.targetId)){store.transfers=store.transfers.filter(t=>t!==transfer);changed=true;continue;}
    if(!loc||loc.square==null||ship.characterWalks?.[transfer.id]||unit?.timedAction?.kind==='move'||Number(loc?.square)!==transfer.square)continue;
    transfer.phase='transit';const vanished={environment:'boarding',starshipId:'',square:null,mesh:4,stationed:false};if(ship.characterLocations?.[transfer.id])ship.characterLocations[transfer.id]=vanished;
    if(unit){unit.location=vanished;unit.consoleHold=false;unit.atb=0;}changed=true;continue;
   }
   transfer.remaining=Math.max(0,transfer.remaining-seconds);changed=true;if(transfer.remaining>0)continue;
   const target=room.starships.find(s=>s.id===transfer.targetId);if(!target)continue;
   const destination={environment:'starship',starshipId:target.id,square:transfer.targetSquare,mesh:4,stationed:false,stationSlot:null};
   if(unit){unit.location=destination;unit.travelRoute=[];unit.aim=null;unit.atb=0;}
   for(const s of room.starships)if(s.characterLocations)delete s.characterLocations[transfer.id];
   if(unit?.characterId||campaign?.characters?.some(c=>c.id===transfer.id)){target.characterLocations||={};target.characterLocations[transfer.id]=destination;if(room.outsideCombat&&target.controlType==='pc')target.crewCharacterIds=[...new Set([...(target.crewCharacterIds||[]),transfer.id])];}
   else{target.crewNpcUnitIds=[...new Set([...(target.crewNpcUnitIds||[]),transfer.id])];for(const source of room.starships)if(source.id!==target.id)source.crewNpcUnitIds=(source.crewNpcUnitIds||[]).filter(id=>id!==transfer.id);const npc=campaign?.npcRoster?.find(n=>n.id===transfer.id);if(npc)npc.location=destination;}
   if(campaign)for(const live of room.starships){const saved=campaign.starships.find(s=>s.id===live.id);if(saved&&saved!==live){saved.crewCharacterIds=[...(live.crewCharacterIds||[])];saved.crewNpcUnitIds=[...(live.crewNpcUnitIds||[])];saved.characterLocations=structuredClone(live.characterLocations||{});}}
   store.transfers=store.transfers.filter(t=>t!==transfer);
  }
 }
 return changed;
}
module.exports={command,eligible,boarding,reserve,advance};
