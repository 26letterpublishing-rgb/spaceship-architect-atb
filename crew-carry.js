// Carrying changes location only. It never grants turns or heals the passenger.
function candidates(room,carrier){if(!carrier?.location?.starshipId||!Number.isInteger(carrier.location.square))return [];return (room.units||[]).filter(p=>p.id!==carrier?.id&&Number(p.currentHp)<=0&&!p.carriedBy&&p.location?.starshipId===carrier?.location?.starshipId&&p.location?.square===carrier?.location?.square);}
function command(room,carrier,targetId){
  if(!carrier||Number(carrier.currentHp)<=0||carrier.timedAction||carrier.delayedAction)throw Error('Finish the current action before carrying a patient.');
  if(carrier.carryingId){const patient=room.units.find(p=>p.id===carrier.carryingId);if(patient){patient.location={...carrier.location,stationed:false,sicId:'',stationSlot:null};patient.carriedBy=null;}carrier.carryingId=null;return 'Patient placed down.';}
  const patient=candidates(room,carrier).find(p=>p.id===targetId);if(!patient)throw Error('Choose a character at 0 HP on the same square.');
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
module.exports={candidates,command,sync};
