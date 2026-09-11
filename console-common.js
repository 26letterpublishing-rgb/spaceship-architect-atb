(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(view,unit){
    if(!view||view.dataset.commonMounted)return;view.dataset.commonMounted='1';
    const doc=view.ownerDocument,b=window.SACombatBridge;
    if(!doc.querySelector('[data-common-console-style]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('console-common.css',location.href).href;link.dataset.commonConsoleStyle='';doc.head.append(link);}
    const pilot=view.classList.contains('ship-navigation-dialog');
    const manageRings=!pilot&&!view.querySelector('[data-rings]');
    if(!pilot){
      view.classList.add('shared-console-layout');
      const au=doc.createElement('section');au.className='shared-power';au.innerHTML='<h3>Fleet Condition</h3><div data-common-fleet></div><h3>Auxiliary Power</h3><strong data-common-au></strong><div class="shared-au-cells" aria-hidden="true"></div><progress data-common-recharge max="100" value="0" aria-label="AU recharge"></progress><small data-common-power-note></small>';view.append(au);
      if(!view.querySelector('[data-rings]')){const rings=doc.createElement('section');rings.className='shared-timeline';rings.innerHTML='<h3>Combat Timeline</h3><div class="pilot-rings" data-rings></div>';view.append(rings);}
      const seat=view.querySelector('.weapon-seat,.sensor-seat-actions,.shield-navigation-actions,.lock-seat');if(seat){seat.classList.add('shared-seat');view.append(seat);}
    }
    let lastRings='',lastFleet='';
    function tick(){
      const state=b.state(),person=state.units.find(u=>u.id===unit.id),ship=state.starships.find(s=>s.id===person?.location?.starshipId);if(!ship)return;
      const au=ship.auState||{},available=au.available??au.current??0;
      if(!pilot){
        view.querySelector('[data-common-au]').textContent=`${Number(available.toFixed(1))} / ${au.maximum||0} AU`;
        view.querySelector('[data-common-recharge]').value=au.current>=au.maximum?100:au.progress||0;
        view.querySelector('.shared-au-cells').style.setProperty('--charge',`${au.maximum?available/au.maximum*100:0}%`);
        view.querySelector('[data-common-power-note]').textContent=(au.reserved?`${au.reserved} AU reserved. `:'')+(available>=au.maximum?'Fully charged':`Recharge follows combat time`);
        const fleet=(state.starships||[]).map(s=>`<p><strong>${esc(s.title)}</strong><span>${Number.isFinite(s.currentHullHp)?window.SAHealthDisplay.track('hull',s.currentHullHp,s.maximumHullHp,b.mode()==='gm')+window.SAHealthDisplay.track('shield',s.currentShieldHp,s.maximumShieldHp,b.mode()==='gm'):'Condition unknown'} / Defense ${s.defenseScore??'?'}</span></p>`).join('');if(fleet!==lastFleet){view.querySelector('[data-common-fleet]').innerHTML=fleet;lastFleet=fleet;}
        const rings=manageRings&&view.querySelector('[data-rings]');if(rings){const html=b.pilotRings();if(html!==lastRings){window.SALiveDOM.render(rings,html);lastRings=html;}}
      }
      const busy=Boolean(person.delayedAction||person.delayTimer||person.timedAction||person.shieldRestabilizing||ship.auCommands?.some(c=>c.unitId===person.id));
      for(const control of view.querySelectorAll('.console-swipe,.station-console-select')){control.disabled=busy||(control.classList.contains('console-swipe')&&window.SAStationAccess.consoles(state,person).length<2);control.title=busy?'Finish the current action before switching consoles':control.classList.contains('previous')?'Previous console':control.classList.contains('next')?'Next console':'Choose a console';}
      if(!pilot){const status=view.querySelector('[data-turn]'),active=state.units.find(u=>u.id===state.activeId);if(status&&!busy&&!person.consoleHold&&state.activeId!==person.id)status.textContent=state.hiddenActiveTurn?'Awaiting GM action':active?`STANDBY / ${active.characterName}'s turn`:'STANDBY / ATB charging';}
    }
    tick();const timer=setInterval(tick,250);view.addEventListener('close',()=>clearInterval(timer),{once:true});
  }
  window.SAConsoleCommon={mount};
}());
