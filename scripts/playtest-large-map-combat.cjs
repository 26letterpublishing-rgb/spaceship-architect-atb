const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','large-map-combat');fs.mkdirSync(out,{recursive:true});let child,browser,pc;const errors=[];
async function main(){
  child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-large-map-'))},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
  const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
  const start=await post('campaign/showcase/start',{}),code=start.code,token=start.gmToken,player=start.players[0];
  const state=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json()),act=body=>post('action',{roomCode:code,gmToken:token,...body});
  let s=await state();const ship=s.starships.find(s=>s.crewCharacterIds.includes(player.id)),unit=s.units.find(u=>u.characterId===player.id),square=ship.ship.placements.find(p=>p.sicId===unit.location.sicId)?.cell||unit.location.square;
  await act({action:'prepareEncounter',mode:'starship',preparationId:'large-sheet-movement',starships:s.starships,shipPositions:s.shipPositions,units:s.units.map(u=>({...u,preparationUnitId:u.id,speed:.1,moveSpeed:3,location:u.characterId===player.id?{starshipId:ship.id,square,mesh:4,stationed:false}:u.location}))});
  await act({action:'setRunning',running:true});s=await state();const nova=s.units.find(u=>u.characterId===player.id);await act({action:'nudge',id:nova.id,amount:100});
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(({code,player})=>sessionStorage.setItem(`sa-character-token-${code}-${player.id}`,player.token),{code,player});pc=await context.newPage();pc.on('pageerror',e=>errors.push(e.stack));pc.on('dialog',d=>d.accept());
  await pc.goto(`${base}/character.html?campaign=${code}&character=${player.id}&showcase=1`);await pc.getByRole('button',{name:'Starships',exact:true}).click();
  const sheet=pc.frameLocator('[data-player-ship-details]'),grid=sheet.locator('.ship-grid:not(.mobile-grid)');await grid.waitFor();
  await sheet.locator('.embedded-move-controls [data-action=begin]').first().click();await sheet.locator('.embedded-move-controls [data-action=cancel]').first().waitFor();
  await grid.locator(`[data-grid-index="${square}"]`).click({position:{x:44,y:25}});
  await sheet.locator('.embedded-move-controls [data-action=confirm]').first().waitFor();
  const draft=await grid.evaluate(()=>embeddedMove);assert.ok(draft.combatUnitId);assert.ok(draft.meshRoute.length,JSON.stringify(draft));assert.equal(await sheet.locator('.embedded-move-controls [data-action=confirm]').first().isEnabled(),true);
  await pc.screenshot({path:path.join(out,'route-preview.png')});await sheet.locator('.embedded-move-controls [data-action=confirm]').first().click();
  await pc.waitForFunction(async({base,code,token,id})=>{const s=await fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json());return !!s.units.find(u=>u.id===id).timedAction;},{base,code,token,id:nova.id});
  assert.equal(await grid.isVisible(),true);await grid.locator('.player-ship-moving-token').waitFor();await pc.screenshot({path:path.join(out,'walking-in-combat.png')});
  await pc.waitForFunction(async({base,code,token,id,mesh})=>{const s=await fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json());return !s.units.find(u=>u.id===id).timedAction&&s.units.find(u=>u.id===id).location.mesh===mesh;},{base,code,token,id:nova.id,mesh:draft.destinationMesh});
  assert.equal(await grid.isVisible(),true);assert.deepEqual(errors,[]);console.log('PASS actual large-sheet Move selection, exact combat mesh route, server-owned timed walking, no tab switch and natural arrival.');
}
main().catch(async e=>{console.error(e,errors);console.error(await pc?.evaluate(()=>({move:starshipMoveDraft,tab:activeCharacterTab})).catch(()=>null));await pc?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();});
