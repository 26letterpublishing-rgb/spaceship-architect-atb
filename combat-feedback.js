(function(){
  const seen=new Set(),hp=new Map(),debrisAfter=new Map(),impactShakes=new WeakMap();let initialized=false,audio=null;
  const host=()=>{let d=document;try{while(d.defaultView.frameElement&&!d.defaultView.frameElement.hasAttribute('data-explore-perspective'))d=d.defaultView.parent.document;}catch{}return d;};
  function sound(kind){
    const b=window.SACombatBridge;if(!b?.soundEnabled()||host().hidden)return;
    if(kind==='missile'){try{audio ||= new AudioContext();audio.resume();const t=audio.currentTime,n=audio.sampleRate*1.2,buffer=audio.createBuffer(1,n,audio.sampleRate),samples=buffer.getChannelData(0);let low=0;for(let i=0;i<n;i++){low=(low+.08*(Math.random()*2-1))/1.08;samples[i]=low*4;}const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(300,t);filter.frequency.exponentialRampToValueAtTime(3200,t+.12);filter.frequency.exponentialRampToValueAtTime(180,t+1.15);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.8,t+.07);gain.gain.exponentialRampToValueAtTime(.001,t+1.2);source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}catch{}return;}
    if(kind==='explosion'){const clip=new Audio(new URL('ship-explosion.mp3',location.href));clip.volume=.85;clip.play().catch(()=>{});return;}
    if(kind==='impact'){try{audio ||= new AudioContext();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,g=audio.createGain(),osc=audio.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(95,t);osc.frequency.exponentialRampToValueAtTime(45,t+.14);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.025,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.16);osc.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.17);}catch{}return;}
    try{audio ||= new AudioContext();if(audio.state==='suspended')audio.resume();const start=audio.currentTime;
      for(let i=0;i<(kind==='blaster'?5:2);i++){
        const t=start+i*.095,g=audio.createGain(),osc=audio.createOscillator(),filter=audio.createBiquadFilter();g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.18,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+.18);filter.type='lowpass';filter.frequency.value=2400;osc.type='sawtooth';osc.frequency.setValueAtTime(kind==='blaster'?900:620,t);osc.frequency.exponentialRampToValueAtTime(kind==='blaster'?85:920,t+.16);osc.connect(filter);filter.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.2);
        if(kind==='blaster'){const buffer=audio.createBuffer(1,audio.sampleRate*.09,audio.sampleRate),data=buffer.getChannelData(0);for(let n=0;n<data.length;n++)data[n]=(Math.random()*2-1)*Math.exp(-n/data.length*7);const noise=audio.createBufferSource();noise.buffer=buffer;noise.connect(filter);noise.start(t);}
      }
    }catch{}
  }
  function popup(title,text){const doc=host(),d=doc.createElement('dialog');d.className='combat-result-popup';d.setAttribute('aria-label',title);const h=doc.createElement('h2'),p=doc.createElement('p'),ok=doc.createElement('button');h.textContent=title;p.textContent=text;ok.textContent='OK';ok.onclick=async()=>{const bridge=window.SACombatBridge;if(title==='VICTORY'&&bridge.mode()==='player'){ok.disabled=true;try{await bridge.action({action:'acknowledgeVictory',id:bridge.myUnitId()},'resolve',{throwOnError:true});}catch(error){console.warn('Victory acknowledgement:',error.message);}finally{ok.disabled=false;}}d.close();};d.append(h,p,ok);doc.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();ok.focus();}
  function surfaces(){return [...new Set([document,host()])];}
  let stage=null,stageTimer=null;
  function present(duration=2400){
    const doc=host(),b=window.SACombatBridge,s=b?.state();if(!s||doc.hidden)return;
    clearTimeout(stageTimer);
    if(!stage){
      if(!doc.querySelector('[data-navigation-style]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('ship-navigation-ui.css',location.href);link.dataset.navigationStyle='';doc.head.append(link);}
      stage=doc.createElement('dialog');stage.className='combat-effect-stage';stage.setAttribute('aria-label','Starship combat animation');
      const picture=window.SASpaceMap.markup(s.starships,s.shipPositions,false,{navigation:true});
      stage.innerHTML=`<h2>TACTICAL VIEW</h2>${picture}<div class="pilot-rings impact-timelines">${b.pilotRings?.()||''}</div>`;
      doc.body.append(stage);for(const d of surfaces())d.body.dataset.impactPresenting='true';stage.showModal();
      stage.addEventListener('cancel',e=>e.preventDefault());
      requestAnimationFrame(()=>{for(const label of stage?.querySelectorAll('[data-space-ship] text')||[]){const matrix=label.getScreenCTM();if(matrix)label.style.fontSize=`${20/Math.max(.001,Math.hypot(matrix.a,matrix.b))}px`;}});
    }
    stageTimer=setTimeout(()=>{for(const d of surfaces())delete d.body.dataset.impactPresenting;stage?.close();stage?.remove();stage=null;},duration);
  }
  function impact(id,explosion=false,missile=false){
    if(explosion)debrisAfter.set(id,Date.now()+1250);
    present(explosion?1800:1300);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const doc of surfaces()){
      for(const e of doc.querySelectorAll(`[data-space-ship="${CSS.escape(id)}"],[data-ship-combat-lane="${CSS.escape(id)}"] .tactical-ring-svg,[data-ship-combat-lane="${CSS.escape(id)}"] .meter,[data-ring-group="${CSS.escape(id)}"] .tactical-ring-svg`)){
        if(e.closest('[data-space-editable="true"]'))continue;
        if(stage&&!stage.contains(e))continue;
        const map=e.hasAttribute('data-space-ship'),matrix=e.getScreenCTM?.(),scale=matrix?Math.hypot(matrix.a,matrix.b):1,shift=(map?1.5:3)/Math.max(.0001,scale);
        e.animate([{filter:'none'},{filter:'brightness(1.5) sepia(1) saturate(6) hue-rotate(320deg)'},{filter:'none'}],{duration:explosion?1100:650});
        // Repeated hits replace their own shake instead of adding displacement.
        // Keep the underlying SVG map transform and unrelated animations intact.
        impactShakes.get(e)?.cancel();
        if(!reduced)impactShakes.set(e,e.animate([0,1,-1,.5,0].map(n=>({transform:`translateX(${n*shift}px)`})),{duration:map?320:450,composite:'add'}));
        if((explosion||missile)&&map){const burst=doc.createElementNS('http://www.w3.org/2000/svg','circle');burst.dataset.explosion='';burst.dataset.missileImpact=String(missile);burst.setAttribute('r',(explosion?12:7)/Math.max(.0001,scale));burst.setAttribute('fill','#ffe7a0');burst.style.filter='drop-shadow(0 0 5px #ff732c)';e.append(burst);burst.animate([{opacity:1,scale:'.2'},{opacity:.9,scale:'2'},{opacity:0,scale:'3'}],{duration:1200,fill:'forwards'});setTimeout(()=>burst.remove(),1300);}
      }
    }
    sound(explosion||missile?'explosion':'impact');
  }
  function bolts(event,shipId){
    present(1600);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){sound('blaster');return;}
    for(const doc of surfaces())for(const svg of doc.querySelectorAll('[data-space-canvas]')){
      if(svg.dataset.spaceEditable==='true')continue;
      if(stage&&!stage.contains(svg))continue;
      const from=svg.querySelector(`[data-space-ship="${CSS.escape(shipId)}"]`),to=svg.querySelector(`[data-space-ship="${CSS.escape(event.targetId)}"]`);if(!from||!to||from===to)continue;
      const p=new DOMPoint(0,0).matrixTransform(from.getCTM()).matrixTransform(svg.getCTM().inverse()),q=new DOMPoint(0,0).matrixTransform(to.getCTM()).matrixTransform(svg.getCTM().inverse());
      if(event.weaponFamily==='beam-laser'){
        const line=doc.createElementNS(svg.namespaceURI,'line');for(const [key,value] of Object.entries({x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#ffe99c','stroke-width':svg.viewBox.baseVal.width/180}))line.setAttribute(key,value);line.dataset.laserEffect='';line.style.filter='drop-shadow(0 0 5px #ffba43)';svg.append(line);line.animate([{opacity:0},{opacity:1,offset:.15},{opacity:0}],{duration:650,fill:'forwards'});setTimeout(()=>line.remove(),680);continue;
      }
      if(event.weaponFamily==='ripple-cannon'){
        for(let i=0;i<4;i++)setTimeout(()=>{if(!svg.isConnected)return;const ring=doc.createElementNS(svg.namespaceURI,'circle');ring.setAttribute('r',svg.viewBox.baseVal.width*(.003+i*.001));ring.setAttribute('fill','none');ring.setAttribute('stroke','#7dffbe');ring.setAttribute('stroke-width',svg.viewBox.baseVal.width/420);ring.dataset.laserEffect='';svg.append(ring);ring.animate([{transform:`translate(${p.x}px,${p.y}px)`,opacity:1},{transform:`translate(${q.x}px,${q.y}px)`,opacity:0}],{duration:480,fill:'forwards'});setTimeout(()=>ring.remove(),510);},i*80);continue;
      }
      for(let i=0;i<5;i++)setTimeout(()=>{if(!svg.isConnected)return;const line=doc.createElementNS('http://www.w3.org/2000/svg','line'),dx=q.x-p.x,dy=q.y-p.y;line.setAttribute('x1',0);line.setAttribute('y1',0);line.setAttribute('x2',dx*.13);line.setAttribute('y2',dy*.13);line.setAttribute('stroke','#fff6ae');line.setAttribute('stroke-width',svg.viewBox.baseVal.width/230);line.setAttribute('stroke-linecap','round');line.style.filter='drop-shadow(0 0 3px #ff6428)';line.dataset.laserEffect='';svg.append(line);const drift=event.hit?0:svg.viewBox.baseVal.width*.025;line.animate([{transform:`translate(${p.x}px,${p.y}px)`},{transform:`translate(${q.x+drift}px,${q.y+drift}px)`}],{duration:320,fill:'forwards'});setTimeout(()=>line.remove(),340);},i*90);
    }sound('blaster');
  }
  function tick(){
    const b=window.SACombatBridge,state=b?.state();if(!state)return;const doc=host();
    for(const d of surfaces())if(!d.querySelector('[data-combat-feedback-style]')){const link=d.createElement('link');link.rel='stylesheet';link.href=new URL('combat-feedback.css',location.href);link.dataset.combatFeedbackStyle='';d.head.append(link);}
    const damaged=new Set();
    const locks=new Set(state.starships.flatMap(ship=>(ship.lockState?.targets||[]).map(lock=>lock.targetId)));
    for(const surface of surfaces())for(const marker of surface.querySelectorAll('[data-space-ship]')){
      const existing=marker.querySelector('[data-target-reticle]');if(!locks.has(marker.dataset.spaceShip)){existing?.remove();continue;}if(existing)continue;
      const circle=surface.createElementNS('http://www.w3.org/2000/svg','circle'),radius=Number(marker.querySelector('circle')?.getAttribute('r'))||.3;circle.dataset.targetReticle='';circle.setAttribute('r',radius*1.8);circle.setAttribute('fill','none');circle.setAttribute('stroke','#ffdf58');circle.setAttribute('stroke-width',radius*.13);circle.setAttribute('stroke-dasharray',`${radius*.8} ${radius*.3}`);marker.append(circle);
    }
    const events=state.starships.flatMap(ship=>[...(ship.weaponState?.reports||[]),...(ship.lockState?.reports||[])].map(e=>({...e,source:ship.id}))).sort((a,b)=>Number(Boolean(b.operatorId))-Number(Boolean(a.operatorId)));
    for(const e of events){if(seen.has(e.id))continue;seen.add(e.id);if(!initialized||Date.now()-Date.parse(e.at)>15000)continue;
      if(e.shot&&e.operatorId&&!e.awaitingDamage){bolts(e,e.source);if(!e.hit&&(b.mode()==='gm'||e.operatorId===b.myUnitId()))setTimeout(()=>popup('Shot Missed',e.text),750);}
      if(e.impact){
        present(2800);
        damaged.add(e.targetId);const destroyed=Boolean(state.starships.find(s=>s.id===e.targetId)?.destroyedAt);if(destroyed)debrisAfter.set(e.targetId,Date.now()+2300);
        // Let the confirmed dice dialog close before the visible burst and impact.
        setTimeout(()=>{if(e.operatorId&&e.weaponFamily!=='missile')bolts(e,e.source);setTimeout(()=>impact(e.targetId,destroyed,e.weaponFamily==='missile'),e.weaponFamily==='missile'?0:700);},250);
      }
      if(e.missileLaunch)sound('missile');
      if(e.incomingLock||e.lockResult&&e.success)sound('lock');
    }
    for(const ship of state.starships){
      const total=(ship.currentHullHp??0)+(ship.currentShieldHp??0),previous=hp.get(ship.id);if(initialized&&previous!==undefined&&total<previous&&!damaged.has(ship.id))impact(ship.id,Boolean(ship.destroyedAt));hp.set(ship.id,total);
      for(const d of surfaces())for(const marker of d.querySelectorAll(`[data-space-ship="${CSS.escape(ship.id)}"]`)){const wreck=Boolean(ship.destroyedAt)&&Date.now()>=Math.max(Date.parse(ship.destroyedAt)+2400,debrisAfter.get(ship.id)||0);marker.classList.toggle('ship-wreck',wreck);if(!wreck)marker.querySelector('[data-debris]')?.remove();if(wreck){const label=marker.querySelector(':scope > text'),name=(ship.title||ship.ship?.title||'Starship').split(' — ')[0]+' [DESTROYED]';if(label&&label.textContent!==name)label.textContent=name;if(!marker.querySelector('[data-debris]')){const debris=d.createElementNS('http://www.w3.org/2000/svg','g'),radius=Number(marker.querySelector('circle')?.getAttribute('r'))||.3;debris.dataset.debris='';for(let n=0;n<18;n++){const pixel=d.createElementNS(debris.namespaceURI,'rect');pixel.setAttribute('x',Math.sin(n*13.37)*radius*1.5);pixel.setAttribute('y',Math.cos(n*4.91)*radius);pixel.setAttribute('width',radius*.22);pixel.setAttribute('height',radius*.22);pixel.setAttribute('fill','currentColor');debris.append(pixel);}marker.append(debris);}}}
      const victory='victory:'+ship.victoryAt;if(ship.victoryAt&&!seen.has(victory)){seen.add(victory);if(initialized&&Date.now()-Date.parse(ship.victoryAt)<15000)setTimeout(()=>popup('VICTORY',`${ship.title} is the last surviving ship.`),2200);}
    }
    for(const d of surfaces())for(const p of d.querySelectorAll('[data-activity] p,.pilot-log p'))if(/Starship detected/.test(p.textContent))p.classList.add('detected-log-entry');else if(/ENEMY LOCK-ON/.test(p.textContent))p.classList.add('enemy-lock-log-entry');
    if(seen.size>3000){seen.clear();events.forEach(e=>seen.add(e.id));}
    initialized=true;
  }
  const timer=setInterval(tick,180);window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(stageTimer);for(const d of surfaces())delete d.body.dataset.impactPresenting;stage?.remove();audio?.close();});window.SACombatFeedback={popup,sound,impact};
}());
