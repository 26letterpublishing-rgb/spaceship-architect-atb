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
// Medbay patients may leave. A conscious sleeper must first use the chamber's wake control.
const sleeper=(room,id)=>(room.starships||[]).flatMap(ship=>Object.entries(state(ship).rooms||{}).map(([sicId,details])=>({ship,sicId,details}))).find(e=>e.details.hibernation?.phase==='sleeping'&&e.details.hibernation.occupantId===id);
const inTreatment=(room,id)=>Boolean(sleeper(room,id));
const hibernating=room=>(room.starships||[]).some(ship=>Object.values(state(ship).rooms||{}).some(d=>d.hibernation?.phase==='sleeping'));
const impairment=item=>Boolean(item?.impaired||item?.status==='impaired'||item?.impairmentPoints>0);
function hibernationUnavailable(room,ship,square){
  if(!maps.oxygenEnabled(ship))return 'Life Support is offline';
  if(power.output(ship,room.units||[]).en<power.demand(ship))return 'insufficient ship power';
  if(maps.roomOxygen(ship,square)<=10)return 'unsafe room oxygen';
  if(ship.currentHullHp===0||ship.destroyedAt)return 'ship emergency';
  return '';
}
function wake(ship,details,actor,campaign,reason){
  const sleep=details.hibernation;if(sleep?.phase!=='sleeping')return false;
  sleep.phase='awake';sleep.wakeReason=reason;sleep.wokeAt=Date.now();
  details.report={text:(actor?.name||sleep.occupantName)+' awakened: '+reason+'.',at:Date.now()};
  announce(ship,details.report.text);notice(campaign,actor,details.report.text);return true;
}
function reconcileHibernation(room,campaign,people){
  let changed=false;
  for(const ship of room.starships||[])for(const [sicId,details]of Object.entries(state(ship).rooms||{})){
    const sleep=details.hibernation;if(sleep?.phase!=='sleeping')continue;
    const actor=people.find(a=>a.id===sleep.occupantId),item=maps.installedItems(ship).find(i=>i.id===sicId);
    let reason='';
    if(!actor||!inside(ship,sicId,actor))reason='occupant left the chamber';
    else if(!item)reason='chamber unavailable';
    else if(impairment(item)){
      if(actor){const loss=Math.ceil(Math.max(0,actor.hp)*.25);actor.hp=Math.max(0,actor.hp-loss);sleep.impairmentHpLoss=loss;}
      reason='chamber impaired'+(sleep.impairmentHpLoss?' — lost '+sleep.impairmentHpLoss+' HP':'');
    }else if(!stations.online(item))reason='chamber unavailable';
    else if(actor.hp<=0)reason='medical emergency';
    else reason=hibernationUnavailable(room,ship,actor.loc.square);
    if(!reason&&!room.outsideCombat)reason='encounter alert';
    if(!reason&&(Number(ship.currentHullHp)<sleep.hullHp||Number(ship.currentShieldHp)<sleep.shieldHp||actor.hp<sleep.hp))reason='damage alert';
    if(!reason&&(room.starships||[]).some(s=>s.id!==ship.id&&s.lockState?.targets?.some(t=>t.targetId===ship.id)))reason='incoming lock-on';
    if(reason)changed=wake(ship,details,actor,campaign,reason)||changed;
  }
  return changed;
}
function actors(room,campaign){
  const result=[];
  for(const record of campaign?.characters||[]){
    const unit=room.units?.find(u=>u.characterId===record.id),ship=room.starships.find(s=>s.crewCharacterIds?.includes(record.id)),loc=unit?.vacuum?null:unit?.location||(ship?.characterLocations?.[record.id]&&{...ship.characterLocations[record.id],starshipId:ship.id}),character=record.character;
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
  if(String(body.kind).startsWith('fabricate-')){const access=validateAccess(room,unit,body.sicId);if(access.ship.id!==ship.id||access.definition.utility!=='science-lab')throw Error('Use this Science Lab station.');return require('./ship-fabrication').command(room,ship,body.sicId,body,campaign);}
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
function validateAccess(room,unit,sicId,{wakeOnly=false}={}){
  const sleeping=sleeper(room,unit?.characterId||unit?.id);
  if(sleeping&&sleeping.sicId!==sicId)throw Error('Wake from hibernation before operating another room.');
  const access=stations.access(room,unit,sicId);
  const manualWake=wakeOnly&&sleeping?.sicId===sicId&&access?.ship.id===sleeping.ship.id&&inside(sleeping.ship,sicId,{loc:unit?.location});
  if(!access||!access.definition.crewRoom||(access.blocked||access.controlled)&&!manualWake)throw Error('Use an available room station aboard your own ship.');
  if(access.definition.localOnly&&access.remote)throw Error('Enter this room and occupy its station.');
  if(!manualWake&&access.definition.energyCost>0&&power.output(access.ship,room.units).en<power.demand(access.ship))throw Error('Restore sufficient ship power before using this room.');
  return access;
}
function command(room,unit,body,{campaign,gm=false,outsideCombat=false}={}){
  const ship=room.starships.find(s=>s.id===(body.starshipId||body.shipId||unit?.location?.starshipId));
  if(!ship)throw Error('Ship unavailable.');
  const id=String(body.requestId||'');if(!/^[\w-]{8,100}$/.test(id))throw Error('A room command receipt is required.');
  if(String(body.kind).startsWith('fabricate-')){const access=validateAccess(room,unit,body.sicId);if(access.ship.id!==ship.id||access.definition.utility!=='science-lab')throw Error('Use this Science Lab station.');return require('./ship-fabrication').command(room,ship,body.sicId,body,campaign);}
  if(String(body.kind).startsWith('extract-')){const access=validateAccess(room,unit,body.sicId);if(access.ship.id!==ship.id||!['mining-laser','vulture-drone'].includes(access.definition.utility))throw Error('Use the extraction station.');return require('./ship-extraction').command(room,ship,unit,body,campaign);}
  const data=state(ship),fingerprint=JSON.stringify([unit?.characterId||unit?.id,body.kind,body.sicId,body.patientId,body.skill,body.score,body.title,body.text,body.noteId,body.checked,body.enabled,body.automationMode,body.mineral,body.quantity]);
  const saved=data.receipts?.find(r=>r.id===id);if(saved){if(saved.fingerprint!==fingerprint)throw Error('That receipt belongs to another room command.');return {...saved.result,duplicate:true};}
  const access=validateAccess(room,unit,body.sicId,{wakeOnly:body.kind==='wake'});if(access.ship.id!==ship.id)throw Error('Wrong ship.');
  const type=access.definition.utility,details=roomData(ship,access.id),impaired=Boolean(access.item.impaired||access.item.status==='impaired'||access.item.impairmentPoints>0);
  if(!outsideCombat&&!['medbay','ship-ai','hibernation-chamber','brig'].includes(type))throw Error('This room activity is only available outside combat.');
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
  }else if(type==='bar'){
    if(body.kind==='bartender'){
      details.robotBartender=Boolean(body.enabled);result.text='Robotic bartender '+(details.robotBartender?'enabled.':'disabled; drinks are served manually.');
    }else if(body.kind==='order'){
      const drink=String(body.text||'').trim();if(!drink||drink.length>100)throw Error('Name a drink, up to 100 characters.');
      const robot=details.robotBartender!==false,roll=Number(body.score);
      if(robot&&impaired&&(!Number.isInteger(roll)||roll<1||roll>6))throw Error('Roll the standard D6: 1–3 gives an incorrect order; 4–6 gives the requested drink.');
      const wrong=robot&&impaired&&roll<=3;
      result.text=(unit.characterName||'Crew')+' ordered '+drink+'. '+(wrong?'The impaired bartender served the wrong drink.':robot?'The robotic bartender served the requested drink.':'The drink was served manually.');
      details.orders=[{id,characterId:unit.characterId||unit.id,requested:drink,incorrect:wrong,score:robot&&impaired?roll:null,text:result.text,at:Date.now()},...(details.orders||[])].slice(0,20);
      details.report={text:result.text,at:Date.now()};
    }else throw Error('Choose an order or bartender setting.');
  }else if(type==='hibernation-chamber'){
    const actor=actors(room,campaign).find(a=>a.id===(unit.characterId||unit.id));
    if(!actor||!inside(ship,access.id,actor))throw Error('Enter the Hibernation Chamber first.');
    if(body.kind==='wake'){
      if(details.hibernation?.phase==='sleeping'&&details.hibernation.occupantId!==actor.id&&!gm)throw Error('Only the occupant or GM may wake this chamber.');
      const occupant=actors(room,campaign).find(a=>a.id===details.hibernation?.occupantId)||actor;
      wake(ship,details,occupant,campaign,'manual wake');result.text=details.report?.text||'The chamber is already awake.';
    }else if(body.kind==='hibernate'){
      if(!outsideCombat)throw Error('Hibernation is available during travel outside combat; encounter alerts wake the occupant.');
      if(details.hibernation?.phase==='sleeping')throw Error('This chamber already has a sleeping occupant.');
      if(impaired)throw Error('Repair the Hibernation Chamber before entering.');
      if(actor.hp<=0)throw Error('An unconscious patient needs a Medbay.');
      const unavailable=hibernationUnavailable(room,ship,actor.loc.square);if(unavailable)throw Error('Cannot hibernate: '+unavailable+'.');
      details.hibernation={phase:'sleeping',occupantId:actor.id,occupantName:actor.name,activeSeconds:0,hullHp:Number(ship.currentHullHp),shieldHp:Number(ship.currentShieldHp)||0,hp:actor.hp,startedAt:Date.now()};
      result.text=actor.name+' entered hibernation. Emergency wake monitoring is active.';details.report={text:result.text,at:Date.now()};
    }else throw Error('Choose Enter Hibernation or Wake Now.');
  }else if(type==='brig'){
    if(!gm)throw Error('Only the GM may update prisoner custody or damage details.');
    if(body.kind==='intake'){
      const name=String(body.title||'').trim(),note=String(body.text||'').trim();
      if(!name||name.length>100||note.length>1000)throw Error('Enter a prisoner name (100 characters maximum) and optional custody notes (1,000 maximum).');
      details.prisoners||=[];if(details.prisoners.filter(p=>!p.released).length>=100)throw Error('This Brig has 100 custody records. Release a prisoner first.');
      details.prisoners=[{id,name,note,enteredAt:Date.now(),released:false},...details.prisoners.filter(p=>!p.released),...details.prisoners.filter(p=>p.released).slice(0,99)];result.text=name+' entered in the Brig custody register.';
    }else if(body.kind==='release'){
      const prisoner=details.prisoners?.find(p=>p.id===body.noteId);if(!prisoner)throw Error('Prisoner record unavailable.');
      prisoner.released=true;prisoner.releasedAt=Date.now();result.text=prisoner.name+' released from custody.';
    }else if(body.kind==='condition'){
      const text=String(body.text||'').trim();if(!text||text.length>1000)throw Error('Describe the Brig condition in 1–1,000 characters.');
      details.condition=text;result.text='Brig condition updated: '+text;
    }else throw Error('Choose a custody or condition operation.');
    details.report={text:result.text,at:Date.now()};
  }else if(type==='ship-ai'){
    if(body.kind!=='configure')throw Error('Choose AI settings.');
    if(body.automationMode!==undefined)require('./ship-ai').configure(room,ship,body.automationMode);
    details.name=String(body.text||'Ship AI').trim().slice(0,60)||'Ship AI';details.enabled=body.enabled!==false;
    result.text=details.name+(details.enabled?' online. A free bridge station is required for ship actions.':' in standby.');
  }
  announce(ship,result.text);data.receipts=[...(data.receipts||[]),{id,fingerprint,result}].slice(-256);return result;
}
function reconcile(room,campaign){
  const people=actors(room,campaign);let changed=reconcileHibernation(room,campaign,people);
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
  let changed=require('./ship-extraction').advance(room,campaign,seconds);changed=require('./ship-fabrication').advance(room,campaign,seconds)||changed;changed=reconcile(room,campaign)||changed;const people=actors(room,campaign);
  for(const ship of room.starships||[])for(const details of Object.values(state(ship).rooms||{}))if(details.hibernation?.phase==='sleeping'){details.hibernation.activeSeconds=Number(details.hibernation.activeSeconds||0)+seconds;changed=true;}
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
  const access=validateAccess(room,unit,sicId,{wakeOnly:true}),record=campaign?.characters.find(c=>c.id===unit.characterId);
  const changed=reconcile(room,campaign);
  const details=roomData(access.ship,sicId),presentation=access.definition.utility==='vr-training-room'&&details.trainingSkill?{...details,simulation:vrSimulations.title(details.trainingSkill,details.simulation)}:details;
  return {extraction:['mining-laser','vulture-drone'].includes(access.definition.utility)?require('./ship-extraction').inspect(room,access.ship,sicId):null,fabrication:access.definition.utility==='science-lab'?require('./ship-fabrication').inspect(room,access.ship,sicId):null,changed,shipId:access.ship.id,sicId,type:access.definition.utility,name:access.definition.name,details:presentation,impaired:impairment(access.item),hibernationUnavailable:access.definition.utility==='hibernation-chamber'?hibernationUnavailable(room,access.ship,unit.location?.square):'',shipMinerals:{...access.ship.ship.minerals},gm,outsideCombat:Boolean(room.outsideCombat),
    occupants:actors(room,campaign).filter(a=>inside(access.ship,sicId,a)).map(a=>({id:a.id,name:a.name})),
    patients:actors(room,campaign).filter(a=>inside(access.ship,sicId,a)&&!a.mechanical).map(a=>({id:a.id,name:a.name,hp:a.hp,maximum:a.maximum,downSeconds:state(access.ship).down?.[a.id]||0,busy:inTreatment(room,a.id)})),
    attributes:[...skillCatalog.groups,...(Object.keys(record?.character.skills||{}).some(name=>!skillCatalog.names.includes(name))?[{key:'other',label:'Other skills'}]:[])],
    skills:record?vrSimulations.skills(record.character).filter(s=>s.value*10<VR_MAX_TENTHS).map(s=>({...s,trainingGain:s.value*10>VR_D4_LIMIT_TENTHS?1:null})):[],
    trained:record?.character.vrTrainingDay===Math.floor(Number(campaign?.elapsedMinutes||0)/1440),umbrexium:Number(access.ship.ship.minerals?.Umbrexium||0),aiAlert:state(access.ship).aiAlert||null};
}
module.exports={TREATMENT_SECONDS,RECOVERY_SECONDS,state,roomData,jobs,pending,inTreatment,hibernating,actors,command,advance,nextEvent,reconcile,resolve,rolls,announce,inspect,libraryTargets,deliverLibrary};
