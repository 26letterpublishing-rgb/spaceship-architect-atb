(function(root){'use strict';
 function create(state){
  if(!state?.debugConsole||state.roomCode!=='SIMULATED-VIEWER')throw Error('Local Console fixture required.');
  const unit=state.units[0],ship=state.starships[0],data=ship.ship,primary=data.sicInventory.find(i=>i.id==='preview');let serial=0;
  const info={details:{notes:[],prisoners:[],orders:[],enabled:true,safety:true,robotBartender:true,name:'SIMULATED Ship AI',jobs:[]},skills:[{name:'Piloting',attribute:'Physical',trainingGain:1,level:2}],attributes:['Physical','Mental'],patients:[{id:unit.id,name:'Simulated patient',hp:20,maximum:30,downSeconds:0}],shipMinerals:data.minerals,fabricators:[],targets:state.starships.slice(1).map(s=>({id:s.id,title:s.title,name:s.title,eligible:true})),passengers:[{id:unit.id,name:unit.characterName}],occupants:[{id:unit.id,name:unit.characterName}],capacity:{ships:[],used:0,maximum:162},cargo:[],report:'SIMULATED / Local preview only',gm:true,rooms:[],crew:[],reports:[],title:ship.title,columns:20};
  const distances=typeof module==='object'?require('./ship-distances'):root.SAShipDistances;
  function refreshTargetDistances(){
   const positions=distances.positions(state.starships,state.shipPositions),origin=positions.find(p=>p.id===ship.id);
   for(const target of info.targets){const point=positions.find(p=>p.id===target.id);if(point)target.distance=distances.hexDistance(origin,point);}
  }
  refreshTargetDistances();
  const maps=typeof module==='object'?require('./ship-map-core'):root.SAShipMap,arm=primary?.type==='manipulation-arm',tractor=primary?.type==='tractor-beam',rescueReceipts=new Map();
  if(arm||tractor){maps.ensureAirlocks(ship);const position=state.shipPositions.find(p=>p.id===ship.id);state.units.push({id:'simulated-floating-crew',characterName:'Simulated crew member',currentHp:20,location:null,vacuum:{id:'simulated-floating-contact',sourceShipId:ship.id,position:{q:position.q+(tractor?2:0),r:position.r},direction:{q:1,r:0},damageRemaining:2,driftRemaining:12}});}
  if(tractor){const position=state.shipPositions.find(p=>p.id===ship.id);data.fieldState||={};data.fieldState.pods||=[];data.fieldState.pods.push({id:'simulated-rescue-pod',q:position.q+2,r:position.r,passengers:[{id:'simulated-pod-passenger'}]});state.units.push({id:'simulated-pod-passenger',characterName:'Simulated pod passenger',currentHp:15,escapedAt:1,location:{starshipId:ship.id,escapePodId:'simulated-rescue-pod'}});}
  function rescuePodPreview(body){
   if(rescueReceipts.has(body.receipt)){const old=rescueReceipts.get(body.receipt);if(old.targetId!==body.targetId)throw Error('That receipt belongs to another command.');return {result:{text:old.text},duplicate:true};}
   const pod=data.fieldState.pods.find(p=>p.id===body.targetId&&!p.recovered),origin=distances.positions(state.starships,state.shipPositions).find(p=>p.id===ship.id);
   if(!body.receipt||!pod||!maps.operational(primary)||primary.impaired||primary.status==='impaired'||primary.impairmentPoints>0||distances.hexDistance(origin,pod)>2)throw Error('That pod is unavailable for recovery.');
   if(state.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.consoleHold)throw Error('Wait for your turn and finish the current action.');
   const placement=data.placements.find(p=>p.sicId===primary.id),square=maps.placementSquares(data,primary,placement).find(c=>data.gridCells.includes(c));
   for(const [index,passenger] of pod.passengers.entries()){const person=state.units.find(u=>u.id===passenger.id);if(person){person.escapedAt=null;person.location={starshipId:ship.id,square,mesh:[0,4,8][index],stationed:false};ship.crewNpcUnitIds=[...new Set([...(ship.crewNpcUnitIds||[]),person.id])];}}
   pod.recovered=true;info.report='SIMULATED: Escape pod recovered. Passengers are aboard '+ship.title+'.';rescueReceipts.set(body.receipt,{targetId:body.targetId,text:info.report});return {result:{text:info.report}};
  }
  function rescueCandidate(){const person=state.units.find(u=>u.id==='simulated-floating-crew'),position=distances.positions(state.starships,state.shipPositions).find(p=>p.id===ship.id);return (arm||tractor)&&(!tractor||!(primary.impaired||primary.status==='impaired'||primary.impairmentPoints>0))&&maps.operational(primary)&&ship.currentHullHp>0&&data.airlocks?.length&&person?.vacuum&&distances.hexDistance(distances.roundHex(position),person.vacuum.position)<=(tractor?2:0)?person:null;}
  function rescuePreview(body){
   if(rescueReceipts.has(body.receipt)){const old=rescueReceipts.get(body.receipt);if(old.targetId!==body.targetId)throw Error('That receipt belongs to another command.');return {result:{text:old.text},duplicate:true};}
   const person=rescueCandidate();if(!body.receipt||!person||person.vacuum.id!==body.targetId)throw Error('That character is no longer available within this recovery system\'s range.');
   if(state.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.consoleHold)throw Error('Wait for your turn and finish the current action.');
   const a=data.airlocks[0],layout=maps.buildLayout(data),side=layout.sides.find(d=>d.name===a.side),inside=a.square-(side?.offset||0),square=layout.hull.has(inside)&&!layout.footprint.get(inside)?.blocked?inside:a.square;
   person.location={starshipId:ship.id,square,mesh:4,stationed:false};person.vacuum=null;info.report='SIMULATED: Rescued '+person.characterName+' beside the airlock.';rescueReceipts.set(body.receipt,{targetId:body.targetId,text:info.report});return {result:{text:info.report}};
  }
  const vr=primary?.type==='vr-training-room',vrText=typeof module==='object'?require('./vr-simulations'):root.SAVRSimulations,skillCatalog=typeof module==='object'?require('./skill-catalog'):root.SASkillCatalog;
  if(vr){info.attributes=structuredClone(skillCatalog.groups);info.skills=vrText.skills({skills:{Piloting:4.5,'Computer Systems':2}}).map(s=>({...s,trainingGain:s.value>4?1:null}));info.trained=false;}
  if(primary?.type==='medbay'){
   info.patients[0].name=unit.characterName;
   info.details.jobs=[{id:'simulated-treatment',patientId:unit.id,patientName:unit.characterName,phase:'recovering',remaining:3}];
  }
  function vrRequest(body){
   const skill=info.skills.find(s=>s.name===body.skill);if(!skill)throw Error('Choose a simulated character skill.');
   if(primary.disabled)throw Error('The simulated VR room is powered off.');
   const title=vrText.title(skill.name,body.text).slice(0,120);let text;
   if(body.kind==='train'){
    if(info.trained)throw Error('Simulated daily training already used. Restart preview to try again.');
    const gain=skill.trainingGain===1?1:body.score;if(!Number.isInteger(gain)||gain<1||gain>4)throw Error('Enter a D4 result from 1 to 4.');
    const before=skill.value;skill.value=Math.round(before*10+gain)/10;skill.trainingGain=skill.value>4?1:null;info.trained=true;
    text='SIMULATED: '+skill.name+': '+before.toFixed(1)+' to '+skill.value.toFixed(1)+'. Daily training used. No real character changed.';
   }else text='SIMULATED: Simulation loaded: '+title+(body.enabled!==false?' / safety protocols on.':' / safety protocols off. GM adjudicates consequences.');
   Object.assign(info.details,{simulation:title,trainingSkill:skill.name,safety:body.enabled!==false,report:{text:'SIMULATED: '+vrText.narrative(unit.characterName,skill.name,title)+(body.kind==='simulate'?' Practice simulation; no training award.':' No real character changed.')}});
   return {result:{...structuredClone(info),text}};
  }
  const kinds=new Set(['inspect','note','remove','check','refresh','configure','simulate','train','exercise','order','bartender','hibernate','wake','intake','condition','release','load','treat','cancel','deposit','withdraw','tractor','release-tractor','grab','operate','dock','undock','launch-pod','reflector','ionic-force-displacers','transport-scrambler','scan','refresh-cameras']);
  const gym=primary?.type==='gym',gymReports=typeof module==='object'?require('./gym-report'):root.SAGymReport,gymReceipts=new Map();
  function gymRequest(body){
   if(body.id!==unit.id||body.sicId!==primary.id||(body.starshipId||body.shipId||ship.id)!==ship.id)throw Error('Use this Gym station.');
   if(!/^[\w-]{8,100}$/.test(String(body.requestId||'')))throw Error('A room command receipt is required.');
   const fingerprint=JSON.stringify([body.id,body.kind,body.sicId,body.text]),saved=gymReceipts.get(body.requestId);
   if(saved){if(saved.fingerprint!==fingerprint)throw Error('That receipt belongs to another room command.');return {result:{...structuredClone(saved.result),duplicate:true}};}
   const stations=typeof module==='object'?require('./station-access'):root.SAStationAccess,power=typeof module==='object'?require('./ship-power'):root.SAShipPower,access=stations.access(state,unit,primary.id);
   if(!access||access.blocked||access.controlled||access.remote)throw Error('Use an available room station aboard your own ship.');
   if(access.definition.energyCost>0&&power.output(ship,state.units).en<power.demand(ship))throw Error('Restore sufficient ship power before using this room.');
   if(!state.practice)throw Error('This room activity is only available outside combat.');
   if(primary.impaired||primary.status==='impaired'||primary.impairmentPoints>0)throw Error('Repair the Gym before using its equipment.');
   const report=gymReports.report(unit.characterName,body.text,Math.floor(Math.random()*gymReports.GYM_NARRATIONS.length),Date.now());
   info.details.report=report;info.report=report.text;
   const result={spent:false,text:report.text};gymReceipts.set(body.requestId,{fingerprint,result});return {result};
  }
  function request(body){
   if(gym&&body.kind==='exercise')return gymRequest(body);
   if(body.kind==='rescue-pod'&&tractor)return rescuePodPreview(body);
   if(body.kind==='rescue-character'&&(arm||tractor))return rescuePreview(body);
   if(body.kind==='talking-points'&&primary?.type==='meeting-room'){
    if(primary.disabled)throw Error('The simulated Meeting Room is powered off.');
    if(!Array.isArray(body.points)||body.points.length!==5||body.points.some(p=>typeof p!=='string'||p.length>500))throw Error('Enter five talking points, up to 500 characters each.');
    if(body.expectedRevision!==(info.details.talkingPointsRevision||0))throw Error('Talking points changed since you loaded them. Your draft is retained; reload saved points before merging and saving.');
    info.details.talkingPoints=[...body.points];info.details.talkingPointsRevision=(info.details.talkingPointsRevision||0)+1;
    return {result:{text:'SIMULATED: Talking points saved.',talkingPointsRevision:info.details.talkingPointsRevision}};
   }
   if(!kinds.has(body.kind||'inspect'))throw Error('This operation has no simulated result yet; no game request was sent.');if(!body.kind||body.kind==='inspect'){if(primary?.type==='hibernation-chamber')info.hibernationRoster=(typeof module==='object'?require('./hibernation-roster'):root.SAHibernationRoster).preview(state,info.details);refreshTargetDistances();const result=structuredClone(info),person=rescueCandidate();if(person)result.targets.unshift({id:person.vacuum.id,kind:'floating-character',name:person.characterName,distance:distances.hexDistance(distances.roundHex(distances.positions(state.starships,state.shipPositions).find(p=>p.id===ship.id)),person.vacuum.position)});if(tractor){const origin=distances.positions(state.starships,state.shipPositions).find(p=>p.id===ship.id);for(const pod of data.fieldState.pods.filter(p=>!p.recovered))result.targets.push({id:pod.id,kind:'escape-pod',name:'Simulated escape pod',distance:distances.hexDistance(origin,pod)});}return {result};}
   if(vr&&['simulate','train'].includes(body.kind))return vrRequest(body);
   const text='SIMULATED: '+(body.text||body.kind);info.report=text;info.details.report={text};
   if(body.kind==='note')info.details.notes.push({id:'sample-'+(++serial),title:String(body.title||'Sample note'),text:String(body.text||''),author:'Simulated operator',authorId:unit.characterId||unit.id,checked:false});
   if(body.kind==='remove')info.details.notes=info.details.notes.filter(n=>n.id!==body.noteId);
   if(body.kind==='check'){const n=info.details.notes.find(n=>n.id===body.noteId);if(n)n.checked=Boolean(body.checked);}
   if(body.kind==='configure')Object.assign(info.details,{name:String(body.text||info.details.name),enabled:body.enabled!==false,automationMode:body.automationMode||'off'});
   if(body.kind==='simulate')Object.assign(info.details,{simulation:String(body.text||''),safety:body.enabled!==false});
   if(body.kind==='order')info.details.orders.push({text});if(body.kind==='bartender')info.details.robotBartender=Boolean(body.enabled);
   if(body.kind==='hibernate')info.details.hibernation={phase:'sleeping',occupantName:unit.characterName,activeSeconds:0};if(body.kind==='wake')info.details.hibernation=null;
   if(body.kind==='intake')info.details.prisoners.push({id:'sample-'+(++serial),name:String(body.title||'Sample prisoner'),note:String(body.text||'')});
   if(body.kind==='release'){const p=info.details.prisoners.find(p=>p.id===body.noteId);if(p)p.released=true;}
   if(body.kind==='condition')info.details.condition=String(body.text||'');
   if(body.kind==='tractor')info.details.tether={targetId:body.targetId};if(body.kind==='release-tractor')info.details.tether=null;
   if(body.kind==='launch-pod')info.details.launched=true;
   if(['reflector','ionic-force-displacers','transport-scrambler'].includes(body.kind))info.details.enabled=Boolean(body.enabled);
   return {result:{...structuredClone(info),text}};
  }
  function action(body){
   if(body.action==='playerCombatAction'&&['holdConsole','resumeConsole'].includes(body.kind)){unit.consoleHold=body.kind==='holdConsole';return {ok:true};}
   if(body.action==='playerCombatAction'&&body.kind==='moveStarship'){if(!Number.isFinite(body.destination?.q)||!Number.isFinite(body.destination?.r))throw Error('Choose a simulated destination.');const p=state.shipPositions.find(p=>p.id===ship.id);Object.assign(p,body.destination);return {ok:true};}
   if(body.action==='shipMaintenance'){primary.disabled=body.kind==='off';primary.status=primary.disabled?'powered-down':'online';return {ok:true};}
   if(['weaponCommand','shieldCommand','shipCommand','utilityCommand'].includes(body.action)){info.report='SIMULATED command preview: '+body.action;state.log.unshift({text:info.report});return {ok:true,simulated:true};}
   throw Error('This action has no simulated outcome yet; no game request was sent.');
  }
  function utility(body){if(!['gravity','oxygen','cloak','gravity-field','transport','repair-ship','devastation-charge','devastation-discharge'].includes(body.kind))return action({...body,action:'utilityCommand'});
   if(body.kind==='gravity')data.gravityEnabled=Boolean(body.enabled);if(body.kind==='oxygen')data.oxygenEnabled=Boolean(body.enabled);if(body.kind==='cloak')ship.cloaked=Boolean(body.enabled);if(body.kind==='gravity-field')data.gravityFieldEnabled=Boolean(body.enabled);
   info.report='SIMULATED '+body.kind;return {ok:true,result:{text:info.report},simulated:true};
  }
  return {request,action,utility,info};
 }
 const api={create};if(typeof module==='object')module.exports=api;else root.SAConsolePreviewActions=api;
})(typeof window==='object'?window:globalThis);
