const {randomUUID}=require('node:crypto');
const {npcAttributeDice}=require('./combat-engine');

const GRACE=165, INTERVAL=16;
const air=require('./ship-atmosphere');
const copy=value=>JSON.parse(JSON.stringify(value));
const state=ship=>ship.ship?.oxygenState;
const enabled=ship=>require('./ship-map-core').oxygenEnabled(ship);

function people(campaign,room=null){
  const result=[];
  for(const record of campaign?.characters||[]){
    const character=record.character,unit=room?.units.find(u=>u.characterId===record.id);
    const assigned=(campaign.starships||[]).find(s=>s.crewCharacterIds?.includes(record.id)&&s.characterLocations?.[record.id]);
    if(unit?.vacuum||unit?.location?.escapePodId||assigned?.characterLocations?.[record.id]?.escapePodId)continue;
    const shipId=unit?.location?.starshipId||assigned?.id;
    if(!shipId)continue;
    const dice=(character.attributes?.health||[]).filter(n=>n>=0).map(n=>[4,6,8,10,12][n]).filter(Boolean);
    const skill=character.skills?.['Athletics/Endurance'];
    result.push({id:record.id,characterId:record.id,unitId:unit?.id,shipId,name:character.identity?.characterName||'Crew',
      location:unit?.location||assigned?.characterLocations?.[record.id],movement:unit?.timedAction,dice,skill:Math.max(0,typeof skill==='object'?(Number(skill?.tenths)||0)/10:Number(skill)||0),
      immune:require('./breathing').independent(character),
      get hp(){return Number(unit?.currentHp??character.health?.current??0);},
      set hp(value){if(unit)unit.currentHp=value;character.health||={};character.health.current=value;record.updatedAt=new Date().toISOString();}
    });
  }
  for(const unit of room?.units||campaign?.npcRoster||[]){
    if(unit.characterId)continue;
    if(unit.vacuum||unit.location?.escapePodId)continue;
    const shipId=unit.location?.starshipId||(campaign.starships||[]).find(s=>s.crewNpcUnitIds?.includes(unit.id))?.id;
    if(!shipId)continue;
    result.push({id:unit.id,unitId:unit.id,characterId:null,shipId,location:unit.location,movement:unit.timedAction,name:unit.characterName||'NPC',dice:npcAttributeDice(unit.physicalAttribute),skill:Math.max(0,Number(unit.physicalSkill)||0),immune:require('./breathing').independent(unit),
      get hp(){return Number(unit.currentHp??unit.maximumHp??0);},set hp(value){unit.currentHp=value;}});
  }
  return result;
}

function cockpitProtected(ship,location){
  if(!location||!Number.isInteger(location.square))return false;
  const maps=require('./ship-map-core'),cell=maps.buildLayout(ship.ship).footprint.get(location.square);
  return Boolean(cell&&/^cockpit(?:-|$)/.test(cell.type)&&maps.operational(cell.item)&&!cell.item.impaired&&!(cell.item.impairmentPoints>0));
}

function setEnabled(ship,value){
  if((ship.ship.oxygenEnabled!==false)===value)return;
  ship.ship.oxygenEnabled=value;
  air.sync(ship);
  if(value&&air.groups(ship).every(g=>g.rate>0))for(const crew of Object.values(state(ship)?.crew||{})){crew.request=null;crew.phase='air';}
}

function sync(ships,actors){
  for(const ship of ships){
    if(ship.destroyedAt||ship.currentHullHp<=0){ship.ship.oxygenState=null;continue;}
    air.advance(ship,0,actors);
    const recovering=new Set(air.groups(ship,actors).filter(g=>g.rate>0).flatMap(g=>g.cells));
    const data=ship.ship.oxygenState||={crew:{},receipts:[],generation:randomUUID()};data.crew||={};data.receipts||=[];
    if(data.baseDifficulty!==6){for(const crew of Object.values(data.crew)){crew.difficulty=Math.max(6,(Number(crew.difficulty)||14)-8);if(crew.request)crew.request.difficulty=Math.max(6,(Number(crew.request.difficulty)||14)-8);}data.baseDifficulty=6;}
    const aboard=actors.filter(p=>p.shipId===ship.id&&!p.immune),ids=new Set(aboard.map(p=>p.id));
    for(const id of Object.keys(data.crew))if(!ids.has(id))delete data.crew[id];
    for(const person of aboard){
      const oxygen=air.at(ship,person.location),replenishing=Number.isInteger(person.location?.square)?recovering.has(person.location.square):Object.keys(ship.ship.atmosphereState.cells).every(k=>recovering.has(Number(k)));
      if(oxygen>10+1e-7){delete data.crew[person.id];if(oxygen>=100-1e-7&&replenishing)continue;data.crew[person.id]={id:person.id,characterId:person.characterId,name:person.name,oxygen,remaining:0,difficulty:6,phase:'air',request:null};continue;}
      const crew=data.crew[person.id]||={id:person.id,characterId:person.characterId,name:person.name,remaining:0,difficulty:6,phase:'breath',request:null};
      crew.oxygen=oxygen;if(replenishing){crew.request=null;crew.phase='air';continue;}if(crew.phase==='air'||crew.phase==='unconscious'&&person.hp>0){crew.phase='breath';crew.remaining=0;}
      // Migrate old breath reserves: the room threshold is now the first roll boundary.
      if(crew.phase==='breath')crew.remaining=0;
      if(person.hp<=0){crew.phase='unconscious';crew.request=null;}
    }
    data.graceRemaining=Number(Math.max(0,(Math.min(100,...Object.values(ship.ship.atmosphereState.cells))-10)/air.DEPLETION).toFixed(6));
  }
}
function pending(ships){return ships.some(s=>Object.values(state(s)?.crew||{}).some(c=>c.request));}
function nextEvent(ships){return Math.min(Infinity,...ships.flatMap(s=>[air.nextEvent(s),...Object.values(state(s)?.crew||{}).filter(c=>!['air','unconscious'].includes(c.phase)).map(c=>Math.max(0,c.remaining))]));}

function damage(ship,crew,person,events){
  if(person.hp<=0){crew.phase='unconscious';return;}
  const before=person.hp;person.hp=before-5;
  crew.phase=person.hp<=0?'unconscious':'suffocating';crew.remaining=INTERVAL;crew.request=null;
  events.push({shipId:ship.id,id:randomUUID(),actorId:person.id,unitId:person.unitId,characterId:person.characterId,name:person.name,beforeHp:before,currentHp:person.hp,damage:5,unconscious:person.hp<=0});
}

function advance(ships,actors,seconds){
  sync(ships,actors);const events=[];let left=Math.max(0,Number(seconds)||0);
  while(left>0&&!pending(ships)){
    const step=Math.min(left,Math.max(.000001,nextEvent(ships)));
    for(const ship of ships){
      const before=new Set(Object.values(state(ship)?.crew||{}).filter(c=>c.oxygen<=10+1e-7).map(c=>c.id));
      air.advance(ship,step,actors);sync([ship],actors);
      for(const crew of Object.values(state(ship)?.crew||{})){
        const person=actors.find(p=>p.id===crew.id&&p.shipId===ship.id);
        if(!person||['air','unconscious'].includes(crew.phase)||crew.request)continue;
        if(before.has(crew.id))crew.remaining=Math.max(0,crew.remaining-step);
        if(crew.remaining>1e-7)continue;
        if(crew.phase==='suffocating'){damage(ship,crew,person,events);continue;}
        crew.request={id:randomUUID(),dice:[...person.dice],skill:person.skill,difficulty:crew.difficulty};
      }
    }
    left-=step;
  }
  return events;
}

function resolve(ships,actors,{actorId,rollId,score}){
  const ship=ships.find(s=>state(s)?.crew?.[actorId]),data=ship&&state(ship),crew=data?.crew[actorId];
  if(!crew||crew.phase==='air'||crew.oxygen>10+1e-7)return {ok:false,error:'This oxygen check is no longer required.'};
  if(data.receipts.includes(rollId))return {ok:true,duplicate:true,events:[]};
  if(!crew.request||crew.request.id!==rollId)return {ok:false,error:'This oxygen check has changed. Use the current request.'};
  if(score===null||score===''||!Number.isFinite(Number(score))||Number(score)<0||Number(score)>100000)return {ok:false,error:'Enter and confirm a valid Health + Endurance result.'};
  const person=actors.find(p=>p.id===actorId&&p.shipId===ship.id);if(!person)return {ok:false,error:'The character is no longer aboard.'};
  const difficulty=crew.request.difficulty,success=Number(score)>=difficulty,events=[];
  crew.request=null;data.receipts=[...data.receipts,rollId].slice(-100);
  if(success){crew.phase='resist';crew.remaining=INTERVAL;crew.difficulty=difficulty+4;}
  else damage(ship,crew,person,events);
  crew.result={id:rollId,success,score:Number(score),difficulty,text:success?`Passed: ${score} against ${difficulty}. Next check in 16 seconds (difficulty ${crew.difficulty}).`:`Failed: ${score} against ${difficulty}. Lost 5 HP.${crew.phase==='unconscious'?' Unconscious.':' Losing 5 HP every 16 seconds until oxygen returns.'}`};
  return {ok:true,events,ship,crew};
}

function project(ships,{gm=false,characterId=null,paused=false}={}){
  if(!gm&&!characterId)return [];
  return ships.flatMap(ship=>{
    const data=state(ship);if(!data)return [];
    const crew=Object.values(data.crew).filter(c=>gm||c.characterId===characterId).map(c=>copy(c));
    return crew.length?[{id:ship.id,title:ship.title,graceRemaining:data.graceRemaining,paused:paused||pending(ships),crew}]:[];
  });
}

module.exports={cockpitProtected,GRACE,INTERVAL,people,enabled,setEnabled,sync,pending,nextEvent,advance,resolve,project};
