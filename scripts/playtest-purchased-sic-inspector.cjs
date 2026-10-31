// One owned disposable builder fixture; never attaches to an existing tab/server.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-purchased-inspector-')),result={checks:[],errors:[],writes:[]};
let server,browser;
async function main(){
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-purchased-inspector-data-'));
  server=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);server.stdout.on('data',d=>{const m=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(t);resolve(m[1]);}});server.once('error',reject);});
  browser=await pw.chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(10000);
  page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')result.writes.push(r.url());});
  await page.goto(base+'/starship.html?new=1');await page.locator('[data-starship-tab="sheet"]').waitFor();
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sa-starship-layout-draft'));d.sicInventory=[{id:'diagnostic-owned-engine',type:'en-engine-2',storage:true}];d.confirmed.sicInventory=d.sicInventory;localStorage.setItem('sa-starship-layout-draft',JSON.stringify(d));});
  await page.reload();await page.locator('[data-starship-tab="sheet"]').click();
  const dialog=page.locator('#sicCardDialog'),toggle=dialog.locator('.sic-context-actions legend button');
  const inventory=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sa-starship-layout-draft')).sicInventory);
  const open=async()=>{await page.locator('.purchased-sic-shelf [data-open-sic-id="diagnostic-owned-engine"]').click();await dialog.waitFor({state:'visible'});};
  const closed=()=>page.waitForFunction(()=>!document.getElementById('sicCardDialog').open);
  const expand=async()=>{if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();};
  await open();const before=await inventory();
  const expandedBefore=await toggle.getAttribute('aria-expanded');
  for(const selector of ['.sic-context-actions > header strong','.sic-context-actions > header small','.inventory-sic-name strong','.inventory-sic-name small']){
    await dialog.locator(selector).click();
    assert.equal(await dialog.evaluate(d=>d.open),true,'right-side descriptive text must retain inspector');
    assert.equal(await toggle.getAttribute('aria-expanded'),expandedBefore);
    assert.deepEqual(await inventory(),before);
    result.checks.push('right-side text retains inspector: '+selector);
  }
  for(const input of ['pointer','Enter','Space','pointer']){
    const was=await toggle.getAttribute('aria-expanded');
    if(input==='pointer')await toggle.click();else await toggle.press(input);
    await page.waitForFunction(w=>document.querySelector('#sicCardDialog .sic-context-actions legend button').getAttribute('aria-expanded')!==w,was);
    assert.equal(await dialog.evaluate(d=>d.open),true,input+' disclosure must retain inspector');
    assert.deepEqual(await inventory(),before);result.checks.push(input+' disclosure keeps inspector/inventory');
  }
  await page.screenshot({path:path.join(out,'disclosure-open.png')});
  await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await closed();await open();
  await toggle.press('Escape');await closed();await open();result.checks.push('X and Escape close/reopen');
  await expand();await dialog.getByRole('button',{name:'Install',exact:true}).click();await closed();
  const installed=await inventory();assert.equal(installed[0].storage,false);result.checks.push('Install executes and closes');
  await open();await expand();const placement=dialog.locator('.inventory-sic-actions button').filter({hasText:/^(Cancel Placement|Place)$/});
  const label=(await placement.textContent()).trim();await placement.click();await closed();
  assert.deepEqual(await inventory(),installed,'placement selection must not alter saved inventory');
  assert.equal(await page.evaluate(()=>selectedSicId),label==='Cancel Placement'?null:'diagnostic-owned-engine');
  result.checks.push(label+' executes and closes');await open();await expand();
  await page.screenshot({path:path.join(out,'reopened-queue.png')});await toggle.press('Escape');await closed();
  await page.locator('[data-starship-tab="sics"]').click();
  const summary=page.locator('summary[aria-label="Sensors: expand 9 cards"]').first();
  const category=page.locator('.sic-category').filter({has:summary}).locator('legend button').first();
  if(await category.getAttribute('aria-expanded')==='false')await category.click();await summary.click();
  const family=page.locator('dialog.sic-family-picker[open]');await family.waitFor();await family.getByRole('button',{name:'Sensors 1 details',exact:true}).click();
  const purchasing=page.locator('dialog.shared-card-inspector[open]');await purchasing.waitFor();
  await purchasing.getByRole('button',{name:'Fit Card',exact:true}).click();assert.equal(await purchasing.evaluate(d=>d.open),true);
  await purchasing.press('Escape');await purchasing.waitFor({state:'detached'});result.checks.push('purchasing Fit/Escape unchanged');
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.writes,[]);
}
main().catch(e=>{result.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(out,JSON.stringify(result));
  await browser?.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>{server.once('exit',r);setTimeout(r,4000).unref();});}
});
