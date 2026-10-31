'use strict';
// Sensors-only developer tool. Never attaches to a pre-existing server or browser.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {seed,validate,scenarios}=require('./fixtures/console-debug-sensors.cjs');
function playwright(){try{return require('playwright');}catch{return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}}
const root=path.resolve(__dirname,'..');
async function startHarness({headless=false}={}){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-console-debug-'));
 let child,browser,context,panel,pc,gm,fixture,base,listenerAddress,viewport={width:1366,height:768},busy=false,stopped=false;const errors=[];
 const onSignal=()=>{void stop();};process.once('SIGINT',onSignal);process.once('SIGTERM',onSignal);
 async function stop(){if(stopped)return;stopped=true;process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);await browser?.close().catch(()=>{});if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,4000).unref();});} }
 const post=async(route,body)=>{if(stopped)throw Error('Harness stopped');const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error||JSON.stringify(d));return d;};
 const state=()=>fetch(`${base}/api/state?room=${fixture.code}&token=${fixture.token}`).then(r=>r.json());
 async function openConsole(){
  if(!pc||pc.isClosed())pc=await context.newPage();
  await pc.setViewportSize(viewport);
  await pc.goto(`${base}/character.html?campaign=${fixture.code}&character=${fixture.characterId}`);
  await pc.evaluate(f=>{sessionStorage.setItem('sa-character-token-'+f.code+'-'+f.characterId,f.pcToken);localStorage.setItem('sa-character-token-'+f.code+'-'+f.characterId,f.pcToken);},JSON.parse(JSON.stringify(fixture)));
  await pc.reload();
  if(await pc.getByRole('button',{name:'Enter PC Code',exact:true}).isVisible()){await pc.getByRole('button',{name:'Enter PC Code',exact:true}).click();await pc.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill(fixture.password);await pc.getByRole('button',{name:'Unlock Character',exact:true}).click();}
  await pc.getByRole('button',{name:'Combat',exact:true}).click();
  const launcher=pc.locator('[data-console-view]');await launcher.waitFor({state:'attached'});
  if(await launcher.getAttribute('aria-pressed')!=='true')await launcher.click();
  await pc.getByRole('combobox',{name:'Station console',exact:true}).selectOption('sn');await pc.getByRole('dialog',{name:'Sensor console',exact:true}).waitFor();
  await pc.bringToFront();return pc;
 }
 async function reset(tier=1,scenario='ready'){
  validate(tier,scenario);if(stopped||busy)throw Error('Harness is stopped or busy');busy=true;
  try{
   await pc?.close().catch(()=>{});await gm?.close().catch(()=>{});
   if(fixture)await fixture.act({action:'setHardPaused',paused:true});
   fixture=await seed(post,tier,scenario);
   gm=await context.newPage();await gm.goto(`${base}/gm.html?campaign=${fixture.code}`);
   await gm.evaluate(f=>{sessionStorage.setItem('sa-gm-token-'+f.code,f.token);localStorage.setItem('sa-gm-token-'+f.code,f.token);},JSON.parse(JSON.stringify(fixture)));await gm.reload();
   await gm.getByRole('button',{name:'Combat',exact:true}).click();const resume=gm.getByRole('button',{name:'Resume Encounter',exact:true});if(await resume.isVisible())await resume.click();
   const engage=gm.frameLocator('#atbFrame').getByRole('button',{name:/^(Engage Clock|Begin Combat, and Engage Clock!!)$/});await engage.click({timeout:15000});
   await fixture.act({action:'setHardPaused',paused:true});const operator=(await state()).units.find(u=>u.characterId===fixture.characterId);await fixture.act({action:'nudge',id:operator.id,amount:100});
   await openConsole();
   await panel.evaluate(({tier,scenario,code})=>{document.querySelector('#status').textContent=`Ready: Sensors ${tier}, ${scenario}, disposable room ${code}. Combat is paused; use the GM tab to run/step time. Reset discards this scenario.`;},JSON.parse(JSON.stringify(fixture)));
   return {code:fixture.code,tier:fixture.tier,scenario:fixture.scenario};
  }finally{busy=false;}
 }
 try{
  // Constrain only this child process's listener; production server.js is unchanged.
  const boot="const net=require('node:net');const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object'){a[0]={...a[0],host:'127.0.0.1'};}else{a[1]='127.0.0.1';}this.once('listening',()=>console.log('DEBUG_BIND '+this.address().address));return listen.apply(this,a);};require('./server.js');";
  child=spawn(process.execPath,['-e',boot],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),15000);child.once('error',reject);child.once('exit',()=>reject(Error('Server exited during startup')));child.stdout.on('data',d=>{const bound=String(d).match(/DEBUG_BIND (\S+)/);if(bound)listenerAddress=bound[1];const m=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  browser=await playwright().chromium.launch({channel:'chrome',headless,args:['--mute-audio']});if(stopped){await browser.close();throw Error('Stopped during startup');}context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});context.on('page',p=>p.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,url:p.url(),tier:fixture?.tier,scenario:fixture?.scenario})));
  panel=await context.newPage();await panel.exposeFunction('debugReset',reset);await panel.exposeFunction('debugOpen',async()=>{await openConsole();return 'Console reopened';});await panel.exposeFunction('debugSize',async value=>{if(!['1920x1080','1366x768','1280x720'].includes(value))throw Error('Unsupported desktop viewport');const [width,height]=value.split('x').map(Number);viewport={width,height};await pc.setViewportSize(viewport);await pc.bringToFront();});await panel.exposeFunction('debugStop',()=>{setTimeout(()=>stop(),100);return 'Stopping harness-owned browser and server.';});
  await panel.setContent(`<!doctype html><html lang="en"><title>Sensors Console Debugger</title><style>body{font:18px system-ui;background:#15202a;color:#eee;margin:40px;max-width:850px}label{display:block;margin:20px 0}button,select{font:inherit;padding:10px;margin:6px}#status{white-space:pre-wrap}button:disabled{opacity:.5}</style><h1>Sensors Console Debugger</h1><p>Developer tool · Sensors only · disposable local campaigns · audio muted</p><p>The PC tab uses the real interactive Combat Console. The GM tab controls combat time and recovery. This is separate from purchase previews.</p><label>Tier <select id="tier">${Array.from({length:9},(_,i)=>`<option value="${i+1}">Sensors ${i+1}</option>`).join('')}</select></label><label>Scenario <select id="scenario">${scenarios.map(s=>`<option>${s}</option>`).join('')}</select></label><button id="reset">Create / Reset scenario</button><button id="open">Reopen PC Console</button><label>PC viewport <select id="size"><option>1366x768</option><option>1920x1080</option><option>1280x720</option></select></label><button id="stop">Stop debugger</button><p>No-AU removes auxiliary generation; normal scans may still work. Conditional input costs AU. Offline powers down sensors. No-target removes the other ship.</p><p id="status" role="status">Starting…</p><script>async function run(fn){const buttons=[...document.querySelectorAll('button,select')];buttons.forEach(b=>b.disabled=true);try{await fn()}catch(e){document.querySelector('#status').textContent='Error: '+e.message+' — Reset to recover.'}finally{buttons.forEach(b=>b.disabled=false)}}document.querySelector('#reset').onclick=()=>run(()=>debugReset(Number(document.querySelector('#tier').value),document.querySelector('#scenario').value));document.querySelector('#open').onclick=()=>run(()=>debugOpen());document.querySelector('#size').onchange=()=>run(()=>debugSize(document.querySelector('#size').value));document.querySelector('#stop').onclick=()=>run(async()=>document.querySelector('#status').textContent=await debugStop());</script></html>`);
  await reset();await panel.bringToFront();browser.on('disconnected',()=>stop());
  return {panel,get pc(){return pc;},get gm(){return gm;},get fixture(){return fixture;},base,data,listenerAddress,errors,reset,openConsole,state,stop,get stopped(){return stopped;}};
 }catch(error){await stop();throw error;}
}
module.exports={startHarness};
if(require.main===module){if(process.argv.length>2){console.error('Usage: node scripts/console-debug.cjs (no existing server/campaign arguments accepted)');process.exitCode=1;}else startHarness().then(h=>{console.log('Sensors debugger running. Use Stop debugger, close its browser, or press Ctrl+C. Temporary data: '+h.data);}).catch(e=>{console.error(e);process.exitCode=1;});}
