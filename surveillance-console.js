(function(){
 let currentView=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function monitors(info){
  const occupied=(info.rooms||[]).map(room=>({...room,crew:info.crew.filter(p=>room.cells.includes(p.square))})).filter(room=>room.crew.length);
  if(!occupied.length)return '<p class="surveillance-empty">No occupied rooms.</p>';
  return occupied.map((room,i)=>{
   const xs=room.cells.map(n=>n%info.columns),ys=room.cells.map(n=>Math.floor(n/info.columns));
   const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x+1,h=Math.max(...ys)-y+1,crew=room.crew;
   return `<figure class="surveillance-monitor"><figcaption><span>${esc(room.name)}</span><span>${crew.length} aboard</span></figcaption><svg viewBox="${x-.12} ${y-.12} ${w+.24} ${h+.24}" role="img" aria-label="${esc(room.name)} camera"><defs><clipPath id="camera-sector-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#camera-sector-${i})">
    ${room.cells.map(n=>`<rect x="${n%info.columns+.04}" y="${Math.floor(n/info.columns)+.04}" width=".92" height=".92"/>`).join('')}
    ${Object.entries(info.doors||{}).map(([key,value])=>{const [a,b]=key.split(':').map(Number),ax=a%info.columns,ay=Math.floor(a/info.columns),bx=b%info.columns,by=Math.floor(b/info.columns);return `<line class="${value==='open'?'door-open':'door-closed'}" x1="${ax===bx?ax+.18:Math.max(ax,bx)}" y1="${ay===by?ay+.18:Math.max(ay,by)}" x2="${ax===bx?ax+.82:Math.max(ax,bx)}" y2="${ay===by?ay+.82:Math.max(ay,by)}"/>`;}).join('')}
    ${crew.map(p=>`<circle class="${p.hostile?'intruder':'crew'}" cx="${p.square%info.columns+((p.mesh??4)%3+.5)/3}" cy="${Math.floor(p.square/info.columns)+(Math.floor((p.mesh??4)/3)+.5)/3}" r=".17"><title>${esc(p.name)}</title></circle>`).join('')}
   </g></svg><small>${crew.map(p=>esc(p.name)).join(' · ')||'No crew in this sector'}</small></figure>`;
  }).join('');
 }
 function open(unit,sicId){
  if(currentView)return;const b=window.SACombatBridge,initial=window.SAStationAccess.access(b.state(),unit,sicId);if(!initial?.definition.surveillance)return;
  let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
  for(const name of ['utility-console.css','console-common.css','surveillance-console.css'])if(!doc.querySelector(`link[href="${name}"]`)){const l=doc.createElement('link');l.rel='stylesheet';l.href=name;doc.head.append(l);}
  const view=doc.createElement('dialog');currentView=view;view.className='utility-console lock-console surveillance-console';view.dataset.operatorId=unit.id;view.dataset.sicId=sicId;view.setAttribute('aria-label','Surv. Camera console');
  view.innerHTML=`<header><div><small>${esc(unit.characterName)} / SHIP SECURITY</small><h2>Surv. Camera</h2></div><div data-selector></div><button data-sound type="button">${b.soundIcon()}</button><button data-close type="button">Combat View</button></header><section class="surveillance-coverage"><div class="security-room-scene"><img src="security-console-scene.webp" alt="Ship security monitoring room"><i aria-hidden="true"></i></div><div class="surveillance-heading"><strong data-feed-status>Connecting cameras…</strong><span>SHIP-WIDE COVERAGE</span></div><div class="surveillance-monitors" data-monitors></div><p class="surveillance-legend">● Crew &nbsp; <span>● Intruder</span> &nbsp; Amber lines: closed doors</p></section><section class="surveillance-desk"><div><h3>Interior crew positions</h3><div data-crew></div></div><div><h3>Security activity</h3><p>Automatic intruder alerts and door closure remain active without an operator.</p><output data-status role="status"></output><p data-report></p></div></section><section class="utility-seat"><button data-hold type="button">Hold</button><button data-leave type="button">Leave Station</button></section>`;
  const get=s=>view.querySelector(s),person=()=>b.state().units.find(u=>u.id===unit.id);let closed=false,busy=false,last='';
  function clear(message){last='';get('[data-monitors]').replaceChildren();get('[data-crew]').replaceChildren();get('[data-report]').textContent='';get('[data-feed-status]').textContent='CAMERA FEED UNAVAILABLE';get('[data-status]').textContent=message;}
  function controls(){const p=person(),ready=b.state().activeId===p?.id&&!p?.timedAction&&!p?.delayedAction&&!p?.delayTimer;
   get('[data-hold]').hidden=Boolean(b.state().practice);get('[data-hold]').disabled=!ready&&!p?.consoleHold;get('[data-hold]').textContent=p?.consoleHold?'Resume':'Hold';get('[data-leave]').hidden=Boolean(b.state().practice);get('[data-leave]').disabled=!ready;
   const access=window.SAStationAccess.access(b.state(),p,sicId);if(!access||access.blocked)clear('Connection lost. Return to an available station or restore camera access.');
  }
  async function refresh(){
   if(busy||closed||doc.hidden)return;busy=true;
   try{const {result:info}=await b.surveillanceRequest({id:unit.id,characterId:unit.characterId,sicId});if(closed)return;
    const access=window.SAStationAccess.access(b.state(),person(),sicId);if(!access||access.blocked){clear('Camera access unavailable.');return;}
    const key=JSON.stringify(info);if(key!==last){last=key;get('[data-monitors]').innerHTML=monitors(info);get('[data-crew]').innerHTML=info.crew.length?`<ul>${info.crew.map(p=>`<li><strong>${esc(p.name)}</strong><span>Row ${Math.floor(p.square/info.columns)+1}, column ${p.square%info.columns+1}${p.hostile?' · INTRUDER':''}</span></li>`).join('')}</ul>`:'No crew aboard.';get('[data-report]').textContent=info.reports.at(-1)?.text||'No intrusions recorded.';}
    get('[data-feed-status]').textContent=`${info.title} / ${info.controlled?'CAPTURED CAMERA FEED':'LIVE'}`;get('[data-status]').textContent='';
   }catch(e){if(!closed)clear(e.message);}finally{busy=false;}
  }
  get('[data-close]').onclick=()=>view.close();get('[data-sound]').onclick=()=>b.toggleSound();
  get('[data-hold]').onclick=async()=>{try{await window.SAShipNavigationUI.toggleHold(person());}catch(e){get('[data-status]').textContent=e.message;}};
  get('[data-leave]').onclick=()=>{if(!b.confirmGmPlayerAction(person(),'leaveStation'))return;view.close();window.SACombatMap.openMove(person());};
  const close=()=>view.close();view.addEventListener('close',()=>{closed=true;clearInterval(timer);clearInterval(controlTimer);window.removeEventListener('pagehide',close);currentView=null;view.remove();b.requestRender();},{once:true});
  doc.body.append(view);view.showModal();window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,close);window.SAConsoleCommon.mount(view,unit);window.addEventListener('pagehide',close,{once:true});
  const timer=setInterval(refresh,1000),controlTimer=setInterval(controls,200);controls();refresh();
 }
 window.SASurveillanceConsole={open};
}());
