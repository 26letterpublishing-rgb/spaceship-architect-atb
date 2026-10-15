(function(){
 'use strict';
 let view=null,context=null,choice='',move=null,frame=0,stamp=0,lastPolicy='',lastRoom='';
 const xy=p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
 const equal=(a,b)=>a&&b&&Math.abs(a.q-b.q)+Math.abs(a.r-b.r)<1e-5;
 const allowed=(c,k)=>c.state.role==='gm'||c.state.starmaps.navigation?.allowed?.[k]!==false;
 function set(next,c=context){view=next;move=null;choice='';c.draw();}
 function controls(c,area){
  if(c.state.role!=='gm')return;
  area.append(c.button('PC Map Visibility',()=>{
   const n=c.data.navigation||{mode:'galaxy',allowed:{}},stars=c.data.maps.flatMap(m=>m.stars.map(s=>({m,s}))),d=c.modal('What players can see',`<label class="galaxy-field">Starting view<select name="mode">${['galaxy','system','orbit','surface'].map(k=>`<option ${n.mode===k?'selected':''}>${k}</option>`).join('')}</select></label><label class="galaxy-field">Star system<select name="star">${stars.map(({m,s})=>`<option value="${c.esc(s.id)}" ${s.id===n.starId?'selected':''}>${c.esc(m.name+' / '+s.name)}</option>`).join('')}</select></label><label class="galaxy-field">Planet<select name="planet"></select></label><p>Allow players to open these views as their travel permits:</p><div class="galaxy-form-columns">${['surface','orbit','system','galaxy'].map(k=>`<label><input type="checkbox" name="allow-${k}" ${n.allowed?.[k]!==false?'checked':''}> ${k}</label>`).join('')}</div>`,async f=>{const entry=stars.find(x=>x.s.id===f.get('star'));await c.send('navigation',{mode:f.get('mode'),mapId:entry?.m.id,starId:entry?.s.id,planetId:f.get('planet'),allowed:Object.fromEntries(['surface','orbit','system','galaxy'].map(k=>[k,f.has('allow-'+k)]))});});
   const select=d.querySelector('[name=star]'),planets=d.querySelector('[name=planet]'),refresh=()=>{planets.innerHTML=(stars.find(x=>x.s.id===select.value)?.s.system||[]).filter(o=>o.kind==='planet').map(p=>`<option value="${c.esc(p.id)}" ${p.id===n.planetId?'selected':''}>${c.esc(p.name)}</option>`).join('');};select.onchange=refresh;refresh();
  }));
 }
 function files(c,area){if(c.state.role!=='gm')return;
  area.append(c.button('Save Galaxy Map',()=>{if(!c.map)throw Error('Create a map first.');const url=URL.createObjectURL(new Blob([JSON.stringify({format:'sa2-galaxy',version:1,map:c.map},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(c.map.name||'Galaxy')+'.sa2galaxy';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),c.button('Load Galaxy Map',()=>{const input=document.createElement('input');input.type='file';input.accept='.sa2galaxy,.json';input.onchange=async()=>{try{if(!input.files[0])return;if(input.files[0].size>5e6)throw Error('Galaxy Map files must be smaller than 5 MB.');const data=JSON.parse(await input.files[0].text());await c.send('loadGalaxy',{data});c.status('Galaxy Map loaded as a new map.');}catch(e){c.status(e.message,true);}};input.click();}));
 }
 function open(c,map,star,ship){const next={mode:'system',mapId:map.id,starId:star.id,shipId:ship?.id};if(c.state.role==='gm'){set(next,c);return;}return c.send('enterSystem',{mapId:map.id,starId:star.id,shipId:ship.id}).then(()=>set(next,c));}

 function safetyDice(count,risk){
  return new Promise((resolve,reject)=>{
   const id=crypto.randomUUID(),d=document.createElement('dialog'),f=document.createElement('iframe');d.className='oxygen-roll';d.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent';f.style.cssText='width:100%;height:100%;border:0';f.title='Transport safety dice';f.src='character.html?shipRoll=1';let result=null;
   const receive=e=>{if(e.origin!==location.origin||e.source!==f.contentWindow)return;const b=e.data;if(b?.type==='sa-ship-skill-ready')f.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:id,sides:Array(count).fill(10),bonus:0,exertionAvailable:0,immediateResult:true,cancelable:true,name:'Transport passengers',title:'Transporter safety checks',difficulty:null,difficultyLabel:'Each passenger rolls a D10. '+risk+' or less is fatal. Combined total is ignored.'},location.origin);if(b?.type==='sa-ship-skill-result'&&b.rollId===id){result=b.diceResults;d.close();}if(b?.type==='sa-ship-skill-cancel')d.close();};window.addEventListener('message',receive);d.onclose=()=>{window.removeEventListener('message',receive);d.remove();if(result)resolve(result);else reject(Error('Transport cancelled.'));};d.append(f);document.body.append(d);d.showModal();
  });
 }
 function beam(c,args,ship,transporter,planet){
  const layout=window.SAShipMap.buildLayout(ship.ship),crew=(c.state.characters||[]).filter(r=>ship.crewCharacterIds?.includes(r.id)),aboard=crew.filter(r=>layout.footprint.get(ship.characterLocations?.[r.id]?.square)?.sicId===transporter.id),risk=Math.max(0,Number(transporter.impairmentPoints)||(transporter.impaired||transporter.status==='impaired'?1:0));
  c.modal('Beam down to '+planet.name,'<p>Select up to five passengers physically inside the Transporter room. Shields must be lowered. Transport takes 12 seconds.</p>'+ (c.state.role==='gm'?'<label class="galaxy-field">Operator<select name="operator">'+crew.map(r=>'<option value="'+c.esc(r.id)+'">'+c.esc(r.character.identity.characterName)+'</option>').join('')+'</select></label>':'')+(aboard.length?aboard.map(r=>'<label class="galaxy-field"><span><input type="checkbox" name="passenger" value="'+c.esc(r.id)+'"> '+c.esc(r.character.identity.characterName)+'</span></label>').join(''):'<p>Move passengers into the Transporter room using the Starships tab first.</p>'),async f=>{
   const passengerIds=f.getAll('passenger');if(!passengerIds.length||passengerIds.length>5)throw Error('Select one to five passengers.');const diceResults=risk?await safetyDice(passengerIds.length,risk):[];
   await c.send('beamDown',{...args,operatorId:f.get('operator'),sicId:transporter.id,passengerIds,diceResults});c.status('Transport sequence started.');
  },'Energize');
 }
 function render(c){
  context=c;stamp=performance.now();cancelAnimationFrame(frame);const policy=JSON.stringify(c.data.navigation);
  if(lastRoom!==c.state.code){view=null;lastRoom=c.state.code;lastPolicy='';}
  if(policy!==lastPolicy){lastPolicy=policy;if(c.state.role!=='gm')view=null;}
  const n=c.data.navigation||{mode:'galaxy'};
  if(!view&&c.state.role!=='gm'&&n.mode!=='galaxy')view={...n,shipId:c.ships.find(s=>s.crewCharacterIds?.includes(c.state.ownCharacterId))?.id};
  const tab=document.querySelector('[data-character-tab="roster"]');if(tab?.firstChild?.nodeType===3){const star=c.data.maps.flatMap(m=>m.stars).find(s=>s.id===n.starId),planet=star?.system?.find(o=>o.id===n.planetId);tab.firstChild.textContent=n.mode==='surface'?'Planet '+(planet?.name||'Unknown')+' ':'Campaign ';}
  if(!view||view.mode==='galaxy')return false;
  const map=c.data.maps.find(m=>m.id===view.mapId),star=map?.stars.find(s=>s.id===view.starId);if(!star){view=null;return false;}
  const ship=c.ships.find(s=>s.id===view.shipId),local=ship&&c.data.localPositions?.[ship.id],planet=(star.system||[]).find(p=>p.id===(local?.planetId||view.planetId)&&p.kind==='planet');
  if(local?.phase==='surface'&&view.mode!=='system')view.mode='surface';
  const orbit=['orbit','surface'].includes(view.mode),title=orbit?'Planet '+(planet?.name||'Unknown'):star.name+' System',args={mapId:map.id,starId:star.id,shipId:ship?.id},gm=c.state.role==='gm';
  c.host.classList.toggle('galaxy-is-expanded',c.expanded);c.host.innerHTML=`<header class="galaxy-heading"><div><span>CAMPAIGN NAVIGATION</span><h2>${c.esc(title)}</h2><p>${orbit?(local?.phase==='surface'?'On the planet surface':'In orbit'):'Click a hex to plot movement. No fuel is used inside a star system.'}</p></div><div data-local-management></div></header><div class="galaxy-tools" data-local-tools></div><div class="galaxy-workspace"><div class="galaxy-chart"><div data-local-map></div><div class="galaxy-countdown" data-local-countdown hidden></div></div><aside class="galaxy-details"><div data-local-actions></div></aside></div><p data-galaxy-status role="status"></p>`;
  const manage=c.host.querySelector('[data-local-management]'),tools=c.host.querySelector('[data-local-tools]'),actions=c.host.querySelector('[data-local-actions]'),canvas=c.host.querySelector('[data-local-map]');controls(c,manage);
  if(allowed(c,'galaxy'))tools.append(c.button('Galaxy Map',()=>set({mode:'galaxy'},c)));
  if(orbit&&local?.phase!=='surface'&&allowed(c,'system'))tools.append(c.button('Star System Map',async()=>{if(ship)await c.send('enterSystem',args);set({...view,mode:'system'},c);}));
  if(gm)tools.append(c.button('Edit Solar System',()=>c.systemEditor(map,star)));
  const select=document.createElement('select');select.setAttribute('aria-label','Local travel ship');select.innerHTML='<option value="">Choose a ship</option>'+c.ships.map(s=>`<option value="${c.esc(s.id)}" ${s.id===ship?.id?'selected':''}>${c.esc(s.title)}</option>`).join('');select.onchange=()=>set({...view,shipId:select.value},c);tools.append(select);
  const operation=async(kind,extra={})=>{await c.send(kind,{...args,...extra});move=null;c.draw();};
  if(gm&&ship){actions.append(c.button('Place Ship Here',()=>{if(orbit)return operation('systemPosition',{phase:view.mode,planetId:planet?.id});move={place:true};c.status('Click a hex to place '+ship.title+'.');}));}
  if(!orbit){
   const objs=star.system||[{id:'object-star-'+star.id,kind:'sun',name:star.name,q:0,r:0,intensity:2,quantity:1}],ships=c.ships.filter(s=>c.data.localPositions?.[s.id]?.starId===star.id&&c.data.localPositions[s.id].phase!=='surface'&&!s.ship?.fieldState?.dockedIn),markers=[...ships,...objs.map(o=>({id:o.id,title:o.name,spaceObject:o,ship:{gridCells:[],sicInventory:[],placements:[]}}))],points=[...ships.map(s=>({id:s.id,...c.data.localPositions[s.id]})),...objs];
   window.SASpaceMap.bindEditor(canvas,markers,points,async positions=>{if(!gm)return;try{for(const s of ships){const p=positions.find(p=>p.id===s.id),before=c.data.localPositions[s.id];if(!equal(p,before))await c.send('systemPosition',{mapId:map.id,starId:star.id,shipId:s.id,phase:'system',q:p.q,r:p.r});} }catch(e){c.status(e.message,true);c.draw();}},{system:true,fixedIds:[...objs.map(o=>o.id),...(!gm?ships.map(s=>s.id):[])]});
   canvas.querySelector('.space-map-position-details')?.remove();canvas.querySelector('[data-prep-help]').textContent=gm?'Drag ships to reposition · Click a hex to travel':'Click a destination, then Confirm Move';
   // The shared editor owns pan/zoom and GM drag. A click below only plots a move.
   let down=null;canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};},true);
   canvas.addEventListener('click',async e=>{if(e.target.closest('button,header')||!e.target.closest('svg')||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;try{const svg=canvas.querySelector('svg'),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()),raw={q:Math.sqrt(3)/3*p.x-p.y/3,r:2*p.y/3},hex=window.SAShipDistances.roundHex(raw);
    if(move?.place){await operation('systemPosition',{phase:'system',...hex});return;}
    choice=objs.find(o=>o.kind==='planet'&&equal(o,hex))?.id||'';move={...hex};c.draw();
   }catch(error){c.status(error.message,true);}});
   if(move&&!move.place&&ship){const from=xy(local||{q:0,r:0}),to=xy(move);canvas.querySelector('svg').insertAdjacentHTML('beforeend',`<path d="M${from.x} ${from.y}L${to.x} ${to.y}" fill="none" stroke="#ffe280" stroke-width=".12" stroke-dasharray=".25 .15" pointer-events="none"/>`);actions.append(c.button('Confirm Move',()=>operation('systemMove',move),{disabled:c.state.combatActive?'Use the Combat map.':!local?'Enter this system first.':''}),c.button('Cancel Move',()=>{move=null;c.draw();}));}
   const at=objs.find(o=>o.kind==='planet'&&equal(local,o));if(at&&ship&&allowed(c,'orbit'))actions.append(c.button('Enter Orbit · '+at.name,async()=>{await operation('orbit',{planetId:at.id});set({...view,mode:'orbit',planetId:at.id},c);}));
   const list=document.createElement('section');list.innerHTML='<h3>Planets</h3>';for(const p of objs.filter(o=>o.kind==='planet'))list.append(c.button(p.name,()=>{choice=p.id;move={q:p.q,r:p.r};c.draw();}));actions.append(list);
  }else{
   canvas.classList.add('planet-closeup');canvas.innerHTML=`<img class="planet-closeup-art" src="planet-${['ocean','desert','ice','volcanic'].includes(planet?.variant)?planet.variant:'ocean'}.webp" alt="${c.esc(planet?.name||'Planet')}">${ship&&local?.phase!=='surface'?`<svg viewBox="-5 -3 10 6" class="planet-orbit-ship" aria-label="${c.esc(ship.title)} in orbit"><g data-orbit-ship transform="translate(${local?.orbitOffset?.x??2} ${local?.orbitOffset?.y??-1})">${window.SASpaceMap.vesselMarkup(ship)}</g></svg>`:''}`;
   if(gm&&ship){const marker=canvas.querySelector('[data-orbit-ship]');if(marker){let drag=false;const svg=marker.ownerSVGElement;marker.onpointerdown=e=>{drag=true;marker.setPointerCapture(e.pointerId);};marker.onpointermove=e=>{if(!drag)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());marker.setAttribute('transform',`translate(${p.x} ${p.y})`);};marker.onpointerup=async e=>{drag=false;marker.releasePointerCapture(e.pointerId);const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());try{await operation('systemPosition',{phase:'orbit',planetId:planet.id,orbitOffset:{x:p.x,y:p.y}});}catch(error){c.status(error.message,true);}};}}
   if(ship){const landed=local?.phase==='surface'||!local&&view.mode==='surface',canLand=window.SAShipMap.capabilities(ship).some(x=>['hover','aerofoil'].includes(x.key)&&x.available);
    if(canLand&&allowed(c,landed?'orbit':'surface'))actions.append(c.button(landed?'Leave Planet':'Descend to Surface',async()=>{await operation(landed?'leavePlanet':'descend');if(landed)set({...view,mode:'orbit'},c);},{disabled:c.state.combatActive?'Use the combat Bridge console.':c.data.localJourneys?.[ship.id]?'Maneuver in progress.':''}));
    const transporter=ship.ship.sicInventory?.find(i=>window.SAShipMap.definition(i.type).transporter&&window.SAShipMap.operational(i));if(transporter&&!landed)actions.append(c.button('Beam Down to Planet’s Surface',()=>beam(c,args,ship,transporter,planet)));
   }
   if(!ship)actions.insertAdjacentHTML('beforeend','<p>The party is on this planet. Acquire and crew a ship capable of ascent to leave its surface.</p>');
  }
  if(ship){for(const carried of c.ships.filter(s=>s.ship?.fieldState?.dockedIn?.shipId===ship.id))actions.append(c.button('Undock '+carried.title,()=>c.confirmation('Undock '+carried.title+'?','Confirm that the docking bay is sealed and decompressed. The ship will appear in an adjacent free hex.','Undock',()=>operation('undock',{targetId:carried.id,decompressed:true}))));}
  refresh();return true;
 }
 function refresh(){cancelAnimationFrame(frame);const c=context;if(!view||view.mode==='galaxy'||!c?.host.querySelector('[data-local-map]'))return;const data=c.state.starmaps,elapsed=c.state.combatActive?0:Math.min(2,(performance.now()-stamp)/1000);let active=false,labels=[];
  for(const [id,j]of Object.entries(data.localJourneys||{})){const p=data.localPositions[id];if(p?.starId!==view.starId)continue;active=true;const remaining=Math.max(0,j.remaining-elapsed),f=1-remaining/j.total,point=xy({q:j.from.q+(j.to.q-j.from.q)*f,r:j.from.r+(j.to.r-j.from.r)*f}),marker=c.host.querySelector('[data-space-ship="'+CSS.escape(id)+'"]');if(marker)marker.setAttribute('transform',`translate(${point.x} ${point.y})`);labels.push((c.ships.find(s=>s.id===id)?.title||'Ship')+' · '+(j.kind==='descend'?'Landing':j.kind==='transport'?'Transport':'Arrival')+' in '+Math.ceil(remaining)+'s');}
  const label=c.host.querySelector('[data-local-countdown]');if(label){label.hidden=!labels.length;label.textContent=labels.join(' / ');}if(active&&!document.hidden&&c.host.getClientRects().length&&window.SAExploreSession?.active?.()!==false)frame=requestAnimationFrame(refresh);
 }
 window.SACampaignNavigationUI={render,refresh(packet=false){if(packet)stamp=performance.now();refresh();},open,controls,files,context:()=>context};
})();
