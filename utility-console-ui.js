(function(){
  let view=null,opening=false,audio=null;
  const flavors=['Vanilla','Chocolate','Strawberry','Banana','Peach','Pineapple','Mint','Lemon','Blueberry','Cherry','Caramel','Coconut','Coffee','Hazelnut','Apple','Cinnamon','Pumpkin','Maple','Tomato','Cheddar','Mushroom','Chili'];
  const colors=['#eddc91','#7a433c','#ef8298','#e1ce53','#f3a379','#e7dd67','#7ed2a5','#ddd67b','#a7a2dd','#d36285','#cfad7d','#e9e7dc','#946755','#b69377','#a5c766','#ce978b','#e2a56a','#cb985d','#dd766b','#e4bd56','#aaa98a','#ae6657'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function stopSound(){if(audio){audio.close().catch(()=>{});audio=null;}}
  function dispenseSound(){
    stopSound();if(!window.SACombatBridge.soundEnabled())return;
    try{
      const ctx=audio=new AudioContext();ctx.resume();
      for(let n=0;n<8;n++){
        const t=ctx.currentTime+n*.18,osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type=n===7?'triangle':'sine';osc.frequency.setValueAtTime(n===7?660:100+n*25,t);osc.frequency.exponentialRampToValueAtTime(n===7?880:480-n*28,t+.09);
        gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.06,t+.014);gain.gain.exponentialRampToValueAtTime(.0001,t+.16);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+.18);osc.onended=()=>{osc.disconnect();gain.disconnect();};
      }
    }catch{stopSound();}
  }
  async function styles(doc){
    for(const name of ['console-common.css','utility-console.css']){
      const href=new URL(name,location.href).href;
      if([...doc.styleSheets].some(s=>s.href===href))continue;
      await new Promise((resolve,reject)=>{const link=doc.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Console artwork could not load. Try opening the console again.'));};doc.head.append(link);});
    }
  }
  function eatingSound(){
    stopSound();if(!window.SACombatBridge.soundEnabled())return;
    try{
      const ctx=audio=new AudioContext();ctx.resume();
      for(let n=0;n<5;n++){
        const time=ctx.currentTime+n*.19,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.16),ctx.sampleRate),samples=buffer.getChannelData(0);
        for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/samples.length*4);
        const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;
        filter.type='lowpass';filter.frequency.setValueAtTime(1300,time);filter.frequency.exponentialRampToValueAtTime(180,time+.14);filter.Q.value=5;
        gain.gain.setValueAtTime(.13,time);gain.gain.exponentialRampToValueAtTime(.001,time+.15);
        source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(time);
        source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      }
    }catch{stopSound();}
  }
  async function openCloak(unit,sicId){
    if(view||opening)return;opening=true;const b=window.SACombatBridge;
    let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
    try{await styles(doc);}finally{opening=false;}
    const initial=window.SAStationAccess.access(b.state(),unit,sicId);if(!initial)return;
    const dialog=view=doc.createElement('dialog');dialog.className='utility-console lock-console';dialog.dataset.operatorId=unit.id;dialog.dataset.sicId=sicId;
    dialog.innerHTML=`<header><h2>Cloaking Device</h2><div data-selector></div><button data-close>Combat View</button></header><section class="lock-chart utility-scene"><img src="${initial.definition.image}" style="width:100%;height:100%;object-fit:contain" alt="Cloaking generator"></section><section class="lock-controls utility-controls"><h3 data-phase></h3><p>+25 Masking while active. Shields drop; weapon fire and other AU spending are blocked.</p><button data-toggle data-utility-control></button><output data-status role="status"></output></section><div class="utility-seat"><button data-hold>Hold</button><button data-leave>Leave Console</button></div>`;
    doc.body.append(dialog);dialog.showModal();let busy=false,pending=null;
    const get=s=>dialog.querySelector(s),current=()=>b.state().units.find(u=>u.id===unit.id);
    function redraw(){const person=current(),access=window.SAStationAccess.access(b.state(),person,sicId);if(!access){dialog.close();return;}const active=window.SAShipMap.cloaked(access.ship),ready=b.state().practice||b.state().activeId===unit.id&&!person.delayedAction&&!person.timedAction&&!person.consoleHold;
      get('[data-phase]').textContent=active?'CLOAKED':'VISIBLE';get('[data-toggle]').textContent=pending?'Retry Cloaking Command':active?'Deactivate Cloaking':'Activate Cloaking / 12 AU';get('[data-toggle]').disabled=busy||!ready||access.blocked;
      get('[data-hold]').disabled=busy||b.state().practice;get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-leave]').disabled=busy||!ready;}
    get('[data-toggle]').onclick=async()=>{if(busy)return;pending||={id:unit.id,starshipId:initial.ship.id,sicId,kind:'cloak',enabled:!window.SAShipMap.cloaked(window.SAStationAccess.access(b.state(),current(),sicId).ship),receipt:crypto.randomUUID()};busy=true;redraw();try{await b.utilityAction(pending);pending=null;get('[data-status]').textContent='Cloaking setting confirmed.';b.consoleTick();}catch(e){get('[data-status]').textContent=e.message;}finally{busy=false;redraw();}};
    get('[data-close]').onclick=()=>{window.SAShipNavigationUI.remember(current()||unit);dialog.close();};
    get('[data-hold]').onclick=()=>window.SAShipNavigationUI.toggleHold(current()).catch(e=>get('[data-status]').textContent=e.message);
    get('[data-leave]').onclick=()=>{dialog.close();if(!b.state().practice)window.SACombatMap.openMove(current());};
    window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>dialog.close());const timer=setInterval(redraw,250),unload=()=>dialog.close();window.addEventListener('pagehide',unload,{once:true});dialog.onclose=()=>{clearInterval(timer);window.removeEventListener('pagehide',unload);dialog.remove();view=null;b.requestRender();};redraw();
  }
  async function open(unit,sicId){
    const selected=window.SAStationAccess.access(window.SACombatBridge.state(),unit,sicId);
    if(selected?.definition.cloaking)return openCloak(unit,sicId);
    if(selected?.definition.planetaryCleanser)return window.SACleanserConsole.open(unit,sicId);
    if(selected?.definition.surveillance)return window.SASurveillanceConsole.open(unit,sicId);
    if(selected?.definition.probeLauncher)return window.SAProbeConsole.open(unit,sicId);
    if(selected?.definition.repairDrone)return window.SADroneConsole.open(unit,sicId);
    if(selected?.definition.fieldUtility)return window.SAFieldUtilityConsole.open(unit,sicId);
    if(selected?.definition.crewRoom)return window.SACrewRoomConsole.open(unit,sicId);
    if(['warp','self-destruct'].includes(selected?.definition.utility)){return window.SATransitConsoleUI.open(unit,sicId);}
    if(view||opening)return;opening=true;
    const b=window.SACombatBridge;
    const sourceFrame=window.frameElement;
    let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
    try{await styles(doc);}catch(error){opening=false;window.alert(error.message);b.requestRender();return;}
    opening=false;
    if(sourceFrame&&!sourceFrame.isConnected)return;
    const initial=window.SAStationAccess.access(b.state(),b.state().units.find(u=>u.id===unit.id),sicId);
    if(initial?.kind!=='utility')return;
    const life=initial.definition.utility==='life-support';
    const dialog=doc.createElement('dialog');view=dialog;dialog.className='utility-console lock-console';dialog.dataset.operatorId=unit.id;dialog.setAttribute('aria-label',initial.definition.name+' console');
    dialog.innerHTML=`<header><div><small>${esc(unit.characterName)} / ${initial.remote?'REMOTE':'LOCAL'}</small><h2>${esc(initial.definition.name)}</h2></div><div class="utility-header-status" data-turn></div><div data-selector></div><button type="button" data-sound>${b.soundIcon()}</button><button type="button" data-close>Combat View</button></header>
      <section class="lock-chart utility-scene">${life?`<div class="life-machine"><img src="life-support-graphic.png" alt="Life Support machinery"><div class="gravity-chamber" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="utility-readouts"><strong data-gravity-state></strong><span data-movement></span><span data-oxygen-state></span></div>`:`<div class="nut-dispenser" aria-hidden="true"><div class="nut-reservoir"><i></i><span>NUT</span></div><div class="nut-pipe"></div><div class="nut-paste"></div><div class="nut-tray"><i></i></div></div><strong class="nut-caption" data-mixture>Dispenser ready</strong>`}</section>
      <section class="lock-controls utility-controls"><h3>${life?'Environmental Systems':'Flavor Mixer'}</h3>${life?`<label class="utility-switch"><span>Artificial Gravity</span><input data-utility-control data-gravity type="checkbox" role="switch"></label><label class="utility-switch"><span>Oxygen</span><input data-utility-control data-oxygen type="checkbox" role="switch"></label><p data-gravity-note></p>`:`<label>Base<select data-utility-control data-flavor="base">${flavors.map((f,i)=>`<option value="${i}">${f}</option>`).join('')}</select></label><label>Blend<select data-utility-control data-flavor="blend"><option value="">None</option>${flavors.map((f,i)=>`<option value="${i}">${f}</option>`).join('')}</select></label><label>Texture<select data-utility-control data-texture><option>Silky</option><option>Extra thick</option><option>Questionably chunky</option></select></label><button type="button" data-utility-control data-dispense>Dispense Paste</button>`}<output data-status role="status" aria-live="polite"></output><button type="button" data-utility-control data-retry hidden>Retry Command</button></section>
      <section class="lock-reports utility-report"><h3>${life?'Environmental Status':'Meal Ticket'}</h3><p data-report>${life?'Life Support connected.':'No meal dispensed.'}</p></section><div class="utility-seat"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div>`;
    doc.body.append(dialog);dialog.showModal();
    if(!life){
      const dispenser=dialog.querySelector('.nut-dispenser');dispenser.removeAttribute('aria-hidden');
      const blob=doc.createElement('button');blob.type='button';blob.className='nut-blob';blob.dataset.utilityControl='';blob.hidden=true;blob.setAttribute('aria-label','Eat paste');blob.title='Eat paste';
      dispenser.append(blob);
      blob.onclick=()=>{blob.hidden=true;eatingSound();dialog.querySelector('[data-status]').textContent=blob.dataset.flavor||'Meal dispensed';dialog.querySelector('[data-report]').textContent='Tastes like chicken';};
    }
    let busy=false,pending=null,pasteTimer=null,lastGravity=null;
    const status=dialog.querySelector('[data-status]'),retry=dialog.querySelector('[data-retry]');
    const close=()=>dialog.close();
    const current=()=>{const state=b.state(),person=state.units.find(u=>u.id===unit.id);return {state,person,access:window.SAStationAccess.access(state,person,sicId)};};
    function redraw(){
      const {state,person,access}=current();if(!access){close();return;}
      const ready=state.practice||state.activeId===person.id&&!person.consoleHold&&!person.delayedAction&&!person.timedAction&&!state.rollPaused;
      dialog.querySelector('[data-turn]').textContent=state.practice?'CREW UTILITY':ready?'YOUR TURN':window.SAConsoleCommon.standby(state,person);
      const hold=dialog.querySelector('[data-hold]');hold.textContent=person.consoleHold?'Resume':'Hold';hold.disabled=state.practice||busy||(!ready&&!person.consoleHold)||Boolean(person.delayedAction||person.timedAction);
      dialog.querySelector('[data-leave]').disabled=state.practice||busy||!ready;
      if(!b.soundEnabled())stopSound();
      if(life){
        const gravity=window.SAShipMap.gravityEnabled(access.ship),impaired=access.item.impaired||access.item.status==='impaired';
        dialog.dataset.gravity=String(gravity);
        const toggle=dialog.querySelector('[data-gravity]');if(!busy)toggle.checked=gravity;toggle.disabled=!ready||busy||Boolean(pending)||impaired;
        const oxygenOn=window.SAShipMap.oxygenEnabled(access.ship);
        const oxygen=dialog.querySelector('[data-oxygen]');if(!busy)oxygen.checked=oxygenOn;oxygen.disabled=!ready||busy||Boolean(pending)||impaired;
        dialog.querySelector('[data-oxygen-state]').textContent=oxygenOn?'Oxygen recycling on':'OXYGEN OFF';
        dialog.querySelector('[data-oxygen-state]').style.color=oxygenOn?'':'#ffaf91';
        dialog.querySelector('[data-gravity-state]').textContent=gravity?'GRAVITY ON':'ZERO GRAVITY';
        dialog.querySelector('[data-movement]').textContent=gravity?'Normal movement':'Half movement speed / floating';
        dialog.querySelector('[data-gravity-note]').textContent=impaired?'Environmental controls unavailable while Life Support is impaired.':state.practice?'':ready?'An environment change uses this turn.':'Awaiting your turn.';
        if(lastGravity!==gravity){dialog.querySelector('[data-report]').textContent=gravity?'Gravity restored. Crew movement is normal.':'Gravity disabled. Crew movement is halved.';lastGravity=gravity;}
      }else{
        const impaired=access.item.impaired||access.item.status==='impaired';
        for(const select of dialog.querySelectorAll('select[data-utility-control]'))select.disabled=busy||impaired;
        dialog.querySelector('[data-dispense]').disabled=busy;
        if(impaired&&!busy)status.textContent='Flavor selector impaired: house paste only.';
      }
    }
    async function applyGravity(){
      if(busy||!pending)return;busy=true;dialog.dataset.utilityPending='true';retry.hidden=true;status.textContent='Updating Life Support...';redraw();
      try{await b.utilityAction(pending);pending=null;status.textContent='Life Support setting confirmed.';b.consoleTick();}
      catch(error){status.textContent=error.message;retry.hidden=false;}
      finally{busy=false;delete dialog.dataset.utilityPending;redraw();}
    }
    dialog.querySelector('[data-gravity]')?.addEventListener('change',event=>{
      const {person}=current();if(!b.state().practice&&!b.confirmGmPlayerAction(person,'changeGravity')){redraw();return;}
      pending={id:person.id,shipId:initial.ship.id,starshipId:initial.ship.id,sicId,kind:'gravity',enabled:event.target.checked,receipt:crypto.randomUUID()};applyGravity();
    });
    retry.onclick=applyGravity;
    dialog.querySelector('[data-oxygen]')?.addEventListener('change',event=>{
      const {person}=current();if(!b.state().practice&&!b.confirmGmPlayerAction(person,'changeOxygen')){redraw();return;}
      if(!event.target.checked&&!doc.defaultView.confirm('Turn oxygen off? Crew have 2 minutes 45 seconds of breathable air, then make Health + Endurance checks when room O2 reaches 10%.')){redraw();return;}
      pending={id:person.id,shipId:initial.ship.id,starshipId:initial.ship.id,sicId,kind:'oxygen',enabled:event.target.checked,receipt:crypto.randomUUID()};applyGravity();
    });
    dialog.querySelector('[data-dispense]')?.addEventListener('click',()=>{
      const {access}=current();if(busy||!access)return;busy=true;
      const impaired=access.item.impaired||access.item.status==='impaired',base=impaired?[...sicId].reduce((n,c)=>n+c.charCodeAt(0),0)%flavors.length:Number(dialog.querySelector('[data-flavor="base"]').value),blend=impaired?'':dialog.querySelector('[data-flavor="blend"]').value;
      const text=flavors[base]+(blend!==''?` + ${flavors[Number(blend)]}`:'')+' / '+(impaired?'House paste':dialog.querySelector('[data-texture]').value);
      dialog.querySelector('.nut-blob').dataset.flavor=text;
      dialog.dataset.texture=impaired?'chunky':({'Silky':'silky','Extra thick':'thick','Questionably chunky':'chunky'})[dialog.querySelector('[data-texture]').value];
      dialog.querySelector('.nut-blob').hidden=true;
      dialog.style.setProperty('--paste-color',colors[base]);dialog.dataset.dispensing='true';dialog.querySelector('[data-mixture]').textContent=text;status.textContent='Dispensing...';dispenseSound();redraw();
      pasteTimer=setTimeout(()=>{if(!dialog.isConnected)return;dialog.dataset.dispensing='false';dialog.dataset.served='true';busy=false;status.textContent='Meal ready.';dialog.querySelector('.nut-blob').hidden=false;dialog.querySelector('[data-report]').textContent=`${text}. Bon appetit, crew.`;stopSound();redraw();},1800);
    });
    dialog.querySelector('[data-close]').onclick=()=>{window.SAShipNavigationUI.remember(unit);close();};
    dialog.querySelector('[data-sound]').onclick=()=>{b.toggleSound();if(!b.soundEnabled())stopSound();window.SAConsoleCommon.updateSound(dialog);};
    dialog.querySelector('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(current().person);}catch(error){status.textContent=error.message;}};
    dialog.querySelector('[data-leave]').onclick=()=>{const person=current().person;if(!b.confirmGmPlayerAction(person,'leaveStation'))return;close();window.SACombatMap.openMove(person);};
    dialog.addEventListener('cancel',()=>window.SAShipNavigationUI.remember(unit));
    window.SAShipNavigationUI.mountSelector(dialog.querySelector('[data-selector]'),unit,sicId,close);
    redraw();const timer=setInterval(redraw,250);
    const hideSound=()=>{if(doc.hidden)stopSound();};doc.addEventListener('visibilitychange',hideSound);
    const teardown=()=>{clearInterval(timer);clearTimeout(pasteTimer);stopSound();doc.removeEventListener('visibilitychange',hideSound);dialog.remove();if(view===dialog)view=null;window.removeEventListener('pagehide',close);b.requestRender();};
    dialog.addEventListener('close',teardown,{once:true});window.addEventListener('pagehide',close,{once:true});
  }
  window.SAUtilityConsoleUI={open,isOpen:()=>Boolean(view||opening||window.SACleanserConsole?.isOpen()||window.SATransitConsoleUI?.isOpen()||window.SACrewRoomConsole?.isOpen()||window.SAFieldUtilityConsole?.isOpen())};
}());
