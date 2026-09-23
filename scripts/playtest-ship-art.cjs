const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','ship-art');fs.mkdirSync(out,{recursive:true});let child,browser;
async function main(){
  child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-ship-art-'))},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(t);resolve(url);}});});
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(base+'/starship.html');
  await page.getByRole('button',{name:'SICs',exact:true}).click();await page.locator('summary[aria-label="Darkveil: expand 10 cards"]').click();const picker=page.getByRole('dialog',{name:'Darkveil',exact:true});await picker.waitFor();
  const images=await picker.locator('img').evaluateAll(async elements=>{
    const hashes=[];for(const image of elements){await image.decode();if(!image.src.includes('darkveil'))continue;const canvas=document.createElement('canvas');canvas.width=90;canvas.height=90;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,90,90);const data=ctx.getImageData(0,0,90,90).data;hashes.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].join(','));}return hashes;
  });assert.equal(images.length,10);assert.equal(new Set(images).size,10);await page.waitForTimeout(1600);await page.screenshot({path:path.join(out,'darkveil-market.png')});await picker.getByRole('button',{name:'Back',exact:true}).click();
  console.log('PASS actual market picker renders ten pixel-distinct Darkveil cards.');
  await page.evaluate(()=>{
    const maps=window.SAShipMap;draft={...defaultDraft(),title:'Attachment Inspection',gridCells:maps.rectangleCells({},126,7,7),sicInventory:[{id:'top',type:'exhaust-thruster-5'},{id:'bottom',type:'exhaust-thruster-5'},{id:'left',type:'ionic-pulse-thruster-5'},{id:'right',type:'ionic-pulse-thruster-5'},{id:'gun',type:'rapid-laser-5'},{id:'life',type:'life-support',impaired:true,impairmentPoints:1},{id:'sensor',type:'sensors-3',impaired:true,impairmentPoints:2},{id:'nut',type:'nutritional-supplement',impaired:true,impairmentPoints:3}],placements:[{sicId:'life',cell:166},{sicId:'sensor',cell:170},{sicId:'nut',cell:171}]};
    for(const id of ['top','bottom','left','right','gun']){
      const item=draft.sicInventory.find(i=>i.id===id),target=id==='top'?86:id==='bottom'?266:id==='left'?163:id==='right'?173:88;
      const legal=Array.from({length:400},(_,i)=>i).filter(i=>maps.exteriorPlacement(draft,item.type,i,id)).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];if(legal===undefined)throw Error('No exterior fixture placement: '+id);draft.placements.push({sicId:id,cell:legal});
    }
    draft.confirmed=constructionState(draft);mapView={...mapView,labels:true,highResolution:true,combatMesh:false,walls:true,stations:true,hull:false};applyDraftToUi();
  });
  await page.getByRole('button',{name:'Ship Details',exact:true}).click();const grid=page.locator('.ship-grid:not(.mobile-grid)');await grid.scrollIntoViewIfNeeded();assert.equal(await grid.locator('.sa-exterior-mount').count(),0);
  await page.waitForTimeout(200);await grid.screenshot({path:path.join(out,'attached-high-res.png')});
  const pulse=grid.locator('.sa-sic-impairment[data-impairments="1"]').first(),a=await pulse.evaluate(e=>getComputedStyle(e).opacity);await page.waitForTimeout(500);const b=await pulse.evaluate(e=>getComputedStyle(e).opacity);assert.notEqual(a,b);
  for(const [points,period] of [[1,'2.8s'],[2,'1.8s'],[3,'1s']])assert.equal(await grid.locator(`.sa-sic-impairment[data-impairments="${points}"]`).first().evaluate(e=>getComputedStyle(e).animationDuration),period);
  assert.equal(await pulse.isVisible(),true);assert.ok((await pulse.boundingBox()).width>10);
  await grid.locator('.sa-sic-impairment').evaluateAll(elements=>elements.forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=Number(a.effect.getTiming().duration)/2;})));
  await pulse.scrollIntoViewIfNeeded();
  await pulse.evaluate(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0;}));const low=await pulse.screenshot({path:path.join(out,'pulse-low.png')});
  await pulse.evaluate(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=Number(a.effect.getTiming().duration)/2;}));const high=await pulse.screenshot({path:path.join(out,'pulse-high.png')});
  assert.notDeepEqual(low,high,'the impairment pulse changes actual visible pixels');
  await grid.screenshot({path:path.join(out,'impairment-peak.png')});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await pulse.evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{draft.thrusterDirection=270;draft.confirmed=constructionState(draft);renderAll();});await grid.screenshot({path:path.join(out,'parallel-thrusters.png')});
  await page.locator('.desktop-map-display [data-map-display=hull]').locator('..').click();await grid.screenshot({path:path.join(out,'attached-hull.png')});
  await page.locator('.desktop-map-display [data-map-display=hull]').locator('..').click();await page.locator('.desktop-map-display [data-map-display=highResolution]').locator('..').click();await grid.screenshot({path:path.join(out,'attached-low-res.png')});
  assert.deepEqual(errors,[]);console.log('PASS high/low resolution and Hull mounts without cones, parallel engine facing, visible graded impairment pulses and reduced motion.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();});
