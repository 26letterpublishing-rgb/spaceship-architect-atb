const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const root=process.env.SA_AUDIT_ROOT||path.resolve(__dirname,'..'),out=path.join(__dirname,'..','test-artifacts','performance');fs.mkdirSync(out,{recursive:true});
let child,browser;
async function main(){
  let base=process.env.SA_AUDIT_BASE;
  if(!base){
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-performance-'))},windowsHide:true,stdio:['ignore','pipe','pipe']});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),10000);child.stdout.on('data',c=>{const m=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.stderr.on('data',c=>process.stderr.write(c));child.on('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});
  }
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  let bytes=0;cdp.on('Network.loadingFinished',e=>bytes+=e.encodedDataLength);
  await context.addInitScript(()=>{window.auditLongTasks=[];new PerformanceObserver(list=>window.auditLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
  const response=page.waitForResponse(r=>r.url().endsWith('/api/campaign/showcase/start'));await page.goto(base+'/showcase.html');const room=await(await response).json();
  const act=async body=>{const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomCode:room.code,gmToken:room.gmToken,...body})});assert.equal(r.status,200);return r.json();};
  const gm=page.frameLocator('#showcaseFrame');await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();await gm.frameLocator('#atbFrame').getByRole('button',{name:'Engage Clock',exact:true}).click();await act({action:'setHardPaused',paused:true});
  const times=[],before=bytes;
  for(let i=0;i<4;i++){
    const player=i%2===0,start=Date.now();await page.getByRole('button',{name:player?'Nova Vale':'GM',exact:true}).click();
    const side=page.frameLocator('#showcaseFrame');await side.getByRole('button',{name:'Combat',exact:true}).click();
    if(!player&&await side.getByRole('button',{name:'Resume Encounter',exact:true}).isVisible())await side.getByRole('button',{name:'Resume Encounter',exact:true}).click();
    await side.frameLocator(player?'#playerAtbFrame':'#atbFrame').locator('[data-ship-combat-lane]').first().waitFor();times.push(Date.now()-start);
  }
  const state=await fetch(base+`/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());const nova=state.units.find(u=>u.characterName==='Nova Vale');
  await act({action:'nudge',id:nova.id,amount:100});await page.getByRole('button',{name:'Nova Vale',exact:true}).click();await gm.getByRole('button',{name:'Combat',exact:true}).click();
  const frame=page.frames().find(f=>f.url().includes('embed=player'))||page.frames().find(f=>f.url().includes('index.html')&&f!==page.mainFrame());
  await page.waitForTimeout(1000);await page.screenshot({path:path.join(out,`${process.env.SA_AUDIT_LABEL||'current'}-turn.png`)});
  const metrics=await frame.evaluate(()=>({longTasks:window.auditLongTasks.length,longTaskMs:window.auditLongTasks.reduce((a,b)=>a+b,0),collapse:(()=>{const e=document.querySelector('#collapsePlayerTurn'),r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,display:getComputedStyle(e).display,z:getComputedStyle(e).zIndex};})()}));
  const report={switchMs:times,switchTransferBytes:bytes-before,...metrics,errors};fs.writeFileSync(path.join(out,`${process.env.SA_AUDIT_LABEL||'current'}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.deepEqual(errors,[]);
  if(process.env.SA_VERIFY_UI==='1'){
    const pc=page.frameLocator('#showcaseFrame'),combat=pc.frameLocator('#playerAtbFrame');
    await pc.locator('body').evaluate(()=>window.scrollTo(0,450));await page.waitForTimeout(300);
    const hud=await pc.locator('#globalCharacterHud').boundingBox(),banner=await combat.locator('#myTurnBanner').boundingBox();assert.ok(banner.y>=hud.y+hud.height,'Turn panel clears sticky HUD');
    await combat.getByRole('button',{name:'Slide your action panel left'}).click();await combat.getByRole('button',{name:'Restore your action panel'}).click();
    await combat.getByRole('button',{name:'Move',exact:true}).click();const map=combat.locator('[data-inline-ship-map="'+nova.location.starshipId+'"]'),viewport=await map.locator('.inline-map-viewport').boundingBox();
    const cancel=await map.getByRole('button',{name:'Cancel',exact:true}).boundingBox(),zoom=await map.getByRole('button',{name:'Zoom in interior'}).boundingBox();assert.ok(cancel.y>=viewport.y+viewport.height);assert.ok(zoom.y>=cancel.y+cancel.height);assert.ok(zoom.width<=50&&zoom.height<=32);
    await map.getByRole('button',{name:'Zoom in interior'}).click();await map.getByRole('button',{name:'Zoom out interior'}).click();await page.screenshot({path:path.join(out,'movement-controls.png')});await map.getByRole('button',{name:'Cancel',exact:true}).click();
    const ship=state.starships.find(s=>s.id===nova.location.starshipId),cp=ship.ship.placements.find(p=>ship.ship.sicInventory.find(i=>i.id===p.sicId)?.type==='bridge-1'),gun=ship.ship.sicInventory.find(i=>i.type==='rapid-laser-5'),target=state.starships.find(s=>s.id!==ship.id);
    await act({action:'setCombatLocation',id:nova.id,location:{starshipId:ship.id,square:cp.cell,mesh:0}});
    const consoleButton=combat.getByRole('button',{name:'Console View',exact:true});await consoleButton.waitFor();assert.equal(await consoleButton.evaluate(e=>getComputedStyle(e).color),'rgb(22, 18, 0)');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:200,downloadThroughput:500000,uploadThroughput:500000});
    await consoleButton.click();await page.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();await page.getByRole('combobox',{name:'Station console'}).selectOption(gun.id);
    const weapons=page.getByRole('dialog',{name:'Weapons console',exact:true});await weapons.waitFor();assert.ok((await weapons.getByRole('button',{name:'Fire Rapid Laser',exact:true}).boundingBox()).height<70);await page.screenshot({path:path.join(out,'throttled-console.png')});await weapons.getByRole('button',{name:'Combat View',exact:true}).click();
    await act({action:'weaponCommand',id:nova.id,sicId:gun.id,targetId:target.id,requestId:'audit-gm-fire'});await page.waitForTimeout(700);assert.equal(await page.getByRole('dialog',{name:'Ship action dice roll'}).count(),0,'GM order never prompts the PC');
    await page.getByRole('button',{name:'GM',exact:true}).click();const side=page.frameLocator('#showcaseFrame');
    if(!await page.getByRole('dialog',{name:'Ship action dice roll'}).count()){await side.getByRole('button',{name:'Combat',exact:true}).click();if(await side.getByRole('button',{name:'Resume Encounter',exact:true}).isVisible())await side.getByRole('button',{name:'Resume Encounter',exact:true}).click();}
    const roll=page.getByRole('dialog',{name:'Ship action dice roll'});await roll.waitFor();const skill=roll.frameLocator('iframe');await skill.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill('100');await skill.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await skill.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});
    for(let i=0;i<35;i++){const s=await act({action:'step'});if(s.units.find(u=>u.id===nova.id).delayedAction?.weaponDamage)break;}
    await roll.waitFor();await skill.getByRole('button',{name:'Roll for Me',exact:true}).click();await skill.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});console.log('PASS Chrome: sticky HUD, collapse/restore, compact lower map controls, throttled console styling and GM-owned accuracy/damage dialogs.');assert.deepEqual(errors,[]);
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();});
