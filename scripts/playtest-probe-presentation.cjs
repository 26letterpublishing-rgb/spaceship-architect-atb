// Own temporary static server and browser profile; never uses campaign storage.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const root=process.env.SA_PROBE_ROOT||path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-probe-presentation-')),baseline=process.argv.includes('--baseline');
const server=http.createServer((req,res)=>{const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));if(req.method!=='GET'||file.includes('/')||!/^[-\w]+\.(html|js|css|svg|png|webp|wav|mp3|woff2?)$/.test(file)){res.statusCode=404;return res.end();}const target=path.join(root,file);if(!fs.existsSync(target)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','css':'text/css','svg':'image/svg+xml','webp':'image/webp'})[file.split('.').pop()]||'application/octet-stream');fs.createReadStream(target).pipe(res);});
let browser;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const pw=require('playwright');browser=await pw.chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'chrome',headless:true,args:['--mute-audio']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/console-viewer.html?stage=1&family=utility&type=probe-launcher&inspection=interactive`);
 await page.locator('.probe-console').waitFor();await page.waitForTimeout(600);
 const rows=[],blackHoleRows=[];
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){await page.setViewportSize({width,height});await page.waitForTimeout(250);rows.push(await page.evaluate(()=>{const rect=s=>{const n=document.querySelector(s),r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight};};return {width:innerWidth,height:innerHeight,controls:rect('.sensor-controls'),reports:rect('.sensor-reports'),timeline:rect('.sensor-timeline'),ring:rect('.ring-stage'),previewError:document.body.dataset.previewError};}));await page.screenshot({path:path.join(out,`${width}-${height}.png`)});}
 if(!baseline){
  for(const row of rows){const total=row.reports.y+row.reports.height-row.controls.y;assert.ok(Math.abs(row.controls.height-(total-162)/2)<.1);assert.ok(Math.abs(row.reports.y-row.controls.y-row.controls.height-12)<.1);assert.ok(row.timeline.scrollHeight<=row.timeline.clientHeight+1);}
  await page.evaluate(()=>{
   const state=SACombatBridge.state(),owner=state.starships[0],unit=state.units[0];
   owner.ship.sicInventory.push({id:'test-probe',type:'probe-1',attachTo:'preview'});owner.ship.placements.push({sicId:'test-probe',cell:42});
   SAShipProbes.reconcile(state);SAShipSensors.refresh(state);
   SACombatBridge.utilityAction=async body=>{const result=SAShipProbes.command(state,unit,body);if(!result.ok)throw Error(result.error);return result;};
   window.probeTest={state,owner,unit,p:owner.ship.probeState.probes['test-probe'],refresh(){SAShipProbes.reconcile(state);SAShipSensors.refresh(state);},finish(){SAShipProbes.resolveInput(state,unit);this.refresh();},advance(seconds){SAShipProbes.advance(state,seconds);this.refresh();}};
  });
  await page.waitForFunction(()=>document.querySelector('[data-probe] option')?.value.startsWith('probe-'));
  const marker=page.locator('.probe-position-pointer');await assert.equal(await marker.isVisible(),false);
  await page.locator('[data-order="launch"]').click();await page.locator('[data-q]').fill('4');await page.locator('[data-r]').fill('0');await page.locator('[data-confirm-flight]').click();
  await page.waitForFunction(()=>!!probeTest.unit.delayedAction?.probeOrder);assert.equal(await marker.isVisible(),false,'input is not launch');
  await page.evaluate(()=>probeTest.finish());await page.waitForTimeout(300);await page.locator('[data-auto-zoom]').click();await page.evaluate(()=>probeTest.advance(3));await marker.waitFor({state:'visible'});
  async function pointerCheck(){return page.evaluate(()=>{const p=probeTest.p,svg=document.querySelector('[data-map] svg[data-space-canvas]'),point=svg.createSVGPoint();point.x=Math.sqrt(3)*(p.position.q+p.position.r/2);point.y=1.5*p.position.r;const pos=point.matrixTransform(svg.getScreenCTM()),r=document.querySelector('.probe-position-pointer').getBoundingClientRect();return {dx:r.x+r.width/2-pos.x,dy:r.bottom+8-pos.y,width:r.width,height:r.height,pointerEvents:getComputedStyle(document.querySelector('.probe-position-pointer')).pointerEvents};});}
  for(const action of ['normal','zoom','enlarge','return']){if(action==='zoom')await page.locator('[data-zoom="in"]').click();if(action==='enlarge'||action==='return')await page.locator('[data-map-focus]').click();await page.waitForTimeout(300);const m=await pointerCheck();assert.ok(Math.abs(m.dx)<1&&Math.abs(m.dy)<1,JSON.stringify({action,m}));assert.equal(m.width,40);assert.equal(m.height,32);assert.equal(m.pointerEvents,'none');await page.screenshot({path:path.join(out,`pointer-${action}.png`)});}
  const before=await pointerCheck();await page.evaluate(()=>{probeTest.state.hardPaused=true;probeTest.advance(2);});await page.waitForTimeout(250);assert.deepEqual(await pointerCheck(),before);await page.evaluate(()=>{probeTest.state.hardPaused=false;probeTest.advance(1);});await page.waitForTimeout(250);await pointerCheck();
  // All printed probe variants and payload controls, rendered from real probe module state.
  for(let tier=1;tier<=5;tier++){await page.evaluate(t=>{probeTest.owner.ship.sicInventory.find(i=>i.id==='test-probe').type='probe-'+t;probeTest.refresh();},tier);await page.waitForTimeout(250);assert.equal(await marker.isVisible(),true);}
  await page.evaluate(()=>{for(const type of ['hacking-bug','shield-breacher','warp-bubble-inhibitor']){probeTest.owner.ship.sicInventory.push({id:type,type,attachTo:'test-probe'});probeTest.owner.ship.placements.push({sicId:type,cell:42});}probeTest.refresh();});await page.waitForTimeout(250);await page.locator('[data-order="inhibit"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'payload-controls.png')});
  for(const phase of ['holding','returning','recovering','approaching','breaching','attached']){await page.evaluate(phase=>{probeTest.p.phase=phase;probeTest.refresh();},phase);await page.waitForTimeout(250);assert.equal(await marker.isVisible(),true,phase);}
  for(const phase of ['docked','destroyed','unavailable']){await page.evaluate(phase=>{probeTest.p.phase=phase;},phase);await page.waitForTimeout(250);assert.equal(await marker.isVisible(),false,phase);}
  await page.evaluate(()=>{probeTest.p.phase='holding';probeTest.refresh();delete probeTest.owner.sensorState.contacts[probeTest.p.id];});await page.waitForTimeout(250);assert.equal(await marker.isVisible(),false,'absent sensor contact');
  await page.evaluate(()=>{probeTest.refresh();probeTest.owner.sensorState.contacts[probeTest.p.id].level='last-known';});await page.waitForTimeout(250);assert.equal(await marker.isVisible(),false,'last-known sensor contact');
  await page.evaluate(()=>{probeTest.refresh();probeTest.p.ownerId='other-owner';});await page.waitForTimeout(250);assert.equal(await marker.isVisible(),false,'foreign owner');
  await page.evaluate(()=>{probeTest.p.ownerId=probeTest.owner.id;probeTest.refresh();});await page.waitForTimeout(250);
  const camera=await page.locator('[data-map] svg[data-space-canvas]').getAttribute('viewBox');
  await page.locator('[data-map] svg[data-space-canvas]').evaluate(svg=>svg.setAttribute('viewBox','10000 10000 20 20'));await page.waitForTimeout(250);assert.equal(await marker.isVisible(),false,'offscreen pointer is not pinned to an edge');
  await page.locator('[data-map] svg[data-space-canvas]').evaluate((svg,value)=>svg.setAttribute('viewBox',value),camera);await marker.waitFor({state:'visible'});
  await page.evaluate(()=>{probeTest.owner.ship.sicInventory.push({id:'second-probe',type:'probe-2',attachTo:'preview'});probeTest.owner.ship.placements.push({sicId:'second-probe',cell:42});probeTest.refresh();});await page.waitForTimeout(250);
  const ids=await page.evaluate(()=>({first:probeTest.p.id,second:probeTest.owner.ship.probeState.probes['second-probe'].id}));await page.locator('[data-probe]').selectOption(ids.second);assert.equal(await marker.isVisible(),false,'selected docked probe has no pointer');await page.locator('[data-probe]').selectOption(ids.first);await marker.waitFor({state:'visible'});
  await page.locator('[data-order="move"]').scrollIntoViewIfNeeded();await page.locator('[data-order="move"]').click();await page.locator('[data-cancel-flight]').click();assert.equal(await page.locator('[data-planner]').isVisible(),false);
  await page.evaluate(()=>document.querySelector('.probe-console').close());await page.waitForTimeout(300);assert.equal(await page.locator('.probe-position-pointer').count(),0);await page.evaluate(()=>SAProbeConsole.open(probeTest.unit,'preview'));await page.locator('.probe-console').waitFor();await marker.waitFor({state:'visible'});

  // Black Hole shares the legacy probe-console class: new Launcher styles must not apply.
  await page.goto(new URL('/console-viewer.html?stage=1&family=utility&type=black-hole-gun&inspection=interactive',page.url()).href);
  await page.locator('.black-hole-console .ring-stage').waitFor();
  assert.equal(await page.locator('.black-hole-console.probe-launcher-console').count(),0);
  const legacyCss=fs.readFileSync(path.join(root,'probe-console.css'),'utf8').split('/* Probe-only presentation:')[0];
  await page.addStyleTag({content:legacyCss});
  const measureBlackHole=()=>page.evaluate(()=>Object.fromEntries(['.sensor-controls',':is(.sensor-timeline,.shared-timeline)','.tactical-ring-group','.ring-stage'].map(selector=>{const node=document.querySelector('.black-hole-console '+selector),rect=node.getBoundingClientRect(),style=getComputedStyle(node);return [selector,{x:rect.x,y:rect.y,width:rect.width,height:rect.height,border:style.border,padding:style.padding,background:style.background,overflow:style.overflow}];})));
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(250);const before=await measureBlackHole();
   const loaded=await page.addStyleTag({url:'/probe-console.css'});await page.waitForTimeout(250);const after=await measureBlackHole();
   assert.deepEqual(after,before,'Probe CSS must preserve Black Hole controls and timeline');assert.ok(after['.sensor-controls'].height>300);
   await page.screenshot({path:path.join(out,'black-hole-'+width+'-'+height+'.png')});blackHoleRows.push({width,height,before,after});await loaded.evaluate(node=>node.remove());
  }
  assert.deepEqual(errors,[]);
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({root,baseline,rows,blackHoleRows,errors,checks:baseline?[]:['half-height orders','expanded reports','timeline without overflow','real launch/input distinction','zoom/enlarge/return alignment','pause/resume','five probe grades','payload controls reachable','active phases','docked/destroyed/unavailable hidden','absent/stale/foreign contact hidden','offscreen hidden','selection changes','plot cancellation','close/reopen','Black Hole controls/timeline unchanged with Probe CSS']},null,2));console.log(JSON.stringify({out,rows,errors}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
