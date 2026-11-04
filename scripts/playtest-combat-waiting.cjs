const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.SA_WAIT_OUT||'../SA-ATB Local Development Files/outputs/waiting-gm-oct31/browser');fs.mkdirSync(out,{recursive:true});
let h;const results=[];
async function main(){
 h=await require('./console-debug.cjs').startHarness({headless:true});h.pc.setDefaultTimeout(12000);await h.pc.bringToFront();
 if(process.env.SA_WAIT_DELAY_ONLY==='1'){
  const actor=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);
  const frame=()=>h.pc.frames().find(f=>f.url().includes('/index.html'));
  const notice=()=>h.pc.getByRole('status').filter({hasText:/^Awaiting GM$/});
  for(let cycle=1;cycle<=2;cycle++){
   await h.fixture.act({action:'nudge',id:actor.id,amount:100});assert.equal((await h.state()).activeId,actor.id);
   await h.fixture.act({action:'requestDelay',id:actor.id,kind:'action',requestedBy:'gm'});assert.equal((await h.state()).delayRequest?.unitId,actor.id);
   await notice().waitFor();assert.equal(await notice().count(),1);assert.equal(await h.pc.locator('.combat-waiting-notice').count(),0);
   await h.pc.reload();await h.pc.locator('[data-character-tab=atb]').click();await frame().waitForFunction(()=>Boolean(window.SACombatBridge?.state()?.delayRequest));await notice().waitFor();assert.equal(await notice().count(),1);
   await h.fixture.act({action:'cancelDelayRequest'});await notice().waitFor({state:'hidden'});assert.equal((await h.state()).delayRequest,null);
   results.push({cycle,reloadIntoDelay:true,noticeCleared:true,noDuplicate:true});
  }
  await h.pc.screenshot({path:path.join(out,'delay-resolved.png')});assert.deepEqual(h.errors,[]);return;
 }
 // Open the actual authenticated PC Combat document directly, outside the
 // harness's default Sensors Console preview and its automatic reopen routing.
 const combatUrl=h.pc.frames().find(f=>f.url().includes('/index.html')).url();await h.pc.goto(combatUrl);
 const frame=()=>h.pc.mainFrame();
 const original=await h.state(),actor=original.units.find(u=>u.characterId===h.fixture.characterId),enemy=original.starships.find(s=>s.id==='debug-target');
 const npcShip=process.env.SA_WAIT_VISIBLE==='1'?original.starships.find(s=>s.id===actor.location.starshipId):enemy;
 await h.fixture.act({action:'addUnit',playerName:'GM',characterName:'Waiting fixture NPC',team:'npc',speed:.1,location:{starshipId:npcShip.id,square:npcShip.ship.gridCells[0],mesh:0}});
 await h.fixture.act({action:'completeTurn',id:actor.id});const npc=(await h.state()).units.find(u=>u.characterName==='Waiting fixture NPC');
 const notice=h.pc.locator('.combat-waiting-notice');
 for(let i=0;i<2;i++){
  await h.fixture.act({action:'nudge',id:npc.id,amount:100});const s=await h.state();assert.equal(s.activeId,npc.id);assert.equal(s.pausedForTurn,true);
  try{await frame().waitForFunction(()=>SACombatBridge.state()?.waitingForGm===true,null,{timeout:12000});}catch(error){results.push({expectedNpc:npc.id,pc:await frame().evaluate(()=>({hidden:document.hidden,state:SACombatBridge.state()})),server:await h.state()});throw error;}
  if(process.env.SA_WAIT_VISIBLE!=='1'){const filtered=await frame().evaluate(()=>SACombatBridge.state());assert.equal(filtered.activeId,null);assert.ok(!filtered.units.some(u=>u.id===npc.id));assert.equal(filtered.hiddenActiveTurn,true);}
  results.push({visibleFixture:process.env.SA_WAIT_VISIBLE==='1',pcWaitState:await frame().evaluate(()=>({state:SACombatBridge.state(),notice:document.querySelector('.combat-waiting-notice')?.outerHTML||null,mode:SACombatBridge.mode()}))});
  await notice.waitFor();assert.equal(await notice.textContent(),'Waiting for GM.');assert.equal(await notice.count(),1);
  const bounds=await notice.boundingBox(),viewport=h.pc.viewportSize();assert.ok(bounds.y<30);assert.ok(Math.abs(bounds.x+bounds.width/2-viewport.width/2)<2);
  if(i===0){await h.pc.waitForTimeout(9000);assert.equal(await notice.isVisible(),true);results.push({persistentBeyondOrdinaryToastLifetime:true,topCentered:bounds});}
  if(i===0){await h.pc.screenshot({path:path.join(out,'pc-waiting.png')});await h.pc.reload();await notice.waitFor();assert.equal(await notice.textContent(),'Waiting for GM.');results.push({reloadIntoWait:true});}
  await h.fixture.act({action:'completeTurn',id:npc.id});await notice.waitFor({state:'detached'});results.push({cycle:i+1,serverPaused:true,pcNoticeVisibleAndCleared:true});
 }
 await h.fixture.act({action:'setHardPaused',paused:true});assert.equal(await notice.count(),0);
 if(process.env.SA_WAIT_CORE_ONLY==='1'){results.push({ordinaryPauseExcluded:true,delayTailNotRun:true});assert.equal(h.errors.length,0,JSON.stringify(h.errors));return;}
 // Delay's existing red notice is owned by the character/Console shell.
 await h.openConsole();await h.pc.bringToFront();
 await h.fixture.act({action:'nudge',id:actor.id,amount:100});assert.equal((await h.state()).activeId,actor.id);
 await h.fixture.act({action:'requestDelay',id:actor.id,kind:'action',requestedBy:'gm'});
 assert.equal((await h.state()).delayRequest?.unitId,actor.id);
 await h.pc.getByRole('status').filter({hasText:/^Awaiting GM$/}).waitFor();assert.equal(await notice.count(),0);
 await h.fixture.act({action:'cancelDelayRequest'});await h.pc.getByRole('status').filter({hasText:/^Awaiting GM$/}).waitFor({state:'hidden'});results.push({manualPauseNoFalseNotice:true,delayNoDuplicate:true});
 assert.equal(h.errors.length,0,JSON.stringify(h.errors));
}
main().catch(error=>{results.push({failure:error.stack});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await h?.stop();console.log(out);});
