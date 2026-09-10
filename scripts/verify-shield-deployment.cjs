// Read-only hosted asset and desktop smoke checks. Does not create campaign data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base=process.env.SA_VERIFY_URL||'https://spaceship-architect-atb.onrender.com';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const files=['index.html','ship-map-core.js','ship-shields.js','station-access.js','ship-power.js','shield-console-ui.js','ship-navigation-ui.js','ship-navigation-ui.css','starship.js','starship.css','character.js'];
async function main(){
  for(const file of files){
    const response=await fetch(base+'/'+file,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,file);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.join(root,file))),file+' differs from local build');
  }
  for(const name of ['shield-1-card','shield-1-floor-plan','shield-console-background','cockpit-2-card','bridge-8-card','bridge-8-floor-plan']){
    const response=await fetch(base+'/'+name+'.png',{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,name);assert.equal(response.headers.get('content-type'),'image/webp');
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.join(root,name+'-web.webp'))),name);
  }
  const browser=await chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/starship.html');
    await page.getByRole('button',{name:'SICs',exact:true}).click();
    await page.locator('summary[aria-label="Bridge: expand 8 cards"]').click();
    await page.getByRole('dialog',{name:'Bridge',exact:true}).waitFor();
    await page.locator('.sic-picker-slot img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    assert.equal(await page.locator('.sic-picker-slot').count(),8);
    await page.waitForTimeout(1200);
    const directory=path.join(root,'test-artifacts','shields');fs.mkdirSync(directory,{recursive:true});
    await page.screenshot({path:path.join(directory,'hosted-bridge-roster.png')});
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.locator('[data-sic-card="shield-1"]').waitFor();
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
  console.log('Hosted deployment matches local code and optimized artwork. Bridge picker and Shield 1 render at 1366x768 without page errors. No campaign data changed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
