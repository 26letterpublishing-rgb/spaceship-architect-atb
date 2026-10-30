const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('child_process');
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-sector-grid-'));fs.mkdirSync(out,{recursive:true});
const current=fs.readFileSync(path.join(root,'campaign-starmaps-ui.js'),'utf8'),before=current.replace(' M.866025404 2.5V3.5','');assert.notEqual(before,current);
(async()=>{let child,browser;const result={rows:[],errors:[]};try{
const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-sector-review-'));result.ownedData=data;
const boot="const net=require('net'),listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object')a[0]={...a[0],host:'127.0.0.1'};else a[1]='127.0.0.1';return listen.apply(this,a)};require('./server.js')";
child=spawn(process.execPath,['-e',boot],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),15000);child.stdout.on('data',b=>{const m=String(b).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});result.base=base;
const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt:require('crypto').randomUUID(),...body})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;};
const c=await post('campaign/v03/create',{name:'Owned Sector review',gmCode:'owned-sector-review'}),code=c.campaign.code,token=c.token;
let m=await post('campaign/v03/starmap',{code,token,kind:'create',name:'Sector review'});const mapId=m.campaign.starmaps.maps.at(-1).id;
for(const [name,q,r]of [['West boundary',-12,0],['East boundary with a long star label',12,0],['North boundary',0,-8],['South boundary',0,8]])await post('campaign/v03/starmap',{code,token,kind:'star',mapId,name,q,r});
browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});const context=await browser.newContext();const p=await context.newPage();p.on('pageerror',e=>result.errors.push(e.message));await p.goto(base+'/gm.html?campaign='+code);await p.evaluate(({code,token})=>{sessionStorage.setItem('sa-gm-token-'+code,token);localStorage.setItem('sa-gm-token-'+code,token);},{code,token});await p.reload();await p.getByRole('button',{name:'Campaign',exact:true}).click();
const baseline=new Map();for(const phase of ['before','after']){
await context.route('**/campaign-starmaps-ui.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:phase==='before'?before:current}));
await p.reload();await p.getByRole('button',{name:'Campaign',exact:true}).click();
for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){await p.setViewportSize({width,height});for(const expanded of [false,true]){if(expanded)await p.getByRole('button',{name:'Enlarge Map',exact:true}).click();await p.getByRole('button',{name:'Pan Map',exact:true}).click();await p.getByRole('button',{name:'Fit Map',exact:true}).click();await p.waitForTimeout(400);
const state=await p.evaluate(()=>{const s=document.querySelector('.galaxy-map-surface svg'),r=s.getBoundingClientRect();return {map:{x:r.x,y:r.y,w:r.width,h:r.height},pattern:s.querySelector('pattern').outerHTML,labels:[...s.querySelectorAll('.galaxy-star-name')].map(t=>{const b=t.getBoundingClientRect();return {text:t.textContent,inside:b.left>=r.left&&b.top>=r.top&&b.right<=r.right&&b.bottom<=r.bottom};})};});
const geometry=await p.locator('.galaxy-map-surface svg').evaluate(s=>({view:s.getAttribute('viewBox'),stars:[...s.querySelectorAll('[data-star]')].map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.star,transform:n.getAttribute('transform'),x:b.x,y:b.y,w:b.width,h:b.height};})}));
assert.ok(state.labels.every(l=>l.inside));
await p.screenshot({path:path.join(out,`${phase}-sector-gm-${width}-${expanded?'enlarged':'normal'}.png`),fullPage:true});
// Exercise actual pan, zoom and pointer-to-hex hover without changing campaign data.
await p.getByRole('button',{name:'Pan Map',exact:true}).click();const svg=p.locator('.galaxy-map-surface svg'),b=await svg.boundingBox();
await p.mouse.move(b.x+b.width*.2,b.y+b.height*.4);await p.mouse.down();await p.mouse.move(b.x+b.width*.2+35,b.y+b.height*.4+25,{steps:8});await p.mouse.up();
const pan=await svg.getAttribute('viewBox');assert.notEqual(pan,geometry.view);
await p.mouse.move(b.x+b.width*.4,b.y+b.height*.3);const hover=await svg.locator('[data-hover-hex]').getAttribute('transform');assert.match(hover,/translate/);
await p.getByRole('button',{name:'Zoom in Galaxy Map',exact:true}).click();const zoom=await svg.getAttribute('viewBox');assert.notEqual(zoom,pan);
await p.getByRole('button',{name:'Zoom out Galaxy Map',exact:true}).click();await p.getByRole('button',{name:'Fit Map',exact:true}).click();await p.waitForTimeout(150);assert.equal(await svg.getAttribute('viewBox'),geometry.view);
await p.getByRole('button',{name:'Add Star',exact:true}).click();await p.mouse.click(b.x+b.width*.4,b.y+b.height*.3);
const editor=p.getByRole('dialog').filter({has:p.locator('input[name=q]')});await editor.waitFor();const selection={q:await editor.locator('input[name=q]').inputValue(),r:await editor.locator('input[name=r]').inputValue()};await p.keyboard.press('Escape');await editor.waitFor({state:'hidden'});
const comparison={map:state.map,geometry,pan,hover,zoom,selection},key=width+'-'+expanded;
if(phase==='before')baseline.set(key,comparison);else assert.deepEqual(comparison,baseline.get(key),'camera/star bounds and pointer hex unchanged');
result.rows.push({phase,width,height,expanded,...state,comparison});if(expanded)await p.getByRole('button',{name:'Return to Campaign',exact:true}).click();}
await p.getByRole('button',{name:'Zoom in Galaxy Map',exact:true}).click();await p.getByRole('button',{name:'Zoom out Galaxy Map',exact:true}).click();}
await context.unrouteAll();}
// Rasterize the actual pattern on black at several zooms. This measures alpha
// along the formerly missing edge and its periodic continuation, not URL identity.
result.seams=await p.evaluate(async()=>{const pattern=document.querySelector('#galaxy-hex-grid').outerHTML,rows=[];
 for(const scale of [20,40,80]){const canvas=document.createElement('canvas');canvas.width=400;canvas.height=900;const c=canvas.getContext('2d');
 const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="900" viewBox="0 0 ${400/scale} ${900/scale}"><defs>${pattern}</defs><rect width="100" height="100" fill="url(#galaxy-hex-grid)"/></svg>`);await image.decode();c.drawImage(image,0,0);
 const alpha=(x,y)=>{let max=0;for(let dx=-1;dx<=1;dx++)max=Math.max(max,c.getImageData(Math.floor(x*scale)+dx,Math.floor(y*scale),1,1).data[3]);return max;};
 const samples=[];for(let tile=0;tile<3;tile++)for(const y of [2.6,2.8,2.95,3.05,3.2,3.4])samples.push(alpha(.866025404,tile*3+y));rows.push({scale,samples,min:Math.min(...samples),max:Math.max(...samples)});
 }return rows;});
for(const row of result.seams){assert.ok(row.min>0,'no missing seam pixels');assert.ok(row.max-row.min<=4,'no doubled opacity at seam');}
assert.deepEqual(result.errors,[]);result.completed=true;
}finally{await browser?.close();if(child?.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}result.cleanedUp=true;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));}console.log(JSON.stringify(result));})().catch(e=>{console.error(e);process.exitCode=1});
