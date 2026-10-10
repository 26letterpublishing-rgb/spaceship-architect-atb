(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const xy = p => ({ x:Math.sqrt(3) * (p.q + p.r / 2), y:1.5 * p.r });
  const distance = (a,b) => (Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
  const cameras = new Map();
  let state, token, host, selectedMap='', selectedStar='', selectedShip='', signature='';
  let packetAt=performance.now(), animation=0;
  let expanded=false, mode='', message='', errorMessage=false, resizeObserver, interacting=false, pendingDraw=false, focusMap=null;

  function status(text,error=false) {
    message=text; errorMessage=error;
    const out=host?.querySelector('[data-galaxy-status]');
    if(out){out.textContent=text;out.classList.toggle('is-error',error);}
  }
  async function send(kind,body={}) {
    const response=await fetch('/api/campaign/v03/starmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.code,token,kind,receipt:crypto.randomUUID(),...body})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'The map could not be saved. Please try again.');
    if(result.campaign)update(result.campaign,token);
    return result;
  }
  function button(label,action,options={}) {
    const node=document.createElement('button');node.type='button';node.textContent=label;
    if(options.className)node.className=options.className;
    if(options.label)node.setAttribute('aria-label',options.label);
    if(options.disabled){node.disabled=true;node.title=options.disabled;}
    node.onclick=async event=>{
      event.stopPropagation();if(node.disabled)return;node.disabled=true;
      try{await action();}
      catch(error){const alert=node.closest('dialog')?.querySelector('[role="alert"]');if(alert)alert.textContent=error.message;else status(error.message,true);}
      finally{if(node.isConnected)node.disabled=Boolean(options.disabled);}
    };
    return node;
  }
  function field(name,label,value='',type='text',attributes='') {
    return `<label class="galaxy-field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attributes}></label>`;
  }
  function modal(title,contents,save,label='Save') {
    const dialog=document.createElement('dialog');dialog.className='galaxy-dialog';
    dialog.innerHTML=`<form><header><h2>${esc(title)}</h2></header><div class="galaxy-form-fields">${contents}</div><p role="alert"></p><footer><button type="button" data-cancel>Cancel</button><button type="submit" class="galaxy-primary">${esc(label)}</button></footer></form>`;
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const submit=dialog.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
      try{await save(new FormData(event.target));dialog.close();}catch(error){dialog.querySelector('[role="alert"]').textContent=error.message;}finally{submit.disabled=false;}
    };
    dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();return dialog;
  }
  function confirmation(title,text,accept,action){return modal(title,`<p>${esc(text)}</p>`,action,accept);}
  function starEditor(map,star={},location=star) {
    modal(star.id?'Edit '+star.name:'Name your new star',
      field('name','Star name',star.name||'','text','required maxlength="80" autocomplete="off"')+
      `<label class="galaxy-field">Who can see this star?<select name="visibility"><option value="visible">Everyone in the campaign</option><option value="hidden" ${star.hidden?'selected':''}>GM only — undiscovered</option></select></label>`+
      `<label class="galaxy-field">Description for players<textarea name="lore" rows="3" maxlength="5000" placeholder="Nearby worlds, civilizations, dangers, or other published lore">${esc(star.lore)}</textarea></label>`+
      `<div class="galaxy-form-columns"><label class="galaxy-field">Known planets <small>One name per line</small><textarea name="planets" rows="3">${esc((star.planets||[]).filter(p=>!p.hidden).map(p=>p.name).join('\n'))}</textarea></label><label class="galaxy-field">Undiscovered planets <small>Visible only to the GM</small><textarea name="hiddenPlanets" rows="3">${esc((star.planets||[]).filter(p=>p.hidden).map(p=>p.name).join('\n'))}</textarea></label></div>`+
      `<label class="galaxy-field">Private GM notes<textarea name="gmNotes" rows="2" maxlength="5000">${esc(star.gmNotes)}</textarea></label>`+
      `<details><summary>Advanced: exact hex position</summary><p>The selected map hex is already filled in. You can also drag the star after saving.</p><div class="galaxy-form-columns">${field('q','Column axis (Q)',location.q??0,'number','step="1" min="-10000" max="10000" required')}${field('r','Diagonal axis (R)',location.r??0,'number','step="1" min="-10000" max="10000" required')}</div></details>`,
      async values=>{
        const result=await send('star',{mapId:map.id,starId:star.id,name:values.get('name'),q:Number(values.get('q')),r:Number(values.get('r')),lore:values.get('lore'),gmNotes:values.get('gmNotes'),hidden:values.get('visibility')==='hidden',planets:['planets','hiddenPlanets'].flatMap(key=>String(values.get(key)).split('\n').map(s=>s.trim()).filter(Boolean).map(name=>({name,hidden:key==='hiddenPlanets'})))});
        selectedStar=star.id||result.campaign?.starmaps?.maps.find(m=>m.id===map.id)?.stars.at(-1)?.id||'';
        mode='';status(star.id?'Star details saved.':'Star added. Drag it to another hex at any time.');draw();
      },star.id?'Save Star':'Add Star');
  }
  function scaleEditor(map) {
    const dialog=modal('Distance between hexes',
      `<p>This changes travel distances and fuel use. It does not change the size of the map on your screen.</p><label class="galaxy-field">Distance setting<select name="preset"><option value="parsec" ${map.parsecPreset?'selected':''}>1 parsec per hex (3.26 light-years)</option><option value="custom" ${!map.parsecPreset?'selected':''}>Custom light-years per hex</option></select></label>`+
      field('scale','Light-years per hex',map.lightYearsPerHex,'number','min="0.01" max="1000000" step="0.01" required')+'<p class="galaxy-muted">Minimum 0.01 light-years. Up to two decimal places.</p>',
      async values=>{await send('scale',{mapId:map.id,scale:Number(values.get('scale')),parsecPreset:values.get('preset')==='parsec'});status('Map distances updated.');});
    const preset=dialog.querySelector('[name="preset"]'),input=dialog.querySelector('[name="scale"]');
    preset.onchange=()=>{input.disabled=preset.value==='parsec';if(input.disabled)input.value='3.26';};preset.onchange();
  }
  function systemEditor(map,star) {
    let objects=structuredClone(star.system||[{id:'object-star-'+star.id,kind:'sun',name:star.name,q:0,r:0,quantity:1,intensity:2}]);
    const centerId='object-star-'+star.id,dialog=document.createElement('dialog');dialog.className='galaxy-system-dialog';
    dialog.innerHTML=`<header><div><h2>${esc(star.name)} system</h2><p>Place planets, asteroids and other objects around the central star. Drag markers to reposition them.</p></div></header><div class="galaxy-system-body"><div data-system-canvas></div></div><p role="alert"></p><footer></footer>`;
    const canvas=dialog.querySelector('[data-system-canvas]');
    const render=()=>{
      window.SASpaceMap.bindEditor(canvas,objects.map(o=>({id:o.id,title:o.name,spaceObject:o,ship:{gridCells:[],sicInventory:[],placements:[]}})),objects,positions=>{
        objects=window.SASpaceObjects.withPositions(objects,positions).map(o=>o.id===centerId?{...o,q:0,r:0}:o);
        requestAnimationFrame(()=>{const central=canvas.querySelector(`[data-space-ship="${CSS.escape(centerId)}"]`);if(central)central.setAttribute('transform','translate(0 0)');});
      },{fixedIds:[centerId]});
      window.SASpaceObjectEditor.bind(canvas,()=>objects,next=>{objects=next;render();},{fixedIds:[centerId]});
      const remove=dialog.querySelector(`[data-remove-object="${CSS.escape(centerId)}"]`);if(remove){remove.disabled=true;remove.title='The central star stays at the center of its solar system.';}
    };
    dialog.querySelector('footer').append(button('Cancel',()=>dialog.close()),button('Save System',async()=>{await send('system',{mapId:map.id,starId:star.id,objects});dialog.close();status(star.name+' system saved.');},{className:'galaxy-primary'}));
    document.body.append(dialog);dialog.showModal();render();dialog.onclose=()=>dialog.remove();
  }
  function duration(seconds) {
    if(seconds>=86400)return Number((seconds/86400).toFixed(2))+' days';if(seconds>=3600)return Number((seconds/3600).toFixed(2))+' hours';if(seconds>=60)return Number((seconds/60).toFixed(2))+' minutes';return Number(seconds.toFixed(1))+' seconds';
  }
  function travelReason(ship,map,star,data) {
    if(state.combatActive)return 'End the current encounter before traveling between stars.';
    if(!ship)return 'Choose a ship below to plan a journey.';
    if(data.journeys[ship.id])return 'This ship is already in warp. Finish the journey or drop out first.';
    const position=data.positions[ship.id];
    if(!position||position.mapId!==map.id)return 'The GM must place this ship on this map before it can travel.';
    if(star&&distance(position,star)<.000001)return 'This ship is already at '+star.name+'.';
    if(state.role!=='gm'){
      if(!state.ownCharacterId)return 'Link to a character and station on the ship’s Bridge to travel.';
      if(!ship.crewCharacterIds?.includes(state.ownCharacterId))return 'You must be assigned to this ship’s crew to operate it.';
      const location=ship.characterLocations?.[state.ownCharacterId],cell=location?.stationed&&window.SAShipMap?.buildLayout(ship.ship).footprint.get(location.square);
      if(!cell||!window.SAShipMap.definition(cell.type).bridge||!window.SAShipMap.operational(cell.item))return 'Station your character on this ship’s powered-on Bridge in the Starships tab.';
    }
    if(ship.ship?.fieldState?.dockedIn)return 'This ship is docked and travels with its carrier.';
    return '';
  }
  async function reviewTravel(map,star,ship){
    const args={mapId:map.id,starId:star.id,shipId:ship.id},initial=(await send('quote',args)).quote;
    let confirmed=initial.instantWarp,revision=0,pending=null,quote=initial;
    const summary=q=>`<dl class="galaxy-trip-summary"><div><dt>Warp drive</dt><dd>${esc(q.driveName)}</dd></div><div><dt>Distance</dt><dd>${q.targetLY.toFixed(2)} light-years</dd></div><div><dt>Drive activation</dt><dd>${duration(q.activationSeconds)}</dd></div><div><dt>Travel</dt><dd>${q.instantWarp?'Instant jump':duration(q.travelSeconds)}</dd></div><div><dt>Fuel selected</dt><dd>${Object.entries(q.counts).filter(([,n])=>n).map(([g,n])=>`${n} Grade ${g}`).join(' + ')} cells</dd></div>${q.instantWarp?'<div><dt>Auxiliary power</dt><dd>All current AU</dd></div>':''}</dl><p>Total arrival time: <strong>${duration(q.activationSeconds+q.travelSeconds)}</strong>. Time advances outside combat; GM Pass Time can fast-forward it.</p>`;
    const fuel=initial.instantWarp?'<p>EW-FTL requires exactly two Grade S cells.</p>':`<p>Choose the fuel cells to use. Smaller selected cells are used first; unused cells remain in storage.</p><div class="galaxy-fuel-choice">${initial.fuelOptions.map(o=>`<label class="galaxy-field">Grade ${o.grade} · ${o.available} available<small>${o.rangeLY.toFixed(2)} light-years per cell</small><input type="number" min="0" max="${o.available}" step="1" name="fuel-${o.grade}" value="0" ${!o.available?'disabled':''}></label>`).join('')}</div>`;
    const counts=()=>Object.fromEntries([...dialog.querySelectorAll('[name^="fuel-"]')].map(i=>[i.name.slice(5),Number(i.value)]));
    const dialog=modal('Travel to '+star.name,`<p>${esc(ship.title)} · <strong>${esc(initial.driveName)}</strong></p>${fuel}<div data-trip-quote>${initial.instantWarp?summary(initial):'<p>Select enough fuel to review the arrival time.</p>'}</div>`,async()=>{if(pending)await pending;if(!confirmed)throw Error('Choose sufficient fuel before entering warp.');await send('travel',{...args,...(!initial.instantWarp?{fuelCounts:counts()}:{})});status(ship.title+' entered warp. The GM has been notified.');},'Enter Warp');
    const submit=dialog.querySelector('[type=submit]');submit.disabled=!confirmed;
    if(!initial.instantWarp)dialog.addEventListener('input',()=>{
      const mine=++revision;confirmed=false;submit.disabled=true;dialog.querySelector('[role=alert]').textContent='';
      pending=send('quote',{...args,fuelCounts:counts()}).then(result=>{if(mine!==revision||!dialog.isConnected)return;quote=result.quote;confirmed=true;dialog.querySelector('[data-trip-quote]').innerHTML=summary(quote);submit.disabled=false;}).catch(error=>{if(mine!==revision||!dialog.isConnected)return;dialog.querySelector('[data-trip-quote]').textContent=error.message;});
    });
  }

  function beginMode(next){mode=mode===next?'':next;status('');draw();}
  function inspector(details,map,data,gm,ships) {
    const star=map.stars.find(s=>s.id===selectedStar);
    details.innerHTML=star?`<section class="galaxy-star-info"><div class="galaxy-star-heading"><img src="map-sun.webp" alt=""><div><small>${star.hidden?'UNDISCOVERED · GM ONLY':'SELECTED STAR'}</small><h3>${esc(star.name)}</h3></div></div><p class="galaxy-lore">${esc(star.lore||'No description has been added for this star.')}</p>${(star.planets||[]).length?`<h4>Orbiting planets</h4><ul>${star.planets.map(p=>`<li>${esc(p.name)}${p.hidden?' <small>(GM only)</small>':''}</li>`).join('')}</ul>`:''}${gm&&star.gmNotes?`<details><summary>Private GM notes</summary><p class="galaxy-lore">${esc(star.gmNotes)}</p></details>`:''}<div data-star-actions></div></section>`:'<section class="galaxy-star-info galaxy-empty-inspector"><h3>Explore the sector</h3><p>Click a star to see its planets and lore, then choose a ship to plan a journey.</p><p>Drag empty space to pan. Use the mouse wheel or + / − to zoom.</p></section>';
    if(star&&gm){
      const actions=details.querySelector('[data-star-actions]');
      actions.append(button('Edit Details',()=>starEditor(map,star)),button('Edit Solar System',()=>systemEditor(map,star),{disabled:state.combatActive?'End the current encounter before editing a solar system.':''}));
      actions.append(button('Prepare Combat Here',async()=>{
        const opened=await send('openSystem',{mapId:map.id,starId:star.id});window.dispatchEvent(new CustomEvent('sa-open-system',{detail:opened.campaign}));
        if(expanded){expanded=false;draw();}document.querySelector('.gm-tabs [data-tab="atb"]')?.click();document.querySelector('[data-encounter-mode="starship"]')?.click();status('System loaded into Prepare Combat. Choose ships and entry positions before beginning.');
      },{disabled:state.combatActive?'End the current encounter before preparing another system.':''}));
      const advanced=document.createElement('details');advanced.className='galaxy-star-admin';advanced.innerHTML='<summary>Remove this star</summary><p>This also removes its saved solar system and notes.</p>';
      advanced.append(button('Delete '+star.name,()=>confirmation('Delete '+star.name+'?','Remove this star, its notes and saved solar system? Ships already here will stay at their current map position.','Delete Star',async()=>{await send('deleteStar',{mapId:map.id,starId:star.id});selectedStar='';status('Star removed.');draw();}),{className:'galaxy-danger',disabled:Object.values(data.journeys).some(j=>j.starId===star.id)?'A ship is traveling to this star. Finish or cancel the journey first.':''}));
      details.querySelector('.galaxy-star-info').append(advanced);
    }
    const travel=document.createElement('section');travel.className='galaxy-travel';travel.innerHTML='<h3>Ship & travel</h3><label class="galaxy-field">Ship<select aria-label="Travel ship"><option value="">Choose a ship</option></select></label>';
    const select=travel.querySelector('select');
    for(const ship of ships){const option=document.createElement('option');option.value=ship.id;option.textContent=ship.title;option.selected=ship.id===selectedShip;select.append(option);}
    select.onchange=()=>{selectedShip=select.value;mode='';draw();};
    const ship=ships.find(s=>s.id===selectedShip),position=ship&&data.positions[ship.id],journey=ship&&data.journeys[ship.id],info=document.createElement('p');info.className='galaxy-muted';
    if(!ship)info.textContent=ships.length?'Choose which ship to place or send to another star.':'Add a ship to the campaign to plan a journey.';
    else if(position?.mapId===map.id){const current=map.stars.find(s=>distance(position,s)<.00001);info.textContent=journey?'In warp toward '+(map.stars.find(s=>s.id===journey.starId)?.name||'destination')+'.':current?'At '+current.name+'.':'Between stars on this map.';}
    else info.textContent=gm?'Not placed on this map. Choose “Place Ship” and click a hex.':'Ask the GM to place this ship on the map.';
    travel.append(info);
    if(ship&&position?.mapId===map.id)travel.append(button('Find Ship',()=>focusMap?.(position)));
    if(gm&&ship){travel.append(button(mode==='ship'?'Cancel Placement':'Place Ship on Map',()=>beginMode('ship'),{disabled:journey?'Drop out of warp before repositioning.':''}));if(star)travel.append(button('Place at '+star.name,async()=>{await send('position',{mapId:map.id,shipId:ship.id,q:star.q,r:star.r});status(ship.title+' placed at '+star.name+'.');},{disabled:journey?'Drop out of warp before repositioning.':''}));}
    if(journey){
      const warp=ship.ship?.warpState,progress=Math.max(0,Math.min(1,(warp?.traveledLY||0)/(warp?.targetLY||1))),progressNode=document.createElement('div');progressNode.className='galaxy-journey';
      progressNode.innerHTML=`<progress max="1" value="${progress}" aria-label="Journey distance traveled"></progress><strong>${Math.round(progress*100)}% of journey distance</strong><p>${warp?.phase==='activating'?'Warp drive activating — '+duration(Math.max(0,warp.remaining||0))+' remaining. ':''}Travel advances automatically outside combat. GM Pass Time fast-forwards the journey.</p>`;
      travel.append(progressNode,button('Drop Out of Warp',()=>confirmation('Drop out of warp?','The ship will stop at its current position between stars. Fuel already used will not be restored.','Drop Out',async()=>{await send('exit',{shipId:ship.id});status('Ship dropped out of warp.');}),{disabled:state.role!=='gm'&&travelReason(ship,map,null,{...data,journeys:{}})||''}));
    }
    if(star&&!journey){
      const reason=travelReason(ship,map,star,data);
      if(ship&&position?.mapId===map.id){const route=document.createElement('p');route.innerHTML=`Distance to ${esc(star.name)}: <strong>${(distance(position,star)*map.lightYearsPerHex).toFixed(2)} light-years</strong>`;travel.append(route);}
      travel.append(button('Review Journey',()=>reviewTravel(map,star,ship),{className:'galaxy-primary',disabled:reason}));
      const explanation=document.createElement('p');explanation.className='galaxy-muted';explanation.textContent=reason||'Checks the warp drive and fuel, then shows the full cost before you depart.';travel.append(explanation);
    }
    details.append(travel);
    const directory=document.createElement('details');directory.className='galaxy-star-directory';directory.open=!star;directory.innerHTML=`<summary>Star directory · ${map.stars.length}</summary><div></div>`;
    for(const entry of [...map.stars].sort((a,b)=>a.name.localeCompare(b.name)))directory.lastElementChild.append(button(entry.name+(entry.hidden?' (GM only)':''),()=>{selectedStar=entry.id;draw();focusMap?.(entry);}));
    details.append(directory);
  }
  function snap(point){const q=Math.sqrt(3)/3*point.x-point.y/3,r=2*point.y/3;let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const dx=Math.abs(x-q),dz=Math.abs(z-r),dy=Math.abs(y+q+r);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;return{q:Math.max(-10000,Math.min(10000,x)),r:Math.max(-10000,Math.min(10000,z))};}
  function starLabel(name){
    const lines=[];let line='';
    for(const word of String(name).split(/\s+/)){
      if(line&&(line+' '+word).length>24){lines.push(line);line='';}
      if(word.length>24){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=24){const chunk=word.slice(i,i+24);if(chunk.length===24)lines.push(chunk);else line=chunk;}}
      else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);
    return lines.map((value,index)=>`<tspan x="0" dy="${index?'1.15em':-(lines.length-1)*1.15+'em'}">${esc(value)}</tspan>`).join('');
  }
  function chartMarkup(map,ships,data){
    const positions=ships.map(ship=>({ship,p:data.positions[ship.id]})).filter(x=>x.p?.mapId===map.id),groups=new Map();
    for(const entry of positions){const key=data.journeys[entry.ship.id]?entry.ship.id:entry.p.q.toFixed(5)+','+entry.p.r.toFixed(5);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
    const selected=map.stars.find(s=>s.id===selectedStar),from=data.positions[selectedShip];let route='';
    if(selected&&from?.mapId===map.id&&distance(from,selected)>.00001){const a=xy(from),b=xy(selected);route=`<path class="galaxy-planned-route" d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`;}
    return `<svg role="group" aria-label="Galaxy map. Select a star for details. Drag empty space to pan." preserveAspectRatio="xMidYMid meet"><defs><pattern id="galaxy-hex-grid" width="1.732050808" height="3" patternUnits="userSpaceOnUse"><path d="M0 -1L.866025404 -.5V.5L0 1L-.866025404 .5V-.5Z M.866025404 .5L1.732050808 1V2L.866025404 2.5L0 2V1Z" fill="none" stroke="#7aabbc" stroke-opacity=".22" stroke-width=".022"/></pattern></defs><rect data-grid-fill fill="url(#galaxy-hex-grid)"/><g class="galaxy-routes">${route}${positions.map(({ship})=>{const journey=data.journeys[ship.id];if(!journey)return '';const start=xy(journey.from),end=xy(journey.to);return `<path class="galaxy-active-route" d="M${start.x} ${start.y}L${end.x} ${end.y}"/>`;}).join('')}</g><path data-hover-hex class="galaxy-hover-hex" hidden d="M0 -1L.866025404 -.5V.5L0 1L-.866025404 .5V-.5Z"/>${map.stars.map(star=>{const p=xy(star);return `<g class="galaxy-star${star.id===selectedStar?' is-selected':''}${star.hidden?' is-hidden':''}" data-star="${esc(star.id)}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${esc(star.name)}${star.hidden?', GM only':''}" aria-pressed="${star.id===selectedStar}"><title>${esc(star.name)}${state.role==='gm'?' — select for details; drag to reposition':' — select for details'}</title><circle class="galaxy-star-hit" r=".68"/><circle class="galaxy-star-halo" r=".55"/><image class="galaxy-star-art" href="map-sun.webp" x="-.72" y="-.72" width="1.44" height="1.44"/><circle class="galaxy-star-selection" r=".8"/><text y="-1.02" text-anchor="middle" class="galaxy-star-name">${starLabel(star.name)}</text>${star.hidden?'<text y="1.15" text-anchor="middle" class="galaxy-hidden-label">GM ONLY</text>':''}</g>`;}).join('')}${[...groups.values()].map(entries=>{const primary=entries.find(e=>e.ship.id===selectedShip)||entries[0],p=xy(primary.p),onStar=!data.journeys[primary.ship.id]&&map.stars.some(s=>distance(s,primary.p)<.2),label=entries.length===1?primary.ship.title:entries.length+' ships';return `<g data-map-ship="${esc(primary.ship.id)}" class="galaxy-vessel${entries.some(e=>e.ship.id===selectedShip)?' is-selected':''}" transform="translate(${p.x} ${p.y+(onStar?.96:0)})" tabindex="0" role="button" aria-label="${esc(entries.map(e=>e.ship.title).join(', '))}"><title>${esc(entries.map(e=>e.ship.title).join(', '))}</title><circle r=".38" fill="transparent"/><g transform="scale(.5)">${window.SASpaceMap.vesselMarkup({...primary.ship,mapPowered:Boolean(data.journeys[primary.ship.id])})}</g><text y=".65" text-anchor="middle">${esc(label)}</text></g>`;}).join('')}</svg>`;
  }
  function bindChart(chart,map,ships,data,gm){
    const svg=chart.querySelector('svg'),rect=svg.querySelector('[data-grid-fill]'),hover=svg.querySelector('[data-hover-hex]');let camera=cameras.get(map.id),drag=null;
    const apply=()=>{
      if(!camera||!svg.clientWidth||!svg.clientHeight)return;
      const height=camera.height,width=height*svg.clientWidth/svg.clientHeight,x=camera.cx-width/2,y=camera.cy-height/2;
      svg.setAttribute('viewBox',`${x} ${y} ${width} ${height}`);for(const[name,value]of Object.entries({x,y,width,height}))rect.setAttribute(name,value);
      svg.style.setProperty('--galaxy-label-size',Math.max(.28,Math.min(3.5,height/svg.clientHeight*14))+'px');cameras.set(map.id,{...camera});
    };
    const fit=()=>{
      const points=[...map.stars,...ships.map(s=>data.positions[s.id]).filter(p=>p?.mapId===map.id)].map(xy),left=Math.min(-3,...points.map(p=>p.x))-2.7,right=Math.max(3,...points.map(p=>p.x))+2.7,top=Math.min(-2,...points.map(p=>p.y))-2.7,bottom=Math.max(2,...points.map(p=>p.y))+3,aspect=(svg.clientWidth||900)/(svg.clientHeight||520);
      camera={cx:(left+right)/2,cy:(top+bottom)/2,height:Math.max(bottom-top,(right-left)/aspect,8),auto:true};apply();
      // Labels keep a readable screen size, so include their rendered bounds after the initial fit.
      if(svg.clientWidth&&svg.clientHeight)for(let pass=0;pass<2;pass++){
        let x1=left,x2=right,y1=top,y2=bottom;
        for(const node of svg.querySelectorAll('[data-star],[data-map-ship]')){
          const box=node.getBBox(),matrix=node.transform.baseVal.consolidate()?.matrix;
          if(!matrix)continue;x1=Math.min(x1,box.x+matrix.e-.4);x2=Math.max(x2,box.x+box.width+matrix.e+.4);y1=Math.min(y1,box.y+matrix.f-.4);y2=Math.max(y2,box.y+box.height+matrix.f+.4);
        }
        camera={cx:(x1+x2)/2,cy:(y1+y2)/2,height:Math.max(y2-y1,(x2-x1)/aspect,8),auto:true};apply();
      }
    };
    const world=event=>{const bounds=svg.getBoundingClientRect(),width=camera.height*bounds.width/bounds.height;return{x:camera.cx-width/2+(event.clientX-bounds.left)/bounds.width*width,y:camera.cy-camera.height/2+(event.clientY-bounds.top)/bounds.height*camera.height};};
    const zoom=(factor,anchor)=>{if(!camera)return;const old=camera.height,height=Math.max(5,Math.min(60000,old*factor));if(anchor){camera.cx=anchor.x+(camera.cx-anchor.x)*height/old;camera.cy=anchor.y+(camera.cy-anchor.y)*height/old;}camera.height=height;camera.auto=false;apply();};
    focusMap=position=>{const point=xy(position);camera={cx:point.x,cy:point.y,height:Math.min(camera?.height||14,18),auto:false};apply();};
    const controls=chart.querySelector('.galaxy-camera-tools');controls.append(button('+',()=>zoom(.75),{label:'Zoom in Galaxy Map'}),button('−',()=>zoom(4/3),{label:'Zoom out Galaxy Map'}),button('Fit Map',fit),button(expanded?'Return to Campaign':'Enlarge Map',()=>{expanded=!expanded;draw();}));
    resizeObserver=new ResizeObserver(()=>{if(!svg.isConnected)return;if(!camera||camera.auto)fit();else apply();});resizeObserver.observe(svg);if(!camera)fit();else apply();
    svg.onselectstart=event=>event.preventDefault();svg.ondragstart=event=>event.preventDefault();svg.ondblclick=event=>event.preventDefault();
    svg.addEventListener('wheel',event=>{event.preventDefault();if(!drag)zoom(event.deltaY>0?1.12:1/1.12,world(event));},{passive:false});
    svg.onpointerdown=event=>{if(event.button!==0||!camera)return;event.preventDefault();interacting=true;const star=event.target.closest('[data-star]'),ship=event.target.closest('[data-map-ship]');drag={id:event.pointerId,x:event.clientX,y:event.clientY,camera:{...camera},starId:star?.dataset.star,shipId:ship?.dataset.mapShip,moved:false,node:star};svg.setPointerCapture(event.pointerId);};
    svg.onpointermove=event=>{
      if(mode&&!drag){const p=xy(snap(world(event)));hover.removeAttribute('hidden');hover.setAttribute('transform',`translate(${p.x} ${p.y})`);}
      if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;svg.classList.add('is-dragging');
      if(drag.starId&&gm&&!mode){const p=xy(snap(world(event)));drag.node.setAttribute('transform',`translate(${p.x} ${p.y})`);return;}if(drag.starId||drag.shipId)return;
      const units=drag.camera.height/svg.clientHeight;camera={...drag.camera,cx:drag.camera.cx-dx*units,cy:drag.camera.cy-dy*units,auto:false};apply();
    };
    svg.onpointerleave=()=>hover.setAttribute('hidden','');
    const finish=()=>{drag=null;interacting=false;svg.classList.remove('is-dragging');if(pendingDraw){pendingDraw=false;draw();}};
    svg.onpointercancel=()=>{const current=drag;if(current?.node){const star=map.stars.find(s=>s.id===current.starId),p=xy(star);current.node.setAttribute('transform',`translate(${p.x} ${p.y})`);}finish();};
    svg.onpointerup=async event=>{
      if(!drag||drag.id!==event.pointerId)return;const current=drag,position=snap(world(event));svg.releasePointerCapture(event.pointerId);finish();
      try{
        if(current.moved){if(current.starId&&gm&&!mode){const star=map.stars.find(s=>s.id===current.starId);if(star.q!==position.q||star.r!==position.r){status('Saving star position…');await send('moveStar',{mapId:map.id,starId:star.id,...position});status(star.name+' moved.');}}return;}
        if(mode==='ship'&&gm&&selectedShip){await send('position',{mapId:map.id,shipId:selectedShip,...position});mode='';status('Ship position saved.');draw();return;}
        if(current.starId){selectedStar=current.starId;mode='';status('');draw();return;}
        if(current.shipId){selectedShip=current.shipId;mode='';draw();return;}
        if(mode==='star'&&gm)starEditor(map,{},position);
      }catch(error){status(error.message,true);draw();}
    };
    for(const node of svg.querySelectorAll('[data-star],[data-map-ship]'))node.onkeydown=event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();if(node.dataset.star)selectedStar=node.dataset.star;else selectedShip=node.dataset.mapShip;mode='';draw();};
  }
  function draw(){
    if(!host||!state)return;resizeObserver?.disconnect();
    const gm=state.role==='gm',data={maps:[],positions:{},journeys:{},...state.starmaps},map=data.maps.find(m=>m.id===selectedMap)||data.maps[0];selectedMap=map?.id||'';
    const ships=(state.starships||[]).filter(ship=>gm||ship.controlType==='pc');if(!selectedShip||!ships.some(s=>s.id===selectedShip))selectedShip=ships.find(s=>s.crewCharacterIds?.includes(state.ownCharacterId))?.id||ships.find(s=>s.controlType==='pc')?.id||ships[0]?.id||'';
    host.classList.toggle('galaxy-is-expanded',expanded);
    host.innerHTML=`<header class="galaxy-heading"><div><span>CAMPAIGN NAVIGATION</span><h2>Galaxy Map</h2><p>${gm?'Build your sector, place ships and plan travel between stars.':'Explore known stars and plan your next journey.'}</p></div><div data-map-management></div></header><div class="galaxy-tools"></div><div class="galaxy-workspace"><div class="galaxy-chart"><div class="galaxy-camera-tools"></div><div class="galaxy-mode-help"></div><div class="galaxy-map-surface"></div><div class="galaxy-countdown" data-travel-countdown hidden></div><div class="galaxy-map-legend"><span><i class="galaxy-legend-star"></i> Star</span><span><i class="galaxy-legend-ship"></i> Ship</span><span><i class="galaxy-legend-route"></i> Planned route</span><span>Drag empty space to pan · Scroll to zoom</span></div></div><aside class="galaxy-details" aria-label="Star details and travel"></aside></div><p data-galaxy-status role="status" aria-live="polite" class="${errorMessage?'is-error':''}">${esc(message)}</p>`;
    const management=host.querySelector('[data-map-management]');
    if(gm)management.append(button('New Galaxy Map',()=>modal('Create a galaxy map',field('name','Map name','','text','required maxlength="80" placeholder="For example: Frontier Sector"')+'<p>Start with an empty hex map, then click “Add Star” to place and name stars. Each hex begins at one parsec (3.26 light-years).</p>',async values=>{const result=await send('create',{name:values.get('name')});selectedMap=result.campaign.starmaps.maps.at(-1).id;selectedStar='';mode='star';status('Map created. Click an empty hex to add your first star.');draw();},'Create Map')));
    if(!map){host.querySelector('.galaxy-workspace').innerHTML=`<div class="galaxy-empty-map"><h3>${gm?'Chart your first sector':'No galaxy map yet'}</h3><p>${gm?'Create a map, click to place stars, then put ships at their starting positions.':'The GM can create a galaxy map for this campaign. It will appear here when it is ready.'}</p></div>`;if(expanded)management.append(button('Return to Campaign',()=>{expanded=false;draw();}));return;}
    const tools=host.querySelector('.galaxy-tools'),select=document.createElement('select');select.setAttribute('aria-label','Galaxy Map');select.innerHTML=data.maps.map(m=>`<option value="${esc(m.id)}" ${m.id===map.id?'selected':''}>${esc(m.name)}</option>`).join('');select.onchange=()=>{selectedMap=select.value;selectedStar='';mode='';status('');draw();};tools.append(select);
    const scale=document.createElement('span');scale.className='galaxy-scale';scale.textContent=map.parsecPreset?'1 hex = 1 parsec · 3.26 light-years':'1 hex = '+Number(map.lightYearsPerHex).toFixed(2)+' light-years';tools.append(scale);
    if(gm)tools.append(button('Change Distances',()=>scaleEditor(map),{disabled:Object.values(data.journeys).some(j=>j.mapId===map.id)?'Finish journeys on this map before changing its distances.':''}),button(mode==='star'?'Cancel Adding Star':'+ Add Star',()=>beginMode('star'),{className:'galaxy-primary'}));
    const help=host.querySelector('.galaxy-mode-help');help.innerHTML=mode==='star'?'<strong>Place a star</strong><span>Click an empty hex, then give the star a name. Drag empty space to move around the map.</span>':mode==='ship'?'<strong>Place your ship</strong><span>Click any hex or star to set the selected ship’s position.</span>':`<span>${gm?'Click a star for details · Drag a star to reposition it':'Click a star for details and travel'}</span>`;
    if(mode)help.append(button('Cancel',()=>{mode='';draw();}));host.querySelector('.galaxy-chart').classList.toggle('is-placing',Boolean(mode));host.querySelector('.galaxy-map-surface').innerHTML=chartMarkup(map,ships,data);inspector(host.querySelector('.galaxy-details'),map,data,gm,ships);bindChart(host.querySelector('.galaxy-chart'),map,ships,data,gm);refreshTravel();
  }
  function arrangeCampaign(){
    const parent=host.parentElement;if(parent.classList.contains('campaign-columns'))return;
    const columns=document.createElement('div');columns.className='campaign-columns';const left=document.createElement('div');left.className='campaign-information';parent.insertBefore(columns,host);columns.append(left,host);
    if(state.role!=='gm'){
      columns.classList.add('campaign-columns-player');for(const node of [...parent.children].filter(n=>n!==columns&&n.matches('.campaign-lobby-heading,.campaign-lobby-tools,.campaign-group-credits')))left.append(node);
      for(const id of ['campaignPrivateNotes','campaignRosterCards','campaignStarshipRoster']){const node=document.getElementById(id);if(node)left.append(node);}
    }else{
      const session=parent.querySelector('.session-control');if(session)left.append(session);
      const summary=document.createElement('div');summary.dataset.campaignOverview='';left.append(summary);
    }
  }
  function updateOverview(){
    const summary=host?.parentElement.querySelector('[data-campaign-overview]');if(!summary)return;
    const markup=`<section><h3>Private Notes</h3>${(state.inbox||[]).filter(n=>n.direction==='to-gm').slice(-8).reverse().map(n=>`<p><strong>${esc(n.characterName||'Campaign')}</strong><br>${esc(n.message)}</p>`).join('')||'<p>No private messages.</p>'}<button type="button" data-open-inbox>Open Inbox</button></section><section><h3>Character Data</h3>${(state.characters||[]).map(c=>`<p><strong>${esc(c.character?.identity?.characterName||'Unnamed Character')}</strong> · HP ${esc(c.character?.health?.current??'—')} · Reverence ${esc(c.character?.resources?.reverence??0)}</p>`).join('')}</section><section><h3>Starship Data</h3>${(state.starships||[]).map(s=>`<p><strong>${esc(s.title)}</strong> · ${esc(s.controlType==='pc'?'PC':'GM')}<br>Hull ${s.currentHullHp??s.maximumHullHp??'—'} / ${s.maximumHullHp??'—'}</p>`).join('')}</section>`;
    if(summary._markup===markup)return;summary._markup=markup;summary.innerHTML=markup;summary.querySelector('[data-open-inbox]').onclick=()=>document.querySelector('[data-tab="inbox"]')?.click();
  }
  function update(next,key){
    if(state?.code&&state.code!==next?.code){selectedMap='';selectedStar='';selectedShip='';mode='';signature='';cameras.clear();}state=next;token=key;packetAt=performance.now();if(!state?.code)return;
    host=document.querySelector('[data-galaxy-host]');if(!host){const parent=state.role==='gm'?document.querySelector('[data-tab-panel="campaign"]'):document.querySelector('#campaignRosterLobby');if(!parent)return;host=document.createElement('section');host.dataset.galaxyHost='';host.className='campaign-galaxy';if(state.role!=='gm'){const notes=document.getElementById('campaignPrivateNotes');if(notes)parent.append(notes);}parent.append(host);}
    arrangeCampaign();updateOverview();
    const nextSignature=JSON.stringify([state.code,state.role,state.ownCharacterId,[state.starmaps?.maps,Object.entries(state.starmaps?.positions||{}).filter(([id])=>!state.starmaps?.journeys?.[id]),Object.entries(state.starmaps?.journeys||{}).map(([id,j])=>[id,j.mapId,j.starId,j.from,j.to])],state.starships?.map(s=>[s.id,s.title,s.controlType,s.crewCharacterIds,s.characterLocations,s.ship?.warpState?.phase]),state.combatActive]);
    if(nextSignature!==signature){signature=nextSignature;if(interacting)pendingDraw=true;else draw();}else refreshTravel();
  }
  document.addEventListener('keydown',event=>{if(event.key!=='Escape'||event.defaultPrevented||!host||host.getClientRects().length===0||document.querySelector('dialog[open]'))return;if(mode){mode='';draw();event.preventDefault();}else if(expanded){expanded=false;draw();event.preventDefault();}});
  function refreshTravel(){
    cancelAnimationFrame(animation);animation=0;
    if(!host||!state?.starmaps)return;
    const data=state.starmaps,elapsed=state.combatActive?0:Math.min(2,Math.max(0,(performance.now()-packetAt)/1000));
    const countdown=host.querySelector('[data-travel-countdown]');let lines=[];
    for(const [id,j]of Object.entries(data.journeys||{})){
      if(j.mapId!==selectedMap)continue;
      const ship=state.starships?.find(s=>s.id===id),w=ship?.ship?.warpState;if(!w)continue;
      const activation=w.phase==='activating'?Math.max(0,w.remaining-elapsed):0;
      // Extrapolate only a short interval between authoritative server packets.
      const travelElapsed=w.phase==='traveling'?elapsed:Math.max(0,elapsed-(w.remaining||0));
      const traveled=Math.min(w.targetLY,(w.traveledLY||0)+(w.secondsPerParsec>0?travelElapsed*3.26/w.secondsPerParsec:0));
      const t=Math.max(0,Math.min(1,traveled/(w.targetLY||1))),p=xy({q:j.from.q+(j.to.q-j.from.q)*t,r:j.from.r+(j.to.r-j.from.r)*t});
      const marker=host.querySelector(`[data-map-ship="${CSS.escape(id)}"]`);if(marker){marker.setAttribute('transform',`translate(${p.x} ${p.y})`);const body=marker.querySelector('[data-vessel-body]'),a=xy(j.from),b=xy(j.to);if(body)body.setAttribute('transform',`rotate(${Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+90})`);}
      const remaining=Math.max(0,(w.targetLY-traveled)/3.26*(w.secondsPerParsec||0));
      if(id===selectedShip||!data.journeys[selectedShip])lines.push(`${ship.title} · ${state.combatActive?'Paused for combat · ':''}${activation>0?'Warp activation: '+duration(activation):'Arrival in '+duration(remaining)}`);
      if(id===selectedShip){const progress=host.querySelector('.galaxy-journey progress'),label=host.querySelector('.galaxy-journey strong');if(progress)progress.value=t;if(label)label.textContent=Math.floor(t*100)+'% of journey distance';const detail=host.querySelector('.galaxy-journey p');if(detail)detail.textContent=activation>0?'Warp drive activating — '+duration(activation)+' remaining.':'Travel advances automatically outside combat. GM Pass Time fast-forwards it.';}
    }
    if(countdown){countdown.hidden=!lines.length;countdown.textContent=lines.join(' / ');}
    if(Object.keys(data.journeys||{}).length&&!document.hidden&&window.SAExploreSession?.active?.()!==false&&host.getClientRects().length)animation=requestAnimationFrame(refreshTravel);
  }
  function travel(packet){
    if(!state?.starmaps)return;
    state.starmaps.positions=packet.positions;state.starmaps.journeys=packet.journeys;
    for(const update of packet.ships||[]){const ship=state.starships?.find(s=>s.id===update.id);if(ship)ship.ship.warpState=update.warpState;}
    update(state,token);
  }
  document.addEventListener('visibilitychange',refreshTravel);
  window.addEventListener('sa-perspective-visibility',refreshTravel);
  window.SACampaignMapUI={update,travel};
}());
