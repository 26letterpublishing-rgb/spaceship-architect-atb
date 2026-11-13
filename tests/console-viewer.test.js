const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{fixture,power}=require('../console-viewer');
test('viewer tiers are isolated in-memory fixtures with reversible power',()=>{for(let n=1;n<=9;n++){const a=fixture(n),b=fixture(n);power(a,false);assert.equal(a.starships[0].ship.sicInventory[0].disabled,true);assert.equal(b.starships[0].ship.sicInventory[0].disabled,undefined);power(a,true);assert.equal(a.starships[0].ship.sicInventory[0].status,'online');assert.equal(a.practice,undefined);assert.equal(a.catalogPreview,undefined);}assert.throws(()=>fixture(10));});
test('viewer blocks connections and excludes application campaign bootstrapping',()=>{const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8');assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/src="app\.js|ship-roll-ui\.js/);});

test('viewer opts into original typing visuals only and owns their lifecycle in its existing timer',()=>{
 const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8'),js=fs.readFileSync(require.resolve('../console-viewer.js'),'utf8');
 assert.equal((html.match(/src="console-feedback.js" data-typing-visual-only/g)||[]).length,1);
 assert.ok(html.indexOf('src="console-feedback.js"')<html.lastIndexOf('src="console-viewer.js"'));
 assert.equal((js.match(/setInterval\(/g)||[]).length,1);assert.match(js,/typingVisual.destroy\(\)/);
 assert.match(js,/!unit.delayedAction.awaitingRoll/);assert.match(js,/view&&!offline/);assert.doesNotMatch(js,/startEngineCharge|console-keypress|typing-hand/,'no duplicate artwork or unrelated feedback integration');
});
test('viewer reuses the trusted shared click handler before capture guards and opts in to media only in memory',()=>{
 const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8'),js=fs.readFileSync(require.resolve('../console-viewer.js'),'utf8');
 assert.equal((html.match(/src="audio-controls.js"/g)||[]).length,1);
 assert.ok(html.indexOf('src="audio-mix.js"')<html.indexOf('src="audio-controls.js"'));
 assert.ok(html.indexOf('src="audio-controls.js"')<html.indexOf('src="console-common.js"'));
 assert.ok(html.indexOf('src="audio-controls.js"')<html.lastIndexOf('src="console-viewer.js"'));
 assert.match(js,/SAAudioMixOptions=\{clipTransport:'media'\}/);assert.match(js,/mix.stopButtonSound\(\)/);assert.doesNotMatch(js,/buttonSound\(/,'no competing viewer click sound handler');
});
const vm=require('node:vm');
test('all Console catalog entries have independent visual fixtures and real station routes',()=>{
 const v=require('../console-viewer'),maps=require('../ship-map-core'),stations=require('../station-access');
 const expected=Object.entries(maps.catalog).filter(([,d])=>d.shipControl||d.shield||d.sensor||d.weapon||d.lockOn||d.utility||d.hacking).map(([id])=>id);
 assert.deepEqual(v.catalog.filter(e=>!e.baseType).map(e=>e.id),expected);assert.deepEqual(v.catalog.filter(e=>e.baseType).map(e=>[e.id,e.baseType]),[['science-lab-printer','science-lab'],['science-lab-processor','science-lab']]);assert.equal(new Set(expected).size,131);
 for(const e of v.catalog){assert.ok(e.subroute);if(['sensor','lock'].includes(e.route))continue;const a=v.visualFixture(e.id),b=v.visualFixture(e.id);assert.equal(stations.access(a,a.units[0],'preview').item.type,e.baseType||e.id);assert.equal(a.visualOnly,true);power(a,false);assert.equal(b.starships[0].ship.sicInventory[0].disabled,undefined);power(a,true);assert.equal(a.starships[0].ship.sicInventory[0].status,'online');}
});
const mixerSource=fs.readFileSync(require.resolve('../audio-mix'),'utf8');
function audioFixture(){
 const calls=[];let id=0;
 const param=name=>({value:0,setValueAtTime:(...a)=>calls.push([name,'set',...a]),linearRampToValueAtTime:(...a)=>calls.push([name,'linear',...a]),exponentialRampToValueAtTime:(...a)=>calls.push([name,'exp',...a])});
 const node=kind=>{const name=kind+(++id);return {name,gain:param(name),frequency:param(name),threshold:{},knee:{},ratio:{},attack:{},release:{},connect:n=>calls.push([name,'connect',n.name]),disconnect:()=>calls.push([name,'disconnect']),start:t=>calls.push([name,'start',t]),stop:t=>calls.push([name,'stop',t])};};
 const c={currentTime:4,destination:{name:'output'},createOscillator:()=>node('osc'),createGain:()=>node('gain'),createDynamicsCompressor:()=>node('compressor'),createWaveShaper:()=>node('limiter')};
 const memory=new Map(),root={SABrowserStorage:{local:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}},localStorage:{getItem(){throw Error('personal storage read');},setItem(){throw Error('personal storage write');}},addEventListener(){},dispatchEvent(){},CustomEvent:class{},document:{addEventListener(){},querySelectorAll:()=>[]}};
 vm.runInNewContext(mixerSource,root);return {calls,c,root,mix:root.SAAudioMix};
}
test('shared Console tick matches original waveform, routing and node cleanup',()=>{
 const old=audioFixture(),now=audioFixture();
 // Captured pre-extraction tone(1180,0,.025,.012,'sine') baseline.
 function oldTick(audio,nodes,mix){const osc=audio.createOscillator(),gain=audio.createGain(),node={osc,gain};nodes.add(node);osc.type='sine';osc.frequency.setValueAtTime(1180,audio.currentTime+0);gain.gain.setValueAtTime(0,audio.currentTime+0);gain.gain.linearRampToValueAtTime(.012,audio.currentTime+0+.01);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+0+.025);osc.connect(gain);gain.connect(mix.destination(audio,'effect'));osc.onended=()=>{nodes.delete(node);try{osc.disconnect();gain.disconnect();}catch{}};osc.start(audio.currentTime+0);osc.stop(audio.currentTime+0+.025+.02);}
 const a=new Set(),b=new Set();oldTick(old.c,a,old.mix);now.mix.consoleTick(now.c,b);assert.deepEqual(now.calls,old.calls);assert.equal([...b][0].osc.type,'sine');[...a][0].osc.onended();[...b][0].osc.onended();assert.deepEqual(now.calls,old.calls);assert.equal(b.size,0);
});
test('production Console tick retains GM/PC mute and hidden-document gating',()=>{
 const app=fs.readFileSync(require.resolve('../app'),'utf8'),body=app.match(/consoleTick: \(\) => \{([\s\S]*?)\n  \},/)[1];
 for(const mode of ['gm','player'])for(const muted of [true,false])for(const hidden of [true,false]){let called=0;const nodes=new Set(),audio={};vm.runInNewContext(`(function(){${body}})()`,{mode,gmSoundsMuted:mode==='gm'?muted:false,alertsEnabled:mode==='player'?!muted:true,document:{hidden},ensureAudio:()=>audio,activeGmAudioNodes:nodes,window:{SAAudioMix:{consoleTick:(c,n)=>{assert.equal(c,audio);assert.equal(n,nodes);called++;}}}});assert.equal(called,!muted&&!hidden?1:0);}
});
test('viewer audio storage is memory only, shared across stage reloads and distinct from personal preferences',()=>{
 const source=fs.readFileSync(require.resolve('../console-viewer'),'utf8');const root={document:{currentScript:{hasAttribute:()=>true},addEventListener(){},querySelectorAll:()=>[]},localStorage:{getItem(){throw Error('read');},setItem(){throw Error('write');}}};root.parent=root;vm.runInNewContext(source,{window:root});vm.runInNewContext(mixerSource,{...root,globalThis:root});assert.equal(root.SAAudioMix.isMuted(),true);root.SAAudioMix.setMuted(false);assert.equal(root.SAAudioMix.isMuted(),false);assert.equal(root.SAAudioMix.level('game'),1);assert.equal(root.SAAudioMix.level('interface'),.3);const child={document:root.document,parent:root};vm.runInNewContext(source,{window:child});assert.equal(child.SABrowserStorage,root.SABrowserStorage);
});

test('viewer loads private storage before the shared mixer without relaxing network or iframe policy',()=>{const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8');assert.ok(html.indexOf('data-viewer-audio-bootstrap')<html.indexOf('src="audio-mix.js"'));assert.match(html,/sandbox="allow-scripts allow-same-origin allow-modals"/);assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);const {mix}=audioFixture();mix.setPreferences({master:50,game:40});assert.equal(mix.level('game'),.2);mix.setMuted(true);assert.equal(mix.level('game'),0);mix.setMuted(false);assert.equal(mix.level('game'),.2);});

test('Lock On fixtures provide real remote station access and distinct analyzed targets for every tier',()=>{
 const stations=require('../station-access'),sensors=require('../ship-sensors'),powerApi=require('../ship-power');
 for(let tier=1;tier<=10;tier++){const s=fixture(tier,'lock'),ship=s.starships[0],u=s.units[0],a=stations.access(s,u,'lock');assert.equal(a.kind,'lock');assert.equal(a.remote,true);assert.equal(a.definition.tier,tier);assert.ok(sensors.masking(s,ship)>0);assert.ok(powerApi.output(ship).en>powerApi.demand(ship));assert.equal(s.starships.length,3);for(const target of s.starships.slice(1)){assert.equal(ship.sensorState.contacts[target.id].level,'detected');assert.ok(sensors.analysis(ship,target.id).layout.sicInventory.length);assert.equal(target.currentShieldHp,0);}assert.equal(ship.incomingLocks.length,1);power(s,false);assert.equal(ship.ship.sicInventory.find(i=>i.id==='lock').disabled,true);assert.notEqual(ship.ship.sicInventory.find(i=>i.id==='sensor').disabled,true);power(s,true);assert.equal(stations.access(s,u,'lock').kind,'lock');assert.equal(s.practice,undefined);assert.equal(s.catalogPreview,undefined);}
 const low=fixture(1,'lock','insufficient');assert.equal(low.starships[0].auState.current,0);assert.equal(low.starships[0].auState.available,0);assert.ok(low.starships[1].currentShieldHp>0);assert.ok(sensors.masking(low,low.starships[0])<=0);const unknown=fixture(1,'lock','unknown');assert.equal(Object.values(unknown.starships[0].sensorState.contacts).filter(c=>c.level==='detected').length,0);assert.throws(()=>fixture(11,'lock'));assert.throws(()=>fixture(1,'unsupported'));
});
test('viewer loads real Lock On dependencies in order without changing sandbox/connect policy',()=>{const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8');for(const [a,b] of [['ship-map-core.js','ship-power.js'],['ship-sensors.js','ship-locks.js'],['ship-locks.js','lock-console-ui.js'],['lock-console-ui.js','console-feedback.js']])assert.ok(html.indexOf('src="'+a+'"')<html.indexOf('src="'+b+'"'));assert.match(html,/id="family"/);assert.match(html,/connect-src 'none'/);assert.match(html,/sandbox="allow-scripts allow-same-origin allow-modals"/);});
test('viewer uses production Lock On map styling before its shared sizing correction',()=>{
 const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8');
 assert.ok(html.includes('href="ship-pass2.css"'));
 assert.ok(html.indexOf('href="ship-pass2.css"')<html.indexOf('href="console-common.css"'));
});

test('ALMA Warp interaction is local, bounded and explicitly illustrative',()=>{
 const {visualFixture,warpPreview}=require('../console-viewer'),a=visualFixture('warp-drive-1'),b=visualFixture('warp-drive-1'),demo=warpPreview(a);
 assert.throws(()=>warpPreview(visualFixture('bridge-1')));
 for(const distanceLY of [0,-1,Infinity,NaN])assert.throws(()=>demo.command({kind:'warpPlan',distanceLY}));
 assert.throws(()=>demo.command({kind:'destructApprove'}));
 assert.deepEqual(demo.command({kind:'warpPlan',distanceLY:3.26}).result.counts,{A:1});
 demo.command({kind:'warpStart',distanceLY:3.26});assert.throws(()=>demo.command({kind:'warpStart',distanceLY:3.26}));
 demo.tick(1);assert.equal(a.starships[0].ship.warpState.remaining,2);demo.command({kind:'warpCancel'});assert.equal(a.starships[0].ship.warpState.phase,'cancelled');
 demo.command({kind:'warpStart',distanceLY:3.26});demo.tick(3);assert.equal(a.starships[0].ship.warpState.phase,'traveling');demo.tick(1);demo.command({kind:'warpExit'});assert.equal(a.starships[0].ship.warpState.phase,'exited');
 demo.command({kind:'warpStart',distanceLY:7});demo.tick(3);demo.tick(6);assert.equal(a.starships[0].ship.warpState.traveledLY,7);assert.match(a.starships[0].ship.warpState.report.reason,/SIMULATED arrived/);assert.equal(b.starships[0].ship.warpState,undefined);
});

test('Warp preview loads the existing travel effect and reads private viewer audio preferences',()=>{
 const html=fs.readFileSync(require.resolve('../console-viewer.html'),'utf8');assert(html.indexOf('src="warp-effects.js"')<html.indexOf('src="transit-console-ui.js"'));assert.match(html,/connect-src 'none'/);
 const source=fs.readFileSync(require.resolve('../warp-effects.js'),'utf8');let reads=0,personalReads=0;
 const win={SABrowserStorage:{local:{getItem(){reads++;return 'on';}}},addEventListener(){}};
 const context={window:win,document:{hidden:false,addEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval:fn=>{fn();return 1;},cancelAnimationFrame(){},requestAnimationFrame(){return 1;},ResizeObserver:class{observe(){}disconnect(){}},performance:{now:()=>0},Math};
 Object.defineProperty(context,'localStorage',{get(){personalReads++;throw Error('Personal storage must not be accessed');}});vm.runInNewContext(source,context);assert(reads>0);assert.equal(personalReads,0);assert.equal(typeof win.SAWarpEffects.update,'function');let normalReads=0;const normal={...context,window:{addEventListener(){}},localStorage:{getItem(){normalReads++;return 'on';}}};vm.runInNewContext(source,normal);assert(normalReads>0,'Production fallback still reads its existing storage');
});

test('Mine Launcher visual fixture loads mines while missile fixture stays unchanged',()=>{const {visualFixture}=require('../console-viewer');for(const [type,ammo]of [['mine-launcher','space-mine-1'],['missile-launcher-1','missile-1']]){const s=visualFixture(type).starships[0].ship;assert.deepEqual(s.missileAmmo,{preview:{[ammo]:3}});assert.deepEqual(s.missileStorage,{[ammo]:10});}assert.equal(require('../missile-ammunition').catalog['space-mine-1'].mine,true);});

test('ordinary pilot Preview routes only Hold and Resume through the local adapter',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(require.resolve('../console-viewer.js'),'utf8'),viewer=require('../console-viewer'),state=viewer.visualFixture('cockpit-1'),demo=require('../console-preview-actions').create(state),before=structuredClone(state.shipPositions);
 const c={shieldDemo:null,devastationDemo:null,cleanserDemo:null,blackHoleDemo:null,navigationDemo:null,localDemo:null,pilotHoldDemo:demo,visual:true};vm.createContext(c);vm.runInContext(source.slice(source.indexOf(' const action=async body=>'),source.indexOf(' root.SACombatBridge=')).replace('const action=','this.action='),c);
 for(let n=0;n<2;n++){await c.action({action:'playerCombatAction',kind:'holdConsole'});assert.equal(state.units[0].consoleHold,true);await c.action({action:'playerCombatAction',kind:'resumeConsole'});assert.equal(state.units[0].consoleHold,false);}
 await assert.rejects(c.action({action:'playerCombatAction',kind:'moveStarship',destination:{q:3,r:2}}),/unavailable/);assert.deepEqual(state.shipPositions,before);await assert.rejects(c.action({action:'shipCommand',kind:'holdConsole'}),/unavailable/);
 c.pilotHoldDemo=null;await assert.rejects(c.action({action:'playerCombatAction',kind:'holdConsole'}),/unavailable/);
});

test('Probe visual samples use owned docked and deployed contacts without executing orders',()=>{
 const {visualFixture}=require('../console-viewer'),sensors=require('../ship-sensors'),a=visualFixture('probe-launcher'),b=visualFixture('probe-launcher'),owner=a.starships[0],data=owner.ship.probeState;
 const docked=data.probes['preview-docked-probe'],deployed=data.probes['preview-deployed-probe'];
 assert.equal(docked.phase,'docked');assert.equal(deployed.phase,'holding');assert.notEqual(docked.id,deployed.id);assert.equal(deployed.linked,true);
 assert.equal(deployed.ownerId,owner.id);assert.equal(deployed.launcherId,'preview');assert.equal(data.receipts.length,0);assert.equal(a.units[0].delayedAction,undefined);assert.match(data.reports[0].text,/SIMULATED.*No launch command/);assert.ok(Number.isFinite(Date.parse(data.reports[0].at)));
 const view=sensors.view(a,owner.id);assert.ok(view.starships.some(s=>s.id===deployed.id&&s.probeOwnerId===owner.id));assert.ok(!view.starships.some(s=>s.id===docked.id));
 assert.equal(owner.ship.sicInventory.filter(i=>i.attachTo==='preview').length,2);
 deployed.position.q=99;assert.equal(b.starships[0].ship.probeState.probes['preview-deployed-probe'].position.q,3);
 assert.equal(visualFixture('missile-launcher-1').starships[0].ship.probeState,undefined);
});
