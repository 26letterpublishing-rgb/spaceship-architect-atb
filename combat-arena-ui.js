(function(){
  'use strict';
  const A=window.SACombatArena,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,mode='',mine='',previewFog=false,reveal=false,moveUnit=null,moveRoute=null,moveLocked=false,moveSubmitting=false,hoverSquare=null,liveKey='',fogSerial=0,zoom=1,focusView=false;
  const editors=new WeakMap(),origins=new Map();
  let dragging=null;
  function bindDrag(host,arena,onDrop,enabled=true){
    host.classList.toggle('arena-can-drag',enabled);
    host.onpointerdown=event=>{const token=event.target.closest('.arena-token[data-unit-id]');if(!enabled||!token||event.button!==0)return;event.preventDefault();dragging={host,id:token.dataset.unitId,x:event.clientX,y:event.clientY,moved:false,square:null};host.setPointerCapture(event.pointerId);};
    host.onpointermove=event=>{if(dragging?.host!==host)return;const d=dragging;if(Math.hypot(event.clientX-d.x,event.clientY-d.y)<5&&!d.moved)return;d.moved=true;
      const board=host.querySelector('.arena-board'),r=board.getBoundingClientRect(),x=Math.floor((event.clientX-r.left)/r.width*arena.width),y=Math.floor((event.clientY-r.top)/r.height*arena.height);d.square=x>=0&&x<arena.width&&y>=0&&y<arena.height?y*arena.width+x:null;
      board.querySelectorAll('.arena-cell.selected').forEach(n=>n.classList.remove('selected'));if(d.square!==null)board.querySelector(`[data-arena-cell="${d.square}"]`)?.classList.add('selected');
    };
    host.onpointerup=async event=>{if(dragging?.host!==host)return;const d=dragging;dragging=null;if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);host.querySelectorAll('.arena-cell.selected').forEach(n=>n.classList.remove('selected'));if(!d.moved)return;
      try{if(d.square===null||!arena.floors.includes(d.square))throw Error('Drop the character on a walkable floor square.');await onDrop(d.id,d.square);}catch(e){host.querySelector('.arena-error').textContent=e.message;}
    };
    host.onpointercancel=()=>{if(dragging?.host===host)dragging=null;host.querySelectorAll('.arena-cell.selected').forEach(n=>n.classList.remove('selected'));};
  }
  function edgeLine(key,w){const [a,b]=key.split(':').map(Number),x=a%w,y=Math.floor(a/w);return b-a===1?{x1:x+1,y1:y,x2:x+1,y2:y+1}:{x1:x,y1:y+1,x2:x+1,y2:y+1};}
  function fogMarkup(v,bounds){
    if(!v)return '';const visible=new Set(v.visible),explored=new Set(v.explored),forced=new Set(v.forced),w=v.width,b=bounds||{x:0,y:0,width:w,height:v.height};let dark='',dim='',hits='';
    for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++){const n=y*w+x;if(!visible.has(n)){const d=`M${x-.015} ${y-.015}h1.03v1.03h-1.03z`;if(explored.has(n))dim+=d;else dark+=d;}if(bounds&&reveal&&mode==='gm')hits+=`<rect role="button" tabindex="0" aria-label="Toggle forced visibility, row ${y+1}, column ${x+1}" data-fog-square="${n}" x="${x}" y="${y}" width="1" height="1" fill="${forced.has(n)?'#50ddab':'transparent'}" fill-opacity=".25"/>`;}
    const id='arena-fog-'+(++fogSerial);return `<svg class="arena-fog ${mode==='gm'?'gm-preview':''} ${bounds&&reveal&&mode==='gm'?'is-revealing':''}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" preserveAspectRatio="none" aria-hidden="${reveal?'false':'true'}"><defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".07"/></filter></defs><g filter="url(#${id})" pointer-events="none"><path d="${dim}" fill="#85898c" fill-opacity=".70"/><path d="${dark}" fill="#777c80"/></g>${hits}</svg>`;
  }
  function mapMarkup(a,units=[],options={}){
    const floors=new Set(a.floors);let cells='';
    for(let n=0;n<a.width*a.height;n++){const occupied=units.filter(u=>A.position(u)?.square===n&&A.position(u)?.arenaId==='surface');cells+=`<button type="button" class="arena-cell ${floors.has(n)?'floor':'wall'} ${options.selected===n?'selected':''} ${options.visibility?.forced?.includes(n)?'forced-visible':''}" ${reveal&&mode==='gm'?`data-fog-square="${n}"`:''} data-arena-cell="${n}" aria-label="Row ${Math.floor(n/a.width)+1}, column ${n%a.width+1}: ${floors.has(n)?'floor':'wall'}${occupied.length?', '+occupied.map(u=>esc(u.characterName||u.name)).join(', '):''}"></button>`;}
    const layout=A.boundaryLayout(a),edges=Array.from({length:a.width*a.height},(_,n)=>`<div class="arena-boundary">${window.SAShipMap.boundaryMarkup(layout,n,{isOpen:k=>a.doors[k]?.open,doorAttributes:k=>({'data-arena-door':k})})}</div>`).join('');
    const tokens=units.filter(u=>A.position(u)?.arenaId==='surface').map(u=>{const n=A.position(u).square,walking=u.timedAction?.kind==='move';return `<i data-unit-id="${esc(u.id)}" data-walking="${walking}" class="arena-token crew-token ${walking?'crew-walking':''}" style="left:${(n%a.width+.5)/a.width*100}%;top:${(Math.floor(n/a.width)+.5)/a.height*100}%;--token-color:${esc(u.color||'#32c9ff')};width:${70/a.width}%;height:${70/a.height}%" title="${esc(u.characterName||u.name)}">${window.SATokenArt?.figure(window.SATokenArt.character(u).race||'human',u.iconVariant)||esc((u.characterName||u.name||'?')[0])}</i>`;}).join('');
    return `<div class="arena-viewport"><div class="arena-board" data-terrain-theme="${esc(a.theme||'plain')}" style="--arena-columns:${a.width};aspect-ratio:${a.width}/${a.height}"><div class="arena-cells">${cells}</div><div class="arena-boundaries">${edges}</div>${tokens}${options.visibility?fogMarkup(options.visibility):''}</div></div>`;
  }
  function editor(host,options){
    let e=editors.get(host);if(!e){e={tool:'floor',first:null,unit:'',automatic:true};editors.set(host,e);}e.options=options;
    const a=options.arena,units=options.units||[],placed=units.map(u=>({...u,location:{arenaId:'surface',square:a.spawns[u.id]??-1}})).filter(u=>u.location.square>=0);
    host.innerHTML=`<div class="arena-toolbar"><strong>Surface Arena · ${a.width} × ${a.height}</strong><button type="button" data-arena-expand>Expand Zone +2 Each Side</button><label>Terrain <select data-arena-theme>${Object.entries(A.themes).map(([v,l])=>`<option value="${v}" ${a.theme===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Tool <select data-arena-tool>${[['floor','Floor / solid square'],['wall','Wall between squares'],['door','Door between squares'],['erase','Remove wall / door'],['place','Place character']].map(([v,l])=>`<option value="${v}" ${e.tool===v?'selected':''}>${l}</option>`).join('')}</select></label><label ${e.tool!=='door'?'hidden':''}><input type="checkbox" data-arena-auto ${e.automatic?'checked':''}>Automatic door</label><label ${e.tool!=='place'?'hidden':''}>Character <select data-arena-unit><option value="">Choose character</option>${units.map(u=>`<option value="${esc(u.id)}" ${e.unit===u.id?'selected':''}>${esc(u.characterName||u.name)}</option>`).join('')}</select></label></div><p class="arena-help">${e.tool==='place'?'Choose a character, then click a floor square. Unplaced characters are assigned a free floor square when combat begins.':['wall','door','erase'].includes(e.tool)?'Click two adjacent floor squares to edit the boundary between them.':'Click or drag to paint walkable floor and solid terrain. Drag characters to reposition them.'} Each floor square is one movement unit.</p><p class="arena-error" role="status"></p>${mapMarkup(a,placed,{selected:e.first})}`;
    const redraw=()=>editor(host,e.options),changed=()=>{e.options.arena=A.normalize(a);options.onChange(e.options.arena);redraw();},error=t=>host.querySelector('.arena-error').textContent=t;
    bindDrag(host,a,(id,n)=>{if(Object.entries(a.spawns).some(([other,square])=>other!==id&&square===n))throw Error('That starting square is occupied.');a.spawns[id]=n;changed();});

    // One intent per brush stroke; revisiting a square never reverses the paint.
    let brush=null;
    const tokenDown=host.onpointerdown,tokenMove=host.onpointermove,tokenUp=host.onpointerup,tokenCancel=host.onpointercancel;
    const squareAt=event=>{const r=host.querySelector('.arena-board').getBoundingClientRect(),x=Math.floor((event.clientX-r.left)/r.width*a.width),y=Math.floor((event.clientY-r.top)/r.height*a.height);return x>=0&&y>=0&&x<a.width&&y<a.height?y*a.width+x:null;};
    const paint=n=>{if(n===null||brush.seen.has(n))return;brush.seen.add(n);if(!brush.floor&&Object.values(a.spawns).includes(n)){error('Move the starting character before removing this floor.');return;}if(brush.floor){if(!a.floors.includes(n))a.floors.push(n);}else{a.floors=a.floors.filter(x=>x!==n);a.walls=a.walls.filter(k=>!k.split(':').includes(String(n)));for(const k of Object.keys(a.doors))if(k.split(':').includes(String(n)))delete a.doors[k];}const cell=host.querySelector('[data-arena-cell="'+n+'"]');cell?.classList.toggle('floor',brush.floor);cell?.classList.toggle('wall',!brush.floor);};
    host.onpointerdown=event=>{e.suppressClick=false;if(e.tool!=='floor'||event.button!==0||event.target.closest('.arena-token')||!event.target.closest('[data-arena-cell]'))return tokenDown(event);event.preventDefault();const n=squareAt(event);if(n===null)return;brush={floor:!a.floors.includes(n),seen:new Set(),last:n};host.setPointerCapture(event.pointerId);paint(n);};
    host.onpointermove=event=>{if(!brush)return tokenMove(event);const n=squareAt(event);if(n===null)return;const last=brush.last,dx=n%a.width-last%a.width,dy=Math.floor(n/a.width)-Math.floor(last/a.width),steps=Math.max(Math.abs(dx),Math.abs(dy));for(let i=1;i<=steps;i++)paint((Math.floor(last/a.width)+Math.round(dy*i/steps))*a.width+last%a.width+Math.round(dx*i/steps));brush.last=n;};
    host.onpointerup=event=>{if(!brush)return tokenUp(event);brush=null;e.suppressClick=true;if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);changed();};
    host.onpointercancel=event=>{if(brush){brush=null;changed();}else tokenCancel(event);};
    host.onchange=event=>{if(event.target.matches('[data-arena-theme]')){a.theme=event.target.value;changed();return;}if(event.target.matches('[data-arena-tool]')){e.tool=event.target.value;e.first=null;redraw();}if(event.target.matches('[data-arena-auto]'))e.automatic=event.target.checked;if(event.target.matches('[data-arena-unit]'))e.unit=event.target.value;};
    host.onclick=event=>{
      if(e.suppressClick){e.suppressClick=false;return;}
      if(event.target.closest('[data-arena-expand]')){try{e.options.arena=A.expand(a);e.first=null;options.onChange(e.options.arena);redraw();}catch(x){error(x.message);}return;}
      const cell=event.target.closest('[data-arena-cell]');if(!cell)return;const n=Number(cell.dataset.arenaCell);
      if(e.tool==='floor'){if(a.floors.includes(n)){if(Object.values(a.spawns).includes(n)){error('Move the starting character before removing this floor.');return;}a.floors=a.floors.filter(x=>x!==n);a.walls=a.walls.filter(k=>!k.split(':').includes(String(n)));for(const k of Object.keys(a.doors))if(k.split(':').includes(String(n)))delete a.doors[k];}else a.floors.push(n);changed();return;}
      if(!a.floors.includes(n)){error('Choose walkable floor squares for this tool.');return;}
      if(e.tool==='place'){if(!e.unit){error('Choose a character first.');return;}if(Object.entries(a.spawns).some(([id,v])=>id!==e.unit&&v===n)){error('That starting square is occupied.');return;}a.spawns[e.unit]=n;changed();return;}
      if(e.first===null){e.first=n;redraw();return;}if(Math.abs(e.first%a.width-n%a.width)+Math.abs(Math.floor(e.first/a.width)-Math.floor(n/a.width))!==1){e.first=n;redraw();error('Choose a square immediately next to the highlighted square.');return;}
      const k=A.edgeKey(e.first,n);a.walls=a.walls.filter(x=>x!==k);delete a.doors[k];if(e.tool==='wall')a.walls.push(k);if(e.tool==='door')a.doors[k]={open:false,automatic:e.automatic};e.first=null;changed();
    };
  }
  function pane(){
    const list=document.querySelector('#unitList');if(!list)return null;
    let host=document.querySelector('#surfaceArenaLive');if(!host){host=document.createElement('section');host.id='surfaceArenaLive';host.className='arena-live';list.before(host);}
    document.body.classList.toggle('surface-combat-mode',!!state?.arena);
    let layout=document.querySelector('#surfaceCombatLayout');
    if(state?.arena){
      if(!layout){layout=document.createElement('div');layout.id='surfaceCombatLayout';layout.innerHTML='<div class="surface-atb-column"></div>';list.before(layout);layout.firstElementChild.append(list);layout.append(host);}
      for(const id of ['myTurnBanner','turnDialog']){const node=document.getElementById(id);if(node&&!origins.has(node)){const marker=document.createComment('surface action panel origin');node.before(marker);origins.set(node,marker);layout.firstElementChild.insertBefore(node,list);}}
    }else if(layout){for(const [node,marker]of origins)marker.replaceWith(node);origins.clear();layout.before(list,host);layout.remove();}
    return host;
  }
  async function command(data){return window.SACombatBridge.action(data);}
  function syncTokens(host){if(!state.arena)return;const width=state.arena.width,height=state.arena.height;
    for(const token of host.querySelectorAll('.arena-token[data-unit-id]')){const unit=state.units.find(u=>u.id===token.dataset.unitId);if(!unit)continue;
      const carrier=unit.carriedBy&&state.units.find(u=>u.id===unit.carriedBy),moving=carrier||unit;
      const coords=p=>({x:p.square%width+.5,y:Math.floor(p.square/width)+.5}),point=A.movement(moving,coords)||{...coords(moving.location),heading:0,walking:false};if(carrier){point.x+=.22;point.walking=false;}
      token.style.left=point.x/width*100+'%';token.style.top=point.y/height*100+'%';token.style.setProperty('--crew-heading',point.heading+'deg');token.classList.toggle('crew-walking',point.walking);token.dataset.walking=String(point.walking);
    }
  }
  function fitMap(host,center=false){const viewport=host?.querySelector('.arena-viewport'),board=host?.querySelector('.arena-board');if(!viewport||!board)return;
    const cell=focusView?64:Math.min((viewport.clientWidth-18)/state.arena.width,(viewport.clientHeight-18)/state.arena.height);
    board.style.width=Math.max(12,cell)*state.arena.width*zoom+'px';
    if(center){const unit=state.units.find(u=>u.id===(moveUnit?.id||mine||state.activeId)),p=A.position(unit);if(p){viewport.scrollLeft=(p.square%state.arena.width+.5)*cell*zoom-viewport.clientWidth/2;viewport.scrollTop=(Math.floor(p.square/state.arena.width)+.5)*cell*zoom-viewport.clientHeight/2;}}
  }
  function refreshPreview(host){const board=host.querySelector('.arena-board');if(!board)return;board.querySelector('.combat-move-line')?.remove();board.querySelectorAll('.arena-cell.route').forEach(n=>n.classList.remove('route'));
    if(moveUnit&&moveRoute?.length){const points=[moveUnit.location,...moveRoute].map(p=>`${p.square%state.arena.width+.5},${Math.floor(p.square/state.arena.width)+.5}`).join(' ');
      board.insertAdjacentHTML('beforeend',`<svg class="combat-move-line arena-route-line" viewBox="0 0 ${state.arena.width} ${state.arena.height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`);board.querySelector('.arena-route-line').classList.toggle('extended',moveRoute.length>Math.max(1,Number(moveUnit.moveSpeed)||1));
      for(const p of moveRoute)board.querySelector(`[data-arena-cell="${p.square}"]`)?.classList.add('route');
    }
    const confirm=host.querySelector('[data-arena-confirm]');if(confirm){confirm.disabled=moveSubmitting||!moveLocked||!moveRoute?.length;confirm.textContent=moveSubmitting?'Starting…':'Confirm Move';}
    const hint=host.querySelector('[data-move-hint]');if(hint)hint.textContent=moveRoute===null&&hoverSquare!==null?'No legal path reaches that square.':moveRoute?.length?`${moveRoute.length} units${moveLocked?' selected. Confirm the move.':': click to select.'}`:'Point to preview a route; click to select.';
  }
  function chooseRoute(square,locked){const actor=state.units.find(u=>u.id===moveUnit?.id);if(!actor)return;hoverSquare=square;moveLocked=locked;moveRoute=A.route(state.arena,A.position(actor).square,square,state.units.filter(u=>u.id!==actor.id&&A.position(u)?.arenaId==='surface').map(u=>A.position(u).square));refreshPreview(pane());}
  function render(){
    const host=pane();if(!host||!state)return;const gm=mode==='gm';host.hidden=!state.arena&&!state.starships?.length;if(host.hidden||dragging?.host===host)return;
    if(moveUnit&&(state.activeId!==moveUnit.id||state.units.find(u=>u.id===moveUnit.id)?.timedAction)){moveUnit=null;moveRoute=null;moveLocked=false;hoverSquare=null;}
    // Clock ticks move existing sprites without rebuilding the board or resetting animation.
    const key=JSON.stringify([state.arena,state.units.map(u=>[u.id,u.characterName,u.color,u.location,u.raceId,u.iconRace,u.iconVariant,!!u.timedAction]),state.visibility,state.fog?.enabled,mode,previewFog,reveal,moveUnit?.id]);
    if(key===liveKey){syncTokens(host);return;}liveKey=key;
    const old=host.querySelector('.arena-viewport'),scroll=old?{x:old.scrollLeft,y:old.scrollTop}:null;
    window.SALiveDOM.render(host,`<div class="arena-toolbar"><strong>${state.arena?'Surface Arena':'Interior Visibility'}</strong>${gm?`<label><input type="checkbox" data-live-fog ${state.fog?.enabled?'checked':''}>Fog of War</label><label><input type="checkbox" data-fog-preview ${previewFog?'checked':''}>Preview player fog</label><button type="button" data-fog-reveal aria-pressed="${reveal}">${reveal?'Done Revealing':'Reveal Squares'}</button>`:state.fog?.enabled?'<span>Grey: unexplored · dimmed: remembered</span>':''}</div><p class="arena-error" role="status"></p>${state.arena?mapMarkup(state.arena,state.units,{visibility:state.fog?.enabled&&(!gm||previewFog||reveal)?state.visibility?.surface:null}):''}${state.arena?`<div class="arena-toolbar arena-live-footer">${moveUnit?`<strong>Move ${esc(moveUnit.characterName)}</strong><span data-move-hint></span><button type="button" data-arena-cancel>Cancel</button><button type="button" data-arena-confirm disabled>Confirm Move</button>`:''}<button type="button" data-arena-zoom="-1" aria-label="Zoom out arena">−</button><button type="button" data-arena-zoom="1" aria-label="Zoom in arena">+</button><button type="button" data-arena-fit>Fit Map</button><button type="button" data-arena-focus>Enlarge / Character</button></div>`:''}`);
    fitMap(host);if(scroll){const viewport=host.querySelector('.arena-viewport');if(viewport){viewport.scrollLeft=scroll.x;viewport.scrollTop=scroll.y;}}syncTokens(host);refreshPreview(host);
    if(state.arena)bindDrag(host,state.arena,async(id,square)=>{await command({action:'setCombatLocation',id,location:A.surfaceGrid(state.arena).location(square)});liveKey='';render();},gm&&!moveUnit);
    host.onpointerover=event=>{const cell=event.target.closest('[data-arena-cell]');if(moveUnit&&!moveLocked&&!moveSubmitting&&cell&&Number(cell.dataset.arenaCell)!==hoverSquare)chooseRoute(Number(cell.dataset.arenaCell),false);};
    host.onkeydown=event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('[data-arena-door]')){event.preventDefault();event.target.click();}};
    host.onchange=async event=>{try{if(event.target.matches('[data-live-fog]'))await command({action:'setCombatFog',enabled:event.target.checked});if(event.target.matches('[data-fog-preview]')){previewFog=event.target.checked;liveKey='';render();window.SACombatMap?.renderInlineMaps(document,true);}}catch(e){host.querySelector('.arena-error').textContent=e.message;}};
    host.onclick=async event=>{try{
      const z=event.target.closest('[data-arena-zoom]');if(z){zoom=Math.max(.5,Math.min(4,zoom*(Number(z.dataset.arenaZoom)>0?1.25:.8)));fitMap(host);return;}
      if(event.target.closest('[data-arena-fit]')){zoom=1;focusView=false;fitMap(host);return;}if(event.target.closest('[data-arena-focus]')){zoom=1;focusView=true;fitMap(host,true);return;}
      if(event.target.closest('[data-fog-reveal]')){if(!state.fog?.enabled){host.querySelector('.arena-error').textContent='Enable Fog of War before revealing squares.';return;}reveal=!reveal;previewFog||=reveal;render();window.SACombatMap?.renderInlineMaps(document,true);return;}
      if(event.target.closest('[data-arena-cancel]')){moveUnit=null;moveRoute=null;moveLocked=false;render();return;}
      if(event.target.closest('[data-arena-confirm]')){if(moveSubmitting||!moveLocked||!moveRoute?.length)return;moveSubmitting=true;refreshPreview(host);try{const actor=moveUnit,route=moveRoute;await command({action:'playerCombatAction',kind:'move',id:actor.id,route,turnSerial:actor.turnSerial});moveUnit=null;moveRoute=null;moveLocked=false;}finally{moveSubmitting=false;liveKey='';render();}return;}
      const forced=event.target.closest('[data-fog-square]');if(forced&&gm&&reveal){await command({action:'forceCombatVisibility',mapId:'surface',square:Number(forced.dataset.fogSquare)});return;}
      const door=event.target.closest('[data-arena-door]');if(door?.dataset.arenaDoor){await command({action:'operateSurfaceDoor',id:gm?state.activeId:mine,doorKey:door.dataset.arenaDoor});return;}
      const cell=event.target.closest('[data-arena-cell]');if(cell&&moveUnit&&!moveSubmitting)chooseRoute(Number(cell.dataset.arenaCell),true);
    }catch(e){host.querySelector('.arena-error').textContent=e.message;}};
  }
  function shipFog(host,record){
    const grid=host.matches?.('#combatMapGrid')?host:host.querySelector('.inline-combat-map-grid');if(!grid)return;grid.dataset.fogShipId=record.id;
    const signature=JSON.stringify([state?.fog?.enabled,state?.visibility?.[record.id],mode,previewFog,reveal]);if(grid.dataset.fogSignature===signature&&grid.querySelector(':scope > .arena-fog'))return;grid.dataset.fogSignature=signature;grid.querySelector(':scope > .arena-fog')?.remove();if(!state?.fog?.enabled||mode==='gm'&&!previewFog&&!reveal)return;
    const cells=[...grid.querySelectorAll('[data-inline-square],[data-map-square]')].map(e=>Number(e.dataset.inlineSquare??e.dataset.mapSquare)),w=window.SAShipMap.gridColumns(record),xs=cells.map(n=>n%w),ys=cells.map(n=>Math.floor(n/w));if(!cells.length)return;
    const b=grid.id==='combatMapGrid'?{x:0,y:0,width:w*3,height:window.SAShipMap.gridRows(record)*3}:{x:Math.min(...xs)*3,y:Math.min(...ys)*3,width:(Math.max(...xs)-Math.min(...xs)+1)*3,height:(Math.max(...ys)-Math.min(...ys)+1)*3};grid.insertAdjacentHTML('beforeend',fogMarkup(state.visibility?.[record.id],b));const fog=grid.querySelector(':scope > .arena-fog');
    if(fog){fog.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};fog.onclick=async event=>{const cell=event.target.closest('[data-fog-square]');if(cell&&mode==='gm'&&reveal){event.stopPropagation();try{await command({action:'forceCombatVisibility',mapId:record.id,square:Number(cell.dataset.fogSquare)});}catch(e){pane().querySelector('.arena-error').textContent=e.message;}}};}
  }
  window.addEventListener('resize',()=>{if(state?.arena)fitMap(pane());});
  window.addEventListener('sa-combat-state',event=>{state=event.detail.state;mode=event.detail.mode;mine=event.detail.myUnitId;render();document.querySelectorAll('[data-inline-ship-map]').forEach(host=>{const record=state.starships?.find(s=>s.id===host.dataset.inlineShipMap);if(record)shipFog(host,record);});const full=document.querySelector('#combatMapGrid'),record=state.starships?.find(s=>s.id===full?.dataset.fogShipId);if(record)shipFog(full,record);window.SACombatMap?.refreshArenaFog?.();});
  window.SAArenaUI={editor,shipFog,render,beginPlacement(host,id){const e=editors.get(host);if(!e)return;e.unit=id;e.tool='place';e.first=null;editor(host,e.options);host.querySelector('.arena-help').textContent='Choose a white square for '+(e.options.units.find(u=>u.id===id)?.characterName||'this character')+'. Occupied squares cannot be selected.';host.scrollIntoView({block:'center',behavior:'smooth'});},openMove(unit){moveUnit=unit;moveRoute=null;moveLocked=false;hoverSquare=null;focusView=true;liveKey='';render();fitMap(pane(),true);}};
})();
