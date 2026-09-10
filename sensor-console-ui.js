(function() {
  let dialog = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(unit,sicId) {
    if (dialog) return;
    const bridge = window.SACombatBridge, initial = window.SAStationAccess.access(bridge.state(),unit,sicId);
    if (!initial || initial.kind !== 'sensor') return;
    let host = document;
    try { while (host.defaultView.frameElement) host = host.defaultView.parent.document; } catch {}
    if (!host.querySelector('link[data-sensor-style]')) {
      const style = host.createElement('link');style.rel='stylesheet';style.href=new URL('sensor-console-ui.css',location.href).href;style.dataset.sensorStyle='';host.head.append(style);
    }
    const view = host.createElement('dialog');dialog=view;view.className='sensor-console';view.setAttribute('aria-label','Sensor console');
    view.innerHTML=`<header><div><small>REMOTE SENSOR LINK / ${esc(unit.characterName)}</small><h2>${esc(initial.ship.title)}</h2></div><div class="sensor-command"><strong data-turn role="status"></strong><progress data-command max="1" value="0" aria-label="Command window"></progress></div><div data-selector><button type="button" data-sound aria-label="Toggle sound">${bridge.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header>
      <main><section class="sensor-chart"><h3>Contact Plot <small data-range></small></h3><div data-map></div><div class="sensor-coordinates"><label>Hex Q<input data-q type="number" step="1" min="-10000" max="10000" value="0"></label><label>Hex R<input data-r type="number" step="1" min="-10000" max="10000" value="0"></label><output data-destination></output></div><div class="sensor-readout"><img src="${initial.item.type}-card.png" alt="${esc(initial.definition.name)}"><div><h3>${esc(initial.definition.name)}</h3><p data-dice></p><div data-factors></div><progress data-input max="100" value="0" aria-label="Sensor input"></progress><p data-input-text></p></div></div></section>
      <section class="sensor-controls"><h3>Operations</h3><button type="button" data-order="area">Scan Area</button><button type="button" data-order="hex">Scan Hex</button><label>Detected Contact<select data-target aria-label="Detected contact"></select></label><button type="button" data-order="analysis">Systems Analysis</button><button type="button" data-order="life">Life Scan</button><button type="button" data-order="share">Share Data</button><p data-error role="alert"></p><div class="sensor-seat-actions"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div></section>
      <section class="sensor-reports"><h3>Intelligence Reports</h3><div data-reports></div></section><section class="sensor-timeline"><div class="pilot-rings" data-rings></div></section></main>`;
    const areaButton = host.createElement('button');
    areaButton.type='button';areaButton.dataset.order='lifeArea';areaButton.textContent='Life Scan: 50-mile Area';
    view.querySelector('[data-order="life"]').after(areaButton);
    const contactInfo=host.createElement('small');contactInfo.dataset.contactInfo='';
    view.querySelector('[data-target]').after(contactInfo);
    host.body.append(view);view.showModal();
    const get = selector => view.querySelector(selector), q=get('[data-q]'),r=get('[data-r]');
    let busy=false,lastMap='',lastTargets='',lastReports='',lastRings='',beat=-1;
    const ownPosition=bridge.state().shipPositions.find(p=>p.id===initial.ship.id);q.value=Math.round(ownPosition?.q||0);r.value=Math.round(ownPosition?.r||0);
    window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());
    function redraw() {
      const state=bridge.state(),person=state.units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(state,person,sicId);
      if (!access || access.seat.key!==initial.seat.key) {view.close();return;}
      const sensor=window.SAShipSensors.installed(access.ship),settings=window.SAShipSensors.inputSettings(access.ship);
      const ready=state.activeId===person.id&&!person.delayedAction&&!person.delayTimer&&!person.timedAction&&!person.consoleHold;
      get('[data-turn]').textContent=person.consoleHold?'HOLDING / 99%':ready?'YOUR TURN':person.delayedAction?.sensorOrder?'SCANNING':'SENSORS ONLINE';
      const command=state.command?.unitId===person.id?state.command:null;
      get('[data-command]').value=command?.total&&!command.expired?command.remaining/command.total:0;
      const alerting=ready&&!state.hardPaused&&!state.holdPaused&&!command?.expired&&!host.hidden,now=Math.floor(performance.now()/1000);
      view.dataset.flash=String(alerting&&performance.now()%1000<450);
      if(alerting&&now!==beat){beat=now;bridge.consoleTick();}
      get('[data-range]').textContent=`${sensor.range} Units`;
      get('[data-dice]').textContent=`${sensor.dice.length}D${sensor.dice[0]} + Sensor Systems ${window.SAShipSensors.skill(person)}`;
      get('[data-factors]').innerHTML=`<span class="pilot-factor">${bridge.delayIcon(settings.factors.Quality)}</span> Signal Quality`;
      get('[data-input]').value=person.delayedAction?.sensorOrder?100-person.delayedAction.remaining:0;
      get('[data-input-text]').textContent=person.delayedAction?.sensorOrder?`${person.delayedAction.label} / ${(person.delayedAction.remaining/person.delayedAction.rate).toFixed(1)} sec`:`Input ${(100/settings.rate).toFixed(1)} sec`;
      // A GM operator uses the same contact picture as that crew; GM overview remains omniscient.
      const picture=window.SAShipSensors.view(state,access.ship.id);
      const mapKey=JSON.stringify([picture.starships.map(s=>[s.id,s.title,s.contactLevel]),picture.shipPositions]);
      if(mapKey!==lastMap){get('[data-map]').innerHTML=window.SASpaceMap.markup(picture.starships,picture.shipPositions,false,{navigation:true});lastMap=mapKey;}
      get('[data-destination]').textContent=`Selected: ${q.value}, ${r.value}`;
      const contacts=Object.values(access.ship.sensorState?.contacts||{}).filter(c=>c.level==='detected');
      const targets=contacts.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
      if(targets!==lastTargets){const previous=get('[data-target]').value;get('[data-target]').innerHTML='<option value="">Choose contact</option>'+targets;get('[data-target]').value=previous;lastTargets=targets;}
      const selectedContact=contacts.find(contact=>contact.id===get('[data-target]').value);
      contactInfo.textContent=selectedContact?[selectedContact.nature,`${selectedContact.size} hull squares`,selectedContact.faction].filter(Boolean).join(' / '):'';
      for(const button of view.querySelectorAll('[data-order]'))button.disabled=busy||!ready||(['analysis','life','share'].includes(button.dataset.order)&&!get('[data-target]').value);
      get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-hold]').disabled=busy||(!person.consoleHold&&!ready);
      get('[data-leave]').disabled=busy||!ready;
      const reports=(access.ship.sensorState?.reports||[]).map(entry=>`<article><time>${esc(new Date(entry.at).toLocaleTimeString())}</time><p>${esc(entry.text)}</p>${entry.values?`<small>Dice ${entry.values.join(' / ')} | Total ${entry.total}</small>`:''}${entry.analysis?`<div>${window.SAHealthDisplay.track('hull',entry.hull.current,entry.hull.maximum,true)}${window.SAHealthDisplay.track('shield',entry.shield.current,entry.shield.maximum,true)}</div><small>Snapshot at scan completion</small><ul>${entry.components.map(c=>`<li>${esc(c.name)}</li>`).join('')}</ul>`:''}${entry.pending&&bridge.mode()==='gm'?`<button type="button" data-reading="${esc(entry.at)}">Enter Biological Reading</button>`:''}${entry.sharedBy?`<small>Shared by ${esc(entry.sharedBy)}</small>`:''}</article>`).join('')||'<p>No completed scans.</p>';
      if(reports!==lastReports){get('[data-reports]').innerHTML=reports;lastReports=reports;}
      const rings=bridge.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(get('[data-rings]'),rings);lastRings=rings;}
    }
    get('[data-map]').onclick=event=>{
      const svg=event.target.closest('[data-space-canvas]');if(!svg)return;
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const fq=Math.sqrt(3)/3*p.x-p.y/3,fr=2*p.y/3;let x=Math.round(fq),z=Math.round(fr),y=Math.round(-fq-fr);
      if(Math.abs(x-fq)>Math.abs(y+fq+fr)&&Math.abs(x-fq)>Math.abs(z-fr))x=-y-z;else if(Math.abs(z-fr)>Math.abs(y+fq+fr))z=-x-y;
      q.value=x;r.value=z;redraw();
    };
    view.onchange=redraw;
    view.addEventListener('click',async event=>{
      const order=event.target.closest('[data-order]'),reading=event.target.closest('[data-reading]');
      if ((!order&&!reading)||busy||order?.disabled)return;
      const person=bridge.state().units.find(u=>u.id===unit.id);
      if(order&&!bridge.confirmGmPlayerAction(person,'sensorCommand'))return;
      let payload;
      if(reading){const text=host.defaultView.prompt('Approximate biological life reading (artificial life is excluded):');if(!text)return;payload={action:'sensorLifeReading',starshipId:initial.ship.id,reportAt:reading.dataset.reading,reading:text};}
      else {if(order.dataset.order==='share'&&!host.defaultView.confirm('Transmit your current sensor intelligence to the selected ship?'))return;
        const area = order.dataset.order==='lifeArea' ? host.defaultView.prompt('Center of the 50-mile scan (place or coordinates for the GM):') : '';
        if(order.dataset.order==='lifeArea'&&!area?.trim())return;
        payload={action:'sensorCommand',id:unit.id,sicId,kind:order.dataset.order,targetId:get('[data-target]').value,area,hex:{q:Number(q.value),r:Number(r.value)},requestId:crypto.randomUUID()};}
      busy=true;get('[data-error]').textContent='';redraw();
      try{await bridge.action(payload,'resolve',{throwOnError:true});}catch(error){get('[data-error]').textContent=error.message;}finally{busy=false;if(view.isConnected)redraw();}
    });
    const dismiss=()=>window.SAShipNavigationUI.remember(bridge.state().units.find(u=>u.id===unit.id));
    get('[data-close]').onclick=()=>{dismiss();view.close();};
    get('[data-sound]').onclick=()=>bridge.toggleSound();
    get('[data-leave]').onclick=()=>{const person=bridge.state().units.find(u=>u.id===unit.id);if(!bridge.confirmGmPlayerAction(person,'leaveStation'))return;dismiss();view.close();window.SACombatMap.openMove(person);};
    get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(bridge.state().units.find(u=>u.id===unit.id));}catch(error){get('[data-error]').textContent=error.message;}};
    view.addEventListener('cancel',dismiss);view.addEventListener('pointerdown',bridge.resumeAudio,{passive:true});
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);view.remove();dialog=null;window.removeEventListener('pagehide',cleanup);setTimeout(()=>bridge.requestRender(),0);};
    view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  window.SASensorConsoleUI={open,isOpen:()=>Boolean(dialog)};
}());
