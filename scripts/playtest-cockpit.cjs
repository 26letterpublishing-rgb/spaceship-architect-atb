// Optional desktop integration test. Requires Playwright and an installed Edge (or SA_BROWSER_CHANNEL).
// All campaigns and screenshots are isolated from the application's normal data directory.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const root=path.resolve(__dirname,'..');
const artifacts=path.join(root,'test-artifacts','cockpit');
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
  const ships=['Pathfinder','Nightwatch'].map((title,i)=>({id:'browser-ship-'+i,title,controlType:'pc',crewCharacterIds:[characters[i].id],ship:{id:'browser-ship-'+i,title,confirmedOnce:true,
    gridCells:Array.from({length:28},(_,n)=>147+Math.floor(n/7)*20+n%7),
    sicInventory:[{id:'cp',type:'cockpit-1',stationLayout:'corners-v1'},{id:'th',type:'ionic-pulse-thruster-1'},{id:'en',type:'en-engine-2'},{id:'au',type:'au-engine-1'}],
    placements:[{sicId:'cp',cell:147},{sicId:'th',cell:146},{sicId:'en',cell:168},{sicId:'au',cell:172}]}}));
  for(const ship of ships){await post('campaign/starship/link',{code,token,controlType:'pc',starship:ship.ship});await post('campaign/starship/crew',{code,token,starshipId:ship.id,crewCharacterIds:ship.crewCharacterIds});}
  const act=body=>post('action',{roomCode:code,gmToken:token,...body});
  const state=()=>fetch(base+'/api/state?room='+code).then(r=>r.json());
  await act({action:'prepareEncounter',preparationId:'browser-flight-001',mode:'starship',starships:ships,shipPositions:[{id:ships[0].id,q:0,r:0},{id:ships[1].id,q:25,r:0}],
    units:[{characterId:characters[0].id,characterName:'Aster',team:'pc',speed:1,commandWindow:120,location:{starshipId:ships[0].id,square:147,mesh:0,stationed:true}},
      {characterId:characters[1].id,characterName:'Bram',team:'pc',speed:1,commandWindow:120,location:{starshipId:ships[1].id,square:148,mesh:4}},
      {preparationUnitId:'browser-npc',characterName:'NPC Pilot',team:'npc',speed:1,commandWindow:120,location:{starshipId:ships[1].id,square:147,mesh:0,stationed:true}}]});
  browser=await chromium.launch({channel:process.env.SA_BROWSER_CHANNEL || 'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:1000}});
  const campaignSubscriptions=new Set(), embeddedSubscriptions=[];
  context.on('request',request=>{if(request.url().includes('/campaign-events?')){campaignSubscriptions.add(request);if(request.frame().parentFrame())embeddedSubscriptions.push(request.url());}});
  context.on('requestfinished',request=>campaignSubscriptions.delete(request));
  context.on('requestfailed',request=>campaignSubscriptions.delete(request));
  const errors=[];context.on('page',p=>p.on('pageerror',err=>errors.push(err.message)));
  const gm=await context.newPage();
  await gm.goto(base+'/gm.html?campaign='+code);
  await gm.getByRole('textbox',{name:'Campaign Name',exact:true}).fill('Browser Flight Test');
  await gm.getByRole('textbox',{name:'GM Code',exact:true}).fill('browser-flight-gm');
  await gm.getByRole('button',{name:'Open Campaign',exact:true}).click();
  await gm.getByRole('button',{name:'Combat',exact:true}).click();
  await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();
  const gmFrame=gm.frameLocator('#atbFrame');
  await gmFrame.getByRole('button',{name:'Engage Clock',exact:true}).click();
  await act({action:'setHardPaused',paused:true});
  const pc=await context.newPage();
  await pc.goto(`${base}/character.html?campaign=${code}&character=${characters[0].id}`);
  await pc.getByRole('button',{name:'Enter PC Code',exact:true}).click();
  await pc.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill('browser-aster');
  await pc.getByRole('button',{name:'Unlock Character',exact:true}).click();
  await pc.getByRole('button',{name:'Combat',exact:true}).click();
  const pcFrame=pc.frameLocator('#playerAtbFrame');
  await pcFrame.getByRole('button',{name:'Enlarge space map',exact:true}).waitFor();
  const units=(await state()).units,pilot=units.find(u=>u.characterId===characters[0].id),npc=units.find(u=>u.team==='npc');
  for(const unit of units)await act({action:'setSpeed',id:unit.id,speed:.1});

  async function hexClick(page,q,r) {
    const point=await page.locator('.ship-navigation-dialog svg[data-space-canvas]').evaluate((svg,p)=>{
      const c=new DOMPoint(Math.sqrt(3)*(p.q+p.r/2),1.5*p.r).matrixTransform(svg.getScreenCTM());return {x:c.x,y:c.y};
    },{q,r});
    await page.mouse.move(point.x-50,point.y+20,{steps:12});await page.mouse.move(point.x,point.y,{steps:10});await page.mouse.click(point.x,point.y);
  }
  async function move(page,frame,unit,destination,index) {
    await act({action:'nudge',id:unit.id,amount:100});
    const dialog=page.getByRole('dialog',{name:'Pilot console',exact:true});await dialog.waitFor();
    assert.ok((await dialog.evaluate(el=>getComputedStyle(el).backgroundImage)).includes('pilot-console-art-web.webp'));
    if(index===1) {
      await dialog.getByRole('spinbutton',{name:'Hex Q',exact:true}).fill(String(destination.q));
      await dialog.getByRole('spinbutton',{name:'Hex R',exact:true}).fill(String(destination.r));
    } else await hexClick(page,destination.q,destination.r);
    if(index===0)await dialog.getByRole('checkbox').check();
    const confirm=dialog.getByRole('button',{name:'Move Ship',exact:true});
    const rect=await confirm.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2,{steps:20});
    await page.waitForTimeout(700);
    assert.equal(await dialog.getByRole('spinbutton',{name:'Hex Q',exact:true}).inputValue(),String(destination.q));
    assert.equal(await dialog.getByRole('spinbutton',{name:'Hex R',exact:true}).inputValue(),String(destination.r));
    assert.equal(await confirm.isEnabled(),true);
    if(index===0)await page.screenshot({path:path.join(artifacts,unit.team+'-destination.png')});
    await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await dialog.getByRole('button',{name:'Entering Order',exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Leave Station',exact:true}).isEnabled(),false);
    const pending=(await state()).units.find(u=>u.id===unit.id);assert.ok(pending.delayedAction.shipOrder);assert.ok(pending.atb>=100);
    for(let tick=0;tick<5&&(await state()).units.find(u=>u.id===unit.id).delayedAction;tick++)await act({action:'step'});
    const after=await state(), ship=after.starships.find(s=>s.id===unit.location.starshipId);
    assert.deepEqual(ship.navigation.target,destination);assert.equal(after.activeId,null);
    await act({action:'setHardPaused',paused:false});
    if(!(await state()).running)await act({action:'setRunning',running:true});
    const before=(await state()).shipPositions.find(p=>p.id===ship.id);
    await page.waitForTimeout(650);
    await act({action:'setHardPaused',paused:true});
    const moved=(await state()).shipPositions.find(p=>p.id===ship.id);assert.notDeepEqual(moved,before);
    await dialog.getByRole('button',{name:'Combat View',exact:true}).click();
    console.log(`${unit.team} mouse movement ${index+1}: passed, route ${destination.q},${destination.r}`);
  }
  for(let i=0;i<3;i++) await move(gm,gmFrame,npc,{q:22-i,r:i-1},i);
  for(let i=0;i<3;i++) await move(pc,pcFrame,pilot,{q:3+i,r:i-1},i);
  assert.deepEqual(embeddedSubscriptions,[],'Embedded combat must reuse its parent campaign updates, not open duplicate streams.');
  assert.equal(campaignSubscriptions.size,2,'Only the two parent campaign streams remain connected.');
  await pcFrame.getByRole('button',{name:'Enlarge space map',exact:true}).click();
  const expanded=pc.getByRole('dialog',{name:'Space map',exact:true});
  const oldTransform=await expanded.locator('[data-space-ship="browser-ship-0"]').getAttribute('transform');
  await act({action:'setHardPaused',paused:false});await pc.waitForTimeout(500);await act({action:'setHardPaused',paused:true});
  assert.notEqual(await expanded.locator('[data-space-ship="browser-ship-0"]').getAttribute('transform'),oldTransform);
  await expanded.getByRole('button',{name:'Close',exact:true}).click();
  await pc.screenshot({path:path.join(artifacts,'player-live-flight.png')});
  await act({action:'nudge',id:pilot.id,amount:100});
  const helm=pc.getByRole('dialog',{name:'Pilot console',exact:true});await helm.waitFor();
  assert.equal(await helm.locator('.sa-health-track small').count(),0,'Players see condition icons, not exact ship HP.');
  for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
    await pc.setViewportSize(size);await pc.waitForTimeout(300);
    const bounds=await helm.getByRole('button',{name:'Leave Station',exact:true}).boundingBox();assert.ok(bounds.y+bounds.height<=size.height);
    await pc.screenshot({path:path.join(artifacts,`pilot-${size.width}.png`)});
  }
  await pc.setViewportSize({width:1600,height:1000});
  await helm.getByRole('button',{name:'Leave Station',exact:true}).click();
  const map=pcFrame.locator('[data-inline-ship-map="browser-ship-0"]');
  await map.locator('[data-inline-cancel-move]').click();assert.equal((await state()).units.find(u=>u.id===pilot.id).location.stationed,true);
  await pcFrame.getByRole('button',{name:'Pilot Console',exact:true}).click();
  await helm.getByRole('button',{name:'Leave Station',exact:true}).click();
  await map.locator('[data-map-square="147"][data-map-mesh="1"]').click();
  await map.locator('[data-inline-confirm-move]').click();
  for(let i=0;i<5&&(await state()).units.find(u=>u.id===pilot.id).timedAction;i++)await act({action:'step'});
  assert.equal((await state()).units.find(u=>u.id===pilot.id).location.stationed,false);
  await act({action:'nudge',id:pilot.id,amount:100});await pc.waitForTimeout(250);
  assert.equal(await pcFrame.getByRole('button',{name:'Pilot Console',exact:true}).count(),0);
  await act({action:'completeTurn',id:pilot.id});
  assert.equal((await state()).starships[0].navigation.phase,'powered');

  const builder=await context.newPage();await builder.goto(base+'/starship.html');
  await builder.getByRole('button',{name:'SICs',exact:true}).click();
  await builder.locator('[data-purchase-sic="cockpit-1"]').click();
  await builder.getByRole('button',{name:'SICs',exact:true}).click();
  await builder.locator('.sic-family-stack summary').filter({hasText:'Ionic Pulse Thruster'}).click();
  const picker=builder.getByRole('dialog',{name:/Ionic Pulse/});
  await picker.locator('img').first().waitFor();
  await builder.waitForFunction(()=>[...document.querySelectorAll('.sic-family-picker img')].every(i=>i.complete && i.naturalWidth>0));
  await builder.waitForTimeout(800);
  assert.equal(await picker.locator('img').evaluateAll(imgs=>imgs.every(i=>i.src.includes('-card.png'))),true);
  await builder.screenshot({path:path.join(artifacts,'ionic-cards.png')});
  await picker.getByRole('button',{name:'Purchase',exact:true}).first().click();
  await picker.waitFor({state:'detached'});
  await builder.getByRole('button',{name:'Starship',exact:true}).click();
  const thumb=builder.getByRole('button',{name:'Open Cockpit 1 card',exact:true});await thumb.scrollIntoViewIfNeeded();
  const size=await thumb.locator('article').evaluate(el=>[el.offsetWidth,el.offsetHeight,getComputedStyle(el).transform]);
  assert.deepEqual(size,[350,490,'matrix(0.333333, 0, 0, 0.333333, 0, 0)']);
  await builder.screenshot({path:path.join(artifacts,'purchased-cards.png')});await thumb.click();
  await builder.getByRole('dialog',{name:'SIC card details'}).waitFor();
  await builder.waitForTimeout(800);
  await builder.screenshot({path:path.join(artifacts,'cockpit-card.png')});
  await builder.getByRole('dialog',{name:'SIC card details'}).getByRole('button',{name:'Back to cards',exact:true}).click();
  await builder.evaluate(ship=>{ship={...ship,buildVersion:3};localStorage.setItem('sa-starship-layout-draft',JSON.stringify(ship));localStorage.setItem('sa-starship-library-v1',JSON.stringify([ship]));localStorage.setItem('sa-starship-active-v1',ship.id);localStorage.setItem('sa-starship-map-view',JSON.stringify({hull:true,labels:true,zoom:4}));},ships[0].ship);
  await builder.reload();await builder.locator('.hull-view .sa-bridge-window').first().waitFor();
  await builder.locator('.sa-bridge-window').first().scrollIntoViewIfNeeded();
  await builder.screenshot({path:path.join(artifacts,'hull-canopy.png')});
  await gm.close();await pc.close();await builder.close();
  const demo=await context.newPage();
  const demoResponse=demo.waitForResponse(response=>response.url().endsWith('/api/campaign/showcase/start'));
  await demo.goto(base+'/showcase.html');
  const demoRoom=await (await demoResponse).json();
  const demoGm=demo.frameLocator('#showcaseFrame');
  await demoGm.getByRole('button',{name:'Combat',exact:true}).click();
  await demoGm.getByRole('button',{name:'Resume Encounter',exact:true}).click();
  await demoGm.frameLocator('#atbFrame').getByRole('button',{name:'Engage Clock',exact:true}).click();
  await demo.waitForTimeout(600);
  const demoState=await fetch(base+'/api/state?room='+demoRoom.code).then(r=>r.json());
  assert.equal(demoState.running,true);assert.equal(demoState.starships.length,2);
  await demo.getByRole('button',{name:'Nova Vale',exact:true}).click();
  const demoPc=demo.frameLocator('#showcaseFrame');
  await demoPc.getByRole('button',{name:'Combat',exact:true}).click();
  await demoPc.frameLocator('#playerAtbFrame').locator('[data-space-ship]').first().waitFor();
  await demo.screenshot({path:path.join(artifacts,'explore-player.png')});
  console.log('Explore Features GM clock and PC combat perspective: passed');
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed. Artifacts: '+artifacts);
  console.log('Isolated campaign data: '+dataDir);
}
main().catch(async error=>{console.error(error);if(browser)for(const context of browser.contexts())for(const [i,page] of context.pages().entries())await page.screenshot({path:path.join(artifacts,`failure-${i}.png`)}).catch(()=>{});process.exitCode=1;})
  .finally(async()=>{if(browser)await browser.close();if(child && child.exitCode===null){const closed=once(child,'exit');child.kill();await closed;}});
