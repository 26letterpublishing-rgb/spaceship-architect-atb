const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','movement-edit');fs.mkdirSync(out,{recursive:true});
let child,browser,pc,gm;
async function main(){
 child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-move-edit-'))},stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',c=>process.stderr.write(c));
 const base=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(t);resolve(u);}});});
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const room=await post('campaign/showcase/start',{}),player=room.players.find(p=>p.name==='Nova Vale');
 const campaign=()=>fetch(`${base}/api/campaign/state?code=${room.code}&token=${room.gmToken}`).then(r=>r.json()),state=()=>fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());
 const act=body=>post('action',{roomCode:room.code,gmToken:room.gmToken,...body});
 const ship=(await campaign()).starships.find(s=>s.title==='Wayfinder');
 // Clear corridor fixture, with identical player/server layout and no door delays.
 const layout={...ship.ship,gridCells:Array.from({length:9},(_,i)=>42+i),sicInventory:[],placements:[],doorStates:{},confirmedOnce:true};
 await post('campaign/starship/save',{code:room.code,token:room.gmToken,starshipId:ship.id,starship:layout});
 const locate=(square=42)=>post('campaign/starship/move-character',{code:room.code,token:room.gmToken,starshipId:ship.id,characterId:player.id,square,mesh:4,stationed:false});await locate();
 browser=await chromium.launch({channel:'chrome',headless:true});const gc=await browser.newContext({viewport:{width:1440,height:1000}}),pcx=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
 await gc.addInitScript(({code,token})=>sessionStorage.setItem(`sa-gm-token-${code}`,token),{code:room.code,token:room.gmToken});
 await pcx.addInitScript(({code,p})=>sessionStorage.setItem(`sa-character-token-${code}-${p.id}`,p.token),{code:room.code,p:player});
 pc=await pcx.newPage();gm=await gc.newPage();for(const p of [pc,gm])p.on('pageerror',e=>errors.push(e.message));
 await pc.goto(`${base}/character.html?campaign=${room.code}&character=${player.id}&showcase=1`);await pc.getByRole('button',{name:'Starships',exact:true}).click();
 const details=pc.frameLocator('[data-player-ship-details]').first(),grid=details.locator('.ship-grid:not(.mobile-grid)');await grid.locator(`[data-crew-id="${player.id}"]`).waitFor();
 async function edit(speed){
  await gm.goto(`${base}/character.html?campaign=${room.code}&character=${player.id}&gm=1&gmAdjust=1&embedded=1&showcase=1`);
  await gm.locator('#moveSpeedValue').click();await gm.locator('[data-gm-number]').fill(String(speed));await gm.locator('[data-gm-number-action=save]').click();
  await gm.getByRole('button',{name:'Save Changes',exact:true}).click();
  await pc.waitForFunction(async({base,code,token,id,speed})=>{const c=await fetch(`${base}/api/campaign/state?code=${code}&token=${token}`).then(r=>r.json());return c.characters.find(c=>c.id===id).character.computed.moveSpeed===speed;},{base,code:room.code,token:room.gmToken,id:player.id,speed});
  await pc.waitForTimeout(800);
  assert.equal((await state()).units.find(u=>u.characterId===player.id).moveSpeed,speed,'GM save reaches existing combat unit');
 }
 async function walk(destination,cancelAfter){
  await grid.evaluate(()=>{window.walkDurations=[];const original=Element.prototype.animate;if(!window.originalWalkAnimate){window.originalWalkAnimate=original;Element.prototype.animate=function(frames,options){if(this.classList.contains('player-ship-moving-token'))window.walkDurations.push(options.duration);return original.call(this,frames,options);};}});
  await details.getByRole('button',{name:'Move',exact:true}).first().click();await grid.locator(`[data-grid-index="${destination}"]`).click();await details.locator('[data-action=confirm]:not([disabled])').first().click();
  await grid.locator('.player-ship-moving-token').waitFor();
  if(cancelAfter){await pc.waitForTimeout(cancelAfter);assert.equal(await details.locator('[data-action=cancel]').first().isEnabled(),true);await details.locator('[data-action=cancel]').first().click();}
  await grid.locator('.player-ship-moving-token').waitFor({state:'detached'});await details.getByRole('button',{name:'Move',exact:true}).first().waitFor();
  const position=(await campaign()).starships.find(s=>s.id===ship.id).characterLocations[player.id];
  return {durations:await grid.evaluate(()=>window.walkDurations),position};
 }
 await edit(3);let first=await walk(43);assert.equal(first.position.square,43);assert.ok(first.durations.every(d=>Math.abs(d-3000)<1),JSON.stringify(first));
 await edit(15);let fast=await walk(44);assert.equal(fast.position.square,44);assert.ok(fast.durations.every(d=>Math.abs(d-600)<1),JSON.stringify(fast));
 console.log('PASS real GM editing: Move 3 uses 3000ms; Move 15 uses 600ms per square in the already-open PC tab.');
 const stopped=await walk(50,900);assert.ok(stopped.position.square>44&&stopped.position.square<50,JSON.stringify(stopped));assert.equal(stopped.position.stationed,false);await pc.waitForTimeout(2000);assert.equal((await campaign()).starships.find(s=>s.id===ship.id).characterLocations[player.id].square,stopped.position.square);
 await pc.screenshot({path:path.join(out,'stopped-on-route.png')});console.log('PASS Cancel stops on the route and persists that square without resuming or jumping to the destination.');
 const prepared=await state(),ships=(await campaign()).starships;await act({action:'prepareEncounter',mode:'starship',preparationId:'movement-edit-combat',starships:ships,shipPositions:prepared.shipPositions,units:prepared.units.map(u=>{const s=ships.find(s=>s.controlType===(u.team==='pc'?'pc':'gm'));return {...u,preparationUnitId:u.id,speed:.1,location:{starshipId:s.id,square:s.ship.gridCells[0],mesh:4,stationed:false}};})});
 await gm.goto(`${base}/gm.html?campaign=${room.code}&showcase=1`);await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
 const engaged=await state();assert.equal(engaged.hasEngagedClock,true);assert.equal(engaged.encounterEndedAt,null);
 await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.locator('#atbLive').waitFor();assert.equal(await gm.locator('#resumeEncounter').isVisible(),false);await gm.getByRole('button',{name:'Script',exact:true}).click();await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.locator('#atbLive').waitFor();console.log('PASS active combat opens directly when GM returns to its tab.');
 await gm.locator('#returnToEncounterSetup').click();await gm.locator('#atbSetup').waitFor();await gm.waitForTimeout(1000);assert.equal(await gm.locator('#resumeEncounter').isVisible(),true,'Explicit Encounter Setup remains available during combat');
 await gm.getByRole('button',{name:'Script',exact:true}).click();await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.locator('#atbLive').waitFor();console.log('PASS explicit Encounter Setup stays open, and normal tab return still opens live combat.');
 for(const speed of [3,15]){
  await act({action:'setHardPaused',paused:true});await edit(speed);let s=await state(),u=s.units.find(u=>u.characterId===player.id);
  if(s.activeId)await act({action:'completeTurn',id:s.activeId});await act({action:'setCombatLocation',id:u.id,location:{starshipId:ship.id,square:42,mesh:4,stationed:false}});await act({action:'nudge',id:u.id,amount:100});
  await details.getByRole('button',{name:'Move',exact:true}).first().click();await grid.locator('[data-grid-index="43"]').click();await details.locator('[data-action=confirm]:not([disabled])').first().click();
  await pc.waitForFunction(async({base,code,token,id})=>(await fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json())).units.find(u=>u.id===id).timedAction?.kind==='move',{base,code:room.code,token:room.gmToken,id:u.id});
  u=(await state()).units.find(v=>v.id===u.id);assert.equal(u.timedAction.total,speed===3?3:.6);await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
  await pc.waitForFunction(async({base,code,token,id})=>!(await fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json())).units.find(u=>u.id===id).timedAction,{base,code:room.code,token:room.gmToken,id:u.id});
 }
 console.log('PASS actual PC combat-map movement after GM edits: same square takes 3 seconds at Move 3 and 0.6 seconds at Move 15.');
 assert.deepEqual(errors,[]);
}
main().catch(async e=>{console.error(e);process.exitCode=1;for(const [n,p] of [['pc',pc],['gm',gm]])await p?.screenshot({path:path.join(out,`failure-${n}.png`)}).catch(()=>{});}).finally(async()=>{await browser?.close();if(child){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}});
