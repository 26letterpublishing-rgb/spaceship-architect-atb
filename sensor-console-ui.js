(function() {
  let dialog = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function shipContacts(ship){return Object.values(ship.sensorState?.contacts||{}).filter(c=>c.level==='detected'&&!c.isMissile&&!c.isDrone&&!c.isProbe&&!['Probe','Repair Drone','Missile'].includes(c.nature));}
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
    view.dataset.operatorId=unit.id;view.dataset.sicId=sicId;
    view.innerHTML=`<header><div><small>REMOTE SENSOR LINK / ${esc(unit.characterName)}</small><h2>${esc(initial.ship.title)}</h2></div><div class="sensor-command"><strong data-turn role="status"></strong><progress data-command max="1" value="0" aria-label="Command window"></progress></div><div data-selector><button type="button" data-sound aria-label="Toggle sound">${bridge.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header>
      <main><section class="sensor-chart"><h3>Contact Plot <small data-range></small></h3><div data-map></div><div class="sensor-coordinates"><label>Hex Q<input data-q type="number" step="1" min="-10000" max="10000" value="0"></label><label>Hex R<input data-r type="number" step="1" min="-10000" max="10000" value="0"></label><output data-destination></output></div><div data-scan-planner hidden><strong data-scan-hint></strong><button type="button" data-confirm-scan disabled>Confirm Scan</button><button type="button" data-cancel-scan>Cancel Scan</button></div><div class="sensor-readout"><img src="${initial.item.type}-card.png" alt="${esc(initial.definition.name)}"><div><h3>${esc(initial.definition.name)}</h3><p data-dice></p><div data-factors></div><progress data-input max="100" value="0" aria-label="Sensor input"></progress><p data-input-text></p></div></div></section>
      <section class="sensor-controls"><h3>Operations</h3><button type="button" data-order="area">Scan Area</button><button type="button" data-order="hex">Scan Hex</button><label>Detected Starship<select data-target aria-label="Detected contact"></select></label><button type="button" data-order="analysis">Systems Analysis</button><button type="button" data-order="life">Life Scan</button><button type="button" data-order="share">Share Data</button><p data-error role="alert"></p><div class="sensor-seat-actions"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div></section>
      <section class="sensor-reports"><h3>Intelligence Reports</h3><div data-reports></div></section><section class="sensor-timeline"><div class="pilot-rings" data-rings></div></section></main>`;
    view.querySelectorAll('[data-order]').forEach(button=>window.SAActionHelp.attach(button,button.dataset.order));
    const recipients=host.createElement('fieldset');recipients.className='sensor-share-recipients';recipients.innerHTML='<legend>Share Recipients</legend><div data-recipients></div>';
    view.querySelector('[data-order="share"]').before(recipients);
    view.querySelectorAll('[data-order]').forEach(button=>{
      const help=button.nextElementSibling,row=host.createElement('div');row.className='sensor-action-row';button.before(row);row.append(button);if(help?.dataset.actionHelp)row.append(help);
    });
    const contactInfo=host.createElement('small');contactInfo.dataset.contactInfo='';
    view.querySelector('[data-target]').after(contactInfo);
    view.querySelector('.sensor-seat-actions').before(window.SAShipCommandUI.conditionalControls(host));
    host.body.append(view);view.showModal();
    const get = selector => view.querySelector(selector), q=get('[data-q]'),r=get('[data-r]');
    get('.sensor-controls h3').after(get('[data-scan-planner]'));
    for(const [input,label] of [[q,'Column (Q)'],[r,'Row (R)']]){
      input.parentElement.firstChild.textContent=label;
      input.title='Hex map coordinates. Selecting a hex on the contact plot fills these values automatically.';
    }
    const zoom=host.createElement('div');zoom.className='sensor-map-zoom';
    zoom.innerHTML='<button type="button" data-zoom="out" aria-label="Zoom out">-</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-auto-zoom>Fit Contacts</button><button type="button" data-map-focus>Enlarge Map</button>';
    const mapTools=host.createElement('div');mapTools.className='sensor-map-tools';get('[data-map]').after(mapTools);mapTools.append(zoom,get('.sensor-coordinates'));
    let manualViewBox=null,fitAllContacts=false,selecting=null,scanPoint=null,hexSelected=false;
    get('[data-map-focus]').onclick=()=>window.SASpaceMap.focusMap(view,get('[data-map-focus]'));
    zoom.onclick=event=>{
      const svg=get('[data-map] svg[data-space-canvas]');if(!svg)return;
      if(event.target.closest('[data-auto-zoom]')){manualViewBox=null;fitAllContacts=true;lastMap='';redraw();return;}
      const button=event.target.closest('[data-zoom]');if(!button)return;
      window.SASpaceMap.zoom(svg,button.dataset.zoom==='in'?.8:1.25);
      manualViewBox=svg.getAttribute('viewBox');
    };
    let busy=false,lastMap='',lastTargets='',lastReports='',lastRings='',beat=-1;
    const ownPosition=bridge.state().shipPositions.find(p=>p.id===initial.ship.id);q.value=Math.round(ownPosition?.q||0);r.value=Math.round(ownPosition?.r||0);
    window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());
    function redraw() {
      const state=bridge.state(),person=state.units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(state,person,sicId);
      if (!access || access.seat.key!==initial.seat.key) {view.close();return;}
      const sensor=window.SAShipSensors.installed(access.ship),settings=window.SAShipSensors.inputSettings(access.ship);
      const ready=state.activeId===person.id&&!person.delayedAction&&!person.delayTimer&&!person.timedAction&&!person.consoleHold;
get('[data-turn]').textContent=person.consoleHold?'HOLDING / 99%':person.delayedAction?.awaitingRoll?'ROLL REQUIRED':ready?'YOUR TURN':person.delayedAction?.sensorOrder?'SCANNING':window.SAConsoleCommon.standby(state,person);
      const command=state.command?.unitId===person.id?state.command:null;
      get('[data-command]').value=command?.total&&!command.expired?command.remaining/command.total:0;
      const alerting=ready&&!state.hardPaused&&!state.holdPaused&&!command?.expired&&!host.hidden,now=Math.floor(performance.now()/1000);
      view.dataset.flash=String(alerting&&performance.now()%1000<450);
      if(alerting&&now!==beat){beat=now;bridge.consoleTick();}
      const pulse=access.ship.sensorState?.pulse;
      get('[data-range]').textContent=pulse?.remaining>0?`Scan pulse ${window.SAShipSensors.pulseRange(access.ship)} Units / ${pulse.remaining.toFixed(1)} sec remaining`:`Sensor range ${sensor.range} Units / Scan Area pulse ${sensor.range*1.5} Units`;
      get('[data-order=area]').title='Scan at +50% range for two active ATB seconds after input. Input timing uses successful detections; each contact checks against its Masking.';
      get('[data-range]').title=`Passive sweep every 12 active ATB seconds. Chance ${Math.min(4,1+(access.ship.sensorState?.sweep?.bonus||0))} in 4.`;
      get('[data-dice]').textContent=`${[...new Set(sensor.dice)].map(d=>sensor.dice.filter(n=>n===d).length+'D'+d).join(' + ')} + Sensor Systems ${window.SAShipSensors.skill(person)}`;
      get('[data-factors]').innerHTML=`<span class="pilot-factor">${bridge.delayIcon(settings.factors.Quality)}</span> Signal Quality`;
      get('[data-input]').value=person.delayedAction?.sensorOrder?100-person.delayedAction.remaining:0;
      get('[data-input-text]').textContent=person.delayedAction?.awaitingRoll?'Roll required':person.delayedAction?.sensorOrder?`${person.delayedAction.label} / ${(person.delayedAction.remaining/person.delayedAction.rate).toFixed(1)} sec`:`Input ${(100/settings.rate).toFixed(1)} sec`;
      // A GM operator uses the same contact picture as that crew; GM overview remains omniscient.
      const picture=window.SAShipSensors.view(state,access.ship.id);
      const mapKey=JSON.stringify([picture.starships.map(s=>[s.id,s.title,s.contactLevel,s.destroyedAt,s.missileHeading,s.missilePhase,s.missileEndedAt]),picture.shipPositions,bridge.state().spaceObjects]);
      if(mapKey!==lastMap){get('[data-map]').innerHTML=window.SASpaceMap.markup(picture.starships,picture.shipPositions,false,{navigation:true});if(manualViewBox)get('[data-map] svg[data-space-canvas]')?.setAttribute('viewBox',manualViewBox);else if(fitAllContacts)window.SASpaceMap.fitRendered(get('[data-map] svg[data-space-canvas]'));else window.SASpaceMap.fitContacts(get('[data-map] svg[data-space-canvas]'),[...picture.starships,...(selecting&&scanPoint?[{id:'sensor-selected-hex'}]:[])],[...picture.shipPositions,...(selecting&&scanPoint?[{id:'sensor-selected-hex',...scanPoint}]:[])]);lastMap=mapKey;}
      const mapSvg=get('[data-map] svg[data-space-canvas]');if(mapSvg&&manualViewBox)for(const rect of mapSvg.querySelectorAll(':scope > rect'))for(const key of ['x','y','width','height'])rect.setAttribute(key,mapSvg.viewBox.baseVal[key]);
      renderScanPlot(state,access.ship,sensor.range,ready);
      const contacts=shipContacts(access.ship);
      window.SAShipCommandUI.refreshConditional(view,contacts);
      const targets=contacts.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
      if(targets!==lastTargets){const previous=get('[data-target]').value;get('[data-target]').innerHTML=targets||'<option value="">No detected starships</option>';get('[data-target]').value=contacts.some(c=>c.id===previous)?previous:contacts[0]?.id||'';
        const chosen=[...view.querySelectorAll('[data-recipient]:checked')].map(i=>i.value);
        get('[data-recipients]').innerHTML=contacts.map(c=>`<label><input type="checkbox" data-recipient value="${esc(c.id)}" ${chosen.includes(c.id)?'checked':''}>${esc(c.title)}</label>`).join('');lastTargets=targets;}
      const selectedContact=contacts.find(contact=>contact.id===get('[data-target]').value);
      for(const kind of ['area','hex','analysis']){
        const button=get(`[data-order="${kind}"]`),info=window.SAShipSensors.difficulty(state,access.ship.id,kind,selectedContact?.id,{q:Number(q.value),r:Number(r.value)});
        let note=view.querySelector(`[data-difficulty="${kind}"]`);if(!note){note=host.createElement('small');note.dataset.difficulty=kind;button.parentElement.after(note);}note.textContent=info.label;
      }
      contactInfo.textContent=selectedContact?[selectedContact.nature,`${selectedContact.size} hull squares`,selectedContact.faction].filter(Boolean).join(' / '):'';
      for(const button of view.querySelectorAll('[data-order]'))button.disabled=busy||!ready||(button.dataset.order==='analysis'&&!get('[data-target]').value)||(button.dataset.order==='share'&&!get('[data-target]').value&&!view.querySelector('[data-recipient]:checked'));
      get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-hold]').disabled=busy||(!person.consoleHold&&!ready);
      get('[data-leave]').disabled=busy||!ready;
      const processing=(person.queuedEffects||[]).filter(e=>e.sensorReport).map(e=>`<article><p>Systems Analysis processing</p><strong>${Math.max(0,(100-e.progress)/e.rate).toFixed(1)} sec remaining</strong><progress max="100" value="${e.progress}"></progress></article>`).join('');
      const reports=processing+(access.ship.sensorState?.reports||[]).map(entry=>`<article><time>${esc(new Date(entry.at).toLocaleTimeString())}</time><p>${window.SAHealthDisplay.logMarkup(entry,true)}</p>${entry.values?.length?`<small>Dice ${entry.values.join(' / ')} | Total ${entry.total}</small>`:''}${entry.analysis?`<div>${window.SAHealthDisplay.track('hull',entry.hull.current,entry.hull.maximum,true)}${window.SAHealthDisplay.track('shield',entry.shield.current,entry.shield.maximum,true)}</div><small>Snapshot at scan completion</small><ul>${entry.components.map(c=>`<li>${esc(c.name)}</li>`).join('')}</ul>`:''}${entry.pending&&bridge.mode()==='gm'?`<button type="button" data-reading="${esc(entry.at)}">Enter Biological Reading</button>`:''}${entry.sharedBy?`<small>Shared by ${esc(entry.sharedBy)}</small>`:''}</article>`).join('')||'<p>No completed scans.</p>';
      if(reports!==lastReports){get('[data-reports]').innerHTML=reports;lastReports=reports;
        [...get('[data-reports]').children].forEach((article,index)=>{const entry=access.ship.sensorState?.reports?.[index];article.classList.toggle('sensor-detection-alert',Boolean(entry?.detected&&Date.now()-Date.parse(entry.at)<30000));});
      }
      const rings=bridge.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(get('[data-rings]'),rings);lastRings=rings;}
    }
    function mapHex(event){
      const svg=event.target.closest('svg[data-space-canvas]');if(!svg)return null;
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const fq=Math.sqrt(3)/3*p.x-p.y/3,fr=2*p.y/3;let x=Math.round(fq),z=Math.round(fr),y=Math.round(-fq-fr);
      if(Math.abs(x-fq)>Math.abs(y+fq+fr)&&Math.abs(x-fq)>Math.abs(z-fr))x=-y-z;else if(Math.abs(z-fr)>Math.abs(y+fq+fr))z=-x-y;
      return {q:x,r:z};
    }
    function renderScanPlot(state,ship,range,ready){
      const svg=get('[data-map] svg[data-space-canvas]'),origin=window.SAShipTargets.point(state,ship.id);
      const validCoordinates=q.value.trim()!==''&&r.value.trim()!==''&&[Number(q.value),Number(r.value)].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000);
      const target=scanPoint||{q:Number(q.value),r:Number(r.value)},outside=origin&&window.SAShipDistances.hexDistance(origin,target)>range;
      get('[data-scan-planner]').hidden=!selecting;
      get('[data-confirm-scan]').disabled=busy||!ready||!hexSelected;
      get('[data-confirm-scan]').textContent=selecting?.dataset.order==='life'?'Confirm Life Scan':'Confirm Hex Scan';
      get('[data-scan-hint]').textContent=hexSelected?'Selected hex and its six neighbors will be scanned.':'Point at a hex to preview its seven-hex scan area, then click to select.';
      get('[data-destination]').textContent=!validCoordinates?'Enter whole-number coordinates between −10000 and 10000.':`${selecting&&!hexSelected?'Preview':'Selected'}: ${target.q}, ${target.r}`+(outside?' / Unit outside of sensor range. Scan results may fail. (+5 difficulty)':'');
      if(!svg)return;
      svg.querySelectorAll('[data-sensor-range],[data-scan-preview]').forEach(node=>node.remove());
      if(!selecting||!origin)return;
      const circle=host.createElementNS(svg.namespaceURI,'circle');circle.dataset.sensorRange='';
      for(const [key,value] of Object.entries({cx:Math.sqrt(3)*(origin.q+origin.r/2),cy:1.5*origin.r,r:range*Math.sqrt(3),fill:'#68dcdb08',stroke:'#68dcdb','stroke-opacity':'.4','stroke-width':'.08'}))circle.setAttribute(key,value);
      circle.style.pointerEvents='none';svg.append(circle);
      if(!scanPoint)return;
      const group=host.createElementNS(svg.namespaceURI,'g');group.dataset.scanPreview=hexSelected?'selected':'preview';group.style.pointerEvents='none';
      for(const [dq,dr] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){
        const x=Math.sqrt(3)*(target.q+dq+(target.r+dr)/2),y=1.5*(target.r+dr),cell=host.createElementNS(svg.namespaceURI,'polygon');
        cell.setAttribute('points',Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return `${x+Math.cos(angle)},${y+Math.sin(angle)}`;}).join(' '));
        cell.setAttribute('fill',outside?'#ff875f24':'#ffdf6f25');cell.setAttribute('stroke',outside?'#ffa278':'#ffe397');cell.setAttribute('stroke-width',dq===0&&dr===0?'2.5':'1.2');cell.setAttribute('vector-effect','non-scaling-stroke');group.append(cell);
      }
      svg.append(group);
    }
    function selectScanHex(point,locked){scanPoint=point;hexSelected=locked;q.value=point.q;r.value=point.r;redraw();}
    get('[data-map]').onpointermove=event=>{if(!selecting||hexSelected)return;const point=mapHex(event);if(point)selectScanHex(point,false);};
    get('[data-map]').onclick=event=>{const point=mapHex(event);if(point)selectScanHex(point,Boolean(selecting));};
    get('[data-confirm-scan]').onclick=()=>{if(!get('[data-confirm-scan]').disabled)selecting?.click();};
    get('[data-cancel-scan]').onclick=()=>{selecting=null;scanPoint=null;hexSelected=false;view.dataset.selectHex='false';get('[data-map]').style.cursor='';get('[data-error]').textContent='';redraw();};
    function updateCoordinates(event){
      if(selecting&&event.target.matches('[data-q],[data-r]')){
        const point={q:Number(q.value),r:Number(r.value)},valid=q.value.trim()!==''&&r.value.trim()!==''&&[point.q,point.r].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000);
        scanPoint=valid?point:null;hexSelected=valid;if(!manualViewBox)lastMap='';
      }
      redraw();
    }
    view.oninput=updateCoordinates;view.onchange=updateCoordinates;
    view.addEventListener('mapfocuschange',()=>{if(!manualViewBox){lastMap='';redraw();}});
    view.addEventListener('click',async event=>{
      const order=event.target.closest('[data-order]'),reading=event.target.closest('[data-reading]');
      if ((!order&&!reading)||busy||order?.disabled)return;
      if(order&&['hex','life'].includes(order.dataset.order)&&(!hexSelected||selecting!==order)){selecting=order;scanPoint=null;hexSelected=false;view.dataset.selectHex='true';get('[data-error]').textContent='';get('[data-map]').style.cursor='crosshair';redraw();return;}
      const person=bridge.state().units.find(u=>u.id===unit.id);
      if(order&&!bridge.confirmGmPlayerAction(person,'sensorCommand'))return;
      let payload;
      if(reading){const text=host.defaultView.prompt('Approximate biological life reading (artificial life is excluded):');if(!text)return;payload={action:'sensorLifeReading',starshipId:initial.ship.id,reportAt:reading.dataset.reading,reading:text};}
      else {if(order.dataset.order==='share'&&!host.defaultView.confirm('Transmit your current sensor intelligence to the selected recipients?'))return;
        const area = '';
        const targetIds=[...view.querySelectorAll('[data-recipient]:checked')].map(i=>i.value);
        payload={action:'sensorCommand',id:unit.id,sicId,kind:order.dataset.order,targetId:get('[data-target]').value,targetIds:targetIds.length?targetIds:[get('[data-target]').value],area,hex:{q:Number(q.value),r:Number(r.value)},requestId:crypto.randomUUID()};}
      if(order)payload.trigger=window.SAShipCommandUI.conditionalPayload(view);
      busy=true;get('[data-error]').textContent='';redraw();
      try{await bridge.action(payload,'resolve',{throwOnError:true});selecting=null;scanPoint=null;hexSelected=false;view.dataset.selectHex='false';get('[data-map]').style.cursor='';if(view.classList.contains('combat-order-dialog'))view.close();}catch(error){get('[data-error]').textContent=error.message;}finally{busy=false;if(view.isConnected)redraw();}
    });
    const dismiss=()=>window.SAShipNavigationUI.remember(bridge.state().units.find(u=>u.id===unit.id));
    get('[data-close]').onclick=()=>{dismiss();view.close();};
    get('[data-sound]').onclick=()=>bridge.toggleSound();
    get('[data-leave]').onclick=()=>{const person=bridge.state().units.find(u=>u.id===unit.id);if(!bridge.confirmGmPlayerAction(person,'leaveStation'))return;view.close();window.SACombatMap.openMove(person);};
    get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(bridge.state().units.find(u=>u.id===unit.id));}catch(error){get('[data-error]').textContent=error.message;}};
    view.addEventListener('cancel',dismiss);view.addEventListener('pointerdown',bridge.resumeAudio,{passive:true});
    const resize=new ResizeObserver(()=>{if(!manualViewBox){lastMap='';redraw();}});resize.observe(get('[data-map]'));
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);resize.disconnect();view.remove();dialog=null;window.removeEventListener('pagehide',cleanup);setTimeout(()=>bridge.requestRender(),0);};
    view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  window.SASensorConsoleUI={open,isOpen:()=>Boolean(dialog)};
}());
