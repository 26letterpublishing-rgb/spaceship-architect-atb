(function(){
  let dialog=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(unit,sicId){
    if(dialog)return;
    const bridge=window.SACombatBridge,initial=window.SAStationAccess.access(bridge.state(),unit,sicId);
    if(!initial||initial.kind!=='shield')return;
    let host=document;try{while(host.defaultView.frameElement&&!host.defaultView.frameElement.hasAttribute('data-explore-perspective'))host=host.defaultView.parent.document;}catch{}
    const view=host.createElement('dialog');dialog=view;view.className='shield-console-dialog';view.setAttribute('aria-label','Shield console');
    view.dataset.operatorId=unit.id;
    view.innerHTML=`<header><div><small data-connection></small><h2>${esc(initial.ship.title)} / Shields</h2></div><div class="shield-command"><strong data-turn role="status"></strong><progress data-turn-progress max="1" value="0" aria-label="Command window remaining"></progress></div><div data-console-switch><button type="button" data-sound aria-label="Toggle sound">${bridge.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header>
      <main><section class="shield-field"><h3>Field Integrity</h3><div class="shield-emitter"><svg class="shield-integrity-display" viewBox="0 0 300 220" role="img" aria-label="Selected shield integrity"><g fill="none" stroke="#57ad8e"><ellipse cx="150" cy="105" rx="125" ry="82" stroke-dasharray="3 7"/><ellipse cx="150" cy="105" rx="95" ry="90" transform="rotate(38 150 105)"/><ellipse cx="150" cy="105" rx="95" ry="90" transform="rotate(-38 150 105)"/><circle cx="150" cy="105" r="67" stroke="#223e36" stroke-width="8"/><circle data-integrity-ring cx="150" cy="105" r="67" pathLength="100" stroke="#89ffca" stroke-width="8" transform="rotate(-90 150 105)"/></g><text data-layer-hp x="150" y="104" text-anchor="middle" fill="#e5fff4" font-size="28" font-weight="bold"></text><text x="150" y="126" text-anchor="middle" fill="#9cdcc5" font-size="11">SELECTED SHIELD LAYER</text></svg><div data-condition></div></div><div class="shield-readout"><strong data-shield-hp aria-label="Ship shield HP"></strong><p data-field-state role="status"></p></div><div class="shield-energy-trace" aria-hidden="true"></div><div data-factors class="shield-factors"></div><p data-recovery></p><progress data-recovery-progress max="1" value="0" aria-label="Restabilization progress"></progress></section>
      <section class="shield-operations"><h3>Auxiliary Power</h3><strong data-au></strong><progress data-au-progress max="100" value="0" aria-label="AU recharge"></progress><p data-reserved></p><label>Purchases <input type="number" min="1" max="100" value="1" step="1" data-amount></label><div class="shield-order"><button type="button" data-order="restore">Restore Shield HP</button><small>5 AU / +1 HP</small></div><div class="shield-order"><button type="button" data-order="reinforce">Reinforce Field</button><small>3 AU / +1 reduction per hit</small></div><p data-protection></p><button type="button" data-order="restabilize">Restabilize Shield</button><p data-rest-rule>${initial.definition.restabilizeAu} AU / ${initial.definition.restabilizeSeconds} powered seconds before crew bonuses. Local operators' ATB freezes until completion.</p><progress data-input max="1.5" value="0" aria-label="Console input progress"></progress><p data-input-status role="status"></p><p data-error role="alert"></p><div class="shield-navigation-actions"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div></section>
      <section class="shield-activity"><h3>Fleet Condition</h3><div data-fleet></div><h3>Combat Activity</h3><div data-log></div></section><section class="shield-timeline"><div class="pilot-rings" data-rings></div></section></main>`;
    host.body.append(view);view.showModal();
    const get=s=>view.querySelector(s),amount=get('[data-amount]');let busy=false,lastBeat=-1,lastTurn='',lastRings='',lastLog='',lastFleet='';
    window.SAShipNavigationUI.mountSelector(get('[data-console-switch]'),unit,sicId,()=>view.close());
    const dismiss=()=>window.SAShipNavigationUI.remember(bridge.state().units.find(u=>u.id===unit.id));
    function redraw(){
      const state=bridge.state(),person=state?.units?.find(u=>u.id===unit.id),a=window.SAStationAccess.access(state,person,sicId);
      if(!a||a.seat.key!==initial.seat.key){view.close();return;}
      const shield=a.ship.shieldSystems?.[sicId],au=a.ship.auState||{},pending=a.ship.auCommands?.find(c=>c.unitId===person.id),rest=shield?.restabilization,auto=shield?.addonRecovery;
      if(!shield)return;
      const ready=state.activeId===person.id&&!person.delayedAction&&!person.delayTimer&&!person.timedAction&&!person.shieldRestabilizing;
      const command=ready&&state.command?.unitId===person.id?state.command:null;
      const fraction=command?.total>0&&!command.expired?Math.max(0,Math.min(1,command.remaining/command.total)):0;
get('[data-turn]').textContent=person.shieldRestabilizing?'RESTABILIZING':person.consoleHold?'HOLDING / 99%':ready?'YOUR TURN':window.SAConsoleCommon.standby(state,person);
      get('[data-turn]').style.color=person.color||'#8fffbf';get('[data-turn-progress]').value=fraction;
      const turnKey=`${state.turnSerial}:${person.id}`;
      if(turnKey!==lastTurn){lastTurn=turnKey;lastBeat=-1;}
      const beat=Math.floor(performance.now()/1000),alerting=ready&&!person.consoleHold&&!command?.expired&&!state.hardPaused&&!state.holdPaused&&!host.hidden;
      view.dataset.flash=String(alerting&&performance.now()%1000<450);
      if(alerting&&beat!==lastBeat){lastBeat=beat;bridge.consoleTick();}
      get('[data-connection]').textContent=`${a.remote?'REMOTE ACCESS':'LOCAL STATION'} / ${window.SAShipMap.definition(a.seat.cell.type).name} / ${person.characterName}`;
      view.dataset.remote=String(a.remote);
      get('[data-condition]').innerHTML=window.SAHealthDisplay.track('shield',window.SAHealthDisplay.presentation(a.ship).shieldSystems?.[sicId]?.hp??shield.hp,a.definition.shieldHp,bridge.mode()==='gm');
      const shownHp=window.SAHealthDisplay.presentation(a.ship).shieldSystems?.[sicId]?.hp??shield.hp;
      get('[data-layer-hp]').textContent=`${shownHp} / ${a.definition.shieldHp}`;
      get('[data-integrity-ring]').setAttribute('stroke-dasharray',`${Math.max(0,Math.min(100,100*shownHp/a.definition.shieldHp))} 100`);
      get('[data-shield-hp]').textContent=`${window.SAHealthDisplay.presentation(a.ship).currentShieldHp ?? shield.hp} / ${a.ship.maximumShieldHp ?? a.definition.shieldHp} HP`;
      get('[data-field-state]').textContent=auto?'AUTOMATIC SHIELD RECOVERY':rest?'RESTABILIZATION IN PROGRESS':shield.hp<=0?'FIELD COLLAPSED':a.item.impaired||a.item.status==='impaired'?'IMPAIRED / AU CONTROLS OFFLINE':'FIELD STABLE';
      view.dataset.field=shield.hp>0?'online':'burst';
      get('[data-au]').textContent=`${au.available??au.current??0} / ${au.maximum??0} AU`;
      get('[data-au-progress]').value=au.current>=au.maximum?100:au.progress||0;
      get('[data-reserved]').textContent=auto?.emergency&&!auto.paused?'Emergency Shield Recharger: all AU diverted':au.reserved?`${au.reserved} AU reserved for pending commands`:'';
      const factors=shield.factors||{};
      get('[data-factors]').innerHTML=Object.entries(factors).map(([name,n])=>`<div><span class="pilot-factor" title="${esc(name)}: ${n} of 4">${bridge.delayIcon(n)}</span><small>${{Ingenuity:'Crew Sync',Efficiency:'Throughput',Performance:'Response'}[name]}</small></div>`).join('');
      get('[data-recovery]').textContent=auto?`${auto.paused||(auto.burst&&auto.funded<=0?'Waiting for AU':'Automatic shield recovery')} / ${Math.max(0,auto.total-auto.elapsed).toFixed(1)} sec / returns ${auto.burst?Math.ceil(a.definition.shieldHp/3):1} HP${auto.emergency?' / all AU diverted':' / 2 AU per 12 sec'}`:rest?`${rest.paused||'Restabilizing'} / ${Math.round(rest.progress*100)}% / ${rest.auSpent} of ${a.definition.restabilizeAu} AU supplied`:`Regeneration: ${a.definition.shieldRegeneration} HP / ${Number(shield.regenerationSeconds).toFixed(1)} sec`;
      get('[data-recovery-progress]').hidden=!rest&&!auto;get('[data-recovery-progress]').value=auto?auto.elapsed/auto.total:rest?.progress||0;
      get('[data-protection]').textContent=shield.protectionRemaining>0?`+${shield.protection} reduction / ${shield.protectionRemaining.toFixed(1)} sec remaining`:'Reinforcement lasts 12 combat seconds. Adding protection does not extend its timer.';
      const count=Number(amount.value),valid=Number.isInteger(count)&&count>=1&&count<=100,impaired=a.item.impaired||a.item.status==='impaired';
      for(const button of view.querySelectorAll('[data-order]')){
        const kind=button.dataset.order;
        button.hidden=kind==='restabilize'&&a.remote;
        button.disabled=busy||Boolean(pending)||Boolean(person.delayedAction?.sensorOrder||person.delayedAction?.shipOrder)||impaired||(kind==='restabilize'?shield.hp>0||Boolean(rest):!valid||shield.hp<=0||Boolean(rest));
        button.setAttribute('aria-disabled',String(button.disabled));
      }
      get('[data-rest-rule]').hidden=a.remote;
      get('[data-input]').value=pending?1.5-pending.remaining:0;get('[data-input]').hidden=!pending;
      get('[data-input-status]').textContent=pending?`Entering ${pending.kind==='restore'?'restoration':'reinforcement'} / ${pending.remaining.toFixed(1)} sec`:'';
      get('[data-leave]').disabled=busy||!ready||Boolean(person.shieldRestabilizing);
      get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-hold]').disabled=busy||(!person.consoleHold&&!ready);
      window.SAConsoleCommon.updateSound(view);
      const fleet=state.starships.map(ship=>ship.contactOnly?`<div><strong>${esc(ship.title)}</strong><small>${ship.contactLevel==='detected'?'Detected / condition unscanned':'Unresolved signal'}</small></div>`:`<div><strong>${esc(ship.title)}</strong>${window.SAHealthDisplay.hull(ship,bridge.mode()==='gm')}${window.SAHealthDisplay.shields(ship,bridge.mode()==='gm')}</div>`).join('');
      if(fleet!==lastFleet){get('[data-fleet]').innerHTML=fleet;lastFleet=fleet;}
      const log=(state.log||[]).slice(-20).reverse().map(e=>`<p><small>${esc(e.at)}</small>${window.SAHealthDisplay.logMarkup(e,bridge.mode()==='gm')}</p>`).join('');
      if(log!==lastLog){get('[data-log]').innerHTML=log;lastLog=log;}
      const rings=bridge.pilotRings();if(rings!==lastRings){window.SALiveDOM.render(get('[data-rings]'),rings);lastRings=rings;}
    }
    view.addEventListener('click',async event=>{
      const button=event.target.closest('[data-order]');if(!button||button.disabled||busy)return;
      const person=bridge.state().units.find(u=>u.id===unit.id);if(!bridge.confirmGmPlayerAction(person,'shieldCommand'))return;
      if(button.dataset.order==='restabilize'&&!host.defaultView.confirm(`Restabilize this shield? All crew physically at this shield will stop their ATB until recovery completes. The system needs ${initial.definition.restabilizeAu} AU in total and pauses if power runs out.`))return;
      busy=true;get('[data-error]').textContent='';redraw();
      try{await bridge.action({action:'shieldCommand',id:person.id,sicId,kind:button.dataset.order,amount:Number(amount.value),requestId:crypto.randomUUID()},'resolve',{throwOnError:true});if(view.classList.contains('combat-order-dialog'))view.close();}
      catch(err){get('[data-error]').textContent=err.message;if(/Auxiliary/.test(err.message)){view.classList.remove('shield-au-error');void view.offsetWidth;view.classList.add('shield-au-error');}}
      finally{busy=false;if(view.isConnected)redraw();}
    });
    amount.oninput=redraw;
    get('[data-close]').onclick=()=>{dismiss();view.close();};
    get('[data-sound]').onclick=()=>{bridge.toggleSound();redraw();};
    get('[data-leave]').onclick=()=>{const person=bridge.state().units.find(u=>u.id===unit.id);if(!bridge.confirmGmPlayerAction(person,'leaveStation'))return;view.close();window.SACombatMap.openMove(person);};
    get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(bridge.state().units.find(u=>u.id===unit.id));}catch(err){get('[data-error]').textContent=err.message;}};
    view.addEventListener('cancel',dismiss);view.addEventListener('pointerdown',bridge.resumeAudio,{passive:true});
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);view.remove();dialog=null;window.removeEventListener('pagehide',cleanup);setTimeout(()=>bridge.requestRender(),0);};
    view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  window.SAShieldConsoleUI={open,isOpen:()=>Boolean(dialog)};
}());
