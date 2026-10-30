(function(root){
 'use strict';
 // Run before the mixer in this standalone page and its stage. Never read or
 // write the player's storage; tier changes share only this viewer's memory.
 if(root?.document.currentScript?.hasAttribute('data-viewer-audio-bootstrap')){
  const values=new Map([['sa-atb-alerts','off'],['sa-atb-gm-muted','on']]);
  root.SABrowserStorage=root.parent!==root?root.parent.SABrowserStorage:{local:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))}};
  root.SAAudioMixOptions={clipTransport:'media'};
  return;
 }
 const maps=typeof module==='object'?require('./ship-map-core'):root.SAShipMap;
 function route(d){return d.hacking?'hacking':d.utility?'utility':d.lockOn?'lock':d.weapon?'weapon':d.sensor?'sensor':d.shield?'shield':d.shipControl?'pilot':null;}
 function subroute(d){if(route(d)!=='utility')return route(d);return d.illusion||d.securityDroid?'illusion-droid':d.transporter?'transporter':d.cloaking||d.gravityField?'cloak-field':d.blackHoleGun?'black-hole':d.planetaryCleanser?'cleanser':d.surveillance?'surveillance':d.probeLauncher?'probe':d.remoteController||d.remoteReceiver?'remote':d.lockSharing?'lock-sharing':d.relayTriangulator?'relay':d.breachDrone?'breach-drone':d.repairDrone?'repair-drone':d.fieldUtility?'field-utility':d.crewRoom?'crew-room':['warp','self-destruct'].includes(d.utility)?'transit':d.utility;}
 const catalog=Object.entries(maps.catalog).filter(([,d])=>route(d)).map(([id,d])=>({id,name:d.name,route:route(d),subroute:subroute(d)}));
 function visualFixture(type){
  const entry=catalog.find(e=>e.id===type);if(!entry)throw Error('Unknown Console: '+type);
  const s=fixture(1,'lock'),ship=s.starships[0],u=s.units[0],d=maps.definition(type);s.debugFamily='visual';s.debugType=type;s.primaryId='preview';s.visualOnly=true;
  ship.title='SIMULATED / '+d.name;ship.ship={gridCells:Array.from({length:400},(_,i)=>i),sicInventory:[{id:'preview',type},{id:'engine',type:'en-au-engine-6'},{id:'cockpit',type:'bridge-1'},{id:'sensor',type:'sensors-1'}],placements:[{sicId:'preview',cell:42},{sicId:'engine',cell:300},{sicId:'cockpit',cell:0},{sicId:'sensor',cell:320}],minerals:{Iron:100,Phazon:100},doorStates:{},missileAmmo:{preview:{'missile-1':3}},missileStorage:{'missile-1':10},groupCredits:10000};
  if(d.addon)ship.ship.sicInventory[0].attachTo='cockpit';
  const layout=maps.buildLayout(ship.ship),cell=[...layout.footprint.entries()].find(([,c])=>c.sicId==='preview'&&c.stations.some(p=>p.x===c.column&&p.y===c.row));
  if(cell){const p=cell[1].stations.find(p=>p.x===cell[1].column&&p.y===cell[1].row);u.location={starshipId:ship.id,sicId:'preview',square:cell[0],mesh:p.mesh,stationed:true};}
  else if(d.roomStation){u.location={starshipId:ship.id,sicId:'preview',square:42,mesh:4,stationed:true};}
  else u.location={starshipId:ship.id,sicId:'cockpit',square:0,mesh:0,stationed:true};
  ship.auState={current:100,available:100,maximum:100};u.weaponSystemsSkill=5;u.hackingSkill=5;u.navigationSkill=5;u.delayFactors={};
  return s;
 }
 function fixture(tier,family='sensors',scenario='ready'){
  if(family==='lock'){
   if(!Number.isInteger(tier)||tier<1||tier>10)throw Error('Lock On tier must be 1-10');
   const state=fixture(1),ship=state.starships[0],unit=state.units[0];state.debugFamily='lock';state.debugScenario=scenario;
   ship.title='Simulated Lock Laboratory';ship.auState={current:26,available:26,maximum:26};
   ship.ship.sicInventory.push({id:'cockpit',type:'cockpit-1'},{id:'lock',type:`lock-on-${tier}`},{id:'veil',type:'darkveil-5'});
   ship.ship.placements.push({sicId:'cockpit',cell:0},{sicId:'lock',cell:46},{sicId:'veil',cell:100});
   unit.location={starshipId:ship.id,square:0,mesh:0,stationed:true,sicId:'cockpit'};
   ship.lockState={targets:[],failures:{},reports:[{text:'SIMULATED: completed Analysis, lowered shields and incoming lock. Results are illustrative, not combat rolls.'}]};
   for(const [i,id]of ['dummy','dummy-2'].entries()){
    const target={id,title:`Simulated hostile ${i+1}`,team:'npc',analyzedContact:true,defenseScore:8+i,currentHullHp:100,maximumHullHp:100,currentShieldHp:scenario==='insufficient'?10:0,ship:{gridCells:[0,1,2,3],sicInventory:[{id:'target-engine',type:'en-au-engine-1'},{id:'target-sensor',type:'sensors-1'}],placements:[{sicId:'target-engine',cell:0},{sicId:'target-sensor',cell:1}]}};
    state.starships[i+1]=target;state.shipPositions[i+1]={id,q:i?3:5,r:i?1:0};
    ship.sensorState.contacts[id]={id,title:target.title,level:scenario==='unknown'?'unknown':'detected',nature:'Starship',q:state.shipPositions[i+1].q,r:state.shipPositions[i+1].r};
    ship.sensorState.analyses[id]={layout:JSON.parse(JSON.stringify(target.ship)),at:'SIMULATED'};
   }
   ship.incomingLocks=scenario==='unknown'?[]:[{shipId:'dummy',title:'Simulated incoming lock',breakDifficulty:13}];
   if(scenario==='unknown')ship.sensorState.analyses={};
   if(scenario==='insufficient'){ship.auState.current=0;ship.auState.available=0;ship.ship.sicInventory.find(i=>i.id==='veil').disabled=true;}
   return state;
  }
  if(family!=='sensors')throw Error('Unsupported Console family');
  if(!Number.isInteger(tier)||tier<1||tier>9)throw Error('Sensors tier must be 1–9');
  const data={gridCells:Array.from({length:400},(_,i)=>i),sicInventory:[{id:'sensor',type:`sensors-${tier}`},{id:'engine',type:'en-au-engine-6'}],placements:[{sicId:'sensor',cell:42},{sicId:'engine',cell:200}]};
  const ship={id:'viewer-ship',title:'Simulated Sensor Laboratory',ship:data,crewCharacterIds:['viewer'],currentHullHp:400,maximumHullHp:400,defenseScore:12,auState:{current:60,available:60,maximum:60},sensorState:{contacts:{},analyses:{},reports:[]}};
  const layout=maps.buildLayout(data),cell=[...layout.footprint.entries()].find(([,c])=>c.sicId==='sensor'&&c.stations.some(s=>s.x===c.column&&s.y===c.row)),station=cell[1].stations.find(s=>s.x===cell[1].column&&s.y===cell[1].row);
  const unit={id:'viewer',characterId:'viewer',characterName:'Simulated operator',team:'pc',currentHp:30,maximumHp:30,atb:100,sensorSkill:5,queuedEffects:[],location:{starshipId:ship.id,square:cell[0],mesh:station.mesh,stationed:true,sicId:'sensor'}};
  const target={id:'dummy',title:'Dummy contact',contactOnly:true,contactLevel:'detected',currentHullHp:100,maximumHullHp:100,defenseScore:8,ship:{gridCells:[0],sicInventory:[],placements:[]}};
  ship.sensorState.contacts.dummy={id:'dummy',title:target.title,level:'detected',nature:'Starship',size:100,faction:'Simulated',q:5,r:0};
  return {roomCode:'SIMULATED-VIEWER',debugConsole:true,running:true,activeId:unit.id,units:[unit],starships:[ship,target],shipPositions:[{id:ship.id,q:0,r:0},{id:'dummy',q:5,r:0}],spaceObjects:[],log:[],threshold:100};
 }
 function power(state,on){const item=state.starships[0].ship.sicInventory.find(i=>i.id===(state.primaryId||(state.debugFamily==='lock'?'lock':'sensor')));item.disabled=!on;item.status=on?'online':'powered-down';state.units[0].delayedAction=null;state.units[0].consoleHold=false;}
 if(typeof module==='object'){module.exports={fixture,power,catalog,visualFixture};return;}
 const params=new URLSearchParams(location.search),stage=params.has('stage');
 if(!stage){
  root.addEventListener('pagehide',()=>root.SAAudioMix.stopButtonSound(),{once:true});
  const frame=document.getElementById('stage'),select=document.getElementById('tier'),family=document.getElementById('family'),scenario=document.getElementById('scenario');
  for(const kind of ['pilot','shield','weapon','hacking','utility'])family.add(new Option(({pilot:'Bridge / Cockpit',shield:'Shields',weapon:'Weapons',hacking:'Hacking',utility:'Utilities / Rooms'})[kind],kind));
  const open=()=>{const visual=!['sensors','lock'].includes(family.value);document.querySelector('#viewer-tools strong').textContent=visual?'VISUAL ONLY / Simulated':'SIMULATED / Console viewer';frame.src=`console-viewer.html?stage=1&family=${family.value}&tier=${select.value}&scenario=${scenario.value}${visual?'&type='+encodeURIComponent(select.value):''}`;};
  const choose=()=>{select.replaceChildren();if(['sensors','lock'].includes(family.value)){for(let n=1;n<=(family.value==='lock'?10:9);n++)select.add(new Option(`${family.value==='lock'?'Lock On':'Sensors'} ${n}`,String(n)));}else for(const e of catalog.filter(e=>e.route===family.value))select.add(new Option(e.name,e.id));document.getElementById('scenario-label').hidden=family.value!=='lock';scenario.value='ready';open();};
  document.getElementById('exit').onclick=()=>frame.contentWindow.postMessage({type:'viewer-close'},location.origin);family.onchange=choose;scenario.onchange=open;select.onchange=open;document.getElementById('reopen').onclick=open;document.getElementById('restore').onclick=()=>frame.contentWindow.postMessage({type:'viewer-restore'},location.origin);choose();return;
 }
 document.body.classList.add('stage');document.getElementById('stage').remove();
 const family=params.get('family')||'sensors',visual=params.has('type'),state=visual?visualFixture(params.get('type')):fixture(Number(params.get('tier')||1),family,params.get('scenario')||'ready'),unit=state.units[0],ship=state.starships[0],primaryId=state.primaryId||(family==='lock'?'lock':'sensor'),primary=ship.ship.sicInventory.find(i=>i.id===primaryId),outerSelector=visual?'dialog[data-operator-id][open]':'.sensor-console[open],.lock-console[open]';let tick=0;
 // Keep real access calculation, but offer only this supported fixture station.
 // The dummy Cockpit supplies remote access; it is not a second viewer family.
 if(family==='lock'||visual){
  const consoles=root.SAStationAccess.consoles;
  root.SAStationAccess={...root.SAStationAccess,consoles:(s,u)=>consoles(s,u).filter(a=>a.item.id===primaryId)};
 }
 const typingVisual=root.SAConsoleTypingVisual.create(document);
 const scanFeedback=root.SAConsoleScanFeedback.create(document,root.SAAudioMix,()=>typingVisual.update(null,false,false));
 const audioNodes=new Set(),mix=root.SAAudioMix;
 const stopAudio=()=>{mix.stopButtonSound();for(const node of audioNodes){try{node.gain.gain.cancelScheduledValues(0);node.gain.gain.value=0;node.osc.stop();}catch{}}audioNodes.clear();};
 const consoleTick=()=>{
  if(mix.isMuted()||document.hidden||primary.disabled||!document.querySelector(outerSelector))return;
  try{mix.consoleTick(mix.context(),audioNodes);}catch{} // Audio must never block the viewer.
 };
 root.addEventListener('sa-audio-change',()=>{if(mix.isMuted())stopAudio();});
 document.addEventListener('close',e=>{if(e.target.matches('.sensor-console,.lock-console'))stopAudio();},true);
 const timelineCrew={id:'simulated-timeline',characterName:'Faux Crew',team:'pc',color:'#60c9ef',atb:25,queuedEffects:[]};
 const rings=()=>{
  const c={escapeHtml:v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),state,mode:'player',myUnitId:unit.id,ringDrag:null,ringMovedId:null,readyCount:{textContent:'SIMULATED'},activeUnit:()=>unit,hexToRgb:()=>({r:57,g:229,b:143}),pct:u=>u.atb,hasAnyDelay:u=>!!u.delayedAction,myIconForUnit:()=>'',delayedActionFor:u=>u.delayedAction,delayTimerFor:()=>null,delayPercent:d=>d.remaining,commandFor:()=>state.command,commandPercent:c=>100*c.remaining/c.total,queuedEffectsFor:u=>u.queuedEffects||[],queuedEffectPercent:e=>e.progress,ringActionButtons:()=>'',isReady:u=>u.atb>=100&&!u.delayedAction};
  c.coreLabel=state.running&&!state.hardPaused?"ATB":"HOLD";Object.assign(c,root.SATacticalRingRenderer.overlays(c));
  return root.SATacticalRingRenderer.render(c,[unit,timelineCrew],ship.id,'Simulated Timeline',true);
 };
 const close=()=>{typingVisual.update(null,false,false);scanFeedback.clear();stopAudio();document.querySelectorAll('dialog[open]').forEach(d=>d.close());};
 // Every simulated Console close is an explicit return to the viewer, including
 // Leave and Escape. Record it before production cleanup removes the dialog so
 // shared remembered-view restoration cannot reopen it. Explicit open clears it.
 document.addEventListener('close',e=>{if(e.target.matches('.sensor-console,.lock-console'))root.SAShipNavigationUI.remember(unit);},true);
 function refreshScanFeedback(){
  const view=document.querySelector(outerSelector),offline=primary.disabled;
  const running=Boolean(view&&!offline&&state.running&&!state.hardPaused&&!state.holdPaused&&!state.rollPaused&&!state.pausedForTurn&&!document.hidden);
  typingVisual.update(view,Boolean(view&&!offline&&view.dataset.selectHex!=='true'&&unit.delayedAction?.sensorOrder&&!unit.delayedAction.awaitingRoll),running);
  scanFeedback.update(view,unit,state,{offline,soundEnabled:!mix.isMuted()});
 }
 const action=async body=>{
  if(visual)throw Error('Visual preview only; gameplay actions are unavailable.');
  if(body.action==='shipMaintenance'){power(state,body.kind!=='off');refreshScanFeedback();if(body.kind==='off')stopAudio();return {ok:true};}
  if(body.action==='playerCombatAction'){unit.consoleHold=body.kind==='holdConsole';return {ok:true};}
  if(body.action==='lockCommand'){
   if(family!=='lock'||primary.disabled)throw Error('Simulated Lock On is offline; use Restore Power.');
   if(unit.delayedAction)throw Error('Finish the simulated action first.');
   const target=state.starships.find(s=>s.id===body.targetId),lock=ship.lockState.targets.find(l=>l.targetId===body.targetId);
   if(body.kind==='release'){ship.lockState.targets=ship.lockState.targets.filter(l=>l.targetId!==body.targetId);return {ok:true};}
   if(!target||ship.sensorState.contacts[target.id]?.level!=='detected')throw Error('Choose a detected simulated target.');
   if(body.kind==='lock'&&ship.lockState.targets.length&&ship.auState.current< maps.definition(primary.type).extraTargetAu)throw Error('Simulated AU insufficient for an additional target.');
   if(body.kind==='sic'&&(!lock||!ship.sensorState.analyses[target.id]||target.currentShieldHp>0))throw Error('Simulated component prerequisites unavailable.');
   unit.delayedAction={lockOrder:{kind:body.kind,targetId:body.targetId,targetSicId:body.targetSicId},remaining:100,rate:25,label:'SIMULATED acquisition'};return {ok:true};
  }
  if(body.action==='sensorCommand'){
   if(primary.disabled)throw Error('Simulated sensors are off; use Restore Power.');
   unit.delayedAction={sensorOrder:{kind:body.kind,hex:body.hex},label:'Simulated scan',remaining:100,rate:25};refreshScanFeedback();return {ok:true};
  }
  return {ok:false,error:'This simulation does not implement that operation.'};
 };
 root.SACombatBridge={state:()=>state,mode:()=> 'player',myUnitId:()=>unit.id,soundEnabled:()=>!mix.isMuted(),soundIcon:()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.8 8.5H3.5v7h3.3L11 19V5Z"></path><path class="sound-wave" d="M15 8.2a5.2 5.2 0 0 1 0 7.6M18 5.4a9.2 9.2 0 0 1 0 13.2"></path><path class="mute-slash" d="m4 4 16 16"></path></svg>',toggleSound(){mix.setMuted(!mix.isMuted());mix.unlock();},resumeAudio:()=>mix.unlock(),consoleTick,requestRender(){},pilotRings:rings,delayIcon:()=> '',confirmGmPlayerAction:()=>true,action};
 if(visual){
  const unavailable=async()=>{throw Error('Visual preview only; gameplay actions are unavailable.');};
  const info={details:{notes:[],prisoners:[],enabled:false,jobs:[]},skills:[],attributes:[],patients:[],shipMinerals:ship.ship.minerals,fabricators:[],targets:[],passengers:[],capacity:{ships:[],used:0,maximum:162},cargo:[],report:'SIMULATED / Visual preview',gm:false,rooms:[],crew:[],reports:[],title:ship.title,columns:20};
  const inspect=async body=>{if(body.kind&&body.kind!=='inspect')return unavailable();return {result:structuredClone(info)};};
  Object.assign(root.SACombatBridge,{utilityAction:unavailable,transitAction:unavailable,crewRoomRequest:inspect,fieldUtilityRequest:inspect,surveillanceRequest:inspect,crewLogRequest:async()=>({logs:[],entries:[]}),canLeaveAtmosphere:()=>false,leaveAtmosphere:unavailable,setShipColor:unavailable,alertSound:consoleTick});
 }
 root.SAMaintenanceUI={open:(_u,_id,kind)=>{power(state,kind!=='off');refreshScanFeedback();if(kind==='off')stopAudio();}};
 root.SACombatMap={openMove:close,isInlineMoveSelecting:()=>false};
 root.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='viewer-close')close();if(e.data?.type==='viewer-restore'){power(state,true);refreshScanFeedback();}});
 // method=dialog submissions are blocked by the sandbox, including the Cancel
 // click delegated by dialog chrome's X. Complete only that local dialog action;
 // keep actual forms/navigation blocked and preserve the native close event.
 document.addEventListener('click',e=>{
  const button=e.target.closest('button'),form=button?.form;
  // Navigation belongs to the simulated viewer, including when electronic
  // controls are blocked. Handle all outer exit controls before that guard;
  // nested prompt dismissal still follows its own existing dialog semantics.
  const owner=button?.closest('dialog');
  const outer=document.querySelector(outerSelector);
  if(family==='lock'&&button?.matches('.console-swipe')){e.preventDefault();e.stopImmediatePropagation();return;}
  if(family==='lock'&&!outer&&button?.matches('[data-console-view]')){
   e.preventDefault();e.stopImmediatePropagation();root.SALockConsoleUI.open(unit,primaryId);return;
  }
  if(outer&&button?.matches('[data-console-view],[data-close],[data-leave],.dialog-circle-close')&&(!owner||owner===outer)){
   e.preventDefault();e.stopImmediatePropagation();close();return;
  }
  if(button?.type!=='submit'||form?.getAttribute('method')?.toLowerCase()!=='dialog')return;
  const dialog=form.closest('dialog');if(!dialog?.open)return;
  e.preventDefault();dialog.close(button.value);
 },true);
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const dialogs=[...document.querySelectorAll('dialog[open]')];if(dialogs.at(-1)?.matches('.sensor-console,.lock-console'))typingVisual.update(null,false,false);dialogs.at(-1)?.close();}},true);
 async function openConsole(){
  if(!visual){if(family==='lock')root.SALockConsoleUI.open(unit,primaryId);else root.SASensorConsoleUI.open(unit,primaryId);return;}
  try{const kind=route(maps.definition(primary.type));const api={weapon:'SAWeaponConsoleUI',shield:'SAShieldConsoleUI',hacking:'SAHackingConsoleUI',utility:'SAUtilityConsoleUI'}[kind];if(kind==='pilot')await root.SAShipNavigationUI.open(unit,{sicId:primaryId});else await root[api].open(unit,primaryId);document.body.dataset.previewReady=primary.type;}
  catch(error){document.body.dataset.previewError=error.message;document.getElementById('closed').textContent='Preview unavailable: '+error.message;console.error(error);}
 }
 void openConsole();
 document.addEventListener('close',e=>{if(e.target.matches('.sensor-console,.lock-console'))typingVisual.update(null,false,false);},true);
 const timer=setInterval(()=>{
  // The shared bottom toggle moves between the dialog and page. Keep it an
  // explicit action in this viewer so dialog chrome cannot strand it hidden.
  const toggle=document.querySelector('[data-console-view]');
  if(toggle){toggle.setAttribute('data-dialog-keep','');if(toggle.classList.contains('dialog-original-dismiss')){toggle.classList.remove('dialog-original-dismiss');toggle.removeAttribute('aria-hidden');toggle.removeAttribute('tabindex');}}
  // One timer belongs to this iframe, not to any particular Console dialog.
  const view=document.querySelector(outerSelector),offline=primary.disabled;
  const running=Boolean(view&&!offline&&state.running&&!state.hardPaused&&!state.holdPaused&&!state.rollPaused&&!state.pausedForTurn&&!document.hidden);
  refreshScanFeedback();
  if(!running)return;
  tick++;
  timelineCrew.atb=(tick*3)%100;timelineCrew.queuedEffects=[{progress:(tick*2)%100}];
  state.command={unitId:unit.id,total:100,remaining:100-(tick%100)};
  state.shipPositions[1].r=Math.sin(tick/10)*.6;
    if(unit.delayedAction){unit.delayedAction.remaining-=5;if(unit.delayedAction.remaining<=0){
   const order=unit.delayedAction.lockOrder;
   if(order){
    if(order.kind==='lock'&&!ship.lockState.targets.some(l=>l.targetId===order.targetId))ship.lockState.targets.push({targetId:order.targetId,systemId:primaryId,remaining:12,sicIds:[]});
    if(order.kind==='sic'){const lock=ship.lockState.targets.find(l=>l.targetId===order.targetId);if(lock&&!lock.sicIds.includes(order.targetSicId))lock.sicIds.push(order.targetSicId);}
    if(order.kind==='break')ship.incomingLocks=ship.incomingLocks.filter(l=>l.shipId!==order.targetId);
    ship.lockState.reports.unshift({text:`SIMULATED ${order.kind} success — illustrative result; no combat roll.`,success:true});
   }else ship.sensorState.reports.unshift({at:new Date().toISOString(),text:'SIMULATED scan complete: dummy contact detected.',detected:true,targetId:'dummy'});
   unit.delayedAction=null;refreshScanFeedback();
  }}
 },200);
 root.addEventListener('pagehide',()=>{clearInterval(timer);typingVisual.destroy();scanFeedback.destroy();stopAudio();}, {once:true});
 // Visual-only routes deliberately do not simulate gameplay outcomes.
})(typeof window==='undefined'?null:window);
