const {validatePreparation,preparationFingerprint}=require('./encounter-preparation');
const distances=require('./ship-distances');
function build(room,body,campaign,normalizeShips,prepareUnit){
  const fingerprint='reinforcement:'+preparationFingerprint(body);
  const prior=room.preparations?.find(r=>r.id===body.preparationId);
  if(prior){if(prior.fingerprint!==fingerprint)throw Error('This request ID was already used for a different action.');return null;}
  if(!room.hasEngagedClock||room.encounterEndedAt||!room.starships?.length)throw Error('Add ships only to an active starship encounter.');
  if(body.expectedEncounterId!==room.encounterId)throw Error('The encounter changed. Reopen the arrival setup.');
  if(body.mode!=='starship'||body.starships?.length!==1)throw Error('Select exactly one incoming ship.');
  if(room.starships.length>=6)throw Error('The encounter already contains six ships.');
  const id=body.starships[0]?.id;
  if(room.starships.some(s=>s.id===id))throw Error('That ship is already in combat.');
  if(body.units?.some(u=>u.location?.starshipId!==id))throw Error('Deploy incoming crew only aboard the incoming ship.');
  const prepared=validatePreparation(body,campaign,normalizeShips);
  // Match ordinary encounter deployment when a saved ship departs a planet.
  for(const ship of prepared.starships)if(ship.ship.descentState?.phase==='landed'){
    delete ship.escapedAt;delete ship.ship.descentState;
  }
  if(room.units.length+prepared.units.length>200)throw Error('The encounter cannot exceed 200 combatants.');
  for(const u of prepared.units){
    if(room.units.some(old=>u.characterId&&old.characterId===u.characterId||[u.npcRosterId,u.preparationUnitId].filter(Boolean).includes(old.id)))throw Error('An incoming crew member is already in this encounter.');
  }
  const incoming={...room,starships:prepared.starships,units:prepared.units.map(u=>{
    const saved=u.team==='npc'&&campaign.npcRoster?.find(n=>n.id===u.npcRosterId);
    return prepareUnit(saved?{...u,currentHp:saved.currentHp,exertionCurrent:saved.exertionCurrent,exertionMax:saved.exertionMax,exertionDerivedMax:saved.exertionDerivedMax}:u,room.threshold);
  })};
  require('./ship-ai').sync(incoming,prepareUnit);
  if(room.units.length+incoming.units.length>200)throw Error('The encounter cannot exceed 200 combatants.');
  require('./ship-power').refresh(incoming);
  require('./ship-shields').refresh(incoming);
  const candidate=structuredClone(room);
  candidate.starships.push(...incoming.starships);candidate.units.push(...incoming.units);
  candidate.shipPositions=[...(room.shipPositions||[]),...prepared.shipPositions];
  candidate.shipDistances=distances.fromPositions(candidate.starships,candidate.shipPositions);
  candidate.preparations=[...(room.preparations||[]),{id:body.preparationId,fingerprint}].slice(-100);
  return candidate;
}
async function commit(room,candidate,persist){
  if(!candidate)return false;
  if(!await persist(candidate))throw Error('Campaign could not be saved.');
  Object.assign(room,candidate);return true;
}
module.exports={build,commit};
