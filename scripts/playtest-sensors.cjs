// Fresh campaign fixtures use the API; console interactions use real browser mouse events.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'test-artifacts','sensors');
fs.mkdirSync(artifacts,{recursive:true});
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-sensor-browser-'));
let child,browser,base;
async function start(){
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe'],windowsHide:true});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.on('error',reject);child.stdout.on('data',chunk=>{const url=String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});child.stderr.on('data',c=>process.stderr.write(c));});
}
async function main(){
  await start();
  const post=async(route,body,status=200)=>{const res=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await res.json();assert.equal(res.status,status,JSON.stringify(json));return json;};
  const created=await post('campaign/create',{name:'Sensor Test',gmCode:'sensor-test-gm'},201),code=created.campaign.code;
  let token=created.token;
  const people=['Observer','Other Crew'].map((name,i)=>({id:'sensor-pc-'+i,phase:'finalized',access:{pcCode:'sensor-code-'+i},identity:{characterName:name,playerName:name},attributes:{health:[1,0,-1,-1],intellect:[1,0,-1,-1],perception:[1,0,-1,-1],dexterity:[1,0,-1,-1]},computed:{maximumHp:30,moveSpeed:2,speed:.1,commandWindow:120,skills:{'Sensor Systems':6}},health:{current:30}}));
  const tokens=[];
  for(const character of people){const join=await post('campaign/join/request',{code,character},201);await post('campaign/join/respond',{code,token,requestId:join.requestId,decision:'approve'});tokens.push((await post('campaign/join/status',{code,characterId:character.id,pcCode:character.access.pcCode})).token);}
  const ships=people.map((person,i)=>({id:'scan-ship-'+i,title:i?'Hidden Rival':'Observatory',crewCharacterIds:[person.id],ship:{id:'scan-ship-'+i,title:i?'Hidden Rival':'Observatory',confirmedOnce:true,defenseScore:1,gridCells:Array.from({length:9},(_,n)=>42+Math.floor(n/3)*20+n%3),sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-engine-1'}],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43},{sicId:'en',cell:64}]}}));
  for(const ship of ships){await post('campaign/starship/link',{code,token,starship:ship.ship},201);await post('campaign/starship/crew',{code,token,starshipId:ship.id,crewCharacterIds:ship.crewCharacterIds});}
  const act=(body,status=200)=>post('action',{roomCode:code,gmToken:token,...body},status);
  const state=(viewer=token)=>fetch(`${base}/api/state?room=${code}&token=${viewer}`).then(r=>r.json());
  await act({action:'prepareEncounter',preparationId:'sensor-browser-prep',mode:'starship',starships:ships,shipPositions:[{id:ships[0].id,q:0,r:0},{id:ships[1].id,q:7,r:0}],units:people.map((p,i)=>({characterId:p.id,characterName:p.identity.characterName,team:'pc',speed:.1,commandWindow:120,sensorSkill:6,location:{starshipId:ships[i].id,square:42,mesh:0,stationed:true}}))});
  const operator=(await state()).units.find(u=>u.characterId===people[0].id);
  const privateState=await state(tokens[0]);assert.equal(privateState.starships[1].contactOnly,true);assert.deepEqual(privateState.starships[1].ship.sicInventory,[]);assert.equal(privateState.units.length,1);
  assert.equal((await state('')).starships.length,0,'Anonymous state must not reveal the fleet');
  const controller=new AbortController();
  try {
    const stream=await fetch(`${base}/events?room=${code}&unit=${operator.id}&token=${tokens[0]}`,{signal:controller.signal}),reader=stream.body.getReader();
    let text='';
    while(!text.includes('event: state\n'))text+=new TextDecoder().decode((await reader.read()).value);
    while(!text.slice(text.indexOf('event: state\n')).includes('\n\n'))text+=new TextDecoder().decode((await reader.read()).value);
    const packet=JSON.parse(text.match(/event: state\ndata: ([^\n]+)/)[1]);
    assert.equal(packet.units.length,1);assert.equal(packet.starships[1].contactOnly,true);assert.deepEqual(packet.starships[1].ship.placements,[]);
  } finally {controller.abort();}
  browser=await chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'msedge',headless:true});
  const errors=[],requests=[];
  async function page(){const c=await browser.newContext({viewport:{width:1366,height:768}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().endsWith('/api/action')&&r.postDataJSON()?.action==='sensorCommand')requests.push(r.postDataJSON());});return p;}
  const gm=await page();await gm.goto(base+'/gm.html?campaign='+code);await gm.getByRole('textbox',{name:'Campaign Name',exact:true}).fill('Sensor Test');await gm.getByRole('textbox',{name:'GM Code',exact:true}).fill('sensor-test-gm');await gm.getByRole('button',{name:'Open Campaign',exact:true}).click();await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();
  const frame=gm.frameLocator('#atbFrame');await frame.getByRole('button',{name:'Engage Clock',exact:true}).click();await act({action:'setHardPaused',paused:true});
  const pcs=[];
  for(const character of people){const p=await page();await p.goto(`${base}/character.html?campaign=${code}&character=${character.id}`);await p.getByRole('button',{name:'Enter PC Code',exact:true}).click();await p.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill(character.access.pcCode);await p.getByRole('button',{name:'Unlock Character',exact:true}).click();await p.getByRole('button',{name:'Combat',exact:true}).click();pcs.push(p);}
  const pc=pcs[0];await pc.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();
  await pc.getByRole('combobox',{name:'Station console',exact:true}).selectOption('sn');
  const consoleView=pc.getByRole('dialog',{name:'Sensor console',exact:true});await consoleView.waitFor();
  assert.equal(await gm.locator('.sensor-console').count(),0,'No automatic player console for GM');
  async function ready(){await act({action:'nudge',id:operator.id,amount:100});await consoleView.locator('[data-turn]').filter({hasText:'YOUR TURN'}).waitFor();}
  async function step(count){for(let i=0;i<count;i++)await act({action:'step'});
    const pending=(await state()).units.find(u=>u.id===operator.id)?.delayedAction;
    if(pending?.awaitingRoll){
      const roll=pc.getByRole('dialog',{name:'Ship action dice roll'});await roll.waitFor();
      await gm.getByRole('status').filter({hasText:'roll required'}).waitFor();
      await act({action:'step'});assert.equal((await state()).units.find(u=>u.id===operator.id).delayedAction.id,pending.id,'Waits for an explicit roll');
      await post('action',{roomCode:code,characterId:people[1].id,characterToken:tokens[1],action:'rollShipAction',id:operator.id,rollId:pending.id},403);
      await pc.screenshot({path:path.join(artifacts,'roll-prompt.png')});
      await roll.getByRole('button',{name:'Roll Dice',exact:true}).click();await roll.getByRole('button',{name:'Continue',exact:true}).click();
      const first=(await state()).units.find(u=>u.id===operator.id).lastShipRoll;
      await act({action:'rollShipAction',id:operator.id,rollId:pending.id});assert.deepEqual((await state()).units.find(u=>u.id===operator.id).lastShipRoll,first,'Retry preserves the original result');
    }
  }
  await ready();await consoleView.locator('[data-q]').fill('7');await consoleView.locator('[data-r]').fill('0');await pc.waitForTimeout(500);assert.equal(await consoleView.locator('[data-q]').inputValue(),'7');
  const scan=consoleView.getByRole('button',{name:'Scan Hex',exact:true}),rect=await scan.boundingBox();
  await pc.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2,{steps:18});await pc.mouse.down();await pc.waitForTimeout(350);await pc.mouse.up();await pc.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
  await consoleView.locator('[data-turn]').filter({hasText:'SCANNING'}).waitFor();assert.equal(requests.length,1,'Held click and retry must submit once');
  const frozenAtb=(await state()).units.find(u=>u.id===operator.id).atb;
  await act({action:'setHardPaused',paused:false});await pc.waitForTimeout(1250);await act({action:'setHardPaused',paused:true});
  const typing=(await state()).units.find(u=>u.id===operator.id);assert.equal(typing.atb,frozenAtb);assert.ok(typing.delayedAction.remaining<100&&typing.delayedAction.remaining>0);
  await step(9);await consoleView.locator('[data-reports]').filter({hasText:'Hex scan complete'}).waitFor();
  await ready();await consoleView.getByRole('combobox',{name:'Detected contact',exact:true}).selectOption(ships[1].id);await consoleView.getByRole('button',{name:'Systems Analysis',exact:true}).click();await consoleView.locator('[data-turn]').filter({hasText:'SCANNING'}).waitFor();await step(9);
  assert.ok((await state()).units.find(u=>u.id===operator.id).queuedEffects.some(e=>e.sensorReport));await step(13);
  await consoleView.locator('[data-reports]').filter({hasText:'Snapshot at scan completion'}).waitFor();assert.ok((await state(tokens[0])).starships[0].sensorState.reports.some(r=>r.analysis));assert.ok(!(await state(tokens[1])).starships[0].sensorState.reports.some(r=>r.analysis));
  await ready();await consoleView.locator('.conditional-order-controls summary').click();await consoleView.locator('[data-conditional]').check();
  await consoleView.getByRole('button',{name:'Scan Area',exact:true}).click();await consoleView.locator('[data-error]').filter({hasText:'2 extra AU'}).waitFor();
  assert.equal((await state()).units.find(u=>u.id===operator.id).delayedAction,null,'Unaffordable conditional input must not consume a turn');
  await consoleView.locator('[data-conditional]').uncheck();await consoleView.locator('.conditional-order-controls summary').click();
  await pc.screenshot({path:path.join(artifacts,'sensor-console-1366.png')});
  await pc.setViewportSize({width:1920,height:1080});await pc.screenshot({path:path.join(artifacts,'sensor-console-1920.png')});
  await ready();await consoleView.getByRole('button',{name:'Life Scan',exact:true}).click();await consoleView.locator('[data-turn]').filter({hasText:'SCANNING'}).waitFor();await step(9);
  await consoleView.locator('[data-reports]').filter({hasText:'1 lifeform detected'}).waitFor();
  await ready();pc.once('dialog',d=>d.accept());await consoleView.getByRole('button',{name:'Share Data',exact:true}).click();await consoleView.locator('[data-turn]').filter({hasText:'SCANNING'}).waitFor();await step(9);assert.ok((await state(tokens[1])).starships[0].sensorState.reports.some(r=>r.sharedBy));
  await consoleView.getByRole('combobox',{name:'Station console',exact:true}).selectOption('cp');
  const pilotConsole=pc.getByRole('dialog',{name:'Pilot console',exact:true});await pilotConsole.waitFor();
  for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
    await pc.setViewportSize(size);await pc.waitForTimeout(500);
    const chart=pilotConsole.locator('[data-navigation-map] svg');
    for(const zoom of [null,'1.25','0.8']){
      if(zoom)await pilotConsole.locator('[data-zoom]').nth(zoom==='1.25'?1:0).click();
      const ratios=await chart.evaluate(svg=>({actual:svg.clientWidth/svg.clientHeight,view:svg.viewBox.baseVal.width/svg.viewBox.baseVal.height}));
      assert.ok(Math.abs(ratios.actual-ratios.view)<.02,'Navigation fills the chart at every zoom');
    }
    await pc.screenshot({path:path.join(artifacts,`navigation-${size.width}.png`)});
  }
  await pilotConsole.getByRole('button',{name:'Command',exact:true}).click();
  await pilotConsole.getByRole('tab',{name:'Preparation',exact:true}).click();
  await pilotConsole.getByRole('button',{name:'About Team Execution',exact:true}).click();
  await pc.locator('.ship-action-help').waitFor();assert.match(await pc.locator('.ship-action-help').innerText(),/before fusion/);await pc.locator('.ship-action-help').getByRole('button',{name:'Close',exact:true}).click();
  await act({action:'nudge',id:operator.id,amount:100});
  await pilotConsole.getByRole('button',{name:'Team Execution',exact:true}).click();await step(12);
  assert.ok((await state()).starships[0].commandSystems.preparations.some(p=>p.kind==='team'));
  await pc.screenshot({path:path.join(artifacts,'command-page.png')});
  await pc.setViewportSize({width:1366,height:768});await pilotConsole.locator('.pilot-command-operations').evaluate(e=>e.scrollTop=0);
  const titleBox=await pilotConsole.locator('.pilot-chart-title').boundingBox(),panelBox=await pilotConsole.locator('.pilot-command-operations').boundingBox();
  assert.ok(panelBox.y>=titleBox.y+titleBox.height-1,'Command controls must not scroll behind the title');
  await pc.screenshot({path:path.join(artifacts,'command-page-1366.png')});
  await act({action:'nudge',id:operator.id,amount:100});
  await pilotConsole.getByRole('button',{name:'Leave Console',exact:true}).click();
  const interiors=pc.frameLocator('#playerAtbFrame');
  await pc.route('**/ship-combat-map.css*',async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.continue();});
  await interiors.getByRole('button',{name:'Enlarge ship interior',exact:true}).first().click();
  await pc.waitForTimeout(150);assert.equal(await pc.locator('.expanded-interior-dialog[open]').count(),0,'Do not show an unstyled interior while CSS is loading');
  const enlarged=pc.locator('.expanded-interior-dialog');await enlarged.waitFor();
  const cell=enlarged.locator('[data-map-square="43"][data-map-mesh="4"]');await cell.scrollIntoViewIfNeeded();
  const box=await cell.boundingBox();assert.ok(box.width>=24&&box.height>=24,'Station-sized targets must remain clickable');
  await pc.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:15});await pc.mouse.down();await pc.waitForTimeout(300);await pc.mouse.up();
  const confirmMove=enlarged.getByRole('button',{name:'Confirm Move',exact:true});await confirmMove.waitFor();assert.equal(await confirmMove.isEnabled(),true);
  await enlarged.getByRole('button',{name:'Back',exact:true}).click();
  assert.equal(await interiors.getByRole('button',{name:'Confirm Move',exact:true}).isEnabled(),true,'Back preserves locked destination');
  await interiors.getByRole('button',{name:'Enlarge ship interior',exact:true}).first().click();
  await pc.screenshot({path:path.join(artifacts,'expanded-interior.png')});
  const confirmBox=await confirmMove.boundingBox();await pc.mouse.move(confirmBox.x+confirmBox.width/2,confirmBox.y+confirmBox.height/2,{steps:18});await pc.mouse.down();await pc.waitForTimeout(400);await pc.mouse.up();
  await enlarged.waitFor({state:'detached'});await step(20);
  assert.equal((await state()).units.find(u=>u.id===operator.id).location.square,43);
  assert.equal(await interiors.locator('[data-ship-combat-lane]').count(),1);
  await act({action:'nudge',id:operator.id,amount:100});await interiors.getByRole('button',{name:'SIC Maintenance',exact:true}).click();
  let maintenance=pc.getByRole('dialog',{name:'SIC Maintenance',exact:true});await maintenance.waitFor();assert.equal(await maintenance.getByRole('button',{name:'Repair SIC',exact:true}).isDisabled(),true);
  pc.once('dialog',d=>d.accept());await maintenance.getByRole('button',{name:'Power Off',exact:true}).click();await maintenance.waitFor({state:'detached'});
  assert.equal((await state()).starships[0].ship.sicInventory.find(i=>i.id==='sn').disabled,true);
  await act({action:'nudge',id:operator.id,amount:100});await interiors.getByRole('button',{name:'SIC Maintenance',exact:true}).click();
  maintenance=pc.getByRole('dialog',{name:'SIC Maintenance',exact:true});await maintenance.getByRole('button',{name:'Restart SIC',exact:true}).click();await maintenance.waitFor({state:'detached'});
  assert.ok((await state()).starships[0].ship.sicInventory.find(i=>i.id==='sn').bootRemaining>0);
  await post('campaign/starship/diagnostics',{code,token:tokens[0],characterId:people[0].id,starshipId:ships[0].id},409);
  await act({action:'exitEncounter'});
  await pc.getByRole('button',{name:'Starships',exact:true}).click();
  pc.once('dialog',dialog=>dialog.accept());
  await pc.getByRole('button',{name:'System Repairs and Diagnostics',exact:true}).click();
  await pc.getByText('Diagnostics: 55 minutes remaining',{exact:true}).waitFor();
  await post('campaign/time/pass',{code,token,amount:54,unit:'minutes',requestId:'diagnostics-54-test'});
  await pc.getByText('Diagnostics: 1 minutes remaining',{exact:true}).waitFor();
  await post('campaign/time/pass',{code,token,amount:1,unit:'minutes',requestId:'diagnostics-1-test'});
  await pc.getByText('Diagnostics: 1 minutes remaining',{exact:true}).waitFor({state:'detached'});
  await pc.reload();await pc.getByRole('button',{name:'Combat',exact:true}).click();await pc.waitForTimeout(800);
  const builder=await page();await builder.goto(base+'/starship.html');await builder.getByRole('button',{name:'SICs',exact:true}).click();await builder.locator('summary').filter({hasText:'Sensors'}).click();await builder.getByRole('dialog',{name:'Sensors',exact:true}).waitFor();assert.equal(await builder.locator('.sic-picker-slot').count(),9);await builder.locator('.sic-picker-slot img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await builder.waitForTimeout(700);await builder.screenshot({path:path.join(artifacts,'sensor-cards-1366.png')});
  await builder.locator('[data-family-back]').click();
  await builder.evaluate(ship=>localStorage.setItem('sa-starship-layout-draft',JSON.stringify({...draft,...ship,confirmed:ship})),ships[0].ship);
  await builder.reload();await builder.getByRole('button',{name:'Ship Details',exact:true}).click();
  assert.equal(await builder.locator('.desktop-live-stats [data-sensor-range]').textContent(),'12');
  await builder.screenshot({path:path.join(artifacts,'sensor-ship-details.png')});
  const demo=await post('campaign/showcase/start',{});const demoCode=demo.code;const demoState=await fetch(`${base}/api/state?room=${demoCode}&token=${demo.gmToken}`).then(r=>r.json());assert.equal(demoState.starships.length,2);assert.ok(demoState.starships.every(s=>s.sensorState.contacts[demoState.starships.find(o=>o.id!==s.id).id]?.level==='unknown'));
  assert.deepEqual(errors,[]);
  await new Promise(r=>setTimeout(r,600));await browser.close();browser=null;const stopped=once(child,'exit');child.kill();await stopped;await start();
  token=(await post('campaign/open',{name:'Sensor Test',gmCode:'sensor-test-gm'})).token;
  tokens[0]=(await post('campaign/join/status',{code,characterId:people[0].id,pcCode:people[0].access.pcCode})).token;
  assert.ok((await state()).starships[0].sensorState.reports.some(r=>r.analysis));assert.equal((await state(tokens[0])).starships.length,0);
  await act({action:'prepareEncounter',preparationId:'pending-roll-restart',mode:'starship',starships:ships,shipPositions:[{id:ships[0].id,q:0,r:0},{id:ships[1].id,q:7,r:0}],units:[{characterId:people[0].id,characterName:'Observer',team:'pc',speed:.1,commandWindow:120,sensorSkill:6,location:{starshipId:ships[0].id,square:42,mesh:0,stationed:true}}]});
  const restoredActor=(await state()).units[0];
  await act({action:'nudge',id:restoredActor.id,amount:100});
  await act({action:'sensorCommand',id:restoredActor.id,sicId:'sn',kind:'hex',hex:{q:7,r:0},requestId:'restart-roll-test'});
  for(let i=0;i<12;i++)await act({action:'step'});
  const pending=(await state()).units[0].delayedAction;assert.equal(pending.awaitingRoll,true);
  await new Promise(r=>setTimeout(r,600));const exit=once(child,'exit');child.kill();await exit;await start();
  token=(await post('campaign/open',{name:'Sensor Test',gmCode:'sensor-test-gm'})).token;
  assert.equal((await state()).units[0].delayedAction.id,pending.id,'Pending roll survives restart');
  await act({action:'rollShipAction',id:restoredActor.id,rollId:pending.id});
  const result=(await state()).units[0].lastShipRoll;assert.equal(result.id,pending.id,'GM can resolve the restored player roll');
  await act({action:'rollShipAction',id:restoredActor.id,rollId:pending.id});assert.deepEqual((await state()).units[0].lastShipRoll,result);
  console.log('Browser checks passed: fresh GM/two PCs, sensor privacy, held mouse clicks, explicit retry-safe rolls, queued analysis, automatic hex Life Scan, share, full-chart zoom, Command help and preparation, enlarged movement, campaign diagnostics/time, reload, cards, demo contacts, pending-roll restart and GM recovery.');console.log(artifacts);
}
main().catch(async e=>{console.error(e);if(browser)for(const [i,c]of browser.contexts().entries())for(const [j,p]of c.pages().entries())await p.screenshot({path:path.join(artifacts,`failure-${i}-${j}.png`)}).catch(()=>{});process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(child&&child.exitCode===null){const stop=once(child,'exit');child.kill();await stop;}});
