'use strict';
// Owned production server; synchronous packet replay separates rendering from network latency.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),phase=process.argv[2]||'baseline',out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-surface-invalidation-'+phase+'-'));
(async()=>{let child,browser;const result={phase,rows:[],errors:[],viewport:{width:1920,height:1080},zoom:1,deviceScaleFactor:1};try{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-surface-data-'));
 const boot="const net=require('net'),listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object')a[0]={...a[0],host:'127.0.0.1'};else a[1]='127.0.0.1';return listen.apply(this,a)};require('./server.js')";
 child=spawn(process.execPath,['-e',boot],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 fs.writeFileSync(path.join(out,'owned-process.json'),JSON.stringify({pid:child.pid,data,parentPid:process.pid}));
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),15000);child.stdout.on('data',b=>{const m=String(b).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});result.base=base;
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});result.browser=browser.version();
 const page=await browser.newPage({viewport:result.viewport,deviceScaleFactor:1});page.on('pageerror',e=>result.errors.push(e.message));
 if(process.argv[3])for(const file of ['campaign-starmaps-ui.js','planet-surfaces-ui.js'])await page.route('**/'+file+'*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(process.argv[3],file),'utf8')}));
 await page.goto(base+'/gm.html');await page.waitForFunction(()=>window.SACampaignMapUI&&window.SAPlanetSurfaces);
 for(const role of ['gm','pc'])for(const size of ['moon','small','large']){
 await page.evaluate(({role,size})=>{
  window.fixture={code:'owned-surface-'+role+'-'+size,role,ownCharacterId:'pc',characters:[],npcRoster:[],starships:[],shops:{list:[]},combatActive:false,starmaps:{maps:[{id:'m',name:'Test sector',stars:[{id:'s',name:'Visible star',system:[{id:'p',kind:'planet',name:'Test '+size,size,variant:'temperate'}],surfaces:{p:{seed:'surface-baseline',hexes:{'1':{label:'Test city',city:true}},regions:{}}}},{id:'other',name:'Unrelated star',description:''}]}],navigation:{mode:'surface',mapId:'m',starId:'s',planetId:'p',allowed:{surface:true,system:true,galaxy:true,orbit:true}},localPositions:{},localJourneys:{},positions:{},journeys:{},characterWorldLocations:{}}};
  // Host only: production map/navigation/surface renderers and styles remain unchanged.
  if(!document.querySelector('[data-galaxy-host]')){const host=document.createElement('section');host.dataset.galaxyHost='';host.className='campaign-galaxy';document.body.append(host);}
  window.SACampaignMapUI.update(structuredClone(window.fixture),'');
  window.metrics={renders:0,terrain:0,renderMs:[]};
  if(!window.instrumented){const render=SAPlanetSurfaces.render,terrain=SAPlanetTerrain.terrain;SAPlanetSurfaces.render=function(...a){const t=performance.now();metrics.renders++;const v=render.apply(this,a);metrics.renderMs.push(performance.now()-t);return v;};SAPlanetTerrain.terrain=function(...a){metrics.terrain++;return terrain.apply(this,a);};window.instrumented=true;}
 },{role,size});
 await page.waitForTimeout(250);
 for(const kind of ['identical','unrelated','terrain','permission'])for(let run=0;run<5;run++){
 const row=await page.evaluate(async({kind,run})=>{const next=structuredClone(fixture);if(kind==='unrelated')next.starmaps.maps[0].stars[1].description='packet '+run;if(kind==='terrain')next.starmaps.maps[0].stars[0].surfaces.p.hexes['2']={terrain:run%2?'ice':'desert'};if(kind==='permission')next.starmaps.navigation.allowed.system=run%2===0;
 const svg=document.querySelector('.planet-chart-canvas>svg'),camera=svg.getAttribute('viewBox');metrics={renders:0,terrain:0,renderMs:[]};const t=performance.now();SACampaignMapUI.update(next,'');const syncMs=performance.now()-t;fixture=next;const replacement=svg!==document.querySelector('.planet-chart-canvas>svg');const m={...metrics};const frameStart=performance.now();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {kind,run,syncMs,...m,replacement,frameWaitMs:performance.now()-frameStart,cameraBefore:camera,cameraAfter:document.querySelector('.planet-chart-canvas>svg').getAttribute('viewBox')};},{kind,run});result.rows.push({role,size,...row});
 }
 await page.screenshot({path:path.join(out,role+'-'+size+'.png'),fullPage:true});
 }
 if(phase==='after'||phase==='visual-before'){
 if(phase==='after')for(const row of result.rows){if(['identical','unrelated'].includes(row.kind)){assert.equal(row.replacement,false);assert.equal(row.terrain,0);assert.equal(row.renders,0);assert.equal(row.cameraBefore,row.cameraAfter);}else if(row.kind==='terrain'||row.run>0){assert.equal(row.replacement,true);assert.equal(row.terrain,1);}}
 // Real authenticated GM/PC shells, server-sanitized state and actual paint/Undo.
 const post=async(route,body)=>{const r=await fetch(base+'/api/campaign/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;};
 const show=await post('showcase/start',{});result.workflows=[];
 const gm=await browser.newPage({viewport:result.viewport});gm.on('pageerror',e=>result.errors.push(e.message));await gm.goto(base+'/');await gm.evaluate(s=>sessionStorage.setItem('sa-gm-token-'+s.code,s.gmToken),show);await gm.goto(base+'/gm.html?campaign='+show.code);await gm.locator('[data-tab=campaign]').click();
 await gm.waitForFunction(()=>window.SACampaignNavigationUI?.context()?.data?.maps?.length);
 const ids=await gm.evaluate(()=>{const c=SACampaignNavigationUI.context(),m=c.data.maps[0],s=m.stars.find(s=>s.system?.some(p=>p.kind==='planet')),p=s.system.find(p=>p.kind==='planet');SACampaignNavigationUI.openPlanet(c,m,s,p);return {mapId:m.id,starId:s.id,planetId:p.id};});
 const command=(kind,extra={})=>post('v03/starmap',{code:show.code,token:show.gmToken,receipt:require('crypto').randomUUID(),...ids,kind,...extra});
 await command('planetStart',{hex:'100'});
 const pc=await browser.newPage({viewport:result.viewport});pc.on('pageerror',e=>result.errors.push(e.message));await pc.goto(base+'/');await pc.evaluate(s=>sessionStorage.setItem('sa-character-token-'+s.code+'-'+s.players[0].id,s.players[0].token),show);await pc.goto(base+'/character.html?campaign='+show.code+'&character='+show.players[0].id+'&showcase=1');await pc.locator('[data-character-tab=roster]').click();await pc.locator('.planet-chart-canvas>svg').waitFor();
 const world=async p=>p.evaluate(ids=>SACampaignNavigationUI.context().data.maps.find(m=>m.id===ids.mapId).stars.find(s=>s.id===ids.starId).surfaces[ids.planetId],ids);
 await command('planetHex',{hex:'100',label:'Live city',description:'Public text',gmNotes:'PRIVATE SURFACE TEST'});
 await pc.waitForFunction(()=>document.querySelector('.planet-labels')?.textContent.includes('Live city'));
 assert.ok(!JSON.stringify(await world(pc)).includes('PRIVATE SURFACE TEST'));
 const beforePaint=await world(gm);await gm.getByRole('button',{name:'Paint Terrain',exact:true}).click();await gm.locator('[data-terrain=desert]').click();await gm.getByRole('button',{name:'Fit Map',exact:true}).click();const svg=gm.locator('.planet-chart-canvas>svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox();
 await gm.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await gm.mouse.down();await gm.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:20});await gm.mouse.up();await gm.waitForFunction(()=>document.querySelector('[data-planet-undo]')?.disabled===false);
 const painted=await world(gm);assert.notDeepEqual(painted.hexes,beforePaint.hexes);await Promise.all([gm.waitForResponse(r=>r.url().includes('/starmap')&&r.request().method()==='POST'&&r.request().postDataJSON().kind==='planetPaint'),gm.getByRole('button',{name:'Undo Stroke',exact:true}).click()]);await gm.waitForFunction(({ids,before})=>{const c=SACampaignNavigationUI.context(),after=c.data.maps.find(m=>m.id===ids.mapId).stars.find(s=>s.id===ids.starId).surfaces[ids.planetId].hexes;return [...new Set([...Object.keys(before),...Object.keys(after)])].every(k=>(after[k]?.terrain||'')===(before[k]?.terrain||''));},{ids,before:beforePaint.hexes});const undone=await world(gm);for(const key of new Set([...Object.keys(beforePaint.hexes),...Object.keys(undone.hexes)]))assert.equal(undone.hexes[key]?.terrain||'',beforePaint.hexes[key]?.terrain||'');result.paintUndo=true;
 // Failed optimistic paint must still take the explicit full-render recovery path.
 await gm.locator('[data-terrain=ice]').click();const recoveredBefore=await svg.evaluate(s=>[...s.querySelectorAll('[data-hex]>path:first-child')].map(p=>p.getAttribute('fill')));
 await gm.route('**/api/campaign/v03/starmap',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Owned QA recovery rejection'})}),{times:1});
 const rb=await svg.boundingBox();await gm.mouse.click(rb.x+rb.width*.4,rb.y+rb.height*.5);await gm.waitForFunction(()=>document.querySelector('[data-galaxy-status]')?.textContent.includes('Owned QA recovery rejection'));
 assert.deepEqual(await svg.evaluate(s=>[...s.querySelectorAll('[data-hex]>path:first-child')].map(p=>p.getAttribute('fill'))),recoveredBefore);result.failedPaintRecovery=true;
 await gm.getByRole('button',{name:'Pan Map',exact:true}).click();
 for(const [role,p]of [['gm',gm],['pc',pc]])for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
 await p.setViewportSize({width,height});await p.waitForTimeout(200);for(const expanded of [false,true]){
 if(expanded)await p.getByRole('button',{name:'Enlarge Map',exact:true}).click();await p.getByRole('button',{name:'Fit Map',exact:true}).click();await p.getByRole('button',{name:'Zoom in surface map',exact:true}).click();await p.waitForTimeout(150);
 const s=p.locator('.planet-chart-canvas>svg');await s.scrollIntoViewIfNeeded();const b=await s.boundingBox();const old=await s.getAttribute('viewBox');await p.mouse.move(b.x+b.width*.4,b.y+b.height*.4);await p.mouse.down();await p.mouse.move(b.x+b.width*.4+30,b.y+b.height*.4+20,{steps:5});await p.mouse.up();await p.waitForTimeout(100);const pan=await s.getAttribute('viewBox');assert.notEqual(pan,old);
 const retained=await p.evaluate(auth=>{const c=SACampaignNavigationUI.context(),s=document.querySelector('.planet-chart-canvas>svg'),box=s.getAttribute('viewBox'),next=structuredClone(c.state);const active=next.starmaps.navigation.starId,other=next.starmaps.maps[0].stars.find(st=>st.id!==active);if(!other)return {tested:false};other.description='unrelated-live-replay';SACampaignMapUI.update(next,auth);return {tested:true,same:s===document.querySelector('.planet-chart-canvas>svg'),camera:box===s.getAttribute('viewBox')};},role==='gm'?show.gmToken:show.players[0].token);if(retained.tested&&phase==='after'){assert.ok(retained.same);assert.ok(retained.camera);}
 await p.screenshot({path:path.join(out,`live-${role}-${width}-${expanded?'expanded':'normal'}.png`),fullPage:true});result.workflows.push({role,width,height,expanded,retained,pan});if(expanded)await p.getByRole('button',{name:'Return to Campaign',exact:true}).click();
 }}
 // Region transition and a journey packet exercise route/context invalidation.
 await command('planetRegion',{hex:'100',name:'Live region'});await command('planetStart',{hex:'25',regionId:'100'});await pc.waitForFunction(()=>document.querySelector('.campaign-location-nav')?.textContent.includes('Live region'));assert.equal(await pc.locator('[data-hex]').count(),150);
 await command('planetStart',{hex:'100'});await pc.waitForFunction(()=>document.querySelectorAll('[data-hex]').length===4800);
 const pcToken=show.players[0].token;await post('v03/starmap',{code:show.code,token:pcToken,receipt:require('crypto').randomUUID(),...ids,kind:'planetTravelRequest',hex:'101'});
 const state=await fetch(base+'/api/campaign/state?code='+show.code+'&token='+show.gmToken).then(r=>r.json());const request=state.starmaps.travelRequests.find(r=>r.status==='pending');assert.ok(request);await command('planetTravelDecision',{requestId:request.id,approve:true});await pc.waitForFunction(()=>SACampaignNavigationUI.context().data.partyJourney?.kind==='walk');result.regionAndTravel=true;
 }
 assert.deepEqual(result.errors,[]);result.completed=true;
 }finally{await browser?.close();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(out);}
})().catch(e=>{console.error(e);process.exitCode=1;});
