const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../SA-ATB Local Development Files/outputs/explore-attack-handoff-nov01/browser');fs.mkdirSync(out,{recursive:true});let child,browser,page;const result={checks:[],errors:[]};
async function main(){
 child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-attack-handoff-'))},stdio:['ignore','pipe','pipe']});child.stderr.on('data',c=>fs.appendFileSync(path.join(out,'server-stderr.txt'),c));
 const base=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(t);resolve(u);}});child.once('error',reject);});
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','Connection':'close'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});context.on('page',p=>p.on('pageerror',e=>result.errors.push(e.stack)));page=await context.newPage();page.setDefaultTimeout(15000);
 const started=page.waitForResponse(r=>r.url().endsWith('/api/campaign/showcase/start'));await page.goto(base+'/showcase.html');const room=await(await started).json(),code=room.code,token=room.gmToken,player=room.players.find(p=>p.name==='Nova Vale');
 const state=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json()),backup=()=>fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json()),act=(body,status=200)=>post('action',{roomCode:code,gmToken:token,...body},status);
 async function until(check,label,ms=20000){const end=Date.now()+ms;while(Date.now()<end){const s=await state();if(check(s))return s;await new Promise(r=>setTimeout(r,100));}fs.writeFileSync(path.join(out,'timeout-state.json'),JSON.stringify(await state(),null,2));throw Error('Timed out: '+label);}
 await act({action:'setHardPaused',paused:true});const saved=await backup(),e=saved.campaign.encounter,pc=e.units.find(u=>u.characterId===player.id),npc=e.units.find(u=>u.team==='npc');assert.ok(pc&&npc);
 for(const u of e.units)Object.assign(u,{automationMode:'off',atb:0,speed:.01,delayedAction:null,timedAction:null,delayTimer:null,consoleHold:null,pendingShipRolls:[]});
 Object.assign(npc,{characterName:'Space Slug',location:{...pc.location,stationed:false},automationMode:'npc',automationSuspended:false,dexterityDice:[6,6,6,6],projectileSkill:0,atb:100,exertionCurrent:2});
 Object.assign(e,{hasEngagedClock:true,encounterEndedAt:null,activeId:npc.id,pausedForTurn:true,hardPaused:true,holdPaused:false,running:false,resumeAfterTurn:false,attackResolution:{id:'saved-slug-attack',phase:'checks',source:'manual',attackerId:npc.id,defenderId:pc.id,attackerName:'Space Slug',defenderName:'Nova Vale',attackType:'ranged',weaponName:'QA attack',attackerRoll:null,defenseRoll:null,damageRoll:null,plan:{attackSkill:'Projectile',attackAttribute:'dexterity',damageFormula:'1D4',damageFormulaSupported:true,rangeModifier:0},defenderCommandTotal:0}});
 const values=[5,4,1,4];npc.automationPresentation={id:e.attackResolution.id+':attacker',label:'Space Slug attacker',sides:[6,6,6,6],values,score:14,displayScore:14,damage:false,phase:'rolling',remaining:-2,animationComplete:true,personalAttack:true};
 await post('campaign/restore',{code,token,backup:saved});await page.reload();
 const gm=()=>page.frameLocator('[data-explore-perspective="gm"]'),nova=()=>page.frameLocator(`[data-explore-perspective="${player.id}"]`);
 await gm().locator('.gm-tabs [data-tab=atb]').click();
 await page.getByRole('button',{name:'Nova Vale',exact:true}).click();
 await nova().locator('#skillCheckModal').waitFor({state:'visible'});
 assert.equal(await nova().locator('.automatic-dice-dialog').count(),0);await page.screenshot({path:path.join(out,'nova-defense-recovered.png')});
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'Orion Reed',exact:true}).click();await page.getByRole('button',{name:'GM',exact:true}).click();await page.getByRole('button',{name:'Nova Vale',exact:true}).click();await nova().locator('#skillCheckModal').waitFor({state:'visible'});assert.equal(await nova().locator('.automatic-dice-dialog').count(),0);}
 await page.reload();await nova().locator('#skillCheckModal').waitFor({state:'visible'});assert.equal(await nova().locator('.automatic-dice-dialog').count(),0);assert.deepEqual((await state()).units.find(u=>u.id===npc.id).automationPresentation.values,values);
 result.checks.push('saved premature attacker overlay yields to actual Nova Defense prompt across repeated role switches and reload; saved dice unchanged');
 // Use the actual visible Defense dialog and its explicit submission.
 await nova().locator('#manualSkillScore').fill('1');await nova().locator('#calculateManualSkill').click();await nova().locator('#exitSkillResult').click();
 await until(s=>s.attackResolution?.defenseRoll,'PC Defense submission');
 await act({action:'setHardPaused',paused:false});
 const hit=await until(s=>s.attackResolution?.attackerRoll,'saved To-Hit accepted');assert.equal(hit.attackResolution.attackerRoll.score,14);assert.deepEqual(hit.attackResolution.attackerRoll.diceResults,values);
 await act({action:'setHardPaused',paused:true});
 for(const name of ['GM','Orion Reed','Nova Vale'])await page.getByRole('button',{name,exact:true}).click();
 assert.deepEqual((await state()).attackResolution.attackerRoll.diceResults,values);
 // Close only this owned fixture's GM view, not the server or any real room.
 await page.locator('[data-explore-perspective="gm"]').evaluate(e=>e.remove());
 await act({action:'setHardPaused',paused:false});
 await until(s=>!s.attackResolution,'automatic damage and GM application with GM iframe closed',45000);
 result.checks.push('GM/Nova/Orion switches preserve attack; damage/application completes with test GM iframe genuinely removed');
 const final=await state();assert.equal(final.log.filter(l=>l.text?.includes('Space Slug submitted To-Hit')).length,1);assert.equal(final.units.find(u=>u.id===npc.id).exertionCurrent,2);
 await nova().locator('.automatic-dice-dialog').waitFor({state:'detached'});await page.screenshot({path:path.join(out,'attack-completed.png')});result.checks.push('real server accepts preserved To-Hit once after PC Defense; automatic damage/application completes without Exertion');
 // A fresh attack must not create any attacker presentation before Defense.
 delete npc.automationPresentation;e.attackResolution={...e.attackResolution,attackerRoll:null,defenseRoll:null,damageRoll:null};await post('campaign/restore',{code,token,backup:saved});await act({action:'setHardPaused',paused:false});await new Promise(r=>setTimeout(r,800));assert.equal((await state()).units.find(u=>u.id===npc.id).automationPresentation,undefined);result.checks.push('fresh attack waits without premature To-Hit generation');
 assert.deepEqual(result.errors,[]);result.passed=true;
}
main().catch(async e=>{result.failure=e.stack;console.error(e);if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
