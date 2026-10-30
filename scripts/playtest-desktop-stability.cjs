// Desktop-only browser regression. Uses disposable storage and an ephemeral port; never opens existing browser tabs.
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const verify=!process.argv.includes('--baseline');
const out=path.join(os.tmpdir(),'sa-desktop-stability-'+(verify?'after':'baseline-'+Date.now()));fs.mkdirSync(out,{recursive:true});let server,browser;
const assert=require('node:assert/strict');const result={cases:[],errors:[]};
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function main(){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-surface-data-'));
 server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe'],windowsHide:true});
 const base=await new Promise((res,rej)=>{server.stdout.on('data',d=>{const m=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m)res(m[1]);});server.stderr.on('data',d=>result.errors.push(String(d)));setTimeout(()=>rej(Error('startup')),15000).unref();});
 result.base=base;result.data=data;
 const r=await fetch(base+'/api/campaign/showcase/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const show=await r.json();if(!r.ok)throw Error(JSON.stringify(show));
 browser=await chromium.launch({channel:'chrome',headless:true});result.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>result.errors.push(e.message));
 await page.addInitScript(()=>{window.qaEvents=[];const ES=window.EventSource;window.EventSource=class extends ES{constructor(...a){super(...a);qaEvents.push(this);}};});
 await page.goto(base+'/');await page.evaluate(s=>sessionStorage.setItem('sa-gm-token-'+s.code,s.gmToken),show);await page.goto(base+'/gm.html?campaign='+show.code);await page.waitForTimeout(800);
 await page.locator('[data-tab="campaign"]').click();await page.waitForTimeout(300);
 await page.evaluate(()=>{const c=SACampaignNavigationUI.context(),m=c.data.maps[0],s=m.stars.find(s=>s.system?.some(p=>p.kind==='planet'));SACampaignNavigationUI.open(c,m,s,null);window.qaRenders=[];const f=SAPlanetSurfaces.render;SAPlanetSurfaces.render=function(...a){const t=performance.now(),v=f(...a);qaRenders.push(performance.now()-t);return v;};});
 await page.getByRole('button',{name:'Browse Planets',exact:true}).click();await page.getByRole('button',{name:/^View Surface/}).first().click();await page.waitForTimeout(500);
 await page.evaluate(()=>{window.qaRoot=document.querySelector('.planet-chart-canvas>svg');window.qaNetwork=[];performance.getEntriesByType('resource').forEach(r=>qaNetwork.push({name:r.name.split('/').pop().split('?')[0],duration:r.duration,bytes:r.transferSize}));});
 await page.waitForTimeout(2500);result.liveIdle=await page.evaluate(()=>({renders:qaRenders,stable:qaRoot===document.querySelector('.planet-chart-canvas>svg'),network:qaNetwork,events:qaEvents.length}));
 await page.evaluate(()=>{qaEvents.forEach(e=>e.close());window.qaBase=SACampaignNavigationUI.context();window.qaMap=qaBase.data.maps[0];window.qaStar=qaMap.stars.find(s=>s.system?.some(p=>p.kind==='planet'));window.qaPlanet=qaStar.system.find(p=>p.kind==='planet');window.qaHexes=structuredClone(qaStar.surfaces?.[qaPlanet.id]?.hexes||{});});
 result.updates=await page.evaluate(token=>{
  const base=structuredClone(qaBase.state), trials=[];
  for(const kind of ['same','unrelated-star-description','visible-terrain','same']){
   const next=structuredClone(base),m=next.starmaps.maps[0],s=m.stars.find(s=>s.id===qaStar.id),p=s.system.find(p=>p.id===qaPlanet.id);
   if(kind==='unrelated-star-description'){const other=m.stars.find(x=>x.id!==s.id);if(other)other.description='Disposable measurement';else m.description='Disposable measurement';}
   if(kind==='visible-terrain'){s.surfaces[p.id].hexes['100']={...(s.surfaces[p.id].hexes['100']||{}),terrain:'desert'};}
   SACampaignMapUI.update(base,token);const old=document.querySelector('.planet-chart-canvas>svg'),count=qaRenders.length,t=performance.now();SACampaignMapUI.update(next,token);
   trials.push({kind,ms:performance.now()-t,renderMs:qaRenders.slice(count),replaced:old!==document.querySelector('.planet-chart-canvas>svg')});
  }
  return trials;
 },show.gmToken);
 // Restore server-derived state and live updates for the genuine paint/Undo workflow.
 await page.reload();await page.waitForTimeout(800);await page.locator('[data-tab="campaign"]').click();
 await page.evaluate(()=>{const c=SACampaignNavigationUI.context(),m=c.data.maps[0],s=m.stars.find(s=>s.system?.some(p=>p.kind==='planet')),p=s.system.find(p=>p.kind==='planet');SACampaignNavigationUI.openPlanet(c,m,s,p);window.qaPaintRenders=[];const f=SAPlanetSurfaces.render;SAPlanetSurfaces.render=function(...a){const t=performance.now(),v=f(...a);qaPaintRenders.push(performance.now()-t);return v;};window.qaBefore=structuredClone(s.surfaces[p.id].hexes);window.qaPaintIds={star:s.id,planet:p.id};});
 await page.getByRole('button',{name:'Paint Terrain',exact:true}).click();await page.locator('[data-terrain="desert"]').click();await page.getByRole('button',{name:'Fit Map',exact:true}).click();
 const svg=page.locator('.planet-chart-canvas>svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox();
 await page.evaluate(()=>{window.qaMoves=[];const s=document.querySelector('.planet-chart-canvas>svg'),f=s.onpointermove;s.onpointermove=function(e){const t=performance.now();f.call(this,e);qaMoves.push(performance.now()-t);};window.qaFrames=[];window.qaStop=false;let prev=performance.now();function tick(t){qaFrames.push(t-prev);prev=t;if(!qaStop)requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 const responses=[];page.on('response',async r=>{if(r.request().method()==='POST'&&r.url().includes('starmap')){const body=r.request().postDataJSON();responses.push({status:r.status(),kind:body.kind,edits:body.edits?.length});}});
 const start=Date.now();await page.mouse.move(box.x+box.width*.2,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.5,{steps:60});await page.mouse.up();await page.getByRole('button',{name:'Undo Stroke',exact:true}).waitFor();await page.waitForTimeout(600);
 result.paint=await page.evaluate(()=>{qaStop=true;const c=SACampaignNavigationUI.context(),s=c.data.maps[0].stars.find(s=>s.id===qaPaintIds.star),after=s.surfaces[qaPaintIds.planet].hexes,changed=Object.keys(after).filter(k=>(after[k].terrain||'')!==(qaBefore[k]?.terrain||'')),f=qaFrames.slice(2).sort((a,b)=>a-b);return {moves:qaMoves.length,moveTotalMs:qaMoves.reduce((a,b)=>a+b,0),moveMaxMs:Math.max(...qaMoves),frames:f.length,frameP95:f[Math.floor(f.length*.95)],changedHexes:changed.length,renderMs:qaPaintRenders,undoEnabled:!document.querySelector('.planet-edit-tools button:last-of-type').disabled};});result.paint.elapsedIncludingWaitMs=Date.now()-start;
 await page.screenshot({path:path.join(out,'painted.png')});await page.getByRole('button',{name:'Undo Stroke',exact:true}).click();await page.waitForTimeout(600);
 result.undo=await page.evaluate(()=>{const c=SACampaignNavigationUI.context(),s=c.data.maps[0].stars.find(s=>s.id===qaPaintIds.star),after=s.surfaces[qaPaintIds.planet].hexes,keys=new Set([...Object.keys(after),...Object.keys(qaBefore)]);return {remainingTerrainDifferences:[...keys].filter(k=>(after[k]?.terrain||'')!==(qaBefore[k]?.terrain||'')).length,renderMs:qaPaintRenders,undoDisabled:[...document.querySelectorAll('button')].find(b=>b.textContent==='Undo Stroke')?.disabled};});result.responses=responses;
 await page.screenshot({path:path.join(out,'undone.png')});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)); result.preparation=[];
 for(const v of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}]){
  await page.setViewportSize(v);await page.locator('[data-tab="atb"]').click();await page.waitForTimeout(150);
  const arena=page.locator('.arena-editor').first();const target=await arena.count()?arena:page.locator('.encounter-mode-selector');await target.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'preparation-'+v.width+'.png')});
  result.preparation.push(await page.evaluate(()=>{const f=document.querySelector('.encounter-preparation-actions').getBoundingClientRect(),map=document.querySelector('.arena-editor')||document.querySelector('[data-arena-editor]');const r=map?.getBoundingClientRect();return{width:innerWidth,height:innerHeight,footer:f.toJSON(),map:r?.toJSON(),overlap:!!r&&Math.min(r.right,f.right)>Math.max(r.left,f.left)&&Math.min(r.bottom,f.bottom)>Math.max(r.top,f.top)};}));
  await page.locator('#saveCombatPreparation').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#saveCombatPreparation').evaluate(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;}),'Save preparation remains reachable');
 }
 await page.locator('#saveCombatPreparation').click();await page.waitForTimeout(500);
 result.savedPreparation=await page.locator('[data-tab-panel=campaign]').isVisible();assert.equal(result.savedPreparation,true);
 await page.goto(base+'/index.html?catalogPreview=probe-launcher');await page.locator('dialog[data-catalog-snapshot][open]').waitFor();await page.waitForTimeout(300);
 assert.equal(await page.locator('dialog[data-catalog-snapshot][open]').evaluate(d=>d.classList.contains('sci-fi-dialog-surface')),false);
 await page.screenshot({path:path.join(out,'probe.png')});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
 if(verify){assert.equal(result.paint.changedHexes>0,true);assert.equal(result.undo.remainingTerrainDifferences,0);assert.equal(result.paint.renderMs.length,1,'Paint saves must not reconstruct the surface twice');assert.equal(result.undo.renderMs.length,2,'Undo adds only one surface reconstruction');assert.ok(result.preparation.every(r=>r.map&&!r.overlap),'Preparation actions must not cover the arena');assert.deepEqual(result.errors,[]);}console.log(JSON.stringify({updates:result.updates,paint:result.paint,undo:result.undo,responses,errors:result.errors}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();});
