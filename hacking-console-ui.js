(function(){
  let active=null;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function host(){let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;}
  function style(doc){if(doc.querySelector('[data-hacking-style]'))return;const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('hacking-console.css',location.href).href;link.dataset.hackingStyle='';doc.head.append(link);}
  function open(unit,sicId){
    if(active)return;
    const b=window.SACombatBridge,initial=window.SAStationAccess.access(b.state(),unit,sicId);if(!initial||initial.kind!=='hacking')return;
    const doc=host();style(doc);const view=doc.createElement('dialog');active=view;view.className='hacking-console';view.dataset.operatorId=unit.id;view.setAttribute('aria-label','Hacking console');
    view.innerHTML=`<header><div><small>${esc(unit.characterName)}</small><h2>${esc(initial.definition.name)}</h2><strong data-turn></strong></div><div data-selector><button type="button" data-sound aria-label="Toggle sound">${b.soundIcon()}</button><button type="button" data-close>Combat View</button></div></header><main><section class="hacking-targets"><label>Analyzed Ship<select data-target></select></label><label>Target SIC<select data-component></select></label><button type="button" data-connect>Open Intrusion</button><label>My Intrusions<select data-session></select></label><p data-qualification></p></section><section class="hacking-board"><h3 data-board-title>Password</h3><strong data-board-status></strong><div class="hacking-palette" data-palette></div><div class="hacking-slots" data-slots></div><div class="hacking-actions"><button type="button" data-guess>Submit Guess</button><button type="button" data-off>Turn Off SIC</button><button type="button" data-impair>Force Impairment</button><button type="button" data-disconnect>Disconnect</button></div><div data-history></div></section><p data-error role="alert"></p><div class="hacking-seat"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div></main>`;
    const get=s=>view.querySelector(s);let selected='',busy=false,boardKey='',targetsKey='',sessionsKey='',pending=null;
    const captured=doc.createElement('strong');captured.className='console-hack-banner';captured.dataset.captured='';captured.textContent='CAPTURED';captured.hidden=true;get('header>div').prepend(captured);
    const storageKey=`sa-live-hacking:${b.state().roomCode}:${unit.id}:${sicId}`;
    let drafts={};try{drafts=JSON.parse(sessionStorage.getItem(storageKey)||'{}');selected=drafts.selected||'';pending=drafts.pending||null;}catch{}
    const save=()=>{drafts.selected=selected;drafts.pending=pending;try{sessionStorage.setItem(storageKey,JSON.stringify(drafts));}catch{}};
    const person=()=>b.state().units.find(u=>u.id===unit.id);
    const session=()=>person()?.hackingSessions?.find(s=>s.id===selected);
    function components(){const ship=b.state().starships.find(s=>s.id===initial.ship.id),analysis=ship?.sensorState?.analyses?.[get('[data-target]').value];const old=get('[data-component]').value;
      const options=(analysis?.layout?.sicInventory||[]).filter(i=>Number.isInteger(window.SAShipMap.definition(i.type).security)&&window.SAShipMap.definition(i.type).security>0).map(i=>`<option value="${esc(i.id)}">${esc(window.SAShipMap.definition(i.type).name)}</option>`).join('');
      if(get('[data-component]').innerHTML!==options){get('[data-component]').innerHTML=options;get('[data-component]').value=[...get('[data-component]').options].some(o=>o.value===old)?old:get('[data-component]').options[0]?.value||'';}}
    async function send(payload){
      if(busy||!b.confirmGmPlayerAction(person(),payload.kind))return;
      if(pending&&JSON.stringify(pending.intent)!==JSON.stringify(payload)){get('[data-error]').textContent='Retry the previous submission before changing operations.';return;}
      pending ||= {intent:payload,body:{action:'hackingCommand',id:unit.id,turnSerial:person().turnSerial,requestId:crypto.randomUUID(),...payload}};save();busy=true;redraw();
      try{await b.action(pending.body,'resolve',{throwOnError:true});pending=null;get('[data-error]').textContent='';if(payload.kind==='open'){selected=person().hackingSessions?.filter(s=>s.moduleId===sicId&&s.targetId===payload.targetId&&s.sicId===payload.targetSicId&&!s.invalidated).at(-1)?.id||selected;}save();}
      catch(error){if(error.status>=400&&error.status<500){pending=null;save();}get('[data-error]').textContent=error.message+(pending?' Retry uses the same submission.':'');}
      finally{busy=false;redraw();}
    }
    function redraw(){
      const state=b.state(),u=person(),access=window.SAStationAccess.access(state,u,sicId);if(!access){view.close();return;}
      const ready=state.activeId===u.id&&!u.delayedAction&&!u.consoleHold&&!u.timedAction&&!u.delayTimer;
      get('[data-turn]').textContent=state.practice?'OUT OF COMBAT':ready?'YOUR TURN':window.SAConsoleCommon.standby(state,u);
      const rating=u.hackingSkill??(u.team==='npc'?u.mentalSkill:0)??0;
      get('[data-qualification]').textContent=`Hacking ${rating} / Requires ${initial.definition.hackingMinimum} / One guess per earned action`;
      const source=state.starships.find(s=>s.id===initial.ship.id),targets=Object.values(source?.sensorState?.contacts||{}).filter(c=>c.level==='detected'&&source.sensorState.analyses?.[c.id]);
      const targetOptions=targets.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')||'<option value="">Systems Analysis required</option>';
      if(targetOptions!==targetsKey){const old=get('[data-target]').value;get('[data-target]').innerHTML=targetOptions;if(targets.some(t=>t.id===old))get('[data-target]').value=old;targetsKey=targetOptions;}components();
      const sessions=(u.hackingSessions||[]).filter(s=>s.moduleId===sicId),sessionOptions=sessions.map(s=>`<option value="${esc(s.id)}">${esc(state.starships.find(t=>t.id===s.targetId)?.title||'Lost contact')} / ${esc(window.SAShipMap.definition(state.starships.find(t=>t.id===s.targetId)?.ship.sicInventory.find(i=>i.id===s.sicId)?.type).name||'SIC')}${s.invalidated?' / rebooted':''}</option>`).join('');
      if(sessionsKey!==sessionOptions){get('[data-session]').innerHTML=sessionOptions;sessionsKey=sessionOptions;}
      if(!sessions.some(s=>s.id===selected))selected=sessions.at(-1)?.id||'';get('[data-session]').value=selected;
      captured.hidden=!sessions.some(s=>(s.captured||s.control)&&s.targetId===get('[data-target]').value&&s.sicId===get('[data-component]').value);
      const board=session(),key=JSON.stringify(board);
      if(key!==boardKey){
        boardKey=key;const draft=drafts[selected]||[];
        get('[data-palette]').innerHTML=(board?.candidates||[]).map(letter=>`<button type="button" data-letter="${letter}" style="--letter-hue:${(letter.charCodeAt(0)-65)*137.5%360}">${letter}</button>`).join('');
        get('[data-slots]').innerHTML=Array.from({length:board?.length||0},(_,i)=>`<label><span>${i+1}</span><select data-slot="${i}" aria-label="Password position ${i+1}"><option value="">-</option>${board.candidates.map(letter=>`<option value="${letter}"${draft[i]===letter?' selected':''}>${letter}</option>`).join('')}</select></label>`).join('');
        get('[data-history]').innerHTML=(board?.history||[]).slice().reverse().map((row,i)=>`<p class="hacking-history${row.success?' solved':''}"><b>${(board?.history.length||0)-i}.</b> <code>${row.guess.join(' ')}</code><span>${row.exact} exact / ${row.misplaced} elsewhere${row.stale?' / previous code':''}</span></p>`).join('');
      }
      get('[data-board-status]').textContent=!board?'Choose an analyzed SIC.':board.invalidated?'SIC rebooted. Open a new intrusion.':board.control?'ACCESS GRANTED / Console captured':board.codeChanged?'Password changed. Previous guesses remain in history.':!board.connected?'DISCONNECTED / Submit a guess on your turn to reconnect':`${board.length} positions / ${board.candidates.length} available letters`;
      get('[data-connect]').disabled=busy||state.practice||!get('[data-component]').value||rating<initial.definition.hackingMinimum;
      get('[data-guess]').disabled=busy||!board||board.invalidated||(!pending&&(!ready||board.control));get('[data-guess]').textContent=pending?.intent.kind==='guess'?'Retry Guess':'Submit Guess';
      const retryOff=pending?.intent.kind==='off';get('[data-off]').hidden=!board?.control&&!retryOff;get('[data-off]').disabled=busy||(!retryOff&&(!ready||!!pending));get('[data-off]').textContent=retryOff?'Retry Turn Off':'Turn Off SIC';
      get('[data-impair]').disabled=busy||!ready||!board?.control;
      get('[data-disconnect]').disabled=busy||!board?.connected;
      get('[data-hold]').textContent=u.consoleHold?'Resume':'Hold';get('[data-hold]').disabled=busy||(!ready&&!u.consoleHold);get('[data-leave]').disabled=busy||!ready;
    }
    get('[data-target]').onchange=components;get('[data-session]').onchange=()=>{selected=get('[data-session]').value;save();boardKey='';redraw();};
    get('[data-slots]').onchange=()=>{drafts[selected]=[...view.querySelectorAll('[data-slot]')].map(s=>s.value);save();};
    get('[data-palette]').onclick=event=>{const letter=event.target.closest('[data-letter]')?.dataset.letter;if(!letter)return;const slots=[...view.querySelectorAll('[data-slot]')];const slot=slots.find(s=>!s.value);if(slot){slot.value=letter;get('[data-slots]').onchange();slot.focus();}};
    get('[data-connect]').onclick=()=>send({kind:'open',sicId,targetId:get('[data-target]').value,targetSicId:get('[data-component]').value});
    get('[data-guess]').onclick=()=>send(pending?.intent||{kind:'guess',sessionId:selected,guess:[...view.querySelectorAll('[data-slot]')].map(s=>s.value)});
    get('[data-off]').onclick=()=>send(pending?.intent||{kind:'off',sessionId:selected});
    get('[data-impair]').onclick=()=>send({kind:'impair',sessionId:selected});get('[data-disconnect]').onclick=()=>send({kind:'disconnect',sessionId:selected});
    get('[data-close]').onclick=()=>{window.SAShipNavigationUI.remember(unit);view.close();};get('[data-sound]').onclick=()=>b.toggleSound();
    get('[data-hold]').onclick=()=>window.SAShipNavigationUI.toggleHold(person()).catch(e=>get('[data-error]').textContent=e.message);
    get('[data-leave]').onclick=()=>{const u=person();if(!b.confirmGmPlayerAction(u,'leaveStation'))return;view.close();window.SACombatMap.openMove(u);};
    doc.body.append(view);view.showModal();window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());redraw();
    const timer=setInterval(redraw,250),cleanup=()=>{clearInterval(timer);view.remove();active=null;window.removeEventListener('pagehide',cleanup);};
    view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});
  }
  function counterSwap(unit){
    const request=unit.counterHackSwap;if(!request)return;
    const doc=host();style(doc);const view=doc.createElement('dialog');view.className='counter-hack-swap';view.setAttribute('aria-label','Counter-hack password swap');
    view.innerHTML=`<h2>Counter-hack Succeeded</h2><label>First position<select data-first>${Array.from({length:request.length},(_,i)=>`<option value="${i}">${i+1}</option>`).join('')}</select></label><label>Second position<select data-second>${Array.from({length:request.length},(_,i)=>`<option value="${i}"${i===1?' selected':''}>${i+1}</option>`).join('')}</select></label><button type="button" data-swap>Swap Positions</button><p role="alert"></p><button type="button" data-close>Later</button>`;
    view.querySelector('[data-swap]').onclick=async()=>{try{await window.SACombatBridge.action({action:'counterHackSwap',id:unit.id,swapId:request.id,first:Number(view.querySelector('[data-first]').value),second:Number(view.querySelector('[data-second]').value)},'resolve',{throwOnError:true});view.close();}catch(e){view.querySelector('[role=alert]').textContent=e.message;}};
    view.querySelector('[data-close]').onclick=()=>view.close();view.addEventListener('close',()=>view.remove(),{once:true});doc.body.append(view);view.showModal();
  }
  let swapNotice=null;
  const poll=setInterval(()=>{
    const b=window.SACombatBridge;if(!b)return;
    const unit=b.state()?.units.find(u=>u.counterHackSwap&&(b.mode()==='gm'?(u.team==='npc'||u.counterHackSwap.rollController==='gm'):u.id===b.myUnitId()&&u.counterHackSwap.rollController!=='gm'));
    if(!unit){swapNotice?.remove();swapNotice=null;return;}
    if(!swapNotice){swapNotice=host().createElement('button');swapNotice.type='button';swapNotice.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#e8cc76;color:#172221;padding:12px;border:1px solid #fff;border-radius:4px;font:700 15px Arial';host().body.append(swapNotice);}
    swapNotice.textContent=`${unit.characterName}: Finish Counter-hack`;
    swapNotice.onclick=()=>{if(!host().querySelector('.counter-hack-swap'))counterSwap(unit);};
  },300);
  window.addEventListener('pagehide',()=>{clearInterval(poll);swapNotice?.remove();});
  window.SAHackingConsoleUI={open,isOpen:()=>Boolean(active),counterSwap};
}());
