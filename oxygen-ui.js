(function(){
  let panel=null,modal=null,environment={ships:[]},submit=null,gm=false;
  const dismissed=new Set(),reported=new Set();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time=s=>`${Math.floor(Math.ceil(s)/60)}:${String(Math.ceil(s)%60).padStart(2,'0')}`;
  function placePanel(){
    if(!panel)return;
    const host=[...document.querySelectorAll('dialog[open]')].filter(d=>d!==modal).at(-1)||document.body;
    if(panel.parentElement!==host)host.append(panel);
    const visible=environment.ships.length&&!modal;
    panel.hidden=!visible;
    if(visible&&!panel.matches(':popover-open'))panel.showPopover();
    else if(!visible&&panel.matches(':popover-open'))panel.hidePopover();
  }
  let placementQueued=false;
  new MutationObserver(records=>{if(!environment.ships.length||placementQueued||!records.some(r=>r.target instanceof HTMLDialogElement||[...r.addedNodes,...r.removedNodes].some(n=>n instanceof HTMLDialogElement)))return;placementQueued=true;requestAnimationFrame(()=>{placementQueued=false;placePanel();});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  function requestExists(id){return environment.ships.some(s=>s.crew.some(c=>c.request?.id===id));}
  function openRoll(person){
    if(modal||!person.request||!submit)return;
    const request=person.request,view=document.createElement('dialog');modal=view;view.dataset.rollId=request.id;view.className='oxygen-roll';view.setAttribute('aria-label','Oxygen resistance roll');
    const frame=document.createElement('iframe');frame.title='Health and Endurance';frame.src='character.html?shipRoll=1';
    const status=document.createElement('div');status.className='oxygen-roll-status';status.setAttribute('role','status');
    const loading=document.createElement('span');loading.textContent='Loading Health + Endurance dice...';status.append(loading);
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry Loading Dice';retry.hidden=true;status.append(retry);
    let timer,busy=false;
    const watch=()=>{clearTimeout(timer);status.hidden=false;retry.hidden=true;timer=setTimeout(()=>{retry.hidden=false;},3000);};
    retry.onclick=()=>{watch();frame.src='character.html?shipRoll=1';};watch();
    function close(){dismissed.add(request.id);view.close();}
    const receive=async event=>{
      if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
      if(event.data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:request.id,attributeKey:'health',attributeLabel:'Health',immediateResult:true,sides:request.dice,bonus:request.skill,skill:'Athletics/Endurance',difficulty:request.difficulty,difficultyLabel:`Difficulty ${request.difficulty}`,name:person.name,title:'Lack of Oxygen: Health + Endurance'},location.origin);
      if(event.data?.type==='sa-ship-skill-opened'&&event.data.rollId===request.id){clearTimeout(timer);status.hidden=true;}
      if(event.data?.type==='sa-ship-skill-cancel')close();
      if(event.data?.type==='sa-ship-skill-result'&&event.data.rollId===request.id&&!busy){
        busy=true;status.hidden=false;loading.textContent='Submitting resistance roll...';retry.hidden=true;
        try{const result=await submit({actorId:person.id,rollId:request.id,score:event.data.score,diceResults:event.data.diceResults});close();if(result.oxygen)update(result.oxygen,submit,gm);}
        catch(error){loading.textContent=error.message;retry.hidden=false;retry.textContent='Retry Submit';retry.onclick=()=>{busy=false;receive(event);};}
      }
    };
    window.addEventListener('message',receive);view.addEventListener('cancel',event=>{event.preventDefault();close();});
    view.addEventListener('close',()=>{clearTimeout(timer);window.removeEventListener('message',receive);view.remove();modal=null;},{once:true});
    view.append(frame,status);document.body.append(view);view.showModal();
  }
  function update(next,callback,isGm=false){
    window.SAFleetNotices?.update(next);
    environment=next||{ships:[]};submit=callback||submit;gm=isGm;
    if(!panel){
      if(!document.querySelector('link[href="oxygen-ui.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='oxygen-ui.css';document.head.append(style);}
      panel=document.createElement('section');panel.className='oxygen-panel';panel.setAttribute('aria-label','Oxygen status');panel.setAttribute('popover','manual');document.body.append(panel);
      panel.onclick=event=>{const button=event.target.closest('[data-oxygen-roll]');if(button){const crew=environment.ships.flatMap(s=>s.crew).find(c=>c.request?.id===button.dataset.oxygenRoll);if(crew)openRoll(crew);}};
    }
    panel.hidden=!environment.ships.length;
    panel.innerHTML=environment.ships.map(ship=>`<article><strong>${esc(ship.title)}: Room Oxygen</strong><span class="oxygen-grace">Resistance rolls start at 10%${ship.paused?' / Paused':''}</span>${ship.crew.map(person=>`<div class="oxygen-person"><span>${esc(person.name)}</span><b>${Math.ceil(person.oxygen??0)}% O₂ — ${person.phase==='unconscious'?'Unconscious':person.request?'Resistance roll required':person.phase==='air'?'Air declining / replenishing':person.phase==='suffocating'?'Losing HP until oxygen returns':`Resisting / Difficulty ${person.difficulty}`}</b>${person.request?`<button type="button" data-oxygen-roll="${esc(person.request.id)}">Roll Health + Endurance (${person.request.difficulty})</button>`:''}${person.result?`<small class="${person.result.success?'passed':'failed'}">${esc(person.result.text)}</small>`:''}</div>`).join('')}</article>`).join('');
    for(const person of environment.ships.flatMap(s=>s.crew))if(person.result&&!reported.has(person.result.id)){
      reported.add(person.result.id);window.SAResultFeedback?.push(person.result.id,'Oxygen Resistance',person.result.text);
    }
    if(modal&&!requestExists(modal.dataset.rollId))modal.close();
    const automatic=environment.ships.flatMap(s=>s.crew).find(c=>c.request&&!dismissed.has(c.request.id)&&(!gm||!c.characterId));
    if(automatic&&!modal)openRoll(automatic);
    placePanel();
  }
  window.SAOxygenUI={update};
}());
