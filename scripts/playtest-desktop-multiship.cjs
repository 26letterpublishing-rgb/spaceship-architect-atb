// Desktop-only browser regression. Uses disposable storage and an ephemeral port; never opens existing browser tabs.
// Optional desktop integration test. Requires Playwright and an installed Edge (or SA_BROWSER_CHANNEL).
// All campaigns and screenshots are isolated from the application's normal data directory.
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const root='C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer';
const artifacts=path.join(os.tmpdir(),'sa-desktop-multiship');
fs.mkdirSync(artifacts,{recursive:true});
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-cockpit-browser-'));
let child,browser;

async function main() {
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const base=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Server startup timed out')),10000);
    child.on('error',reject);child.stdout.on('data',chunk=>{const url=String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timeout);resolve(url);}});
    child.stderr.on('data',chunk=>process.stderr.write(chunk));
  });
  const post=async(route,body)=>{
    const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result;
  };
  const created=await post('campaign/create',{name:'Browser Flight Test',gmCode:'browser-flight-gm'}), code=created.campaign.code, token=created.token;
  const characters=['Aster','Bram'].map(name=>({id:'browser-'+name.toLowerCase(),phase:'finalized',access:{pcCode:'browser-'+name.toLowerCase()},identity:{characterName:name,playerName:name},
    attributes:{health:[1,0,-1,-1],intellect:[1,0,-1,-1],perception:[1,0,-1,-1],dexterity:[1,0,-1,-1]},computed:{maximumHp:30,moveSpeed:2,speed:3,commandWindow:24,skills:{}},health:{current:30}}));
  for(const character of characters){const p=await post('campaign/join/request',{code,character});await post('campaign/join/respond',{code,token,requestId:p.requestId,decision:'approve'});}
  const ships=['Pathfinder','Nightwatch'].map((title,i)=>({id:'browser-ship-'+i,title,controlType:i===0?'gm':'pc',crewCharacterIds:[characters[i].id],ship:{id:'browser-ship-'+i,title,confirmedOnce:true,
    gridCells:Array.from({length:i===0?28:35},(_,n)=>147+Math.floor(n/7)*20+n%7),
    sicInventory:[{id:'cp',type:'cockpit-1',stationLayout:'corners-v1'},{id:'th',type:'ionic-pulse-thruster-1'},{id:'en',type:'en-engine-2'},{id:'au',type:'au-engine-1'}],
    placements:[{sicId:'cp',cell:147},{sicId:'th',cell:146},{sicId:'en',cell:168},{sicId:'au',cell:172}]}}));
  for(const ship of ships){await post('campaign/starship/link',{code,token,controlType:ship.controlType,starship:ship.ship});await post('campaign/starship/crew',{code,token,starshipId:ship.id,crewCharacterIds:ship.crewCharacterIds});}
  const act=body=>post('action',{roomCode:code,gmToken:token,...body});
  const state=()=>fetch(base+'/api/state?room='+code+'&token='+token).then(r=>r.json());
  await act({action:'prepareEncounter',preparationId:'browser-flight-001',mode:'starship',starships:ships,shipPositions:[{id:ships[0].id,q:0,r:0},{id:ships[1].id,q:25,r:0}],
    units:[{characterId:characters[0].id,characterName:'Aster',team:'pc',speed:1,commandWindow:120,location:{starshipId:ships[0].id,square:149,mesh:4,stationed:false}},
      {characterId:characters[1].id,characterName:'Bram',team:'pc',speed:1,commandWindow:120,location:{starshipId:ships[1].id,square:148,mesh:4}},
      {preparationUnitId:'browser-npc',characterName:'NPC Pilot',team:'npc',speed:1,commandWindow:120,location:{starshipId:ships[1].id,square:147,mesh:0,stationed:true}}]});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:1000}});
  const playerContext=await browser.newContext({viewport:{width:1600,height:1000}});
  const campaignSubscriptions=new Set(), embeddedSubscriptions=[];
  const errors=[],moveRequests=[];
  for(const owner of [context,playerContext]){
    await owner.route('**/api/action',async route=>{
      const body=route.request().postDataJSON();
      if(body?.kind==='moveStarship'){moveRequests.push(body);await new Promise(resolve=>setTimeout(resolve,700));}
      await route.continue();
    });
    owner.on('request',request=>{if(request.url().includes('/campaign-events?')){campaignSubscriptions.add(request);if(request.frame().parentFrame())embeddedSubscriptions.push(request.url());}});
    owner.on('requestfinished',request=>campaignSubscriptions.delete(request));
    owner.on('requestfailed',request=>campaignSubscriptions.delete(request));
    owner.on('page',p=>p.on('pageerror',err=>errors.push(err.message)));
  }
  const gm=await context.newPage();
  await gm.goto(base+'/gm.html?campaign='+code);
  await gm.getByRole('textbox',{name:'Campaign Name',exact:true}).fill('Browser Flight Test');
  await gm.getByRole('textbox',{name:'GM Code',exact:true}).fill('browser-flight-gm');
  await gm.getByRole('button',{name:'Open Campaign',exact:true}).click();
  await gm.getByRole('button',{name:'Combat',exact:true}).click();
  console.log('GM COMBAT',await gm.locator('body').innerText());
  await gm.screenshot({path:path.join(artifacts,'gm-open.png')});
  if(await gm.getByRole('button',{name:'Resume Encounter',exact:true}).isVisible())await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();
  const gmFrame=gm.frameLocator('#atbFrame');
  await gmFrame.getByRole('button',{name:'Engage Clock',exact:true}).click();
  await act({action:'setHardPaused',paused:true});
  const pc=await playerContext.newPage();
  await pc.goto(`${base}/character.html?campaign=${code}&character=${characters[0].id}`);
  await pc.getByRole('button',{name:'Enter PC Code',exact:true}).click();
  await pc.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill('browser-aster');
  await pc.getByRole('button',{name:'Unlock Character',exact:true}).click();
  await pc.getByRole('button',{name:'Combat',exact:true}).click();
  const pcFrame=pc.frameLocator('#playerAtbFrame');
  await pcFrame.getByRole('button',{name:'Enlarge space map',exact:true}).waitFor();
  await pcFrame.locator('body').evaluate(el=>{
    const win=el.ownerDocument.defaultView,original=win.tone;
    win.__pilotTones=[];win.tone=(...args)=>{win.__pilotTones.push(args);return original(...args);};
    const charge=win.SACombatBridge.startEngineCharge;win.__charge={starts:0,updates:0,stops:0};
    win.SACombatBridge.startEngineCharge=()=>{const sound=charge();if(!sound)return sound;win.__charge.starts++;return {update(p){win.__charge.updates++;sound.update(p);},stop(){win.__charge.stops++;sound.stop();}};};
  });
  const units=(await state()).units,pilot=units.find(u=>u.characterId===characters[0].id),npc=units.find(u=>u.team==='npc');
  for(const unit of units)await act({action:'setSpeed',id:unit.id,speed:.1});


  const frame=pc.frames().find(f=>f.url().includes('index.html'))||await pc.locator('#playerAtbFrame').elementHandle().then(h=>h.contentFrame());
  const host=frame.locator('[data-inline-ship-map="browser-ship-0"]');
  const metrics=async()=>host.evaluate(h=>{const v=h.querySelector('.inline-map-viewport'),g=h.querySelector('.inline-combat-map-grid'),r=v.getBoundingClientRect(),z=parseFloat(getComputedStyle(g).getPropertyValue('--cell-size'));return {x:r.x,y:r.y,w:r.width,h:r.height,scrollX:v.scrollLeft,scrollY:v.scrollTop,size:z};});
  await pc.waitForTimeout(500);
  for(let i=0;i<1;i++){await host.locator('[data-preview-zoom="1"]').click();await pc.waitForTimeout(80);}
  await frame.locator('#initiativePanel').evaluate(p=>p.scrollTop=350);
  await host.locator('.inline-map-viewport').evaluate(v=>{v.scrollLeft=80;v.scrollTop=50;});
  await pc.waitForTimeout(100);
  for(const page of [pc,gm])if(await page.getByRole('button',{name:'Dismiss All hands on deck',exact:true}).isVisible())await page.getByRole('button',{name:'Dismiss All hands on deck',exact:true}).click();
  await host.locator('.inline-map-viewport').scrollIntoViewIfNeeded();await pc.waitForTimeout(150);
  const before=await metrics();console.log('before',before);await pc.screenshot({path:path.join(artifacts,'map-before.png')});
  await act({action:'nudge',id:pilot.id,amount:100});await pc.waitForTimeout(700);
  const active=await metrics();console.log('active',active);await pc.screenshot({path:path.join(artifacts,'map-active.png')});
  await frame.locator('[data-combat-action="move"]:visible').first().click();await pc.waitForTimeout(300);
  const moving=await metrics();console.log('selecting',moving);await pc.screenshot({path:path.join(artifacts,'map-selecting.png')});

  const noOverlap=async(h)=>h.evaluate(h=>{const map=h.querySelector('.inline-map-viewport').getBoundingClientRect(),controls=h.querySelector('.inline-map-move-controls').getBoundingClientRect();return {mapBottom:map.bottom,controlsTop:controls.top};});
  let bounds=await noOverlap(host);assert.ok(bounds.controlsTop>=bounds.mapBottom,'PC movement controls stay below map');
  await pc.setViewportSize({width:1280,height:720});await pc.waitForTimeout(300);bounds=await noOverlap(host);assert.ok(bounds.controlsTop>=bounds.mapBottom);await host.locator('.inline-map-viewport').scrollIntoViewIfNeeded();await pc.screenshot({path:path.join(artifacts,'pc-move-laptop.png')});
  await host.locator('[data-expand-interior]').click();await pc.waitForTimeout(200);const enlarged=pc.locator('.expanded-interior-dialog [data-inline-ship-map]');bounds=await noOverlap(enlarged);assert.ok(bounds.controlsTop>=bounds.mapBottom);await pc.screenshot({path:path.join(artifacts,'expanded-move.png')});await pc.locator('.expanded-interior-dialog').evaluate(d=>d.close());
  const gf=await gm.locator('#atbFrame').elementHandle().then(h=>h.contentFrame());await gf.evaluate(id=>{const u=SACombatBridge.state().units.find(u=>u.id===id);SACombatMap.openMove(u);},pilot.id);
  const gh=gf.locator('[data-inline-ship-map="browser-ship-0"]');await gh.scrollIntoViewIfNeeded();await gm.waitForTimeout(200);bounds=await noOverlap(gh);assert.ok(bounds.controlsTop>=bounds.mapBottom);await gm.screenshot({path:path.join(artifacts,'gm-move.png')});
  assert.deepEqual(errors,[]);console.log('GM AND PC MOVE CONTROLS BELOW MAP PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();});
