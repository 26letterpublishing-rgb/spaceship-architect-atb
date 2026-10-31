const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.SA_LAYOUT_OUT||path.resolve('../SA-ATB Local Development Files/outputs/combat-layout-oct31/browser-'+Date.now());
fs.mkdirSync(out,{recursive:true});
let h;const results=[];
async function main(){
 h=await require('./console-debug.cjs').startHarness({headless:true});
 console.log('owned fixture ready');
 const exit=h.pc.getByRole('button',{name:'Exit Console',exact:true});if(await exit.isVisible())await exit.click();
 const original=await h.state(),actor=original.units.find(u=>u.characterId===h.fixture.characterId);
 if(process.env.SA_LAYOUT_MOVE_ENLARGE==='1'){
  let frame;
  const extra=structuredClone(original.starships[1]);extra.id='move-extra';extra.ship.id=extra.id;extra.title=extra.ship.title='Movement extra ship';extra.ship.confirmedOnce=true;
  const link=await fetch(h.base+'/api/campaign/starship/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,starship:extra.ship,controlType:'gm'})});assert.equal(link.status,201);
  for(const count of [1,2,3].filter(n=>!process.env.SA_MOVE_COUNT||n===Number(process.env.SA_MOVE_COUNT))){
   const page=count===1?h.pc:h.gm;await page.bringToFront();frame=page.frames().find(f=>f.url().includes('/index.html'));
   const fleet=[...original.starships,extra].slice(0,count),ship=fleet[count-1],square=count===3?ship.ship.gridCells[Math.floor(ship.ship.gridCells.length/2)]:ship.ship.gridCells.includes(200)?200:ship.ship.gridCells[0];
   const state=await h.state();await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:state.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:fleet,shipPositions:fleet.map((s,i)=>({id:s.id,q:i*6,r:0})),units:[{characterId:h.fixture.characterId,characterName:'Move Tester',team:'pc',speed:1,commandWindow:600,location:{starshipId:ship.id,square,mesh:4}}]});
   const unit=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);await h.fixture.act({action:'nudge',id:unit.id,amount:100});
   await frame.locator('.ship-combat-lane').last().waitFor();assert.equal(await frame.locator('.ship-combat-lane').count(),count);
   const move=frame.locator('[data-combat-action="move"]').filter({visible:true}).first();await move.waitFor();page.once('dialog',d=>d.accept());await move.click();
   const modal=page.locator('.expanded-interior-dialog[open]');await modal.waitFor();assert.equal(await modal.locator(':scope>section[data-inline-ship-map]').getAttribute('data-inline-ship-map'),ship.id);
   await frame.evaluate(id=>SACombatMap.openMove(SACombatBridge.state().units.find(u=>u.id===id)),unit.id);assert.equal(await page.locator('.expanded-interior-dialog').count(),1);
   await modal.locator('[data-inline-cancel-move]').click();await modal.waitFor({state:'detached'});
   page.once('dialog',d=>d.accept());await move.click();await modal.waitFor();
   await modal.locator('[data-interior-fit]').click();
   const reachable=await modal.locator('[data-map-square][data-map-mesh]').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return e.ownerDocument.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}).map(e=>({square:Number(e.dataset.mapSquare),mesh:Number(e.dataset.mapMesh)})));
   const destination=await frame.evaluate(({id,reachable})=>{for(const cell of reachable){const p=SACombatMap.planMove(id,cell);if(!p.error&&p.route.every(point=>!point.doorKey))return cell;}return null;},{id:unit.id,reachable});assert.ok(destination);
   await modal.locator(`[data-map-square="${destination.square}"][data-map-mesh="${destination.mesh}"]`).click();
   const response=page.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.kind==='move');await modal.locator('[data-inline-confirm-move]').click();const sent=await response;results.push({count,moveResponse:await sent.json(),moveRequest:sent.request().postDataJSON()});assert.equal(sent.status(),200);assert.equal(sent.request().postDataJSON().id,unit.id);assert.equal(sent.request().postDataJSON().route.at(-1).starshipId,ship.id);
   results.push({count,role:count===1?'pc':'gm',correctCurrentShip:ship.id,nativeMove:true,cancelReopen:true,noDuplicate:true,confirmedRoute:true});
   if(await modal.count())await modal.press('Escape');
  }
  assert.deepEqual(h.errors,[]);return;
 }
 if(process.env.SA_LAYOUT_SURFACE==='1'){
  await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:original.encounterId,preparationId:crypto.randomUUID(),mode:'surface',starships:[],shipPositions:[],units:[{characterId:h.fixture.characterId,characterName:'Console Tester',team:'pc',speed:1,location:{environment:'exterior',starshipId:'',square:null,mesh:4}}]});
  for(const page of [h.gm,h.pc]){await page.bringToFront();const f=page.frames().find(f=>f.url().includes('/index.html'));const toggle=f.locator('#visualModeToggle');await toggle.waitFor({state:'visible'});assert.equal(await toggle.textContent(),'Tactical Ring');await toggle.click();await f.locator('#unitList .tactical-ring-svg').waitFor();if(page===h.pc)assert.equal(await f.locator('#unitList .ring-action-btn').count(),0);await page.screenshot({path:path.join(out,infoRole(page)+'-surface-ring.png'),fullPage:true});await toggle.click();await f.locator('#unitList .tactical-ring-svg').waitFor({state:'detached'});assert.equal(await toggle.textContent(),'Tactical Ring');results.push({role:infoRole(page),surfaceBarsRingChoice:true});}assert.deepEqual(h.errors,[]);return;
 }
 if(process.env.SA_LAYOUT_HOLD==='1'){
  const enemy=original.starships.find(s=>s.id==='debug-target');
  const control=await fetch(h.base+'/api/campaign/starship/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,starshipId:enemy.id,controlType:'gm'})});assert.equal(control.status,200);
  await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:original.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:original.starships,shipPositions:original.shipPositions,units:[{characterId:h.fixture.characterId,characterName:'Console Tester',team:'pc',speed:1,commandWindow:600,location:actor.location}]});
  await h.fixture.act({action:'addUnit',playerName:'GM',characterName:'Layout NPC',team:'npc',speed:1,commandWindow:600,location:{starshipId:enemy.id,square:enemy.ship.gridCells[0],mesh:0}});
  const currentActor=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);await h.fixture.act({action:'nudge',id:currentActor.id,amount:100});
  await h.fixture.act({action:'playerCombatAction',kind:'holdConsole',id:currentActor.id,confirmPlayerAction:true});await h.gm.bringToFront();const f=h.gm.frames().find(f=>f.url().includes('/index.html'));await f.locator('.ship-hold-control').waitFor();const collapse=f.locator('.collapse-npc-turn').filter({visible:true});if(await collapse.count())await collapse.first().click();await f.locator('[data-interior-fit]').first().click();
  if(process.env.SA_LAYOUT_STATUS_LIVE_ONLY==='1'){
   for(let i=0;i<7;i++)await h.fixture.act({action:'addUnit',playerName:'GM',characterName:'Status crew '+i,team:'npc',speed:1,location:{starshipId:enemy.id,square:enemy.ship.gridCells[0],mesh:0}});
   const list=f.locator('[data-ship-combat-lane="debug-target"] .ship-crew-status');await list.locator('[data-action="automation"]').nth(7).waitFor();
   const button=list.locator('[data-action="automation"]').last();await button.click();await button.getByText('Automation Off',{exact:true}).waitFor();
   const id=await button.getAttribute('data-id');assert.equal((await h.state()).units.find(u=>u.id===id).automationMode,'npc');
   await list.evaluate(e=>e.scrollTop=60);const top=await list.evaluate(e=>e.scrollTop);assert.ok(top>0);
   await h.fixture.act({action:'setAutomation',id,mode:'off'});await button.getByText('Automate NPC',{exact:true}).waitFor();assert.ok(Math.abs(await list.evaluate(e=>e.scrollTop)-top)<2,'Live status replacement preserves scroll');
   assert.equal(await f.locator('.ship-lane-atb .ship-crew-status').count(),0);assert.equal(await f.locator('[data-ship-side="left"] .crew-automation-controls').count(),0);
   h.gm.once('dialog',d=>d.accept());await f.locator('.ship-hold-control [data-resume-console]').click();await f.locator('.ship-hold-control').waitFor({state:'detached'});
   results.push({statusScrollPreserved:top,automationPointerAndAuthoritativeUpdate:true,heldResume:true});assert.deepEqual(h.errors,[]);return;
  }
  const info=await f.evaluate(()=>{const c=document.querySelector('.paired-combat-clock').getBoundingClientRect(),m=document.querySelector('.combat-space-map').getBoundingClientRect();return {gap:m.top-c.bottom,holding:document.querySelector('.ship-hold-control').textContent}});assert.ok(info.gap>=0&&info.gap<(process.env.SA_LAYOUT_SPACING==='1'?220:100));assert.match(info.holding,/HOLDING 99%/);const rings=await f.locator('.ship-lane-atb .tactical-ring-svg').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert.equal(rings.length,2);assert.ok(Math.abs(rings[0]-rings[1])<2,'Both rings remain on the same horizontal line');results.push({ringTops:rings});
  if(process.env.SA_LAYOUT_CAPTURE_ONLY==='1'){
   await f.locator('[data-preparation-notice]').waitFor({state:'detached',timeout:8500});
   for(const [width,height] of [[1920,1080],[1366,768]]){
    await h.gm.setViewportSize({width,height});await f.locator('[data-combat-space-fit]').click();await f.locator('.shared-interior-controls').scrollIntoViewIfNeeded();
    await h.gm.screenshot({path:path.join(out,`holding-layout-${width}.png`),fullPage:true});if(process.env.SA_LAYOUT_HEADER==='1'){await h.gm.evaluate(()=>scrollTo(0,0));await h.gm.screenshot({path:path.join(out,`viewport-${width}.png`)});results.push({width,floorplanViewport:await f.locator('.ship-lane-map').evaluateAll(es=>es.slice(0,2).map(e=>({top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height}))),frameTop:(await f.frameElement()).boundingBox?await (await f.frameElement()).boundingBox():null});}
   }
   results.push({reviewCapturesAfterNaturalNoticeExpiry:true});assert.deepEqual(h.errors,[]);return;
  }
  if(process.env.SA_LAYOUT_NOTICE_DIAG==='1'){
   for(const page of [h.gm])for(const frame of page.frames())results.push({noticeFrame:frame.url(),notices:await frame.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.includes('Encounter prepared and paused'))).map(e=>({html:e.outerHTML,ancestors:[e,e.parentElement,e.parentElement?.parentElement].filter(Boolean).map(n=>({tag:n.tagName,id:n.id,cls:n.className,position:getComputedStyle(n).position,top:getComputedStyle(n).top,bottom:getComputedStyle(n).bottom,transform:getComputedStyle(n).transform}))})))});
   return;
  }

  if(process.env.SA_LAYOUT_STATUS==='1')await f.locator('[data-preparation-notice]').waitFor({state:'detached',timeout:8500});
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720]].filter(([w])=>!process.env.SA_LAYOUT_NOTICE_WIDTH||w===Number(process.env.SA_LAYOUT_NOTICE_WIDTH))){
   await h.gm.setViewportSize({width,height});await f.locator('[data-interior-fit]').first().click();
   const spacing=await f.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};const panel=document.querySelector('#initiativePanel'),head=panel.querySelector(':scope>.section-head'),tiles=document.querySelector('.shared-interior-controls');return {panel:rect(panel),header:rect(head),headerStyle:{margin:getComputedStyle(head).margin,padding:getComputedStyle(head).padding},tiles:rect(tiles),list:rect(document.querySelector('#unitList')),map:rect(document.querySelector('.combat-space-map')),rings:[...document.querySelectorAll('.ship-lane-atb')].map(rect),ringSvg:[...document.querySelectorAll('.ship-lane-atb .tactical-ring-svg')].map(e=>({...rect(e),cssWidth:parseFloat(getComputedStyle(e).width)})),clockButton:rect(document.querySelector('#gmPanicPause'))};});results.push({width,spacing});
   if(process.env.SA_LAYOUT_SPACING==='1'&&process.env.SA_LAYOUT_INWARD!=='1'){
    assert.ok(spacing.tiles.y-spacing.panel.y<15,'No unused header row above toggles');
    assert.ok(Math.abs(spacing.map.x-spacing.rings[0].x)<2,'Map uses reclaimed left ring-column width');
    assert.ok(Math.abs(spacing.map.x+spacing.map.width-spacing.rings[1].x-spacing.rings[1].width)<2,'Map uses reclaimed right ring-column width');
    assert.ok(spacing.map.y>=Math.max(...spacing.rings.map(r=>r.bottom)),'Map never covers ring controls');
    assert.ok(Math.abs(spacing.rings[0].y-spacing.rings[1].y)<2,'Ring alignment preserved');assert.ok(spacing.ringSvg.every(r=>Math.abs(r.cssWidth-190)<2),'Requested larger rings');assert.ok(spacing.clockButton.width<=421,'Narrow centered clock button');
   }
   if(process.env.SA_LAYOUT_STATUS==='1')await statusLayoutCheck(f,width,false);
   if(process.env.SA_LAYOUT_HEADER==='1')await saveHeaderCheck(h.gm,width);
   if(process.env.SA_LAYOUT_HEADER==='1'){await h.gm.evaluate(()=>scrollTo(0,0));await h.gm.screenshot({path:path.join(out,`viewport-${width}.png`)});results.push({width,floorplanViewport:await f.locator('.ship-lane-map').evaluateAll(es=>es.slice(0,2).map(e=>({top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height}))),frame:await (await f.frameElement()).boundingBox()});}
   if(process.env.SA_LAYOUT_INWARD==='1'){await inwardCheck(f,width,false);if(process.env.SA_LAYOUT_PREP_NOTICE==='1')await preparationNoticeCheck(f,width);}
   if(process.env.SA_LAYOUT_LOWER==='1'){
    const lower=await f.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right}};return {bodyClass:document.body.className,topbarHtml:document.querySelector('#topbar').innerHTML,shellChildren:[...document.querySelector('.shell').children].map(e=>({id:e.id,classes:e.className,text:e.textContent.trim().slice(0,80),rect:r(e),display:getComputedStyle(e).display})),utility:r(document.querySelector('.paired-combat-utilities')),left:r(document.querySelector('.paired-combat-utility-left')),encounter:r(document.querySelector('#gmPanel')),visibility:r(document.querySelector('#surfaceArenaLive')),recovery:r(document.querySelector('.combat-recovery-toolbar')),fonts:[...document.querySelectorAll('.ship-summary-stats>span')].map(e=>({label:parseFloat(getComputedStyle(e.querySelector('small')).fontSize),value:parseFloat(getComputedStyle(e.querySelector('strong')).fontSize)}))};});
    results.push({width,lower});assert.equal(lower.shellChildren.find(e=>e.id==='topbar')?.rect.height,0);assert.ok(lower.encounter.x>=lower.left.right);assert.ok(Math.abs(lower.encounter.width-lower.left.width)<2);assert.ok(lower.recovery.y>lower.visibility.y);assert.ok(lower.recovery.right<=lower.left.right+1);assert.ok(lower.fonts.every(x=>x.label>=13&&x.value>=16));
   }
   await h.gm.screenshot({path:path.join(out,`holding-layout-${width}.png`),fullPage:true});
  }
  if(process.env.SA_LAYOUT_PREP_NOTICE==='1'){await f.locator('[data-preparation-notice]').waitFor({state:'detached',timeout:8500});results.push({preparationNoticeExpiredWithoutAction:true});}
  if(process.env.SA_LAYOUT_SPACING==='1'){
   await f.locator('.combat-space-map [data-space-enlarge]').click();await h.gm.locator('.space-map-dialog[open]').waitFor();await h.gm.getByRole('button',{name:'Close dialog',exact:true}).filter({visible:true}).last().click();await h.gm.locator('.space-map-dialog').waitFor({state:'detached'});results.push({spaceEnlargeClose:true});
  }
  h.gm.once('dialog',dialog=>dialog.accept());await f.locator('.ship-hold-control [data-resume-console]').click();await f.locator('.ship-hold-control').waitFor({state:'detached'});results.push({holdingResume:true,...info});
  if(process.env.SA_LAYOUT_LOWER==='1'){
   await f.evaluate(()=>{parent.qaRecovery=document.querySelector('.combat-recovery-toolbar');});
   await f.locator('#restoreLastCombat').click();const cancel=h.gm.getByRole('button',{name:'Cancel',exact:true}).filter({visible:true}).last();await cancel.waitFor();await cancel.click();
   await f.locator('#returnToEncounterSetup').click();await h.gm.locator('#atbSetup').waitFor({state:'visible'});assert.ok(await h.gm.evaluate(()=>document.querySelector('.combat-recovery-toolbar')===qaRecovery));
   await h.gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();await f.locator('.paired-combat-recovery .combat-recovery-toolbar').waitFor();assert.ok(await f.evaluate(()=>document.querySelector('.combat-recovery-toolbar')===parent.qaRecovery));
   await f.evaluate(()=>location.reload());await f.locator('.paired-combat-recovery .combat-recovery-toolbar').waitFor();assert.ok(await f.evaluate(()=>document.querySelector('.combat-recovery-toolbar')===parent.qaRecovery));results.push({sameRecoveryNodeAfterSetupReload:true,restorePromptCancelled:true});
  }
  if(process.env.SA_LAYOUT_INWARD==='1'){
   const state=await h.state();await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:state.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:[original.starships.find(s=>s.id===actor.location.starshipId)],shipPositions:original.shipPositions.filter(p=>p.id===actor.location.starshipId),units:[{characterId:h.fixture.characterId,characterName:'Console Tester',team:'pc',speed:1,location:actor.location}]});
   await h.pc.bringToFront();const pc=h.pc.frames().find(f=>f.url().includes('/index.html'));await pc.locator('[data-single-pc=true]').waitFor();const closeConsole=h.pc.getByRole('button',{name:'Exit Console',exact:true});if(await closeConsole.isVisible())await closeConsole.click();
   for(const [width,height] of [[1920,1080],[1366,768],[1280,720]].filter(([w])=>!process.env.SA_LAYOUT_NOTICE_WIDTH||w===Number(process.env.SA_LAYOUT_NOTICE_WIDTH))){await h.pc.setViewportSize({width,height});await inwardCheck(pc,width,true);if(process.env.SA_LAYOUT_STATUS==='1')await statusLayoutCheck(pc,width,true);await h.pc.screenshot({path:path.join(out,`single-pc-${width}.png`),fullPage:true});}
  }
  if(process.env.SA_LAYOUT_HEADER==='1'){
   await h.gm.bringToFront();await h.gm.getByRole('button',{name:'Campaign',exact:true}).click();
   const pattern='**/api/campaign/checkpoints?**';await h.gm.route(pattern,route=>route.fulfill({json:{checkpoints:[]}}));
   await h.gm.locator('#combatSaveStatus').getByText('No combat save yet.',{exact:false}).waitFor({timeout:18000});
   await h.gm.unroute(pattern);await h.gm.locator('#combatSaveStatus').getByText('Last combat save:',{exact:false}).waitFor({timeout:18000});
   const saved=await h.gm.locator('#combatSaveStatus').textContent();await h.gm.reload();await h.gm.locator('#combatSaveStatus').getByText('Last combat save:',{exact:false}).waitFor();assert.equal(await h.gm.locator('#combatSaveStatus').count(),1);assert.equal(await h.gm.locator('#liveEncounterCode').count(),0);
   results.push({saveHeader:{outsideCombatPolling:true,noSaveResponse:true,restoredRealSavedValue:saved,reload:true}});
  }
  assert.deepEqual(h.errors,[]);return;
 }
 if(process.env.SA_LAYOUT_CORRECTION==='1'){await correctionChecks(original,actor);assert.deepEqual(h.errors,[]);return;}
 await h.fixture.act({action:'completeTurn',id:actor.id});
 if(process.env.SA_LAYOUT_COUNTS_ONLY!=='1'){
 for(const page of [h.gm,h.pc]){
  await page.bringToFront();
  page.setDefaultTimeout(15000);
  const notice=page.getByRole('button',{name:'Dismiss All hands on deck',exact:true});if(await notice.isVisible())await notice.click();
  const frame=page.frames().find(f=>f.url().includes('/index.html'))||page;
  await frame.waitForFunction(()=>document.querySelector('.paired-combat-layout .shared-interior-controls input'),null,{timeout:20000});
  const collapse=frame.locator('.collapse-npc-turn,.collapse-player-turn').filter({visible:true}).first();if(await collapse.count())await collapse.click();
  for(const [width,height] of (process.env.SA_LAYOUT_TOGGLES_ONLY==='1'?[[1366,768]]:[[1920,1080],[1366,768],[1280,720]])){
   await page.setViewportSize({width,height});
   await frame.locator('.ship-lane-map [data-interior-fit]').first().click();
   const info=await frame.evaluate(()=>({role:SACombatBridge.mode(),lanes:document.querySelectorAll('.ship-combat-lane').length,toggles:document.querySelectorAll('.shared-interior-controls input').length,clock:document.querySelectorAll('.paired-combat-clock #activePanel').length,space:document.querySelectorAll('.ship-combat-columns>.combat-space-map').length,rects:[...document.querySelectorAll('.paired-ship-summary,.ship-lane-atb,.ship-lane-map,.paired-combat-clock,.combat-space-map')].map(e=>({class:e.className,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),errors:[]}));
   results.push({width,...info});assert.equal(info.toggles,6);assert.equal(info.clock,1);assert.equal(info.space,1);
   await page.screenshot({path:path.join(out,`${info.role}-${width}.png`),fullPage:true});
  }
  await frame.evaluate(()=>{window.layoutToggleEvents=[];for(const type of ['click','change'])document.addEventListener(type,e=>{if(e.target.closest?.('.shared-interior-controls'))layoutToggleEvents.push({type,key:e.target.dataset.sharedInteriorView,tag:e.target.tagName,checked:e.target.checked,prevented:e.defaultPrevented});});});
  for(const key of ['labels','highResolution','combatMesh','walls','stations','hull']){
   const control=frame.locator(`[data-shared-interior-view=${key}]`),before=await control.isChecked();await control.locator('..').click();await frame.waitForFunction(({key,value})=>document.querySelector(`[data-shared-interior-view=${key}]`).checked===value&&SAShipMap.loadViewPreferences()[key]===value,{key,value:!before},{timeout:5000});results.push({key,before,after:await control.isChecked(),events:await frame.evaluate(()=>layoutToggleEvents.splice(0))});assert.equal(await control.isChecked(),!before,'pointer toggle '+key);
   assert.equal(await frame.evaluate(k=>SAShipMap.loadViewPreferences()[k],key),!before);
   if(key==='hull')assert.ok(await frame.locator('[data-shared-interior-view=walls]').isDisabled());
   await control.locator('..').click();await frame.waitForFunction(({key,value})=>document.querySelector(`[data-shared-interior-view=${key}]`).checked===value&&SAShipMap.loadViewPreferences()[key]===value,{key,value:before},{timeout:5000});results.push({key,restore:await control.isChecked(),events:await frame.evaluate(()=>layoutToggleEvents.splice(0))});assert.equal(await control.isChecked(),before,'pointer restore '+key);
  }
  const host=frame.locator('.ship-lane-map').first();await host.locator('[data-expand-interior]').click();
  const enlarged=page.locator('.expanded-interior-dialog[open]');await enlarged.waitFor();
  const dashboard=enlarged.locator('.combat-ship-dashboard');await dashboard.waitFor();
  const sheet=await (await dashboard.elementHandle()).contentFrame();try{await sheet.locator('.combat-dashboard-only .construction-stat-preview').waitFor({state:'visible',timeout:20000});}catch(e){results.push({dashboardBody:await sheet.locator('body').innerText(),errors:h.errors});await page.screenshot({path:path.join(out,'dashboard-failure.png')});throw e;}
  assert.equal(await enlarged.locator('.inline-map-view-controls input').count(),6);
  for(const key of ['labels','highResolution','combatMesh','walls','stations','hull']){const c=enlarged.locator(`[data-shared-interior-view=${key}]`),old=await c.isChecked();await c.locator('..').click();assert.equal(await frame.locator(`[data-shared-interior-view=${key}]`).isChecked(),!old);await c.locator('..').click();assert.equal(await c.isChecked(),old,'expanded pointer restore '+key);}
  const stats=enlarged.locator('.combat-dashboard-live');await stats.scrollIntoViewIfNeeded();const dimensions=await stats.evaluate(e=>({count:e.children.length,height:e.getBoundingClientRect().height,groups:[...e.children].map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}))}));assert.equal(dimensions.count,9);assert.ok(dimensions.height<85);assert.ok(dimensions.groups.every(g=>g.h<50));await stats.screenshot({path:path.join(out,`${infoRole(page)}-compact-stats.png`)});results.push({role:infoRole(page),enlargedSharedToggles:true,compactStats:dimensions});
  if(page===h.gm){
   const current=(await h.state()).starships.find(s=>s.id==='debug-ship').auState.current;
   await h.fixture.act({action:'spendShipAu',starshipId:'debug-ship',amount:1});
   await page.waitForFunction(value=>[...document.querySelectorAll('.combat-dashboard-live span')].some(s=>s.querySelector('small')?.textContent==='AU'&&s.querySelector('strong')?.textContent.startsWith(value+'/')),current-1,{timeout:10000});
   results.push({authoritativeDashboardAuRefresh:true});
  }
  await enlarged.screenshot({path:path.join(out,`${infoRole(page)}-enlarged.png`)});
  await dashboard.scrollIntoViewIfNeeded();await dashboard.screenshot({path:path.join(out,`${infoRole(page)}-dashboard.png`)});
  await enlarged.getByRole('button',{name:'Close dialog',exact:true}).click();await enlarged.waitFor({state:'detached'});
  await host.locator('[data-expand-interior]').click();await page.locator('.expanded-interior-dialog[open]').waitFor();await page.locator('.expanded-interior-dialog[open]').press('Escape');await page.locator('.expanded-interior-dialog').waitFor({state:'detached'});
  results.push({role:infoRole(page),sharedToggle:true,enlargedDashboard:true});
 }
 if(process.env.SA_LAYOUT_TOGGLES_ONLY==='1'){assert.deepEqual(h.errors,[]);return;}
 const pc=h.pc.frames().find(f=>f.url().includes('index.html'));
 await h.fixture.act({action:'nudge',id:actor.id,amount:100});await h.pc.bringToFront();
 await pc.evaluate(id=>SACombatMap.openMove(SACombatBridge.state().units.find(u=>u.id===id)),actor.id);
 const moving=h.pc.locator('.expanded-interior-dialog [data-inline-ship-map="debug-ship"]');await moving.waitFor();
 await moving.locator('[data-inline-cancel-move]').click();await moving.waitFor({state:'detached'});assert.equal(await moving.locator('[data-inline-confirm-move]').count(),0);
 await pc.evaluate(id=>SACombatMap.openMove(SACombatBridge.state().units.find(u=>u.id===id)),actor.id);
 await moving.locator('[data-interior-fit]').click();await moving.locator('[data-map-square="201"][data-map-mesh="4"]').click();
 const confirm=moving.locator('[data-inline-confirm-move]');assert.ok(await confirm.isEnabled());
 const response=h.pc.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.kind==='move');
 await confirm.click();const sent=await response;assert.equal(sent.status(),200);assert.equal(sent.request().postDataJSON().route.at(-1).square,201);
 results.push({actualMoveConfirmAndCancel:true});
 }
 const extra=[];
 for(let i=2;i<6;i++){
  const record={...structuredClone(original.starships[1]),id:'layout-'+i,title:'Layout ship '+i};record.ship.id=record.id;record.ship.title=record.title;record.ship.confirmedOnce=true;
  const response=await fetch(h.base+'/api/campaign/starship/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,starship:record.ship,controlType:'gm'})});const linked=await response.json();assert.equal(response.status,201,linked.error||'Ship creation must return 201');extra.push(record);
 }
 for(const count of [1,3,6]){
  const fleet=[...original.starships,...extra].slice(0,count);
  const current=await h.state();
  await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:current.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:fleet,shipPositions:fleet.map((s,i)=>({id:s.id,q:i*7,r:0})),units:[{characterId:h.fixture.characterId,characterName:'Console Tester',team:'pc',speed:.1,commandWindow:600,location:{starshipId:fleet[0].id,square:200,mesh:0,stationed:true}}]});
  await h.gm.bringToFront();const gm=h.gm.frames().find(f=>f.url().includes('index.html'));
  await gm.waitForFunction(n=>document.querySelectorAll('.ship-combat-lane').length===n,count,{timeout:15000});
  const rects=await gm.locator('.ship-lane-map').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
  const sides=await gm.locator('.ship-combat-lane').evaluateAll(es=>es.map(e=>e.dataset.shipSide));
  for(const side of ['left','right']){const same=rects.filter((r,i)=>sides[i]===side);for(let i=1;i<same.length;i++){assert.ok(same[i].y>same[i-1].y);assert.equal(same[i].x,same[0].x);assert.ok(Math.abs(same[i].width-same[0].width)<2);}}
  assert.equal(await gm.locator('.paired-combat-clock #activePanel').count(),1);assert.equal(await gm.locator('.combat-space-map').count(),1);
  if(count===1){
   await h.pc.bringToFront();const pc=h.pc.frames().find(f=>f.url().includes('index.html'));await pc.waitForFunction(()=>document.querySelector('[data-single-pc=true]'),null,{timeout:15000});
   const width=await pc.locator('.ship-lane-map').evaluate(e=>({map:e.clientWidth,all:e.closest('.ship-combat-columns').clientWidth}));assert.ok(width.map>=width.all-2);
   await h.pc.screenshot({path:path.join(out,'player-one-ship.png'),fullPage:true});await h.gm.bringToFront();
  }
  await h.gm.screenshot({path:path.join(out,`gm-${count}-ships.png`),fullPage:true});results.push({count,rects});
 }
 assert.deepEqual(h.errors,[]);
}

async function preparationNoticeCheck(frame,width){
 const notice=frame.locator('.paired-combat-clock>[data-preparation-notice]');await notice.waitFor({state:'visible'});
 const metrics=await frame.evaluate(()=>{const b=document.querySelector('#gmPanicPause'),n=document.querySelector('[data-preparation-notice]'),r=e=>{const a=e.getBoundingClientRect();return{x:a.x,y:a.y,w:a.width,h:a.height,bottom:a.bottom}};return{button:r(b),notice:r(n),text:n.textContent,inside:n.closest('.paired-combat-clock')!==null}});
 assert.equal(metrics.text,'Encounter prepared and paused. Engage the clock when ready.');assert.ok(metrics.notice.y>=metrics.button.bottom);assert.ok(metrics.notice.w<=metrics.button.w+1);assert.ok(metrics.inside);await frame.locator('#gmPanicPause').click({trial:true});await notice.evaluate(e=>{e.dataset.qaPointerClicks='0';e.addEventListener('click',()=>e.dataset.qaPointerClicks=String(Number(e.dataset.qaPointerClicks)+1),{once:true});});const frameBox=await (await frame.frameElement()).boundingBox();const point=await notice.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,hit:document.elementFromPoint(x,y)===e};});assert.ok(point.hit);await frame.page().mouse.click(frameBox.x+point.x,frameBox.y+point.y);assert.equal(await notice.getAttribute('data-qa-pointer-clicks'),'1');await notice.waitFor({state:'visible'});results.push({width,preparationNotice:metrics,beginPointerReachable:true,noticePointerReachable:true});
}

async function saveHeaderCheck(page,width){
 await page.locator('#combatSaveStatus').getByText('Last combat save:',{exact:false}).waitFor();
 const r=await page.evaluate(()=>{const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height,overflow:e.scrollWidth>e.clientWidth+1}};return{save:rect(document.querySelector('#combatSaveStatus')),clock:rect(document.querySelector('#universeClock')),heading:rect(document.querySelector('.universe-header-identity')),actions:rect(document.querySelector('.gm-header-actions')),header:rect(document.querySelector('.gm-header')),count:document.querySelectorAll('#combatSaveStatus').length,primaryCode:document.querySelector('#campaignCodeHeading').textContent,oldCode:!!document.querySelector('#liveEncounterCode')};});
 assert.equal(r.count,1);assert.equal(r.oldCode,false);assert.ok(r.primaryCode.trim());assert.ok(r.heading.right<=r.save.x+1&&r.save.right<=r.clock.x+1&&r.clock.right<=r.actions.x+1);assert.ok(r.actions.right<=width);assert.equal(r.save.overflow,false);results.push({width,saveHeader:r});
}

async function statusLayoutCheck(frame,width,single){
 const m=await frame.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};return {clock:r(document.querySelector('.paired-combat-clock')),tiles:r(document.querySelector('.shared-interior-controls')),readyInClock:!!document.querySelector('.paired-combat-clock #activePanel>#readyCount'),map:r(document.querySelector('.combat-space-map .space-map')),canvas:r(document.querySelector('.combat-space-map [data-space-canvas]')),toolbar:r(document.querySelector('.combat-space-map .space-map>header')),ships:[...document.querySelectorAll('.ship-combat-lane')].map(e=>({summary:r(e.querySelector('.paired-ship-summary')),ring:r(e.querySelector('.tactical-ring-svg')),status:r(e.querySelector('.ship-crew-status')),au:r(e.querySelector('.ship-au-panel')),statusInSummary:!!e.querySelector('.paired-ship-summary>.ship-crew-status'),statusInRing:!!e.querySelector('.ship-lane-atb .ship-crew-status')}))}});
 const held=frame.locator('.ship-ring-holds .ship-hold-control');if(await held.count()){const pos=await held.first().evaluate(e=>{const a=e.getBoundingClientRect(),r=e.closest('.ship-lane-atb').querySelector('.ring-stage').getBoundingClientRect();const tiles=document.querySelector('.shared-interior-controls').getBoundingClientRect();return {center:Math.abs(a.x+a.width/2-r.x-r.width/2),top:a.top,bottom:a.bottom,ringTop:r.top,toggleBottom:tiles.bottom};});assert.ok(pos.center<3,'Holding controls centered at their ring top');assert.ok(pos.top>=pos.toggleBottom,'Holding overlay never covers shared toggles');await held.first().locator('[data-resume-console]').click({trial:true});results.push({width,holdOverlay:pos});}
 results.push({width,single,statusLayout:m});assert.equal(m.readyInClock,true);assert.equal(m.map.h,width>1440?300:240);assert.ok(m.canvas.h>=m.map.h-5,'Actual SVG fills the resized map viewport');
 for(const ship of m.ships){assert.ok(ship.statusInSummary&&!ship.statusInRing);assert.ok(ship.status.bottom<=ship.au.y+1);if(!single){assert.ok(Math.abs(ship.summary.y-m.tiles.y)<3,'Summary aligns with toggles');assert.ok(Math.abs(ship.ring.y-m.clock.y)<8,'Ring visual top aligns with clock');}}
 assert.ok(Math.abs(m.toolbar.x+m.toolbar.w/2-m.map.x-m.map.w/2)<2);assert.ok(m.toolbar.bottom<=m.map.bottom&&m.toolbar.y>m.map.bottom-65);
 const canvas=frame.locator('.combat-space-map [data-space-canvas]');const before=await canvas.getAttribute('viewBox');
 await frame.locator('[data-combat-space-zoom=".7"]').click();assert.notEqual(await canvas.getAttribute('viewBox'),before);await frame.locator('[data-combat-space-zoom="1.4"]').click();await frame.locator('[data-combat-space-fit]').click();assert.equal(await canvas.getAttribute('data-user-view-box'),null);
}

async function inwardCheck(frame,width,single){
 const m=await frame.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};return {clock:r(document.querySelector('.paired-combat-clock')),panel:r(document.querySelector('#activePanel')),button:document.querySelector('#gmPanicPause')?.getClientRects().length?r(document.querySelector('#gmPanicPause')):null,map:r(document.querySelector('.combat-space-map')),lanes:[...document.querySelectorAll('.ship-lane-atb')].map(e=>({side:e.closest('[data-ship-side]').dataset.shipSide,lane:r(e),stage:r(e.querySelector('.ring-stage')),svg:r(e.querySelector('.tactical-ring-svg')),svgWidth:parseFloat(getComputedStyle(e.querySelector('.tactical-ring-svg')).width),legend:r(e.querySelector('.ring-legend')),legendText:e.querySelector('.ring-legend').textContent,legendOverflow:e.querySelector('.ring-legend').scrollWidth>e.querySelector('.ring-legend').clientWidth}))}});
 results.push({width,single,inward:m});
 assert.ok(m.clock.w<=421);if(m.button)assert.ok(Math.abs(m.panel.w-m.button.w)<2);
 for(const l of m.lanes){assert.match(l.legendText,/Reload\/Recovery/);assert.match(l.legendText,/Delayed Resolution/);assert.equal(l.legendOverflow,false);assert.ok(!single&&l.side==='right'?l.legend.right<=l.stage.x+1:l.legend.x>=l.stage.right-1);assert.ok(l.legend.y<l.stage.bottom&&l.legend.bottom>l.stage.y);assert.ok(l.lane.x>=0&&l.lane.right<=width);assert.ok(l.svgWidth>190,'Ring grows beyond prior190px');}
 if(!single){assert.ok(Math.abs(m.lanes[0].stage.y-m.lanes[1].stage.y)<2);assert.ok(m.lanes[0].lane.right<=m.clock.x+1);assert.ok(m.lanes[1].lane.x>=m.clock.right-1);assert.ok(m.map.w>=({1920:1334,1366:975,1280:919}[width]));}
}

async function correctionChecks(original,actor){
 if(process.env.SA_LAYOUT_CORRECTION_TAIL!=='1'){
 for(const page of [h.gm,h.pc]){
  await page.bringToFront();const frame=page.frames().find(f=>f.url().includes('/index.html')),role=infoRole(page);
  const notice=page.getByRole('button',{name:'Dismiss All hands on deck',exact:true});if(await notice.isVisible())await notice.click();
  const panel=frame.locator(page===h.pc?'#myTurnBanner':'#turnDialog');
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720]].filter(([w])=>!process.env.SA_LAYOUT_NOTICE_WIDTH||w===Number(process.env.SA_LAYOUT_NOTICE_WIDTH))){
   await page.setViewportSize({width,height});await panel.waitFor({state:'visible'});
   const metrics=await frame.evaluate(()=>{const p=document.querySelector(document.body.classList.contains('player-mode')?'#myTurnBanner':'#turnDialog'),r=p.getBoundingClientRect();return {x:r.x,width:r.width,scroll:getComputedStyle(p).overflowY,buttons:[...p.querySelectorAll('[data-station-order]')].filter(e=>e.getClientRects().length).map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)})),tiles:[...document.querySelectorAll('.shared-interior-controls label')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,style:getComputedStyle(e,'::before').backgroundImage,text:getComputedStyle(e.querySelector('span')).textTransform}))}});
   assert.ok(metrics.x<30,'PC action panel must be left for both viewers');assert.equal(metrics.scroll,'auto');assert.ok(metrics.tiles.every(t=>t.height===44&&t.width===123&&t.text==='uppercase'));assert.ok(metrics.buttons.every(b=>b.height<50&&b.font<=14));
   const last=panel.locator('button').filter({visible:true}).last();await last.scrollIntoViewIfNeeded();await last.focus();const reachable=await last.evaluate(e=>{const p=e.closest('#myTurnBanner,#turnDialog'),a=e.getBoundingClientRect(),b=p.getBoundingClientRect();return a.bottom<=b.bottom+1&&a.top>=b.top-1});assert.ok(reachable,'Final action reachable inside scroll area');
   await panel.evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,`${role}-${width}-actions.png`),fullPage:true});results.push({role,width,...metrics});
  }
  const collapse=frame.locator(page===h.pc?'.collapse-player-turn':'.collapse-npc-turn').filter({visible:true}).first();await collapse.click();
  const enlarge=frame.locator('.combat-space-map [data-space-enlarge]');
  for(let i=0;i<2;i++){await enlarge.click();const d=page.locator('.space-map-dialog[open]');await d.waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).filter({visible:true}).last().click();await d.waitFor({state:'detached'});}
  await page.screenshot({path:path.join(out,`${role}-normal-map.png`),fullPage:true});results.push({role,spaceMapEnlargeCloseReopen:true});
  if(page===h.gm){await frame.locator('#gmPanel').scrollIntoViewIfNeeded();const inputs=await frame.locator('#gmPanel .add-grid select').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert.ok(inputs.every(w=>w<220));await page.screenshot({path:path.join(out,'encounter-compact.png'),fullPage:true});}
 }
 }
 const gm=h.gm.frames().find(f=>f.url().includes('/index.html'));await h.gm.bringToFront();
 const enemy=original.starships.find(s=>s.id==='debug-target');
 await h.fixture.act({action:'addUnit',playerName:'GM',characterName:'Layout NPC',team:'npc',speed:1,commandWindow:600,location:{starshipId:enemy.id,square:enemy.ship.gridCells[0],mesh:0}});
 await h.fixture.act({action:'completeTurn',id:actor.id});const npc=(await h.state()).units.find(u=>u.characterName==='Layout NPC');await h.fixture.act({action:'nudge',id:npc.id,amount:100});
 await gm.waitForFunction(()=>document.querySelector('#activeName').textContent.includes('Layout NPC'));
 const box=await gm.locator('#turnDialog').boundingBox();const innerWidth=await gm.evaluate(()=>innerWidth);assert.ok(box.x>innerWidth/2,'NPC action panel on right');await h.gm.screenshot({path:path.join(out,'npc-actions-right.png'),fullPage:true});results.push({npcPanelRight:true});
 const control=await fetch(h.base+'/api/campaign/starship/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,starshipId:enemy.id,controlType:'gm'})});assert.equal(control.status,200);
 const current=await h.state();
 await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:current.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:original.starships,shipPositions:original.shipPositions,units:[{characterId:h.fixture.characterId,characterName:'Console Tester',team:'pc',speed:.1,commandWindow:600,location:actor.location}]});
 const begin=gm.getByRole('button',{name:'Begin Combat, and Engage Clock!!',exact:true});await begin.waitFor();await begin.scrollIntoViewIfNeeded();const center=await begin.evaluate(e=>{const b=e.getBoundingClientRect(),p=e.closest('.paired-combat-clock').getBoundingClientRect();return Math.abs(b.x+b.width/2-p.x-p.width/2)});assert.ok(center<2);await h.gm.screenshot({path:path.join(out,'begin-centered.png'),fullPage:true});results.push({beginCentered:true});
 await gm.waitForFunction(()=>document.querySelector('[data-ship-combat-lane="debug-target"]').dataset.shipSide==='right');
 const fleet=[...original.starships];for(let i=0;i<2;i++){const ship=structuredClone(enemy.ship);ship.id='side-npc-'+i;ship.title='NPC '+i;ship.confirmedOnce=true;const response=await fetch(h.base+'/api/campaign/starship/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,starship:ship,controlType:'gm'})});assert.equal(response.status,201);fleet.push({id:ship.id,title:ship.title,ship,controlType:'gm'});}
 const next=await h.state();await h.fixture.act({action:'prepareEncounter',confirmCampaignName:`Sensors ${h.fixture.tier} debug / ${h.fixture.scenario}`,expectedEncounterId:next.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:fleet,shipPositions:fleet.map((s,i)=>({id:s.id,q:i*6,r:0})),units:[{characterId:h.fixture.characterId,characterName:'Console Tester',team:'pc',speed:.1,commandWindow:600,location:actor.location}]});
 await gm.waitForFunction(()=>document.querySelectorAll('.ship-combat-lane').length===4);
 const lanes=await gm.locator('.ship-combat-lane').evaluateAll(es=>es.map(e=>({id:e.dataset.shipCombatLane,side:e.dataset.shipSide,row:e.style.getPropertyValue('--pair-row'),rotation:e.querySelector('[data-display-rotation]')?.dataset.displayRotation})));
 assert.deepEqual(lanes.map(e=>e.side),['left','right','right','right']);assert.deepEqual(lanes.map(e=>Number(e.row)),[2,2,6,10]);await h.gm.screenshot({path:path.join(out,'unequal-sides.png'),fullPage:true});results.push({unequalSides:lanes});
}


function infoRole(page){return page===h.gm?'gm':'player';}
main().catch(e=>{results.push({failure:e.stack});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(h)await h.stop();console.log(out);});
