(function(){
  let sound=null,phase='',detectionReady=false;
  const detections=new Set();
  let typingAudio=null;
  function typing(){
    try{typingAudio ||= new AudioContext();typingAudio.resume();}catch{return null;}
    const timer=setInterval(()=>{if(!bridge()?.soundEnabled()||host().hidden)return;const ctx=typingAudio,t=ctx.currentTime,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.018),ctx.sampleRate),values=buffer.getChannelData(0);for(let i=0;i<values.length;i++)values[i]=(Math.random()*2-1)*Math.exp(-i/values.length*5);const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=700+Math.random()*1800;filter.Q.value=.8;gain.gain.value=.045;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};},90);
    return {stop:()=>clearInterval(timer)};
  }
  const bridge=()=>window.SACombatBridge;
  function host(){let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;}
  function hexAt(event,svg){
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const fq=Math.sqrt(3)/3*p.x-p.y/3,fr=2*p.y/3;let q=Math.round(fq),r=Math.round(fr),s=Math.round(-fq-fr);
    if(Math.abs(q-fq)>Math.abs(s+fq+fr)&&Math.abs(q-fq)>Math.abs(r-fr))q=-s-r;else if(Math.abs(r-fr)>Math.abs(s+fq+fr))r=-q-s;
    return {q,r};
  }
  function mark(svg,hex,locked){
    const existing=svg.querySelector('[data-hex-feedback]'),key=hex?`${hex.q},${hex.r},${locked}`:'';
    if(existing?.dataset.hexKey===key)return;
    existing?.remove();if(!hex)return;
    const shape=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','polygon');
    shape.dataset.hexKey=key;
    const x=Math.sqrt(3)*(hex.q+hex.r/2),y=1.5*hex.r;
    shape.setAttribute('points',Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return `${x+Math.cos(a)},${y+Math.sin(a)}`;}).join(' '));
    shape.dataset.hexFeedback=locked?'locked':'hover';shape.setAttribute('fill',locked?'#ffffff55':'#ffe35e88');shape.setAttribute('stroke',locked?'white':'#ffe35e');shape.setAttribute('stroke-width','.08');shape.style.pointerEvents='none';svg.append(shape);
  }
  const doc=host(),style=doc.createElement('style');style.textContent='[data-atb-charging=true] .pilot-rings{outline:1px solid #d8af49;box-shadow:0 0 15px #eebd4166; border-radius:4px}[data-hex-feedback=locked]{animation:scan-hex-pulse 1.2s ease-in-out infinite}@keyframes scan-hex-pulse{50%{opacity:.35}}.sensor-result-failed{color:#ff6576!important;font-weight:700}.sensor-result-success{color:#72efac!important;font-weight:700;animation:scan-result-pulse 1.4s ease-in-out infinite}@keyframes scan-result-pulse{50%{text-shadow:0 0 9px #5ff79e;opacity:.7}}@media(prefers-reduced-motion:reduce){[data-hex-feedback],.sensor-result-success{animation:none!important}}';doc.head.append(style);
  const typingIcon=doc.createElement('div');typingIcon.className='console-typing-indicator';typingIcon.hidden=true;typingIcon.setAttribute('role','img');
  typingIcon.innerHTML='<svg viewBox="0 0 48 36" aria-hidden="true"><rect x="3" y="17" width="42" height="16" rx="3" fill="#0c2029" stroke="#91d8df"/><path d="M8 22h32M8 27h32M12 19v10m7-10v10m10-10v10m7-10v10" stroke="#4c929d"/><path class="typing-hand left" d="M10 4l6 3 4 10c1 4-3 7-6 5l-7-5 2-3 4 2-5-9z" fill="#d8edf0" stroke="#44899b"/><path class="typing-hand right" d="M38 4l-6 3-4 10c-1 4 3 7 6 5l7-5-2-3-4 2 5-9z" fill="#d8edf0" stroke="#44899b"/></svg>';
  style.textContent+='.console-typing-indicator{position:fixed;left:12px;bottom:12px;width:42px;height:34px;z-index:5000;pointer-events:none;background:#06151bce;border-radius:5px;padding:2px}.console-typing-indicator[hidden]{display:none!important}.console-typing-indicator svg{width:100%;height:100%}.console-typing-indicator[data-running=true] .typing-hand{animation:console-keypress .36s ease-in-out infinite alternate}.console-typing-indicator .typing-hand.right{animation-delay:-.18s}.console-typing-indicator[data-running=false]{opacity:.5}@keyframes console-keypress{to{transform:translateY(2px)}}@media(prefers-reduced-motion:reduce){.console-typing-indicator .typing-hand{animation:none!important}}';
  function pointer(event){const view=event.target.closest('.sensor-console,.ship-navigation-dialog'),svg=event.target.closest('[data-space-canvas]');if(!view||!svg||!(view.dataset.selectHex==='true'||view.dataset.triggerHex==='true'))return;mark(svg,hexAt(event,svg),false);}
  function click(event){const view=event.target.closest('.sensor-console,.ship-navigation-dialog');if(!view)return;
    if(event.target.closest('[data-pick-trigger]')){view.dataset.triggerHex='true';return;}
    const svg=event.target.closest('[data-space-canvas]');if(!svg||view.dataset.triggerHex!=='true')return;
    const hex=hexAt(event,svg);view.querySelector('[data-trigger-q]').value=hex.q;view.querySelector('[data-trigger-r]').value=hex.r;view.dataset.triggerHex='false';mark(svg,hex,true);event.stopImmediatePropagation();event.preventDefault();
  }
  doc.addEventListener('pointermove',pointer);doc.addEventListener('click',click,true);
  style.textContent=style.textContent.replace('[data-atb-charging=true] .pilot-rings{outline:1px solid #d8af49;box-shadow:0 0 15px #eebd4166; border-radius:4px}','[data-atb-charging=true] .ring-backplate{stroke:#ffd55f;stroke-width:3;filter:drop-shadow(0 0 7px #ffc838)}');
  style.textContent+='.console-pause-notice{position:absolute;top:13%;left:25%;right:25%;z-index:20;background:#22080eee;border:1px solid #ff596b;color:#ff5b6e;font:bold 22px Arial;text-align:center;padding:12px;pointer-events:none;overflow-wrap:anywhere}.console-pause-notice[hidden]{display:none}@media(max-width:850px){.console-pause-notice{top:0;left:0;right:0;font-size:17px}}';
  const timer=setInterval(()=>{
    const b=bridge(),state=b?.state(),view=doc.querySelector(`dialog[open][data-console-owner="${window.SAConsoleCommon?.ownerId}"]`);
    if(!state){sound?.stop();sound=null;phase='';typingIcon.hidden=true;return;}
    const unit=state?.units.find(u=>u.id===(view?.dataset.operatorId||b?.myUnitId()));
    const running=Boolean(view&&unit&&!state.practice&&state.running&&!state.rollPaused&&!state.pausedForTurn&&!state.hardPaused&&!state.holdPaused&&!doc.hidden);
    if(view){
      let notice=view.querySelector('.console-pause-notice');if(!notice){notice=doc.createElement('div');notice.className='console-pause-notice';notice.setAttribute('role','status');(view.querySelector('.pilot-command,.weapon-turn,.sensor-command,.shield-command')||view).append(notice);}
      const active=state.units.find(u=>u.id===state.activeId),other=active&&active.id!==unit?.id;
      const pending=state.units.find(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length),roll=pending?.delayedAction?.awaitingRoll?pending.delayedAction:pending?.pendingShipRolls?.[0];
      const paused=!state.practice&&(state.rollPaused||state.hardPaused||state.holdPaused||state.hiddenActiveTurn||((state.pausedForTurn||!state.running)&&(other||state.activeAction||state.delayRequest)));
      const name=state.rollPaused?pending&&roll?.rollController!=='gm'&&pending.team==='pc'?(pending.playerName||pending.characterName):'GM':!state.hardPaused&&!state.holdPaused&&other&&active.team==='pc'?(active.playerName||active.characterName):'GM';
      notice.hidden=!paused;notice.textContent=`Paused: Awaiting ${name}`;
    }
    if(state){for(const ship of state.starships)for(const report of ship.sensorState?.reports||[]){if(!report.detected)continue;const key=ship.id+report.at+report.targetId;if(detections.has(key))continue;detections.add(key);if(detectionReady&&view&&!doc.hidden&&b.soundEnabled()&&Date.now()-Date.parse(report.at)<10000){b.consoleTick();setTimeout(()=>{if(view.isConnected&&b.soundEnabled()&&!doc.hidden)b.consoleTick();},160);}}detectionReady=true;}
    const delay=unit?.delayedAction,processing=unit?.queuedEffects?.find(e=>e.sensorReport);
    const ship=state?.starships.find(s=>s.id===unit?.location?.starshipId),aux=ship?.auCommands?.find(c=>c.unitId===unit?.id);
    const charging=running&&!delay&&!unit.delayTimer&&!unit.timedAction&&!unit.consoleHold&&unit.atb<state.threshold;
    if(view)view.dataset.atbCharging=String(charging);
    const next=running&&b.soundEnabled()?(delay&&!delay.awaitingRoll?delay.shipOrder?'engine':'input':aux?'input':processing?'analysis':charging?'atb':''):'';
    const typingVisible=Boolean(view&&!state.practice&&(delay&&!delay.awaitingRoll||aux));
    typingIcon.hidden=!typingVisible;
    if(typingVisible){if(typingIcon.parentElement!==view)view.append(typingIcon);typingIcon.dataset.running=String(running);typingIcon.setAttribute('aria-label',running?'Typing console input':'Console input paused');typingIcon.title=running?'Typing console input':'Console input paused';}
    if(next!==phase){sound?.stop();sound=null;phase=next;}if(next)sound ||= next==='input'?typing():b.startEngineCharge();
    sound?.update?.(next==='atb'?(Math.sin(performance.now()/1800)+1)/2:next==='analysis'?processing.progress/100:delay?1-delay.remaining/100:.5,next==='atb'?.16:.5);
    if(view?.classList.contains('sensor-console')){const svg=view.querySelector('[data-space-canvas]');if(svg&&delay?.sensorOrder?.hex)mark(svg,delay.sensorOrder.hex,true);else if(svg&&view.dataset.selectHex!=='true'&&view.dataset.triggerHex!=='true')svg.querySelector('[data-hex-feedback]')?.remove();}
  },200);
  window.addEventListener('pagehide',()=>{clearInterval(timer);sound?.stop();typingAudio?.close();doc.removeEventListener('pointermove',pointer);doc.removeEventListener('click',click,true);typingIcon.remove();style.remove();});
}());
