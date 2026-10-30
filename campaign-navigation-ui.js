(function(){
 'use strict';
 let view=null,context=null,choice='',move=null,frame=0,stamp=0,lastPolicy='',lastRoom='',lastPlayerLocation='',playerDefaultPending=true;
 const actionModes=new Map();let lastPlanetClick=null;
 const xy=p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
 const equal=(a,b)=>a&&b&&Math.abs(a.q-b.q)+Math.abs(a.r-b.r)<1e-5;
 const allowed=(c,k)=>c.state.role==='gm'||c.data.navigation?.allowed?.[k]!==false;
 function set(next,c=context){if(!allowed(c,next.mode))return;if(['galaxy','system'].includes(next.mode))c.host.classList.remove('planet-enlarged');view=next;move=null;choice='';c.draw();}
 function controls(c,area){
  if(c.state.role!=='gm')return;
  area.append(c.button('PC Map Visibility',()=>{
   const n=c.data.navigation||{mode:'galaxy',allowed:{}},stars=c.data.maps.flatMap(m=>m.stars.map(s=>({m,s}))),d=c.modal('What players can see',`<label class="galaxy-field">Starting view<select name="mode">${['galaxy','system','orbit','surface'].map(k=>`<option ${n.mode===k?'selected':''}>${k}</option>`).join('')}</select></label><label class="galaxy-field">Star system<select name="star">${stars.map(({m,s})=>`<option value="${c.esc(s.id)}" ${s.id===n.starId?'selected':''}>${c.esc(m.name+' / '+s.name)}</option>`).join('')}</select></label><label class="galaxy-field">Planet<select name="planet"></select></label><p>Allow players to open these views as their travel permits:</p><div class="galaxy-form-columns">${['surface','orbit','system','galaxy'].map(k=>`<label><input type="checkbox" name="allow-${k}" ${n.allowed?.[k]!==false?'checked':''}> ${k}</label>`).join('')}</div>`,async f=>{const entry=stars.find(x=>x.s.id===f.get('star'));await c.send('navigation',{mode:f.get('mode'),mapId:entry?.m.id,starId:entry?.s.id,planetId:f.get('planet'),allowed:Object.fromEntries(['surface','orbit','system','galaxy'].map(k=>[k,f.has('allow-'+k)]))});});
   const select=d.querySelector('[name=star]'),planets=d.querySelector('[name=planet]'),refresh=()=>{planets.innerHTML=(stars.find(x=>x.s.id===select.value)?.s.system||[]).filter(o=>o.kind==='planet').map(p=>`<option value="${c.esc(p.id)}" ${p.id===n.planetId?'selected':''}>${c.esc(p.name)}</option>`).join('');};select.onchange=refresh;refresh();
  }));
 }
 function files(c,area){if(c.state.role!=='gm')return;
  area.append(c.button('Save Galaxy Map',()=>window.SAContentUI.save('galaxy',{mapId:c.map?.id})),c.button('Load Galaxy Map',()=>window.SAContentUI.chooseLoad('galaxy',{mapId:c.map?.id})),c.button('Transfer Party to Galaxy',()=>window.SAContentUI.transfer()));
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
 function playerView(c){
  const n=c.data.navigation||{mode:'galaxy'},party=c.data.party;
  const ship=c.ships.find(s=>s.id===party?.shipId)||c.ships.find(s=>s.id===n.shipId)||c.ships.find(s=>s.crewCharacterIds?.includes(c.state.ownCharacterId))||c.ships.find(s=>s.controlType==='pc');
  return party?{...n,...party,mode:'surface',regionId:party.regionId||'',shipId:ship?.id}:{...n,shipId:ship?.id};
 }
 // Map browsing changes only the local view. Travel remains an explicit action.
 function navigationEntries(c,current,selectedRegion){
  const player={...playerView(c)},physical=c.data.localPositions?.[player.shipId];
  if(!c.data.party&&physical)Object.assign(player,{mapId:physical.mapId,starId:physical.starId,mode:physical.phase,planetId:physical.phase==='system'?'':physical.planetId,regionId:physical.phase==='surface'?physical.regionId||'':''});
  const location=view?.mode!=='galaxy'?{...player,...view}:player;
  const map=current==='galaxy'?c.map:c.data.maps.find(m=>m.id===location.mapId)||c.map;
  const star=map?.stars.find(s=>s.id===location.starId),local=c.data.localPositions?.[location.shipId];
  const planet=star?.system?.find(p=>p.kind==='planet'&&p.id===(location.planetId||local?.planetId));
  const samePlanet=map?.id===player.mapId&&star?.id===player.starId&&planet?.id===player.planetId;
  const regionId=selectedRegion??(location.regionId||(samePlanet?player.regionId:'')),region=star?.surfaces?.[planet?.id]?.regions?.[regionId];
  const planetMode=!['surface','region'].includes(current)&&(current==='orbit'||!c.data.party&&local?.phase==='orbit')?'orbit':'surface';
  const base={mapId:map?.id,starId:star?.id,shipId:location.shipId};
  const entries=[
   {level:'galaxy',title:'Sector',name:map?.name,target:{mode:'galaxy',mapId:map?.id}},
   {level:'system',title:'Star System',name:star?.name,target:{...base,mode:'system'}},
   {level:'surface',title:planetMode==='orbit'?'Planet Orbit':'Planet Surface',name:planet?.name,target:{...base,mode:planetMode,planetId:planet?.id,regionId:''}},
   {level:'region',title:'Region',name:region?.name,target:{...base,mode:'surface',planetId:planet?.id,regionId},regionAllowed:c.state.role==='gm'||samePlanet&&regionId===player.regionId}
  ];
  const playerLevel=player.mode==='surface'&&player.regionId?'region':player.mode==='orbit'?'surface':player.mode;
  let marker=-1;
  if(map?.id===player.mapId){marker=0;if(star?.id===player.starId&&playerLevel!=='galaxy'){marker=1;if(samePlanet&&['surface','region'].includes(playerLevel)){marker=2;if(region&&regionId===player.regionId&&playerLevel==='region')marker=3;}}}
  return entries.map((entry,i)=>({...entry,active:entry.level===(current==='orbit'?'surface':current),party:i===marker,disabled:!entry.name||!allowed(c,entry.target.mode)||entry.regionAllowed===false}));
 }
 function myLocation(c){
  const location=window.SACampaignLocation.locate(c.state);if(!location){c.status('Your current location is not available on these maps.');return;}
  set(location,c);if(location.mode==='galaxy')c.focusGalaxy?.(location);
  else requestAnimationFrame(()=>{if(location.mode==='surface')window.SAPlanetSurfaces.focusLocation?.(location);else if(location.mode==='system'){const svg=c.host.querySelector('[data-space-canvas]');if(svg){window.SASpaceMap.fitContacts(svg,[{id:location.shipId,ship:{}}],[{...location,id:location.shipId}]);svg.dataset.userViewBox=svg.getAttribute('viewBox');}}});
 }
 function decorateNavigation(c,tools,current,selectedRegion){
  for(const b of tools.querySelectorAll('button'))if(b.dataset.navLevel||['Galaxy Map','Star System','Star System Map','Orbit','Planet Surface','Region'].includes(b.textContent))b.remove();
  let group=tools.querySelector('.campaign-location-nav');
  if(!group){group=document.createElement('nav');group.className='campaign-location-nav';group.setAttribute('aria-label','Location hierarchy');tools.prepend(group);}
  group.replaceChildren();
  for(const entry of navigationEntries(c,current,selectedRegion)){
   const button=c.button('',()=>set(entry.target,c));button.dataset.navLevel=entry.level;button.disabled=entry.disabled;
   const kind=document.createElement('span');kind.className='campaign-location-kind';kind.textContent=({galaxy:'Sector',system:'Star System',surface:'Planet',region:'Region'})[entry.level]+':';
   const label=document.createElement('span');label.className='campaign-location-name';label.textContent=entry.name||'';button.append(kind,label);
   button.title=entry.name?entry.name+' · '+entry.title:'No current '+entry.title.toLowerCase();
   button.setAttribute('aria-label',button.title+(entry.party?' · Party location':'')+(entry.disabled&&entry.name?' · Unavailable':''));
   if(entry.active)button.setAttribute('aria-current','page');
   if(entry.party){const pin=document.createElementNS('http://www.w3.org/2000/svg','svg');pin.classList.add('campaign-location-pin');pin.setAttribute('viewBox','-15 -22 30 42');pin.setAttribute('aria-hidden','true');pin.innerHTML=window.SAPlanetTerrain.partyMarker(0,0);button.append(pin);}
   group.append(button);
  }
  if(c.state.role!=='gm'&&!c.host.querySelector('[data-my-location]')){const button=c.button('My Location',()=>myLocation(c));button.dataset.myLocation='';tools.append(button);}
  shapeNavigation(tools);
 }
 // Reuse the Galaxy Map shell: navigation/camera above, contextual actions in one row.
 function compactLayout(c,{tools,management,camera,actions}){
  const host=c.host,heading=host.querySelector('.galaxy-heading'),workspace=host.querySelector('.galaxy-workspace');
  host.classList.add('galaxy-overview','galaxy-local-overview');
  const bar=document.createElement('div');bar.className='galaxy-travel-bar';
  if(c.state.role==='gm'&&view)window.SAContentUI?.mount(bar,{...view,scope:['surface','orbit'].includes(view.mode)?(view.regionId?'region':'planet'):'star'});
  for(const item of [...tools.children])if(!item.matches('.campaign-location-nav'))bar.append(item);
  heading.insertBefore(tools,management);if(management)tools.append(management);
  if(camera){camera.classList.add('galaxy-camera-tools');for(const item of [...camera.querySelectorAll('.planet-mode-button')])bar.append(item);tools.append(camera);}
  if(actions)bar.append(actions);
  const palette=host.querySelector('.planet-edit-tools');if(palette)bar.append(palette);
  host.insertBefore(bar,workspace);
 }
 function shapeNavigation(tools){
  // Four equal segments share one slope, ending with enough height for wrapped names.
  const buttons=[...tools.querySelectorAll('.campaign-location-nav [data-nav-level]')];
  buttons.forEach((b,i)=>{b.style.setProperty('--wedge-left',i*10+'px');b.style.setProperty('--wedge-right',(i+1)*10+'px');b.style.setProperty('--player-top',(i+.5)*10-20+'px');});
 }
 function render(c){
  context=c;window.SAPlanetSurfaces?.prompt(c);stamp=performance.now();cancelAnimationFrame(frame);const policy=JSON.stringify(c.data.navigation);
  if(lastRoom!==c.state.code){view=null;lastRoom=c.state.code;lastPolicy='';lastPlayerLocation='';playerDefaultPending=true;}
  if(policy!==lastPolicy){lastPolicy=policy;if(c.state.role!=='gm')view=null;}
  const n=c.data.navigation||{mode:'galaxy'};
  c.host.classList.remove('planet-surface-host','planet-orbit-host','galaxy-local-overview');
  if(c.state.role==='gm'&&playerDefaultPending){view=playerView(c);playerDefaultPending=false;}
  const playerLocation=JSON.stringify([playerView(c),c.data.viewEvent?.id]);
  if(c.state.role!=='gm'&&(!view||lastPlayerLocation!==playerLocation))view=playerView(c);
  lastPlayerLocation=playerLocation;
  const tab=document.querySelector('[data-character-tab="roster"]');if(tab?.firstChild?.nodeType===3){const star=c.data.maps.flatMap(m=>m.stars).find(s=>s.id===n.starId),planet=star?.system?.find(o=>o.id===n.planetId);tab.firstChild.textContent=n.mode==='surface'?'Campaign/Planet '+(planet?.name||'Unknown')+' ':'Campaign ';}
  if(!view||view.mode==='galaxy')return false;
  const map=c.data.maps.find(m=>m.id===view.mapId),star=map?.stars.find(s=>s.id===view.starId);if(!star){view=null;return false;}
  if(!view.inspectOnly&&c.data.party&&c.data.localJourneys?.[c.data.party.shipId]?.kind==='ascend'&&c.data.localJourneys[c.data.party.shipId].remaining<=16&&(c.state.role!=='gm'||view.planetId===c.data.party.planetId))view={...view,...c.data.party,mode:'orbit',shipId:c.data.party.shipId};
  const ship=c.ships.find(s=>s.id===view.shipId),local=ship&&c.data.localPositions?.[ship.id],planet=(star.system||[]).find(p=>p.id===(view.planetId||local?.planetId)&&p.kind==='planet');
  if(!view.inspectOnly&&local?.phase==='surface'&&c.data.localJourneys?.[ship?.id]?.kind!=='ascend'&&view.mode==='orbit'&&local.planetId===planet?.id)view.mode='surface';
  if(view.mode==='surface'&&planet)return window.SAPlanetSurfaces.render(c,{map,star,planet,ship,view,set:next=>set(next,c),beamAboard:async(ship,transporter,party)=>{const risk=Math.max(0,Number(transporter.impairmentPoints)||(transporter.impaired?1:0));const diceResults=risk?await safetyDice(party.passengers.length,risk):[];await c.send('beamAboard',{mapId:map.id,starId:star.id,planetId:planet.id,shipId:ship.id,sicId:transporter.id,diceResults});}});
  const orbit=['orbit','surface'].includes(view.mode),title=orbit?'Planet '+(planet?.name||'Unknown'):star.name+' System',args={mapId:map.id,starId:star.id,shipId:ship?.id},gm=c.state.role==='gm';
  const modeKey=[c.state.code,star.id,orbit?'orbit':'system'].join('/'),actionMode=actionModes.get(modeKey)||'select';
  const cameraKey=[map.id,star.id,view.mode,view.planetId||''].join('/'),oldCamera=c.host.dataset.navigationCamera===cameraKey?c.host.querySelector('[data-space-canvas]')?.getAttribute('viewBox'):null;c.host.dataset.navigationCamera=cameraKey;
  c.host.classList.toggle('galaxy-is-expanded',c.expanded);c.host.classList.toggle('planet-orbit-host',orbit);c.host.innerHTML=`<header class="galaxy-heading"><div><span>CAMPAIGN NAVIGATION</span><h2>${c.esc(title)}</h2><p>${orbit?(c.data.localJourneys?.[ship?.id]?.kind==='ascend'?'Exiting atmosphere':local?.phase==='surface'?'On the planet surface':'In orbit'):'Click a hex to plot movement. No fuel is used inside a star system.'}</p></div><div data-local-management></div></header><div class="galaxy-tools" data-local-tools></div><div class="galaxy-workspace"><div class="galaxy-chart"><div data-local-map></div><div class="galaxy-countdown" data-local-countdown hidden></div></div><aside class="galaxy-details"><div data-local-actions></div></aside></div><p data-galaxy-status role="status"></p>`;
  const manage=c.host.querySelector('[data-local-management]'),tools=c.host.querySelector('[data-local-tools]'),actions=c.host.querySelector('[data-local-actions]'),canvas=c.host.querySelector('[data-local-map]');controls(c,manage);if(orbit)manage.append(c.button(c.expanded?'Return to Campaign':'Enlarge Map',c.toggleExpanded,{className:'campaign-map-size'+(c.expanded?' is-expanded':'')}));
  if(allowed(c,'galaxy'))tools.append(c.button('Galaxy Map',()=>set({mode:'galaxy'},c)));
  if(!view.inspectOnly&&orbit&&local?.phase!=='surface'&&allowed(c,'system'))actions.append(c.button('Leave Orbit',async()=>{if(ship)await c.send('enterSystem',args);set({mode:'system',...args},c);}));
  if(gm)tools.append(c.button('System Details',()=>c.systemEditor(map,star)));
  if(gm&&orbit)tools.append(c.button('Back to System',()=>set({mode:'system',mapId:map.id,starId:star.id},c)));
  tools.append(c.button(orbit?'Orbit':'Star System',()=>{}));decorateNavigation(c,tools,orbit?'orbit':'system');
  const select=document.createElement('select');select.setAttribute('aria-label','Local travel ship');select.innerHTML='<option value="">Choose a ship</option>'+c.ships.map(s=>`<option value="${c.esc(s.id)}" ${s.id===ship?.id?'selected':''}>${c.esc(s.title)}</option>`).join('');select.onchange=()=>set({...view,shipId:select.value},c);if(!view.inspectOnly)tools.append(select);

  const operation=async(kind,extra={})=>{await c.send(kind,{...args,...extra});move=null;c.draw();};
  if(gm&&orbit&&planet)actions.append(c.button('Edit Planet',()=>window.SAPlanetSurfaces.editPlanet(c,map,star,planet)));
  if(gm&&orbit&&!view.inspectOnly&&ship)actions.append(c.button('Move Ship into Orbit',()=>operation('systemPosition',{phase:'orbit',planetId:planet?.id})));
  if(!orbit){
   const objs=star.system||[{id:'object-star-'+star.id,kind:'sun',name:star.name,q:0,r:0,intensity:2,quantity:1}],ships=c.ships.filter(s=>c.data.localPositions?.[s.id]?.starId===star.id&&c.data.localPositions[s.id].phase!=='surface'&&!s.ship?.fieldState?.dockedIn),markers=[...ships,...objs.map(o=>({id:o.id,title:o.name,spaceObject:o,ship:{gridCells:[],sicInventory:[],placements:[]}}))],points=[...ships.map(s=>({id:s.id,...(c.data.localPositions[s.id].phase==='orbit'?objs.find(p=>p.id===c.data.localPositions[s.id].planetId)||c.data.localPositions[s.id]:c.data.localPositions[s.id])})),...objs];
   window.SASpaceMap.bindEditor(canvas,markers,points,async positions=>{if(!gm)return;try{for(const s of ships){const p=positions.find(p=>p.id===s.id),before=points.find(point=>point.id===s.id);if(actionMode==='ships'&&!equal(p,before))await c.send('systemPosition',{mapId:map.id,starId:star.id,shipId:s.id,phase:'system',q:p.q,r:p.r});}if(actionMode==='planets')for(const planet of objs.filter(o=>o.kind==='planet')){const p=positions.find(o=>o.id===planet.id);if(!equal(p,planet))await c.send('planetPosition',{mapId:map.id,starId:star.id,planetId:planet.id,q:p.q,r:p.r});} }catch(e){c.status(e.message,true);c.draw();}},{system:true,modeToolbar:false,overlayMarkup:(()=>{const party=c.data.party,p=party?.mapId===map.id&&party.starId===star.id&&objs.find(o=>o.id===party.planetId);if(!p)return '';const at=xy(p);return window.SAPlanetTerrain.partyMarker(at.x,at.y-.7,.035);})(),fixedIds:[...objs.map(o=>o.id),...ships.map(s=>s.id)]});
   const enlarge=canvas.querySelector('[data-prep-enlarge]');enlarge.textContent=c.expanded?'Return to Campaign':'Enlarge Map';enlarge.onclick=c.toggleExpanded;enlarge.classList.add('campaign-map-size');enlarge.classList.toggle('is-expanded',c.expanded);enlarge.style.marginLeft='auto';enlarge.parentElement.append(enlarge);
   canvas.querySelector('.space-map-position-details')?.remove();
   const help=canvas.querySelector('[data-prep-help]');help.textContent=gm?'Click a planet or ship to select. Drag to pan. Scroll to zoom.':'Click a destination, then Confirm Move';
   const svg=canvas.querySelector('[data-space-canvas]');svg.dataset.spaceEditable='false';
   if(oldCamera)requestAnimationFrame(()=>{if(svg.isConnected)svg.setAttribute('viewBox',oldCamera);});
   const inspect=p=>set({mode:'orbit',mapId:map.id,starId:star.id,planetId:p.id,inspectOnly:true},c);
   const placeObject=(name,commit)=>window.SASpaceMap.beginObjectPlacement(canvas,{name,onPlace:point=>{down=null;Promise.resolve(commit(point)).catch(error=>c.status(error.message,true));}});
   if(gm)tools.append(c.button('Add Planet',()=>c.modal('Add Planet','<label class="galaxy-field">Name<input name="name" maxlength="80" required value="New Planet"></label><label class="galaxy-field">Appearance<select name="variant">'+['ocean','desert','ice','volcanic','moon'].map(v=>'<option>'+v+'</option>').join('')+'</select></label>',f=>{
    const name=String(f.get('name')).trim(),variant=String(f.get('variant'));
    placeObject(name,async point=>{const current=c.data.maps.find(m=>m.id===map.id)?.stars.find(s=>s.id===star.id);await c.send('system',{mapId:map.id,starId:star.id,objects:[...(current?.system||objs),{id:'object-'+crypto.randomUUID(),kind:'planet',name,variant,size:variant==='moon'?'moon':'large',quantity:1,q:point.q,r:point.r}]});c.draw();});
   },'Place Planet')));
   let down=null;canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};},true);
   canvas.addEventListener('click',async e=>{
    if(e.target.closest('button,header')||!e.target.closest('svg')||!down||canvas._objectPlacement||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
    try{const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()),hex=window.SAShipDistances.roundHex({q:Math.sqrt(3)/3*point.x-point.y/3,r:2*point.y/3});
     const id=e.target.closest('[data-space-ship]')?.dataset.spaceShip,p=objs.find(o=>o.kind==='planet'&&(o.id===id||equal(o,hex)));
     if(gm&&actionMode==='ships'&&ship){actionModes.delete(modeKey);await operation('systemPosition',{phase:'system',...hex});c.draw();return;}
     if(gm&&actionMode!=='travel'){
      const now=performance.now(),twice=lastPlanetClick&&now-lastPlanetClick.time<450&&Math.hypot(e.clientX-lastPlanetClick.x,e.clientY-lastPlanetClick.y)<5&&lastPlanetClick.star===star.id;
      if(twice){const target=objs.find(o=>o.id===lastPlanetClick.id);lastPlanetClick=null;if(target){inspect(target);return;}}
      lastPlanetClick=p?{id:p.id,star:star.id,time:now,x:e.clientX,y:e.clientY}:null;
      choice=p?.id||'';const pickedShip=ships.find(s=>s.id===id);view={...view,shipId:pickedShip?.id||''};
      if(p&&e.detail===2){inspect(p);return;}c.draw();return;
     }
     move={...hex};c.draw();
    }catch(error){c.status(error.message,true);}
   });
   if(gm&&ship){const selected=document.createElement('section');selected.className='planet-edit-selection';selected.innerHTML='<h3>'+c.esc(ship.title)+'</h3>';
    selected.append(c.button('Plot Travel',()=>{actionModes.set(modeKey,'travel');move=null;c.draw();}),c.button('Reposition Ship',()=>{actionModes.set(modeKey,'ships');move=null;c.draw();}));
    if(['ships','travel'].includes(actionMode)){help.textContent=actionMode==='ships'?'Click a hex to reposition '+ship.title+'.':'Click a destination for '+ship.title+'.';selected.append(c.button('Cancel',()=>{actionModes.delete(modeKey);move=null;c.draw();}));}
    actions.append(selected);
   }
   if(move&&!move.place&&ship){const from=xy(local||{q:0,r:0}),to=xy(move);canvas.querySelector('svg').insertAdjacentHTML('beforeend',`<path d="M${from.x} ${from.y}L${to.x} ${to.y}" fill="none" stroke="#ffe280" stroke-width=".12" stroke-dasharray=".25 .15" pointer-events="none"/>`);actions.append(c.button('Confirm Move',()=>operation('systemMove',move),{disabled:c.state.combatActive?'Use the Combat map.':!gm&&c.data.party?'Leave the planet with the party first.':!local?'Enter this system first.':''}),c.button('Cancel Move',()=>{move=null;c.draw();}));}
   const at=objs.find(o=>o.kind==='planet'&&equal(local,o));if(at&&ship&&(gm||!c.data.party)&&allowed(c,'orbit'))actions.append(c.button('Enter Orbit · '+at.name,async()=>{await operation('orbit',{planetId:at.id});set({...view,mode:'orbit',planetId:at.id},c);}));
   const selectedPlanet=objs.find(p=>p.id===choice&&p.kind==='planet');if(gm&&selectedPlanet){const selected=document.createElement('section');selected.className='planet-edit-selection';selected.innerHTML='<h3>'+c.esc(selectedPlanet.name)+'</h3>';selected.append(c.button('Edit Details',()=>{const d=window.SAPlanetSurfaces.editPlanet(c,map,star,selectedPlanet);}),c.button('Zoom In',()=>inspect(selectedPlanet),{className:'galaxy-primary'}),c.button('Reposition Planet',()=>placeObject(selectedPlanet.name,async point=>{await c.send('planetPosition',{mapId:map.id,starId:star.id,planetId:selectedPlanet.id,q:point.q,r:point.r});c.draw();})));actions.prepend(selected);}
   const list=document.createElement('section');list.innerHTML='<h3>Planets</h3>';for(const p of objs.filter(o=>o.kind==='planet')){const known=gm||c.data.visitedPlanets?.includes([map.id,star.id,p.id].join('/')),world=star.surfaces?.[p.id]||{};const card=document.createElement('article');card.className='planet-directory-card';if(known)card.innerHTML='<img src="'+window.SAPlanetSurfaces.icon(p)+'" alt="'+c.esc(p.name)+'"><div><h3>'+c.esc(p.name)+'</h3><p>'+c.esc(world.description||'No public planet description has been added.')+'</p></div>';card.append(c.button(known?'Select '+p.name:p.name,()=>{choice=p.id;if(!gm)move={q:p.q,r:p.r};c.draw();}));if(known)card.append(c.button('Preview Surface',()=>window.SAPlanetSurfaces.preview(c,world,p)));if(gm)card.append(c.button('Edit Planet · '+p.name,()=>window.SAPlanetSurfaces.editPlanet(c,map,star,p)),c.button('Zoom In · '+p.name,()=>inspect(p)),c.button('View Surface · '+p.name,()=>set({mode:'surface',mapId:map.id,starId:star.id,planetId:p.id,regionId:'',inspectOnly:true},c)));list.append(card);}actions.append(c.button('Browse Planets',()=>{const d=c.modal('Planets in '+star.name,'<div data-planet-directory></div>',async()=>{},'Done');d.classList.add('planet-directory-dialog');d.querySelector('[data-planet-directory]').append(list);list.addEventListener('click',event=>{if(event.target.closest('button'))d.close();},{capture:true});}));
  }else{
   canvas.classList.add('planet-closeup');canvas.innerHTML=`<svg class="planet-orbit-grid" viewBox="-10 -6 20 12"><defs><pattern id="orbit-grid" width="1.732" height="3" patternUnits="userSpaceOnUse"><path d="M0-1L.866-.5V.5L0 1-.866 .5V-.5Z M.866 .5L1.732 1V2L.866 2.5 0 2V1Z" fill="none" stroke="#8ca3b0" stroke-opacity=".2" stroke-width=".015"/></pattern></defs><rect x="-10" y="-6" width="20" height="12" fill="url(#orbit-grid)"/></svg><img class="planet-closeup-art" src="${window.SAPlanetSurfaces.icon(planet)}" alt="${c.esc(planet?.name||'Planet')}">${ship&&(local?.phase!=='surface'||c.data.localJourneys?.[ship.id]?.kind==='ascend')?`<svg viewBox="-10 -6 20 12" class="planet-orbit-ship" aria-label="${c.esc(ship.title)} in orbit"><g data-orbit-ship transform="translate(${local?.orbitOffset?.x??4} ${local?.orbitOffset?.y??-2})">${window.SATokenArt.hoverMarkup(ship,1.7)}<image href="${c.esc(window.SATokenArt.shipImage(ship))}" x="-.85" y="-.85" width="1.7" height="1.7"/></g></svg>`:''}`;
   if(gm&&actionMode==='ships'&&ship){const marker=canvas.querySelector('[data-orbit-ship]');if(marker){let drag=false;const svg=marker.ownerSVGElement;marker.onpointerdown=e=>{drag=true;marker.setPointerCapture(e.pointerId);};marker.onpointermove=e=>{if(!drag)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());marker.setAttribute('transform',`translate(${p.x} ${p.y})`);};marker.onpointerup=async e=>{drag=false;marker.releasePointerCapture(e.pointerId);const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());try{await operation('systemPosition',{phase:'orbit',planetId:planet.id,orbitOffset:{x:p.x,y:p.y}});}catch(error){c.status(error.message,true);}};}}
   if(gm&&planet)actions.append(c.button('View Planet Surface',()=>set({...view,mode:'surface',planetId:planet.id,regionId:''},c)));
   if(ship){const landed=local?.phase==='surface'||!local&&view.mode==='surface',canLand=window.SAShipMap.capabilities(ship).some(x=>['hover','aerofoil'].includes(x.key)&&x.available);
    const bridgeReady=gm||ship.crewCharacterIds?.some(id=>{const loc=ship.characterLocations?.[id],cell=loc&&window.SAShipMap.buildLayout(ship.ship).footprint.get(loc.square);return loc?.stationed&&cell&&window.SAShipMap.definition(cell.type).bridge&&window.SAShipMap.operational(cell.item)&&(c.state.characters.find(r=>r.id===id)?.character.health?.current??1)>0;});
    if(canLand&&c.data.launchableShipIds?.includes(ship.id)&&allowed(c,landed?'orbit':'surface'))actions.append(c.button(landed?'Leave Atmosphere':'Descend',async()=>{await operation(landed?'leavePlanet':'descend');if(landed)set({...view,mode:'orbit'},c);},{disabled:c.state.combatActive?'Use the combat Bridge console.':!bridgeReady?'Station a character on the Bridge first.':c.data.localJourneys?.[ship.id]?'Maneuver in progress.':''}));
    if(canLand&&!bridgeReady)actions.insertAdjacentHTML('beforeend','<p>Station a character on the Bridge to begin descent.</p>');
    const transporter=ship.ship.sicInventory?.find(i=>window.SAShipMap.definition(i.type).transporter&&window.SAShipMap.operational(i));if(transporter&&!landed)actions.append(c.button('Beam Down to Planet’s Surface',()=>beam(c,args,ship,transporter,planet)));
   }
   if(!ship&&!gm)actions.insertAdjacentHTML('beforeend','<p>The party is on this planet. Acquire and crew a ship capable of ascent to leave its surface.</p>');
  }
  if(ship){for(const carried of c.ships.filter(s=>s.ship?.fieldState?.dockedIn?.shipId===ship.id))actions.append(c.button('Undock '+carried.title,()=>c.confirmation('Undock '+carried.title+'?','Confirm that the docking bay is sealed and decompressed. The ship will appear in an adjacent free hex.','Undock',()=>operation('undock',{targetId:carried.id,decompressed:true}))));}
  const camera=canvas.querySelector('.space-map-toolbar')||canvas.querySelector('[data-prep-enlarge]')?.parentElement;const aside=actions.parentElement;compactLayout(c,{tools,management:manage,camera,actions});aside.remove();
  refresh();return true;
 }
 function refresh(){cancelAnimationFrame(frame);const c=context;if(view?.mode==='surface'){window.SAPlanetSurfaces?.refresh(c.state);return;}if(!view||view.mode==='galaxy'||!c?.host.querySelector('[data-local-map]'))return;const data=c.state.starmaps,elapsed=c.state.combatActive?0:Math.min(2,(performance.now()-stamp)/1000);let active=false,labels=[];
  for(const [id,j]of Object.entries(data.localJourneys||{})){const p=data.localPositions[id];if(p?.starId!==view.starId)continue;active=true;const remaining=Math.max(0,j.remaining-elapsed),f=1-remaining/j.total,point=xy({q:j.from.q+(j.to.q-j.from.q)*f,r:j.from.r+(j.to.r-j.from.r)*f}),marker=c.host.querySelector('[data-space-ship="'+CSS.escape(id)+'"]');if(marker){marker.setAttribute('transform',`translate(${point.x} ${point.y})`);if(j.kind==='move'){const body=marker.querySelector('[data-vessel-body]'),a=xy(j.from),b=xy(j.to);body?.setAttribute('transform',`rotate(${Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+90})`);}}if(['descend','ascend'].includes(j.kind)&&id===view.shipId){const orbit=c.host.querySelector('[data-orbit-ship]');if(orbit){const progress=j.kind==='ascend'?window.SAPlanetMotion.ease((16-remaining)/16):1-window.SAPlanetMotion.ease(f),orbitTime=j.kind==='descend'?(j.clockAt/1000-(j.total-j.remaining)):Date.now()/1000,track=window.SAPlanetMotion.orbit(orbitTime),radius=j.kind==='ascend'&&j.flightStyle==='aerofoil'?1:progress;orbit.setAttribute('transform',`translate(${track.x*radius} ${track.y*radius}) rotate(${track.heading}) scale(${Math.max(.02,progress)})`);const vessel=c.ships.find(s=>s.id===id),style=j.flightStyle||(window.SAShipMap.capabilities(vessel).some(x=>x.key==='aerofoil'&&x.available)?'aerofoil':'hover');window.SAPlanetSurfaces.updateHover(orbit,style==='hover',j.kind==='ascend'?2.25*(1-progress):.25+2*f,j.total-remaining,matchMedia('(prefers-reduced-motion: reduce)').matches);}}labels.push((c.ships.find(s=>s.id===id)?.title||'Ship')+' · '+(j.kind==='ascend'?'Exiting atmosphere':j.kind==='descend'?'Landing':j.kind==='transport'?'Transport':'Arrival')+' in '+Math.ceil(remaining)+'s');}
  const orbit=c.host.querySelector('[data-orbit-ship]');if(orbit&&!data.localJourneys?.[view.shipId]&&actionModes.get([c.state.code,view.starId,'orbit'].join('/'))!=='ships'){const p=window.SAPlanetMotion.orbit(matchMedia('(prefers-reduced-motion: reduce)').matches?0:Date.now()/1000);orbit.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${p.heading})`);window.SAPlanetSurfaces.updateHover(orbit,false,0,0);active=true;}
  const label=c.host.querySelector('[data-local-countdown]');if(label){label.hidden=!labels.length;label.textContent=labels.join(' / ');}if(active&&!document.hidden&&c.host.getClientRects().length&&window.SAExploreSession?.active?.()!==false)frame=requestAnimationFrame(refresh);
 }
 window.SACampaignNavigationUI={render,navigationEntries,decorateNavigation,compactLayout,shapeNavigation,showPlayerView(){playerDefaultPending=true;if(context?.state.role==='gm')context.draw();},refresh(packet=false,next){if(next&&context){context.state=next;context.data=next.starmaps;}if(packet)stamp=performance.now();refresh();},open,openPlanet(c,map,star,planet){set({mode:'surface',mapId:map.id,starId:star.id,planetId:planet.id,regionId:''},c);},controls,files,context:()=>context};
})();
