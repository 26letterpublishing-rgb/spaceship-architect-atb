(function(){
  let sound=null,phase='',detectionReady=false;
  const detections=new Set();
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
    const b=bridge(),state=b?.state(),view=doc.querySelector('.ship-navigation-dialog[open],.sensor-console[open],.shield-console-dialog[open],.weapon-console[open],.lock-console[open]');
    const unit=state?.units.find(u=>u.id===(view?.dataset.operatorId||b?.myUnitId()));
    const running=Boolean(view&&unit&&state.running&&!state.pausedForTurn&&!state.hardPaused&&!state.holdPaused&&!doc.hidden);
    if(view){
      let notice=view.querySelector('.console-pause-notice');if(!notice){notice=doc.createElement('div');notice.className='console-pause-notice';notice.setAttribute('role','status');(view.querySelector('.pilot-command,.weapon-turn,.sensor-command,.shield-command')||view).append(notice);}
      const active=state.units.find(u=>u.id===state.activeId),other=active&&active.id!==unit?.id;
      const paused=state.hardPaused||state.holdPaused||state.hiddenActiveTurn||((state.pausedForTurn||!state.running)&&(other||state.activeAction||state.delayRequest));
      const name=!state.hardPaused&&!state.holdPaused&&other&&active.team==='pc'?(active.playerName||active.characterName):'GM';
      notice.hidden=!paused;notice.textContent=`Paused: Awaiting ${name}`;
    }
    if(state){for(const ship of state.starships)for(const report of ship.sensorState?.reports||[]){if(!report.detected)continue;const key=ship.id+report.at+report.targetId;if(detections.has(key))continue;detections.add(key);if(detectionReady&&view&&!doc.hidden&&b.soundEnabled()&&Date.now()-Date.parse(report.at)<10000){b.consoleTick();setTimeout(()=>{if(view.isConnected&&b.soundEnabled()&&!doc.hidden)b.consoleTick();},160);}}detectionReady=true;}
    const delay=unit?.delayedAction,processing=unit?.queuedEffects?.find(e=>e.sensorReport);
    const ship=state?.starships.find(s=>s.id===unit?.location?.starshipId),aux=ship?.auCommands?.find(c=>c.unitId===unit?.id);
    const charging=running&&!delay&&!unit.delayTimer&&!unit.timedAction&&!unit.consoleHold&&unit.atb<state.threshold;
    if(view)view.dataset.atbCharging=String(charging);
    const next=running&&b.soundEnabled()?(delay&&!delay.awaitingRoll||aux?'input':processing?'analysis':charging?'atb':''):'';
    if(next!==phase){sound?.stop();sound=null;phase=next;}if(next)sound ||= b.startEngineCharge();
    sound?.update(next==='atb'?(Math.sin(performance.now()/1800)+1)/2:next==='analysis'?processing.progress/100:delay?1-delay.remaining/100:.5,next==='atb'?.16:.5);
    if(view?.classList.contains('sensor-console')){const svg=view.querySelector('[data-space-canvas]');if(svg&&delay?.sensorOrder?.hex)mark(svg,delay.sensorOrder.hex,true);else if(svg&&view.dataset.selectHex!=='true'&&view.dataset.triggerHex!=='true')svg.querySelector('[data-hex-feedback]')?.remove();}
  },200);
  window.addEventListener('pagehide',()=>{clearInterval(timer);sound?.stop();doc.removeEventListener('pointermove',pointer);doc.removeEventListener('click',click,true);style.remove();});
}());
