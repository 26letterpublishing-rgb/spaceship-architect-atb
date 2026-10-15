(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./combat-arena'):root.SACombatArena);if(typeof module==='object'&&module.exports)module.exports=api;else root.SACrewCarry=api;})(typeof window==='object'?window:globalThis,function(arena){
// Carrying changes location only. It never grants turns or heals the passenger.
function candidates(room,carrier){const loc=carrier?.location;if(!loc||!Number.isInteger(loc.square))return [];return (room.units||[]).filter(p=>{
  if(p.id===carrier.id||Number(p.currentHp)>0||p.currentHp==null||p.carriedBy)return false;
  if(loc.starshipId)return p.location?.starshipId===loc.starshipId&&p.location?.square===loc.square;
  if(loc.arenaId!=='surface'||p.location?.arenaId!=='surface'||!room.arena)return false;
  const g=arena.surfaceGrid(room.arena),to=p.location.square;if(to===loc.square)return true;
  // Surface cells hold one standing character, so lift from an adjacent clear edge.
  const distance=Math.abs(loc.square%g.width-to%g.width)+Math.abs(Math.floor(loc.square/g.width)-Math.floor(to/g.width));
  const edge=g.edge(loc.square,to);return distance===1&&g.floor.has(to)&&(edge.kind==='none'||edge.kind==='door'&&edge.open);
});}
function command(room,carrier,targetId){
  if(!carrier||Number(carrier.currentHp)<=0||carrier.timedAction||carrier.delayedAction)throw Error('Finish the current action before carrying a patient.');
  if(carrier.carryingId){const patient=room.units.find(p=>p.id===carrier.carryingId);if(patient){patient.location={...carrier.location,stationed:false,sicId:'',stationSlot:null};patient.carriedBy=null;}carrier.carryingId=null;return 'Patient placed down.';}
  const patient=candidates(room,carrier).find(p=>p.id===targetId);if(!patient)throw Error('Choose a character at 0 HP on the same square aboard a ship or an adjacent, unobstructed surface square.');
  carrier.carryingId=patient.id;patient.carriedBy=carrier.id;patient.location={...carrier.location,stationed:false,sicId:'',stationSlot:null};patient.travelRoute=[];patient.timedAction=null;
  return 'Carrying '+patient.characterName+'. Move normally, then place the patient down.';
}
function sync(room){
  for(const carrier of room.units||[]){
    if(!carrier.carryingId)continue;
    const patient=room.units.find(p=>p.id===carrier.carryingId);
    if(!patient){carrier.carryingId=null;continue;}
    patient.location={...carrier.location,stationed:false,sicId:'',stationSlot:null};
    if(Number(carrier.currentHp)<=0||Number(patient.currentHp)>0){carrier.carryingId=null;patient.carriedBy=null;}
    else patient.carriedBy=carrier.id;
  }
  for(const patient of room.units||[])if(patient.carriedBy&&!room.units.some(u=>u.id===patient.carriedBy&&u.carryingId===patient.id))patient.carriedBy=null;
}
return {candidates,command,sync};
});
