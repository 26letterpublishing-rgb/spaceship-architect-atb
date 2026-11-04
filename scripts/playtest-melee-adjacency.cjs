const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {startFixture}=require('../tests/melee-adjacency-http.test.js');
const out=path.resolve('../SA-ATB Local Development Files/outputs/melee-adjacency-nov02/browser');fs.mkdirSync(out,{recursive:true});
(async()=>{let f,browser;const errors=[],results=[];try{
 f=await startFixture();const pending=await f.post('/api/campaign/join/request',{code:f.code,character:{id:'melee-pc',phase:'finalized',access:{pcCode:'owned-pc'},identity:{characterName:'Melee PC'},attributes:{health:[1,1]},health:{current:30},weapons:[{inventoryId:'attacker-weapon',weaponId:'unarmed'}]}},201);
 await f.post('/api/campaign/join/respond',{code:f.code,token:f.token,requestId:pending.requestId,decision:'approve'});
 const joined=await f.post('/api/campaign/join/status',{code:f.code,characterId:'melee-pc',pcCode:'owned-pc'});
 const e=f.encounter();e.units[0].team='pc';e.units[0].characterId='melee-pc';e.activeSource='pc';e.commandDeadline=null;e.commandWindow=0;
 const diagonal=structuredClone(e.units[1]);diagonal.id='diagonal';diagonal.characterName='Diagonal excluded';diagonal.location.square=32;e.units.push(diagonal);await f.restore(e);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1366,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(f.base+'/');await page.evaluate(({code,token})=>localStorage.setItem('sa-character-token-'+code+'-melee-pc',token),{code:f.code,token:joined.token});
 await page.goto(f.base+'/index.html?embedded=player&campaign='+f.code+'&character=melee-pc');
 const melee=page.locator('[data-combat-action="melee"]:visible').first();await melee.waitFor();await melee.click();await page.locator('#combatActionDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#combatTarget option[value="diagonal"]').count(),0);assert.equal(await page.locator('#combatTarget option[value="defender"]').count(),1);
 await page.screenshot({path:path.join(out,'pc-melee-cardinal-1366.png')});results.push({pcTargetList:'cardinal only'});
 await page.locator('#combatActionForm [type="submit"]').click();await page.waitForFunction(()=>SACombatBridge.state()?.attackResolution?.defenderId==='defender');results.push({pcSubmittedCardinal:true});
 await page.reload();await page.waitForFunction(()=>SACombatBridge.state()?.attackResolution?.defenderId==='defender');results.push({pendingReload:true});
 await page.close();await f.restore(f.encounter(32));
 const gm=await browser.newPage({viewport:{width:1366,height:900}});gm.on('pageerror',e=>errors.push(e.message));gm.on('dialog',d=>d.dismiss());await gm.goto(f.base+'/');await gm.evaluate(({code,token})=>localStorage.setItem('sa-gm-token-'+code,token),{code:f.code,token:f.token});await gm.goto(f.base+'/index.html?embedded=gm&campaign='+f.code);
 await gm.waitForFunction(()=>SACombatBridge.state()?.units?.length===2);
 await gm.evaluate(()=>openGmNpcAttackDialog());assert.equal(await gm.locator('#gmNpcAttackTarget option[value="defender"]').count(),0);
 await gm.screenshot({path:path.join(out,'gm-diagonal-rejected-1366.png')});results.push({gmDiagonalRejected:true});
 assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));await browser?.close();await f?.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
