const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function decorationFixture(){
 let callback,frames=[],figure=false,writes=0;const classes=new Set();
 const token={nodeType:1,dataset:{tokenRace:'human',tokenVariant:'0'},title:'Mara',textContent:'M',style:{left:'0',top:'0'},
  classList:{contains:n=>classes.has(n),add:n=>classes.add(n),toggle(n,on){on?classes.add(n):classes.delete(n);}},
  matches:s=>s.includes('.combat-token'),closest:()=>token,querySelector:()=>figure?{remove(){figure=false;}}:null,
  setAttribute(){},set innerHTML(v){figure=v.includes('crew-figure');writes++;}};
 const document={body:{},querySelectorAll:s=>s==='.sa-room-oxygen'?[]:[token]};
 const window={addEventListener(){},SATokenArt:{atlas:()=>true,variant:n=>Number(n),figure:()=>'<span class="crew-figure"></span>'}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../crew-tokens.js'),'utf8'),{document,window,MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){}},requestAnimationFrame:fn=>frames.push(fn)});
 return {token,replace(){figure=false;callback([{type:'childList',target:token,addedNodes:[],removedNodes:[]}]);},flush(){const batch=frames;frames=[];batch.forEach(fn=>fn());},queued:()=>frames.length,writes:()=>writes,hasFigure:()=>figure,notifyOwnInsertion(){callback([{type:'childList',target:token,addedNodes:[{nodeType:1,matches:()=>false,querySelector:()=>null}],removedNodes:[]}]);}};
}
test('replaced character children recover their canonical artwork without an observer loop',()=>{
 const f=decorationFixture();assert.ok(f.hasFigure());
 f.replace();f.replace();assert.equal(f.queued(),1);f.flush();assert.ok(f.hasFigure());assert.equal(f.writes(),2);
 f.notifyOwnInsertion();assert.equal(f.queued(),0);
 f.replace();f.flush();assert.ok(f.hasFigure());assert.equal(f.writes(),3);
});

test('security droid location markers retain their dedicated artwork instead of a human fallback',()=>{
 const f=decorationFixture();f.token.dataset.securityDroid='true';f.replace();f.flush();assert.equal(f.hasFigure(),false);assert.equal(f.queued(),0);
});

function confirmFixture(){
 const source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
 const body=source.slice(source.indexOf('  function positionMoveConfirm('),source.indexOf('  function positionInlineConfirm('));
 const preview={locked:true,path:[1],color:'green',square:1,mesh:4},context={interaction:'move',moveSubmitting:false,preview,confirmHomes:new WeakMap()};vm.createContext(context);vm.runInContext(body,context);
 let submitted=0;const children=[];const original={isConnected:true,insertBefore(b){b.parentElement=this;if(!children.includes(b))children.push(b);}};
 const button={ownerDocument:{createElement(){return {dataset:{},setAttribute(){},addEventListener(type,fn){this.click=fn;},remove(){children.splice(children.indexOf(this),1);}};}},click(){if(!this.disabled&&!context.moveSubmitting)submitted++;},parentElement:original,nextSibling:null,disabled:false,hidden:false,textContent:'Confirm Move',classList:{toggle(){}},style:{removeProperty(n){delete this[n];}},setAttribute(){}};
 let controlsTop=null;const host={querySelector:()=>controlsTop===null?null:{getBoundingClientRect:()=>({top:controlsTop})},offsetWidth:400,append(b){b.parentElement=this;},getBoundingClientRect:()=>({left:0,top:0,width:400})};
 const viewport={style:{getPropertyValue:()=>80},getBoundingClientRect:()=>({left:0,top:0,right:400,bottom:400}),querySelector:()=>({getBoundingClientRect:()=>({left:380,right:400,top:300,height:20})})};
 return {button,preview,context,original,bottom:()=>children.find(b=>b.dataset?.bottomConfirmMove!==undefined),submitted:()=>submitted,controlsAt:y=>controlsTop=y,hideTarget:()=>viewport.querySelector=()=>null,place:()=>context.positionMoveConfirm(host,button,viewport)};
}
test('destination confirmation remains inside the map above its controls and hides invalid selections',()=>{
 const f=confirmFixture();f.place();assert.equal(f.button.hidden,false);assert.ok(parseFloat(f.button.style.left)+56<=380);assert.ok(parseFloat(f.button.style.top)+56<=320);
 f.controlsAt(260);f.place();assert.ok(parseFloat(f.button.style.top)+56<=252);
 f.preview.color='red';f.place();assert.equal(f.button.hidden,true);
 f.preview.color='green';f.preview.locked=false;f.place();assert.equal(f.button.hidden,true);
});
test('leaving movement restores the existing confirmation control to its owner',()=>{
 const f=confirmFixture();f.place();f.context.interaction='relocate';f.place();assert.equal(f.button.parentElement,f.original);assert.equal(f.button.hidden,false);assert.equal(f.button.style.left,undefined);
 assert.equal(f.bottom(),undefined);
});

test('bottom confirmation stays available with the circle and shares its guarded submission',()=>{
 const f=confirmFixture();f.place();const bottom=f.bottom();assert.ok(bottom);assert.equal(bottom.textContent,'Confirm Move');assert.equal(bottom.disabled,false);
 f.place();assert.equal(f.bottom(),bottom);bottom.click();assert.equal(f.submitted(),1);
 f.context.moveSubmitting=true;f.place();assert.equal(bottom.disabled,true);bottom.click();assert.equal(f.submitted(),1);
 f.context.moveSubmitting=false;f.preview.color='red';f.place();assert.equal(bottom.disabled,true);
 f.preview.color='green';f.preview.locked=false;f.place();assert.equal(bottom.disabled,true);
 f.preview.locked=true;f.place();assert.equal(bottom.disabled,false);
 f.hideTarget();f.place();assert.equal(f.button.hidden,true);assert.equal(bottom.disabled,false);bottom.click();assert.equal(f.submitted(),2);
});

function stationExitFixture(){
 const source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
 const unit={id:'u',turnSerial:7,location:{stationed:true}},state={activeId:'u',units:[unit]};
 let calls=0,closed=0,resolve,reject;
 const context={moveSubmitting:false,moveError:'',combatState:state,document:{},status:{},selectedUnit:()=>unit,
  renderInlineMaps(){},requestAppRender(){},close(){closed++;context.moveSubmitting=false;},
  bridge:()=>({state:()=>state,action:payload=>{assert.equal(payload.kind,'getUp');assert.equal(payload.turnSerial,7);calls++;return new Promise((a,b)=>{resolve=a;reject=b;});}})};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function stationExitAvailable('),source.indexOf('  async function submitSelectedMove(')),context);
 return {context,unit,state,calls:()=>calls,closed:()=>closed,send:()=>context.submitStationExit(),reject:()=>reject(Error('Turn changed; retry.')),accept(){unit.location.stationed=false;resolve();},unconfirmed:()=>resolve()};
}
test('station exit sends once, keeps a rejection visible, and retries without changing location',async()=>{
 const f=stationExitFixture(),first=f.send();await f.send();assert.equal(f.calls(),1);assert.equal(f.closed(),0);
 f.reject();await first;assert.match(f.context.moveError,/Turn changed/);assert.equal(f.unit.location.stationed,true);assert.equal(f.closed(),0);
 const retry=f.send();f.accept();await retry;assert.equal(f.calls(),2);assert.equal(f.closed(),1);
});
test('station exit cannot close on an unconfirmed response or bypass pending actions',async()=>{
 const f=stationExitFixture(),pending=f.send();f.unconfirmed();await pending;assert.equal(f.closed(),0);assert.match(f.context.moveError,/not confirmed/);
 for(const key of ['delayedAction','delayTimer','timedAction','shieldRestabilizing','shipAi']){f.unit[key]=true;await f.send();delete f.unit[key];}
 f.state.activeId='other';await f.send();assert.equal(f.calls(),1);
});

test('legacy Fit uses final usable viewport dimensions and ignores hidden maps',()=>{
 const source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');let size;const viewport={clientWidth:0,clientHeight:0},grid={parentElement:viewport,style:{setProperty:(k,v)=>size=v}},ship={ship:{gridCells:[125,126,145,146]}};
 const c={grid,selectedShip:()=>ship,layoutFor:()=>({footprint:new Map()}),window:{SAShipMap:{triangleCells:()=>[],gridColumns:()=>20}}};
 vm.runInNewContext(source.slice(source.indexOf('  function fitShip() {'),source.indexOf("  window.addEventListener('sa-combat-reset'"))+';this.fit=fitShip',c);
 c.fit();assert.equal(size,undefined);viewport.clientWidth=400;viewport.clientHeight=140;c.fit();assert.equal(size,'52px');viewport.clientHeight=220;c.fit();assert.equal(size,'92px');
});

function legacyFocusFixture(){
 const source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8'),body={},outside={},old={dataset:{mapSquare:'125',mapMesh:'0'},isConnected:true};let focused=null,redirect=false;
 const document={body,activeElement:old},replacement={dataset:{mapSquare:'125',mapMesh:'0'},focus(options){focused={node:'cell',options};document.activeElement=this;}};
 let cells=[replacement];const grid={contains:n=>n===old,querySelectorAll:()=>cells,focus(options){focused={node:'grid',options};document.activeElement=this;},set innerHTML(v){old.isConnected=false;if(document.activeElement===old)document.activeElement=redirect?outside:body;}};
 const context={document,grid,dialog:{classList:{contains:()=>false}}};vm.runInNewContext(source.slice(source.indexOf('  function replaceLegacyGrid('),source.indexOf('  function renderGrid()')),context);
 return {run:()=>context.replaceLegacyGrid('replacement'),focused:()=>focused,remove:()=>cells=[],outside:()=>document.activeElement=outside,redirect:()=>redirect=true,grid};
}
test('legacy redraw restores the same cell without scrolling and keeps Escape within the dialog',()=>{const f=legacyFocusFixture();f.run();assert.equal(f.focused().node,'cell');assert.equal(f.focused().options.preventScroll,true);});
test('legacy removed-cell focus falls back to the map without selecting another destination',()=>{const f=legacyFocusFixture();f.remove();f.run();assert.equal(f.focused().node,'grid');assert.equal(f.grid.tabIndex,-1);});
test('legacy redraw never steals external or independently redirected focus',()=>{for(const mode of ['outside','redirect']){const f=legacyFocusFixture();f[mode]();f.run();assert.equal(f.focused(),null);}});

test('hidden legacy map skips DOM rebuild and geometry, then refreshes when opened',()=>{
 const source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');let hidden=true,clears=0,positions=0,reads=0;
 const c={dialog:{classList:{contains:()=>hidden},querySelector(){reads++;return null;}},confirm:{},grid:{parentElement:{}},selectedShip:()=>null,replaceLegacyGrid:v=>{assert.equal(v,'');clears++;},positionMoveConfirm(){positions++;}};
 vm.runInNewContext(source.slice(source.indexOf('  function renderGrid() {'),source.indexOf('  function statValue('))+source.slice(source.indexOf('  function positionLegacyConfirm()'),source.indexOf('  function positionInlineConfirm(')),c);
 c.renderGrid();c.positionLegacyConfirm();assert.equal(clears,0);assert.equal(reads,0);assert.equal(positions,0);
 hidden=false;c.renderGrid();c.positionLegacyConfirm();assert.equal(clears,1);assert.equal(reads,1);assert.equal(positions,1);
});
