const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('visual-only typing factory preserves original artwork and has no feedback timers or handlers',()=>{
 const nodes=[],styles=[];const element=()=>({dataset:{},setAttribute(k,v){this[k]=v;},append(n){n.parentElement=this;},remove(){this.removed=true;}});
 const doc={currentScript:{hasAttribute:n=>n==='data-typing-visual-only'},head:{append:n=>styles.push(n)},createElement:()=>{const n=element();nodes.push(n);return n;}};
 const root={};vm.runInNewContext(fs.readFileSync(require.resolve('../console-feedback'),'utf8'),{window:root,document:doc,setInterval(){throw Error('Visual-only must not create a timer');}});
 assert.equal(nodes.length,0,'loading visual-only mode is side-effect free');const visual=root.SAConsoleTypingVisual.create(doc),icon=nodes.find(n=>n.className==='console-typing-indicator'),view=element();
 assert.equal(require('node:crypto').createHash('sha256').update(icon.innerHTML).digest('hex'),'2b96e66ff14c73db1838901ce4106c9483362259c468f388ef74c741234de9ae','original hands/keyboard SVG bytes');
 assert.equal(require('node:crypto').createHash('sha256').update(styles[0].textContent).digest('hex'),'73434692f36a520783474baa9a1c195f3147b788babc93de766808c0d5e454b6','original geometry, colors and animation CSS bytes');
 assert.match(styles[0].textContent,/console-keypress \.36s/);assert.match(styles[0].textContent,/animation-delay:-\.18s/);assert.match(styles[0].textContent,/prefers-reduced-motion:reduce/);
 visual.update(null,false,false);assert.equal(icon.hidden,true);visual.update(view,true,true);assert.equal(icon.hidden,false);assert.equal(icon.dataset.running,'true');assert.equal(icon.parentElement,view);
 visual.update(view,true,false);assert.equal(icon.dataset.running,'false');assert.equal(icon['aria-label'],'Console input paused');visual.update(null,false,false);assert.equal(icon.hidden,true);
 const next=element();visual.update(next,true,true);assert.equal(icon.parentElement,next);assert.equal(nodes.filter(n=>n.className==='console-typing-indicator').length,1);visual.destroy();assert.ok(icon.removed);assert.ok(styles[0].removed);
});

test('navigation input uses the existing engine sound and stops on pause, mute or disconnect',()=>{
 let tick,starts=0,stops=0,enabled=true;
 const element=()=>({dataset:{},classList:{contains:()=>false},setAttribute(){},append(){},remove(){},textContent:''});
 const view=element(),notice=element();view.dataset.operatorId='pilot';view.querySelector=()=>notice;
 const doc={defaultView:{},hidden:false,head:{append(){}},createElement:element,addEventListener(){},querySelector:()=>view};
 const unit={id:'pilot',atb:0,delayedAction:{remaining:50,shipOrder:{}}};
 let state={units:[unit],starships:[],running:true,threshold:100};
 const bridge={state:()=>state,myUnitId:()=>unit.id,soundEnabled:()=>enabled,startEngineCharge:()=>{starts++;return {update(){},stop(){stops++;}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../console-feedback'),'utf8'),{document:doc,window:{SACombatBridge:bridge,addEventListener(){}},setInterval:fn=>{tick=fn;return 1;},performance:{now:()=>0}});
 tick();tick();assert.equal(starts,1,'One sustained engine voice, not repeated voices');
 state.hardPaused=true;tick();assert.equal(stops,1);
 state.hardPaused=false;tick();assert.equal(starts,2);
 enabled=false;tick();assert.equal(stops,2);
 enabled=true;tick();assert.equal(starts,3);
 state=null;assert.doesNotThrow(tick);assert.equal(stops,3);
});

test('shared sensor feedback owns one clipped sweep and only the confirmed sensor delay',()=>{
 let now=0,reduced=false,pings=0,stops=0,observers=0,mutation;const listeners={},nodes=[];
 const rect={left:0,top:0,right:400,bottom:240};
 const el=()=>({style:{},dataset:{},setAttribute(){},getBoundingClientRect:()=>rect,append(n){n.parentElement=this;},remove(){this.parentElement=null;},animate(){const a={playState:'running',currentTime:0,play(){this.playState='running';},pause(){this.playState='paused';},cancel(){this.playState='idle';}};this.animation=a;return a;}});
 const map=el();map.querySelector=()=>({getBoundingClientRect:()=>rect});const view={open:true,classList:{contains:()=>true},querySelector:()=>map};
 const doc={hidden:false,currentScript:{hasAttribute:()=>true},defaultView:{performance:{now:()=>now},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}disconnect(){}},matchMedia:()=>({matches:reduced}),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){observers++;}disconnect(){observers--;}}},createElement(){const n=el();nodes.push(n);return n;},addEventListener(k,fn){listeners[k]=fn;},removeEventListener(k){delete listeners[k];}};
 const root={};vm.runInNewContext(fs.readFileSync(require.resolve('../console-feedback'),'utf8'),{window:root,document:doc});let volume=1;const c=root.SAConsoleScanFeedback.create(doc,{level:()=>volume,sensorPing(){pings++;return {stop(){stops++;}};}}),state={running:true},unit={};
 const update=()=>c.update(view,unit,state,{soundEnabled:true});update();assert.equal(nodes.length,0);
 for(const kind of ['area','hex','life','analysis','share']){unit.delayedAction={sensorOrder:{kind}};update();assert.equal(observers,1);assert.equal(nodes.at(-2).style.width,'400px');assert.ok(parseFloat(nodes.at(-1).style.width)>Math.hypot(400,240));const rotor=nodes.at(-1);assert.match(rotor.style.cssText,/conic-gradient/);update();assert.equal(nodes.at(-1),rotor);state.hardPaused=true;update();assert.equal(rotor.animation.playState,'paused');state.hardPaused=false;update();assert.equal(rotor.animation.playState,'running');unit.delayedAction.awaitingRoll=true;update();assert.equal(observers,0);assert.equal(rotor.parentElement.parentElement,null);}
 unit.delayedAction={sensorOrder:{kind:'hex'}};update();const rotor=nodes.at(-1);reduced=true;update();assert.equal(rotor.animation.playState,'paused');assert.equal(rotor.animation.currentTime,0);reduced=false;volume=0;update();const before=pings;now+=2000;update();assert.equal(pings,before);volume=1;update();assert.ok(pings>before);listeners.close({target:view});assert.equal(observers,0);update();assert.equal(observers,1);c.update(view,unit,state,{offline:true,soundEnabled:true});assert.equal(observers,0);unit.delayedAction=null;unit.queuedEffects=[{sensorReport:{}}];update();assert.equal(observers,0);unit.delayedAction={sensorOrder:{kind:'hex'}};update();assert.equal(observers,1);const priorStops=stops;view.dataset={selectHex:'true'};mutation();assert.equal(observers,0,'selection clears old scan before next host tick');assert.ok(stops>priorStops);update();assert.equal(observers,0,'stale delay cannot restart feedback in selection');view.dataset.selectHex='false';update();assert.equal(observers,1);view.open=false;mutation();assert.equal(observers,0);c.destroy();assert.deepEqual(listeners,{});assert.ok(stops>0);
});
