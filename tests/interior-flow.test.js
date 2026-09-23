const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function functionFrom(file,name,next,context={}){
 const source=fs.readFileSync(require.resolve('../'+file),'utf8');
 const start=source.indexOf('function '+name+'('),end=source.indexOf('function '+next+'(',start);
 vm.runInNewContext(source.slice(start,end),context);return context[name];
}
const fit=functionFrom('starship.js','fittedInteriorView','fitShipToViewport');
function bounds(columns,x,y,w,h){return Array.from({length:w*h},(_,i)=>(y+Math.floor(i/w))*columns+x+i%w);}
test('fitting an expanded construction zone preserves the same physical hull size',()=>{
 const regular=fit(bounds(20,2,2,10,12),20,20,{width:600,height:600},true);
 const expanded=fit(bounds(60,22,22,10,12),60,60,{width:600,height:600},true);
 assert.equal(regular.zoom,expanded.zoom);
 assert.ok(regular.zoom*600/20*12<600);
 assert.notEqual(regular.panX,expanded.panX);
});
test('interior fit shows the whole ship and bounds a tiny ship’s tile size',()=>{
 const tall=fit(bounds(20,3,0,10,20),20,20,{width:600,height:600},true);
 assert.ok(tall.zoom*600/20*20<600);
 const tiny=fit([0],20,20,{width:900,height:900},true);
 assert.ok(tiny.zoom*900/20<=96);
 assert.equal(fit([],20,20,{width:600,height:600},false).zoom,1);
});
test('interior detail fitting uses less construction margin without hiding hull edges',()=>{
 const cells=bounds(20,4,4,7,9),view={width:700,height:700};
 const details=fit(cells,20,20,view,true),builder=fit(cells,20,20,view,false);
 assert.ok(details.zoom>builder.zoom);
 assert.ok(details.zoom*700/20*9<700);
});
const activity=functionFrom('character.js','combatTabActivity','renderCombatTabAttention');
function encounter(extra={},unit={}){return {running:true,units:[{id:'nova-unit',characterId:'nova',currentHp:30,...unit}],...extra};}
test('Combat tab attention distinguishes advancing ATB from a waiting decision',()=>{
 assert.equal(activity(encounter(),'nova'),'running');
 assert.equal(activity(encounter({activeId:'nova-unit',pausedForTurn:true}),'nova'),'ready');
 assert.equal(activity(encounter({hardPaused:true}),'nova'),'');
 assert.equal(activity(encounter({pausedForTurn:true,activeId:'enemy'}),'nova'),'');
});
test('Combat tab does not demand attention from inactive or deliberately held characters',()=>{
 for(const state of [encounter({practice:true}),encounter({encounterEndedAt:1}),encounter({}, {consoleHold:{}}),encounter({}, {currentHp:0}),encounter({}, {defeatedAt:1})])assert.equal(activity(state,'nova'),'');
 assert.equal(activity(encounter(),'other-pc'),'');
 assert.equal(activity(encounter({rollPaused:true},{pendingShipRolls:[{id:'roll'}]}),'nova'),'ready');
});
test('inline fit uses available vertical room and resets scrolling, including expanded view',()=>{
 const style=new Map(),viewport={clientWidth:1500,clientHeight:600,scrollLeft:60,scrollTop:200};
 const grid={style:{getPropertyValue:k=>k==='--inline-cols'?14:18,setProperty:(k,v)=>style.set(k,v)}};
 const host={dataset:{inlineShipMap:'ship'},querySelector:s=>s==='.inline-map-viewport'?viewport:grid};
 const views=new Map(),expanded={host,dialog:{style:grid.style},cellSize:96};
 const fitting=functionFrom('ship-combat-map.js','fitInline','watchFit',{inlineZoom:views,expandedMap:expanded,manualInlineViews:new WeakSet([host]),interaction:'view',selectedShipId:''});
 fitting(host);assert.ok(expanded.cellSize>31);assert.ok(expanded.cellSize*18<600);
 assert.equal(viewport.scrollLeft,0);assert.equal(viewport.scrollTop,0);assert.ok(style.has('--expanded-cell-size'));
});

test('crew movement fits every walkable hull row while leaving exterior equipment scrollable',()=>{
 const styles=new Map(),viewport={clientWidth:1200,clientHeight:420,scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0})};
 const grid={dataset:{hullColumn:'2',hullRow:'4',hullColumns:'14',hullRows:'14'},style:{getPropertyValue:k=>k==='--inline-cols'?18:20,setProperty:(k,v)=>styles.set(k,v)},getBoundingClientRect:()=>({left:12,top:12})};
 const host={dataset:{inlineShipMap:'ship'},querySelector:s=>s==='.inline-map-viewport'?viewport:grid};
 const views=new Map();
 const fitting=functionFrom('ship-combat-map.js','fitInline','watchFit',{inlineZoom:views,expandedMap:null,manualInlineViews:new WeakSet(),interaction:'move',selectedShipId:'ship'});
 fitting(host);
 const size=views.get('ship');
 assert.equal(size,(420-32)/14);
 assert.ok(size>(420-32)/20);
 const hullTop=12+4*size-viewport.scrollTop;
 assert.ok(hullTop>=0);assert.ok(hullTop+14*size<=420);
 assert.ok(viewport.scrollTop>0);
});

const moveHeight=functionFrom('ship-combat-map.js','movementCanvasHeight','movementScreen');
test('move map budgets the top-level viewport so toolbar and confirmation fit together',()=>{
 assert.equal(moveHeight(720,63,94,126),409);
 assert.ok(moveHeight(720,63,94,126)+63+94+126<720);
 assert.equal(moveHeight(1080,63,94,126),620);
 assert.equal(moveHeight(400,63,130,150),200);
});

test('movement framing translates through nested iframe offsets and reserves the PC HUD',()=>{
 const bar={getClientRects:()=>[1],getBoundingClientRect:()=>({height:55})};
 const root={document:{querySelectorAll:()=>[bar]},getComputedStyle:()=>({position:'sticky',top:'0px'}),frameElement:null};
 const parent={parent:root,document:{querySelectorAll:()=>[]},frameElement:{clientTop:1,getBoundingClientRect:()=>({top:90})}};
 const child={parent,document:{querySelectorAll:()=>[]},frameElement:{clientTop:2,getBoundingClientRect:()=>({top:150})}};
 const screen=functionFrom('ship-combat-map.js','movementScreen','fitMoveToScreen',{window:child});
 const result=screen({getBoundingClientRect:()=>({top:400})});
 assert.equal(result.owner,root);assert.equal(result.top,643);assert.equal(result.obstruction,63);
});
