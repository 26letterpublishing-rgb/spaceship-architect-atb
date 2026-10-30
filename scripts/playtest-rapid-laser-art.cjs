const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before'),out=fs.mkdtempSync(path.join(os.tmpdir(),`sa-rapid-${before?'before':'after'}-`)),data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-rapid-data-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),personal=path.join(root,'data/campaigns.json'),personalHash=fs.existsSync(personal)?hash(fs.readFileSync(personal)):null,errors=[],records=[];let server,browser,page;
(async()=>{try{
 const boot="const net=require('node:net'),listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object')a[0]={...a[0],host:'127.0.0.1'};else a[1]='127.0.0.1';return listen.apply(this,a);};require('./server.js');";
 server=spawn(process.execPath,['-e',boot],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),15000);server.once('error',reject);server.stdout.on('data',d=>{const m=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const post=async(p,b)=>{const r=await fetch(base+'/api/campaign/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
 const demo=await post('showcase/start',{});await post('shops',{code:demo.code,token:demo.gmToken,operation:'save',shop:{id:'rapid-review',name:'Rapid Review',active:true,modifier:0,maxSicLevel:5}});
 const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));browser=await pw.chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 for(const surface of ['builder','gm','pc']){
  page=await browser.newPage();page.on('pageerror',e=>errors.push(surface+': '+e.message));
  if(surface==='builder'){await page.goto(base+'/starship.html?new=1');await page.locator('[data-starship-tab="sics"]').click();}
  else{const pc=demo.players[0],key=surface==='gm'?'sa-gm-token-'+demo.code:'sa-character-token-'+demo.code+'-'+pc.id,token=surface==='gm'?demo.gmToken:pc.token;
   await page.goto(base+(surface==='gm'?'/gm.html?campaign='+demo.code:'/character.html?campaign='+demo.code+'&character='+pc.id));await page.evaluate(({key,token})=>{sessionStorage.setItem(key,token);localStorage.setItem(key,token);},{key,token});await page.reload();await page.locator(surface==='gm'?'[data-tab="shop"]':'[data-character-tab="shop"]').click();}
  if(surface==='gm')await page.getByText('Equipment Catalog — SICs and Weapons',{exact:true}).click();
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
   await page.setViewportSize({width,height});const summary=page.locator('summary[aria-label="Rapid Laser: expand 5 cards"]').first();await summary.waitFor({state:'attached'});
   const category=page.locator('.sic-category').filter({has:summary}).locator('legend button').first();if(await category.count()&&await category.getAttribute('aria-expanded')==='false')await category.click();
   await summary.click();const family=page.locator('dialog.sic-family-picker[open]');await family.waitFor();
   for(let tier=1;tier<=5;tier++){
    const preview=family.locator(`[data-sic-preview="rapid-laser-${tier}"]`),img=preview.locator('img.sic-poker-art');await img.evaluate(el=>el.decode());
    const info=await img.evaluate(el=>({src:el.currentSrc,width:el.naturalWidth,height:el.naturalHeight,fit:getComputedStyle(el).objectFit}));const file=before?'card-rapid-laser-equipment-v2.webp':`sic-rapid-laser-${tier}-approved.png`;assert.equal(new URL(info.src).pathname,'/'+file);const response=await fetch(info.src);assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.join(root,file))));if(!before)assert.deepEqual([info.width,info.height],[1254,1254]);records.push({surface,viewport:{width,height},tier,...info});
    await preview.click();const inspector=page.locator('dialog.shared-card-inspector[open]');await inspector.waitFor();await inspector.locator('img.sic-poker-art').evaluate(el=>el.decode());await page.screenshot({path:path.join(out,`${surface}-${width}-tier-${tier}.png`)});await page.keyboard.press('Escape');await inspector.waitFor({state:'hidden'});
   }
   await page.screenshot({path:path.join(out,`${surface}-${width}-family.png`)});await page.keyboard.press('Escape');await family.waitFor({state:'hidden'});
  }await page.close();
 }
 assert.deepEqual(errors,[]);assert.equal(fs.existsSync(personal)?hash(fs.readFileSync(personal)):null,personalHash);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,before,records,errors,personalUnchanged:true},null,2));console.log('PASS',out);
 }catch(e){await page?.screenshot({path:path.join(out,'FAILED.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:false,error:e.stack,records,errors},null,2));console.error(e,'Evidence:',out);process.exitCode=1;}finally{await browser?.close();if(server&&server.exitCode===null)server.kill();}})();
