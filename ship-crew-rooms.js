const {randomUUID}=require('node:crypto');
const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power');
const skillCatalog=require('./skill-catalog'),vrSimulations=require('./vr-simulations');
const TREATMENT_SECONDS=60, RECOVERY_SECONDS=300;
const VR_D4_LIMIT_TENTHS=40, VR_MAX_TENTHS=60;
const activePhases=new Set(['preparing','recovering']);
const state=ship=>ship.ship.crewRoomState ||= {rooms:{},receipts:[],down:{}};
function roomData(ship,id){const s=state(ship);s.rooms||={};s.receipts||=[];s.down||={};return s.rooms[id] ||= {notes:[],jobs:[],supplies:0};}
function jobs(room){return (room.starships||[]).flatMap(ship=>Object.entries(state(ship).rooms||{}).flatMap(([sicId,data])=>(data.jobs||[]).map(job=>({ship,sicId,job}))));}
const pending=()=>false;
const inTreatment=()=>false; // Patients may leave; unconscious characters still require a carrier.
function actors(room,campaign){
  const result=[];
  for(const record of campaign?.characters||[]){
    const unit=room.units?.find(u=>u.characterId===record.id),ship=room.starships.find(s=>s.crewCharacterIds?.includes(record.id)),loc=unit?.location||(ship?.characterLocations?.[record.id]&&{...ship.characterLocations[record.id],starshipId:ship.id}),character=record.character;
    result.push({id:record.id,unit,record,loc,name:character.identity?.characterName||'Crew',mechanical:character.identity?.raceId==='android',
      get hp(){return Number(unit?.currentHp??character.health?.current??0);},
      set hp(value){if(unit){unit.currentHp=value;if(value>0){unit.defeatedAt=null;unit.oxygenUnconscious=false;}}character.health||={};character.health.current=value;record.updatedAt=new Date().toISOString();record.character.updatedAt=record.updatedAt;},
      maximum:Number(unit?.maximumHp??character.computed?.maximumHp??character.health?.current??0)});
  }
  for(const unit of room.units||[])if(!unit.characterId)result.push({id:unit.id,unit,loc:unit.location,name:unit.characterName,mechanical:unit.raceType==='mechanical'||unit.raceId==='android'||unit.shipAi,
    get hp(){return Number(unit.currentHp??0);},set hp(value){unit.currentHp=value;if(value>0){unit.defeatedAt=null;unit.oxygenUnconscious=false;}const saved=campaign?.npcRoster?.find(n=>n.id===unit.id);if(saved){saved.currentHp=value;if(value>0){saved.defeatedAt=null;saved.oxygenUnconscious=false;}}},maximum:Number(unit.maximumHp||0)});
  return result;
}
function inside(ship,sicId,actor){return actor?.loc?.starshipId===ship.id&&maps.buildLayout(ship.ship).footprint.get(Number(actor.loc.square))?.sicId===sicId;}
function announce(ship,text){const data=state(ship);data.report={id:randomUUID(),text,at:Date.now()};return text;}
function notice(campaign,actor,text){if(actor?.record&&campaign){campaign.privateNotes||=[];campaign.privateNotes.push({id:randomUUID(),characterId:actor.id,characterName:actor.name,direction:'to-character',kind:'crew-room',message:text,createdAt:new Date().toISOString(),readAt:null});}}
function archiveEntry(details,{title,text,author,authorId}){
  title=String(title||'').trim();text=String(text||'').trim();
  if(!title||title.length>100||!text||text.length>4000)throw Error('Enter a title (up to 100 characters) and text (up to 4,000).');
  if(details.notes.length>=100)throw Error('This room has 100 entries. Remove an old entry first.');
  const entry={id:randomUUID(),title,text,author,authorId,checked:false,at:Date.now()};details.notes.unshift(entry);return entry;
}
function libraryShips(campaign,room){return campaign.starships.map(saved=>room?.starships.find(s=>s.id===saved.id)||saved);}
function libraryTargets(campaign,room){
  return libraryShips(campaign,room).flatMap(ship=>{
    if(ship.destroyed||Number(ship.currentHullHp??ship.ship.currentHullHp??1)<=0||power.output(ship,room?.units||[]).en<power.demand(ship))return [];
    const libraries=maps.installedItems(ship).filter(i=>i.type==='library'&&maps.operational(i)&&!i.impaired&&i.status!=='impaired'&&!(i.impairmentPoints>0));
    return libraries.map((item,index)=>({starshipId:ship.id,sicId:item.id,label:`${ship.title||ship.ship.title||'Starship'} — Library${libraries.length>1?' '+(index+1):''}`}));
  });
}
// GM-authenticated delivery uses the same archive as the physically staffed PC console.
function deliverLibrary(campaign,room,body){
  const ship=libraryShips(campaign,room).find(s=>s.id===body.starshipId);if(!ship)throw Error('Ship unavailable.');
  const id=String(body.requestId||'');if(!/^[\w-]{8,100}$/.test(id))throw Error('A Library delivery receipt is required.');
  const data=state(ship),fingerprint=JSON.stringify(['gm-library',body.sicId,body.title,body.text]),saved=data.receipts?.find(r=>r.id===id);
  if(saved){if(saved.fingerprint!==fingerprint)throw Error('That receipt belongs to another Library entry.');return {...saved.result,duplicate:true};}
  if(!libraryTargets(campaign,room).some(t=>t.starshipId===ship.id&&t.sicId===body.sicId))throw Error('Choose an installed, powered, undamaged Library.');
  const entry=archiveEntry(roomData(ship,body.sicId),{title:body.title,text:body.text,author:'GM',authorId:'gm'});
  const recipients=campaign.characters.filter(c=>campaign.starships.find(s=>s.id===ship.id)?.crewCharacterIds?.includes(c.id));
  for(const record of recipients)notice(campaign,{id:record.id,name:record.character.identity?.characterName||'Crew',record},`Library has been updated: ${ship.title||ship.ship.title||'Starship'} — ${entry.title}. Visit the Library to read the new entry.`);
  const result={entryId:entry.id,notified:recipients.length,text:`Library entry delivered. ${recipients.length} PC${recipients.length===1?'':'s'} notified.`};
  data.receipts=[...(data.receipts||[]),{id,fingerprint,result}].slice(-256);
  return result;
}
function notifyOwner(campaign,job,text){const record=campaign?.characters.find(c=>c.id===job.characterId);if(record)notice(campaign,{id:record.id,name:record.character.identity?.characterName,record},text);}
function validateAccess(room,unit,sicId){
  const access=stations.access(room,unit,sicId);
  if(!access||!access.definition.crewRoom||access.blocked||access.controlled)throw Error('Use an available room station aboard your own ship.');
  if(access.definition.localOnly&&access.remote)throw Error('Enter this room and occupy its station.');
  if(access.definition.energyCost>0&&power.output(access.ship,room.units).en<power.demand(access.ship))throw Error('Restore sufficient ship power before using this room.');
  return access;
}
function command(room,unit,body,{campaign,gm=false,outsideCombat=false}={}){
  const ship=room.starships.find(s=>s.id===(body.starshipId||body.shipId||unit?.location?.starshipId));
  if(!ship)throw Error('Ship unavailable.');
  const id=String(body.requestId||'');if(!/^[\w-]{8,100}$/.test(id))throw Error('A room command receipt is required.');
  const data=state(ship),fingerprint=JSON.stringify([unit?.characterId||unit?.id,body.kind,body.sicId,body.patientId,body.skill,body.score,body.title,body.text,body.noteId,body.checked,body.enabled,body.automationMode,body.mineral,body.quantity]);
  const saved=data.receipts?.find(r=>r.id===id);if(saved){if(saved.fingerprint!==fingerprint)throw Error('That receipt belongs to another room command.');return {...saved.result,duplicate:true};}
  const access=validateAccess(room,unit,body.sicId);if(access.ship.id!==ship.id)throw Error('Wrong ship.');
  const type=access.definition.utility,details=roomData(ship,access.id),impaired=Boolean(access.item.impaired||access.item.status==='impaired'||access.item.impairmentPoints>0);
  if(!outsideCombat&&!['medbay','ship-ai'].includes(type))throw Error('This room activity is only available outside combat.');
  let result={spent:false,text:''};
  if(type==='vr-training-room'){
    if(maps.roomOxygen(ship,unit.location?.square)<=10||!maps.gravityEnabled(ship)||!maps.installedItems(ship).some(i=>i.type==='life-support'&&maps.operational(i))||ship.ship.oxygenEnabled===false)throw Error('VR requires operational Life Support, oxygen and artificial gravity.');
    if(impaired)throw Error('The VR room is glitchy. Repair it before awarding training; the GM may narrate a simulation.');
    if(body.kind==='simulate'){
      const record=campaign?.characters.find(c=>c.id===unit.characterId),skill=String(body.skill||details.trainingSkill||'Pilot/Helm');
      if(!skillCatalog.names.includes(skill)&&!Object.hasOwn(record?.character.skills||{},skill))throw Error('Choose a character skill.');
      details.simulation=vrSimulations.title(skill,body.text).slice(0,120);details.trainingSkill=skill;details.safety=body.enabled!==false;
      details.report={text:vrSimulations.narrative(unit.characterName,skill,details.simulation)+' Practice simulation; no training award.',at:Date.now()};
      result.text='Simulation loaded: '+details.simulation+(details.safety?' / safety protocols on.':' / safety protocols off. GM adjudicates consequences.');
    }
    else if(body.kind==='train'){
      const record=campaign?.characters.find(c=>c.id===unit.characterId);if(!record)throw Error('Choose a registered player character for skill training.');
      const day=Math.floor(Number(campaign.elapsedMinutes||0)/1440),skills=record.character.skills||={},skill=String(body.skill||'');
      if(!skillCatalog.names.includes(skill)&&!Object.hasOwn(skills,skill))throw Error('Choose a character skill.');
      const old=skills[skill],tenths=typeof old==='object'?Number(old.tenths||0):Math.round(Number(old||0)*10);
      if(record.character.vrTrainingDay===day)throw Error('Daily VR training already used. The GM must advance campaign time to another day.');
      if(tenths>=VR_MAX_TENTHS)throw Error('VR training stops at skill 6.0. Choose another skill.');
      const gain=tenths>VR_D4_LIMIT_TENTHS?1:body.score;
      if(!Number.isInteger(gain)||gain<1||gain>4)throw Error('Enter your manually rolled D4 result.');
      skills[skill]={...(typeof old==='object'?old:{}),tenths:tenths+gain};
      record.character.computed||={};record.character.computed.skills||={};record.character.computed.skills[skill]=(tenths+gain)/10;
      if(skill==='Athletics/Endurance'&&Number.isFinite(record.character.computed.moveSpeed))record.character.computed.moveSpeed+=gain/10;
      record.character.vrTrainingDay=day;record.updatedAt=new Date().toISOString();record.character.updatedAt=record.updatedAt;
      details.simulation=vrSimulations.title(skill,body.text||(details.trainingSkill===skill&&details.simulation)).slice(0,120);
      if(body.enabled!==undefined)details.safety=body.enabled!==false;
      details.trainingSkill=skill;
      details.report={text:vrSimulations.narrative(unit.characterName,skill,details.simulation),at:Date.now()};
      result.text=skill+': '+(tenths/10).toFixed(1)+' to '+((tenths+gain)/10).toFixed(1)+'. Daily training used.';
      notice(campaign,{id:record.id,name:record.character.identity?.characterName,record},result.text);
    }else throw Error('Choose a simulation or training result.');
  }else if(type==='gym'){
    if(impaired)throw Error('Repair the Gym before using its equipment.');
    if(body.kind!=='exercise')throw Error('Choose an exercise.');
    const activity=['Strength circuit','Endurance workout','Stretching'].includes(body.text)?body.text:'Stretching';
    details.report={text:(unit.characterName||'Crew')+' completed '+activity.toLowerCase()+'. No automatic skill or attribute award.',at:Date.now()};result.text=details.report.text;
  }else if(type==='science-lab'&&['deposit','withdraw'].includes(body.kind)){
    if(impaired)throw Error('Repair the Science Lab before using its storage controls.');
    const mineral=String(body.mineral||''),quantity=Number(body.quantity);if(!require('./space-objects').minerals.includes(mineral)||!Number.isSafeInteger(quantity)||quantity<1)throw Error('Choose a mineral and a positive whole quantity.');
    details.minerals||={};ship.ship.minerals||={};const deposit=body.kind==='deposit',from=deposit?ship.ship.minerals:details.minerals,to=deposit?details.minerals:ship.ship.minerals;
    if((from[mineral]||0)<quantity)throw Error('Not enough minerals in the selected store.');
    if(deposit&&Object.values(details.minerals).reduce((s,n)=>s+Number(n||0),0)+quantity>5000)throw Error('The Science Lab holds at most 5,000 minerals.');
    from[mineral]-=quantity;to[mineral]=(to[mineral]||0)+quantity;result.text=quantity+' '+mineral+(deposit?' moved into laboratory storage.':' returned to ship stores.');
  }else if(type==='library'||type==='meeting-room'||type==='science-lab'){
    if(impaired)throw Error(type==='library'?'The Library database is inaccessible while impaired.':'Repair the '+access.definition.name+' before using its shared console.');
    if(body.kind==='note'){
      archiveEntry(details,{title:body.title,text:body.text,author:unit.characterName||'Crew',authorId:unit.characterId||unit.id});result.text=['library','science-lab'].includes(type)?'Research entry archived.':'Briefing item posted.';
    }else if(body.kind==='check'||body.kind==='remove'){
      const note=details.notes.find(n=>n.id===body.noteId);if(!note)throw Error('Entry no longer exists.');
      if(body.kind==='remove'){if(!gm&&note.authorId!==(unit.characterId||unit.id))throw Error('Only the author or GM may remove this entry.');details.notes=details.notes.filter(n=>n!==note);}
      else note.checked=Boolean(body.checked);
      result.text='Shared record updated.';
    }else if(body.kind==='refresh'&&type==='library'){
      if(!gm)throw Error('The GM must confirm contact with an information node.');
      details.nodeUpdatedAt=Date.now();result.text='Galactic database refreshed at the information node.';
    }else throw Error('Choose an archive or briefing operation.');
  }else if(type==='medbay'){
    if(body.kind!=='treat')throw Error('Medbay care starts automatically when a patient enters.');
    const patient=actors(room,campaign).find(a=>a.id===body.patientId);
    if(!inside(ship,access.id,patient))throw Error('The patient must be physically inside this Medbay.');
    reconcile(room,campaign);result.text=patient.hp<=0&&(state(ship).down[patient.id]||0)>=RECOVERY_SECONDS?'Patient is dead':'Automatic patient care is active.';
  }else if(type==='ship-ai'){
    if(body.kind!=='configure')throw Error('Choose AI settings.');
    if(body.automationMode!==undefined)require('./ship-ai').configure(room,ship,body.automationMode);
    details.name=String(body.text||'Ship AI').trim().slice(0,60)||'Ship AI';details.enabled=body.enabled!==false;
    result.text=details.name+(details.enabled?' online. A free bridge station is required for ship actions.':' in standby.');
  }
  announce(ship,result.text);data.receipts=[...(data.receipts||[]),{id,fingerprint,result}].slice(-256);return result;
}
function reconcile(room,campaign){
  let changed=false;const people=actors(room,campaign);
  for(const {job} of jobs(room))if(['treating','healing','risk','adjudication'].includes(job.phase)){job.phase='cancelled';changed=true;}
  for(const actor of people)if(actor.unit)actor.unit.medbayTreatment=null;
  for(const ship of room.starships){
    const data=state(ship);data.down||={};
    for(const actor of people.filter(a=>a.loc?.starshipId===ship.id&&!a.mechanical)){
      if(actor.hp>0)data.down[actor.id]=0;
      for(const item of maps.installedItems(ship).filter(i=>maps.definition(i.type).utility==='medbay')){
        const details=roomData(ship,item.id),present=inside(ship,item.id,actor);
        let job=details.jobs.find(j=>j.patientId===actor.id&&['preparing','recovering','dead'].includes(j.phase));
        const available=maps.roomOxygen(ship,actor.loc?.square)>10&&stations.online(item)&&!item.impaired&&item.status!=='impaired'&&!(item.impairmentPoints>0)&&ship.currentHullHp!==0&&power.output(ship,room.units).en>=power.demand(ship);
        if(job&&(!present||!available||actor.hp>=actor.maximum||(job.phase==='dead'&&actor.hp>0))){job.phase='complete';changed=true;job=null;}
        if(present&&available&&actor.hp<actor.maximum&&!job){
          job={id:randomUUID(),patientId:actor.id,patientName:actor.name,phase:actor.hp>0?'recovering':(data.down[actor.id]||0)>=RECOVERY_SECONDS?'dead':'preparing',remaining:actor.hp>0?3:TREATMENT_SECONDS,automatic:true};
          details.jobs=[...details.jobs.slice(-29),job];changed=true;
        }
      }
    }
  }
  return changed;
}
function advance(room,campaign,seconds){
  if(!(seconds>0))return false;
  let changed=reconcile(room,campaign);const people=actors(room,campaign);
  for(const actor of people.filter(a=>!a.mechanical)){
    const ship=room.starships.find(s=>s.id===actor.loc?.starshipId);if(!ship)continue;
    const data=state(ship),entry=jobs(room).find(e=>e.ship.id===ship.id&&e.job.patientId===actor.id&&activePhases.has(e.job.phase));
    let left=seconds,down=data.down[actor.id]||0;
    if(!entry){if(actor.hp<=0){data.down[actor.id]=Math.min(RECOVERY_SECONDS,down+left);changed=true;}continue;}
    const {job}=entry;
    while(left>1e-8&&activePhases.has(job.phase)&&actor.hp<actor.maximum){
      const untilDeath=actor.hp<=0?Math.max(0,RECOVERY_SECONDS-down):Infinity;
      const step=Math.min(left,job.remaining,untilDeath);
      left-=step;job.remaining=Math.max(0,job.remaining-step);if(actor.hp<=0)down+=step;changed=true;
      if(actor.hp<=0&&down>=RECOVERY_SECONDS-1e-8){job.phase='dead';job.result='Patient is dead';announce(ship,'Patient is dead: '+actor.name);notice(campaign,actor,'Patient is dead');break;}
      if(job.remaining<=1e-8){
        if(job.phase==='preparing'){job.phase='recovering';job.remaining=3;}
        else{actor.hp=Math.min(actor.maximum,Math.max(0,actor.hp)+1);down=0;job.remaining=3;if(actor.hp>=actor.maximum){job.phase='complete';job.result=actor.name+' has recovered to full HP.';announce(ship,job.result);}}
      }
    }
    data.down[actor.id]=actor.hp>0?0:down;
  }
  return changed;
}
function nextEvent(room){return Math.min(Infinity,...jobs(room).filter(({job})=>activePhases.has(job.phase)).map(({ship,job})=>Math.min(job.remaining,job.phase==='preparing'?Math.max(0,RECOVERY_SECONDS-(state(ship).down[job.patientId]||0)):Infinity)));}
function resolve(){throw Error('Medbay healing is automatic. No dice result is required.');}
function rolls(){return [];}
function inspect(room,campaign,unit,sicId,gm){
  reconcile(room,campaign);
  const access=validateAccess(room,unit,sicId),record=campaign?.characters.find(c=>c.id===unit.characterId);
  const details=roomData(access.ship,sicId),presentation=access.definition.utility==='vr-training-room'&&details.trainingSkill?{...details,simulation:vrSimulations.title(details.trainingSkill,details.simulation)}:details;
  return {shipId:access.ship.id,sicId,type:access.definition.utility,name:access.definition.name,details:presentation,shipMinerals:{...access.ship.ship.minerals},gm,outsideCombat:Boolean(room.outsideCombat),
    occupants:actors(room,campaign).filter(a=>inside(access.ship,sicId,a)).map(a=>({id:a.id,name:a.name})),
    patients:actors(room,campaign).filter(a=>inside(access.ship,sicId,a)&&!a.mechanical).map(a=>({id:a.id,name:a.name,hp:a.hp,maximum:a.maximum,downSeconds:state(access.ship).down?.[a.id]||0,busy:inTreatment(room,a.id)})),
    attributes:[...skillCatalog.groups,...(Object.keys(record?.character.skills||{}).some(name=>!skillCatalog.names.includes(name))?[{key:'other',label:'Other skills'}]:[])],
    skills:record?vrSimulations.skills(record.character).filter(s=>s.value*10<VR_MAX_TENTHS).map(s=>({...s,trainingGain:s.value*10>VR_D4_LIMIT_TENTHS?1:null})):[],
    trained:record?.character.vrTrainingDay===Math.floor(Number(campaign?.elapsedMinutes||0)/1440),umbrexium:Number(access.ship.ship.minerals?.Umbrexium||0),aiAlert:state(access.ship).aiAlert||null};
}
module.exports={TREATMENT_SECONDS,RECOVERY_SECONDS,state,roomData,jobs,pending,inTreatment,actors,command,advance,nextEvent,reconcile,resolve,rolls,announce,inspect,libraryTargets,deliverLibrary};
