(function(){
  const ownerId=crypto.randomUUID();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function updateSound(view){
    const enabled=window.SACombatBridge.soundEnabled();
    for(const button of view.querySelectorAll('[data-sound]')){
      if(!button.querySelector('svg'))button.innerHTML=window.SACombatBridge.soundIcon();
      button.classList.add('console-sound');button.classList.toggle('muted',!enabled);
      button.setAttribute('aria-pressed',String(!enabled));button.title=enabled?'Mute sounds':'Unmute sounds';button.setAttribute('aria-label',button.title);
      button.querySelectorAll('.sound-wave').forEach(e=>e.style.display=enabled?'':'none');
      button.querySelectorAll('.mute-slash').forEach(e=>e.style.display=enabled?'none':'block');
    }
  }
  function standby(state,person){if(state.practice)return 'OUT OF COMBAT';const active=state.units.find(u=>u.id===state.activeId);return state.hiddenActiveTurn?'Awaiting GM action':active&&active.id!==person.id?`STANDBY / ${active.characterName}'s turn`:state.running&&!state.hardPaused&&!state.holdPaused?'STANDBY / ATB charging':'STANDBY / ATB paused';}
  function mount(view,unit){
    if(!view||view.dataset.commonMounted)return;view.dataset.commonMounted='1';
    view.dataset.consoleOwner=ownerId;
    const doc=view.ownerDocument,b=window.SACombatBridge;
    const choiceKey='sa-console-choices:'+location.search+':'+unit.id+':'+(view.dataset.sicId||view.className);let choices={};try{choices=JSON.parse(sessionStorage.getItem(choiceKey)||'{}');}catch{}
    const choiceId=el=>el.id||el.name||[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join('|')||String([...view.querySelectorAll('select')].indexOf(el));
    const restored=new WeakSet();const restoreChoices=()=>{for(const select of view.querySelectorAll('select:not(.station-console-select)')){if(restored.has(select)||!select.options.length)continue;const saved=choices[choiceId(select)];if(saved!==undefined&&[...select.options].some(o=>o.value===saved)){select.value=saved;restored.add(select);select.dispatchEvent(new Event('change',{bubbles:true}));}else if(saved===undefined)restored.add(select);}};
    view.addEventListener('change',e=>{if(e.target.matches('select:not(.station-console-select)')){choices[choiceId(e.target)]=e.target.value;try{sessionStorage.setItem(choiceKey,JSON.stringify(choices));}catch{}}});
    const maintenance=doc.createElement('button');maintenance.type='button';maintenance.dataset.consoleMaintenance='';maintenance.textContent='SIC Maintenance';
    maintenance.onclick=()=>{const person=b.state().units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(b.state(),person,view.dataset.sicId);if(access?.controlled&&!access?.offline){const module=window.SAStationAccess.consoles(b.state(),person).find(a=>a.kind==='hacking'&&!a.controlled);if(module)window.SAHackingConsoleUI?.open(person,module.id);return;}window.SAMaintenanceUI?.open(person,view.dataset.sicId);};
    const service=doc.createElement('section');service.className='console-service-panel';service.setAttribute('aria-label','SIC service controls');
    for(const [kind,label] of [['on','⏻ Power On'],['off','⏻ Power Off'],['restart','↻ Restart SIC'],['repair','⚒ Repair SIC']]){const button=doc.createElement('button');button.type='button';button.dataset.consoleMaintenance=kind;button.textContent=label;button.onclick=()=>{const person=b.state().units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(b.state(),person,view.dataset.sicId);if(access?.controlled){maintenance.onclick();return;}window.SAMaintenanceUI?.open(person,view.dataset.sicId,kind);};service.append(button);}view.append(service);
    const compromised=doc.createElement('section');compromised.className='console-compromised';compromised.hidden=true;
    compromised.innerHTML='<strong>CONSOLE COMPROMISED</strong><p>Electronic controls locked</p><button type="button" data-local-recovery>Local SIC Maintenance</button>';
    view.append(compromised);
    compromised.querySelector('button').onclick=()=>window.SAMaintenanceUI?.open(b.state().units.find(u=>u.id===unit.id),view.dataset.sicId);
    view.addEventListener('click',event=>{
      const u=b.state().units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(b.state(),u,view.dataset.sicId);
      if(access?.blocked&&!event.target.closest('[data-close],[data-sound],[data-leave],[data-local-recovery],[data-console-maintenance],.console-swipe,.station-console-select,.transit-status')){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    const previewAllowed='[data-local-recovery],[data-console-maintenance],[data-dev-charge],[data-dev-release],[data-close],[data-sound],.console-swipe,.station-console-select,[data-zoom],[data-auto-zoom],[data-map-focus],[data-action-help],[role=tab],[data-command-page],[data-door-adjustment],summary,.oxygen-panel,.transit-status,.transit-status *,.crew-medical-status,.crew-medical-status *'+(view.classList.contains('utility-console')?', [data-utility-control]':'');
    if(b.state()?.practice){view.dataset.practice='true';const badge=doc.createElement('strong');badge.className='console-preview-status';badge.textContent='OUT OF COMBAT / CONSOLE PREVIEW';view.querySelector('header').append(badge);view.addEventListener('click',event=>{if(!event.target.closest(previewAllowed)){event.preventDefault();event.stopImmediatePropagation();}},true);}
    if(view.classList.contains('utility-console')&&view.querySelector('.console-preview-status'))view.querySelector('.console-preview-status').textContent='OUT OF COMBAT';
    if(!doc.querySelector('[data-common-console-style]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('console-common.css',location.href).href;link.dataset.commonConsoleStyle='';doc.head.append(link);}
    const pilot=view.classList.contains('ship-navigation-dialog')||Boolean(view.dataset.standaloneConsole);if(pilot){const host=view.querySelector('.pilot-power,.cleanser-station-controls')||view.querySelector('section')||view;host.insertBefore(service,host.querySelector('fieldset'));}
    const manageRings=!pilot&&!view.querySelector('[data-rings]');
    if(!pilot){
      view.classList.add('shared-console-layout');
      const au=doc.createElement('section');au.className='shared-power';au.innerHTML='<h3>Fleet Condition</h3><div data-common-fleet></div><h3>Auxiliary Power</h3><strong data-common-au></strong><div class="shared-au-cells" aria-hidden="true"></div><progress data-common-recharge max="100" value="0" aria-label="AU recharge"></progress><small data-common-power-note></small>';view.append(au);au.append(service);
      if(!view.querySelector('[data-rings]')){const rings=doc.createElement('section');rings.className='shared-timeline';rings.innerHTML='<h3>Combat Timeline</h3><div class="pilot-rings" data-rings></div>';view.append(rings);}
      const seat=view.querySelector('.weapon-seat,.sensor-seat-actions,.shield-navigation-actions,.lock-seat,.utility-seat,.hacking-seat');if(seat){seat.classList.add('shared-seat');view.append(seat);}
    }
    const defense=doc.createElement('strong');defense.className='console-defense';defense.setAttribute('aria-label','Own ship Defense');view.querySelector('header>div')?.append(defense);
    const remoteBanner=doc.createElement('strong');remoteBanner.className='console-hack-banner';remoteBanner.textContent='Operating Via HACK';remoteBanner.hidden=true;view.querySelector('header>div')?.prepend(remoteBanner);
    let lastRings='',lastFleet='';
    function tick(){
      const state=b.state();if(!state){view.close();return;}const person=state.units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(state,person,view.dataset.sicId),homeShip=state.starships.find(s=>s.id===person?.location?.starshipId),ship=access?.controlled?access.ship:homeShip;if(!ship)return;
      const au=ship.auState||{},available=au.available??au.current??0;
      updateSound(view);restoreChoices();
      const local=person?.location&&homeShip&&window.SAShipMap.buildLayout(homeShip.ship).footprint.get(person.location.square),target=access?.item||ship.ship.sicInventory.find(i=>i.id===view.dataset.sicId),localSeat=person?.location?.stationed&&local?.sicId===view.dataset.sicId;
      for(const button of service.querySelectorAll('[data-console-maintenance]')){const kind=button.dataset.consoleMaintenance,requiresLocal=['on','repair'].includes(kind),busy=!!(person?.delayedAction||person?.timedAction||person?.delayTimer||person?.consoleHold),ready=state.practice||state.activeId===person?.id;
        const reason=access?.controlled&&kind!=='off'?'Local access required.':requiresLocal&&!localSeat?'Occupy this SIC’s station.':busy?'Finish the current action.':!ready?'Available during your turn.':kind==='repair'&&state.practice?'Repair requires combat time.':!target?'System unavailable.':kind==='repair'&&!(target.impairmentPoints>0||target.impaired)?'No impairment to repair.':kind==='on'&&window.SAStationAccess.online(target)?'Already online.':kind==='off'&&!window.SAStationAccess.online(target)&&!target.bootRemaining?'Already off.':'';
        button.disabled=!!reason;button.title=reason||button.textContent;
      }

      if(pilot){
        let windowFx=view.querySelector('.bridge-warp-window');
        if(ship.ship?.warpState?.phase==='traveling'&&!windowFx){windowFx=doc.createElement('div');windowFx.className='bridge-warp-window';windowFx.setAttribute('aria-label','Traveling in warp');windowFx.innerHTML=Array.from({length:24},(_,i)=>`<i style="--lane:${i*4}%;--delay:${-i*.19}s"></i>`).join('');view.querySelector('.pilot-chart')?.append(windowFx);}
        if(windowFx)windowFx.hidden=ship.ship?.warpState?.phase!=='traveling';
      }
      view.classList.toggle('is-powered-off',Boolean(access?.offline));
      compromised.querySelector('strong').textContent=access?.offline?'SIC POWERED OFF':'CONSOLE COMPROMISED';
      compromised.querySelector('p').textContent=access?.offline?'Use local maintenance to turn this SIC on.':'Electronic controls locked';
      compromised.hidden=!access?.blocked;view.classList.toggle('is-compromised',Boolean(access?.blocked));
      remoteBanner.hidden=!access?.controlled;view.classList.toggle('is-remote-hack',Boolean(access?.controlled));
      for(const region of view.querySelectorAll('main,.pilot-command-controls,.lock-controls,.shield-operations,.utility-controls'))region.inert=Boolean(access?.blocked);
      defense.setAttribute('aria-label',access?.controlled?'Captured ship Defense':'Own ship Defense');
      defense.textContent=`DEFENSE ${ship?.defenseScore??'?'}`+(access?.controlled?` / ${ship.title} AU`:'')+(view.classList.contains('combat-order-dialog')?` / AU ${Number(available.toFixed(1))} of ${au.maximum||0}`:'');
      if(!pilot){
        view.querySelector('[data-common-au]').textContent=`${Number(available.toFixed(1))} / ${au.maximum||0} AU`;
        view.querySelector('[data-common-recharge]').value=au.maximum&&au.current>=au.maximum?100:au.progress||0;
        view.querySelector('.shared-au-cells').style.setProperty('--charge',`${au.maximum?available/au.maximum*100:0}%`);
        view.querySelector('[data-common-power-note]').textContent=(au.reserved?`${au.reserved} AU reserved. `:'')+(!au.maximum?'No AU output':available>=au.maximum?'Fully charged':state.practice?'Recharge follows campaign time':'Recharge follows combat time');
        const fleet=(state.starships||[]).map(s=>`<p><strong>${esc(s.title)}</strong><span>${Number.isFinite(s.currentHullHp)?window.SAHealthDisplay.hull(s,b.mode()==='gm')+window.SAHealthDisplay.shields(s,b.mode()==='gm'):'Condition unknown'} / Defense ${s.defenseScore??'?'}</span></p>`).join('');if(fleet!==lastFleet){view.querySelector('[data-common-fleet]').innerHTML=fleet;lastFleet=fleet;}
        const rings=manageRings&&view.querySelector('[data-rings]');if(rings){const html=b.pilotRings();if(html!==lastRings){window.SALiveDOM.render(rings,html);lastRings=html;}}
      }
      const busy=Boolean(view.dataset.switching||view.dataset.utilityPending||person.delayedAction||person.delayTimer||person.timedAction||person.shieldRestabilizing||ship.auCommands?.some(c=>c.unitId===person.id));
      for(const control of view.querySelectorAll('.console-swipe,.station-console-select')){control.disabled=busy||(control.classList.contains('console-swipe')&&window.SAStationAccess.consoles(state,person).length<2);control.title=busy?'Finish the current action before switching consoles':control.classList.contains('previous')?'Previous console':control.classList.contains('next')?'Next console':'Choose a console';}
      if(state.practice){for(const control of view.querySelectorAll('button,input,select'))if(!control.matches(previewAllowed)){control.disabled=true;control.title='Unavailable outside combat';}view.querySelector('[data-close]').textContent='Close Console';}
      for(const button of view.querySelectorAll('[data-hold]'))button.classList.toggle('resume-ready',Boolean(person.consoleHold));
    }
    tick();
    if(b.state()?.catalogPreview)requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!view.isConnected)return;const frozen=view.cloneNode(true);frozen.removeAttribute('open');frozen.removeAttribute('data-console-owner');frozen.dataset.catalogSnapshot='true';
      const sourceControls=view.querySelectorAll('input,select,textarea');
      frozen.querySelectorAll('input,select,textarea').forEach((el,index)=>{el.value=sourceControls[index].value;if('checked' in el)el.checked=sourceControls[index].checked;});
      for(const anim of frozen.querySelectorAll('animate,animateTransform'))anim.remove();
      for(const el of frozen.querySelectorAll('button,input,select,textarea'))el.disabled=true;
      const exit=doc.createElement('button');exit.type='button';exit.textContent='Back to SIC Card';exit.style.cssText='position:fixed;right:24px;bottom:20px;z-index:20;background:#586570;color:white;border:1px solid #bdced7;padding:12px 20px';exit.onclick=()=>frozen.close();
      const skin=doc.createElement('style');skin.textContent='[data-catalog-snapshot] *,[data-catalog-snapshot] *::before,[data-catalog-snapshot] *::after{animation:none!important;transition:none!important}';frozen.append(skin,exit);
      view.close();doc.body.append(frozen);frozen.showModal();frozen.addEventListener('close',()=>{frozen.remove();window.frameElement?.remove();},{once:true});
    }));
    const timer=setInterval(tick,250);view.addEventListener('close',()=>clearInterval(timer),{once:true});
  }
  window.SAConsoleCommon={mount,standby,updateSound,ownerId};
}());
