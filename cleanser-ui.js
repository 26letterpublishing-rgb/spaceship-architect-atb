(function(){
 let consoleView=null,opening=false,cinema=null,eventId='',music=null,impact=null,hum=null,frame=null,diceStarted=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const host=()=>{let d=document;try{while(d.defaultView.frameElement)d=d.defaultView.parent.document;}catch{}return d;};
 function style(doc){if(doc.querySelector('[data-cleanser-style]'))return;const l=doc.createElement('link');l.rel='stylesheet';l.href=new URL('cleanser.css',location.href).href;l.dataset.cleanserStyle='';doc.head.append(l);}
 async function open(unit,sicId){
  if(consoleView||opening)return;opening=true;
  const b=window.SACombatBridge,doc=host(),access=window.SAStationAccess.access(b.state(),unit,sicId);if(!access?.definition.planetaryCleanser){opening=false;return;}
  style(doc);const v=consoleView=doc.createElement('dialog');v.className='cleanser-console';v.dataset.operatorId=unit.id;v.dataset.standaloneConsole='true';v.setAttribute('aria-label','Planetary Cleanser console');
  v.innerHTML=`<header><div><small>DEVASTATION SYSTEM / ${esc(unit.characterName)}</small><h2>PLANETARY CLEANSER</h2></div><div data-selector></div><button data-mute type="button">Sound</button><button data-close type="button">Combat View</button></header><div class="cleanser-console-body"><section class="cleanser-hardware"><img src="${new URL('sic-art-planetary-cleanser.webp',location.href).href}" alt="Planetary Cleanser"><div class="cleanser-core"></div></section><section class="cleanser-operations"><small>PLANETARY TARGET SOLUTION</small><label>Target planet<select data-target></select></label><h3 data-phase>STANDBY</h3><progress data-progress max="120" value="0"></progress><strong data-countdown></strong><p data-resources></p><p>Charging diverts all AU and sets Masking to 0. The planet is destroyed after the shared firing sequence; passing ships are unaffected.</p><button type="button" data-charge>Begin 120-second Charge</button><button type="button" data-abort hidden>Abort Charge</button><p data-reason></p><output data-error role="alert"></output><button type="button" data-retry hidden>Retry Command</button><p data-report></p></section></div><footer><button data-hold type="button">Hold</button><button data-leave type="button">Leave Console</button></footer>`;
  doc.body.append(v);v.showModal();let busy=false,pending=null,targetKey='';const get=s=>v.querySelector(s);
  function draw(){
   const room=b.state(),person=room.units.find(u=>u.id===unit.id),live=window.SAStationAccess.access(room,person,sicId);
   if(!live){v.close();return;}const ship=live.ship,s=ship.ship.cleanserState||{},charging=s.phase==='charging',targets=(room.spaceObjects||[]).filter(o=>o.kind==='planet'&&!o.destroyedAt&&!o.collectedBy);
   const key=JSON.stringify(targets.map(t=>[t.id,t.name]));if(key!==targetKey){const old=get('[data-target]').value;get('[data-target]').innerHTML=targets.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');if(targets.some(t=>t.id===old))get('[data-target]').value=old;targetKey=key;}
   const mineral=['Dark Phazon','Dark Phaeon'].reduce((n,k)=>n+(ship.ship.minerals?.[k]||0),0),ready=room.activeId===unit.id&&!room.rollPaused&&!person.delayedAction&&!person.timedAction&&!person.consoleHold;
   const reason=room.practice?'Deploy this ship and a planet in an encounter.':live.blocked?'Console is unavailable.':s.cooldown>0?'Weapon cooling down.':!ready?'Waiting for your turn.':!targets.length?'The GM must place an intact planet.':mineral<1?'Requires 1 Dark Phazon.':live.item.impaired||live.item.impairmentPoints?'Repair the weapon first.':ship.auState?.maximum<1?'Requires a working AU supply.':'';
   get('[data-phase]').textContent=charging?'CHARGING / MASKING 0':s.cooldown>0?'COOLING DOWN':'STANDBY';get('[data-progress]').value=charging?120-s.remaining:0;
   get('[data-countdown]').textContent=charging?Math.ceil(s.remaining)+' active seconds until cleansing':s.cooldown>0?Math.ceil(s.cooldown/60)+' minutes of cooldown remaining':'';
   get('[data-resources]').textContent= 'Dark Phazon: '+mineral+' / '+(charging?'ALL AU DIVERTED':(ship.auState?.available||0)+' AU available');
   get('[data-charge]').hidden=charging;get('[data-abort]').hidden=!charging;get('[data-charge]').disabled=busy||!!reason;get('[data-abort]').disabled=busy||!ready;get('[data-target]').disabled=charging||busy;
   get('[data-reason]').textContent=charging?'Charge follows active ATB time. Pausing combat pauses charging.':reason;get('[data-report]').textContent=s.lastReport||'';
   get('[data-retry]').hidden=!pending||busy;get('[data-retry]').disabled=busy;get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';
   get('[data-hold]').disabled=busy||room.practice||(!ready&&!person.consoleHold);get('[data-leave]').disabled=busy||!ready||room.practice;get('[data-mute]').textContent=b.soundEnabled()?'Mute sounds':'Enable sounds';
   v.classList.toggle('is-charging',charging);
  }
  async function send(kind){if(busy)return;if(!pending&&!b.confirmGmPlayerAction(unit,kind))return;pending||={id:unit.id,starshipId:access.ship.id,sicId,kind,targetId:get('[data-target]').value,receipt:crypto.randomUUID()};busy=true;draw();try{await b.utilityAction(pending);pending=null;get('[data-error]').textContent='';}catch(e){if(e.status>=400&&e.status<500)pending=null;get('[data-error]').textContent=e.message;}finally{busy=false;draw();}}
  get('[data-retry]').onclick=()=>send(pending?.kind);get('[data-charge]').onclick=()=>send('cleanser-charge');get('[data-abort]').onclick=()=>send('cleanser-abort');get('[data-close]').onclick=()=>{window.SAShipNavigationUI.remember(unit);v.close();};get('[data-mute]').onclick=()=>{b.toggleSound();draw();};
  get('[data-hold]').onclick=()=>window.SAShipNavigationUI.toggleHold(b.state().units.find(u=>u.id===unit.id)).catch(e=>get('[data-error]').textContent=e.message);get('[data-leave]').onclick=()=>{v.close();window.SACombatMap.openMove(b.state().units.find(u=>u.id===unit.id));};
  window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>v.close());const timer=setInterval(draw,150);draw();v.addEventListener('close',()=>{clearInterval(timer);v.remove();consoleView=null;},{once:true});opening=false;
 }
 function closeCinema(){music?.pause();music=null;impact?.pause();impact=null;frame=null;diceStarted=false;cinema?.remove();cinema=null;}
 let rollView=null,rollFrame=null,rollKey='',rollReady=false,rollSignature='',rollError=null,rollTakeover=null,rollReload=null,loadDeadline=0,rollBusy=false;
 function closeRoll(){rollView?.remove();rollView=rollFrame=null;rollReady=false;rollSignature='';rollBusy=false;}
 const canResolve=(b,e)=>b.mode()==='gm'?e.rollController==='gm'||!b.state().units.some(u=>u.id===e.operatorId&&u.team==='pc'):e.rollController!=='gm'&&b.myUnitId()===e.operatorId;
 function rollPayload(b,e){return {type:'sa-shared-damage-state',sharedDamage:true,rollId:e.id,name:'Planetary Cleanser',title:'Planetary Cleanser damage: 20,000D12',phase:e.phase,canResolve:canResolve(b,e),sides:Array(192).fill(12),values:Array.from({length:192},(_,i)=>1+((e.dice?.[i%3]||1)-1+Math.floor(i/3))%12),score:e.damage,damage:true,immediateResult:true,exertionAvailable:0};}
 async function sendDamage(kind){
  if(rollBusy)return;const b=window.SACombatBridge,e=b.state().planetaryEvent;if(!e)return;rollBusy=true;
  try{await b.action({action:'cleanserDamage',id:e.operatorId,eventId:e.id,kind},'resolve',{throwOnError:true});if(rollError)rollError.replaceChildren();rollSignature='';}
  catch(error){if(rollError){rollError.textContent=error.message+' ';const retry=rollError.ownerDocument.createElement('button');retry.textContent='Retry';retry.onclick=()=>sendDamage(kind);rollError.append(retry);}}
  finally{rollBusy=false;}
 }
 function damagePrompt(b,e,doc){
  if(!['awaitingRoll','rolling','result'].includes(e?.phase)){closeRoll();return;}
  if(!rollView||rollKey!==e.id){
   closeRoll();rollKey=e.id;rollView=doc.createElement('dialog');rollView.setAttribute('aria-label','Planetary Cleanser damage roll');
   rollView.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent';
   rollFrame=doc.createElement('iframe');rollFrame.title='Planetary Cleanser damage';rollFrame.style.cssText='width:100%;height:100%;border:0;background:transparent';
   rollError=doc.createElement('div');rollError.setAttribute('role','alert');rollError.style.cssText='position:absolute;bottom:12px;left:20%;color:#fff;background:#142a36';
   const controls=doc.createElement('div');controls.style.cssText='position:absolute;top:8px;right:12px;display:flex;gap:6px';
   rollTakeover=doc.createElement('button');rollTakeover.textContent='GM: Resolve this roll';rollTakeover.onclick=()=>sendDamage('takeover');
   rollReload=doc.createElement('button');rollReload.textContent='Retry Loading Dice';
   const reload=()=>{rollReady=false;rollSignature='';loadDeadline=Date.now()+5000;rollFrame.src=new URL('character.html?shipRoll=1',location.href);};
   rollReload.onclick=reload;controls.append(rollTakeover,rollReload);rollView.append(rollFrame,controls,rollError);rollView.addEventListener('cancel',event=>event.preventDefault());doc.body.append(rollView);rollView.showModal();reload();
  }
  rollTakeover.hidden=b.mode()!=='gm'||canResolve(b,e);rollReload.hidden=rollReady||Date.now()<loadDeadline;
  const signature=JSON.stringify([e.phase,e.rollController,e.damage,canResolve(b,e)]);
  if(rollReady&&signature!==rollSignature){rollSignature=signature;rollFrame.contentWindow.postMessage(rollPayload(b,e),location.origin);}
 }
 function tick(){
  const b=window.SACombatBridge,s=b?.state();if(!s)return;const doc=host(),event=s.planetaryEvent,timeline=window.SACleanserTimeline.forEvent(event);
  const charging=s.starships?.some(ship=>ship.ship?.cleanserState?.phase==='charging');
  if(charging&&!hum){hum=new Audio(new URL('cleanser-charge.wav',location.href));hum.loop=true;hum.volume=.25;}
  if(hum){if(!charging){hum.pause();hum=null;}else if(b.soundEnabled()&&!doc.hidden){if(hum.paused)hum.play().catch(()=>{});}else hum.pause();}
  damagePrompt(b,event,doc);
  if(event?.phase!=='firing'){closeCinema();return;}
  if(!cinema||eventId!==event.id){
   closeCinema();eventId=event.id;style(doc);cinema=doc.createElement('dialog');cinema.className='cleanser-cinema';cinema.setAttribute('aria-label','Planetary Cleanser firing cinematic');
   const variant=['ocean','desert','ice','volcanic'].includes(event.variant)?event.variant:'ocean';
   cinema.innerHTML=`<div class="cleanser-stars"></div><div class="cleanser-vignette"></div><header><small>${esc(event.shipName)} / PLANETARY CLEANSER</small><h1>${esc(event.targetName)}</h1><p data-stage>FINAL CONTAINMENT RELEASE</p></header><div class="cleanser-stage"><div class="cleanser-muzzle"></div><div class="cleanser-beam"></div><div class="cleanser-impact"><img class="cleanser-world" src="${new URL('planet-'+variant+'.webp',location.href)}" alt="${esc(event.targetName)}"><div class="cleanser-fracture"></div><svg class="cleanser-wave" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="48" vector-effect="non-scaling-stroke"/></svg><svg class="cleanser-wave cleanser-wave-delayed" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="48" vector-effect="non-scaling-stroke"/></svg><img class="cleanser-remains" src="${new URL('planet-debris.webp',location.href)}" alt="Shattered planetary debris">${Array.from({length:36},(_,i)=>`<i class="cleanser-fragment" style="--angle:${i*137.5}deg;--travel:${120+i%9*27}px;--fragment:${5+i%7*3}px;--spin:${i*47}deg"></i>`).join('')}</div></div><div class="cleanser-flash"></div><div class="cleanser-damage"><small>SIMULATED DAMAGE / 20,000D12</small><strong>${Number(event.damage).toLocaleString()}</strong><span>PLANET DESTROYED</span></div><footer><span>Shared firing sequence · Combat paused</span><button type="button" data-mute>Mute sounds</button><span data-seconds></span></footer>`;
   cinema.addEventListener('cancel',e=>e.preventDefault());doc.body.append(cinema);cinema.showModal();cinema.querySelector('[data-mute]').onclick=()=>b.toggleSound();
   music=new Audio(new URL(timeline.audio,location.href));music.volume=.65;music.preload='auto';music.hidden=true;music.dataset.cleanserAudio='';cinema.append(music);
   if(timeline.impactAudio){impact=new Audio(new URL(timeline.impactAudio,location.href));impact.volume=.65;impact.preload='auto';impact.hidden=true;impact.dataset.cleanserImpactAudio='';cinema.append(impact);}
  }
  const elapsed=Math.max(0,Math.min(timeline.duration,(Date.now()-event.startedAt)/1000));
  cinema.style.setProperty('--elapsed',elapsed+'s');cinema.dataset.stage=window.SACleanserTimeline.stage(timeline,elapsed);
  cinema.querySelector('[data-stage]').textContent=({buildup:'FINAL CONTAINMENT RELEASE',beam:'FIRING — NO RETURN',rupture:'PLANETARY INTEGRITY: ZERO',aftermath:'SIGNAL LOST',result:'TARGET REMOVED FROM THE UNIVERSE'})[cinema.dataset.stage];
  cinema.querySelector('[data-seconds]').textContent=Math.max(0,Math.ceil((event.endsAt-Date.now())/1000))+'s';cinema.querySelector('[data-mute]').textContent=b.soundEnabled()?'Mute sounds':'Enable sounds';
  window.SACleanserTimeline.syncAudio(music,elapsed,b.soundEnabled()&&!doc.hidden,timeline);
  window.SACleanserTimeline.syncAudio(impact,Math.max(0,elapsed-timeline.explosion)+(timeline.impactOffset||0),b.soundEnabled()&&!doc.hidden&&elapsed>=timeline.explosion,{audioSeconds:20});
  if(elapsed>=timeline.dice&&!diceStarted){diceStarted=true;frame=doc.createElement('iframe');frame.className='cleanser-dice';frame.title='Simulated damage — standard dice animation';frame.src=new URL('character.html?shipRoll=1',location.href);cinema.append(frame);}
 }
 function receive(e){
  if(e.origin!==location.origin)return;
  if(rollFrame&&e.source===rollFrame.contentWindow){
   const b=window.SACombatBridge,event=b.state().planetaryEvent;if(event?.id!==rollKey)return;
   if(e.data?.type==='sa-ship-skill-ready')rollFrame.contentWindow.postMessage({...rollPayload(b,event),type:'sa-ship-skill-open'},location.origin);
   if(e.data?.type==='sa-ship-skill-opened')rollReady=true;
   if(e.data?.rollId===rollKey){
    if(e.data.type==='sa-shared-damage-roll'&&canResolve(b,event))void sendDamage('roll');
    if(e.data.type==='sa-shared-damage-shown'&&canResolve(b,event))void sendDamage('shown');
    if(e.data.type==='sa-ship-skill-result'&&canResolve(b,event))void sendDamage('confirm');
   }
   return;
  }
  if(!frame||e.source!==frame.contentWindow)return;const event=window.SACombatBridge?.state()?.planetaryEvent;if(!event||event.id!==eventId)return;
  if(e.data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:event.id,name:'Planetary Cleanser',title:'SIMULATED 20,000D12 DAMAGE',sides:Array(192).fill(12),values:Array.from({length:192},(_,i)=>1+((event.dice?.[i%3]||1)-1+Math.floor(i/3))%12),diceFlood:true,score:event.damage,displayScore:event.damage,damage:true,immediateResult:true,spectator:true,simulated:true,exertionAvailable:0},location.origin);
  if(e.data?.type==='sa-automatic-dice-shown')setTimeout(()=>{if(frame?.isConnected)frame.remove();},700);
 }
 const doc=host();doc.defaultView.addEventListener('message',receive);const timer=setInterval(tick,100);
 window.addEventListener('pagehide',()=>{clearInterval(timer);doc.defaultView.removeEventListener('message',receive);closeCinema();closeRoll();hum?.pause();consoleView?.close();});
 window.SACleanserConsole={open,isOpen:()=>Boolean(consoleView||opening)};
}());
