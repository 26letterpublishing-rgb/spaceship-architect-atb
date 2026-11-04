// Isolated production-renderer presentation fixture; no game server or campaign writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const root=process.env.SA_ZOOM_ROOT||path.resolve(__dirname,'..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-cleanser-zoom-'));
const baseline=process.argv.includes('--baseline');
const allowed=new Set(['cleanser-ui.js','cleanser.css','cleanser-station.css','sic-art-planetary-cleanser.webp','planet-ocean.webp','cleanser-charge.wav']);
const server=http.createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname.slice(1);if(!file){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');}if(!allowed.has(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'audio/wav');fs.createReadStream(path.join(root,file)).pipe(res);});
let browser;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const pw=require('playwright');browser=await pw.chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage(),errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(()=>{
  const unit={id:'zoom-operator',characterName:'Zoom fixture',atb:100};
  const ship={id:'zoom-ship',ship:{minerals:{'Dark Phazon':1},cleanserState:{phase:'charging',remaining:120,targetId:'planet',targetKind:'planet',targetName:'Fixture planet'}},auState:{maximum:10,available:10}};
  window.fixture={units:[unit],starships:[ship],spaceObjects:[{id:'planet',kind:'planet',name:'Fixture planet',q:1,r:0}],shipPositions:[{id:ship.id,q:0,r:0}],activeId:unit.id,running:true};
  window.SACombatBridge={state:()=>fixture,soundEnabled:()=>false,confirmGmPlayerAction:()=>true,utilityAction:async command=>{if(command.kind==='cleanser-abort')ship.ship.cleanserState={phase:'idle'};}};
  window.SAStationAccess={access:()=>({ship,item:{},definition:{planetaryCleanser:true}})};
  window.SAShipMap={sensorStats:()=>({range:18})};window.SAShipDistances={hexDistance:()=>1};
  window.SAShipNavigationUI={mountSelector(){},remember(){}};
  window.SACleanserTimeline={forEvent:()=>null};window.SAAudioMix={trackMedia(){},releaseMedia(){}};
 });
 await page.addScriptTag({url:'/cleanser-ui.js'});await page.evaluate(()=>SACleanserConsole.open(fixture.units[0],'cleanser'));
 await page.waitForFunction(()=>document.querySelector('.cleanser-reactor-hardware')?.naturalWidth>0);
 const sample=()=>page.evaluate(()=>{const get=s=>document.querySelector(s),rect=s=>{const b=get(s).getBoundingClientRect();return {width:b.width,height:b.height,x:b.x,y:b.y};};return {hardware:rect('.cleanser-reactor-hardware'),clock:rect('[data-countdown-number]'),clockFont:getComputedStyle(get('[data-countdown-number]')).fontSize,ring:get('[data-ring-outer]').getAttribute('transform'),wave:get('[data-waveform]').getAttribute('d'),die:get('[data-reactor-die]').getAttribute('transform'),power:get('.cleanser-station').style.getPropertyValue('--reactor-power'),transform:getComputedStyle(get('.cleanser-reactor-hardware')).transform};});
 async function state(remaining){await page.evaluate(n=>{fixture.starships[0].ship.cleanserState={phase:'charging',remaining:n,targetId:'planet',targetKind:'planet',targetName:'Fixture planet'};},remaining);await page.waitForFunction(n=>document.querySelector('.cleanser-station').style.getPropertyValue('--reactor-power')===String((120-n)/120),remaining);return sample();}
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
  await page.setViewportSize({width,height});const samples=[];
  for(const remaining of [120,60,0]){const value=await state(remaining);samples.push(value);await page.screenshot({path:path.join(out,`${width}-${height}-${remaining}.png`)});}
  const [start,mid,zero]=samples;
  for(const [value,scale] of [[mid,baseline?1:1.25],[zero,baseline?1:1.5]]){assert.ok(Math.abs(value.hardware.width/start.hardware.width-scale)<.00001);assert.ok(Math.abs(value.hardware.height/start.hardware.height-scale)<.00001);assert.deepEqual(value.clock,start.clock);assert.equal(value.clockFont,start.clockFont);}
  assert.notEqual(mid.ring,start.ring);assert.notEqual(mid.wave,start.wave);assert.notEqual(mid.die,start.die);
  await state(60);await page.evaluate(()=>fixture.hardPaused=true);const paused=await sample();await page.waitForTimeout(240);assert.deepEqual(await sample(),paused);
  await page.evaluate(()=>fixture.hardPaused=false);const resumed=await state(59);assert.notEqual(resumed.ring,paused.ring);
  await page.locator('[data-abort]').click();await page.waitForFunction(()=>document.querySelector('.cleanser-station').dataset.charging==='false');const aborted=await sample();assert.equal(aborted.hardware.width,start.hardware.width);
  rows.push({width,height,start,mid,zero,pause:true,resume:true,abort:true});
 }
 await page.emulateMedia({reducedMotion:'reduce'});const reducedStart=await state(120),reducedEnd=await state(0);assert.equal(reducedStart.hardware.width,reducedEnd.hardware.width);assert.equal(reducedStart.ring,reducedEnd.ring);assert.equal(reducedStart.clockFont,reducedEnd.clockFont);await page.screenshot({path:path.join(out,'reduced-motion-zero.png')});
 await page.locator('[data-close]').click();await page.waitForTimeout(180);assert.equal(await page.locator('.cleanser-station').count(),0);await page.evaluate(()=>SACleanserConsole.open(fixture.units[0],'cleanser'));await page.locator('.cleanser-station').waitFor();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({baseline,root,origin:page.url(),rows,reducedMotion:true,closeReopen:true,errors},null,2));console.log(JSON.stringify({passed:true,baseline,out,viewports:rows.length}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
