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
    const compromised=doc.createElement('section');compromised.className='console-compromised';compromised.hidden=true;
    compromised.innerHTML='<strong>CONSOLE COMPROMISED</strong><p>Electronic controls locked</p><button type="button" data-local-recovery>Local SIC Maintenance</button>';
    view.append(compromised);
    compromised.querySelector('button').onclick=()=>window.SAMaintenanceUI?.open(b.state().units.find(u=>u.id===unit.id));
    view.addEventListener('click',event=>{
      const u=b.state().units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(b.state(),u,view.dataset.sicId);
      if(access?.blocked&&!event.target.closest('[data-close],[data-sound],[data-leave],[data-local-recovery],.console-swipe,.station-console-select,.transit-status')){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    const previewAllowed='[data-close],[data-sound],.console-swipe,.station-console-select,[data-zoom],[data-auto-zoom],[data-map-focus],[data-action-help],[role=tab],[data-command-page],summary,.oxygen-panel,.transit-status,.transit-status *,.crew-medical-status,.crew-medical-status *'+(view.classList.contains('utility-console')?', [data-utility-control]':'');
    if(b.state()?.practice){view.dataset.practice='true';const badge=doc.createElement('strong');badge.className='console-preview-status';badge.textContent='OUT OF COMBAT / CONSOLE PREVIEW';view.querySelector('header').append(badge);view.addEventListener('click',event=>{if(!event.target.closest(previewAllowed)){event.preventDefault();event.stopImmediatePropagation();}},true);}
    if(view.classList.contains('utility-console')&&view.querySelector('.console-preview-status'))view.querySelector('.console-preview-status').textContent='OUT OF COMBAT';
    if(!doc.querySelector('[data-common-console-style]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('console-common.css',location.href).href;link.dataset.commonConsoleStyle='';doc.head.append(link);}
    const pilot=view.classList.contains('ship-navigation-dialog');
    const manageRings=!pilot&&!view.querySelector('[data-rings]');
    if(!pilot){
      view.classList.add('shared-console-layout');
      const au=doc.createElement('section');au.className='shared-power';au.innerHTML='<h3>Fleet Condition</h3><div data-common-fleet></div><h3>Auxiliary Power</h3><strong data-common-au></strong><div class="shared-au-cells" aria-hidden="true"></div><progress data-common-recharge max="100" value="0" aria-label="AU recharge"></progress><small data-common-power-note></small>';view.append(au);
      if(!view.querySelector('[data-rings]')){const rings=doc.createElement('section');rings.className='shared-timeline';rings.innerHTML='<h3>Combat Timeline</h3><div class="pilot-rings" data-rings></div>';view.append(rings);}
      const seat=view.querySelector('.weapon-seat,.sensor-seat-actions,.shield-navigation-actions,.lock-seat,.utility-seat,.hacking-seat');if(seat){seat.classList.add('shared-seat');view.append(seat);}
    }
    const defense=doc.createElement('strong');defense.className='console-defense';defense.setAttribute('aria-label','Own ship Defense');view.querySelector('header>div')?.append(defense);
    const remoteBanner=doc.createElement('strong');remoteBanner.className='console-hack-banner';remoteBanner.textContent='Operating Via HACK';remoteBanner.hidden=true;view.querySelector('header>div')?.prepend(remoteBanner);
    let lastRings='',lastFleet='';
    function tick(){
      const state=b.state(),person=state.units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(state,person,view.dataset.sicId),homeShip=state.starships.find(s=>s.id===person?.location?.starshipId),ship=access?.controlled?access.ship:homeShip;if(!ship)return;
      const au=ship.auState||{},available=au.available??au.current??0;
      updateSound(view);
      if(pilot){
        let windowFx=view.querySelector('.bridge-warp-window');
        if(ship.ship?.warpState?.phase==='traveling'&&!windowFx){windowFx=doc.createElement('div');windowFx.className='bridge-warp-window';windowFx.setAttribute('aria-label','Traveling in warp');windowFx.innerHTML=Array.from({length:24},(_,i)=>`<i style="--lane:${i*4}%;--delay:${-i*.19}s"></i>`).join('');view.querySelector('.pilot-chart')?.append(windowFx);}
        if(windowFx)windowFx.hidden=ship.ship?.warpState?.phase!=='traveling';
      }
      compromised.hidden=!access?.blocked;view.classList.toggle('is-compromised',Boolean(access?.blocked));
      remoteBanner.hidden=!access?.controlled;view.classList.toggle('is-remote-hack',Boolean(access?.controlled));
      for(const region of view.querySelectorAll('main,.pilot-command-controls,.lock-controls,.shield-operations,.utility-controls'))region.inert=Boolean(access?.blocked);
      defense.setAttribute('aria-label',access?.controlled?'Captured ship Defense':'Own ship Defense');
      defense.textContent=`DEFENSE ${ship?.defenseScore??'?'}`+(access?.controlled?` / ${ship.title} AU`:'')+(view.classList.contains('combat-order-dialog')?` / AU ${Number(available.toFixed(1))} of ${au.maximum||0}`:'');
      if(!pilot){
        view.querySelector('[data-common-au]').textContent=`${Number(available.toFixed(1))} / ${au.maximum||0} AU`;
        view.querySelector('[data-common-recharge]').value=au.maximum&&au.current>=au.maximum?100:au.progress||0;
        view.querySelector('.shared-au-cells').style.setProperty('--charge',`${au.maximum?available/au.maximum*100:0}%`);
        view.querySelector('[data-common-power-note]').textContent=(au.reserved?`${au.reserved} AU reserved. `:'')+(!au.maximum?'No AU output':available>=au.maximum?'Fully charged':`Recharge follows combat time`);
        const fleet=(state.starships||[]).map(s=>`<p><strong>${esc(s.title)}</strong><span>${Number.isFinite(s.currentHullHp)?window.SAHealthDisplay.track('hull',s.currentHullHp,s.maximumHullHp,b.mode()==='gm')+window.SAHealthDisplay.track('shield',s.currentShieldHp,s.maximumShieldHp,b.mode()==='gm'):'Condition unknown'} / Defense ${s.defenseScore??'?'}</span></p>`).join('');if(fleet!==lastFleet){view.querySelector('[data-common-fleet]').innerHTML=fleet;lastFleet=fleet;}
        const rings=manageRings&&view.querySelector('[data-rings]');if(rings){const html=b.pilotRings();if(html!==lastRings){window.SALiveDOM.render(rings,html);lastRings=html;}}
      }
      const busy=Boolean(view.dataset.switching||view.dataset.utilityPending||person.delayedAction||person.delayTimer||person.timedAction||person.shieldRestabilizing||ship.auCommands?.some(c=>c.unitId===person.id));
      for(const control of view.querySelectorAll('.console-swipe,.station-console-select')){control.disabled=busy||(control.classList.contains('console-swipe')&&window.SAStationAccess.consoles(state,person).length<2);control.title=busy?'Finish the current action before switching consoles':control.classList.contains('previous')?'Previous console':control.classList.contains('next')?'Next console':'Choose a console';}
      if(state.practice){for(const control of view.querySelectorAll('button,input,select'))if(!control.matches(previewAllowed)){control.disabled=true;control.title='Unavailable outside combat';}view.querySelector('[data-close]').textContent='Close Console';}
      for(const button of view.querySelectorAll('[data-hold]'))button.classList.toggle('resume-ready',Boolean(person.consoleHold));
    }
    tick();const timer=setInterval(tick,250);view.addEventListener('close',()=>clearInterval(timer),{once:true});
  }
  window.SAConsoleCommon={mount,standby,updateSound,ownerId};
}());
