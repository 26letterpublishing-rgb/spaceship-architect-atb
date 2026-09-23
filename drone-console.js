(function(){
 let currentView=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function open(unit,sicId){
  if(currentView)return;const b=window.SACombatBridge,initial=window.SAStationAccess.access(b.state(),unit,sicId);if(!initial?.definition.repairDrone)return;const def=initial.definition,timing=window.SADelayRules.repairDroneSettings(def.tier),interval=(100/window.SADelayRules.calculate(timing).rate).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
  const view=doc.createElement('dialog');currentView=view;view.className='utility-console lock-console drone-console';view.dataset.operatorId=unit.id;view.dataset.sicId=sicId;view.setAttribute('aria-label',def.name+' console');
  for(const name of ['utility-console.css','console-common.css'])if(!doc.querySelector(`link[href="${name}"]`)){const l=doc.createElement('link');l.rel='stylesheet';l.href=name;doc.head.append(l);}
  view.innerHTML=`<header><div><small>${esc(unit.characterName)}</small><h2>${esc(def.name)}</h2></div><div data-selector></div><button data-sound type="button">${b.soundIcon()}</button><button data-close type="button">Combat View</button></header><section class="lock-chart utility-scene"><img src="${esc(def.droneSprite)}" alt="Hull repair drone" style="max-height:260px;max-width:100%"><strong data-drone-status></strong><p>Slow + Quality ${timing.factors.Quality} / 1D${def.repairDie} Hull every ${interval} active seconds</p><p>The drone works automatically. Repair rolls do not interrupt your turn.</p></section><section class="lock-controls utility-controls"><h3>Repair Orders</h3><div data-drone-orders></div><output data-status role="status"></output></section><section class="utility-seat"><button data-hold type="button">Hold</button><button data-leave type="button">Leave Station</button></section>`;
  let busy=false,key='';const get=s=>view.querySelector(s),person=()=>b.state().units.find(u=>u.id===unit.id);
  function redraw(){
   const p=person(),access=window.SAStationAccess.access(b.state(),p,sicId),d=access?.ship.ship.droneState?.drones?.[sicId];
   const ready=!b.state().practice&&b.state().activeId===p?.id&&!p?.consoleHold&&!p?.delayedAction&&!p?.timedAction&&!p?.delayTimer&&!busy;
   get('[data-drone-status]').textContent=d?.phase==='repairing'?`Repairing / next D${def.repairDie} in ${Math.max(0,(100-d.progress)/d.rate).toFixed(1)}s`:d?.phase==='returning'?'Returning to bay':d?.phase==='destroyed'?'Drone destroyed':'Docked / waiting for Hull damage';
   const targets=ready?(access?.ship.droneRepairTargets||[]):[];
   const next=JSON.stringify(targets);if(next!==key){key=next;get('[data-drone-orders]').innerHTML=targets.map(t=>`<button type="button" data-drone-target="${esc(t.id)}">Repair ${esc(t.title)}</button>`).join('');}
   get('[data-hold]').hidden=Boolean(b.state().practice);get('[data-hold]').disabled=busy||(!ready&&!p?.consoleHold);get('[data-hold]').textContent=p?.consoleHold?'Resume':'Hold';
   get('[data-leave]').hidden=Boolean(b.state().practice);get('[data-leave]').disabled=!ready;
  }
  view.addEventListener('click',async event=>{
   const target=event.target.closest('[data-drone-target]');if(!target||busy)return;
   if(!b.confirmGmPlayerAction(person(),'dispatchRepairDrone'))return;
   const targetId=target.dataset.droneTarget;busy=true;redraw();
   try{await b.utilityAction({id:unit.id,sicId,kind:'repair-ship',targetId,receipt:crypto.randomUUID()});get('[data-status]').textContent='Repair order confirmed.';}catch(e){get('[data-status]').textContent=e.message;}finally{busy=false;redraw();}
  });
  get('[data-close]').onclick=()=>view.close();get('[data-sound]').onclick=()=>b.toggleSound();
  get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(person());}catch(e){get('[data-status]').textContent=e.message;}};
  get('[data-leave]').onclick=()=>{if(!b.confirmGmPlayerAction(person(),'leaveStation'))return;view.close();window.SACombatMap.openMove(person());};
  window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());
  doc.body.append(view);view.showModal();window.SAConsoleCommon.mount(view,unit);redraw();const timer=setInterval(redraw,200);
  const close=()=>view.close();window.addEventListener('pagehide',close,{once:true});
  view.addEventListener('close',()=>{clearInterval(timer);window.removeEventListener('pagehide',close);currentView=null;view.remove();b.requestRender();},{once:true});
 }
 window.SADroneConsole={open};
}());
