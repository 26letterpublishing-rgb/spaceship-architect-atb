(function() {
  let dialog = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(unit,sicId) {
    const bridge=window.SACombatBridge, initial=window.SAStationAccess.access(bridge.state(),unit,sicId);
    if(dialog || initial?.kind!=='weapon')return;
    let host=document;try{while(host.defaultView.frameElement)host=host.defaultView.parent.document;}catch{}
    if(!host.querySelector('[data-weapon-style]')){const link=host.createElement('link');link.rel='stylesheet';link.href=new URL('weapon-console-ui.css',location.href).href;link.dataset.weaponStyle='';host.head.append(link);}
    const view=host.createElement('dialog');dialog=view;view.className='weapon-console';view.dataset.operatorId=unit.id;view.setAttribute('aria-label','Weapons console');
    view.innerHTML=`<header><div><small>REMOTE FIRE CONTROL / ${esc(unit.characterName)}</small><h2>${esc(initial.ship.title)}</h2></div><div class="weapon-turn"><strong data-turn role="status"></strong><progress data-command max="1" value="0" aria-label="Command window"></progress></div><div data-selector><button type="button" data-sound aria-label="Toggle sound">${bridge.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header><section class="weapon-plot"><h3>Targeting Array <span>MANUAL FIRE</span></h3><div data-map></div><div data-target-status></div></section><section class="weapon-controls"><h3>${esc(initial.definition.name)}</h3><label>Target<select data-target aria-label="Laser target"></select></label><label>Conserve Auxiliary Power<select data-sacrifice aria-label="Sacrificed damage dice"><option value="0">Full burst / 5 AU</option><option value="1">Sacrifice 1D4 / 4 AU</option><option value="2">Sacrifice 2D4 / 3 AU</option><option value="3">Sacrifice 3D4 / 2 AU</option></select></label><output data-au></output><p data-formula></p><small data-warning>AU is committed on submission. Sacrificed dice can leave a weak hit with no damage.</small><button type="button" data-fire>Fire Rapid Laser</button><p data-error role="alert"></p><div class="weapon-seat"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div></section><section class="weapon-processor"><h3>Command Processor</h3><div data-factors></div><progress data-input max="100" value="0" aria-label="Laser input"></progress><output data-input-text></output></section><section class="weapon-feed"><h3>Fire Control Reports</h3><div data-reports></div></section>`;
    host.body.append(view);view.showModal();
    const firing=host.createElement('div');firing.className='weapon-firing-controls';
    firing.append(view.querySelector('[data-fire]'),view.querySelector('[data-error]'),view.querySelector('.weapon-seat'));
    firing.append(view.querySelector('[data-warning]'));
    view.querySelector('.weapon-feed').prepend(firing);
    const get=s=>view.querySelector(s);const selection=()=>{const o=get('[data-target]').selectedOptions?.[0];return {targetId:o?.dataset.ship||o?.value||get('[data-target]').value||'',targetSicId:o?.dataset.component||null};};let boostsEdited=false,busy=false,lastMap='',lastTargets='',lastReports='',lastFactors='',beat=-1;
    const family=initial.definition.weaponFamily||'rapid-laser';
    const missile=initial.definition.missileLauncher?window.SAMissileUI.console(view,initial):null;
    const rail=family==='ballistic-rail-cannon',manualOnly=rail||initial.definition.manualOnly;
    get('[data-target]').setAttribute('aria-label','Weapon target');get('[data-input]').setAttribute('aria-label','Weapon input');
    get('header small').textContent=`${initial.remote?'REMOTE':'LOCAL'} FIRE CONTROL / ${unit.characterName}`;
    get('[data-sacrifice]').closest('label').hidden=family!=='rapid-laser';
    const boostLabel=host.createElement('label');boostLabel.innerHTML=`Extra D${initial.definition.damageDie} dice (${initial.definition.boostAu||0} AU each) <input data-boosts type="number" min="0" max="${100-(initial.definition.damageCount||0)}" step="1" value="0" aria-label="Extra damage dice">`;
    boostLabel.hidden=!initial.definition.boostAu;get('[data-au]').before(boostLabel);
    get('[data-fire]').textContent=family==='rapid-laser'?'Fire Rapid Laser':`Fire ${initial.definition.name}`;
    window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());
    function redraw(){
      const state=bridge.state(),person=state.units.find(u=>u.id===unit.id),access=window.SAStationAccess.access(state,person,sicId);
      if(!access || access.seat.key!==initial.seat.key){view.close();return;}
      const pending=person.delayedAction,ready=state.activeId===person.id&&!pending&&!person.delayTimer&&!person.timedAction&&!person.consoleHold;
get('[data-turn]').textContent=person.consoleHold?'HOLDING / 99%':pending?.awaitingRoll?'ROLL REQUIRED':pending?'FIRE CONTROL INPUT':ready?'YOUR TURN':window.SAConsoleCommon.standby(state,person);
      const command=state.command?.unitId===person.id?state.command:null;
      get('[data-command]').value=command?.total&&!command.expired?command.remaining/command.total:0;
      const now=Math.floor(performance.now()/1000),alerting=ready&&!state.hardPaused&&!state.holdPaused&&!host.hidden;
      view.dataset.flash=String(alerting&&performance.now()%1000<450);if(alerting&&now!==beat){beat=now;bridge.consoleTick();}
      const picture=window.SAShipSensors.view(state,access.ship.id),mapKey=JSON.stringify([picture.starships.map(s=>[s.id,s.title,s.destroyedAt,s.missileHeading,s.missilePhase,s.missileEndedAt]),picture.shipPositions]);
      if(mapKey!==lastMap){get('[data-map]').innerHTML=window.SASpaceMap.markup(picture.starships,picture.shipPositions,false,{navigation:true});lastMap=mapKey;}
      const chart=get('[data-map]'),svg=chart.querySelector('svg'),bounds=svg.viewBox.baseVal;
      const height=bounds.width*chart.clientHeight/Math.max(1,chart.clientWidth),middle=bounds.y+bounds.height/2;
      svg.setAttribute('viewBox',`${bounds.x} ${middle-height/2} ${bounds.width} ${height}`);
      for(const rect of svg.querySelectorAll(':scope > rect')){rect.setAttribute('y',middle-height/2);rect.setAttribute('height',height);}
      const observer=access.controlSource||access.ship,contacts=[...Object.values(observer.sensorState?.contacts||{}),...(access.controlled?[{id:observer.id,title:observer.title,level:'detected'}]:[])].filter(c=>c.level==='detected'&&c.id!==access.ship.id&&(!c.isMissile||c.missilePhase==='flying')),targets=contacts.map(c=>{const lock=window.SAShipWeapons.weaponLock(state,person,access.ship,c.id,access.controlled),known=window.SAShipSensors.analysis(observer,c.id)?.layout?.sicInventory||[];return `<option value="${esc(c.id)}">${esc(c.title)}</option>`+(lock?window.SAShipLocks.components(lock):[]).map(id=>{const item=known.find(i=>i.id===id);return item?`<option value="${esc(JSON.stringify([c.id,id]))}" data-ship="${esc(c.id)}" data-component="${esc(id)}">${esc(c.title)}: ${esc(window.SAShipMap.definition(item.type).name)}</option>`:'';}).join('');}).join('');
      if(targets!==lastTargets){const previous=get('[data-target]').value;get('[data-target]').innerHTML=targets||'<option value="">No detected targets</option>';get('[data-target]').value=[...get('[data-target]').options].some(o=>o.value===previous)?previous:contacts[0]?.id||'';lastTargets=targets;}
      const {targetId}=selection(),spec=window.SAShipWeapons.rollSpec(state,person,{shipId:access.ship.id,targetId,sicId}),settings=window.SAShipWeapons.settings(person,access.definition.tier);
      const ammo=rail?window.SAShipWeapons.ironAmmo(access.ship):0;
      get('[data-au]').textContent=rail?`${ammo} IRON / 1 PER SHOT / 0 EN / 0 AU`:`${access.ship.auState?.available??access.ship.auState?.current??0} AU AVAILABLE`;
      const surcharge=!rail&&access.ship.weaponState?.repeatWindow?.[sicId]>0?access.definition.energyCost:0;
      if(family==='ripple-cannon'&&!boostsEdited&&!busy&&!pending){
        const baseShot=window.SAShipWeapons.profile(access.definition,access.item,spec.range,{boosts:0});
        const available=access.ship.auState?.available??access.ship.auState?.current??0;
        get('[data-boosts]').value=String(baseShot.boostAllowed?Math.max(0,Math.min(100-access.definition.damageCount,Math.floor((available-surcharge-baseShot.cost)/access.definition.boostAu))):0);
      }
      const shot=window.SAShipWeapons.profile(access.definition,access.item,spec.range,{sacrifice:Number(get('[data-sacrifice]').value),boosts:Number(get('[data-boosts]').value)});
      const cost=shot.cost+surcharge,available=access.ship.auState?.available??access.ship.auState?.current??0,lock=!manualOnly&&window.SAShipWeapons.weaponLock(state,person,access.ship,targetId,access.controlled);
      get('[data-warning]').textContent=cost>available?`Not enough Auxiliary power: need ${cost}, have ${available}.`:`${cost} AU committed on fire; ${Number((available-cost).toFixed(1))} AU left. ${lock?'Locked shot: automatic hit, then roll damage.':'Accuracy roll, input delay, then damage roll if it hits.'}`;
      if(surcharge)get('[data-warning]').textContent+=` Repeat fire: +${surcharge} AU for ${Math.ceil(access.ship.weaponState.repeatWindow[sicId])} more combat seconds.`;
      get('.weapon-plot h3 span').textContent=manualOnly?'MANUAL ONLY':lock?'LOCKED FIRE':'MANUAL FIRE';
      [...get('[data-sacrifice]').options].forEach(option=>{const count=Number(option.value);option.textContent=`${count?`Sacrifice ${count}D${access.definition.damageDie}`:'Full burst'} / ${5-count+surcharge} AU${surcharge?' (repeat fire)':''}`;});
      window.SAConsoleCommon.updateSound(view);
      get('[data-formula]').textContent=lock?`LOCKED / ${shot.count}D${access.definition.damageDie}${shot.bonus?` + ${shot.bonus}`:''} damage. No accuracy roll required.`:access.definition.requiresLock?'TARGET LOCK REQUIRED. Establish a lock before firing.':`Dexterity + Weapon Systems + Hull Size Modifier ${access.definition.rangeStep?`+ ${shot.loss} range bonus`:`- range (${spec.range.toFixed(1)} Units)`}. ${spec.difficultyLabel}.`;
      if(family!=='rapid-laser')get('[data-formula]').textContent+=` Damage: ${shot.count}D${access.definition.damageDie}${shot.bonus?` + ${shot.bonus}`:''}.${access.definition.shieldPiercing?' Bypasses shields and damage reduction.':''}`;
      if(rail)get('[data-formula]').textContent+=' Manual only, including locked targets. Loses 2D6 per impairment point. No shield damage; shielded hull is protected.';
      if(!shot.count&&family!=='rapid-laser')get('[data-warning]').textContent='No damage dice remain. Reduce range or add available AU damage dice.';
      if(rail)get('[data-warning]').textContent=!shot.count?'No damage dice remain: repair the cannon before firing.':!ammo?'Out of ammunition: requires 1 Iron per shot.':'1 Iron committed on fire, including misses. Accuracy roll, Fast input, then manual damage only against unshielded hull.';
      if(!shot.boostAllowed&&initial.definition.boostAu)get('[data-warning]').textContent+=' Impaired: AU boosts unavailable.';
      get('[data-boosts]').disabled=busy||Boolean(pending)||!shot.boostAllowed;
      get('[data-target-status]').textContent=targetId?`TARGET / ${contacts.find(c=>c.id===targetId)?.title} / ${lock?'LOCKED':'MANUAL'} / Defense ${spec.difficulty??'?'}`:'Detect a contact with Sensors before firing.';
      const factors=`<span>${bridge.delayIcon(settings.factors.Quality)} Weapon Grade</span><span>${bridge.delayIcon(settings.factors.Ingenuity)} Operator Sync</span><span>FAST<br>${(100/settings.rate).toFixed(1)} SEC</span>`;
      if(factors!==lastFactors){get('[data-factors]').innerHTML=factors;lastFactors=factors;}
      get('[data-input]').value=pending?.weaponOrder&&!pending.awaitingRoll?100-pending.remaining:0;
      get('[data-input-text]').textContent=pending?.awaitingRoll?'Awaiting dice confirmation':pending?.weaponOrder?`Firing in ${(pending.remaining/pending.rate).toFixed(1)} seconds`:'Fire control ready';
      get('[data-fire]').disabled=busy||!ready||!targetId||cost>available||(rail&&!ammo)||!get('[data-boosts]').validity.valid||(access.definition.requiresLock&&!lock)||(!shot.count&&family!=='rapid-laser')||(!shot.boostAllowed&&Number(get('[data-boosts]').value)>0);get('[data-sacrifice]').disabled=busy||Boolean(pending);
      get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-hold]').disabled=busy||(!ready&&!person.consoleHold);get('[data-leave]').disabled=busy||!ready;
      const fire=get('[data-fire]');let reason=fire.nextElementSibling;
      if(!reason?.matches('[data-fire-reason]')){reason=document.createElement('small');reason.dataset.fireReason='';fire.after(reason);}
      reason.textContent=busy?'Submitting action...':!ready?(pending?'Finish the current action first.':'Available on your turn.'):!targetId?'Select a detected target.':cost>available?`Requires ${cost} AU; ${available} available.`:rail&&!ammo?'No ammunition available.':access.definition.requiresLock&&!lock?'Lock onto this target first.':!shot.count&&family!=='rapid-laser'?'No damage dice at this range without an AU boost.':!shot.boostAllowed&&Number(get('[data-boosts]').value)>0?'This shot cannot use an AU boost.':!get('[data-boosts]').validity.valid?'Choose a valid AU boost.':'';
      reason.hidden=!fire.disabled;reason.style.cssText='display:block;color:#f2d58b;font-size:12px;margin:4px 0';if(reason.hidden)reason.style.display='none';
      if(missile)missile.update(state,person,access,ready,busy);
      const reports=(access.ship.weaponState?.reports||[]).map(e=>`<article class="${e.hit?'weapon-hit':e.shot?'weapon-miss':''}"><time>${esc(new Date(e.at).toLocaleTimeString())}</time><p>${esc(e.text)}</p>${e.dice?.length?`<small>Damage dice ${e.dice.join(' + ')}</small>`:''}</article>`).join('')||'<p>No shots fired.</p>';
      if(reports!==lastReports){get('[data-reports]').innerHTML=reports;lastReports=reports;}
    }
    get('[data-fire]').onclick=async()=>{if(busy)return;const person=bridge.state().units.find(u=>u.id===unit.id);if(!bridge.confirmGmPlayerAction(person,'weaponCommand'))return;busy=true;get('[data-error]').textContent='';redraw();try{await bridge.action({action:'weaponCommand',id:unit.id,sicId,...selection(),sacrifice:Number(get('[data-sacrifice]').value),boosts:Number(get('[data-boosts]').value),...(missile?missile.order():{}),requestId:crypto.randomUUID()},'resolve',{throwOnError:true});if(view.classList.contains('combat-order-dialog'))view.close();}catch(error){get('[data-error]').textContent=error.message;}finally{busy=false;if(view.isConnected)redraw();}};
    view.onchange=event=>{if(event.target.matches('[data-boosts]'))boostsEdited=true;redraw();};
    view.oninput=event=>{if(event.target.matches('[data-boosts]'))boostsEdited=true;redraw();};
    const dismiss=()=>window.SAShipNavigationUI.remember(bridge.state().units.find(u=>u.id===unit.id));
    get('[data-close]').onclick=()=>{dismiss();view.close();};get('[data-sound]').onclick=()=>bridge.toggleSound();
    get('[data-leave]').onclick=()=>{const person=bridge.state().units.find(u=>u.id===unit.id);if(!bridge.confirmGmPlayerAction(person,'leaveStation'))return;view.close();window.SACombatMap.openMove(person);};
    get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(bridge.state().units.find(u=>u.id===unit.id));}catch(e){get('[data-error]').textContent=e.message;}};
    view.addEventListener('cancel',dismiss);view.addEventListener('pointerdown',bridge.resumeAudio,{passive:true});
    const timer=setInterval(redraw,200),cleanup=()=>{clearInterval(timer);view.remove();dialog=null;window.removeEventListener('pagehide',cleanup);setTimeout(()=>bridge.requestRender(),0);};
    view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  window.SAWeaponConsoleUI={open,isOpen:()=>Boolean(dialog)};
  const seen=new Set();let initialized=false;
  function effects(){
    if(window.SACombatFeedback)return;
    const state=window.SACombatBridge?.state();if(!state)return;
    const reports=state.starships.flatMap(s=>(s.weaponState?.reports||[]).map(e=>({...e,shipId:s.id})));
    for(const e of reports){if(seen.has(e.id))continue;seen.add(e.id);if(!initialized||!e.shot||Date.now()-Date.parse(e.at)>3000)continue;
      let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
      const docs=[document,doc];
      for(const surface of new Set(docs))for(const svg of surface.querySelectorAll('[data-space-canvas]')){
        const from=svg.querySelector(`[data-space-ship="${CSS.escape(e.shipId)}"]`),to=svg.querySelector(`[data-space-ship="${CSS.escape(e.targetId)}"]`);
        if(!to)continue;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(from&&from!==to&&!reduced){const line=surface.createElementNS('http://www.w3.org/2000/svg','line');const p=new DOMPoint(0,0).matrixTransform(from.getCTM()).matrixTransform(svg.getCTM().inverse()),q=new DOMPoint(0,0).matrixTransform(to.getCTM()).matrixTransform(svg.getCTM().inverse());line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);line.setAttribute('x2',q.x);line.setAttribute('y2',q.y);line.setAttribute('stroke','#ffedb0');line.setAttribute('stroke-width','.09');line.dataset.laserEffect='';svg.append(line);line.animate([{opacity:0},{opacity:1},{opacity:0}],{duration:300});setTimeout(()=>line.remove(),300);}
        if(e.hit){const circle=to.querySelector('circle')||to,color=surface.defaultView.getComputedStyle(circle).fill;circle.animate(reduced?[{fill:'#ff3048'},{fill:color}]:[{transform:'translateX(0)',fill:color},{transform:'translateX(.15px)',fill:'#ff3048'},{transform:'translateX(-.15px)',fill:'#ff3048'},{transform:'translateX(0)',fill:color}],{duration:650,delay:reduced?0:200});}
      }
    }
    initialized=true;if(seen.size>2000){seen.clear();reports.forEach(e=>seen.add(e.id));}
  }
  const timer=setInterval(effects,150);window.addEventListener('pagehide',()=>clearInterval(timer));
}());
