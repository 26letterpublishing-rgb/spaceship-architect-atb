const maps=require('./ship-map-core'),engine=require('./combat-engine');
const dice=(c,key)=>(c.attributes?.[key]||[]).filter(n=>Number(n)>=0).map(n=>[4,6,8,10,12][Number(n)]).filter(Boolean);
function character(record,location){
 const c=record.character,identity=c.identity||{},computed=c.computed||{},rating=name=>Number(computed.skills?.[name]??(typeof c.skills?.[name]==='object'?c.skills[name].tenths/10:c.skills?.[name]))||0;
 const body={id:'pc-'+record.id,team:'pc',characterId:record.id,characterName:identity.characterName||'Crew',playerName:identity.playerName||'Player',controlledBy:'player',speed:computed.speed||5,commandWindow:computed.commandWindow||120,atb:0,color:c.presentation?.atbColor||'#39e58f',raceId:identity.raceId,raceType:identity.raceType,classId:identity.classId,location,
  dexterityDice:dice(c,'dexterity'),intellectDice:dice(c,'intellect'),strengthDice:dice(c,'strength'),dexterityBoxes:dice(c,'dexterity').length,highestPerceptionDie:Math.max(0,...dice(c,'perception')),moveSpeed:computed.moveSpeed||1,damageReduction:computed.damageReduction||0,maximumHp:computed.maximumHp,currentHp:c.health?.current??computed.maximumHp,items:c.items,statuses:c.statuses,
  weapons:(c.weapons||[]).map(w=>({...w,inventoryId:w.id||w.weaponId})),heldWeaponId:c.weapons?.find(w=>w.held)?.id,queuedEffects:[],pendingShipRolls:[],playerConnected:false};
 for(const [key,skill]of Object.entries({engineeringSkill:'Engineering',pilotSkill:'Pilot/Helm',sensorSkill:'Sensor Systems',weaponSystemsSkill:'Weapon Systems',mathematicsSkill:'Mathematics',computerSkill:'Computer Systems',hackingSkill:'Hacking',projectileSkill:'Projectile',meleeSkill:'Melee',dodgeSkill:'Dodge/Block',weaponMechanics:'Weapon Mechanics',anatomySkill:'Anatomy/Physiology',initiativeSkill:'Initiative'}))body[key]=rating(skill);
 engine.syncUnitCombat(body,{...body});return body;
}
function build(campaign,shipId){
 const record=campaign.starships.find(s=>s.id===shipId);if(!record)throw Error('Starship no longer exists.');
 const units=[];
 for(const pc of campaign.characters){const loc=record.characterLocations?.[pc.id];if(!loc||loc.environment==='exterior'||loc.escapePodId)continue;units.push(character(pc,{...loc,starshipId:shipId}));}
 for(const npc of campaign.npcRoster||[])if(npc.location?.starshipId===shipId&&!npc.location.escapePodId&&!npc.vacuum)units.push(structuredClone(npc));
 const layout=maps.buildLayout(record.ship);for(const u of units){const cell=layout.footprint.get(u.location.square);if(u.location.stationed)u.location.sicId=cell?.sicId||'';u.delayedAction=null;u.timedAction=null;u.delayTimer=null;u.consoleHold=null;u.pendingShipRolls=[];u.atb=0;}
 return {starships:[structuredClone(record)],units,shipPositions:[{id:shipId,q:0,r:0}],spaceObjects:[],hasEngagedClock:true,running:true,hardPaused:false,pausedForTurn:false,threshold:100};
}
module.exports={build,character};
