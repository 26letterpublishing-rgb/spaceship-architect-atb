(function(){
  let view=null,key='',audio,removeListener=null,pendingAck=null,loadingTimer=null;const seen=new Set();
  function host(){let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;}
  function beep(bridge,doc){if(!bridge.soundEnabled()||doc.hidden)return;try{audio ||= new AudioContext();audio.resume();[520,880,660,1040].forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.12;o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.04,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.11);});}catch{}}
  function close(){clearTimeout(loadingTimer);removeListener?.();removeListener=null;view?.remove();view=null;key='';pendingAck=null;}
  function tick(){
    const b=window.SACombatBridge,s=b?.state();if(!s)return;
    if(s.encounterEndedAt||s.units.some(u=>u.delayedAction?.awaitingRoll&&!u.delayedAction.automated)||s.attackResolution&&!s.showcase||s.itemResolution&&!s.showcase){close();return;}
    for(const actor of s.units){const a=actor.automationAction;if(a&&Date.now()-a.at<3000&&!seen.has(a.id)){seen.add(a.id);beep(b,host());}}
    const presenters=[...(s.hackingDice||[]),...(s.demoAutomation||[]),...s.units.filter(u=>u.automationPresentation?.personalAttack||u.automationPresentation?.phase==='complete'||u.delayedAction?.id===u.automationPresentation?.id),...s.starships.flatMap(ship=>(ship.ship?.missileState?.flights||[]).filter(m=>m.automated&&m.automationPresentation&&(m.phase==='impact'||m.automationPresentation.phase==='complete')).map(m=>({id:m.unitId,characterName:m.name,automationPresentation:m.automationPresentation})))];
    const unit=presenters.find(u=>u.automationPresentation&&(u.automationPresentation.phase!=='complete'||Date.now()-(u.automationPresentation.completedAt||0)<1800)),r=unit?.automationPresentation,doc=host();
    if(!r){close();return;}
    if(pendingAck&&pendingAck.rollId===r.id&&!pendingAck.busy){const ack=pendingAck;ack.busy=true;b.action(unit.hackAlert?{action:'hackAlertAnimationComplete',starshipId:unit.id,rollId:r.id}:{action:'automationAnimationComplete',id:unit.id,rollId:r.id},'resolve',{throwOnError:true}).then(()=>{if(pendingAck===ack)pendingAck=null;}).catch(()=>{ack.busy=false;});}
    if(key===r.id)return;
    close();key=r.id;
    view=doc.createElement('dialog');view.className='automatic-dice-dialog';view.setAttribute('aria-label','Automated action dice');
    view.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;pointer-events:none;z-index:2147483647';
    const frame=doc.createElement('iframe');frame.title='Automatic standard dice';frame.style.cssText='width:100%;height:100%;border:0;background:transparent';frame.src=new URL('character.html?shipRoll=1',location.href).href;
    const retry=doc.createElement('button');retry.type='button';retry.textContent='Retry dice animation';retry.hidden=true;retry.style.cssText='position:absolute;bottom:12px;left:12px;pointer-events:auto;background:#163a45;color:white;padding:10px';
    const retryLater=()=>{clearTimeout(loadingTimer);loadingTimer=setTimeout(()=>{retry.hidden=false;},20000);};retry.onclick=()=>{retry.hidden=true;frame.src=frame.src;retryLater();};retryLater();
    const receive=event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
      if(event.data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',...r,rollId:r.id,name:unit.characterName,title:r.label,immediateResult:true,spectator:true,exertionAvailable:0},location.origin);
      if(event.data?.type==='sa-automatic-dice-shown'&&event.data.rollId===r.id){clearTimeout(loadingTimer);retry.hidden=true;pendingAck={busy:false,rollId:r.id};}
    };
    doc.defaultView.addEventListener('message',receive);removeListener=()=>doc.defaultView.removeEventListener('message',receive);
    view.addEventListener('cancel',e=>e.preventDefault());view.append(frame,retry);( [...doc.querySelectorAll('dialog[open]')].at(-1)||doc.body).append(view);view.show();
  }
  const timer=setInterval(tick,150);window.addEventListener('pagehide',()=>{clearInterval(timer);close();audio?.close();});
}());
