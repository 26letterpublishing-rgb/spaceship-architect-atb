const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('../SA-ATB Local Development Files/outputs/zero-hp-nov02');fs.mkdirSync(out,{recursive:true});
(async()=>{let h;const results=[];try{
 h=await require('./console-debug.cjs').startHarness({headless:true});const p=h.pc;p.setDefaultTimeout(12000);
 const exit=p.getByRole('button',{name:'Exit Console',exact:true});if(await exit.isVisible())await exit.click();
 const actor=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId),notice=p.locator('.combat-zero-hp-banner');
 const recover=async()=>{const r=await fetch(h.base+'/api/campaign/character/restore-resources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,requestId:require('node:crypto').randomUUID(),targetIds:[h.fixture.characterId],hp:30})});assert.equal(r.status,200);await p.waitForFunction(()=>sessionStorage.getItem('sa-zero-hp:'+new URLSearchParams(location.search).get('campaign')+':debug-pc')===null);};
 for(const width of [1366,1920]){
 await p.setViewportSize({width,height:900});
 await h.fixture.act({action:'applyDamage',id:actor.id,amount:999});await notice.waitFor();assert.equal((await h.state()).units.find(u=>u.id===actor.id).currentHp,0);
 assert.equal(await notice.locator('strong').textContent(),'YOU ARE DEAD');assert.equal(await notice.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0),true);
 assert.equal(await h.gm.locator('.combat-zero-hp-banner').count(),0);
 const box=await notice.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
 const style=await notice.evaluate(e=>({pointer:getComputedStyle(e).pointerEvents,color:getComputedStyle(e).backgroundColor}));assert.equal(style.pointer,'none');assert.equal(style.color,'rgb(83, 21, 29)');
 await p.screenshot({path:path.join(out,'zero-'+width+'.png')});
 await p.reload();await p.waitForTimeout(1000);assert.equal(await notice.count(),0);results.push({width,authoritativeZero:true,ownPcOnly:true,reloadDedup:true});
 await p.locator('[data-character-tab=atb]').click();await recover();
 }
 // Recovery above uses the real GM resource restoration endpoint.
 await p.emulateMedia({reducedMotion:'reduce'});await h.fixture.act({action:'applyDamage',id:actor.id,amount:999});await notice.waitFor();assert.equal(await notice.count(),1);
 await notice.waitFor({state:'detached',timeout:8000});assert.equal(await notice.count(),0);results.push('Recovery rearms next zero; reduced-motion notice expires without blocking controls');
 // Exercise the actual Explore host's selected and hidden PC frames.
 const explore=h.gm;await explore.goto(h.base+'/showcase.html');await explore.locator('[data-perspective="gm"]').waitFor();
 const demo=await explore.evaluate(()=>JSON.parse(sessionStorage.getItem('sa-explore-room'))),nova=demo.players.find(x=>x.name==='Nova Vale'),orion=demo.players.find(x=>x.name==='Orion Reed');
 await explore.locator('[data-perspective="'+orion.id+'"]').click();
 await explore.frameLocator('[data-explore-perspective="'+orion.id+'"]').locator('[data-character-tab=atb]').click();
 await explore.locator('[data-perspective="'+nova.id+'"]').click();
 const novaFrame=explore.frameLocator('[data-explore-perspective="'+nova.id+'"]');await novaFrame.locator('[data-character-tab=atb]').click();
 const demoState=await fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.gmToken).then(r=>r.json()),novaUnit=demoState.units.find(u=>u.characterId===nova.id);
 const damage=await fetch(h.base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomCode:demo.code,gmToken:demo.gmToken,action:'applyDamage',id:novaUnit.id,amount:999})});assert.equal(damage.status,200);
 await novaFrame.locator('.combat-zero-hp-banner').waitFor();
 assert.equal(await explore.frameLocator('[data-explore-perspective="'+orion.id+'"]').locator('.combat-zero-hp-banner').count(),0);
 await explore.locator('[data-perspective="'+orion.id+'"]').click();await novaFrame.locator('.combat-zero-hp-banner').waitFor({state:'detached'});
 await explore.locator('[data-perspective="'+nova.id+'"]').click();assert.equal(await novaFrame.locator('.combat-zero-hp-banner').count(),0);
 results.push('Actual Explore Nova zero: Orion unaffected; role switch clears; return does not replay');
 assert.deepEqual(h.errors,[]);
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors:h?.errors},null,2));await h?.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
