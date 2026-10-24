(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ship-map-core'));else root.SACombatArena=factory(root.SAShipMap);})(typeof window==='object'?window:globalThis,function(maps){
  'use strict';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const edgeKey=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
  const integer=(n,lo,hi,fallback)=>Number.isInteger(n)&&n>=lo&&n<=hi?n:fallback;
  const themes=Object.freeze({plain:'Plain white / black',spaceship:'Sci-Fi spaceship',sand:'Sand Planet',rock:'Rocky Planet',palace:'Utopia Palace',city:'City'});
  function normalize(raw={}){
    const width=integer(raw.width,7,61,7),height=integer(raw.height,7,61,7),limit=width*height;
    const floors=Array.isArray(raw.floors)?raw.floors:Array.from({length:9},(_,i)=>(Math.floor(height/2)-1+Math.floor(i/3))*width+Math.floor(width/2)-1+i%3);
    const valid=n=>Number.isInteger(n)&&n>=0&&n<limit;
    const validEdge=k=>{if(!/^\d+:\d+$/.test(k))return false;const [a,b]=k.split(':').map(Number);return valid(a)&&valid(b)&&(b-a===width||b-a===1&&Math.floor(a/width)===Math.floor(b/width));};
    return {width,height,theme:Object.hasOwn(themes,raw.theme)?raw.theme:'plain',floors:[...new Set(floors.filter(valid))].sort((a,b)=>a-b),walls:[...new Set((raw.walls||[]).filter(validEdge))],doors:Object.fromEntries(Object.entries(raw.doors||{}).filter(([k])=>validEdge(k)).map(([k,d])=>[k,{open:!!d.open,automatic:!!d.automatic,hits:integer(d.hits,0,3,0),...(typeof d.override==='boolean'?{override:d.override}:{})}])),spawns:Object.fromEntries(Object.entries(raw.spawns||{}).filter(([k,v])=>k.length<160&&valid(v)))};
  }
  function expand(raw){const a=normalize(raw);if(a.width>57||a.height>57)throw Error('The arena has reached its 61 × 61 square limit.');const remap=n=>(Math.floor(n/a.width)+2)*(a.width+4)+n%a.width+2,edge=k=>edgeKey(...k.split(':').map(Number).map(remap));return {width:a.width+4,height:a.height+4,theme:a.theme,floors:a.floors.map(remap),walls:a.walls.map(edge),doors:Object.fromEntries(Object.entries(a.doors).map(([k,v])=>[edge(k),v])),spawns:Object.fromEntries(Object.entries(a.spawns).map(([k,v])=>[k,remap(v)]))};}
  function boundaryLayout(a){
    const floor=new Set(a.floors),walls=new Set(a.walls);
    return {boundary(square,side){const x=square%a.width,y=Math.floor(square/a.width),delta={top:-a.width,right:1,bottom:a.width,left:-1}[side],to=square+delta;
      if(!floor.has(square))return {kind:'none'};
      if(side==='top'&&y===0||side==='bottom'&&y===a.height-1||side==='left'&&x===0||side==='right'&&x===a.width-1||!floor.has(to))return {kind:'wall'};
      if(side==='top'||side==='left')return {kind:'none'};
      const key=edgeKey(square,to);return {kind:a.doors[key]?'door':walls.has(key)?'wall':'none',key};
    }};
  }
  function surfaceGrid(a){const floor=new Set(a.floors),walls=new Set(a.walls);return {id:'surface',width:a.width,height:a.height,floor,edge:(x,y)=>{const k=edgeKey(x,y);return a.doors[k]?{kind:'door',key:k,...a.doors[k]}:walls.has(k)?{kind:'wall',key:k}:{kind:'none',key:k};},location:n=>({arenaId:'surface',environment:'surface',starshipId:'',square:n,mesh:4,stationed:false}),index:p=>p.square};}
  const layouts=new WeakMap();
  function shipGrid(record){const ship=record.ship||record;let cached=layouts.get(ship);const signature=JSON.stringify([ship.gridCells,ship.placements,ship.sicInventory?.map(i=>[i.id,i.type,i.rotation,i.exteriorRotation,i.stationLayout]),ship.zoneColumns,ship.zoneRows,ship.boredWalls]);if(!cached||cached.signature!==signature){cached={signature,layout:maps.buildLayout(ship)};layouts.set(ship,cached);}const layout=cached.layout,width=layout.columns*3,height=layout.rows*3;
    const location=n=>({starshipId:record.id,square:Math.floor(Math.floor(n/width)/3)*layout.columns+Math.floor(n%width/3),mesh:Math.floor(n/width)%3*3+n%width%3});
    const floor=cached.floor||(cached.floor=new Set());if(!floor.size)for(const square of layout.hull)for(let m=0;m<9;m++)floor.add((Math.floor(square/layout.columns)*3+Math.floor(m/3))*width+square%layout.columns*3+m%3);
    return {id:record.id,width,height,floor,location,index:p=>(Math.floor(p.square/layout.columns)*3+Math.floor((p.mesh??4)/3))*width+p.square%layout.columns*3+(p.mesh??4)%3,edge:(a,b)=>{const from=location(a),to=location(b);if(from.square===to.square)return {kind:'none'};const e=layout.edge(from.square,to.square);if(e.kind==='door'){const centered=Math.floor(a/width)===Math.floor(b/width)?Math.floor(from.mesh/3)===1:from.mesh%3===1;return centered?{...e,open:ship.doorStates?.[e.key]==='open'||ship.doorDamage?.[e.key]>=3}:{kind:'wall',key:e.key};}return e;}};
  }
  function grid(state,location){if(location?.arenaId==='surface'&&state.arena)return surfaceGrid(state.arena);const ship=state.starships?.find(s=>s.id===location?.starshipId);return ship?shipGrid(ship):null;}
  function position(unit){const action=unit?.timedAction;if(action?.kind==='move'&&action.routeSegment?.length){const progress=Math.max(0,Math.min(1,1-action.remaining/Math.max(.001,action.total)));const i=Math.floor(progress*action.routeSegment.length)-1;return i>=0?action.routeSegment[Math.min(i,action.routeSegment.length-1)]:action.startLocation||unit.location;}return unit?.location;}
  function straightRun(state,start,path){
    const g=grid(state,start);if(!g||!path.length)return {units:0,start};
    let from=start,direction=null,units=0,runStart=start;
    for(const to of path){const a=g.index(from),b=g.index(to),dx=b%g.width-a%g.width,dy=Math.floor(b/g.width)-Math.floor(a/g.width),next=dx+','+dy;
      if(dx||dy){if(next!==direction){units=0;runStart=from;direction=next;}units++;}from=to;
    }
    return {units,start:runStart,direction,end:from};
  }
  // Both map views use the same continuous path, heading and door pause timing.
  function movement(unit,coords,walking=true){
    const action=unit?.timedAction,route=action?.kind==='move'?action.routeSegment:[];
    if(!route?.length||!action.startLocation)return null;
    const step=Math.max(.001,Number(action.total)-(Number(action.doorDelay)||0))/route.length;
    let elapsed=Math.max(0,Number(action.total)-Number(action.remaining)),current=action.startLocation,heading=0;
    const openDoorKeys=new Set();
    for(const point of route){const from=coords(current),to=coords(point);heading=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI+90;
      if(point.doorKey){openDoorKeys.add(point.doorKey);if(elapsed<=.6)return {...from,openDoorKeys,heading,walking:false};elapsed-=.6;}
      if(elapsed<=step){const ratio=Math.max(0,Math.min(1,elapsed/step));return {x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio,openDoorKeys,heading,walking};}
      elapsed-=step;current=point;openDoorKeys.clear();
    }
    return {...coords(route.at(-1)),openDoorKeys,heading,walking:false};
  }
  function sameMap(a,b){return !!a&&!!b&&(a.arenaId==='surface'&&b.arenaId==='surface'||!!a.starshipId&&a.starshipId===b.starshipId);}
  function distance(state,a,b){const pa=position(a),pb=position(b);if(!sameMap(pa,pb))return null;const g=grid(state,pa);if(!g)return null;const x=g.index(pa),y=g.index(pb);return Math.hypot(x%g.width-y%g.width,Math.floor(x/g.width)-Math.floor(y/g.width));}
  function pass(g,a,b,walking=false){if(!g.floor.has(a)||!g.floor.has(b))return false;const e=g.edge(a,b);return e.kind!=='wall'&&(e.kind!=='door'||e.open||walking&&e.automatic&&e.override!==false);}
  // Traverse only interiors of crossed cells. A corner touch has zero area and
  // can pass on either side; this deliberately favors visibility at ambiguous corners.
  function ray(g,a,b,offset=0){let x=a%g.width,y=Math.floor(a/g.width),tx=b%g.width,ty=Math.floor(b/g.width);const dx=tx-x,dy=ty-y,sx=Math.sign(dx),sy=Math.sign(dy),ax=Math.abs(dx),ay=Math.abs(dy);let nx=ax?(.5-offset*sx)/ax:Infinity,ny=ay?(.5-offset*sy)/ay:Infinity;
    for(let n=0;n<g.width+g.height+4;n++){if(x===tx&&y===ty)return true;const from=y*g.width+x;
      if(Math.abs(nx-ny)<1e-8){const h=y*g.width+x+sx,v=(y+sy)*g.width+x,to=(y+sy)*g.width+x+sx;if(!((pass(g,from,h)&&pass(g,h,to))||(pass(g,from,v)&&pass(g,v,to))))return false;x+=sx;y+=sy;nx+=1/ax;ny+=1/ay;}
      else if(nx<ny){const to=y*g.width+x+sx;if(!pass(g,from,to))return false;x+=sx;nx+=1/ax;}
      else{const to=(y+sy)*g.width+x;if(!pass(g,from,to))return false;y+=sy;ny+=1/ay;}
    }return false;
  }
  function sight(g,a,b){if(a===b)return true;if(!g.floor.has(a)||!g.floor.has(b))return false;return ray(g,a,b)||ray(g,a,b,.2)||ray(g,a,b,-.2);}
  function visibleCell(g,a,b){if(g.floor.has(b))return sight(g,a,b);const ax=a%g.width,ay=Math.floor(a/g.width),bx=b%g.width,by=Math.floor(b/g.width),distance=Math.abs(bx-ax)+Math.abs(by-ay);return [[bx-1,by],[bx+1,by],[bx,by-1],[bx,by+1]].some(([x,y])=>x>=0&&x<g.width&&y>=0&&y<g.height&&Math.abs(x-ax)+Math.abs(y-ay)<distance&&sight(g,a,y*g.width+x));}
  function canTarget(state,a,b){const pa=position(a),pb=position(b);if(!sameMap(pa,pb))return true;const g=grid(state,pa);return !g||sight(g,g.index(pa),g.index(pb));}
  function route(a,start,end,occupied=[]){const g=surfaceGrid(a),blocked=new Set(occupied),parent=new Map([[start,null]]),queue=[start];if(!g.floor.has(end)||blocked.has(end))return null;for(let i=0;i<queue.length&&!parent.has(end);i++){const from=queue[i],x=from%g.width,y=Math.floor(from/g.width);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,to=ny*g.width+nx;if(nx<0||nx>=g.width||ny<0||ny>=g.height||parent.has(to)||blocked.has(to)||!pass(g,from,to,true))continue;parent.set(to,from);queue.push(to);}}if(!parent.has(end))return null;const result=[];for(let n=end;n!==start;n=parent.get(n))result.unshift(g.location(n));return result;}
  function step(a,from,to){const g=surfaceGrid(a);return Math.abs(from.square%g.width-to.square%g.width)+Math.abs(Math.floor(from.square/g.width)-Math.floor(to.square/g.width))===1&&pass(g,from.square,to.square,true);}
  function deploy(a,units){const used=new Set();for(const unit of units){const key=unit.characterId||unit.preparationUnitId||unit.id;let square=a.spawns[key]??unit.location?.square;if(!a.floors.includes(square)||used.has(square))square=a.floors.find(n=>!used.has(n));if(square===undefined)throw Error('Add more floor squares: each combatant needs a starting square.');used.add(square);unit.location=surfaceGrid(a).location(square);}return units;}
  function doors(room){if(!room.arena)return;const a=room.arena,positions=room.units.map(position).filter(p=>p?.arenaId==='surface').map(p=>p.square);for(const [key,d]of Object.entries(a.doors)){if(d.hits>=3){d.open=true;continue;}if(!d.automatic)continue;const cells=key.split(':').map(Number);d.open=typeof d.override==='boolean'?d.override:positions.some(p=>cells.some(c=>Math.abs(p%a.width-c%a.width)+Math.abs(Math.floor(p/a.width)-Math.floor(c/a.width))<=1));}}
  const fogCache=new WeakMap();
  function updateFog(room){doors(room);room.fog||={enabled:false,explored:{},forced:{},memory:{}};const fog=room.fog;fog.explored||={};fog.forced||={};fog.memory||={};
    if(!fog.enabled){fogCache.delete(room);room.visibility={};return;}
    const pcs=room.units.filter(u=>u.team==='pc'&&!u.defeatedAt);
    const key=JSON.stringify([pcs.map(u=>position(u)),room.arena,(room.starships||[]).map(s=>[s.id,s.ship.gridCells,s.ship.placements,s.ship.doorStates,s.ship.doorDamage]),fog.forced]);if(fogCache.get(room)===key)return;fogCache.set(room,key);room.visibility={};const grids=[];if(room.arena)grids.push(surfaceGrid(room.arena));for(const ship of room.starships||[])grids.push(shipGrid(ship));
    for(const g of grids){const visible=new Set((fog.forced[g.id]||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<g.width*g.height));for(const pc of pcs){const p=position(pc);if((p?.arenaId||p?.starshipId)!==g.id)continue;const index=g.index(p),x=index%g.width,y=Math.floor(index/g.width);for(let yy=Math.max(0,y-15);yy<=Math.min(g.height-1,y+15);yy++)for(let xx=Math.max(0,x-15);xx<=Math.min(g.width-1,x+15);xx++){const n=yy*g.width+xx;if(Math.abs(xx-x)+Math.abs(yy-y)<=15&&visibleCell(g,index,n))visible.add(n);}}
      const explored=new Set(fog.explored[g.id]||[]);for(const n of visible)explored.add(n);fog.explored[g.id]=[...explored];const memory=fog.memory[g.id]||={doors:{}};const doorStates=g.id==='surface'?Object.fromEntries(Object.entries(room.arena.doors).map(([k,d])=>[k,d.open?'open':'closed'])):room.starships.find(s=>s.id===g.id)?.ship.doorStates||{};
      for(const [k,v]of Object.entries(doorStates)){const [a,b]=k.split(':').map(Number);const seen=g.id==='surface'?visible.has(a)||visible.has(b):[...visible].some(n=>[a,b].includes(g.location(n).square));if(seen)memory.doors[k]=v;}
      room.visibility[g.id]={width:g.width,height:g.height,visible:[...visible],explored:[...explored],forced:[...(fog.forced[g.id]||[])]};
    }
  }
  function isVisible(state,unit){if(!state.fog?.enabled)return true;const p=position(unit),g=grid(state,p);if(!g)return true;return !!state.visibility?.[g.id]?.visible.includes(g.index(p));}
  function project(data,viewer){if(viewer?.gm)return data;if(!data.fog?.enabled)return {...data,fog:{enabled:false}};const hidden=data.units.filter(u=>u.team!=='pc'&&!isVisible(data,u)),ids=new Set(hidden.map(u=>u.id));const result={...data,units:data.units.filter(u=>!ids.has(u.id)),fog:{enabled:true},log:(data.log||[]).filter(l=>!hidden.some(u=>u.characterName&&l.text?.includes(u.characterName))),demoAutomation:(data.demoAutomation||[]).filter(u=>!ids.has(u.id))};
    if(ids.has(result.activeId)){result.activeId=null;result.activeAction=null;result.commandRemaining=null;}const allowedMaps=new Set(['surface',...(data.starships||[]).map(s=>s.id)]);result.visibility=copy(Object.fromEntries(Object.entries(data.visibility||{}).filter(([id])=>allowedMaps.has(id))));
    if(data.arena){result.arena=copy(data.arena);const v=new Set(data.visibility?.surface?.visible||[]),e=new Set(data.visibility?.surface?.explored||[]);result.arena.floors=result.arena.floors.filter(n=>e.has(n));result.arena.spawns={};result.arena.walls=result.arena.walls.filter(k=>k.split(':').some(n=>e.has(Number(n))));result.arena.doors=Object.fromEntries(Object.entries(result.arena.doors).filter(([k])=>k.split(':').some(n=>e.has(Number(n)))).map(([k,d])=>[k,k.split(':').some(n=>v.has(Number(n)))?d:{...d,open:data.fog.memory?.surface?.doors?.[k]==='open',override:undefined}]));}
    result.starships=(data.starships||[]).map(s=>{const memory=data.fog.memory?.[s.id]?.doors;if(!memory)return s;const g=shipGrid(s),seen=new Set((data.visibility?.[s.id]?.visible||[]).map(n=>g.location(n).square));return {...s,ship:{...s.ship,doorStates:Object.fromEntries(Object.entries(s.ship.doorStates||{}).map(([k,v])=>[k,k.split(':').some(n=>seen.has(Number(n)))?v:memory[k]||'closed']))}};});return result;
  }
  function wallTargets(state,unit){
    const g=grid(state,position(unit));if(!g)return [];const start=g.index(position(unit)),targets=new Map();
    for(const a of g.floor){if(!sight(g,start,a))continue;for(const b of [a-1,a+1,a-g.width,a+g.width]){
      if(b<0||b>=g.width*g.height||Math.abs(a-b)===1&&Math.floor(a/g.width)!==Math.floor(b/g.width))continue;
      const boundary=g.edge(a,b),blocked=!g.floor.has(b);
      if(!blocked&&boundary.kind!=='wall'&&!(boundary.kind==='door'&&!boundary.open))continue;
      const near=g.location(a),far=g.location(b),surface=g.id==='surface';
      if(!surface&&!g.floor.has(b))continue;
      const key=surface?edgeKey(a,b):maps.doorKey(near.square,far.square),d=Math.hypot(a%g.width-start%g.width,Math.floor(a/g.width)-Math.floor(start/g.width));if(d>15||targets.has(key))continue;
      targets.set(key,{id:'wall:'+g.id+':'+key,characterName:'Wall '+key,location:near,distance:d,wallTarget:{arenaId:surface?'surface':'',shipId:surface?'':g.id,key,openSquare:surface&&blocked?b:null}});
    }}return [...targets.values()].sort((a,b)=>a.distance-b.distance);
  }
  function boreWall(state,target){
    if(target.arenaId==='surface'){
      state.arena.walls=state.arena.walls.filter(k=>k!==target.key);delete state.arena.doors[target.key];
      if(target.openSquare!=null&&!state.arena.floors.includes(target.openSquare))state.arena.floors.push(target.openSquare);
    }else{const ship=state.starships.find(s=>s.id===target.shipId)?.ship;if(ship){ship.boredWalls=[...new Set([...(ship.boredWalls||[]),target.key])];}}
  }
  return {wallTargets,boreWall,themes,boundaryLayout,normalize,expand,edgeKey,surfaceGrid,shipGrid,grid,position,straightRun,movement,distance,sight,canTarget,route,step,deploy,doors,updateFog,isVisible,project};
});
