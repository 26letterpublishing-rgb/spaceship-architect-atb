// Isolated campaign; real PC scan/roll UI plus server pause, retry and persistence checks.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const maps=require('../ship-map-core'),delays=require('../delay-rules');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','roll-timing');fs.mkdirSync(out,{recursive:true});
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-roll-timing-'));let child,browser,base;
async function start(){child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});child.stderr.on('data',c=>process.stderr.write(c));base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.on('error',reject);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
async function main(){
 await start();const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;};
 const room=await post('campaign/showcase/start',{});await require('../tests/helpers/combat-demo.cjs')(base,room);
 const act=body=>post('action',{roomCode:room.code,gmToken:room.gmToken,...body}),state=()=>fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());
 const initial=await state(),source=initial.starships.find(s=>s.controlType==='pc'),target=initial.starships.find(s=>s.id!==source.id),player=room.players.find(p=>p.name==='Nova Vale');
 target.sensorScenarioMasking=18;source.sensorState={};target.sensorState={};
 const seat=ship=>{const [square,c]=[...maps.buildLayout(ship.ship).footprint].find(([,c])=>maps.definition(c.type).bridge&&c.stations.some(s=>s.x===c.column&&s.y===c.row));return {starshipId:ship.id,square,sicId:c.sicId,mesh:c.stations.find(s=>s.x===c.column&&s.y===c.row).mesh,stationed:true};};
 await act({action:'prepareEncounter',mode:'starship',preparationId:'roll-timing',starships:initial.starships,shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:15,r:0}],units:initial.units.map(u=>({...u,preparationUnitId:u.id,speed:.1,sensorSkill:0,location:seat(u.team==='pc'?source:target)}))});
 const saved=await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r=>r.json());saved.campaign.encounter.starships.find(s=>s.id===target.id).sensorScenarioMasking=18;
 for(const s of saved.campaign.encounter.starships)s.sensorState={};for(const u of saved.campaign.encounter.units)u.sensorSkill=0;
 await post('campaign/restore',{code:room.code,token:room.gmToken,backup:saved});
 await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});const unit=(await state()).units.find(u=>u.characterId===player.id);
 browser=await chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'chrome',headless:true});const context=await browser.newContext({viewport:{width:1366,height:768}}),pc=await context.newPage(),errors=[];pc.on('pageerror',e=>errors.push(e.message));pc.on('dialog',d=>d.accept());
 await pc.addInitScript(({code,player})=>sessionStorage.setItem(`sa-character-token-${code}-${player.id}`,player.token),{code:room.code,player});
 await pc.goto(`${base}/character.html?campaign=${room.code}&character=${player.id}&showcase=1`);await pc.getByRole('button',{name:'Combat',exact:true}).click();
 const frame=pc.frameLocator('#playerAtbFrame');await frame.locator('[data-console-operator]').first().selectOption(unit.id);await pc.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();
 const sensor=source.ship.sicInventory.find(i=>maps.definition(i.type).sensor);await pc.getByRole('combobox',{name:'Station console',exact:true}).selectOption(sensor.id);
 const view=pc.getByRole('dialog',{name:'Sensor console',exact:true}),icon=view.locator('.console-typing-indicator');await view.waitFor();
 const wait=async(fn,label,timeout=20000)=>{const end=Date.now()+timeout;do{const s=await state();if(fn(s))return s;await pc.waitForTimeout(50);}while(Date.now()<end);throw Error(label+JSON.stringify(await state()));};
 async function submit(score){await act({action:'setHardPaused',paused:true});const s=await state();await act({action:'nudge',id:unit.id,amount:100-s.units.find(u=>u.id===unit.id).atb});await view.getByRole('button',{name:'Scan Area',exact:true}).click();
  const pending=(await state()).units.find(u=>u.id===unit.id).delayedAction;assert.ok(pending?.awaitingRoll,JSON.stringify({pending,ships:(await state()).starships.map(s=>({id:s.id,mask:s.sensorScenarioMasking})),error:await view.locator('[data-error]').innerText()}));const roll=pc.getByRole('dialog',{name:'Ship action dice roll',exact:true});await roll.waitFor();const originalSeconds=pending.remaining/pending.rate;
  const dice=roll.frameLocator('iframe');await dice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill(String(score));await dice.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await dice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});
  const after=(await state()).units.find(u=>u.id===unit.id).delayedAction;assert.deepEqual(after.rollTiming,delays.afterRoll(originalSeconds,score,pending.rollSpec.difficulty));assert.ok(Math.abs(after.remaining/after.rate-after.rollTiming.seconds)<1e-8);
  await act({action:'rollShipAction',id:unit.id,rollId:pending.id,score});assert.deepEqual((await state()).units.find(u=>u.id===unit.id).delayedAction,after,'Retry cannot shorten or restart input');return after;
 }
 const failed=await submit(5);assert.equal(failed.rollTiming.outcome,'Critical Failure');await icon.waitFor({state:'visible'});assert.equal(await icon.getAttribute('data-running'),'false');
 const before=failed.remaining;await pc.waitForTimeout(400);assert.equal((await state()).units.find(u=>u.id===unit.id).delayedAction.remaining,before,'GM pause freezes adjusted input');
 await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await pc.waitForFunction(()=>document.querySelector('.console-typing-indicator[data-running=true]'));
 const sound=view.locator('[data-sound]');if(await sound.getAttribute('aria-pressed')!=='true')await sound.click();await pc.waitForTimeout(250);assert.ok(await icon.isVisible(),'Muted typing retains its visual feedback');
 assert.equal(await icon.evaluate(e=>getComputedStyle(e).pointerEvents),'none');const box=await icon.boundingBox();assert.ok(box.width<55&&box.x<20&&box.y>650,'Small bottom-left indicator');
 await pc.emulateMedia({reducedMotion:'reduce'});assert.equal(await icon.locator('.typing-hand').first().evaluate(e=>getComputedStyle(e).animationName),'none');await pc.emulateMedia({reducedMotion:'no-preference'});await pc.screenshot({path:path.join(out,'typing-input.png')});
 let s=await wait(s=>s.starships.find(v=>v.id===source.id).sensorState.pulse?.remaining>0,'Failure pulse missing');await act({action:'setHardPaused',paused:true});assert.notEqual(s.starships.find(v=>v.id===source.id).sensorState.contacts[target.id]?.level,'detected','Low roll does not guarantee detection');await icon.waitFor({state:'hidden'});
 await act({action:'setHardPaused',paused:false});await wait(s=>!s.starships.find(v=>v.id===source.id).sensorState.pulse,'Pulse did not expire');
 const success=await submit(16);assert.equal(success.rollTiming.margin,1);await act({action:'setHardPaused',paused:false});s=await wait(s=>s.starships.find(v=>v.id===source.id).sensorState.pulse?.remaining>0,'Success pulse missing');await act({action:'setHardPaused',paused:true});
 s=await state();let pulse=s.starships.find(v=>v.id===source.id).sensorState.pulse;assert.equal(s.starships.find(v=>v.id===source.id).sensorState.contacts[target.id].level,'detected','Manual scan detects target outside normal 12-unit range');assert.ok(pulse.remaining>0&&pulse.remaining<=2);await pc.waitForTimeout(350);assert.deepEqual((await state()).starships.find(v=>v.id===source.id).sensorState.pulse,pulse,'ATB pause freezes pulse');
 assert.match(await view.innerText(),/Scan pulse 18 Units/);await pc.screenshot({path:path.join(out,'scan-pulse.png')});
 // Explore is deliberately transient. Move the paused encounter to a regular
 // isolated campaign before testing disk persistence across a server restart.
 const backup=await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r=>r.json()),persistent=await post('campaign/create',{name:'Pulse persistence',gmCode:'pulse-test-gm'});
 backup.campaign.code=persistent.campaign.code;backup.campaign.encounter.roomCode=persistent.campaign.code;backup.campaign.encounter.showcase=false;
 await post('campaign/restore',{code:persistent.campaign.code,token:persistent.token,backup});Object.assign(room,{code:persistent.campaign.code,gmToken:persistent.token});
 await browser.close();browser=null;await stop();await start();room.gmToken=(await post('campaign/open',{name:backup.campaign.name,gmCode:'pulse-test-gm'})).token;s=await state();assert.ok(s.starships?.some(v=>v.id===source.id),JSON.stringify(s));assert.deepEqual(s.starships.find(v=>v.id===source.id).sensorState.pulse,pulse,'Paused pulse survives server restart');
 await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});const end=Date.now()+5000;do{await new Promise(r=>setTimeout(r,100));s=await state();}while(s.starships.find(v=>v.id===source.id).sensorState.pulse&&Date.now()<end);assert.equal(s.starships.find(v=>v.id===source.id).sensorState.pulse,undefined);assert.equal(s.starships.find(v=>v.id===source.id).sensorState.contacts[target.id].level,'detected','Normal retention preserves the discovered contact');
 assert.deepEqual(errors,[]);console.log('PASS: manual margin and critical-failure timing, idempotent retry, typing animation/mute/pause/reduced motion, early detection, two-second pulse and paused restart persistence.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await stop();});
