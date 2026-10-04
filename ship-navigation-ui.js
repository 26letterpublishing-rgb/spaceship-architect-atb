(function(){
  let activeDialog=null;
  let slidePending=0;
  const combatViews=new Set();
  const selectedConsoles=new Map();
  const rememberedConsole=key=>{try{return sessionStorage.getItem('sa-console:'+key);}catch{return null;}};
  function remember(unit){combatViews.add(seatKey(unit));try{sessionStorage.setItem('sa-console-view:'+seatKey(unit),'combat');}catch{}}
  const rememberedView=key=>{try{return sessionStorage.getItem('sa-console-view:'+key);}catch{return null;}};
  function mountSelector(container,unit,currentId,close){
    container.closest('dialog').dataset.sicId=currentId;
    const select=container.ownerDocument.createElement('select');select.className='station-console-select';select.setAttribute('aria-label','Station console');
    let choices=[];
    const refreshChoices=()=>{
      const state=window.SACombatBridge.state();if(!state){select.closest('dialog')?.close();return;}const person=state.units.find(u=>u.id===unit.id)||unit;
      choices=window.SAStationAccess.consoles(state,person);
      const options=choices.map(a=>`<option value="${esc(a.item.id)}">${esc(a.definition.name)}${a.remotePilot?' / REMOTE — '+esc(a.ship.title):a.controlled?' / CAPTURED':a.remote?' / REMOTE':''}</option>`).join('');
      if(select.innerHTML!==options){const previous=select.value||currentId;select.innerHTML=options;select.value=previous;}
      container.closest('dialog')?.querySelectorAll('.console-swipe').forEach(button=>button.disabled=choices.length<2);
    };
    refreshChoices();
    select.onchange=async event=>{
      const view=select.closest('dialog');if(view.dataset.switching)return;view.dataset.switching='true';
      const direction=event?.slideDirection||(select.selectedIndex<choices.findIndex(a=>a.item.id===currentId)?-1:1);slidePending=direction;
      try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await view.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-direction*100}vw)`,opacity:0}],{duration:500,fill:'forwards'}).finished;}catch{slidePending=0;}
      if(!view.isConnected||!view.open){slidePending=0;return;}
      selectedConsoles.set(seatKey(unit),select.value);
      try{sessionStorage.setItem('sa-console:'+seatKey(unit),select.value);}catch{}
      // Wait for the old dialog's cleanup before opening the next console.
      select.closest('dialog').addEventListener('close',()=>setTimeout(()=>open(unit),0),{once:true});
      close();
    };
    container.prepend(select);
    const refreshTimer=setInterval(()=>{if(!select.isConnected){clearInterval(refreshTimer);return;}refreshChoices();},300);
    container.closest('dialog').addEventListener('close',()=>clearInterval(refreshTimer),{once:true});
    if(slidePending){const direction=slidePending;slidePending=0;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)container.closest('dialog').animate([{transform:`translateX(${direction*100}vw)`,opacity:0},{transform:'translateX(0)',opacity:1}],{duration:500});}
    window.SAConsoleCommon?.mount(container.closest('dialog'),unit);
    for(const direction of [-1,1]){const button=container.ownerDocument.createElement('button');button.type='button';button.className='console-swipe '+(direction<0?'previous':'next');button.textContent=direction<0?'\u2039':'\u203a';button.title=direction<0?'Previous console':'Next console';button.setAttribute('aria-label',button.title);button.disabled=choices.length<2;button.onclick=()=>{select.selectedIndex=(select.selectedIndex+direction+choices.length)%choices.length;select.onchange({slideDirection:direction});};container.closest('dialog').append(button);}
  }
  async function toggleHold(unit){
    const bridge=window.SACombatBridge;
    if(!unit||!bridge.confirmGmPlayerAction(unit,unit.consoleHold?'resumeConsole':'holdConsole'))return;
    if(!unit.consoleHold){
      let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}
      const accepted=await new Promise(resolve=>{const dialog=doc.createElement('dialog');dialog.setAttribute('aria-label','Hold at 99%');dialog.style.cssText='max-width:480px;background:#102330;color:#ecf6ff;border:1px solid #63cfe2;padding:24px;border-radius:10px';dialog.innerHTML='<h2>Hold at 99%?</h2><p>Your ATB stays at 99% while combat and ship movement continue. Resume fills the final 1% normally.</p><p>Your remaining Command Window time is preserved. This does not interrupt another action or bypass a GM pause.</p><form method="dialog" style="display:flex;gap:12px;justify-content:flex-end"><button value="cancel">Cancel</button><button value="hold">Hold at 99%</button></form>';dialog.addEventListener('close',()=>{const approved=dialog.returnValue==='hold';dialog.remove();resolve(approved);},{once:true});doc.body.append(dialog);dialog.showModal();});
      if(!accepted)return;
    }
    await bridge.action({action:'playerCombatAction',id:unit.id,kind:unit.consoleHold?'resumeConsole':'holdConsole'},'resolve',{throwOnError:true});
  }
  const seatKey=unit=>`${window.SACombatBridge.state()?.roomCode}:${unit?.characterId||unit?.id}`;
  const factorNames={Situation:'Environment',Execution:'Uplink',Quality:'Drive Grade',Performance:'Response',Efficiency:'Throughput',Ingenuity:'Helm Sync'};
  const xy=p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const waveform=`<div class="pilot-waveform" aria-hidden="true"><small>CARRIER / PHASE TRACE</small><svg viewBox="0 0 240 54"><path class="wave-grid" d="M0 13H240M0 27H240M0 41H240M30 0V54M90 0V54M150 0V54M210 0V54"/><g class="wave-trace"><path d="M0 27L12 27L18 17L24 38L30 6L36 48L42 20L48 27L66 27L72 15L78 38L84 11L90 43L96 27L120 27L132 27L138 17L144 38L150 6L156 48L162 20L168 27L186 27L192 15L198 38L204 11L210 43L216 27L240 27L252 27L258 17L264 38L270 6L276 48L282 20L288 27L306 27L312 15L318 38L324 11L330 43L336 27L360 27"/></g></svg></div>`;
  function open(unit,{compact=false,sicId=null}={}){
    unit=window.SACombatBridge.state().units.find(u=>u.id===unit?.id)||unit;
    const bridge=window.SACombatBridge, initial=bridge.state(), choices=window.SAStationAccess.consoles(initial,unit);
    let root=document;try{while(root.defaultView.frameElement&&!root.defaultView.frameElement.hasAttribute('data-explore-perspective'))root=root.defaultView.parent.document;}catch{}
    const closing=root.querySelector('dialog[data-operator-id]:not([open])');
    if(closing){closing.addEventListener('close',()=>setTimeout(()=>open(unit,{compact,sicId}),0),{once:true});return;}
    if(!choices.length||activeDialog||window.SAShieldConsoleUI?.isOpen()||window.SASensorConsoleUI?.isOpen()||window.SAWeaponConsoleUI?.isOpen()||window.SALockConsoleUI?.isOpen()||window.SAUtilityConsoleUI?.isOpen())return;
    const selected=choices.find(a=>a.item.id===(sicId||selectedConsoles.get(seatKey(unit))||rememberedConsole(seatKey(unit))))||choices.find(a=>!a.remote)||choices[0];
    if(!compact){combatViews.delete(seatKey(unit));selectedConsoles.set(seatKey(unit),selected.item.id);try{sessionStorage.setItem('sa-console:'+seatKey(unit),selected.item.id);sessionStorage.setItem('sa-console-view:'+seatKey(unit),'console');}catch{}}
    if(!compact&&selected.kind==='shield'){combatViews.delete(seatKey(unit));window.SAShieldConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='sensor'){combatViews.delete(seatKey(unit));window.SASensorConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='weapon'){combatViews.delete(seatKey(unit));window.SAWeaponConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='lock'){combatViews.delete(seatKey(unit));window.SALockConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='utility'){combatViews.delete(seatKey(unit));window.SAUtilityConsoleUI.open(unit,selected.item.id);return;}
    if(!compact&&selected.kind==='hacking'){combatViews.delete(seatKey(unit));window.SAHackingConsoleUI.open(unit,selected.item.id);return;}
    const pilotSicId=selected.kind==='pilot'?selected.item.id:unit.location.sicId;
    const seated=window.SAShipNavigation.station(initial,unit,pilotSicId);
    if(!seated)return;
    const pilotId=unit.id,shipId=seated.ship.id;
    if(!compact)combatViews.delete(seatKey(unit));
    let host=document;try{while(host.defaultView.frameElement&&!host.defaultView.frameElement.hasAttribute('data-explore-perspective'))host=host.defaultView.parent.document;}catch{}
    const dialog=host.createElement('dialog');activeDialog=dialog;
    dialog.className=`ship-navigation-dialog${compact?' navigation-planner':''}`;dialog.setAttribute('aria-label',compact?'Move ship':'Pilot console');
    dialog.dataset.operatorId=unit.id;
    dialog.dataset.sicId=pilotSicId;
    dialog.innerHTML=`<form><header><div class="pilot-identity"><small>HELM / ${esc(unit.characterName)}</small><h2>${esc(seated.ship.title)}</h2></div><div class="pilot-command"><strong data-turn-announcement role="status" aria-live="polite"></strong><div class="pilot-command-track" role="progressbar" aria-label="Command window remaining" aria-valuemin="0" aria-valuemax="100"><i data-command-fill></i></div><small data-command-status></small></div><div class="pilot-header-actions"><button type="button" data-sound>${bridge.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header>
      <section class="pilot-fleet"><h3>Fleet Condition</h3><div data-fleet></div><div class="pilot-telemetry" aria-hidden="true">NAV LINK 07.14<br>PHASE SYNC / NOMINAL<br><i></i>VECTOR LOCK 0A:9F</div></section>
      <section class="pilot-chart"><div class="pilot-chart-title"><h3>Navigation</h3><span data-flight></span></div><div data-navigation-map>${window.SASpaceMap.markup(initial.starships,initial.shipPositions,false,{navigation:true})}</div><div class="navigation-fields"><label>Hex Q<input name="q" type="number" min="-10000" max="10000" step="1" required></label><label>Hex R<input name="r" type="number" min="-10000" max="10000" step="1" required></label><button type="button" data-zoom=".7" aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-zoom="1.4" aria-label="Zoom out" title="Zoom out">&#8722;</button></div></section>
      <section class="pilot-activity"><h3>Combat Activity</h3><div data-activity></div></section>
      <section class="pilot-power"><h3>Action Units</h3><div class="pilot-au" data-au></div><div class="pilot-recharge"><i data-recharge></i></div><fieldset><legend>AU Boosts</legend><div data-boosts></div></fieldset>${waveform}</section>
      <section class="pilot-input"><h3>Command Processor</h3><div class="pilot-rings" data-rings></div><div data-factors></div><div class="pilot-input-progress"><i data-input-progress></i></div><output data-input-status></output><output data-estimate></output></section>
      <footer><p data-navigation-summary></p><p role="alert" data-error></p><p data-availability></p><button type="submit">Move Ship</button><button type="button" data-leave>Leave Console</button><div class="pilot-vector-array" aria-hidden="true"><small>VECTOR ARRAY</small><svg viewBox="0 0 160 90"><path class="vector-axis" d="M15 45H145M80 5V85"/><g class="vector-orbit"><ellipse cx="80" cy="45" rx="48" ry="24"/><ellipse cx="80" cy="45" rx="26" ry="38"/><circle cx="128" cy="45" r="3"/></g><circle class="vector-core" cx="80" cy="45" r="9"/></svg></div></footer></form>`;
    host.body.append(dialog);dialog.showModal();
    if(!compact)mountSelector(dialog.querySelector('.pilot-header-actions'),unit,seated.cell?.sicId||unit.location.sicId,()=>dialog.close());
    const form=dialog.querySelector('form'),svg=dialog.querySelector('svg[data-space-canvas]'),q=form.elements.q,r=form.elements.r,submit=form.querySelector('[type=submit]'),error=form.querySelector('[data-error]');
    const marker=host.createElementNS('http://www.w3.org/2000/svg','g');marker.classList.add('pilot-destination');svg.append(marker);
    let destination=null,locked=false,planning=compact,submitting=false,lastBoosts='',lastFleet='',lastLog='',lastFactors='',lastRings='',lastMarker='',lastAu='';
    const begin=host.createElement('button'),cancel=host.createElement('button');begin.type=cancel.type='button';begin.textContent='Move Ship';cancel.textContent='Cancel Move';begin.dataset.beginMove='';submit.before(begin,cancel);
    begin.onclick=()=>{if(form.querySelector('.pilot-chart').classList.contains('command-page'))form.querySelector('[data-command-page]')?.click();planning=true;redraw();if(!svg.dataset.manualCamera)fitVisible();if(!host.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)form.querySelector('.pilot-chart').animate([{boxShadow:'inset 0 0 0 3px #6affab',backgroundColor:'#236341'},{boxShadow:'inset 0 0 0 0 transparent',backgroundColor:'transparent'}],{duration:700});};cancel.onclick=()=>{planning=false;locked=false;destination=null;q.value=r.value='';redraw();};
    let alertStart=null,lastTick=-1,auWarningUntil=0,chargeSound=null,lastContacts='';
    const hold=host.createElement('button');hold.type='button';hold.dataset.hold='';form.querySelector('[data-leave]').after(hold);
    const auWarning=host.createElement('small');auWarning.dataset.auWarning='';auWarning.setAttribute('role','status');form.querySelector('[data-recharge]').parentElement.after(auWarning);
    const orbitDot=form.querySelector('.vector-orbit circle');
    // Animate in the ellipse's own coordinates, rather than rotating around its center.
    orbitDot.classList.add('vector-dot');orbitDot.setAttribute('cx','0');orbitDot.setAttribute('cy','0');form.querySelector('.vector-orbit').after(orbitDot);
    const array=form.querySelector('.pilot-vector-array svg'),system=host.createElementNS('http://www.w3.org/2000/svg','g');system.classList.add('vector-system');system.append(...array.children);array.append(system);
    // Validate the locked destination ourselves so feedback stays inside the console.
    form.noValidate=true;

    const auto=host.createElement('button');auto.type='button';auto.textContent='Fit Contacts';auto.title='Fit visible ships and objects';auto.dataset.autoZoom='';form.querySelector('.navigation-fields').append(auto);
    const fitVisible=()=>window.SASpaceMap.fitRendered(svg);
    auto.onclick=()=>{delete svg.dataset.manualCamera;auto.setAttribute('aria-pressed','false');fitVisible();};
    {const enlarge=host.createElement('button');enlarge.type='button';enlarge.textContent='Enlarge Map';enlarge.dataset.enlargeNavigation='';enlarge.dataset.mapFocus='';enlarge.onclick=()=>{if(form.querySelector('.pilot-chart').classList.contains('command-page'))form.querySelector('[data-command-page]')?.click();window.SASpaceMap.focusMap(dialog,enlarge);};form.querySelector('.pilot-chart-title').append(enlarge);}
    const resizeMap=()=>{if(!svg.clientWidth||!svg.clientHeight)return;const v=svg.viewBox.baseVal,h=v.width*svg.clientHeight/svg.clientWidth,y=v.y+(v.height-h)/2;svg.setAttribute('viewBox',`${v.x} ${y} ${v.width} ${h}`);for(const rect of svg.querySelectorAll(':scope > rect'))for(const [key,value] of Object.entries({x:v.x,y,width:v.width,height:h}))rect.setAttribute(key,value);};
    const mapObserver=new ResizeObserver(resizeMap);mapObserver.observe(svg);
    const redrawCommands = !compact ? window.SAShipCommandUI.mount(dialog,pilotId) : () => {};
    function redraw(){
      if(!bridge.state()){dialog.close();return;}
      redrawCommands();
      const state=bridge.state(),pilot=state.units.find(u=>u.id===pilotId),seat=window.SAShipNavigation.station(state,pilot,pilotSicId);
      if(!seat||seat.ship.id!==shipId){dialog.close();return;}
      const access=window.SAShipNavigation.access(state,pilot,pilotSicId),delay=pilot.delayedAction,available=state.activeId===pilotId&&!pilot.consoleHold&&!delay&&!pilot.delayTimer&&!pilot.timedAction&&!state.delayRequest&&!submitting;
      dialog.dataset.input=delay?.shipOrder?'active':'idle';
      const offline=seat.cell.item.disabled||['offline','powered-down'].includes(seat.cell.item.status);
      if(offline){form.dataset.offline='1';chargeSound?.stop();chargeSound=null;form.querySelector('[data-turn-announcement]').textContent='CONSOLE OFFLINE';form.querySelector('[data-command-status]').textContent=seat.cell.item.bootRemaining>0?`Restarting: ${Math.ceil(seat.cell.item.bootRemaining)} combat seconds remaining`:'Powered off';for(const b of form.querySelectorAll('button,input,select'))b.disabled=!b.matches('[data-close],[data-sound],[data-console-maintenance],[data-local-recovery]');return;}
      if(form.dataset.offline){delete form.dataset.offline;form.querySelectorAll('button,input,select').forEach(b=>b.disabled=false);}
      const ready=state.activeId===pilotId&&!delay&&!pilot.delayTimer&&!pilot.timedAction;
      const command=ready&&state.command?.unitId===pilotId?state.command:null;
      const fraction=command?.total>0&&!command.expired?Math.max(0,Math.min(1,command.remaining/command.total)):0;
      dialog.dataset.turn=ready?'ready':delay?'input':'standby';
      dialog.dataset.urgent=command&&fraction<=.25?'true':'false';
      dialog.style.setProperty('--pilot-color',pilot.color||'#75ffc4');
      const active=state.units.find(u=>u.id===state.activeId);
      const standby=state.practice?'OUT OF COMBAT':active?`PILOT STANDBY / ${active.characterName}'s turn`:state.hiddenActiveTurn?'PILOT STANDBY / Awaiting GM action':'PILOT STANDBY';
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
      hold.textContent=pilot.consoleHold?'Resume':'Hold';hold.classList.toggle('resume-ready',Boolean(pilot.consoleHold));hold.setAttribute('aria-pressed',String(Boolean(pilot.consoleHold)));hold.disabled=submitting||(!pilot.consoleHold&&!available);
      form.querySelector('[data-command-fill]').style.transform=`scaleX(${fraction})`;
      const track=form.querySelector('.pilot-command-track');track.setAttribute('aria-valuenow',String(Math.round(fraction*100)));
      track.setAttribute('aria-valuetext',command?(command.expired?'Command window ended':`${Math.round(fraction*100)} percent remaining`):'No active command window');
      form.querySelector('[data-command-status]').textContent=command?.expired?'COMMAND WINDOW ENDED':state.hardPaused?'CLOCK PAUSED':ready?(command?'COMMAND WINDOW':'READY FOR ORDERS'):delay?'COMMAND PROCESSING':'AWAITING NEXT TURN';
      window.SAConsoleCommon.updateSound(dialog);
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
      q.disabled=r.disabled=!available||!planning;
      begin.hidden=planning;begin.disabled=!available||!access;cancel.hidden=!planning;
      submit.disabled=!available||!access||!locked||!destination||speed<=0||length<1e-6||cost>(au.available??au.current);
      submit.hidden=!planning||form.querySelector('.pilot-chart').classList.contains('command-page');
      if(submit.hidden)submit.disabled=true;
      form.querySelector('[data-availability]').textContent=submitting?'Sending order...':delay?(delay.shipOrder?'Coordinates are being entered.':`${delay.label||'Console action'} in progress.`):state.activeId!==pilotId?'Waiting for your next turn.':!available?'Finish the current action first.':!access?'Operational cockpit, engine and thrusters required.':cost>(au.available??au.current)?`Boosts need ${cost} AU; ${au.available??au.current} available.`:speed<=0?'Select an AU boost to provide positive movement speed.':!locked||!destination?'Choose a destination.':length<1e-6?'Choose a different hex.':'Destination locked';
      submit.textContent=submitting?'Submitting...':delay?'Entering Order':'Confirm Move';
      form.querySelector('[data-leave]').hidden=Boolean(pilot?.shipAi);
      form.querySelector('[data-leave]').disabled=!available||Boolean(pilot?.shipAi);
      const settings=delay?.settings||window.SAShipNavigation.inputSettings(state,pilot,pilotSicId);
      const factors=Object.entries(factorNames).map(([name,label])=>`<div title="${name}: ${settings.factors[name]} of 4"><span class="pilot-factor" aria-label="${name} ${settings.factors[name]} of 4">${bridge.delayIcon(settings.factors[name])}</span><small>${label}</small></div>`).join('');
      if(factors!==lastFactors){form.querySelector('[data-factors]').innerHTML=factors;lastFactors=factors;}
      form.querySelector('[data-input-progress]').style.width=`${delay?100-delay.remaining:0}%`;
      form.querySelector('[data-input-status]').textContent=state.practice?'Navigation standby':delay?`${delay.label||'Console input'} / ${(delay.remaining/delay.rate).toFixed(1)} sec`:available?`Input delay ${(100/settings.rate).toFixed(1)} sec`:'Awaiting pilot turn';
      if(state.practice){form.querySelector('[data-availability]').textContent='Combat navigation unavailable outside combat.';form.querySelector('[data-command-status]').textContent='OUT OF COMBAT';}
      form.querySelector('[data-estimate]').textContent=`${speed} Units / 10 sec${destination?` | ${length.toFixed(1)} Units | Arrival ${speed?(100/settings.rate+length*10/speed).toFixed(1):'--'} sec | Drift ${window.SAShipNavigation.driftDistance(length)} Units / ${window.SAShipNavigation.driftSeconds(length)} sec`:''} | Boost ${cost} AU`;
      form.querySelector('[data-navigation-summary]').textContent=form.querySelector('[data-input-status]').textContent+' · '+form.querySelector('[data-estimate]').textContent;
      const auMarkup=`<strong>${au.current}<small> / ${au.maximum}</small></strong><span>${Array.from({length:12},(_,i)=>`<i class="${i<Math.round(12*au.current/Math.max(1,au.maximum))?'charged':''}"></i>`).join('')}</span>`;
      if(auMarkup!==lastAu){form.querySelector('[data-au]').innerHTML=auMarkup;lastAu=auMarkup;}
      form.querySelector('[data-recharge]').style.width=`${au.current>=au.maximum?100:au.progress}%`;
      const nav=seat.ship.navigation;
      form.querySelector('[data-flight]').textContent=seat.ship.ship.warpState?.phase==='traveling'?'IN WARP':seat.ship.ship.warpState?.phase==='activating'?'WARP ACTIVATION':nav&&nav.phase!=='stopped'?`${nav.phase==='drift'?'DRIFT':'UNDERWAY'} / ${nav.speed}`:'HOLDING POSITION';
      const fleet=state.starships.map(s=>{
        if(s.contactOnly)return `<div><strong>${esc(s.title)}</strong><small>${s.contactLevel==='unknown'?'Unresolved signal':'Detected / analysis required'}</small></div>`;
        const hull=Number(s.maximumHullHp??s.ship?.maximumHullHp??s.ship?.gridCells?.length)||0,shield=Number(s.maximumShieldHp??s.ship?.maximumShieldHp)||0;
        return `<div><strong>${esc(s.title)}${s.id===seat.ship.id?' · '+s.currentHullHp+'/'+s.maximumHullHp+' HP':''}</strong>${window.SAHealthDisplay.hull(s,bridge.mode()==='gm')}${window.SAHealthDisplay.shields(s,bridge.mode()==='gm')}</div>`;
      }).join('');
      if(fleet!==lastFleet){form.querySelector('[data-fleet]').innerHTML=fleet;lastFleet=fleet;}
      const log=(state.log||[]).slice(-25).reverse().map(e=>`<p><time>${esc(e.at)}</time>${window.SAHealthDisplay.logMarkup(e,bridge.mode()==='gm')}</p>`).join('');
      if(log!==lastLog){form.querySelector('[data-activity]').innerHTML=log;lastLog=log;}
      if(!compact){const rings=bridge.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(form.querySelector('[data-rings]'),rings);lastRings=rings;}}
      window.SASpaceMap.update(svg.parentElement,state.starships,state.shipPositions,{navigation:true});
      if(!marker.isConnected)svg.append(marker);
      for(const g of svg.querySelectorAll('[data-space-missile]')){const ship=state.starships.find(s=>s.id===g.dataset.spaceMissile);g.querySelector('[data-missile-heading]')?.setAttribute('transform',`rotate(${Number(ship?.missileHeading)||0})`);}
      marker.classList.toggle('locked',locked);
      const pixel=svg.viewBox.baseVal.width/Math.max(1,svg.clientWidth);
      // Shared map presentation owns marker sizes; zoom must not resize planets or shields.
      for(const g of svg.querySelectorAll('[data-space-ship]:not([data-space-object])'))g.querySelector('text')?.setAttribute('y',-18*pixel);
      window.SASpaceMap.coverViewport(svg);
      window.SASpaceMap.sensorRange(svg,start,window.SAShipMap.sensorStats(seat.ship).range);
      const a=xy(start),b=destination&&xy(destination),scale=3*pixel;
      const drift=window.SAShipNavigation.driftDistance(length),end=b&&length?{x:b.x+(b.x-a.x)*drift/length,y:b.y+(b.y-a.y)*drift/length}:b;
      const nextMarker=b?`<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="#75ffc4" stroke-width="${scale}"/><circle cx="${b.x}" cy="${b.y}" r="${scale*2}" fill="#07120e" stroke="#75ffc4" stroke-width="${scale}"/><path d="M${b.x} ${b.y} L${end.x} ${end.y}" stroke="#ffe191" stroke-dasharray="${scale*3} ${scale*2}" stroke-width="${scale}"/><circle cx="${end.x}" cy="${end.y}" r="${scale*2}" fill="none" stroke="#ffe191" stroke-width="${scale}"/>`:'';
      if(nextMarker!==lastMarker){marker.innerHTML=nextMarker;lastMarker=nextMarker;}
    }
    function select(event,lock){
      if(submitting||!planning||q.disabled||(!lock&&locked))return;
      const p=new host.defaultView.DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const rawQ=Math.sqrt(3)/3*p.x-p.y/3,rawR=2*p.y/3;let x=Math.round(rawQ),z=Math.round(rawR),y=Math.round(-rawQ-rawR);
      const dx=Math.abs(x-rawQ),dz=Math.abs(z-rawR),dy=Math.abs(y+rawQ+rawR);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;
      if(Math.abs(x)>10000||Math.abs(z)>10000)return;destination={q:x,r:z};locked=lock;q.value=x;r.value=z;error.textContent='';redraw();
    }
    svg.addEventListener('click',e=>select(e,true));
    svg.addEventListener('pointermove',e=>select(e,false));
    form.querySelector('.pilot-chart').addEventListener('pointerleave',()=>{if(!locked&&!submitting){destination=null;q.value='';r.value='';redraw();}});
    form.querySelector('[data-boosts]').addEventListener('click',e=>{
      const box=e.target.closest('input[name=boost]');
      if(box?.dataset.unaffordable==='true'){e.preventDefault();auWarningUntil=performance.now()+2200;dialog.dataset.auWarning='true';auWarning.textContent='not enough Auxiliary power';}
    });
    form.addEventListener('input',e=>{if([q,r].includes(e.target)){locked=true;destination=q.value!==''&&r.value!==''&&q.validity.valid&&r.validity.valid?{q:Number(q.value),r:Number(r.value)}:null;}error.textContent='';redraw();});
    for(const control of form.querySelectorAll('[data-zoom]'))control.onclick=()=>{svg.dataset.manualCamera='true';auto.setAttribute('aria-pressed','false');window.SASpaceMap.zoom(svg,Number(control.dataset.zoom));redraw();};
    form.onsubmit=async e=>{e.preventDefault();redraw();if(submit.disabled)return;const pilot=bridge.state().units.find(u=>u.id===pilotId);if(!bridge.confirmGmPlayerAction(pilot,'moveStarship'))return;const order={action:'playerCombatAction',id:pilotId,kind:'moveStarship',sicId:pilotSicId,destination:{...destination},boostIds:[...form.querySelectorAll('[name=boost]:checked')].map(b=>b.value),trigger:window.SAShipCommandUI.conditionalPayload(dialog)};submitting=true;redraw();try{await bridge.action(order,'resolve',{throwOnError:true});locked=false;destination=null;planning=false;q.value='';r.value='';}catch(err){error.textContent=err.message;}finally{submitting=false;if(dialog.isConnected)redraw();}};
    const rememberDismissal=()=>remember(bridge.state().units.find(u=>u.id===pilotId));
    form.querySelector('[data-leave]').onclick=()=>{const pilot=bridge.state().units.find(u=>u.id===pilotId);if(!bridge.confirmGmPlayerAction(pilot,'leaveStation'))return;dialog.close();window.SACombatMap.openMove(pilot);};
    form.querySelector('[data-close]').onclick=()=>{rememberDismissal();dialog.close();};
    form.querySelector('[data-sound]').onclick=()=>{bridge.toggleSound();redraw();};
    hold.onclick=async()=>{if(submitting)return;submitting=true;try{await toggleHold(bridge.state().units.find(u=>u.id===pilotId));}catch(err){error.textContent=err.message;}finally{submitting=false;redraw();}};
    dialog.addEventListener('pointerdown',bridge.resumeAudio,{passive:true});
    dialog.addEventListener('keydown',bridge.resumeAudio);
    dialog.addEventListener('cancel',event=>{if(!event.defaultPrevented)rememberDismissal();});
    dialog.addEventListener('mapfocuschange',()=>{requestAnimationFrame(()=>{resizeMap();if(!svg.dataset.manualCamera)fitVisible();redraw();});});
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);mapObserver.disconnect();chargeSound?.stop();chargeSound=null;window.removeEventListener('pagehide',cleanup);dialog.remove();activeDialog=null;setTimeout(()=>bridge.requestRender(),0);};
    dialog.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();requestAnimationFrame(()=>{fitVisible();redraw();});
  }
  function sync(unit){
    const bridge=window.SACombatBridge;
    if(!unit||bridge.mode()!=='player'||unit.id!==bridge.myUnitId()||window.SACombatMap?.isInlineMoveSelecting()||unit?.timedAction?.kind==='move')return;
    let owner=window;try{while(owner.frameElement){if(!owner.frameElement.getClientRects().length)return;owner=owner.parent;}}catch{return;}
    if(owner.document.querySelector('dialog[open]'))return;
    if(['awaitingRoll','rolling','result','firing'].includes(bridge.state()?.planetaryEvent?.phase))return;
    if(window.SAStationAccess.consoles(bridge.state(),unit).length&&rememberedView(seatKey(unit))==='console'&&!combatViews.has(seatKey(unit)))open(unit);
  }
  const previousSeats=new Map();
  const observe=state=>{
    for(const unit of state.units||[]){
      const key=seatKey(unit),loc=unit.location,seat=loc?.stationed?`${loc.starshipId}:${loc.sicId}:${loc.square}:${loc.mesh}`:null;
      if(previousSeats.has(key)&&previousSeats.get(key)!==seat){
        selectedConsoles.delete(key);combatViews.delete(key);
        try{sessionStorage.removeItem('sa-console:'+key);sessionStorage.removeItem('sa-console-view:'+key);}catch{}
      }
      previousSeats.set(key,seat);
    }
    for(const key of combatViews){if(!state.units.some(unit=>seatKey(unit)===key&&window.SAStationAccess.consoles(state,unit).length)){combatViews.delete(key);selectedConsoles.delete(key);}}
    // State updates continue when the ordinary action panel is hidden between turns.
    queueMicrotask(()=>{const bridge=window.SACombatBridge;if(bridge?.mode()==='player')sync(bridge.state()?.units.find(unit=>unit.id===bridge.myUnitId()));});
  };
  function openAction(unit,sicId,selector,tab){
    if(selector==='[data-hack]'){window.SAHackingConsoleUI.open(unit,sicId);return;}
    if(selector==='[data-move-ship]'){open(unit,{compact:true,sicId});return;}
    if(selector==='[data-command="evade"]'){void window.SACombatOrderUI.evade(unit);return;}
    selectedConsoles.set(seatKey(unit),sicId);open(unit);
    let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}
    const view=doc.querySelector('dialog[data-operator-id="'+CSS.escape(unit.id)+'"]');if(!view)return;
    if(tab){view.querySelector('[data-command-page]')?.click();[...view.querySelectorAll('.command-tabs button')].find(b=>b.textContent===tab)?.click();}
    if(view.classList.contains('lock-console')){const name=selector==='[data-break]'?'Incoming':selector==='[data-sic]'?'Component':'Ship';[...view.querySelectorAll('.lock-mode-tabs button')].find(b=>b.textContent===name)?.click();}
    remember(unit);window.SACombatOrderUI.prepare(view,unit,selector,tab);
  }
  function toggle(unit){let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}const view=doc.querySelector('dialog[open][data-operator-id="'+CSS.escape(unit.id)+'"]');if(view){remember(unit);view.close();}else open(unit);}
  // Re-entering a tab need not produce a new combat state (especially while paused).
  let consoleButton=null;
  function restoreView(){
    const b=window.SACombatBridge,state=b?.state();if(!state)return;
    const unit=b.mode()==='gm'?(state.units?.find(u=>u.id===state.activeId&&u.team!=='pc'&&window.SAStationAccess.consoles(state,u).length)||state.units?.find(u=>u.team!=='pc'&&window.SAStationAccess.consoles(state,u).length)):state.units?.find(u=>u.id===b.myUnitId());
    let doc=document,owner=window,visible=true;
    try{while(owner.frameElement){if(!owner.frameElement.getClientRects().length)visible=false;doc=owner.parent.document;owner=owner.parent;}}catch{visible=false;}
    if(!consoleButton){
      consoleButton=doc.createElement('button');consoleButton.type='button';consoleButton.textContent='Console View';consoleButton.dataset.consoleView='';
      const goldId='console-gold-'+crypto.randomUUID();
      consoleButton.innerHTML=`<svg aria-hidden="true" viewBox="0 0 300 64" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><defs><linearGradient id="${goldId}" x2="0" y2="1"><stop stop-color="#fff1a0"/><stop offset=".55" stop-color="#eac145"/><stop offset="1" stop-color="#be8919"/></linearGradient></defs><path d="M1 64 L38 10 Q43 1 54 1 H246 Q257 1 262 10 L299 64Z" fill="url(#${goldId})" stroke="#fff1a2" stroke-width="2"/></svg><span style="position:relative;pointer-events:none">Console View</span>`;
      consoleButton.style.cssText='position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:10000;width:300px;max-width:90vw;min-width:0;height:64px;padding:12px 36px 8px;border:0;border-radius:0;background:transparent;color:#201500;font:900 20px Arial;box-shadow:none;filter:drop-shadow(0 -3px 8px #e9b93470);cursor:pointer';
      consoleButton.onclick=()=>{const candidates=b.state()?.units.filter(u=>b.mode()==='gm'?u.team!=='pc'&&window.SAStationAccess.consoles(b.state(),u).length:u.id===b.myUnitId())||[];if(candidates.length===1)open(candidates[0]);else if(candidates.length){const picker=doc.createElement('dialog');picker.innerHTML='<h2>Choose NPC Console</h2>';for(const person of candidates){const choice=doc.createElement('button');choice.textContent=person.characterName;choice.onclick=()=>{picker.close();picker.remove();open(person);};picker.append(choice);}const close=doc.createElement('button');close.textContent='Close';close.onclick=()=>{picker.close();picker.remove();};picker.append(close);doc.body.append(picker);picker.showModal();}};doc.body.append(consoleButton);
    }
    consoleButton.hidden=!visible||!['player','gm'].includes(b.mode())||window.SACombatMap?.isInlineMoveSelecting()||!unit||!window.SAStationAccess.consoles(state,unit).length||Boolean(doc.querySelector('dialog[open]'));
    if(visible)sync(unit);
  }
  window.addEventListener('sa-combat-state',restoreView);
  document.addEventListener('visibilitychange',restoreView);
  requestAnimationFrame(restoreView);
  const restoreTimer=setInterval(restoreView,150);
  window.addEventListener('pagehide',()=>{clearInterval(restoreTimer);consoleButton?.remove();},{once:true});
  window.SAShipNavigationUI={toggle,open,sync,observe,toggleHold,mountSelector,remember,openAction};
}());
