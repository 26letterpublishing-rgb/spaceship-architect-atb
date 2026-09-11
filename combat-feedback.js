(function(){
  const seen=new Set(),hp=new Map();let initialized=false,audio=null;
  const host=()=>{let d=document;try{while(d.defaultView.frameElement)d=d.defaultView.parent.document;}catch{}return d;};
  function sound(kind){
    const b=window.SACombatBridge;if(!b?.soundEnabled()||host().hidden)return;
    if(kind==='explosion'){const clip=new Audio(new URL('ship-explosion.mp3',location.href));clip.volume=.85;clip.play().catch(()=>{});return;}
    if(kind==='impact'){try{audio ||= new AudioContext();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,g=audio.createGain(),osc=audio.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(95,t);osc.frequency.exponentialRampToValueAtTime(45,t+.14);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.025,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.16);osc.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.17);}catch{}return;}
    try{audio ||= new AudioContext();if(audio.state==='suspended')audio.resume();const start=audio.currentTime;
      for(let i=0;i<(kind==='blaster'?5:2);i++){
        const t=start+i*.095,g=audio.createGain(),osc=audio.createOscillator(),filter=audio.createBiquadFilter();g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.18,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+.18);filter.type='lowpass';filter.frequency.value=2400;osc.type='sawtooth';osc.frequency.setValueAtTime(kind==='blaster'?900:620,t);osc.frequency.exponentialRampToValueAtTime(kind==='blaster'?85:920,t+.16);osc.connect(filter);filter.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.2);
        if(kind==='blaster'){const buffer=audio.createBuffer(1,audio.sampleRate*.09,audio.sampleRate),data=buffer.getChannelData(0);for(let n=0;n<data.length;n++)data[n]=(Math.random()*2-1)*Math.exp(-n/data.length*7);const noise=audio.createBufferSource();noise.buffer=buffer;noise.connect(filter);noise.start(t);}
      }
    }catch{}
  }
  function popup(title,text){const doc=host(),d=doc.createElement('dialog');d.className='combat-result-popup';d.setAttribute('aria-label',title);const h=doc.createElement('h2'),p=doc.createElement('p'),ok=doc.createElement('button');h.textContent=title;p.textContent=text;ok.textContent='OK';ok.onclick=()=>d.close();d.append(h,p,ok);doc.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();ok.focus();}
  function surfaces(){return [...new Set([document,host()])];}
  function impact(id,explosion=false){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const doc of surfaces()){
      for(const e of doc.querySelectorAll(`[data-space-ship="${CSS.escape(id)}"],[data-ship-combat-lane="${CSS.escape(id)}"] .tactical-ring-svg,[data-ship-combat-lane="${CSS.escape(id)}"] .meter,[data-ring-group="${CSS.escape(id)}"] .tactical-ring-svg`)){
        const map=e.hasAttribute('data-space-ship'),matrix=e.getScreenCTM?.(),scale=matrix?Math.hypot(matrix.a,matrix.b):1,shift=(map?1.5:3)/Math.max(.0001,scale);
        e.animate([{filter:'none'},{filter:'brightness(1.5) sepia(1) saturate(6) hue-rotate(320deg)'},{filter:'none'}],{duration:explosion?1100:650});
        if(!reduced)e.animate([0,1,-1,.5,0].map(n=>({transform:`translateX(${n*shift}px)`})),{duration:map?320:450,composite:'add'});
        if(explosion&&e.hasAttribute('data-space-ship')){const box=e.getBoundingClientRect(),burst=doc.createElement('div');burst.className='ship-explosion-burst';burst.style.left=box.x+box.width/2+'px';burst.style.top=box.y+box.height/2+'px';(doc.querySelector('dialog[open]')||doc.body).append(burst);setTimeout(()=>burst.remove(),1300);}
      }
    }
    sound(explosion?'explosion':'impact');
  }
  function bolts(event,shipId){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){sound('blaster');return;}
    for(const doc of surfaces())for(const svg of doc.querySelectorAll('[data-space-canvas]')){
      const from=svg.querySelector(`[data-space-ship="${CSS.escape(shipId)}"]`),to=svg.querySelector(`[data-space-ship="${CSS.escape(event.targetId)}"]`);if(!from||!to||from===to)continue;
      const p=new DOMPoint(0,0).matrixTransform(from.getCTM()).matrixTransform(svg.getCTM().inverse()),q=new DOMPoint(0,0).matrixTransform(to.getCTM()).matrixTransform(svg.getCTM().inverse());
      for(let i=0;i<5;i++)setTimeout(()=>{if(!svg.isConnected)return;const line=doc.createElementNS('http://www.w3.org/2000/svg','line'),dx=q.x-p.x,dy=q.y-p.y;line.setAttribute('x1',0);line.setAttribute('y1',0);line.setAttribute('x2',dx*.13);line.setAttribute('y2',dy*.13);line.setAttribute('stroke','#fff6ae');line.setAttribute('stroke-width',svg.viewBox.baseVal.width/230);line.setAttribute('stroke-linecap','round');line.style.filter='drop-shadow(0 0 3px #ff6428)';line.dataset.laserEffect='';svg.append(line);const drift=event.hit?0:svg.viewBox.baseVal.width*.025;line.animate([{transform:`translate(${p.x}px,${p.y}px)`},{transform:`translate(${q.x+drift}px,${q.y+drift}px)`}],{duration:320,fill:'forwards'});setTimeout(()=>line.remove(),340);},i*90);
    }sound('blaster');
  }
  function tick(){
    const b=window.SACombatBridge,state=b?.state();if(!state)return;const doc=host();
    for(const d of surfaces())if(!d.querySelector('[data-combat-feedback-style]')){const link=d.createElement('link');link.rel='stylesheet';link.href=new URL('combat-feedback.css',location.href);link.dataset.combatFeedbackStyle='';d.head.append(link);}
    const damaged=new Set();
    const events=state.starships.flatMap(ship=>[...(ship.weaponState?.reports||[]),...(ship.lockState?.reports||[])].map(e=>({...e,source:ship.id}))).sort((a,b)=>Number(Boolean(b.operatorId))-Number(Boolean(a.operatorId)));
    for(const e of events){if(seen.has(e.id))continue;seen.add(e.id);if(!initialized||Date.now()-Date.parse(e.at)>15000)continue;
      if(e.shot&&e.operatorId&&!e.awaitingDamage){bolts(e,e.source);if(!e.hit&&(b.mode()==='gm'||e.operatorId===b.myUnitId()))setTimeout(()=>popup('Shot Missed',e.text),750);}
      if(e.impact){
        damaged.add(e.targetId);const destroyed=Boolean(state.starships.find(s=>s.id===e.targetId)?.destroyedAt);
        // Let the confirmed dice dialog close before the visible burst and impact.
        setTimeout(()=>{if(e.operatorId)bolts(e,e.source);setTimeout(()=>impact(e.targetId,destroyed),700);},250);
      }
      if(e.incomingLock||e.lockResult&&e.success)sound('lock');
    }
    for(const ship of state.starships){
      const total=(ship.currentHullHp??0)+(ship.currentShieldHp??0),previous=hp.get(ship.id);if(initialized&&previous!==undefined&&total<previous&&!damaged.has(ship.id))impact(ship.id,Boolean(ship.destroyedAt));hp.set(ship.id,total);
      for(const d of surfaces())for(const marker of d.querySelectorAll(`[data-space-ship="${CSS.escape(ship.id)}"]`)){marker.classList.toggle('ship-wreck',Boolean(ship.destroyedAt));if(ship.destroyedAt){const label=marker.querySelector('text');if(label&&!label.textContent.endsWith(' [DESTROYED]'))label.textContent+=' [DESTROYED]';}}
      const victory='victory:'+ship.victoryAt;if(ship.victoryAt&&!seen.has(victory)){seen.add(victory);if(initialized&&Date.now()-Date.parse(ship.victoryAt)<15000)setTimeout(()=>popup('VICTORY',`${ship.title} is the last surviving ship.`),2200);}
    }
    for(const d of surfaces())for(const p of d.querySelectorAll('.combat-log-entry,[data-activity] p,.ship-lane-log p,.pilot-log p'))if(/Starship detected/.test(p.textContent))p.classList.add('detected-log-entry');
    if(seen.size>3000){seen.clear();events.forEach(e=>seen.add(e.id));}
    initialized=true;
  }
  const timer=setInterval(tick,180);window.addEventListener('pagehide',()=>{clearInterval(timer);audio?.close();});window.SACombatFeedback={popup,sound,impact};
}());
