// API-created campaign, followed by actual player console and shared dice interaction.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'test-artifacts','lasers');fs.mkdirSync(artifacts,{recursive:true});
const laserTier=Number(process.env.SA_TEST_LASER_TIER)||1,lockTier=Number(process.env.SA_TEST_LOCK_TIER)||1;
let child,browser,base=process.env.SA_TEST_BASE;const lockTest=process.env.SA_TEST_LOCKS==='1',missTest=process.env.SA_TEST_MISS==='1',impairedTest=process.env.SA_TEST_IMPAIRED==='1';
async function main(){
  if(!base){child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-laser-'))},windowsHide:true,stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});child.stderr.on('data',c=>process.stderr.write(c));child.on('error',reject);});}
  const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;};
const campaignName='Laser Verification '+Date.now();const made=await post('campaign/create',{name:campaignName,gmCode:'laser-test-gm'},201),code=made.campaign.code,token=made.token;
  const pcRecord={id:'laser-pc',phase:'finalized',access:{pcCode:'laser-player'},identity:{characterName:'Laser Operator',playerName:'Test'},attributes:{health:[1,0,-1,-1],intellect:[1,0,-1,-1],dexterity:[3,3,-1,-1]},skills:{'Weapon Systems':{tenths:60},Mathematics:{tenths:40},'Pilot/Helm':{tenths:60}},computed:{maximumHp:30,moveSpeed:2,speed:.1,commandWindow:120,skills:{'Weapon Systems':6,Mathematics:4,'Pilot/Helm':6}},health:{current:30}};
  const join=await post('campaign/join/request',{code,character:pcRecord},201);await post('campaign/join/respond',{code,token,requestId:join.requestId,decision:'approve'});
  const playerToken=(await post('campaign/join/status',{code,characterId:pcRecord.id,pcCode:'laser-player'})).token;
  const ships=[0,1].map(i=>({id:'laser-ship-'+i,title:i?'Target Craft':'Laser Craft',crewCharacterIds:i?[]:[pcRecord.id],ship:{id:'laser-ship-'+i,title:i?'Target Craft':'Laser Craft',confirmedOnce:true,defenseScore:-100,gridCells:Array.from({length:56},(_,n)=>42+Math.floor(n/8)*20+n%8),sicInventory:[{id:'thruster',type:'ionic-pulse-thruster-1'},{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-4'},{id:'gun',type:`rapid-laser-${laserTier}`}],placements:[{sicId:'thruster',cell:26},{sicId:'cp',cell:42},{sicId:'sn',cell:43},{sicId:'en',cell:85},{sicId:'gun',cell:laserTier>=3?2:22}]}}));
  for(const ship of ships){ship.ship.sicInventory.push({id:'lock',type:`lock-on-${lockTier}`,impaired:impairedTest,impairmentPoints:impairedTest?1:0});ship.ship.placements.push({sicId:'lock',cell:44});if(lockTest&&ship===ships[1])ship.currentHullHp=4;await post('campaign/starship/link',{code,token,starship:ship.ship},201);await post('campaign/starship/crew',{code,token,starshipId:ship.id,crewCharacterIds:ship.crewCharacterIds});}
  const act=(body,status=200)=>post('action',{roomCode:code,gmToken:token,...body},status),state=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json());
  await act({action:'prepareEncounter',preparationId:'laser-browser-prep',mode:'starship',starships:ships,shipPositions:[{id:ships[0].id,q:0,r:0},{id:ships[1].id,q:1,r:0}],units:[{characterId:pcRecord.id,characterName:'Laser Operator',team:'pc',speed:.1,commandWindow:120,weaponSystemsSkill:6,mathematicsSkill:4,pilotSkill:6,dexterityDice:[10,10],location:{starshipId:ships[0].id,square:42,mesh:0,stationed:true}}]});
  const unit=(await state()).units[0];
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1366,height:768}}),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.addInitScript(()=>{window.laserAnimations=[];const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(options?.duration===650||options?.duration===1100||this.hasAttribute('data-laser-effect'))window.laserAnimations.push({frames,options});return animate.call(this,frames,options);};});
  const gm=await context.newPage();await gm.goto(base+'/gm.html?campaign='+code);await gm.getByRole('textbox',{name:'Campaign Name',exact:true}).fill(campaignName);await gm.getByRole('textbox',{name:'GM Code',exact:true}).fill('laser-test-gm');await gm.getByRole('button',{name:'Open Campaign',exact:true}).click();await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();await gm.frameLocator('#atbFrame').getByRole('button',{name:'Engage Clock',exact:true}).click();await act({action:'setHardPaused',paused:true});
  const pc=await context.newPage();await pc.goto(`${base}/character.html?campaign=${code}&character=${pcRecord.id}`);await pc.getByRole('button',{name:'Enter PC Code',exact:true}).click();await pc.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill('laser-player');await pc.getByRole('button',{name:'Unlock Character',exact:true}).click();await pc.getByRole('button',{name:'Combat',exact:true}).click();await pc.frameLocator('#playerAtbFrame').locator('[data-console-operator]').first().selectOption(unit.id);await pc.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();await pc.getByRole('combobox',{name:'Station console',exact:true}).selectOption('gun');
  const consoleView=pc.getByRole('dialog',{name:'Weapons console',exact:true});await consoleView.waitFor();await act({action:'nudge',id:unit.id,amount:100});await consoleView.getByRole('button',{name:'Fire Rapid Laser',exact:true}).waitFor();await pc.waitForTimeout(1000);
  await consoleView.locator('.console-pause-notice').filter({hasText:'Paused: Awaiting GM'}).waitFor();
  const frame=gm.frameLocator('#atbFrame'),lane=frame.locator('[data-ship-combat-lane]').first(),grid=lane.locator('.inline-combat-map-grid');
  await frame.locator('#collapseNpcTurn').click();
  const initialCell=await grid.evaluate(e=>getComputedStyle(e).getPropertyValue('--cell-size').trim());
  await lane.getByRole('button',{name:'Zoom in interior',exact:true}).click();await gm.waitForTimeout(300);const zoomedCell=await grid.evaluate(e=>getComputedStyle(e).getPropertyValue('--cell-size').trim());assert.notEqual(zoomedCell,initialCell,'Minimap zoom changes actual square dimensions');await lane.getByRole('button',{name:'Zoom out interior',exact:true}).click();assert.equal(await grid.evaluate(e=>getComputedStyle(e).getPropertyValue('--cell-size').trim()),initialCell);
  assert.match(await lane.locator('[data-ship-defense]').innerText(),/DEFENSE 0/);
  assert.match(await consoleView.locator('.console-defense').innerText(),/DEFENSE 0/);
  const motion=await frame.locator('body').evaluate(async(body,id)=>{
    const w=body.ownerDocument.defaultView,source=body.querySelector(`[data-space-ship="${id}"]`).closest('svg'),svg=source.cloneNode(true),rect=source.getBoundingClientRect();svg.style.cssText=`position:fixed;left:0;top:0;width:${rect.width}px;height:${rect.height}px;z-index:99999`;body.append(svg);
    const marker=svg.querySelector(`[data-space-ship="${id}"]`),circle=marker.querySelector('circle'),original=svg.getAttribute('viewBox'),results=[];
    for(const zoom of [1,.5,2]){
      const v=original.split(' ').map(Number);svg.setAttribute('viewBox',`${v[0]} ${v[1]} ${v[2]*zoom} ${v[3]*zoom}`);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const before=circle.getBoundingClientRect(),transform=marker.getAttribute('transform');w.SACombatFeedback.impact(id);let maximum=0;
      await new Promise(resolve=>{const start=performance.now();function sample(){const p=circle.getBoundingClientRect();maximum=Math.max(maximum,Math.hypot(p.x-before.x,p.y-before.y));if(performance.now()-start<700)requestAnimationFrame(sample);else resolve();}sample();});
      results.push({maximum,unchanged:marker.getAttribute('transform')===transform});
    }
    marker.classList.add('ship-wreck');w.SACombatFeedback.impact(id,true);
    const burst=marker.querySelector('[data-explosion]'),center=new DOMPoint(0,0).matrixTransform(marker.getScreenCTM()),rectBurst=burst.getBoundingClientRect();
    const assertAnchor=Math.hypot(rectBurst.x+rectBurst.width/2-center.x,rectBurst.y+rectBurst.height/2-center.y);
    results.push({maximum:assertAnchor,unchanged:getComputedStyle(burst).visibility==='visible'});
    svg.remove();return results;
  },ships[1].id);
  assert.ok(motion.every(m=>m.maximum<=1.7&&m.unchanged),'Ship shakes at most 1.5 screen pixels without changing its map position: '+JSON.stringify(motion));
  assert.ok(await lane.locator('.ship-lane-log').evaluate(e=>[e,...e.querySelectorAll('*')].every(n=>getComputedStyle(n).animationName==='none')),'Main activity log does not flash');
  await lane.locator('[data-inline-map-view="highResolution"]').check();
  assert.ok(await grid.locator('.combat-map-square:has(>.sa-exterior-weapon)').evaluateAll(cells=>cells.length&&cells.every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)')),'Exterior weapon cells have no opaque background');
  await pc.screenshot({path:path.join(artifacts,'console-1366.png')});
  const boxes=await consoleView.evaluate(v=>{const box=s=>{const r=v.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return [box('.shared-power'),box('.weapon-plot'),box('.weapon-controls')];});assert.ok(boxes[0].right<=boxes[1].x&&boxes[1].right<=boxes[2].x,'Map is not covered by neighboring panels');
  await consoleView.getByRole('button',{name:'Combat View',exact:true}).click();
  const rootActions=pc.frameLocator('#playerAtbFrame');
  for(const [name,field] of [['Hail Ship','[data-command-target]'],['Team Execution','[data-prepared-action]'],['Preemptive Calculation','[data-prepared-action]'],['Ram','[data-command-target]'],['Skim','[data-command-target]'],['Scan Hex','[data-map]'],['Life Scan','[data-map]'],['Lock-On','[data-target]']]){
    await rootActions.getByRole('button',{name,exact:true}).click();const planner=pc.getByRole('dialog',{name,exact:true});await planner.waitFor();assert.ok((await planner.boundingBox()).width<700,name+' remains compact');await planner.locator(field).waitFor({state:'visible'});await planner.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await state()).units[0].delayedAction,null,'Cancel '+name+' does not consume a turn');
  }
  assert.ok((await rootActions.getByRole('button',{name:'Team Execution',exact:true}).getAttribute('title')).length>20,'Help is directly on the action button');assert.equal(await rootActions.getByRole('button',{name:'About Team Execution',exact:true}).count(),0);
  await pc.screenshot({path:path.join(artifacts,'root-combat-actions.png')});
  await rootActions.getByRole('button',{name:'Evasive Maneuvers',exact:true}).click();
  const evadeRoll=pc.getByRole('dialog',{name:'Ship action dice roll'});await evadeRoll.waitFor();assert.equal(await pc.locator('.ship-navigation-dialog').count(),0,'Evasive Maneuvers goes straight to the shared roll');await evadeRoll.frameLocator('iframe').getByRole('button',{name:'Roll for Me',exact:true}).click();await evadeRoll.frameLocator('iframe').getByRole('button',{name:'Confirm and Submit',exact:true}).click();await evadeRoll.waitFor({state:'detached'});
  for(let i=0;i<35&&(await state()).units[0].delayedAction;i++)await act({action:'step'});assert.ok((await state()).starships[0].defenseScore>0,'Direct evasion raises Defense');await act({action:'nudge',id:unit.id,amount:100});
  await pc.frameLocator('#playerAtbFrame').getByRole('button',{name:`Fire Rapid Laser ${laserTier}`,exact:true}).click();
  const quick=pc.getByRole('dialog',{name:'Fire Rapid Laser',exact:true});await quick.waitFor();assert.equal((await state()).units[0].delayedAction,null,'Shortcut opens compact planning without firing');assert.ok((await quick.boundingBox()).width<700);await pc.screenshot({path:path.join(artifacts,'combat-fire-planner.png')});await quick.getByRole('button',{name:'Cancel',exact:true}).click();await pc.frameLocator('#playerAtbFrame').getByRole('button',{name:'Console View',exact:true}).click();await consoleView.waitFor();
  await consoleView.getByRole('button',{name:'Next console',exact:true}).click();
  await pc.getByRole('dialog',{name:'Lock-On console'}).getByRole('button',{name:'Previous console',exact:true}).click();await consoleView.waitFor();
  await consoleView.getByRole('combobox',{name:'Station console',exact:true}).selectOption('cp');
  const pilot=pc.getByRole('dialog',{name:'Pilot console',exact:true});await pilot.getByRole('button',{name:'Auto Zoom',exact:true}).click();assert.equal(await pilot.getByRole('button',{name:'Auto Zoom',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok(await pilot.locator('[data-space-canvas]').evaluate(svg=>[...svg.querySelectorAll('[data-space-ship]')].every(marker=>{const p=new DOMPoint(0,0).matrixTransform(marker.getCTM()).matrixTransform(svg.getCTM().inverse()),v=svg.viewBox.baseVal;return p.x>=v.x&&p.x<=v.x+v.width&&p.y>=v.y&&p.y<=v.y+v.height;})),'Auto zoom contains every visible ship');
  await pilot.getByRole('combobox',{name:'Station console',exact:true}).selectOption('gun');await consoleView.waitFor();
  if(lockTest){
    await consoleView.getByRole('combobox',{name:'Station console',exact:true}).selectOption('lock');const targeting=pc.getByRole('dialog',{name:'Lock-On console'});await targeting.waitFor();await targeting.getByRole('button',{name:'Lock-On',exact:true}).click();
    const dice=pc.getByRole('dialog',{name:'Ship action dice roll'});await dice.waitFor();await dice.frameLocator('iframe').getByRole('button',{name:'Roll for Me',exact:true}).click();await dice.frameLocator('iframe').getByRole('button',{name:'Confirm and Submit',exact:true}).click();await dice.waitFor({state:'detached'});
    for(let i=0;i<25&&(await state()).units[0].delayedAction;i++)await act({action:'step'});assert.equal((await state()).starships[0].lockState.targets[0].targetId,ships[1].id);await targeting.getByRole('button',{name:'Target Locked',exact:true}).waitFor();await pc.screenshot({path:path.join(artifacts,impairedTest?'lock-impaired.png':'lock-console.png')});assert.equal(await gm.locator('.lock-console').count(),0);
    await targeting.getByRole('combobox',{name:'Station console',exact:true}).selectOption('gun');await consoleView.waitFor();await act({action:'nudge',id:unit.id,amount:100});
  }
  const before=(await state()).starships[1].currentHullHp;
  if(lockTest)assert.equal(await consoleView.locator('.weapon-plot h3 span').innerText(),'LOCKED FIRE');
  await consoleView.getByRole('button',{name:'Fire Rapid Laser',exact:true}).click();
  const roll=pc.getByRole('dialog',{name:'Ship action dice roll'}),skill=roll.frameLocator('iframe');let pending=(await state()).units[0].delayedAction;assert.ok(pending.weaponOrder);assert.equal(pending.remaining,100);if(!lockTest){await roll.waitFor();await act({action:'step'});assert.equal((await state()).units[0].delayedAction.remaining,100);}else assert.equal(pending.rollConfirmed,true);assert.equal((await state()).starships[1].currentHullHp,before);
  await post('action',{roomCode:code,characterId:'wrong',characterToken:playerToken,action:'weaponCommand',id:unit.id,sicId:'gun',targetId:ships[1].id,requestId:'unauthorized-laser'},403);
  if(!lockTest){if(missTest){await skill.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill('0');await skill.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();}else{await skill.getByRole('button',{name:'Roll for Me',exact:true}).click();await pc.waitForTimeout(900);assert.ok(await skill.locator('#diceCanvas canvas').count());await pc.screenshot({path:path.join(artifacts,'laser-dice.png')});}await skill.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});}
  assert.equal((await state()).units[0].delayedAction.remaining,100);assert.equal((await state()).starships[1].currentHullHp,before);
  for(let n=0;n<20&&!(await state()).units[0].delayedAction?.weaponDamage;n++)await act({action:'step'});
  if(missTest){const missed=pc.getByRole('dialog',{name:'Shot Missed',exact:true});await missed.waitFor();assert.equal((await state()).starships[1].currentHullHp,before);await pc.screenshot({path:path.join(artifacts,'miss-acknowledgement.png')});await missed.getByRole('button',{name:'OK',exact:true}).click();await missed.waitFor({state:'detached'});assert.deepEqual(errors,[]);console.log('PASS: manual accuracy roll, miss acknowledgement, no automatic damage.');return;}
  assert.ok((await state()).units[0].delayedAction?.weaponDamage,'Successful shot waits for damage roll');assert.equal((await state()).starships[1].currentHullHp,before);
  await roll.waitFor();
  const damageRequest=(await state()).units[0].delayedAction;assert.ok(damageRequest.rollSpec.sides.every(n=>n===2+laserTier*2));
  await act({action:'rollShipAction',id:unit.id,rollId:damageRequest.id},400);
  await act({action:'rollShipAction',id:unit.id,rollId:damageRequest.id,diceResults:[99]},400);
  if(process.env.SA_TEST_MANUAL_DAMAGE==='1'){
    await skill.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill(String(damageRequest.weaponDamage.count));
    await skill.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();
    assert.equal(await skill.locator('#skillResultLabel').innerText(),'DAMAGE');
  }else{await skill.getByRole('button',{name:'Roll for Me',exact:true}).click();await pc.waitForTimeout(1000);await pc.screenshot({path:path.join(artifacts,'red-damage-dice.png')});}
  await skill.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});
  const done=await state();assert.ok(done.starships[1].currentHullHp<before,'Damage applied only after damage confirmation');assert.ok(done.starships[0].weaponState.reports[0].hit);
  await pc.locator('[data-laser-effect]').first().waitFor({state:'attached'});assert.equal(await roll.count(),0,'Damage dialog is closed while bolts are visible');await pc.waitForTimeout(120);await pc.screenshot({path:path.join(artifacts,'visible-blaster-burst.png')});
  await pc.waitForTimeout(1300);assert.ok(await pc.evaluate(()=>laserAnimations.some(a=>a.options.duration===650||a.options.duration===1100)),'Red impact animation rendered');assert.ok(await pc.evaluate(()=>laserAnimations.some(a=>a.options.duration===320)),'Rapid blaster bursts rendered');
  if(lockTest){assert.ok(done.starships[1].destroyedAt);assert.ok(done.starships[0].victoryAt);await pc.getByRole('dialog',{name:'VICTORY',exact:true}).waitFor();assert.ok(await pc.locator('.ship-wreck [data-debris]').count());await pc.screenshot({path:path.join(artifacts,'victory.png')});await pc.getByRole('dialog',{name:'VICTORY',exact:true}).getByRole('button',{name:'OK',exact:true}).click();await pc.locator('[data-player-ship-details]').waitFor();assert.ok((await state()).encounterEndedAt);}
  if(!lockTest){await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await pc.locator('.weapon-console[data-atb-charging="true"]').waitFor();await pc.waitForTimeout(650);assert.notEqual(await consoleView.locator('.ring-backplate').first().evaluate(e=>getComputedStyle(e).filter),'none');await pc.screenshot({path:path.join(artifacts,'charging-halo.png')});await act({action:'setHardPaused',paused:true});}
  await pc.screenshot({path:path.join(artifacts,'laser-result.png')});await pc.setViewportSize({width:1920,height:1080});await pc.waitForTimeout(300);await pc.screenshot({path:path.join(artifacts,'console-1920.png')});await pc.setViewportSize({width:390,height:844});await pc.waitForTimeout(300);await pc.screenshot({path:path.join(artifacts,'console-mobile.png')});
  assert.equal(await gm.locator('.weapon-console').count(),0);assert.deepEqual(errors,[]);
  const shop=await context.newPage();await shop.goto(base+'/starship.html');await shop.getByRole('button',{name:'SICs',exact:true}).click();await shop.locator('summary[aria-label="Rapid Laser: expand 5 cards"]').click();await shop.locator('[data-purchase-type="rapid-laser-1"]:visible').waitFor();await shop.waitForFunction(()=>[...document.querySelectorAll('dialog[open] img')].every(img=>img.complete&&img.naturalWidth>0));await shop.waitForTimeout(1000);await shop.screenshot({path:path.join(artifacts,'laser-card.png')});assert.equal(await shop.locator('[data-purchase-type]:visible').count(),5);
  await shop.getByRole('dialog',{name:'Rapid Laser',exact:true}).getByRole('button',{name:'Back',exact:true}).click();
  await shop.locator('summary[aria-label="Lock-On System: expand 10 cards"]').click();
  await shop.waitForFunction(()=>[...document.querySelectorAll('dialog[open] img')].every(img=>img.complete&&img.naturalWidth>0));await shop.waitForTimeout(1100);
  assert.equal(await shop.locator('[data-purchase-type]:visible').count(),10);await shop.screenshot({path:path.join(artifacts,'lock-family-cards.png')});
  await shop.locator('[data-purchase-type="lock-on-10"]:visible').click();
  await shop.getByRole('button',{name:'Construction',exact:true}).click();await shop.getByRole('button',{name:'Open Lock-On System 10 card',exact:true}).click();
  const card=shop.getByRole('dialog',{name:'SIC card details'});await card.waitFor();await shop.waitForTimeout(600);await shop.screenshot({path:path.join(artifacts,'lock-10-inspector.png')});await card.getByRole('button',{name:'Back to cards',exact:true}).click();
  console.log('PASS: full card families and tier-10 purchase, direct combat actions, GM/PC access, shared dice, frozen roll/input, anchored impacts, atomic damage, responsive consoles. '+base);
}
main().catch(async e=>{console.error(e);process.exitCode=1;if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:path.join(artifacts,'failure-'+c.pages().indexOf(p)+'.png')}).catch(()=>{});}).finally(async()=>{await browser?.close();if(child){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}});
