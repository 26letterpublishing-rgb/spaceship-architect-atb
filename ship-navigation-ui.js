(function(){
  let activeDialog=null;
  const combatViews=new Set();
  const seatKey=unit=>`${window.SACombatBridge.state()?.roomCode}:${unit?.id}:${unit?.location?.starshipId}:${unit?.location?.sicId}`;
  const factorNames={Situation:'Environment',Execution:'Uplink',Quality:'Drive Grade',Performance:'Response',Efficiency:'Throughput',Ingenuity:'Helm Sync'};
  const xy=p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(unit,{compact=false}={}){
    const bridge=window.SACombatBridge, initial=bridge.state(), seated=window.SAShipNavigation.station(initial,unit);
    if(!seated||activeDialog)return;
    const pilotId=unit.id,shipId=seated.ship.id;
    if(!compact)combatViews.delete(seatKey(unit));
    let host=document;try{while(host.defaultView.frameElement)host=host.defaultView.parent.document;}catch{}
    const dialog=host.createElement('dialog');activeDialog=dialog;
    dialog.className=`ship-navigation-dialog${compact?' navigation-planner':''}`;dialog.setAttribute('aria-label',compact?'Move ship':'Pilot console');
    dialog.innerHTML=`<form><header><div><small>HELM / ${esc(unit.characterName)}</small><h2>${esc(seated.ship.title)}</h2></div><span data-pilot-clock></span><button type="button" data-close>Combat View</button></header>
      <section class="pilot-fleet"><h3>Fleet Condition</h3><div data-fleet></div><div class="pilot-telemetry" aria-hidden="true">NAV LINK 07.14<br>PHASE SYNC / NOMINAL<br><i></i>VECTOR LOCK 0A:9F</div></section>
      <section class="pilot-chart"><div class="pilot-chart-title"><h3>Navigation</h3><span data-flight></span></div><div data-navigation-map>${window.SASpaceMap.markup(initial.starships,initial.shipPositions,false,{navigation:true})}</div><div class="navigation-fields"><label>Hex Q<input name="q" type="number" min="-10000" max="10000" step="1" required></label><label>Hex R<input name="r" type="number" min="-10000" max="10000" step="1" required></label><button type="button" data-zoom=".7" aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-zoom="1.4" aria-label="Zoom out" title="Zoom out">&#8722;</button></div></section>
      <section class="pilot-activity"><h3>Combat Activity</h3><div data-activity></div></section>
      <section class="pilot-power"><h3>Action Units</h3><div class="pilot-au" data-au></div><div class="pilot-recharge"><i data-recharge></i></div><fieldset><legend>AU Boosts</legend><div data-boosts></div></fieldset></section>
      <section class="pilot-input"><h3>Command Processor</h3><div data-factors></div><div class="pilot-input-progress"><i data-input-progress></i></div><output data-input-status></output><output data-estimate></output><div class="pilot-rings" data-rings></div></section>
      <footer><p role="alert" data-error></p><p data-availability></p><button type="submit">Move Ship</button><button type="button" data-leave>Leave Console</button></footer></form>`;
    host.body.append(dialog);dialog.showModal();
    const form=dialog.querySelector('form'),svg=dialog.querySelector('svg[data-space-canvas]'),q=form.elements.q,r=form.elements.r,submit=form.querySelector('[type=submit]'),error=form.querySelector('[data-error]');
    const marker=host.createElementNS('http://www.w3.org/2000/svg','g');marker.classList.add('pilot-destination');svg.append(marker);
    let destination=null,locked=false,submitting=false,lastBoosts='',lastFleet='',lastLog='',lastFactors='',lastRings='',lastMarker='';
    // Validate the locked destination ourselves so feedback stays inside the console.
    form.noValidate=true;
    const originalBox=svg.getAttribute('viewBox').split(' ').map(Number);
    function redraw(){
      const state=bridge.state(),pilot=state.units.find(u=>u.id===pilotId),seat=window.SAShipNavigation.station(state,pilot);
      if(!seat||seat.ship.id!==shipId){dialog.close();return;}
      const access=window.SAShipNavigation.access(state,pilot),delay=pilot.delayedAction,available=state.activeId===pilotId&&!delay&&!pilot.delayTimer&&!pilot.timedAction&&!state.delayRequest&&!submitting;
      dialog.dataset.input=delay?.shipOrder?'active':'idle';
      form.querySelector('[data-pilot-clock]').textContent=state.hardPaused?'CLOCK PAUSED':delay?'INPUT ACTIVE':state.activeId===pilotId?(state.command?`COMMAND ${Math.max(0,state.command.remaining).toFixed(1)} SEC`:'TURN READY'):`ATB ${Math.min(100,Math.round(pilot.atb/state.threshold*100))}%`;
      const points=window.SAShipDistances.positions(state.starships,state.shipPositions),start=points.find(p=>p.id===shipId);
      const thrusters=access?.thrusters||[],signature=JSON.stringify(thrusters.map(t=>[t.id,t.type]));
      if(signature!==lastBoosts){
        const checked=new Set([...form.querySelectorAll('[name=boost]:checked')].map(b=>b.value));lastBoosts=signature;
        form.querySelector('[data-boosts]').innerHTML=thrusters.map(t=>{const d=window.SAShipMap.definition(t.type);return `<label><input type="checkbox" name="boost" value="${esc(t.id)}" ${checked.has(t.id)?'checked':''}>${esc(d.name)}<small>+${d.auBoost} / ${d.auCost} AU</small></label>`;}).join('')||'<span>No operational thrusters</span>';
      }
      let cost=0,speed=access?.speed||0;
      for(const box of form.querySelectorAll('[name=boost]')){box.disabled=!available;if(box.checked){const d=window.SAShipMap.definition(thrusters.find(t=>t.id===box.value).type);cost+=d.auCost;speed+=d.auBoost;}}
      const au=seat.ship.auState||{current:0,maximum:0,progress:0},length=destination?window.SAShipDistances.hexDistance(start,destination):0;
      q.disabled=r.disabled=!available;
      submit.disabled=!available||!access||!locked||!destination||speed<=0||length<1e-6||cost>au.current;
      form.querySelector('[data-availability]').textContent=submitting?'Sending order...':delay?'Coordinates are being entered.':state.activeId!==pilotId?'Waiting for your next turn.':!available?'Finish the current action first.':!access?'Operational cockpit, engine and thrusters required.':cost>au.current?`Boosts need ${cost} AU; ${au.current} available.`:speed<=0?'Select an AU boost to provide positive movement speed.':!locked||!destination?'Choose a destination.':length<1e-6?'Choose a different hex.':'Destination locked';
      submit.textContent=submitting?'Submitting...':delay?'Entering Order':'Move Ship';
      form.querySelector('[data-leave]').disabled=!available;
      const settings=delay?.shipOrder?delay.settings:window.SAShipNavigation.inputSettings(state,pilot);
      const factors=Object.entries(factorNames).map(([name,label])=>`<div title="${name}: ${settings.factors[name]} of 4"><span class="pilot-factor" aria-label="${name} ${settings.factors[name]} of 4">${bridge.delayIcon(settings.factors[name])}</span><small>${label}</small></div>`).join('');
      if(factors!==lastFactors){form.querySelector('[data-factors]').innerHTML=factors;lastFactors=factors;}
      form.querySelector('[data-input-progress]').style.width=`${delay?100-delay.remaining:0}%`;
      form.querySelector('[data-input-status]').textContent=delay?`Entering coordinates / ${(delay.remaining/delay.rate).toFixed(1)} sec`:available?`Input delay ${(100/settings.rate).toFixed(1)} sec`:'Awaiting pilot turn';
      form.querySelector('[data-estimate]').textContent=`${speed} Units / 12 sec${destination?` | ${length.toFixed(1)} Units | Travel ${speed?(length*12/speed).toFixed(1):'--'} sec`:''} | Boost ${cost} AU`;
      form.querySelector('[data-au]').innerHTML=`<strong>${au.current}<small> / ${au.maximum}</small></strong><span>${Array.from({length:12},(_,i)=>`<i class="${i<Math.round(12*au.current/Math.max(1,au.maximum))?'charged':''}"></i>`).join('')}</span>`;
      form.querySelector('[data-recharge]').style.width=`${au.current>=au.maximum?100:au.progress}%`;
      const nav=seat.ship.navigation;
      form.querySelector('[data-flight]').textContent=nav&&nav.phase!=='stopped'?`${nav.phase==='drift'?'DRIFT':'UNDERWAY'} / ${nav.speed}`:'HOLDING POSITION';
      const fleet=state.starships.map(s=>{
        const hull=Number(s.maximumHullHp??s.ship?.maximumHullHp??s.ship?.gridCells?.length)||0,shield=Number(s.maximumShieldHp??s.ship?.maximumShieldHp)||0;
        return `<div><strong>${esc(s.title)}</strong>${window.SAHealthDisplay.track('hull',s.currentHullHp??s.ship?.currentHullHp??hull,hull,bridge.mode()==='gm')}${window.SAHealthDisplay.track('shield',s.currentShieldHp??s.ship?.currentShieldHp??shield,shield,bridge.mode()==='gm')}</div>`;
      }).join('');
      if(fleet!==lastFleet){form.querySelector('[data-fleet]').innerHTML=fleet;lastFleet=fleet;}
      const log=(state.log||[]).slice(-25).reverse().map(e=>`<p><time>${esc(e.at)}</time>${esc(window.SAHealthDisplay.logText(e.text,bridge.mode()==='gm'))}</p>`).join('');
      if(log!==lastLog){form.querySelector('[data-activity]').innerHTML=log;lastLog=log;}
      if(!compact){const rings=bridge.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(form.querySelector('[data-rings]'),rings);lastRings=rings;}}
      for(const g of svg.querySelectorAll('g[data-space-ship]')){const p=points.find(p=>p.id===g.dataset.spaceShip);if(p){const c=xy(p);g.setAttribute('transform',`translate(${c.x} ${c.y})`);}}
      marker.classList.toggle('locked',locked);
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
    form.addEventListener('input',e=>{if([q,r].includes(e.target)){locked=true;destination=q.value!==''&&r.value!==''&&q.validity.valid&&r.validity.valid?{q:Number(q.value),r:Number(r.value)}:null;}error.textContent='';redraw();});
    for(const zoom of form.querySelectorAll('[data-zoom]'))zoom.onclick=()=>{const v=svg.viewBox.baseVal,w=Math.max(8,Math.min(80000,v.width*Number(zoom.dataset.zoom))),h=w*originalBox[3]/originalBox[2],x=v.x+(v.width-w)/2,y=v.y+(v.height-h)/2;svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);for(const rect of svg.querySelectorAll(':scope > rect'))for(const [k,val] of Object.entries({x,y,width:w,height:h}))rect.setAttribute(k,val);redraw();};
    form.onsubmit=async e=>{e.preventDefault();redraw();if(submit.disabled)return;const pilot=bridge.state().units.find(u=>u.id===pilotId);if(!bridge.confirmGmPlayerAction(pilot,'moveStarship'))return;const order={action:'playerCombatAction',id:pilotId,kind:'moveStarship',destination:{...destination},boostIds:[...form.querySelectorAll('[name=boost]:checked')].map(b=>b.value)};submitting=true;redraw();try{await bridge.action(order,'resolve',{throwOnError:true});locked=false;}catch(err){error.textContent=err.message;}finally{submitting=false;if(dialog.isConnected)redraw();}};
    const rememberDismissal=()=>{combatViews.add(seatKey(bridge.state().units.find(u=>u.id===pilotId)));};
    form.querySelector('[data-leave]').onclick=()=>{const pilot=bridge.state().units.find(u=>u.id===pilotId);if(!bridge.confirmGmPlayerAction(pilot,'leaveStation'))return;rememberDismissal();dialog.close();window.SACombatMap.openMove(pilot);};
    form.querySelector('[data-close]').onclick=()=>{rememberDismissal();dialog.close();};
    dialog.addEventListener('cancel',rememberDismissal);
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);window.removeEventListener('pagehide',cleanup);dialog.remove();activeDialog=null;setTimeout(()=>bridge.requestRender(),0);};
    dialog.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  function sync(unit){
    const bridge=window.SACombatBridge;
    if(bridge.mode()!=='player'||unit?.id!==bridge.myUnitId())return;
    let owner=window;try{while(owner.frameElement){if(!owner.frameElement.getClientRects().length)return;owner=owner.parent;}}catch{return;}
    if(window.SAShipNavigation.station(bridge.state(),unit)&&!combatViews.has(seatKey(unit)))open(unit);
  }
  const observe=state=>{
    for(const key of combatViews){if(!state.units.some(unit=>seatKey(unit)===key&&window.SAShipNavigation.station(state,unit)))combatViews.delete(key);}
    // State updates continue when the ordinary action panel is hidden between turns.
    queueMicrotask(()=>{const bridge=window.SACombatBridge;if(bridge?.mode()==='player')sync(bridge.state()?.units.find(unit=>unit.id===bridge.myUnitId()));});
  };
  window.SAShipNavigationUI={open,sync,observe};
}());
