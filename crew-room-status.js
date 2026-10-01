(function(){
  try{if(parent!==window&&parent.SACrewRoomStatus){window.SACrewRoomStatus=parent.SACrewRoomStatus;const timer=setInterval(()=>{const b=window.SACombatBridge;if(b?.state()&&!b.state().practice)parent.SACrewRoomStatus.update({...b.state(),accessRole:b.mode()==='gm'?'gm':'character'},body=>b.crewRoomRequest(body));},500);window.addEventListener('pagehide',()=>clearInterval(timer));return;}}catch{}
  let panel,dialog,model,submit,key='';let fabricationSeen=new Set();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(){
    if(!panel){const css=document.createElement('link');css.rel='stylesheet';css.href='crew-room-console.css';document.head.append(css);panel=document.createElement('aside');panel.className='crew-medical-status';panel.setAttribute('popover','manual');panel.setAttribute('aria-label','Medbay treatment status');document.body.append(panel);}
  }
  function update(next,callback){
    if(!next)return;model=next;submit=callback;mount();
    for(const ship of next.starships||[])for(const event of [...(ship.ship?.fabricationState?.events||[]),...(ship.ship?.extractionState?.events||[])]){if(fabricationSeen.has(event.id))continue;fabricationSeen.add(event.id);window.SAResultFeedback?.push('fabrication:'+event.id,ship.title||'Starship Fabrication',event.text,{topLayer:true});}
    const rolls=next.crewRoomRolls||[],gm=next.role==='gm'||next.accessRole==='gm';
    const treating=(next.starships||[]).filter(s=>gm||!next.ownCharacterId||s.crewCharacterIds?.includes(next.ownCharacterId)).flatMap(s=>Object.values(s.ship?.crewRoomState?.rooms||{}).flatMap(r=>(r.jobs||[]).filter(j=>j.phase==='treating').map(j=>({...j,shipId:s.id}))));
    const active=[...treating,...rolls],signature=JSON.stringify(active.map(j=>[j.id,j.phase,Math.ceil(j.remaining||0)]));
    if(dialog){if(panel.matches(':popover-open'))panel.hidePopover();const known=(next.starships||[]).flatMap(s=>Object.values(s.ship?.crewRoomState?.rooms||{}).flatMap(r=>r.jobs||[])).find(j=>j.id===dialog.dataset.jobId);if(known&&['complete','cancelled'].includes(known.phase))dialog.close();return;}
    if(!active.length){if(panel.matches(':popover-open'))panel.hidePopover();key='';return;}
    if(key!==signature){key=signature;panel.innerHTML='<strong>MEDBAY</strong>'+active.map(j=>`<p>${esc(j.patientName)}: ${j.phase==='treating'?Math.ceil(j.remaining)+'s treatment':j.phase==='risk'?'Manual D4 malfunction check':j.phase==='adjudication'?'Awaiting GM consequence':j.dice+'D6 healing ready'}</p>${j.phase==='treating'?'':`<button type="button" data-job="${esc(j.id)}">${j.phase==='adjudication'?'GM Adjudication':'Enter Roll'}</button>`}`).join('');panel.onclick=e=>{const job=rolls.find(j=>j.id===e.target.closest('[data-job]')?.dataset.job);if(job)open(job,gm);};}
    const host=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;if(panel.parentElement!==host)host.append(panel);if(!panel.matches(':popover-open'))panel.showPopover();
  }
  function open(job,gm){
    if(dialog)return;const view=dialog=document.createElement('dialog');view.dataset.jobId=job.id;view.className='crew-medical-roll';view.setAttribute('aria-label','Medbay Result');
    const harm=job.phase==='adjudication',risk=job.phase==='risk',min=harm?0:risk?1:job.dice,max=harm?10000:risk?4:job.dice*6;
    view.innerHTML=`<h2>${esc(job.patientName)}: ${harm?'Malfunction':risk?'Safety Check':'Recovery'}</h2><p>${harm?'GM-decided HP loss. Zero permits a non-damaging narrative consequence.':risk?'Manually roll D4. A 1 requires GM adjudication.':'Manually roll '+job.dice+'D6 healing.'}</p><form><label>${harm?'HP loss':'Roll total'}<input aria-label="Medbay roll total" type="number" min="${min}" max="${max}" step="1" required></label><button type="submit" ${harm&&!gm?'disabled':''}>Confirm Result</button><button type="button" data-close>Close</button><button type="button" data-cancel ${harm&&!gm?'disabled':''}>Cancel Treatment</button><output role="status"></output></form>`;
    const form=view.querySelector('form');
    async function send(kind){const button=form.querySelector('[type=submit]');button.disabled=true;try{const result=await submit({starshipId:job.shipId,sicId:job.sicId,jobId:job.id,stage:job.phase,kind,score:Number(form.querySelector('input').value),requestId:crypto.randomUUID()});view.close();key='';if(result?.campaign)update(result.campaign,submit);}catch(error){form.querySelector('output').textContent=error.message;}finally{button.disabled=false;}}
    form.onsubmit=e=>{e.preventDefault();send('result');};view.querySelector('[data-cancel]').onclick=()=>send('cancel');view.querySelector('[data-close]').onclick=()=>view.close();view.onclose=()=>{if(panel.parentElement===view)document.body.append(panel);view.remove();dialog=null;};document.body.append(view);view.showModal();
  }
  window.SACrewRoomStatus={update};
  const timer=setInterval(()=>{const b=window.SACombatBridge;if(b&&!b.state()?.practice&&b.state())update({...b.state(),accessRole:b.mode()==='gm'?'gm':'character'},body=>b.crewRoomRequest(body));},500);
  window.addEventListener('pagehide',()=>{clearInterval(timer);dialog?.close();panel?.remove();});
}());
