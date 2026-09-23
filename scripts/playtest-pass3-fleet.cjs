const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','pass3-fleet');fs.mkdirSync(out,{recursive:true});
let server,browser,page;
async function main(){
  server=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-pass3-fleet-'))},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timeout);resolve(url);}});server.on('error',reject);});
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.on('page',p=>{p.on('pageerror',e=>errors.push(e.stack));p.on('dialog',d=>d.accept());});
  page=await context.newPage();const created=page.waitForResponse(r=>r.url().endsWith('/api/campaign/showcase/start'));await page.goto(base+'/showcase.html');const room=await(await created).json();
  const outer=page.frameLocator('#showcaseFrame');await outer.locator('.gm-tabs [data-tab=starships]').click();
  for(const [title,expected]of [['Wayfinder',4],['Red Horizon',13]]){
    await outer.locator(`.gm-starship-card[data-starship-id="showcase-${title==='Wayfinder'?'pc':'npc'}-ship"]`).locator('[data-view-starship]').click();
    const details=outer.frameLocator('#gmStarshipViewerFrame');await details.locator('.ship-details-only').waitFor();
    await details.locator('[data-live-stat=en][data-en-part=available]:visible').first().filter({hasText:String(expected)}).waitFor();
    assert.equal(await details.locator('[data-live-stat=hull]:visible').first().textContent(),'100');
    assert.ok(await details.locator('.desktop-map-display [data-map-display]').count()>=6,'All six Map View switches remain present');
    await page.screenshot({path:path.join(out,title.toLowerCase().replace(' ','-')+'.png'),fullPage:true});
    await outer.locator('#closeGmStarshipViewer').click();
  }
  await page.getByRole('button',{name:'Nova Vale',exact:true}).click();await outer.getByRole('button',{name:'Starships',exact:true}).click();
  const details=outer.frameLocator('[data-player-ship-details]');await details.locator('.ship-details-only').waitFor();
  assert.equal(await details.locator('[data-live-stat=en][data-en-part=available]:visible').first().textContent(),'4');
  await outer.getByRole('button',{name:'Upgrade Ship',exact:true}).click();const editor=outer.frameLocator('[data-player-ship-editor]');await editor.getByRole('button',{name:'Construction',exact:true}).click();
  const frame=page.frames().find(f=>f.url().includes('starship.html')&&f.url().includes('embedded=pc')&&!f.url().includes('details=1'));
  const check=await frame.evaluate(()=>({errors:inspectConstruction().errors,budget:SAShipPower.designBudget(draft),items:draft.sicInventory.length}));assert.deepEqual(check.errors,[]);assert.equal(check.items,16);assert.equal(check.budget.available,4);
  // Exercise the visible confirmation guard with an overloaded draft, then cancel it.
  await frame.evaluate(()=>{const i=draft.sicInventory.find(i=>i.type==='en-au-engine-6');i.type='en-au-engine-5';renderAll();});
  assert.ok((await frame.evaluate(()=>inspectConstruction().errors)).some(e=>e.includes('Not enough EN')));
  assert.equal(await editor.locator('[data-construction-action=confirm]').first().isDisabled(),true);
  await page.screenshot({path:path.join(out,'overloaded-construction.png')});
  await outer.getByRole('button',{name:'Return to Ship',exact:true}).click();await details.locator('.ship-details-only').waitFor();
  assert.equal(await details.locator('[data-live-stat=en][data-en-part=available]:visible').first().textContent(),'4','Cancelled overload does not alter the ship');
  for(const width of [1366,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(out,`pc-ship-${width}.png`),fullPage:true});}
  await page.reload();await outer.locator('[data-character-tab=starships].active').waitFor();await details.locator('.ship-details-only').waitFor();
  const post=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
  const act=body=>post('/api/action',{roomCode:room.code,gmToken:room.gmToken,...body}),state=()=>fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  const s=await state(),maps=require('../ship-map-core'),source=s.starships.find(s=>s.controlType==='pc'),target=s.starships.find(s=>s.controlType==='gm'),player=room.players[0];
  const bridge=source.ship.sicInventory.find(i=>maps.definition(i.type).bridge),p=source.ship.placements.find(p=>p.sicId===bridge.id),seat=maps.componentDefinition(bridge).stations[0];
  await act({action:'prepareEncounter',mode:'starship',preparationId:'pass3-actual-fleet',starships:s.starships,shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:2,r:0}],units:s.units.map(u=>({...u,preparationUnitId:u.id,speed:.1,location:u.characterId===player.id?{starshipId:source.id,square:p.cell+seat.y*20+seat.x,sicId:bridge.id,mesh:seat.mesh,stationed:true}:u.location}))});
  const nova=(await state()).units.find(u=>u.characterId===player.id);
  const combatContext=await browser.newContext({viewport:{width:1440,height:1000}});await combatContext.addInitScript(({room,player})=>{sessionStorage.setItem(`sa-gm-token-${room.code}`,room.gmToken);sessionStorage.setItem(`sa-character-token-${room.code}-${player.id}`,player.token);},{room,player});
  const gm=await combatContext.newPage();await gm.goto(`${base}/index.html?embedded=gm&campaign=${room.code}`);await gm.getByRole('button',{name:'Engage Clock',exact:true}).click();await act({action:'setHardPaused',paused:true});
  page=await combatContext.newPage();page.on('pageerror',e=>errors.push(e.stack));await page.goto(`${base}/character.html?campaign=${room.code}&character=${player.id}&showcase=1`);await page.getByRole('button',{name:'Combat',exact:true}).click();await page.frameLocator('#playerAtbFrame').locator('[data-console-operator]').first().selectOption(nova.id);
  await page.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();
  const own=s=>s.starships.find(x=>x.id===source.id),enemy=s=>s.starships.find(x=>x.id===target.id),unit=s=>s.units.find(u=>u.id===nova.id);
  async function until(fn,label){const end=Date.now()+30000;while(Date.now()<end){const s=await state();if(fn(s))return s;await page.waitForTimeout(100);}throw Error(label);}
  async function ready(){await act({action:'setHardPaused',paused:true});await act({action:'nudge',id:nova.id,amount:100-unit(await state()).atb});}
  async function roll(total){const dialog=page.getByRole('dialog',{name:'Ship action dice roll',exact:true});await dialog.waitFor();const frame=dialog.frameLocator('iframe');await frame.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill(String(total));await frame.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await frame.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await dialog.waitFor({state:'detached'});}
  async function run(){await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});}
  const sensor=source.ship.sicInventory.find(i=>maps.definition(i.type).sensor),lock=source.ship.sicInventory.find(i=>maps.definition(i.type).lockOn);
  await page.getByRole('combobox',{name:'Station console',exact:true}).selectOption(sensor.id);await ready();await page.getByRole('button',{name:'Scan Area',exact:true}).click();if(unit(await state()).delayedAction?.awaitingRoll)await roll(100);await run();
  await until(s=>!unit(s).delayedAction&&own(s).sensorState.contacts[target.id]?.level==='detected','New fleet scan did not reveal Red Horizon');
  await ready();await page.getByRole('combobox',{name:'Station console',exact:true}).selectOption(lock.id);await page.getByRole('button',{name:'Lock-On',exact:true}).click();await roll(100);await run();await until(s=>own(s).lockState.targets.some(t=>t.targetId===target.id),'Ship lock did not finish');
  const gun=source.ship.sicInventory.find(i=>i.type==='rapid-laser-5');
  await page.getByRole('button',{name:'Combat View',exact:true}).click();
  for(const score of [40,4]){
    await ready();await page.frameLocator('#playerAtbFrame').getByRole('button',{name:'Fire Rapid Laser 5',exact:true}).click();const fire=page.locator('dialog[data-operator-id]').filter({has:page.locator('[data-fire]')});await fire.locator('[data-target]').selectOption(target.id);await fire.locator('[data-fire]').click();await run();await until(s=>unit(s).delayedAction?.weaponDamage,'No damage roll');await roll(score);
    const result=enemy(await state());assert.equal(result.currentShieldHp,0);assert.equal(result.currentHullHp,score===40?100:96,'Shield burst discards overflow; later shot reaches hull');
  }
  await run();await until(s=>enemy(s).currentHullHp>96,'New Red Horizon drone did not repair damage');await page.screenshot({path:path.join(out,'actual-fleet-combat.png')});
  console.log('PASS unchanged new fleet: manual scan and lock, real laser dice, shield burst without hull overflow, subsequent hull damage and autonomous repair.');
  assert.deepEqual(errors,[]);console.log('PASS actual redesigned fleet in GM/PC views; positive EN, legal construction, all 16 SICs, Map View, rejected overload, cancelled edit, responsive views and reload.');
}
main().catch(async e=>{console.error(e);process.exitCode=1;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}).finally(async()=>{await browser?.close();if(server?.exitCode===null){const done=once(server,'exit');server.kill();await done;}});
