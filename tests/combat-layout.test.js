const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function markup(records,mode='gm',units=[]){
 const context={myUnitId:'mine',automationControlsMarkup:u=>`<button data-automate='${u.id}'>Automate NPC</button>`,state:{starships:records,units:[],log:[],shipPositions:[]},mode,visualMode:'ring',escapeHtml:s=>String(s),shipScopedLogEntries:()=>[],tacticalRingSingleMarkup:(_u,id)=>`<svg data-original-ring="${id}"></svg>`,window:{SASpaceMap:{markup:()=>'<svg data-original-space></svg>'}}};
 vm.runInNewContext(source.slice(source.indexOf('function shipCombatColumnsMarkup('),source.indexOf('function renderShipCombatColumns(')),context);
 return context.shipCombatColumnsMarkup(units);
}
const ships=n=>Array.from({length:n},(_,i)=>({id:'ship-'+i,title:'Ship '+i,controlType:i?'gm':'pc',ship:{}}));
for(const n of [1,2,3,6])test(`${n} visible ships retain their own summary/ring/map with one shared clock and map`,()=>{
 const html=markup(ships(n));
 assert.equal((html.match(/class="ship-combat-lane"/g)||[]).length,n);
 assert.equal((html.match(/data-original-ring=/g)||[]).length,n);
 assert.equal((html.match(/class="paired-combat-clock"/g)||[]).length,1);
 assert.equal((html.match(/class="combat-space-map"/g)||[]).length,1);
 assert.equal((html.match(/data-ship-side="left"/g)||[]).length,1);
 assert.equal((html.match(/data-ship-side="right"/g)||[]).length,n-1);
 if(n>=3)assert.match(html,/--pair-row:6;--map-row:8;--log-row:9/);
});
test('one-ship PC layout uses viewer-visible interiors, not hidden contacts or departed ships',()=>{
 const input=[...ships(1),{id:'contact',contactOnly:true},{id:'departed',escapedAt:42},{id:'warp',ship:{warpState:{phase:'traveling'}}}];
 const html=markup(input,'player');assert.match(html,/data-single-pc="true"/);assert.match(html,/data-ship-count="1"/);
 assert.equal((html.match(/data-inline-ship-map=/g)||[]).length,1);assert.doesNotMatch(html,/data-damage-ship|data-remove-combat-ship|data-spend-au/);
});
test('AU and existing actions remain inside each summary; crew markup is reused',()=>{
 const html=markup(ships(2));assert.equal((html.match(/data-au-meter/g)||[]).length,2);assert.equal((html.match(/data-damage-ship/g)||[]).length,2);
 assert.match(html,/data-au-meter[^]*?<\/section><\/div>\s*<div class="ship-lane-atb">/);
});
test('first Engage presentation follows authoritative hasEngagedClock and never changes the action',()=>{
 const attrs={},classes=new Set(),button={dataset:{},classList:{toggle(k,v){v?classes.add(k):classes.delete(k);}},getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v};
 const context={state:{starships:[{}],hasEngagedClock:false},mode:'gm',gmPanicPause:button,activeUnit:()=>null,shouldShowEngageClock:()=>true};
 vm.runInNewContext(source.slice(source.indexOf('function updateGmClockButton('),source.indexOf('function stopPlayerPreviewAnimation(')),context);
 context.updateGmClockButton();assert.equal(attrs['aria-label'],'Begin Combat, and Engage Clock!!');assert.equal(button.dataset.clockAction,'start');assert.ok(classes.has('first-combat-engagement'));
 context.state.hasEngagedClock=true;context.updateGmClockButton();assert.equal(attrs['aria-label'],'Engage Clock');assert.equal(button.dataset.clockAction,'start');assert.ok(!classes.has('first-combat-engagement'));
 context.state.hardPaused=true;context.updateGmClockButton();assert.equal(button.dataset.clockAction,'resume');assert.ok(!classes.has('first-combat-engagement'));
});

test('unequal sides leave unmatched half-rows empty and preserve same-side order',()=>{
 const html=markup([{id:'n1',controlType:'gm'},{id:'p1',controlType:'pc'},{id:'n2',controlType:'gm'},{id:'p2',controlType:'pc'},{id:'n3',controlType:'gm'}]);
 const lanes=[...html.matchAll(/data-ship-combat-lane="([^"]+)" data-ship-side="([^"]+)" data-ship-row="[0-9]+" style="--pair-row:(\d+)/g)].map(m=>[m[1],m[2],Number(m[3])]);
 assert.deepEqual(lanes,[['p1','left',2],['p2','left',6],['n1','right',2],['n2','right',6],['n3','right',10]]);
});
test('inward floorplan facing follows saved side rather than array index',()=>{
 const mapSource=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');const context={window:{SAShipMap:{displayRotation:(_record,target)=>target}}};
 vm.runInNewContext(mapSource.slice(mapSource.indexOf('  function interiorRotation('),mapSource.indexOf('  function orientedGridPoint')),context);
 assert.equal(context.interiorRotation({controlType:'pc'}),90);assert.equal(context.interiorRotation({controlType:'gm'}),270);
});

test('surface display choice survives ship view while ships always use rings',()=>{
 const context={state:{starships:[]},surfaceVisualMode:'bars',visualMode:'bars',render:()=>{}};
 vm.runInNewContext(source.slice(source.indexOf('function setVisualMode('),source.indexOf('function setRoom(')),context);
 context.setVisualMode('ring');assert.equal(context.surfaceVisualMode,'ring');assert.equal(context.visualMode,'ring');
 context.state.starships=[{id:'own'}];context.setVisualMode('bars');assert.equal(context.visualMode,'ring');assert.equal(context.surfaceVisualMode,'bars');
 context.state.starships=[];context.setVisualMode('bars');assert.equal(context.visualMode,'bars');
});


test('normal summary omits only duplicated header metrics and bottom AU; enlarged retains all nine',()=>{
 const mapSource=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
 const context={combatState:{units:[]},mode:'gm',statValue:()=>4,esc:String,window:{SAShipPower:{output:()=>({en:10,au:20})},SAShipMap:{sensorStats:()=>({range:8}),firewallStats:()=>3},SAHealthDisplay:{hull:()=>"hull",shields:()=>"shield"}}};
 vm.runInNewContext(mapSource.slice(mapSource.indexOf('  function statsMarkup('),mapSource.indexOf('  function stationChoiceMarkup(')),context);
 const summary=context.statsMarkup({ship:{}},true),expanded=context.statsMarkup({ship:{}},false);
 assert.deepEqual([...summary.matchAll(/<small>(.*?)<\/small>/g)].map(m=>m[1]),['Movement','Detection','Security','EN','Scale']);
 assert.equal([...expanded.matchAll(/<small>/g)].length,9);
});


test('GM recovery toolbar moves as one owned node, rejects wrong frames, restores only its owner',()=>{
 const gmSource=fs.readFileSync(require.resolve('../gm.js'),'utf8');const parentDoc={},frameDoc={},otherDoc={};
 const parent={ownerDocument:parentDoc,append(node){node.parentElement=this;node.ownerDocument=this.ownerDocument;}};
 const target={ownerDocument:frameDoc,matches:s=>s==='.paired-combat-recovery',append:parent.append};
 const group={ownerDocument:parentDoc,parentElement:parent},origin={after:node=>parent.append(node)};
 const context={recoveryGroup:group,recoveryOrigin:origin,dom:{atbLive:{hidden:false},atbFrame:{contentDocument:frameDoc}}};
 vm.runInNewContext(gmSource.slice(gmSource.indexOf('function mountCombatRecovery('),gmSource.indexOf('window.SACombatRecoveryLayout=')),context);
 context.mountCombatRecovery({...target,ownerDocument:otherDoc});assert.equal(group.parentElement,parent);
 context.dom.atbLive.hidden=true;context.mountCombatRecovery(target);assert.equal(group.parentElement,parent);
 context.dom.atbLive.hidden=false;context.mountCombatRecovery(target);assert.equal(group.parentElement,target);
 context.restoreCombatRecovery(otherDoc);assert.equal(group.parentElement,target);
 context.restoreCombatRecovery(frameDoc);assert.equal(group.parentElement,parent);assert.equal(group.ownerDocument,parentDoc);
 context.mountCombatRecovery(target);context.restoreCombatRecovery();assert.equal(group.parentElement,parent);
});

test('paired Combat refinement stays CSS-only and preserves existing legend text',()=>{
 const css=fs.readFileSync(require.resolve('../combat-workspace.css'),'utf8');
 assert.match(css,/--compact-clock-width:clamp\(240px,calc\(100cqw - 1000px\),420px\)/);
 assert.match(css,/\[data-ship-side=right\]>\.ship-lane-atb \.ring-legend\{grid-column:1\}/);
 assert.match(css,/grid-template-columns:88px minmax\(0,1fr\)/);
 const renderer=fs.readFileSync(require.resolve('../tactical-ring-renderer.js'),'utf8');
 assert.match(renderer,/Reload\/Recovery/);assert.match(renderer,/Delayed Resolution/);
});


test('only preparation notice uses available clock; prompts and missing clock keep original host',()=>{
 const s=fs.readFileSync(require.resolve('../ship-roll-ui.js'),'utf8'),clock={},doc={querySelector:()=>null};
 const c={document:{querySelector:()=>clock}};vm.runInNewContext(s.slice(s.indexOf('  function preparationNoticeHost('),s.indexOf('  function poll(')),c);
 const text='Encounter prepared and paused. Engage the clock when ready.';
 assert.equal(c.preparationNoticeHost(doc,text),clock);
 for(const other of ['Pilot: Damage roll required','Ship: you are being Hailed by Enemy','Scan complete',''])assert.equal(c.preparationNoticeHost(doc,other),null);
 assert.equal(c.preparationNoticeHost({querySelector:()=>({})},text),null);
 c.document.querySelector=()=>null;assert.equal(c.preparationNoticeHost(doc,text),null);
 assert.match(s,/until=Date.now\(\)\+7000/);
});


test('automation stays under stats; holding overlays its own ring with viewer-specific controls',()=>{
 const units=[{id:'mine',characterName:'Own pilot',team:'pc',consoleHold:true,location:{starshipId:'ship-0'}},{id:'other',characterName:'Other pilot',team:'pc',consoleHold:true,location:{starshipId:'ship-1'}},{id:'npc',characterName:'Enemy crew',team:'npc',location:{starshipId:'ship-1'}}];
 for(const mode of ['gm','player']){
  const html=markup(ships(2),mode,units),lanes=html.split('<article class="ship-combat-lane"').slice(1);
  assert.match(lanes[0],/ship-summary-stats[^]*ship-crew-status[^]*ship-au-panel[^]*ship-ring-holds[^]*Own pilot/);
  assert.doesNotMatch(lanes[0],/Other pilot|Enemy crew/);
  assert.match(lanes[1],/ship-au-panel[^]*ship-ring-holds[^]*Other pilot/);
  for(const lane of lanes)assert.doesNotMatch(lane.split('<div class="ship-lane-atb">')[1].split('<section class="ship-lane-log">')[0],/ship-crew-status/);
  assert.match(html,/data-resume-console="mine"/);
  if(mode==='gm'){assert.match(html,/data-resume-console="other"/);assert.match(html,/data-automate='npc'/);}
  else assert.doesNotMatch(html,/data-resume-console="other"|data-automate/);
 }
});


test('Move enlarges its current ship for any fleet size and reuses an existing matching view',()=>{
 const src=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8'),body=src.slice(src.indexOf('    openMove(unit) {')+'    openMove(unit) {'.length,src.indexOf('    isInlineMoveSelecting:'));
 const fn=body.slice(0,body.lastIndexOf('    },'));
 for(const count of [1,2,4]){
  let calls=0,fallback=0;const button={},host={parentElement:null,querySelector:()=>button};
  const c={mapView:{},selectedUnitId:'',selectedShipId:'',interaction:'view',preview:null,waypoints:[],moveSubmitting:false,moveError:'',expandedMap:null,CSS:{escape:s=>s},document:{querySelector:selector=>{assert.equal(selector,'[data-inline-ship-map="ship-'+(count-1)+'"]');return host;}},open:()=>fallback++,setInlineMoveSelecting:()=>{},renderInlineMaps:()=>{},restoreInlineView:()=>{},expandInterior:(h,b)=>{assert.equal(h,host);assert.equal(b,button);calls++;}};
  vm.runInNewContext('function run(unit){'+fn+'}',c);const unit={id:'pilot',location:{starshipId:'ship-'+(count-1)}};
  c.run(unit);assert.equal(calls,1);assert.equal(c.interaction,'move');assert.equal(c.selectedUnitId,'pilot');
  c.expandedMap={host:{dataset:{inlineShipMap:unit.location.starshipId}}};c.run(unit);assert.equal(calls,1);
  c.document.querySelector=()=>null;c.expandedMap=null;c.run(unit);assert.equal(fallback,1);
  c.run({...unit,shipAi:true});assert.equal(fallback,1);
 }
});


test('header save status remains live, handles no saves, and rejects obsolete campaign replies',async()=>{
 const src=fs.readFileSync(require.resolve('../gm.js'),'utf8'),label={hidden:true,textContent:''};let response={checkpoints:[{at:'2026-10-31T20:00:00Z'}]};
 const c={code:'room',token:'token',dom:{combatSaveStatus:label},api:async()=>response,Date};
 vm.runInNewContext(src.slice(src.indexOf('async function refreshCombatSaveStatus(){'),src.indexOf('setInterval(()=>{if(!document.hidden&&campaign)void refreshCombatSaveStatus();')),c);
 await c.refreshCombatSaveStatus();assert.equal(label.hidden,false);assert.match(label.textContent,/Last combat save:/);const first=label.textContent;
 response={checkpoints:[{at:'2026-10-31T21:00:00Z'}]};await c.refreshCombatSaveStatus();assert.notEqual(label.textContent,first);
 response={checkpoints:[]};await c.refreshCombatSaveStatus();assert.equal(label.textContent,'No combat save yet. Saves begin when combat is prepared.');
 let resolve;c.api=()=>new Promise(r=>resolve=r);const pending=c.refreshCombatSaveStatus();c.code='replacement';label.textContent='Checking combat saves...';resolve({checkpoints:[{at:'2020-01-01'}]});await pending;assert.equal(label.textContent,'Checking combat saves...');
 c.token='';await c.refreshCombatSaveStatus();assert.equal(label.hidden,true);
 const html=fs.readFileSync(require.resolve('../gm.html'),'utf8');assert.equal((html.match(/id="combatSaveStatus"/g)||[]).length,1);assert.match(html,/<small id="combatSaveStatus"[^]*?<div id="universeClock"/);assert.doesNotMatch(html,/id="liveEncounterCode"/);assert.match(html,/id="campaignCodeHeading"/);assert.match(html,/id="restoreLastCombat"/);assert.match(html,/id="returnToEncounterSetup"/);
});
