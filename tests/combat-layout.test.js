const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
test('destroyed enlarged interior closes through existing cleanup without updating its dashboard',()=>{
 const mapSource=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
 const start=mapSource.indexOf('      const value=bridge()?.shipDashboardData?.(expandedMap.host.dataset.inlineShipMap);');
 const end=mapSource.indexOf('    root.querySelectorAll?',start);
 const body=mapSource.slice(start,end).replace(/\s*}\s*$/,'');
 for(const value of [null,{record:{id:'wreck',destroyedAt:123}}]){
  let closes=0;const c={expandedMap:{host:{dataset:{inlineShipMap:'wreck'}},dialog:{querySelector(){throw Error('stale dashboard update');}}},bridge:()=>({shipDashboardData:()=>value}),closeExpandedMap(){closes++;}};
  vm.runInNewContext('function refresh(){'+body+'}',c);c.refresh();assert.equal(closes,1);
 }
});
function markup(records,mode='gm',units=[],view='ring'){
 const context={myUnitId:'mine',automationControlsMarkup:u=>`<button data-automate='${u.id}'>Automate NPC</button>`,state:{starships:records,sensorObserverId:records.find(s=>s.controlType==='pc')?.id,units,log:[],shipPositions:[]},mode,visualMode:'ring',escapeHtml:s=>String(s),shipScopedLogEntries:()=>[],tacticalRingSingleMarkup:(_u,id)=>`<svg data-original-ring="${id}"></svg>`,window:{SASpaceMap:{markup:()=>'<svg data-original-space></svg>'}}};
 context.visualMode=view;context.unitCard=u=>`<article data-unit-id="${u.id}"></article>`;
 vm.runInNewContext(source.slice(source.indexOf('function npcExertionMarkup('),source.indexOf('function npcCombatStatsMarkup(')),context);
 vm.runInNewContext(source.slice(source.indexOf('function shipCombatColumnsMarkup('),source.indexOf('function renderShipCombatColumns(')),context);
 return context.shipCombatColumnsMarkup(units);
}
const ships=n=>Array.from({length:n},(_,i)=>({id:'ship-'+i,title:'Ship '+i,controlType:i?'gm':'pc',ship:{}}));
test('bar mode retains each actor exactly once in its ship lane including unequal sides',()=>{
 for(const count of [1,2,4])for(const role of ['gm','player']){
  const units=ships(count).flatMap((s,i)=>Array.from({length:i+1},(_,j)=>({id:`crew-${i}-${j}`,location:{starshipId:s.id}})));
  const html=markup(ships(count),role,units,'bars');assert.equal((html.match(/class="ship-lane-bars"/g)||[]).length,count);assert.doesNotMatch(html,/data-original-ring/);
  for(const u of units)assert.equal((html.match(new RegExp(`data-unit-id="${u.id}"`,'g'))||[]).length,1);
  assert.equal((html.match(/data-ship-side="right"/g)||[]).length,count-1);
 }
});
test('destroyed interiors disappear on update and reload without mutating wreck records or sides',()=>{
 const records=ships(3);
 assert.equal((markup(records,'player').match(/data-inline-ship-map=/g)||[]).length,3);
 records[1].destroyedAt='2026-11-01T15:54:09Z';
 for(const input of [records,JSON.parse(JSON.stringify(records))])for(const role of ['gm','player']){
  const html=markup(input,role);
  assert.doesNotMatch(html,/data-ship-combat-lane="ship-1"/);
  assert.match(html,/data-ship-combat-lane="ship-2" data-ship-side="right" data-ship-row="0"/);
  assert.equal((html.match(/data-inline-ship-map=/g)||[]).length,2);
  assert.equal(input.length,3);assert.ok(input[1].destroyedAt);
 }
 records[2].destroyedAt='destroyed';assert.match(markup(records,'player'),/data-single-pc="true" data-ship-count="1"/);
 records[0].destroyedAt='destroyed';assert.equal((markup(records).match(/data-inline-ship-map=/g)||[]).length,0);
 assert.match(source,/SASpaceMap\.markup\(ships,state\.shipPositions\)/);
 assert.match(source,/SASpaceMap\.update\(combatSpaceMap,state\.starships,state\.shipPositions\)/);
});
test('preparation checkbox label is exactly Fog of War with its existing identity',()=>{
 assert.match(fs.readFileSync(require.resolve('../gm.html'),'utf8'),/id="prepareFog"> Fog of War<\/label>/);
});
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

test('surface and ship display choices stay independent and persist to their own preferences',()=>{
 const saved={};const context={state:{starships:[]},surfaceVisualMode:'bars',shipVisualMode:'ring',visualMode:'bars',safeLocalStorageSet:(k,v)=>saved[k]=v,render:()=>{}};
 vm.runInNewContext(source.slice(source.indexOf('function setVisualMode('),source.indexOf('function setRoom(')),context);
 context.setVisualMode('ring');assert.equal(context.surfaceVisualMode,'ring');assert.equal(context.visualMode,'ring');
 context.state.starships=[{id:'own'}];context.setVisualMode('bars');assert.equal(context.visualMode,'bars');assert.equal(context.surfaceVisualMode,'ring');assert.equal(context.shipVisualMode,'bars');
 assert.equal(saved['sa-atb-ship-visual'],'bars');assert.equal(saved['sa-atb-surface-visual'],'ring');
 context.state.starships=[];context.setVisualMode('bars');assert.equal(context.visualMode,'bars');
});

test('shared clock mounts existing controls only for GM and restores them for player',()=>{
 const ids=['undoLastTiming','stepTick','resetAll','clearEncounter','exitCombat'];const nodes=Object.fromEntries(ids.map(id=>[id,{id}]));const moves=[],restored=[];
 const c={mode:'gm',activePanel:{id:'status'},readyCount:{id:'ready'},gmPanicPause:{id:'clock'},document:{getElementById:id=>nodes[id]},pairedControlOrigins:new Map(ids.map(id=>[nodes[id],{after:n=>restored.push(n.id)}])),moveCombatControl:(node,host)=>moves.push([node.id,host.id])};
 vm.runInNewContext(source.slice(source.indexOf('function mountCombatClock('),source.indexOf('function mountPairedCombatControls(')),c);
 const clock={id:'surface',querySelector:()=>({id:'actions'})};c.mountCombatClock(clock);assert.equal(moves.length,8);assert.deepEqual(moves.filter(x=>ids.includes(x[0])).map(x=>x[0]),ids);
 moves.length=0;c.mode='player';c.mountCombatClock(clock);assert.deepEqual(moves.map(x=>x[0]),['status','ready']);assert.deepEqual(restored,ids);
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
  if(mode==='gm'){assert.match(html,/data-resume-console="other"/);assert.match(html,/data-automate='npc'/);assert.match(html,/data-field="exertionCurrent"/);}
  else assert.doesNotMatch(html,/data-resume-console="other"|data-automate|data-field="exertionCurrent"/);
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


test('paired ring footprint reclaims unused height without offsetting the map or changing single-PC layout',()=>{
 const css=fs.readFileSync(require.resolve('../combat-workspace.css'),'utf8');
 assert.match(css,/\.ship-combat-columns:not\(\[data-single-pc=true\]\) \.ship-lane-atb\{container-type:inline-size\}/);
 assert.match(css,/--paired-ring-size:min\(280px,calc\(100cqw - 114px\)\);display:block;height:calc\(var\(--paired-ring-size\) \* \.8\);transform:none/);
 assert.match(css,/\.tactical-ring-group>\.tactical-ring-view\{transform:translateY\(calc\(var\(--paired-ring-size\) \* -\.145\)\)\}/);
 assert.doesNotMatch(css,/\.combat-space-map\{[^}]*transform:/);
});


test('floorplan toolbars overlay bottom center without hiding controls or movement confirmation',()=>{
 const css=fs.readFileSync(require.resolve('../combat-workspace.css'),'utf8');
 assert.match(css,/\.ship-lane-map>\.inline-map-footer\{position:absolute;bottom:8px;left:50%;transform:translateX\(-50%\)/);
 assert.match(css,/\.ship-lane-map>\.inline-map-stage\{grid-row:1\}/);
 assert.match(css,/\.ship-lane-map \.inline-map-move-controls\{bottom:64px\}/);
 assert.match(css,/\.ship-lane-map>\.inline-map-toolbar\{padding-block:0;border-block:0;gap:0\}/);
 const tail=css.slice(css.indexOf('/* Each floorplan owns'),css.indexOf('/* Bars reuse'));
 assert.doesNotMatch(tail,/display:none|overflow:hidden|font-size:/);
});

test('main combat delegates framing to the encounter-scoped shared camera without per-render refitting',()=>{
 const start=source.indexOf('  const combatSpaceMap=unitList.querySelector'),end=source.indexOf('  const spaceHeader',start),code=source.slice(start,end),calls=[];
 const map={},svg={},state={starships:[],shipPositions:[]};
 vm.runInNewContext(code,{state,unitList:{querySelector:()=>map},window:{SASpaceMap:{update:()=>svg,cameraIdentity:view=>'scoped-'+view,mountCamera:(node,key)=>calls.push([node,key])}}});
 assert.deepEqual(calls,[[svg,'scoped-combat']]);assert.doesNotMatch(code,/fitRendered|initialFit/);
});

test('GM knowledge picker relocates once below recovery while retaining its selection and callback',()=>{
 const start=source.indexOf("  const mapHeader=unitList.querySelector('.combat-space-map');",source.indexOf('function updateShipHeaders()'));
 const end=source.indexOf('  for (const ship of ships)',start),code='function mount(){'+source.slice(start,end)+'}';
 const make=tag=>({tag,dataset:{},children:[],innerHTML:'',setAttribute(){},append(n){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);this.children.push(n);n.parentElement=this;},querySelector(){return this.children.find(x=>x.tag==='select');}});
 const map=make('map'),recovery=make('recovery');let label=null,changes=0;
 const c={mode:'gm',ships:[{id:'npc-ship',title:'NPC',controlType:'gm'}],state:{units:[]},gmKnowledgeObserverId:'npc-ship',escapeHtml:s=>s,unitList:{querySelector:()=>map},document:{querySelector:s=>s==='.paired-combat-recovery'?recovery:label,createElement:tag=>{const node=make(tag);if(tag==='label')label=node;return node;}},updateShipHeaders(){changes++;}};
 vm.runInNewContext(code,c);c.mount();const select=label.querySelector('select'),handler=select.onchange;assert.equal(label.parentElement,recovery);assert.equal(select.value,'npc-ship');assert.equal(map.children.length,0);
 c.mount();assert.equal(recovery.children.length,1);assert.equal(label.querySelector('select'),select);assert.equal(select.onchange,handler);select.value='';handler();assert.equal(c.gmKnowledgeObserverId,'');assert.equal(changes,1);
 c.mode='player';label=null;recovery.children=[];c.mount();assert.equal(label,null);assert.equal(recovery.children.length,0);
});
test('completed sensor projection puts the revealed NPC beside its PC observer',()=>{
 const sensors=require('../ship-sensors');const a={id:'pc',controlType:'pc',ship:{gridCells:[1],sicInventory:[],placements:[]}},b={id:'npc',controlType:'gm',ship:{gridCells:[2],sicInventory:[],placements:[]}};
 const room={starships:[a,b],units:[],shipPositions:[],log:[]};const knowledge=sensors.knowledge(a);knowledge.contacts.npc={id:'npc',level:'detected',title:'NPC',position:{q:1,r:0}};
 const before=markup(sensors.view(room,a.id).starships,'player');assert.match(before,/data-single-pc="true"/);assert.doesNotMatch(before,/data-ship-combat-lane="npc"/);
 knowledge.analyses.npc={layout:b.ship};
 for(const state of [room,JSON.parse(JSON.stringify(room))]){const after=markup(sensors.view(state,a.id).starships,'player');assert.match(after,/data-single-pc="false"/);assert.match(after,/data-ship-combat-lane="pc" data-ship-side="left" data-ship-row="0"/);assert.match(after,/data-ship-combat-lane="npc" data-ship-side="right" data-ship-row="0"/);}
});


test('Surface clock is nested above its participant stack, leaving arena in the first grid row',()=>{
 const arena=fs.readFileSync(require.resolve('../combat-arena-ui.js'),'utf8'),css=fs.readFileSync(require.resolve('../combat-arena.css'),'utf8');
 const template=arena.match(/layout.innerHTML='([^']+)'/)[1];
 assert.equal(template,'<div class="surface-atb-column"><div class="surface-clock-group"><div class="surface-combat-clock paired-combat-clock"><div class="paired-clock-actions"></div></div><div class="paired-combat-recovery"></div></div></div>');
 assert.match(arena,/layout.firstElementChild.append\(list\)/);
 assert.match(arena,/if\(mode==='gm'\)window.parent\?\.SACombatRecoveryLayout\?\.mount/);
 assert.match(arena,/if\(layout.querySelector\('\.combat-recovery-toolbar'\)\)window.parent\?\.SACombatRecoveryLayout\?\.restore\(document\)/);
 assert.match(css,/surface-clock-group\{align-self:center/);
 assert.match(css,/body:is\(\.embedded-gm,\.embedded-player\).surface-combat-mode \.shell>\.topbar:not\(:has\(\.gm-top-controls:not\(\.hidden\) > \*\)\):not\(:has\(#gmMuteSound:not\(\.hidden\)\)\)/);
 assert.match(css,/#surfaceCombatLayout>\.surface-atb-column,#surfaceCombatLayout>#surfaceArenaLive\{grid-row:auto\}/);
 assert.doesNotMatch(css,/\.surface-combat-clock\{[^}]*grid-column:1\/-1/);
});

test('interior Fit reserves overlapping bottom controls without changing viewport or rotation',()=>{
 const source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
 const helper=source.slice(source.indexOf('  function reserveInteriorControls('),source.indexOf('  const cameraKey='));
 const fit=source.slice(source.indexOf('  function fitInline('),source.indexOf('  function watchFit('));
 for(const rotation of [0,90,180,270])for(const overlap of [true,false]){
  const styles=new Map(),viewport={clientWidth:800,clientHeight:600,scrollLeft:30,scrollTop:60,style:{setProperty:(k,v)=>styles.set(k,v),getPropertyValue:k=>styles.get(k)},getBoundingClientRect:()=>({top:0,bottom:600})};
  const footer={getBoundingClientRect:()=>({top:overlap?530:600,bottom:660})};
  const grid={dataset:{displayRotation:rotation},style:{getPropertyValue:k=>k==='--inline-cols'?12:20}};
  const host={dataset:{inlineShipMap:'s'},querySelector:s=>s==='.inline-map-viewport'?viewport:s==='.inline-map-footer'?footer:grid};
  const sizes=new Map(),c={host,interaction:'view',selectedShipId:'',expandedMap:null,inlineZoom:sizes,manualInlineViews:new WeakSet(),setInlineSize(){},rememberInlineView(){}};
  vm.runInNewContext(helper+fit,c);assert.equal(c.reserveInteriorControls(host),overlap?78:0);c.fitInline(host);
  const size=sizes.get('s'),rows=rotation%180?12:20;assert.ok(size*rows+32<=600-(overlap?78:0));assert.equal(viewport.clientHeight,600);assert.equal(viewport.scrollTop,0);
 }
});
test('clock sizing skips single-PC layout but retains multi-ship sizing and transitions',()=>{
 const start=source.indexOf("  const columns=unitList.querySelector('.ship-combat-columns'),clock="),end=source.indexOf('  const combatSpaceMap=',start),body=source.slice(start,end);
 let reads=0,styles=0,value='old',removes=0;const clock={get offsetHeight(){reads++;return 140;}},columns={dataset:{singlePc:'true'},style:{removeProperty(){removes++;value=null;},setProperty(k,v){assert.equal(k,'--clock-content-height');value=v;}},querySelector:s=>s==='.paired-combat-clock'?clock:{}};
 const c={document:{fonts:{}},innerWidth:1366,innerHeight:768,unitList:{querySelector:()=>columns},getComputedStyle:()=>{styles++;return{paddingTop:'12px',paddingBottom:'8px'};}};
 const helperStart=source.indexOf('let shipClockLayout=null,'),helperEnd=source.indexOf('function renderShipCombatColumns()',helperStart);assert(helperStart>=0&&helperEnd>helperStart);vm.createContext(c);vm.runInContext(source.slice(helperStart,helperEnd),c);
 const run=()=>vm.runInContext('(function(){'+body+'})()',c);
 run();assert.equal(reads,0);assert.equal(styles,0);assert.equal(removes,0);assert.equal(value,'old');
 columns.dataset.singlePc='false';run();assert.equal(value,'120px');assert.equal(reads,1);assert.equal(styles,1);
 columns.dataset.singlePc='true';run();assert.equal(reads,1);assert.equal(styles,1);
 delete columns.dataset.singlePc;run();assert.equal(value,'120px');assert.equal(reads,2);
});

test('player hides other allied interiors while preserving boarding, capture and GM access',()=>{
 const records=[{id:'own',controlType:'pc',ship:{}},{id:'ally',controlType:'pc',ship:{}},{id:'enemy',controlType:'gm',analyzedContact:true,ship:{}},{id:'unknown',contactOnly:true,ship:{}}];
 const ids=html=>[...html.matchAll(/data-inline-ship-map="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids(markup(records,'player',[{id:'mine',location:{starshipId:'own'}}])),['own','enemy']);
 assert.deepEqual(ids(markup(records,'gm')),['own','ally','enemy']);
 assert.deepEqual(ids(markup(records,'player',[{id:'mine',location:{starshipId:'ally'}}])),['ally','enemy']);
 assert.deepEqual(ids(markup(records,'player',[{id:'mine',location:{starshipId:'enemy'},hackingSessions:[{targetId:'ally',connected:true,control:true}]}])),['ally','enemy']);
 assert.deepEqual(ids(markup(records,'player',[{id:'mine',location:{starshipId:'own'},hackingSessions:[{targetId:'ally',connected:false,control:true}]}])),['own','enemy']);
 assert.equal(records.length,4);
});

test('allied docking alone reveals nothing; boarding and returning follow physical location',()=>{
 const records=[{id:'home',controlType:'pc',ship:{},airlockState:{partnerId:'ally'}},{id:'ally',controlType:'pc',ship:{},airlockState:{partnerId:'home'}}];
 const unit={id:'mine',location:{starshipId:'home'}};
 for(const id of ['home','ally','home']){unit.location.starshipId=id;const html=markup(records,'player',[unit]);assert.match(html,new RegExp('data-inline-ship-map="'+id+'"'));assert.equal((html.match(/data-inline-ship-map=/g)||[]).length,1);}
});
