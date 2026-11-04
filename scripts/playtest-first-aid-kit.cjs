const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {startFixture}=require('../tests/melee-adjacency-http.test');
const out=path.resolve('../SA-ATB Local Development Files/outputs/first-aid-visibility-nov02');
(async()=>{let f,b;const results=[],errors=[];try{
 f=await startFixture();b=await chromium.launch({channel:'chrome',headless:true});
 for(const showcase of [false,true]){
 const demo=showcase?await f.post('/api/campaign/showcase/start',{}):null;const code=demo?.code||f.code,token=demo?.gmToken||f.token;
 const id='aid-pc-'+showcase,pcCode='owned';const req=await f.post('/api/campaign/join/request',{code,character:{id,phase:'finalized',access:{pcCode},identity:{characterName:'Aid PC'},attributes:{health:[1,1]},health:{current:30}}},201);
 await f.post('/api/campaign/join/respond',{code,token,requestId:req.requestId,decision:'approve'});const joined=await f.post('/api/campaign/join/status',{code,characterId:id,pcCode});
 const e=f.encounter();e.showcase=showcase;e.units[0].team='pc';e.units[0].characterId=id;e.activeSource='pc';e.commandDeadline=null;e.commandWindow=0;e.units[0].items=[];const backup=await fetch(f.base+'/api/campaign/backup?code='+code+'&token='+token).then(r=>r.json());backup.campaign.encounter=e;await f.post('/api/campaign/restore',{code,token,backup});
 const p=await b.newPage({viewport:{width:1366,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.goto(f.base+'/');await p.evaluate(({code,id,token})=>localStorage.setItem('sa-character-token-'+code+'-'+id,token),{code,id,token:joined.token});await p.goto(f.base+'/index.html?embedded=player&campaign='+code+'&character='+id);
 const open=async()=>{await p.locator('[data-combat-action="firstAid"]:visible').first().click();await p.locator('#combatActionDialog').waitFor({state:'visible'});};await open();assert.equal(await p.locator('#combatUseKitWrap').isVisible(),false);
 // Exercise the real shared renderer with an incoming inventory snapshot while its dialog is open.
 const update=async(items,actor='attacker')=>p.evaluate(({items,actor})=>{const state=SACombatBridge.state(),mine=structuredClone(state.units.find(u=>u.id==='attacker'));mine.id=actor;mine.items=items;SACombatActions.render({mine,state,isMyTurn:true,hasPendingDelayRequest:false});},{items,actor});
 const kit={id:'kit',catalogId:'first-aid-kit',quantity:1};await update([kit]);assert.equal(await p.locator('#combatUseKitWrap').isVisible(),true);await p.locator('#combatUseKit').check();await update([]);assert.equal(await p.locator('#combatUseKitWrap').isVisible(),false);assert.equal(await p.locator('#combatUseKit').isChecked(),false);
 await update([kit]);await p.locator('#combatUseKit').check();await update([kit],'other');assert.equal(await p.locator('#combatUseKit').isChecked(),false);
 await p.reload();await open();assert.equal(await p.locator('#combatUseKitWrap').isVisible(),false);await p.screenshot({path:path.join(out,(showcase?'explore':'ordinary')+'-no-kit.png')});results.push({showcase,zeroAndLiveTransferAndActorAndReload:true});await p.close();
 }
 assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));await b?.close();await f?.stop();}
})().catch(e=>{console.error(e);process.exitCode=1});
