(function(){
  let activeDialog=null;
  const combatViews=new Set();
  const selectedConsoles=new Map();
  const rememberedConsole=key=>{try{return sessionStorage.getItem('sa-console:'+key);}catch{return null;}};
  function remember(unit){combatViews.add(seatKey(unit));}
  function mountSelector(container,unit,currentId,close){
    const select=container.ownerDocument.createElement('select');select.className='station-console-select';select.setAttribute('aria-label','Station console');
    const choices=window.SAStationAccess.consoles(window.SACombatBridge.state(),unit);
    select.innerHTML=choices.map(a=>`<option value="${esc(a.item.id)}">${esc(a.definition.name)}${a.remote?' / REMOTE':''}</option>`).join('');select.value=currentId;
    select.onchange=()=>{
      selectedConsoles.set(seatKey(unit),select.value);
      try{sessionStorage.setItem('sa-console:'+seatKey(unit),select.value);}catch{}
      // Wait for the old dialog's cleanup before opening the next console.
      select.closest('dialog').addEventListener('close',()=>setTimeout(()=>open(unit),0),{once:true});
      close();
    };
    container.prepend(select);
  }
  async function toggleHold(unit){
    const bridge=window.SACombatBridge;
    if(!unit||!bridge.confirmGmPlayerAction(unit,unit.consoleHold?'resumeConsole':'holdConsole'))return;
    if(!unit.consoleHold&&!window.confirm('Hold at 99%?\n\nYour ATB stays at 99% while combat and ship movement continue. Resume fills the final 1% normally; it does not interrupt another action or bypass a GM pause.\n\nYour remaining Command Window time is preserved. Hold is unavailable during unfinished actions.'))return;
    await bridge.action({action:'playerCombatAction',id:unit.id,kind:unit.consoleHold?'resumeConsole':'holdConsole'},'resolve',{throwOnError:true});
  }
  const seatKey=unit=>`${window.SACombatBridge.state()?.roomCode}:${unit?.id}:${unit?.location?.starshipId}:${unit?.location?.sicId}`;
  const factorNames={Situation:'Environment',Execution:'Uplink',Quality:'Drive Grade',Performance:'Response',Efficiency:'Throughput',Ingenuity:'Helm Sync'};
  const xy=p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const waveform=`<div class="pilot-waveform" aria-hidden="true"><small>CARRIER / PHASE TRACE</small><svg viewBox="0 0 240 54"><path class="wave-grid" d="M0 13H240M0 27H240M0 41H240M30 0V54M90 0V54M150 0V54M210 0V54"/><g class="wave-trace"><path d="M0 27L12 27L18 17L24 38L30 6L36 48L42 20L48 27L66 27L72 15L78 38L84 11L90 43L96 27L120 27L132 27L138 17L144 38L150 6L156 48L162 20L168 27L186 27L192 15L198 38L204 11L210 43L216 27L240 27L252 27L258 17L264 38L270 6L276 48L282 20L288 27L306 27L312 15L318 38L324 11L330 43L336 27L360 27"/></g></svg></div>`;
  function open(unit,{compact=false}={}){
    const bridge=window.SACombatBridge, initial=bridge.state(), choices=window.SAStationAccess.consoles(initial,unit);
    if(!choices.length||activeDialog||window.SAShieldConsoleUI?.isOpen()||window.SASensorConsoleUI?.isOpen()||window.SAWeaponConsoleUI?.isOpen())return;
    const selected=choices.find(a=>a.item.id===(selectedConsoles.get(seatKey(unit))||rememberedConsole(seatKey(unit))))||choices.find(a=>!a.remote)||choices[0];
    if(!compact&&selected.kind==='shield'){combatViews.delete(seatKey(unit));window.SAShieldConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='sensor'){combatViews.delete(seatKey(unit));window.SASensorConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='weapon'){combatViews.delete(seatKey(unit));window.SAWeaponConsoleUI.open(unit,selected.item.id);return;}
    const seated=window.SAShipNavigation.station(initial,unit);
    if(!seated)return;
    const pilotId=unit.id,shipId=seated.ship.id;
    if(!compact)combatViews.delete(seatKey(unit));
    let host=document;try{while(host.defaultView.frameElement)host=host.defaultView.parent.document;}catch{}
    const dialog=host.createElement('dialog');activeDialog=dialog;
    dialog.className=`ship-navigation-dialog${compact?' navigation-planner':''}`;dialog.setAttribute('aria-label',compact?'Move ship':'Pilot console');
    dialog.dataset.operatorId=unit.id;
    dialog.innerHTML=`<form><header><div class="pilot-identity"><small>HELM / ${esc(unit.characterName)}</small><h2>${esc(seated.ship.title)}</h2></div><div class="pilot-command"><strong data-turn-announcement role="status" aria-live="polite"></strong><div class="pilot-command-track" role="progressbar" aria-label="Command window remaining" aria-valuemin="0" aria-valuemax="100"><i data-command-fill></i></div><small data-command-status></small></div><div class="pilot-header-actions"><button type="button" data-sound>${bridge.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header>
      <section class="pilot-fleet"><h3>Fleet Condition</h3><div data-fleet></div><div class="pilot-telemetry" aria-hidden="true">NAV LINK 07.14<br>PHASE SYNC / NOMINAL<br><i></i>VECTOR LOCK 0A:9F</div></section>
      <section class="pilot-chart"><div class="pilot-chart-title"><h3>Navigation</h3><span data-flight></span></div><div data-navigation-map>${window.SASpaceMap.markup(initial.starships,initial.shipPositions,false,{navigation:true})}</div><div class="navigation-fields"><label>Hex Q<input name="q" type="number" min="-10000" max="10000" step="1" required></label><label>Hex R<input name="r" type="number" min="-10000" max="10000" step="1" required></label><button type="button" data-zoom=".7" aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-zoom="1.4" aria-label="Zoom out" title="Zoom out">&#8722;</button></div></section>
      <section class="pilot-activity"><h3>Combat Activity</h3><div data-activity></div></section>
      <section class="pilot-power"><h3>Action Units</h3><div class="pilot-au" data-au></div><div class="pilot-recharge"><i data-recharge></i></div><fieldset><legend>AU Boosts</legend><div data-boosts></div></fieldset>${waveform}</section>
      <section class="pilot-input"><h3>Command Processor</h3><div data-factors></div><div class="pilot-input-progress"><i data-input-progress></i></div><output data-input-status></output><output data-estimate></output><div class="pilot-rings" data-rings></div></section>
      <footer><p role="alert" data-error></p><p data-availability></p><button type="submit">Move Ship</button><button type="button" data-leave>Leave Console</button><div class="pilot-vector-array" aria-hidden="true"><small>VECTOR ARRAY</small><svg viewBox="0 0 160 90"><path class="vector-axis" d="M15 45H145M80 5V85"/><g class="vector-orbit"><ellipse cx="80" cy="45" rx="48" ry="24"/><ellipse cx="80" cy="45" rx="26" ry="38"/><circle cx="128" cy="45" r="3"/></g><circle class="vector-core" cx="80" cy="45" r="9"/></svg></div></footer></form>`;
    host.body.append(dialog);dialog.showModal();
    if(!compact)mountSelector(dialog.querySelector('.pilot-header-actions'),unit,seated.cell?.sicId||unit.location.sicId,()=>dialog.close());
    const form=dialog.querySelector('form'),svg=dialog.querySelector('svg[data-space-canvas]'),q=form.elements.q,r=form.elements.r,submit=form.querySelector('[type=submit]'),error=form.querySelector('[data-error]');
    const marker=host.createElementNS('http://www.w3.org/2000/svg','g');marker.classList.add('pilot-destination');svg.append(marker);
    let destination=null,locked=false,submitting=false,lastBoosts='',lastFleet='',lastLog='',lastFactors='',lastRings='',lastMarker='',lastAu='';
    let alertStart=null,lastTick=-1,auWarningUntil=0,chargeSound=null,lastContacts='';
    const hold=host.createElement('button');hold.type='button';hold.dataset.hold='';form.querySelector('[data-leave]').after(hold);
    const auWarning=host.createElement('small');auWarning.dataset.auWarning='';auWarning.setAttribute('role','status');form.querySelector('[data-recharge]').parentElement.after(auWarning);
    const orbitDot=form.querySelector('.vector-orbit circle');
    // Animate in the ellipse's own coordinates, rather than rotating around its center.
    orbitDot.classList.add('vector-dot');orbitDot.setAttribute('cx','0');orbitDot.setAttribute('cy','0');form.querySelector('.vector-orbit').after(orbitDot);
    const array=form.querySelector('.pilot-vector-array svg'),system=host.createElementNS('http://www.w3.org/2000/svg','g');system.classList.add('vector-system');system.append(...array.children);array.append(system);
    // Validate the locked destination ourselves so feedback stays inside the console.
    form.noValidate=true;
    const originalBox=svg.getAttribute('viewBox').split(' ').map(Number);
    const resizeMap=()=>{if(!svg.clientWidth||!svg.clientHeight)return;const v=svg.viewBox.baseVal,h=v.width*svg.clientHeight/svg.clientWidth,y=v.y+(v.height-h)/2;svg.setAttribute('viewBox',`${v.x} ${y} ${v.width} ${h}`);for(const rect of svg.querySelectorAll(':scope > rect'))for(const [key,value] of Object.entries({x:v.x,y,width:v.width,height:h}))rect.setAttribute(key,value);};
    const mapObserver=new ResizeObserver(resizeMap);mapObserver.observe(svg);
    const redrawCommands = !compact ? window.SAShipCommandUI.mount(dialog,pilotId) : () => {};
    function redraw(){
      redrawCommands();
      const state=bridge.state(),pilot=state.units.find(u=>u.id===pilotId),seat=window.SAShipNavigation.station(state,pilot);
      if(!seat||seat.ship.id!==shipId){dialog.close();return;}
      const access=window.SAShipNavigation.access(state,pilot),delay=pilot.delayedAction,available=state.activeId===pilotId&&!pilot.consoleHold&&!delay&&!pilot.delayTimer&&!pilot.timedAction&&!state.delayRequest&&!submitting;
      dialog.dataset.input=delay?.shipOrder?'active':'idle';
      const offline=seat.cell.item.disabled||['offline','powered-down'].includes(seat.cell.item.status);
      if(offline){form.dataset.offline='1';chargeSound?.stop();chargeSound=null;form.querySelector('[data-turn-announcement]').textContent='CONSOLE OFFLINE';form.querySelector('[data-command-status]').textContent=seat.cell.item.bootRemaining>0?`Restarting: ${Math.ceil(seat.cell.item.bootRemaining)} combat seconds remaining`:'Powered off';for(const b of form.querySelectorAll('button,input,select'))b.disabled=!b.matches('[data-close],[data-sound]');return;}
      if(form.dataset.offline){delete form.dataset.offline;form.querySelectorAll('button,input,select').forEach(b=>b.disabled=false);}
      const charging=false&&delay?.shipOrder&&!state.hardPaused&&!state.holdPaused&&!host.hidden&&bridge.soundEnabled();
      if(charging){chargeSound ||= bridge.startEngineCharge();chargeSound?.update(1-delay.remaining/100);}
      else {chargeSound?.stop();chargeSound=null;}
      const ready=state.activeId===pilotId&&!delay&&!pilot.delayTimer&&!pilot.timedAction;
      const command=ready&&state.command?.unitId===pilotId?state.command:null;
      const fraction=command?.total>0&&!command.expired?Math.max(0,Math.min(1,command.remaining/command.total)):0;
      dialog.dataset.turn=ready?'ready':delay?'input':'standby';
      dialog.dataset.urgent=command&&fraction<=.25?'true':'false';
      dialog.style.setProperty('--pilot-color',pilot.color||'#75ffc4');
      const active=state.units.find(u=>u.id===state.activeId);
      const standby=active?`PILOT STANDBY / ${active.characterName}'s turn`:state.hiddenActiveTurn?'PILOT STANDBY / Awaiting GM action':'PILOT STANDBY';
      const announcement=ready?(bridge.mode()==='player'?'YOUR TURN':`${pilot.characterName.toUpperCase()}'S TURN`):delay?(delay.shipOrder?'ENTERING COORDINATES':(delay.label||'OPERATING CONSOLE').toUpperCase()):standby;
      const notice=form.querySelector('[data-turn-announcement]');if(notice.textContent!==announcement)notice.textContent=announcement;
      if(pilot.consoleHold)notice.textContent='HOLDING / 99%';
      const alerting=ready&&!pilot.consoleHold&&!command?.expired&&!state.hardPaused&&!state.holdPaused&&!submitting&&!host.hidden;
      if(!alerting){alertStart=null;lastTick=-1;dialog.dataset.flash='false';}
      else {
        const now=performance.now();if(alertStart===null)alertStart=now;
        const elapsed=now-alertStart,beat=Math.floor(elapsed/1000);
        dialog.dataset.flash=elapsed%1000<450?'true':'false';
        if(beat!==lastTick){lastTick=beat;bridge.consoleTick();}
      }
      hold.textContent=pilot.consoleHold?'Resume':'Hold';hold.setAttribute('aria-pressed',String(Boolean(pilot.consoleHold)));hold.disabled=submitting||(!pilot.consoleHold&&!available);
      form.querySelector('[data-command-fill]').style.transform=`scaleX(${fraction})`;
      const track=form.querySelector('.pilot-command-track');track.setAttribute('aria-valuenow',String(Math.round(fraction*100)));
      track.setAttribute('aria-valuetext',command?(command.expired?'Command window ended':`${Math.round(fraction*100)} percent remaining`):'No active command window');
      form.querySelector('[data-command-status]').textContent=command?.expired?'COMMAND WINDOW ENDED':state.hardPaused?'CLOCK PAUSED':ready?(command?'COMMAND WINDOW':'READY FOR ORDERS'):delay?'COMMAND PROCESSING':'AWAITING NEXT TURN';
      const sound=form.querySelector('[data-sound]'),soundOn=bridge.soundEnabled();
      sound.classList.toggle('muted',!soundOn);sound.title=soundOn?'Mute turn sounds':'Enable turn sounds';sound.setAttribute('aria-label',sound.title);sound.setAttribute('aria-pressed',String(soundOn));
      const points=window.SAShipDistances.positions(state.starships,state.shipPositions),start=points.find(p=>p.id===shipId);
      const thrusters=access?.thrusters||[],signature=JSON.stringify(thrusters.map(t=>[t.id,t.type]));
      if(signature!==lastBoosts){
        const checked=new Set([...form.querySelectorAll('[name=boost]:checked')].map(b=>b.value));lastBoosts=signature;
        form.querySelector('[data-boosts]').innerHTML=thrusters.map(t=>{const d=window.SAShipMap.definition(t.type);return `<label><input type="checkbox" name="boost" value="${esc(t.id)}" ${checked.has(t.id)?'checked':''}>${esc(d.name)}<small>+${d.auBoost} / ${d.auCost} AU</small></label>`;}).join('')||'<span>No operational thrusters</span>';
      }
      let cost=0,speed=access?.speed||0;
      for(const box of form.querySelectorAll('[name=boost]')){if(box.checked){const d=window.SAShipMap.definition(thrusters.find(t=>t.id===box.value).type);cost+=d.auCost;speed+=d.auBoost;}}
      const au=seat.ship.auState||{current:0,maximum:0,progress:0},length=destination?window.SAShipDistances.hexDistance(start,destination):0;
      for(const box of form.querySelectorAll('[name=boost]')){
        const d=window.SAShipMap.definition(thrusters.find(t=>t.id===box.value).type),unaffordable=!box.checked&&cost+d.auCost>(au.available??au.current);
        box.disabled=!available;box.dataset.unaffordable=String(unaffordable);box.setAttribute('aria-disabled',String(!available||unaffordable));box.closest('label').classList.toggle('boost-unaffordable',unaffordable);
      }
      dialog.dataset.auWarning=performance.now()<auWarningUntil?'true':'false';
      auWarning.textContent=performance.now()<auWarningUntil?'not enough Auxiliary power':'';
      q.disabled=r.disabled=!available;
      submit.disabled=!available||!access||!locked||!destination||speed<=0||length<1e-6||cost>(au.available??au.current);
      submit.hidden=form.querySelector('.pilot-chart').classList.contains('command-page');
      if(submit.hidden)submit.disabled=true;
      form.querySelector('[data-availability]').textContent=submitting?'Sending order...':delay?(delay.shipOrder?'Coordinates are being entered.':`${delay.label||'Console action'} in progress.`):state.activeId!==pilotId?'Waiting for your next turn.':!available?'Finish the current action first.':!access?'Operational cockpit, engine and thrusters required.':cost>(au.available??au.current)?`Boosts need ${cost} AU; ${au.available??au.current} available.`:speed<=0?'Select an AU boost to provide positive movement speed.':!locked||!destination?'Choose a destination.':length<1e-6?'Choose a different hex.':'Destination locked';
      submit.textContent=submitting?'Submitting...':delay?'Entering Order':'Move Ship';
      form.querySelector('[data-leave]').disabled=!available;
      const settings=delay?.settings||window.SAShipNavigation.inputSettings(state,pilot);
      const factors=Object.entries(factorNames).map(([name,label])=>`<div title="${name}: ${settings.factors[name]} of 4"><span class="pilot-factor" aria-label="${name} ${settings.factors[name]} of 4">${bridge.delayIcon(settings.factors[name])}</span><small>${label}</small></div>`).join('');
      if(factors!==lastFactors){form.querySelector('[data-factors]').innerHTML=factors;lastFactors=factors;}
      form.querySelector('[data-input-progress]').style.width=`${delay?100-delay.remaining:0}%`;
      form.querySelector('[data-input-status]').textContent=delay?`${delay.label||'Console input'} / ${(delay.remaining/delay.rate).toFixed(1)} sec`:available?`Input delay ${(100/settings.rate).toFixed(1)} sec`:'Awaiting pilot turn';
      form.querySelector('[data-estimate]').textContent=`${speed} Units / 12 sec${destination?` | ${length.toFixed(1)} Units | Travel ${speed?(length*12/speed).toFixed(1):'--'} sec`:''} | Boost ${cost} AU`;
      const auMarkup=`<strong>${au.current}<small> / ${au.maximum}</small></strong><span>${Array.from({length:12},(_,i)=>`<i class="${i<Math.round(12*au.current/Math.max(1,au.maximum))?'charged':''}"></i>`).join('')}</span>`;
      if(auMarkup!==lastAu){form.querySelector('[data-au]').innerHTML=auMarkup;lastAu=auMarkup;}
      form.querySelector('[data-recharge]').style.width=`${au.current>=au.maximum?100:au.progress}%`;
      const nav=seat.ship.navigation;
      form.querySelector('[data-flight]').textContent=nav&&nav.phase!=='stopped'?`${nav.phase==='drift'?'DRIFT':'UNDERWAY'} / ${nav.speed}`:'HOLDING POSITION';
      const fleet=state.starships.map(s=>{
        if(s.contactOnly)return `<div><strong>${esc(s.title)}</strong><small>${s.contactLevel==='unknown'?'Unresolved signal':'Detected / analysis required'}</small></div>`;
        const hull=Number(s.maximumHullHp??s.ship?.maximumHullHp??s.ship?.gridCells?.length)||0,shield=Number(s.maximumShieldHp??s.ship?.maximumShieldHp)||0;
        return `<div><strong>${esc(s.title)}</strong>${window.SAHealthDisplay.track('hull',s.currentHullHp??s.ship?.currentHullHp??hull,hull,bridge.mode()==='gm')}${window.SAHealthDisplay.track('shield',s.currentShieldHp??s.ship?.currentShieldHp??shield,shield,bridge.mode()==='gm')}</div>`;
      }).join('');
      if(fleet!==lastFleet){form.querySelector('[data-fleet]').innerHTML=fleet;lastFleet=fleet;}
      const log=(state.log||[]).slice(-25).reverse().map(e=>`<p><time>${esc(e.at)}</time>${esc(window.SAHealthDisplay.logText(e.text,bridge.mode()==='gm'))}</p>`).join('');
      if(log!==lastLog){form.querySelector('[data-activity]').innerHTML=log;lastLog=log;}
      if(!compact){const rings=bridge.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(form.querySelector('[data-rings]'),rings);lastRings=rings;}}
      const contactSignature=JSON.stringify(state.starships.map(s=>[s.id,s.title,s.contactLevel,s.uncertainty]));
      if(contactSignature!==lastContacts){
        const template=host.createElement('template');template.innerHTML=window.SASpaceMap.markup(state.starships,state.shipPositions,false,{navigation:true});
        const fresh=template.content.querySelector('[data-space-canvas]');
        svg.replaceChildren(...fresh.childNodes,marker);lastContacts=contactSignature;
      }
      for(const g of svg.querySelectorAll('g[data-space-ship]')){const p=points.find(p=>p.id===g.dataset.spaceShip);if(p){const c=xy(p);g.setAttribute('transform',`translate(${c.x} ${c.y})`);}}
      marker.classList.toggle('locked',locked);
      const pixel=svg.viewBox.baseVal.width/Math.max(1,svg.clientWidth);
      for(const g of svg.querySelectorAll('[data-space-ship]')){const text=g.querySelector('text'),circle=g.querySelector('circle');text.setAttribute('font-size',16*pixel);text.setAttribute('stroke-width',3*pixel);text.setAttribute('y',-18*pixel);circle.setAttribute('r',8*pixel);circle.setAttribute('stroke-width',pixel);}
      const a=xy(start),b=destination&&xy(destination),scale=svg.viewBox.baseVal.width/200;
      const nextMarker=b?`<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="${locked?'#75ffc4':'#ffe191'}" stroke-width="${scale}"/><circle cx="${b.x}" cy="${b.y}" r="${scale*2}" fill="#07120e" stroke="#75ffc4" stroke-width="${scale}"/>`:'';
      if(nextMarker!==lastMarker){marker.innerHTML=nextMarker;lastMarker=nextMarker;}
    }
    function select(event,lock){
      if(submitting||q.disabled||(!lock&&locked))return;
      const p=new host.defaultView.DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const rawQ=Math.sqrt(3)/3*p.x-p.y/3,rawR=2*p.y/3;let x=Math.round(rawQ),z=Math.round(rawR),y=Math.round(-rawQ-rawR);
      const dx=Math.abs(x-rawQ),dz=Math.abs(z-rawR),dy=Math.abs(y+rawQ+rawR);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;
      if(Math.abs(x)>10000||Math.abs(z)>10000)return;destination={q:x,r:z};locked=lock;q.value=x;r.value=z;error.textContent='';redraw();
    }
    svg.addEventListener('pointermove',e=>select(e,false));svg.addEventListener('click',e=>select(e,true));
    form.querySelector('.pilot-chart').addEventListener('pointerleave',()=>{if(!locked&&!submitting){destination=null;q.value='';r.value='';redraw();}});
    form.querySelector('[data-boosts]').addEventListener('click',e=>{
      const box=e.target.closest('input[name=boost]');
      if(box?.dataset.unaffordable==='true'){e.preventDefault();auWarningUntil=performance.now()+2200;dialog.dataset.auWarning='true';auWarning.textContent='not enough Auxiliary power';}
    });
    form.addEventListener('input',e=>{if([q,r].includes(e.target)){locked=true;destination=q.value!==''&&r.value!==''&&q.validity.valid&&r.validity.valid?{q:Number(q.value),r:Number(r.value)}:null;}error.textContent='';redraw();});
    for(const zoom of form.querySelectorAll('[data-zoom]'))zoom.onclick=()=>{const v=svg.viewBox.baseVal,w=Math.max(8,Math.min(80000,v.width*Number(zoom.dataset.zoom))),h=w*(svg.clientWidth?svg.clientHeight/svg.clientWidth:originalBox[3]/originalBox[2]),x=v.x+(v.width-w)/2,y=v.y+(v.height-h)/2;svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);for(const rect of svg.querySelectorAll(':scope > rect'))for(const [k,val] of Object.entries({x,y,width:w,height:h}))rect.setAttribute(k,val);redraw();};
    form.onsubmit=async e=>{e.preventDefault();redraw();if(submit.disabled)return;const pilot=bridge.state().units.find(u=>u.id===pilotId);if(!bridge.confirmGmPlayerAction(pilot,'moveStarship'))return;const order={action:'playerCombatAction',id:pilotId,kind:'moveStarship',destination:{...destination},boostIds:[...form.querySelectorAll('[name=boost]:checked')].map(b=>b.value),trigger:window.SAShipCommandUI.conditionalPayload(dialog)};submitting=true;redraw();try{await bridge.action(order,'resolve',{throwOnError:true});locked=false;}catch(err){error.textContent=err.message;}finally{submitting=false;if(dialog.isConnected)redraw();}};
    const rememberDismissal=()=>{combatViews.add(seatKey(bridge.state().units.find(u=>u.id===pilotId)));};
    form.querySelector('[data-leave]').onclick=()=>{const pilot=bridge.state().units.find(u=>u.id===pilotId);if(!bridge.confirmGmPlayerAction(pilot,'leaveStation'))return;rememberDismissal();dialog.close();window.SACombatMap.openMove(pilot);};
    form.querySelector('[data-close]').onclick=()=>{rememberDismissal();dialog.close();};
    form.querySelector('[data-sound]').onclick=()=>{bridge.toggleSound();redraw();};
    hold.onclick=async()=>{if(submitting)return;submitting=true;try{await toggleHold(bridge.state().units.find(u=>u.id===pilotId));}catch(err){error.textContent=err.message;}finally{submitting=false;redraw();}};
    dialog.addEventListener('pointerdown',bridge.resumeAudio,{passive:true});
    dialog.addEventListener('keydown',bridge.resumeAudio);
    dialog.addEventListener('cancel',rememberDismissal);
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);mapObserver.disconnect();chargeSound?.stop();chargeSound=null;window.removeEventListener('pagehide',cleanup);dialog.remove();activeDialog=null;setTimeout(()=>bridge.requestRender(),0);};
    dialog.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  function sync(unit){
    const bridge=window.SACombatBridge;
    if(bridge.mode()!=='player'||unit?.id!==bridge.myUnitId())return;
    let owner=window;try{while(owner.frameElement){if(!owner.frameElement.getClientRects().length)return;owner=owner.parent;}}catch{return;}
    if(window.SAStationAccess.consoles(bridge.state(),unit).length&&!combatViews.has(seatKey(unit)))open(unit);
  }
  const observe=state=>{
    for(const key of combatViews){if(!state.units.some(unit=>seatKey(unit)===key&&window.SAStationAccess.consoles(state,unit).length)){combatViews.delete(key);selectedConsoles.delete(key);}}
    // State updates continue when the ordinary action panel is hidden between turns.
    queueMicrotask(()=>{const bridge=window.SACombatBridge;if(bridge?.mode()==='player')sync(bridge.state()?.units.find(unit=>unit.id===bridge.myUnitId()));});
  };
  window.SAShipNavigationUI={open,sync,observe,toggleHold,mountSelector,remember};
}());
