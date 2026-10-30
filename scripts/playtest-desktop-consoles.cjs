// Desktop-only browser regression. Uses disposable storage and an ephemeral port; never opens existing browser tabs.
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=process.cwd(),out='C:/Users/zombi/AppData/Local/Temp/sa-desktop-consoles-after',maps=require(path.join(root,'ship-map-core'));
fs.mkdirSync(out,{recursive:true});let server,browser;
async function main(){
 server=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-console-restore-'))},stdio:['ignore','pipe','pipe']});
 const base=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const m=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m)resolve(m[1]);});setTimeout(()=>reject(Error('Startup timeout')),10000).unref();});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>{console.log('PAGE ERROR',page.url(),e.stack);errors.push(e.message);});
 const reps=new Map();for(const [type,d]of Object.entries(maps.catalog)){if(!(d.shipControl||d.shield||d.sensor||d.weapon||d.lockOn||d.utility||d.hacking))continue;const key=d.shipControl?'pilot':d.shield?'shield':d.sensor?'sensor':d.weapon?'weapon-'+(d.weapon.kind||d.weapon.family||type.replace(/-\d+$/,'')):d.lockOn?'lock':d.hacking?'hacking':'utility-'+d.utility;if(!reps.has(key))reps.set(key,type);}
 const results=[];
 for(const [kind,type]of reps){
  await page.goto(base+'/index.html?catalogPreview='+encodeURIComponent(type));
  const view=page.locator('dialog[data-catalog-snapshot][open]');await view.waitFor({timeout:12000});await page.waitForTimeout(100);
  assert.equal(await view.evaluate(e=>e.classList.contains('sci-fi-dialog-surface')),false,type);
  const sample=()=>view.evaluate(e=>[e,...e.querySelectorAll('header,form,input,select,h2')].map(n=>{const c=getComputedStyle(n);return {tag:n.tagName,padding:c.padding,bg:c.backgroundImage,color:c.color,border:c.border,bounds:[n.clientWidth,n.clientHeight],font:c.fontFamily};}));
  const actual=await sample();await page.evaluate(()=>{for(const sheet of document.styleSheets)if(sheet.href?.includes('popup-theme.css'))sheet.disabled=true;});const authored=await sample();assert.deepEqual(actual,authored,type+' unchanged by popup stylesheet');
  await page.evaluate(()=>{for(const sheet of document.styleSheets)if(sheet.href?.includes('popup-theme.css'))sheet.disabled=false;});
  if(['pilot','shield','sensor','hacking','lock'].includes(kind)||kind.startsWith('utility-'))await page.screenshot({path:path.join(out,type+'.png')});
  results.push({kind,type,classes:await view.getAttribute('class')});
  if(kind==='pilot'){await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'pilot-tablet.png')});assert.equal(await view.evaluate(e=>e.classList.contains('sci-fi-dialog-surface')),false);await page.setViewportSize({width:1440,height:1000});}
  console.log('PREVIEW PASS',kind,type);
 }
 await page.goto(base+'/starship.html?new=1');await page.waitForTimeout(500);
 await page.evaluate(()=>{const source=document.querySelector('[data-sic-card]');SACardInspector.open(source,{document});});await page.waitForTimeout(150);
 assert.equal(await page.locator('.shared-card-inspector').evaluate(e=>e.classList.contains('sci-fi-dialog-surface')),true);await page.screenshot({path:path.join(out,'popup-frame-preserved.png')});
 // Actual nested preview path: outer framed card remains, foreground console does not inherit it.
 await page.evaluate(()=>SACardInspector.previewConsole('shield-1',document));await page.locator('dialog[data-catalog-snapshot][open]').waitFor();
 assert.equal(await page.locator('dialog[data-catalog-snapshot][open]').evaluate(e=>e.classList.contains('sci-fi-dialog-surface')),false);
 await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();await page.waitForTimeout(200);assert.equal(await page.locator('.shared-card-inspector[open]').count(),1);assert.equal(await page.locator('dialog[data-catalog-snapshot]').count(),0);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);console.log('SWEEP',results.length,'ERRORS',errors);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();});
