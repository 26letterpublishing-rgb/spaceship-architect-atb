(function(){
 let current=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function open(unit,sicId){
  if(current)return;const b=window.SACombatBridge,initial=window.SAStationAccess.access(b.state(),unit,sicId);if(!initial?.definition.probeLauncher)return;
  let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
  for(const name of ['sensor-console-ui.css','probe-console.css'])if(!doc.querySelector(`link[href="${name}"]`)){const link=doc.createElement('link');link.rel='stylesheet';link.href=name;doc.head.append(link);}
  const view=doc.createElement('dialog');current=view;view.className='sensor-console probe-console';view.dataset.operatorId=unit.id;view.dataset.sicId=sicId;view.setAttribute('aria-label','Probe Launcher console');
  view.innerHTML=`<header><div><small>${esc(unit.characterName)} / ${esc(initial.ship.title)}</small><h2>Probe Launcher</h2></div><strong data-turn></strong><div data-selector></div><button data-sound type="button">${b.soundIcon()}</button><button data-close type="button">Combat View</button></header><main><section class="sensor-chart"><h3>Scout Plot <small data-range></small></h3><div data-map></div><div class="sensor-coordinates"><label>Column (Q)<input data-q type="number" min="-10000" max="10000" step="1" disabled></label><label>Row (R)<input data-r type="number" min="-10000" max="10000" step="1" disabled></label><output data-destination></output></div><p data-plot-hint>Choose Launch Probe or Move Probe to plot a destination. Blue: ship link range. Gold: probe sensors.</p><div class="sensor-readout"><img data-art src="probe-launcher.svg" alt="Probe"><div><strong data-spec></strong><p data-status></p><progress data-input max="100" value="0" aria-label="Probe command input"></progress></div></div></section><section class="sensor-controls"><h3>Probe Orders</h3><label>Loaded Probe<select data-probe aria-label="Loaded Probe"></select></label><strong data-cooldown></strong><label data-target-label>Hacking Bug target<select data-target aria-label="Hacking Bug target"></select></label><p data-payload></p>${[['launch','Launch Probe'],['move','Move Probe'],['scan','Scan from Probe'],['return','Retract Probe'],['attach','Attach Bug to Ship'],['bugOn','Activate Bug · 1 AU / round'],['bugOff','Deactivate Bug'],['inhibit','Activate Warp Inhibitor'],['inhibitOff','Deactivate Inhibitor']].map(([id,title])=>`<div><button type="button" data-order="${id}">${title}</button><small data-reason="${id}"></small></div>`).join('')}<div data-planner hidden><button type="button" data-confirm-flight disabled>Confirm Flight</button><button type="button" data-replot>Choose Another Hex</button><button type="button" data-cancel-flight>Cancel Plot</button></div><output data-error role="status"></output><div class="sensor-seat-actions"><button data-hold type="button">Hold</button><button data-leave type="button">Leave Console</button></div></section><section class="sensor-reports"><h3>Probe Reports</h3><div data-reports></div></section><section class="sensor-timeline"><div class="pilot-rings" data-rings></div></section></main>`;
  const get=s=>view.querySelector(s),person=()=>b.state().units.find(u=>u.id===unit.id);let busy=false,lastOptions='',lastMap='',lastReports='',lastRings='',lastTargets=null,planning=null,manualViewBox=null;
  get('.sensor-controls h3').after(get('[data-planner]'));
  const zoom=doc.createElement('div');zoom.className='sensor-map-zoom';zoom.innerHTML='<button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-auto-zoom>Fit Link Range</button><button type="button" data-map-focus>Enlarge Map</button>';const mapTools=doc.createElement('div');mapTools.className='sensor-map-tools';get('[data-map]').after(mapTools);mapTools.append(zoom,get('.sensor-coordinates'));
  get('[data-map-focus]').onclick=()=>window.SASpaceMap.focusMap(view,get('[data-map-focus]'));
  zoom.addEventListener('click',event=>{const svg=get('[data-map] svg[data-space-canvas]');if(!svg)return;if(event.target.closest('[data-auto-zoom]')){manualViewBox=null;lastMap='';redraw();return;}const button=event.target.closest('[data-zoom]');if(!button)return;window.SASpaceMap.zoom(svg,button.dataset.zoom==='in'?.8:1.25);manualViewBox=svg.getAttribute('viewBox');});
  view.addEventListener('mapfocuschange',()=>{if(!manualViewBox){lastMap='';redraw();}});
  function circle(svg,point,range,color,key){if(!point)return;const c=doc.createElementNS('http://www.w3.org/2000/svg','circle');c.dataset[key]='';c.setAttribute('cx',Math.sqrt(3)*(point.q+point.r/2));c.setAttribute('cy',1.5*point.r);c.setAttribute('r',range*Math.sqrt(3));c.setAttribute('fill','none');c.setAttribute('stroke',color);c.setAttribute('stroke-width','.08');c.setAttribute('stroke-opacity','.6');c.style.pointerEvents='none';svg.append(c);}
  function selected(){const state=b.state(),access=window.SAStationAccess.access(state,person(),sicId);return {state,access,p:Object.values(access?.ship.ship.probeState?.probes||{}).find(p=>p.id===get('[data-probe]').value)};}
  function plot(){
   const {state,access,p}=selected(),svg=get('[data-map] svg[data-space-canvas]');if(!access)return;
   const origin=window.SAShipTargets.point(state,access.ship.id),pending=person()?.delayedAction?.probeOrder;
   const destination=planning?.destination||(pending?.probeId===p?.id&&['launch','move'].includes(pending.kind)?pending.destination:null);
   const error=planning?window.SAShipProbes.destinationError(state,access.ship,planning.destination):'';
   get('[data-q]').disabled=get('[data-r]').disabled=!planning;
   get('[data-planner]').hidden=!planning;
   const orderButton=planning&&get(`[data-order="${planning.kind}"]`);
   get('[data-confirm-flight]').disabled=!planning?.locked||Boolean(error)||Boolean(orderButton?.disabled);
   get('[data-confirm-flight]').textContent=planning?.kind==='launch'?'Confirm Launch':'Confirm Move';
   get('[data-replot]').hidden=!planning?.locked;
   get('[data-destination]').textContent=destination?`${!planning?'Ordered':planning.locked?'Selected':'Preview'}: ${destination.q}, ${destination.r}${error?' / '+error:''}`:'';
   get('[data-plot-hint]').textContent=planning?(planning.locked?'Destination selected. Confirm the order or choose another hex.':'Move the pointer to preview a route, then click a hex within the blue boundary.'): 'Choose Launch Probe or Move Probe to plot a destination. Blue: ship link range. Gold: probe sensors.';
   if(!svg)return;for(const old of svg.querySelectorAll('[data-probe-preview],[data-probe-destination]'))old.remove();
   if(!destination)return;
   const from=(planning?.kind||pending?.kind)==='launch'?origin:p?.position;if(!from)return;
   const xy=v=>`${Math.sqrt(3)*(v.q+v.r/2)} ${1.5*v.r}`,line=doc.createElementNS(svg.namespaceURI,'path');line.dataset.probePreview=!planning||planning.locked?'locked':'preview';line.setAttribute('d',`M${xy(from)} L${xy(destination)}`);line.setAttribute('fill','none');line.setAttribute('stroke',error?'#ff7886':'#fff0a8');line.setAttribute('stroke-width','3');line.setAttribute('vector-effect','non-scaling-stroke');line.setAttribute('stroke-dasharray',!planning||planning.locked?'none':'7 5');line.style.pointerEvents='none';svg.append(line);circle(svg,destination,.35,error?'#ff7886':'#fff0a8','probeDestination');const marker=svg.querySelector('[data-probe-destination]');marker?.setAttribute('stroke-width','2');marker?.setAttribute('vector-effect','non-scaling-stroke');
  }
  function clearPlot(){planning=null;get('[data-q]').value='';get('[data-r]').value='';}
  function redraw(){
   const state=b.state(),u=person(),access=window.SAStationAccess.access(state,u,sicId);if(!access||access.seat.key!==initial.seat.key){view.close();return;}
   const probes=Object.values(access.ship.ship.probeState?.probes||{}).filter(p=>p.launcherId===sicId&&p.phase!=='unavailable'),options=probes.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.phase)}</option>`).join('');
   if(options!==lastOptions){const old=get('[data-probe]').value;get('[data-probe]').innerHTML=options||'<option value="">No probes loaded</option>';if(probes.some(p=>p.id===old))get('[data-probe]').value=old;lastOptions=options;}
   if(planning&&(planning.probeId!==get('[data-probe]').value||u?.delayedAction?.probeOrder))clearPlot();
   const p=probes.find(p=>p.id===get('[data-probe]').value),range=window.SAShipMap.sensorStats(access.ship).range,cooldown=access.ship.ship.probeState?.launchers?.[sicId]?.cooldown||0,pending=u?.delayedAction;
   const ready=!state.practice&&state.activeId===u?.id&&!u?.consoleHold&&!pending&&!u?.timedAction&&!u?.delayTimer&&!busy;
   get('[data-turn]').textContent=pending?.awaitingRoll?'ROLL REQUIRED':pending?.probeOrder?'INPUT IN PROGRESS':ready?'YOUR TURN':window.SAConsoleCommon.standby(state,u);
   get('[data-range]').textContent=`Ship sensor link: ${range} Units`;
   get('[data-cooldown]').textContent=cooldown>0?`Launch ready in ${cooldown.toFixed(1)} active seconds`:`${probes.filter(p=>p.phase==='docked').length} docked / capacity 4`;
   get('[data-art]').src=p?`${p.type}.svg`:'probe-launcher.svg';
   const def=p&&window.SAShipMap.definition(p.type);
   get('[data-spec]').textContent=p?`${def.probeDice.length}D${def.probeDice[0]} sensors · Speed ${p.speed} · Masking ${p.masking} · Threshold ${p.threshold}`:'Attach up to four Probe SICs in ship building.';
   get('[data-status]').textContent=pending?.probeOrder?`${pending.label} / ${Math.max(0,pending.remaining/pending.rate).toFixed(1)} seconds`:p?`${p.phase} / ${p.linked?'direct link active':p.phase==='docked'?'ready in launcher':'no sensor data link'}`:'';
   const payload=window.SAShipProbes,hasBug=p&&payload.moduleOn(access.ship,p,'hacking-bug'),hasInhibitor=p&&payload.moduleOn(access.ship,p,'warp-bubble-inhibitor');
   const targets=(state.starships||[]).filter(s=>s.id!==access.ship.id&&!s.isProbe&&!s.isDrone&&!s.isMissile&&access.ship.sensorState?.contacts?.[s.id]?.level==='detected'),targetOptions=targets.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
   if(targetOptions!==lastTargets){const old=get('[data-target]').value;get('[data-target]').innerHTML=targetOptions||'<option value="">No detected ships</option>';if(targets.some(s=>s.id===old))get('[data-target]').value=old;lastTargets=targetOptions;}
   get('[data-target-label]').hidden=!hasBug;
   get('[data-payload]').textContent=p?[payload.moduleOn(access.ship,p,'shield-breacher')?'Shield Breacher installed':'',p.breachRemaining>0?`Hull access in ${p.breachRemaining.toFixed(1)}s`:'',hasBug?(p.bugActive?`Bug active · next AU in ${Math.max(0,p.bugRemaining).toFixed(1)}s`:'Hacking Bug off'):'',hasInhibitor?`Inhibitor ${p.inhibitor||'off'}${p.inhibitor==='arming'?' · '+p.inhibitorRemaining.toFixed(1)+'s':''}`:''].filter(Boolean).join(' / '):'';
   get('[data-input]').value=pending?.probeOrder?100-pending.remaining:0;
   for(const button of view.querySelectorAll('[data-order]')){
    const kind=button.dataset.order;button.parentElement.hidden=['attach','bugOn','bugOff'].includes(kind)?!hasBug||(kind==='bugOff'?!p.bugActive:kind==='bugOn'?p.bugActive:false):['inhibit','inhibitOff'].includes(kind)?!hasInhibitor||(kind==='inhibitOff'?(!p.inhibitor||p.inhibitor==='off'):p.inhibitor&&p.inhibitor!=='off'):false;
    const reason=busy?'Sending command…':state.practice?'Prepare an encounter to scout.':!ready?'Wait for your turn and finish any pending action.':access.blocked?'Restore control of this console.':!p?'Load a probe in this launcher first.':kind==='launch'?(p.phase!=='docked'?'Select a docked probe.':cooldown>0?'Launcher is cooling down.':!range?'Operational Sensors required.':''):kind==='return'?!payload.active(p)?'Select a deployed probe.':'':!p.linked?'Probe must be deployed within the ship’s sensor range.':payload.payloadError(state,access.ship,p,kind,get('[data-target]').value,u);
    button.disabled=Boolean(reason);get(`[data-reason="${kind}"]`).textContent=reason;
   }
   const point=window.SAShipTargets.point(state,access.ship.id);
   const picture=window.SAShipSensors.view(state,access.ship.id),mapKey=JSON.stringify([picture.starships,picture.shipPositions,state.spaceObjects,p?.id,p?.position,range]);
   if(mapKey!==lastMap){
    const xy=v=>({x:Math.sqrt(3)*(v.q+v.r/2),y:1.5*v.r}),bounds=[];
    if(point){const c=xy(point),radius=Math.max(3,range);bounds.push({x:c.x-radius*Math.sqrt(3),y:c.y-radius*1.5},{x:c.x+radius*Math.sqrt(3),y:c.y+radius*1.5});}
    if(p?.position&&p.phase!=='docked'){const c=xy(p.position);bounds.push({x:c.x-2,y:c.y-2},{x:c.x+2,y:c.y+2});}
    get('[data-map]').innerHTML=window.SASpaceMap.markup(picture.starships,picture.shipPositions,false,{navigation:true,fitBounds:bounds});
    const svg=get('[data-map] svg[data-space-canvas]');if(svg){
     if(manualViewBox)svg.setAttribute('viewBox',manualViewBox);else if(bounds.length){const rect=svg.getBoundingClientRect(),ratio=Math.max(.25,rect.width/Math.max(1,rect.height)),left=Math.min(...bounds.map(p=>p.x)),right=Math.max(...bounds.map(p=>p.x)),top=Math.min(...bounds.map(p=>p.y)),bottom=Math.max(...bounds.map(p=>p.y)),width=Math.max(12,right-left+4,(bottom-top+4)*ratio),height=width/ratio;svg.setAttribute('viewBox',[(left+right-width)/2,(top+bottom-height)/2,width,height].join(' '));}
     window.SASpaceMap.coverViewport(svg);
     // The sensor metric is a hex disk; show its exact boundary for destination selection.
     const boundary=doc.createElementNS(svg.namespaceURI,'polygon');boundary.dataset.probeLinkRange='';boundary.setAttribute('points',[[range,0],[0,range],[-range,range],[-range,0],[0,-range],[range,-range]].map(([q,r])=>{const c=xy({q:point.q+q,r:point.r+r});return `${c.x},${c.y}`;}).join(' '));boundary.setAttribute('fill','#67d6ed08');boundary.setAttribute('stroke','#67d6ed');boundary.setAttribute('stroke-width','.08');boundary.style.pointerEvents='none';svg.append(boundary);
     if(p&&p.linked)circle(svg,p.position,range,'#efc977','probeSensorRange');
    }lastMap=mapKey;
   }
   plot();
   const reports=(access.ship.ship.probeState?.reports||[]).map(r=>`<article><time>${esc(new Date(r.at).toLocaleTimeString())}</time><p>${esc(r.text)}</p></article>`).join('')||'<p>No probe activity yet.</p>';if(reports!==lastReports){get('[data-reports]').innerHTML=reports;lastReports=reports;}
   const rings=b.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(get('[data-rings]'),rings);lastRings=rings;}
   get('[data-hold]').hidden=Boolean(state.practice);get('[data-hold]').disabled=busy||(!ready&&!u?.consoleHold);get('[data-hold]').textContent=u?.consoleHold?'Resume':'Hold';get('[data-leave]').hidden=Boolean(state.practice);get('[data-leave]').disabled=!ready;
  }
  function hex(event){const svg=event.target.closest('svg[data-space-canvas]');if(!svg)return null;const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse()),fq=Math.sqrt(3)/3*p.x-p.y/3,fr=2*p.y/3;let x=Math.round(fq),z=Math.round(fr),y=Math.round(-fq-fr);if(Math.abs(x-fq)>Math.abs(y+fq+fr)&&Math.abs(x-fq)>Math.abs(z-fr))x=-y-z;else if(Math.abs(z-fr)>Math.abs(y+fq+fr))z=-x-y;return {q:x,r:z};}
  function preview(destination){planning.destination=destination;get('[data-q]').value=destination.q;get('[data-r]').value=destination.r;const {state,access}=selected();get('[data-error]').textContent=window.SAShipProbes.destinationError(state,access.ship,destination);plot();}
  get('[data-map]').onpointermove=event=>{if(!planning||planning.locked)return;const destination=hex(event);if(destination)preview(destination);};
  get('[data-map]').onclick=event=>{if(!planning||planning.locked)return;const destination=hex(event);if(!destination)return;preview(destination);const {state,access}=selected(),error=window.SAShipProbes.destinationError(state,access.ship,destination);get('[data-error]').textContent=error;if(!error)planning.locked=true;plot();};
  view.oninput=view.onchange=event=>{if(planning&&event.target.matches('[data-q],[data-r]')){const q=get('[data-q]').value,r=get('[data-r]').value,valid=q.trim()!==''&&r.trim()!==''&&[Number(q),Number(r)].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000);planning.destination=valid?{q:Number(q),r:Number(r)}:null;planning.locked=valid;const {state,access}=selected();get('[data-error]').textContent=valid?window.SAShipProbes.destinationError(state,access.ship,planning.destination):'Enter whole-number coordinates between −10000 and 10000.';}redraw();};
  get('[data-replot]').onclick=()=>{if(planning){planning.locked=false;plot();}};
  get('[data-cancel-flight]').onclick=()=>{clearPlot();redraw();};
  async function submit(kind){
   if(busy||!b.confirmGmPlayerAction(person(),'probeCommand'))return;
   const destination=planning?.destination&&{...planning.destination},probeId=get('[data-probe]').value;
   busy=true;redraw();try{await b.utilityAction({id:unit.id,sicId,kind,probeId,targetId:get('[data-target]').value,destination,receipt:crypto.randomUUID()});clearPlot();get('[data-error]').textContent='Probe order accepted.';}catch(e){get('[data-error]').textContent=e.message;}finally{busy=false;if(view.isConnected)redraw();}
  }
  get('[data-confirm-flight]').onclick=()=>{plot();if(!get('[data-confirm-flight]').disabled)submit(planning.kind);};
  view.addEventListener('click',event=>{const button=event.target.closest('[data-order]');if(!button||button.disabled||busy)return;const kind=button.dataset.order;if(['launch','move'].includes(kind)){planning={kind,probeId:get('[data-probe]').value,destination:null,locked:false};get('[data-q]').value='';get('[data-r]').value='';get('[data-error]').textContent='';redraw();}else submit(kind);});
  get('[data-close]').onclick=()=>{window.SAShipNavigationUI.remember(person());view.close();};get('[data-sound]').onclick=()=>b.toggleSound();get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(person());}catch(e){get('[data-error]').textContent=e.message;}};get('[data-leave]').onclick=()=>{if(!b.confirmGmPlayerAction(person(),'leaveStation'))return;view.close();window.SACombatMap.openMove(person());};
  window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());doc.body.append(view);view.showModal();redraw();const resize=new ResizeObserver(()=>{if(!manualViewBox){lastMap='';redraw();}});resize.observe(get('[data-map]'));const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);resize.disconnect();current=null;view.remove();window.removeEventListener('pagehide',cleanup);b.requestRender();};view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});
 }
 window.SAProbeConsole={open};
}());
