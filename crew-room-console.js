(function(){
  let view,opening=false,openSerial=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function open(unit,sicId){
    if(view||opening)return;opening=true;const serial=++openSerial,b=window.SACombatBridge;
    let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}
    try{
      for(const file of ['console-common.css','crew-room-console.css']){const href=new URL(file,location.href).href;if([...doc.styleSheets].some(s=>s.href===href))continue;await new Promise((resolve,reject)=>{const link=doc.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=()=>reject(Error('Room console styles could not load.'));doc.head.append(link);});}
      const access=window.SAStationAccess.access(b.state(),unit,sicId);if(!access?.definition.crewRoom)return;
      const type=access.definition.utility,dialog=view=doc.createElement('dialog');dialog.className='utility-console lock-console crew-room-console';dialog.dataset.operatorId=unit.id;dialog.dataset.sicId=sicId;dialog.dataset.roomType=type;dialog.setAttribute('aria-label',access.definition.name+' console');
      const vr=type==='vr-training-room',med=type==='medbay',archive=['library','science-lab'].includes(type),lab=type==='science-lab',gym=type==='gym',meeting=type==='meeting-room',ai=type==='ship-ai',bar=type==='bar',hibernation=type==='hibernation-chamber',brig=type==='brig',extraction=['mining-laser','vulture-drone'].includes(type);
      dialog.innerHTML=`<header><div><small>${esc(unit.characterName)} / CREW SERVICES</small><h2>${esc(access.definition.name)}</h2></div><strong data-turn></strong><div data-selector></div><button type="button" data-sound>${b.soundIcon()}</button><button type="button" data-close>Close Console</button></header>
        <section class="lock-chart crew-room-scene"><img src="${vr?'vr-training-console-scene.webp':med?'medbay-console-scene.webp':type==='library'?'library-console-scene.webp':gym?'gym-console-scene.webp':meeting?'sic-art-meeting-room-console.webp':bar||hibernation||brig?type+'-console-scene.webp':ai?'ship-ai-console-scene.webp':extraction?type+'-console.webp':access.definition.image}" alt="${esc(access.definition.name)}">${meeting?`<div class="meeting-window" aria-hidden="true">${Array.from({length:24},(_,i)=>`<i style="--star-y:${(i*37)%97}%;--star-delay:-${i*.73}s;--star-duration:${8+i%5}s"></i>`).join('')}</div><div class="meeting-screen" aria-hidden="true"></div>`:'<div class="crew-room-animation" aria-hidden="true"></div>'}<h3 data-scene-state>Connected</h3><p data-scene-detail></p></section>
        <section class="lock-controls crew-room-controls"><h3>${med?'Patient Care':vr?'Simulation Control':ai?'Digital Crewmember':bar?'Order a Drink':hibernation?'Hibernation Controls':brig?'GM Custody Controls':archive?'Research Archive':gym?'Exercise Program':'Crew Briefing'}</h3>
        ${vr?`<label>Attribute<select data-utility-control data-attribute></select></label><label>Skill to train<select data-utility-control data-skill></select></label><label>Simulation<input data-utility-control data-simulation list="crew-simulation-presets" maxlength="120" value="Flight Academy"><datalist id="crew-simulation-presets"><option value="Flight Academy"><option value="First Contact"><option value="Emergency Drill"><option value="Zero-Risk Adventure"></datalist></label><label class="crew-room-switch">Safety protocols<input data-utility-control data-safety type="checkbox" checked></label><button type="button" data-utility-control data-simulate>Run Simulation</button><hr><button type="button" data-utility-control data-train>Roll D4 for Daily Training</button><output data-training-status></output>`:''}
        ${med?`<strong data-supplies></strong><button type="button" data-utility-control data-load>Load 1 Umbrexium</button><label>Patient in Medbay<select data-utility-control data-patient></select></label><output data-patient-hp></output><button type="button" data-utility-control data-treat>Begin Treatment</button><button type="button" data-utility-control data-stop hidden>Cancel Treatment</button>`:''}
        ${lab?'<p>Research and Science +4 for characters anywhere inside this operational room.</p><h4>Ship Mineral Storage</h4><output data-lab-stock></output>':''}
        ${gym?'<label>Exercise<select data-utility-control data-exercise><option>Strength circuit</option><option>Endurance workout</option><option>Stretching</option></select></label><button data-utility-control data-exercise-start>Exercise</button><p>Recreation and training; no automatic statistic increases.</p>':''}
        ${bar?'<label>Drink order<input data-utility-control data-drink maxlength="100" value="Nebula Spritz"></label><label class="crew-room-switch">Robotic bartender<input data-utility-control data-bartender type="checkbox" checked></label><button data-utility-control data-bartender-save>Set Bartender</button><button data-utility-control data-order>Place Order</button><p data-bar-rule></p><p>Drinks and intoxication are roleplayed; no automatic bonuses.</p>':''}
        ${hibernation?'<p>One occupant. Life Support required. Emergency alerts wake you automatically.</p><button data-utility-control data-hibernate>Enter Hibernation</button><button data-utility-control data-wake>Wake Now</button><output data-hibernation-time></output><p data-hibernation-rule></p>':''}
        ${brig?'<p>Custody and escape are adjudicated by the GM.</p><label>Prisoner name<input data-utility-control data-prisoner-name maxlength="100"></label><label>Custody notes<textarea data-utility-control data-prisoner-note maxlength="1000" rows="2"></textarea></label><button data-utility-control data-intake>Record Intake</button><label>Brig condition<textarea data-utility-control data-brig-condition maxlength="1000" rows="2"></textarea></label><button data-utility-control data-condition>Save Condition</button><p data-brig-rule></p>':''}
        ${meeting?'<h4>In the Room</h4><ul data-occupants></ul>':''}
        ${archive?`<label>Search<input data-utility-control data-search type="search"></label><label>Title<input data-utility-control data-title maxlength="100"></label><label>${archive?'Research notes':'Briefing'}<textarea data-utility-control data-text maxlength="4000" rows="4"></textarea></label><button type="button" data-utility-control data-note>${archive?'Archive Entry':'Post Briefing'}</button>${type==='library'?'<button type="button" data-utility-control data-refresh hidden>Confirm Information Node Update</button>':''}`:''}
        ${ai?`<label>AI designation<input data-utility-control data-ai-name maxlength="60" value="Ship AI"></label><label class="crew-room-switch">Online<input data-utility-control data-ai-enabled type="checkbox" checked></label><button type="button" data-utility-control data-ai-save>Save AI Settings</button><button type="button" data-utility-control data-advice>Request Ship Assessment</button><p>4D6 attributes / all skills +2.5</p><div aria-label="Ship AI automation"><button type="button" data-utility-control data-ai-mode="defense">Defense</button><button type="button" data-utility-control data-ai-mode="offense">Offense</button><button type="button" data-utility-control data-ai-mode="off">Automation Off</button></div><p data-ai-seat></p>`:''}
        <output data-status role="status" aria-live="polite"></output></section>
        <section class="lock-reports crew-room-records"><h3>${archive?'Shared Records':'Room Status'}</h3><div data-records></div></section>
        <div class="utility-seat"><button type="button" data-hold>Hold</button><button type="button" data-leave>Leave Console</button></div>`;
      for(const control of dialog.querySelectorAll('[data-utility-control]'))control.disabled=true;
      doc.body.append(dialog);dialog.showModal();let initialized=false,info,busy=false,polling=false,disposed=false,noteKey='',skillKey='',attributeKey='',skillInitialized=false,patientKey='',trainingRoll=null;
      if(ai&&window.SAShipMap.installedItems(access.ship).some(i=>i.type==='holographic-projector'&&window.SAShipMap.operational(i))){const hologram=doc.createElement('img');hologram.className='ship-ai-hologram';hologram.src='sic-art-holographic-projector.webp';hologram.alt='Ship AI holographic projection';dialog.querySelector('.crew-room-scene').append(hologram);}
      const get=s=>dialog.querySelector(s),status=get('[data-status]'),current=()=>b.state()?.units?.find(u=>u.id===unit.id),body=extra=>({id:unit.id,characterId:unit.characterId||undefined,starshipId:access.ship.id,sicId,...extra});
      if(type==='library'){
        const shelf=doc.createElement('section');shelf.className='crew-library-shelf';const title=doc.createElement('h3');title.textContent='Crew Logs & Library Data';const refresh=doc.createElement('button');refresh.type='button';refresh.dataset.utilityControl='';refresh.textContent='Read Shared Archive';const records=doc.createElement('div');shelf.append(title,refresh,records);get('.crew-room-records').append(shelf);
        refresh.onclick=async()=>{refresh.disabled=true;try{const data=await b.crewLogRequest({kind:'library',starshipId:access.ship.id});records.replaceChildren();for(const entry of [...data.logs,...data.entries]){const row=doc.createElement('details'),label=doc.createElement('summary'),copy=doc.createElement('p');label.textContent=entry.title||`${entry.characterName} / ${entry.name} / Session ${entry.session}`;copy.textContent=entry.text;copy.style.whiteSpace='pre-wrap';row.append(label,copy);records.append(row);}if(!records.children.length)records.textContent='No shared records yet.';}catch(e){status.textContent=e.message;}finally{refresh.disabled=false;}};
      }
      const science=lab?window.SAScienceConsole.mount(dialog,send):null;const extractor=extraction?window.SAExtractionConsole.mount(dialog,send,rollRoomDice,current):null;
      async function inspect(){if(b.state()?.catalogPreview){info={details:{notes:[],prisoners:[],enabled:false},skills:[],attributes:[],patients:[],shipMinerals:{Iron:100,'Dark Phazon':10},fabricators:[],gm:false};redraw();return;}if(polling||disposed)return;polling=true;try{const result=await b.crewRoomRequest(body({kind:'inspect'}));if(disposed)return;info=result.result;if(!initialized){initialized=true;for(const control of dialog.querySelectorAll('[data-utility-control]'))control.disabled=false;if(ai){get('[data-ai-name]').value=info.details.name||'Ship AI';get('[data-ai-enabled]').checked=info.details.enabled!==false;}if(bar)get('[data-bartender]').checked=info.details.robotBartender!==false;if(brig)get('[data-brig-condition]').value=info.details.condition||'';if(vr){get('[data-safety]').checked=info.details.safety!==false;if(info.details.simulation)get('[data-simulation]').value=info.details.simulation;}}redraw();}catch(error){if(!disposed)status.textContent=error.message;}finally{polling=false;}}
      function redraw(){
        if(gym)get('[data-scene-detail]').textContent=window.SAShipMap.gravityEnabled(access.ship)?'GRAVITY 1.0 G / Exercise deck online':'GRAVITY 0 G / Exercise restraints required';
        if(lab&&info){get('[data-lab-stock]').textContent=Object.entries(info.shipMinerals||{}).filter(([,q])=>q>0).map(([n,q])=>n+': '+q).join(' · ')||'No minerals in ship storage.';science?.render(info,busy);}
        if(!info)return;const state=b.state(),person=current(),active=window.SAStationAccess.access(state,person,sicId);if(!active){dialog.close();return;}
        const outside=Boolean(state.practice),ready=outside||state.activeId===unit.id&&!state.rollPaused&&!person.delayedAction&&!person.timedAction&&!person.consoleHold;
        get('[data-turn]').textContent=outside?'OUT OF COMBAT':window.SAConsoleCommon.standby(state,person);
        for(const button of dialog.querySelectorAll('.crew-room-controls button'))button.disabled=busy||(!outside&&!med&&!ai&&!hibernation&&!brig&&!extraction);
        get('[data-hold]').disabled=outside||busy||(!ready&&!person.consoleHold);get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-leave]').disabled=outside||busy||!ready;
        extractor?.render(info.extraction,busy);
        if(vr){
          const attributes=info.attributes||[],attributeMarkup=attributes.map(a=>`<option value="${esc(a.key)}">${esc(a.label)}</option>`).join('');
          if(attributeKey!==attributeMarkup){const old=get('[data-attribute]').value;get('[data-attribute]').innerHTML=attributeMarkup;if(attributes.some(a=>a.key===old))get('[data-attribute]').value=old;attributeKey=attributeMarkup;}
          if(!skillInitialized){const saved=info.skills.find(s=>s.name===info.details.trainingSkill);if(saved)get('[data-attribute]').value=saved.attribute;}
          const choices=info.skills.filter(s=>s.attribute===get('[data-attribute]').value),markup=choices.map(s=>`<option value="${esc(s.name)}">${esc(s.name)} ${s.value.toFixed(1)}</option>`).join('');
          if(skillKey!==markup||!skillInitialized){const old=get('[data-skill]').value||info.details.trainingSkill;get('[data-skill]').innerHTML=markup;get('[data-skill]').value=choices.some(s=>s.name===old)?old:choices[0]?.name||'';skillKey=markup;const changed=old!==get('[data-skill]').value;if(!skillInitialized||changed){setTheme();if(!skillInitialized&&info.details.simulation&&info.details.trainingSkill===get('[data-skill]').value)get('[data-simulation]').value=info.details.simulation;}skillInitialized=true;}
          get('[data-skill]').disabled=!choices.length;get('[data-simulate]').disabled=busy||!outside||!choices.length;
          get('[data-train]').disabled=busy||!outside||info.trained||!get('[data-skill]').value;get('[data-train]').textContent=info.skills.find(s=>s.name===get('[data-skill]').value)?.trainingGain===1?'Train Skill +0.1':'Roll D4 for Daily Training';get('[data-training-status]').textContent=info.trained?'Daily training complete.':!get('[data-skill]').value?'No skills below 6.0 in this attribute. Choose another attribute.':info.skills.find(s=>s.name===get('[data-skill]').value)?.trainingGain===1?'Daily training available: +0.1, no roll.':'Daily training available: D4 × 0.1.';get('[data-scene-state]').textContent=get('[data-simulation]').value||'Simulation offline';get('[data-scene-detail]').textContent=info.details.safety===false?'Safety protocols disabled':'Safety protocols active';
        }
        if(med){
          const markup=info.patients.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');if(patientKey!==markup){const old=get('[data-patient]').value;get('[data-patient]').innerHTML=markup;if(info.patients.some(p=>p.id===old))get('[data-patient]').value=old;patientKey=markup;}
          const patient=info.patients.find(p=>p.id===get('[data-patient]').value),job=info.details.jobs?.find(j=>j.patientId===patient?.id&&['preparing','recovering','dead'].includes(j.phase));
          get('[data-supplies]').textContent='Automatic patient care';
          for(const selector of ['[data-load]','[data-treat]','[data-stop]'])get(selector).hidden=true;
          get('[data-patient-hp]').textContent=patient?'HP '+patient.hp+'/'+patient.maximum+(patient.hp<=0?' / revival deadline '+Math.max(0,Math.ceil(300-patient.downSeconds))+'s':''):'Move the patient into this Medbay.';
          dialog.dataset.operating=String(Boolean(job&&job.phase!=='dead'));
          get('[data-scene-state]').textContent=job?.phase==='dead'?'Patient is dead':job?.phase==='preparing'?'Preparing patient: '+Math.ceil(job.remaining)+'s':job?.phase==='recovering'?'Recovering: next HP in '+Math.ceil(job.remaining)+'s':'Medbay ready';
          get('[data-scene-detail]').textContent='1 HP every 3 seconds. At 0 HP: 60-second preparation; five-minute revival deadline.';
        }
        if(archive){
          const search=get('[data-search]').value.toLowerCase(),notes=info.details.notes.filter(n=>(n.title+' '+n.text).toLowerCase().includes(search)),markup=notes.map(n=>`<article><label><input type="checkbox" title="Mark completed" data-utility-control data-check="${esc(n.id)}" ${n.checked?'checked':''}><strong>${esc(n.title)}</strong></label><p>${esc(n.text)}</p><small>${esc(n.author)}</small><button type="button" data-utility-control data-remove="${esc(n.id)}" ${info.gm||n.authorId===(unit.characterId||unit.id)?'':'disabled'} aria-label="Remove ${esc(n.title)}" title="Remove entry">&times;</button></article>`).join('')||'<p>No entries.</p>';
          if(markup!==noteKey){get('[data-records]').innerHTML=markup;noteKey=markup;}
          get('[data-scene-state]').textContent=lab?'Science and Research':type==='library'?'Local Database':'Secure Crew Briefing';get('[data-scene-detail]').textContent=info.details.notes.length+' shared records';
          if(get('[data-refresh]'))get('[data-refresh]').hidden=!info.gm;
        }else get('[data-records]').textContent=info.details.report?.text||((vr||gym)?`${unit.characterName||'The crewmember'} can choose a simulation to begin practicing.`:hibernation?'Chamber ready. Enter hibernation to begin a long journey.':'Connected to '+access.definition.name+'.');
        if(bar){
          const robot=info.details.robotBartender!==false;get('[data-scene-state]').textContent=robot?'Bartender Online':'Crew Lounge';get('[data-scene-detail]').textContent=info.details.report?.text||'Pull up a chair and place your order.';
          get('[data-bar-rule]').textContent=!outside?'Drink orders and bartender changes are available outside combat.':info.impaired&&robot?'Impaired bartender: roll D6. 1–3 incorrect order; 4–6 correct.':robot?'Your robotic bartender is ready.':'Manual service; no bartender malfunction roll.';
          get('[data-order]').textContent=info.impaired&&robot?'Roll D6 & Place Order':'Place Order';
          get('[data-records]').textContent=(info.details.orders||[]).map(o=>o.text).join('\n\n')||'No orders yet.';
        }
        if(hibernation){
          const sleep=info.details.hibernation,sleeping=sleep?.phase==='sleeping';dialog.dataset.operating=String(sleeping);
          get('[data-scene-state]').textContent=sleeping?'Hibernation Active':'Chamber Ready';get('[data-scene-detail]').textContent=sleeping?(sleep.occupantName+' / emergency monitor active'):info.details.report?.text||'Ready for a long journey.';
          get('[data-hibernate]').disabled=busy||sleeping||!outside||info.impaired||Boolean(info.hibernationUnavailable);get('[data-wake]').disabled=busy||!sleeping;
          get('[data-hibernation-time]').textContent=sleep?'Time in hibernation: '+Math.floor(Number(sleep.activeSeconds||0)/60)+'m '+Math.floor(Number(sleep.activeSeconds||0)%60)+'s':'';
          get('[data-hibernation-rule]').textContent=!outside?'Encounter alerts prevent hibernation.':info.impaired?'Repair the impaired chamber before entering.':info.hibernationUnavailable?'Unavailable: '+info.hibernationUnavailable+'.':'Wake before moving. No automatic recovery or training bonus.';
          if(sleeping){get('[data-hold]').disabled=true;get('[data-leave]').disabled=true;}
        }
        if(brig){
          for(const field of dialog.querySelectorAll('.crew-room-controls [data-utility-control]'))field.disabled=busy||!info.gm;
          get('[data-scene-state]').textContent=info.impaired?'Brig Damaged':'Custody Register';get('[data-scene-detail]').textContent=info.details.condition||(info.impaired?'General destruction; the GM decides details.':'No damage reported.');
          get('[data-brig-rule]').textContent=info.gm?'Record custody and describe any damage consequences.':'The GM manages these records.';
          const prisoners=(info.details.prisoners||[]).filter(p=>!p.released);get('[data-records]').innerHTML=prisoners.map(p=>`<article><strong>${esc(p.name)}</strong><p>${esc(p.note)}</p>${info.gm?`<button type="button" data-release="${esc(p.id)}" ${busy?'disabled':''}>Release</button>`:''}</article>`).join('')||'<p>No prisoners recorded.</p>';
        }
        if(gym){get('[data-scene-state]').textContent='Fitness and Recreation';get('[data-scene-detail]').textContent=(window.SAShipMap.gravityEnabled(access.ship)?'GRAVITY 1.0 G':'GRAVITY 0 G / Use restraints')+' — '+(info.details.report?.text||'Choose an exercise program.');}
        if(meeting){get('[data-occupants]').innerHTML=(info.occupants||[]).map(p=>`<li>${esc(p.name)}</li>`).join('')||'<li>No crew present.</li>';get('[data-scene-state]').textContent='Meeting Room';get('[data-scene-detail]').textContent=(info.occupants||[]).length+' present';get('[data-records]').textContent=info.details.notes.map(n=>n.title+': '+n.text).join(' / ')||'Room available.';}
        if(ai){for(const button of dialog.querySelectorAll('[data-ai-mode]'))button.setAttribute('aria-pressed',String(button.dataset.aiMode===(info.details.automationMode||'off')));get('[data-ai-seat]').textContent=(info.details.automationMode&&info.details.automationMode!=='off'?info.details.automationMode.toUpperCase()+' / ':'')+(info.details.station||'A free bridge station is required for ship actions.');get('[data-scene-state]').textContent=info.details.enabled===false?'AI standby':info.details.name||'Ship AI online';get('[data-scene-detail]').textContent=info.aiAlert?.text||'Bridge intrusion monitor active';}
      }
      let pendingCommand=null;
      async function send(extra){
        if(busy)return;if(!b.state().practice&&extra.kind==='treat'&&!b.confirmGmPlayerAction(current(),'Medbay treatment'))return;
        const fingerprint=JSON.stringify(extra);if(pendingCommand?.fingerprint!==fingerprint)pendingCommand={fingerprint,requestId:crypto.randomUUID()};
        busy=true;status.textContent='Submitting...';redraw();try{const result=await b.crewRoomRequest(body({...extra,requestId:pendingCommand.requestId}));pendingCommand=null;status.textContent=result?.result?.text||'Command confirmed.';b.consoleTick();await inspect();}catch(error){status.textContent=error.message;}finally{busy=false;redraw();}
      }
      get('[data-simulate]')?.addEventListener('click',()=>{dialog.dataset.operating='true';send({kind:'simulate',skill:get('[data-skill]').value,text:get('[data-simulation]').value,enabled:get('[data-safety]').checked});});
      function setTheme(){
        const selected=info?.skills.find(s=>s.name===get('[data-skill]').value),theme=selected?.simulation;
        get('[data-simulation]').value=theme?.title||'';dialog.dataset.trainingTheme=theme?.theme||'adventure';get('[data-scene-state]').textContent=theme?.title||'Choose another attribute';
      }
      get('[data-attribute]')?.addEventListener('change',()=>{skillKey='';get('[data-skill]').value='';redraw();setTheme();});
      get('[data-skill]')?.addEventListener('change',()=>{setTheme();redraw();});
      get('[data-simulation]')?.addEventListener('input',()=>{get('[data-scene-state]').textContent=get('[data-simulation]').value;});
      function rollRoomDice({sides,label,explanation,extra}){
        if(trainingRoll||busy)return;
        busy=true;redraw();
        // The shared host resolves a real skill key before replacing its dice pool.
        // Chance-roll titles and custom VR skill names are presentation, not keys.
        const hostSkill=window.SASkillCatalog?.names.includes(extra.skill)?extra.skill:'Engineering';
        const requestId=crypto.randomUUID(),roll=trainingRoll=doc.createElement('dialog'),frame=doc.createElement('iframe'),loading=doc.createElement('div'),message=doc.createElement('p'),retry=doc.createElement('button');
        roll.className='crew-training-dice';roll.setAttribute('aria-label',label);frame.title=label;loading.className='crew-training-loading';retry.type='button';loading.append(message,retry);roll.append(frame,loading);
        let timer,submitted=null,sending=false;
        const load=()=>{clearTimeout(timer);loading.hidden=false;message.textContent='Loading dice...';retry.hidden=true;retry.textContent='Retry Loading Dice';timer=setTimeout(()=>{message.textContent='The dice window has not finished loading.';retry.hidden=false;},3000);frame.src=new URL('character.html?shipRoll=1',location.href).href;};
        const submit=async()=>{if(sending||!submitted)return;sending=true;loading.hidden=false;message.textContent='Applying result...';retry.hidden=true;try{const result=await b.crewRoomRequest(body({...extra,score:submitted.score,diceResults:submitted.diceResults,requestId}));status.textContent=result?.result?.text||'Result confirmed.';b.consoleTick();await inspect();roll.close();}catch(error){message.textContent=error.message;retry.textContent='Retry Submit';retry.hidden=false;}finally{sending=false;}};
        retry.onclick=()=>submitted?submit():load();
        const receive=e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const data=e.data;if(data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:requestId,sides,bonus:0,skill:hostSkill,attributeLabel:label,cancelable:true,immediateResult:true,exertionAvailable:0,difficulty:null,difficultyLabel:explanation,name:label,title:label},location.origin);if(data?.rollId===requestId&&data.type==='sa-ship-skill-opened'){clearTimeout(timer);loading.hidden=true;}if(data?.type==='sa-ship-skill-cancel')roll.close();if(data?.rollId===requestId&&data.type==='sa-ship-skill-result'&&!submitted){submitted={score:data.score,diceResults:data.diceResults};void submit();}};
        doc.defaultView.addEventListener('message',receive);roll.addEventListener('close',()=>{clearTimeout(timer);doc.defaultView.removeEventListener('message',receive);roll.remove();trainingRoll=null;busy=false;if(!disposed)redraw();},{once:true});doc.body.append(roll);roll.showModal();load();
      }
      get('[data-train]')?.addEventListener('click',()=>{
        if(trainingRoll||busy||!info||info.trained)return;
        const skill=get('[data-skill]').value,simulation=get('[data-simulation]').value,safety=get('[data-safety]').checked;
        if(info.skills.find(s=>s.name===skill)?.trainingGain===1){void send({kind:'train',skill,text:simulation,enabled:safety});return;}
        rollRoomDice({sides:[4],label:skill+' training: D4',explanation:'Gain the D4 result in skill tenths. Once per campaign day.',extra:{kind:'train',skill,text:simulation,enabled:safety}});
      });
      get('[data-bartender-save]')?.addEventListener('click',()=>send({kind:'bartender',enabled:get('[data-bartender]').checked}));
      get('[data-order]')?.addEventListener('click',()=>{
        const text=get('[data-drink]').value.trim();if(!text){status.textContent='Name a drink first.';return;}
        if(info?.impaired&&info.details.robotBartender!==false)rollRoomDice({sides:[6],label:'Bartender malfunction: D6',explanation:'1–3: incorrect order. 4–6: requested drink.',extra:{kind:'order',text}});
        else send({kind:'order',text});
      });
      get('[data-hibernate]')?.addEventListener('click',()=>send({kind:'hibernate'}));
      get('[data-wake]')?.addEventListener('click',()=>send({kind:'wake'}));
      get('[data-intake]')?.addEventListener('click',()=>send({kind:'intake',title:get('[data-prisoner-name]').value,text:get('[data-prisoner-note]').value}));
      get('[data-condition]')?.addEventListener('click',()=>send({kind:'condition',text:get('[data-brig-condition]').value}));
      get('[data-records]').addEventListener('click',e=>{const id=e.target.closest('[data-release]')?.dataset.release;if(id)send({kind:'release',noteId:id});});
      get('[data-exercise-start]')?.addEventListener('click',()=>send({kind:'exercise',text:get('[data-exercise]').value}));
      dialog.querySelectorAll('[data-lab-transfer]').forEach(button=>button.onclick=()=>send({kind:button.dataset.labTransfer,mineral:get('[data-lab-mineral]').value,quantity:Number(get('[data-lab-quantity]').value)}));
      get('[data-load]')?.addEventListener('click',()=>send({kind:'load'}));get('[data-treat]')?.addEventListener('click',()=>send({kind:'treat',patientId:get('[data-patient]').value}));get('[data-patient]')?.addEventListener('change',redraw);
      get('[data-stop]')?.addEventListener('click',()=>send({kind:'cancel',jobId:get('[data-stop]').dataset.job}));
      get('[data-note]')?.addEventListener('click',()=>send({kind:'note',title:get('[data-title]').value,text:get('[data-text]').value}));get('[data-search]')?.addEventListener('input',redraw);
      get('[data-refresh]')?.addEventListener('click',()=>send({kind:'refresh'}));
      get('[data-records]').addEventListener('change',e=>{if(e.target.dataset.check)send({kind:'check',noteId:e.target.dataset.check,checked:e.target.checked});});
      get('[data-records]').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');if(remove)send({kind:'remove',noteId:remove.dataset.remove});});
      for(const button of dialog.querySelectorAll('[data-ai-mode]'))button.addEventListener('click',()=>send({kind:'configure',automationMode:button.dataset.aiMode,text:get('[data-ai-name]').value,enabled:true}));
      get('[data-ai-save]')?.addEventListener('click',()=>send({kind:'configure',text:get('[data-ai-name]').value,enabled:get('[data-ai-enabled]').checked}));
      get('[data-advice]')?.addEventListener('click',()=>{const ship=window.SAStationAccess.access(b.state(),current(),sicId)?.ship;status.textContent='Assessment: Defense '+ship.defenseScore+'. '+window.SAShipMap.installedItems(ship).length+' installed systems. '+(ship.ship.oxygenEnabled===false?'Oxygen is disabled. ':'')+(window.SAShipMap.gravityEnabled(ship)?'Gravity nominal.':'Gravity is disabled.');});
      get('[data-close]').onclick=()=>{window.SAShipNavigationUI.remember(unit);dialog.close();};get('[data-sound]').onclick=()=>{b.toggleSound();window.SAConsoleCommon.updateSound(dialog);};
      get('[data-hold]').onclick=()=>window.SAShipNavigationUI.toggleHold(current()).catch(e=>status.textContent=e.message);
      get('[data-leave]').onclick=()=>{const person=current();dialog.close();window.SACombatMap.openMove(person);};
      window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>dialog.close());
      let timer;const close=()=>dialog.close();dialog.onclose=()=>{disposed=true;trainingRoll?.close();clearInterval(timer);dialog.remove();if(view===dialog)view=null;if(serial===openSerial)opening=false;window.removeEventListener('pagehide',close);b.requestRender();};window.addEventListener('pagehide',close,{once:true});await inspect();if(!disposed)timer=setInterval(inspect,1200);
    }catch(error){window.alert(error.message);view?.close();view?.remove();view=null;}finally{if(serial===openSerial)opening=false;if(!view)b.requestRender();}
  }
  window.SACrewRoomConsole={open,isOpen:()=>Boolean(view||opening)};
}());
