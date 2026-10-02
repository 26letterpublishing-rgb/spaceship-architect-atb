(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function host(){let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;}
  function consoleFields(view,initial,reload){
    const doc=view.ownerDocument,fields=doc.createElement('div');fields.dataset.missileFields='';
    fields.innerHTML='<label>Loaded ammunition<select data-ammunition aria-label="Loaded ammunition"></select></label><div data-flare-fields hidden></div><label data-seeker-label hidden><input type="checkbox" data-seeker> Fit Magnetic Seeker (one from storage)</label><div class="missile-magazine-row"><output data-magazine></output></div><button type="button" data-reload>Reload from Storage</button><small data-reload-reason></small>';
    view.querySelector('[data-sacrifice]').closest('label').before(fields);
    fields.querySelector('[data-reload]').onclick=()=>reload?.();
    let signature='';
    function order(){return {ammunition:fields.querySelector('select').value,seeker:fields.querySelector('[data-seeker]').checked,flares:[...fields.querySelectorAll('[data-flare-row]')].map(row=>({targetId:row.querySelector('[data-flare-target]').value,result:row.querySelector('[data-coin]').value,direction:row.querySelector('[data-direction]').value===''?null:Number(row.querySelector('[data-direction]').value)}))};}
    function update(state,unit,access,ready,busy){
      if(access.definition.phazonTorpedo){updateTorpedo(state,unit,access,ready,busy);return;}
      const magazine=window.SAMissileAmmo.magazine(access.ship,access.id),choices=Object.entries(magazine).filter(([,count])=>count>0),select=fields.querySelector('[data-ammunition]'),key=JSON.stringify(choices);
      if(signature!==key){const old=select.value;select.innerHTML=choices.map(([id,count])=>`<option value="${esc(id)}">${esc(window.SAMissileAmmo.catalog[id]?.name||id)} (${count})</option>`).join('')||'<option value="">Empty magazine</option>';if(choices.some(([id])=>id===old))select.value=old;signature=key;}
      const round=window.SAMissileAmmo.catalog[select.value],flares=fields.querySelector('[data-flare-fields]'),observer=access.controlSource||access.ship;
      flares.hidden=!round?.flares;fields.querySelector('[data-seeker-label]').hidden=!round?.mine||round.web;fields.querySelector('[data-seeker]').disabled=!(window.SAMissileAmmo.storage(access.ship)['magnetic-seeker']>0);if(fields.querySelector('[data-seeker]').disabled)fields.querySelector('[data-seeker]').checked=false;
      const contacts=Object.values(observer.sensorState?.contacts||{}).filter(c=>c.level==='detected'&&c.isMissile&&c.missilePhase==='flying');
      if(round?.flares){
        if(!flares.childElementCount)flares.innerHTML=Array.from({length:3},(_,i)=>`<fieldset data-flare-row><legend>Flare ${i+1}</legend><label>Missile<select data-flare-target aria-label="Flare ${i+1} target"></select></label><label>Coin flip<select data-coin aria-label="Flare ${i+1} coin"><option value="">Confirm flip</option><option value="heads">Heads: deflect</option><option value="tails">Tails: no effect</option></select></label><label>Direction roll (D6)<select data-direction aria-label="Flare ${i+1} direction"><option value="">Confirm D6</option>${['East','Southeast','Southwest','West','Northwest','Northeast'].map((s,n)=>`<option value="${n}">${n+1}: ${s}</option>`).join('')}</select></label></fieldset>`).join('');
        for(const target of flares.querySelectorAll('[data-flare-target]')){const markup=contacts.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');if(target.dataset.key!==markup){const old=target.value;target.innerHTML=markup;target.dataset.key=markup;if(contacts.some(c=>c.id===old))target.value=old;}}
      }
      for(const row of flares.querySelectorAll('[data-flare-row]'))row.querySelector('[data-direction]').disabled=row.querySelector('[data-coin]').value!=='heads';
      const target=view.querySelector('[data-target]'),targetId=target.selectedOptions[0]?.dataset.ship||target.value,lock=window.SAShipWeapons.weaponLock(state,unit,access.ship,targetId,access.controlled&&!access.remotePilot),cooldown=access.ship.ship.missileState?.cooldowns?.[access.id]||0;
      const pending=unit.delayedAction;
      const stored=Object.entries(window.SAMissileAmmo.storage(access.ship)).filter(([id])=>!window.SAMissileAmmo.catalog[id]?.seeker&&Boolean(window.SAMissileAmmo.catalog[id]?.mine)===Boolean(access.definition.mineLauncher)).reduce((n,[id,v])=>n+v,0),reloadReason=access.remote||access.controlled?'Station physically at the launcher to reload.':!ready||busy||state.rollPaused?'Available on your turn after current actions finish.':window.SAMissileAmmo.used(access.ship,access.id)>=access.definition.capacity?'Magazine full.':!stored?'No missiles in storage.':'';
      fields.querySelector('[data-reload]').disabled=Boolean(reloadReason);fields.querySelector('[data-reload-reason]').textContent=`Storage: ${stored} rounds. ${reloadReason}`;
      fields.querySelector('[data-magazine]').textContent=`MAGAZINE ${window.SAMissileAmmo.used(access.ship,access.id)} / ${access.definition.capacity}`;
      view.querySelector('[data-fire]').textContent=round?.flares?'Deploy Missile Flares':`Launch ${round?.name||'Missile'}`;
      view.querySelector('[data-warning]').textContent=cooldown>0?`Launcher cycling: ${cooldown.toFixed(1)} active seconds.`:!round?'Magazine empty. Reload from storage at the launcher.':round.flares?'Three manual coin flips. For heads, roll D6 for deflection direction.':!lock?'Acquire a target Lock-On first.':'Lock acquired. Launched missiles keep pursuing even after the lock is lost.';
      view.querySelector('[data-formula]').textContent=round?.flares?'Three flares / one magazine slot':round?`${round.count>1?'Four independent missiles, each ':''}${round.dice}D8 x5 hull damage; no multiplier against shields. Defense ${round.masking}. Speed ${round.acceleration} Units/12s; +${round.acceleration} every 12 active seconds, maximum ${round.acceleration*5}.`:'';
      view.querySelector('[data-au]').textContent=`${access.ship.auState?.available??access.ship.auState?.current??0} AU / LAUNCH 0 AU`;
      view.querySelector('[data-input]').value=pending?.missileOrder?100-pending.remaining:0;
      view.querySelector('[data-input-text]').textContent=pending?.missileOrder?`${pending.missileOrder.reload?"Reload":"Launch"} input: ${(pending.remaining/pending.rate).toFixed(1)} seconds`:cooldown>0?`Launcher cycling: ${cooldown.toFixed(1)} active seconds${!state.running||state.pausedForTurn||state.hardPaused||state.rollPaused?' — ATB paused':''}`:'Launcher ready';
      target.closest('label').hidden=Boolean(round?.flares||round?.mine);
      const valid=round?.mine?true:round?.flares?order().flares.length===3&&order().flares.every(f=>f.result&&(f.result==='tails'||Number.isInteger(f.direction))&&contacts.some(c=>c.id===f.targetId)):lock;
      view.querySelector('[data-fire]').disabled=Boolean(busy||!ready||!round||cooldown>0||!valid||state.rollPaused);
      const reason=view.querySelector('[data-fire-reason]');if(reason){reason.textContent=busy?'Submitting launch...':!ready?'Available on your turn after current actions finish.':!round?'Magazine empty. Reload from storage at the launcher.':cooldown>0?`Launcher cycling: ${cooldown.toFixed(1)} seconds.`:!valid?(round.flares?'Complete the flare targets and dice results.':'Lock onto the target first.'):state.rollPaused?'Finish the pending dice roll.':'';reason.hidden=!view.querySelector('[data-fire]').disabled;reason.style.display=reason.hidden?'none':'block';}
      if(round?.mine){view.querySelector('[data-warning]').textContent=cooldown>0?`Launcher cycling: ${cooldown.toFixed(1)} active seconds.`:'Deploy on your current hex. Maximum three mines per hex. Your ship is immune.';view.querySelector('[data-formula]').textContent=round.description;}
      select.disabled=busy||Boolean(pending);
    }
    function updateTorpedo(state,unit,access,ready,busy){
      fields.hidden=true;const target=view.querySelector('[data-target]'),id=target.selectedOptions[0]?.dataset.ship||target.value,lock=window.SAShipWeapons.weaponLock(state,unit,access.ship,id,access.controlled&&!access.remotePilot),stock=Number(access.ship.ship.minerals?.Phazon)||0,cooldown=access.ship.ship.missileState?.cooldowns?.[access.id]||0,au=(access.ship.auState?.available||0),a=window.SAShipTargets.point(state,access.ship.id),b=window.SAShipTargets.point(state,id),range=a&&b?window.SAShipDistances.hexDistance(a,b):Infinity,impaired=access.item.impaired||access.item.impairmentPoints||access.item.status==='impaired';
      const reason=busy?'Submitting launch…':!ready?'Available on your turn.':state.rollPaused?'Finish pending dice.':cooldown>0?`Launcher cycling: ${cooldown.toFixed(1)} active seconds.`:!lock?'Acquire a target Lock-On.':range>24?'Target exceeds 24 units.':stock<1?'One Phazon required.':au<8?'8 AU required.':'';
      view.querySelector('[data-fire]').textContent='Launch Phazon Torpedo';view.querySelector('[data-fire]').disabled=Boolean(reason);view.querySelector('[data-warning]').textContent=reason||'Target locked. Torpedo follows until impact or 24 units traveled.';view.querySelector('[data-formula]').textContent=(impaired?'3D8':'3D10 ×2')+' damage to shields or Hull. Speed 8 units / 12 active seconds. Cannot be shot down.';view.querySelector('[data-au]').textContent=`${au} AU / LAUNCH 8 AU · Phazon ${stock}`;view.querySelector('[data-input-text]').textContent=unit.delayedAction?.missileOrder?'Launch input in progress':reason||'Launcher ready';const hint=view.querySelector('[data-fire-reason]');if(hint){hint.textContent=reason;hint.hidden=!reason;hint.style.display=reason?'block':'none';}
    }
    return {order,update};
  }
  let panel,dialog,lastKey='';
  function update(){
    const bridge=window.SACombatBridge,state=bridge?.state();if(!state)return;
    const doc=host(),gm=bridge.mode()==='gm',mine=state.units.find(u=>u.id===bridge.myUnitId());
    const waiting=(state.missileRolls?.filter(m=>!m.automated))||window.SAShipTargets.flights(state).filter(m=>m.phase==='impact'&&(gm||(m.controller!=='gm'&&m.characterId&&m.characterId===mine?.characterId)));
    if(!panel){panel=doc.createElement('aside');panel.setAttribute('popover','manual');panel.setAttribute('aria-label','Missile impact pending');panel.style.cssText='position:fixed;inset:8px auto auto 50%;transform:translateX(-50%);margin:0;padding:8px;background:#081922;color:#fff;border:1px solid #7fd3df;z-index:2147483647';doc.body.append(panel);}
    if(!waiting.length){if(panel.matches(':popover-open'))panel.hidePopover();lastKey='';if(dialog)dialog.close();return;}
    const key=waiting.map(m=>m.id).join('|');
    if(key!==lastKey){panel.innerHTML=waiting.map(m=>`<button type="button" style="background:#173a47;color:white;border:1px solid #7fd3df;padding:8px" data-missile="${esc(m.id)}">Resolve ${esc(m.name)} damage for player</button>`).join('');lastKey=key;panel.onclick=e=>{const id=e.target.closest('[data-missile]')?.dataset.missile,m=waiting.find(m=>m.id===id);if(m&&doc.defaultView.confirm('Resolve this player’s missile damage as GM?'))openDamage(m,bridge);};}
    if(dialog){if(!waiting.some(m=>m.id===dialog.dataset.rollId))dialog.close();if(panel.matches(':popover-open'))panel.hidePopover();return;}
    const owned=waiting.find(m=>gm?(m.controller==='gm'||!m.characterId):m.characterId===mine?.characterId&&m.controller!=='gm');
    if(owned){openDamage(owned,bridge);return;}
    if(!gm)return;
    const top=[...doc.querySelectorAll('dialog[open]')].at(-1)||doc.body;if(panel.parentElement!==top)top.append(panel);if(!panel.matches(':popover-open'))panel.showPopover();
  }
  function openDamage(m,bridge){
    if(dialog)return;
    const doc=host(),view=dialog=doc.createElement('dialog');view.dataset.rollId=m.id;view.setAttribute('aria-label','Missile Damage');
    view.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent';
    const frame=doc.createElement('iframe');frame.title='Missile damage dice';frame.style.cssText='width:100%;height:100%;border:0;background:transparent';
    const status=doc.createElement('div');status.setAttribute('role','status');status.style.cssText='position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);padding:20px;background:#081922;color:#fff;border:1px solid #ff8991;font:16px Arial';
    const message=doc.createElement('p'),retry=doc.createElement('button');retry.type='button';status.append(message,retry);
    let timer,busy=false,submitted=null;
    const watch=()=>{clearTimeout(timer);status.hidden=false;message.textContent='Loading damage dice...';retry.textContent='Retry Loading Dice';retry.hidden=true;timer=setTimeout(()=>{message.textContent='The dice window has not finished loading.';retry.hidden=false;},3000);};
    const load=()=>{watch();frame.src=new URL('character.html?shipRoll=1',location.href).href;};
    const submit=async()=>{
      if(busy||!submitted)return;busy=true;status.hidden=false;message.textContent='Submitting damage...';retry.hidden=true;
      try{await bridge.action({action:'missileDamage',id:bridge.mode()==='gm'?m.unitId:bridge.myUnitId(),missileId:m.id,score:submitted.score,diceResults:submitted.diceResults},'resolve',{throwOnError:true});view.close();}
      catch(error){message.textContent=error.message;retry.textContent='Retry Submit';retry.hidden=false;}
      finally{busy=false;}
    };
    retry.onclick=()=>submitted?submit():load();
    const receive=event=>{
      if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
      if(event.data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:m.id,sides:Array(m.dice).fill(m.dieSides||8),bonus:0,skill:'Damage',damage:true,damageMultiplier:m.damageMultiplier||1,immediateResult:true,difficulty:null,difficultyLabel:`Damage ×${m.damageMultiplier||1} — included in the result.`,name:m.name,title:m.name+' damage: '+m.dice+'D'+(m.dieSides||8)},location.origin);
      if(event.data?.type==='sa-ship-skill-opened'&&event.data.rollId===m.id){clearTimeout(timer);status.hidden=true;}
      // Required impact damage remains available until confirmed or invalidated by the server.
      if(event.data?.type==='sa-ship-skill-result'&&event.data.rollId===m.id&&!submitted){submitted={score:event.data.score,diceResults:event.data.diceResults};void submit();}
    };
    doc.defaultView.addEventListener('message',receive);
    view.addEventListener('close',()=>{clearTimeout(timer);doc.defaultView.removeEventListener('message',receive);if(panel?.parentElement===view)doc.body.append(panel);view.remove();dialog=null;},{once:true});
    view.addEventListener('cancel',event=>event.preventDefault());
    view.append(frame,status);doc.body.append(view);view.showModal();if(panel?.matches(':popover-open'))panel.hidePopover();load();
  }
  window.SAMissileUI={console:consoleFields};
  const timer=setInterval(update,200);window.addEventListener('pagehide',()=>{clearInterval(timer);dialog?.close();panel?.remove();});
}());
