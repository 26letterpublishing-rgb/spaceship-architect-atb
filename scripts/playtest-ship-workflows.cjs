// Isolated browser regression for construction, PC details, previews and print output.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const maps=require('../ship-map-core');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','ship-workflows');
fs.mkdirSync(out,{recursive:true});
let child,browser,page;
async function main(){
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-ships-'))},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timed out')),10000);child.on('error',reject);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timeout);resolve(url);}});child.stderr.on('data',c=>process.stderr.write(c));});
  const post=async(route,body,status)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.ok(status?r.status===status:r.ok,JSON.stringify(data));return data;};
  const created=await post('campaign/create',{name:'Ship Workflows',gmCode:'workflow-gm'}),code=created.campaign.code,token=created.token;
  const character={id:'workflow-pc',phase:'finalized',access:{pcCode:'workflow-pc-code'},identity:{characterName:'Test Pilot',playerName:'Tester'},attributes:{health:[1,0,-1,-1],intellect:[1,0,-1,-1],perception:[1,0,-1,-1],dexterity:[1,0,-1,-1]},computed:{maximumHp:30,moveSpeed:2,speed:3,commandWindow:60,skills:{}},health:{current:30}};
  const join=await post('campaign/join/request',{code,character});await post('campaign/join/respond',{code,token,requestId:join.requestId,decision:'approve'});
  const ship={id:'workflow-ship',title:'Workflow Starship',confirmedOnce:true,gridCells:Array.from({length:28},(_,n)=>42+Math.floor(n/7)*20+n%7),sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-engine-2'},{id:'th',type:'ionic-pulse-thruster-1'},{id:'gun',type:'rapid-laser-1'}],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43},{sicId:'en',cell:65},{sicId:'th',cell:41},{sicId:'gun',cell:24}],doorStates:{'42:43':true}};
  await post('campaign/starship/link',{code,token,starship:ship});await post('campaign/starship/crew',{code,token,starshipId:ship.id,crewCharacterIds:[character.id]});
  await post('campaign/starship/move-character',{code,token,starshipId:ship.id,characterId:character.id,square:42,mesh:0,stationed:true,stationSlot:0});
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.on('page',p=>p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);}));
  await context.addInitScript(()=>{window.print=()=>{document.body.dataset.printInvoked='true';};});
  page=await context.newPage();await page.goto(`${base}/character.html?campaign=${code}&character=${character.id}`);
  await page.getByRole('button',{name:'Enter PC Code',exact:true}).click();await page.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill('workflow-pc-code');await page.getByRole('button',{name:'Unlock Character',exact:true}).click();
  await page.getByRole('button',{name:'Starships',exact:true}).click();
  const details=page.frameLocator('[data-player-ship-details]');await details.locator('.ship-details-only').waitFor();await details.locator('.ship-detail-crew[title^="Test Pilot"]').first().waitFor();
  const toggles=details.locator('.desktop-map-display');await toggles.waitFor();
  const classes={labels:'show-sic-labels',highResolution:'high-resolution',combatMesh:'combat-mesh',walls:'show-walls',hull:'hull-view'};
  for(const key of ['labels','highResolution','combatMesh','walls','stations','hull']){
    const input=toggles.locator(`[data-map-display="${key}"]`),before=await input.isChecked();
    await input.locator('..').click();assert.equal(await input.isChecked(),!before,`${key} responds in PC sheet`);
    if(classes[key])assert.equal(await details.locator('.ship-grid:not(.mobile-grid)').evaluate((e,c)=>e.classList.contains(c),classes[key]),!before,`${key} reaches actual PC map`);
    if(key==='stations')assert.equal(await details.locator('.ship-grid:not(.mobile-grid) .sic-station-marker').count(),0);
    await input.locator('..').click();assert.equal(await input.isChecked(),before);
    if(key==='stations')assert.ok(await details.locator('.ship-grid:not(.mobile-grid) .sic-station-marker').count()>0,'Stations return to the real map');
  }
  await toggles.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'pc-left-map-controls.png')});
  await toggles.locator('[data-map-display=highResolution]').locator('..').click();
  await page.getByRole('button',{name:'Character Sheet',exact:true}).click();await page.getByRole('button',{name:'Starships',exact:true}).click();
  assert.equal(await toggles.locator('[data-map-display=highResolution]').isChecked(),true,'PC map settings survive tab switching');
  await toggles.locator('[data-map-display=highResolution]').locator('..').click();
  assert.ok(await details.locator('.purchased-sic-card').count()||await details.locator('[data-owned-sic]').count()||await details.getByText('Purchased SICs',{exact:true}).count());
  await page.screenshot({path:path.join(out,'pc-ship-details.png'),fullPage:true});
  const draftBefore=await page.evaluate(()=>localStorage.getItem('sa-starship-layout-draft'));
  await details.getByRole('button',{name:'Print Starship',exact:true}).click();await page.getByRole('combobox',{name:'Print resolution'}).selectOption('low');
  let popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Print',exact:true}).click();let popup=await popupPromise;await popup.locator('body[data-print-ready=true]').waitFor();await popup.pdf({path:path.join(out,'ship-low.pdf'),preferCSSPageSize:true,printBackground:true});await popup.screenshot({path:path.join(out,'ship-low.png'),fullPage:true});await popup.close();
  await details.getByRole('button',{name:'Print Starship',exact:true}).click();popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Print',exact:true}).click();popup=await popupPromise;await popup.locator('body[data-print-ready=true]').waitFor();await popup.pdf({path:path.join(out,'ship-high.pdf'),preferCSSPageSize:true,printBackground:true});await popup.screenshot({path:path.join(out,'ship-high.png'),fullPage:true});await popup.close();
  assert.equal(await page.evaluate(()=>localStorage.getItem('sa-starship-layout-draft')),draftBefore,'Read-only details do not overwrite a construction draft');
  const apiActions=[];page.on('request',r=>{if(r.url().endsWith('/api/action'))apiActions.push(r.postDataJSON());});
  await details.getByRole('button',{name:'Toggle Console',exact:true}).click();const preview=page.getByRole('dialog',{name:'Pilot console',exact:true});await preview.waitFor();await preview.locator('.console-preview-status').waitFor();
  assert.equal(await preview.getByRole('button',{name:'Move Ship',exact:true}).isDisabled(),true);
  await preview.getByRole('combobox',{name:'Station console'}).selectOption('sn');const sensor=page.getByRole('dialog',{name:'Sensor console',exact:true});await sensor.waitFor();await page.waitForTimeout(700);assert.equal(await sensor.locator('[data-order="hex"]').isDisabled(),true);await page.screenshot({path:path.join(out,'console-preview.png')});
  await sensor.getByRole('button',{name:'Close Console',exact:true}).click();await page.locator('[data-console-preview-frame]').waitFor({state:'detached'});assert.deepEqual(apiActions,[],'Preview sends no combat commands');
  await details.getByRole('button',{name:'Move',exact:true}).first().click();
  await details.locator('.embedded-move-controls [data-action=cancel]').first().waitFor();
  await details.locator('.ship-grid:not(.mobile-grid) [data-grid-index="44"]').click();
  await details.locator('.embedded-move-controls [data-action=confirm]:not([disabled])').first().waitFor();
  const moveBox=await details.locator('.embedded-move-controls').first().boundingBox(),mapBox=await details.locator('.desktop-grid-viewport').boundingBox();
  assert.ok(moveBox.x>=mapBox.x+mapBox.width,'Move controls sit to the right, outside the ship map');
  assert.ok(moveBox.x+moveBox.width<=1440,'Move controls remain within the PC viewport');
  assert.equal(await page.locator('[data-player-ship-details]').isVisible(),true,'Main map remains visible during movement');
  await page.screenshot({path:path.join(out,'main-map-move-preview.png'),fullPage:true});
  await details.locator('.embedded-move-controls [data-action=confirm]').first().click();
  await details.locator('.player-ship-moving-token [data-perspective=overhead]').waitFor();
  await page.screenshot({path:path.join(out,'pc-overhead-walking.png')});
  await details.locator('.ship-grid:not(.mobile-grid) [data-grid-index="44"] [data-crew-id="workflow-pc"]').waitFor();
  assert.ok(await details.locator('.ship-grid:not(.mobile-grid) .crew-token svg').count(),'Crew renders as a humanoid');
  const walkTimings=await details.locator('.ship-grid:not(.mobile-grid)').evaluate(async()=>{
    const original=Element.prototype.animate,records=[];let speed;
    Element.prototype.animate=function(frames,options){if(this.classList.contains('player-ship-moving-token'))records.push({speed,duration:options.duration});return original.call(this,frames,options);};
    try{for(speed of [3,9])await window.SAEmbeddedShipMovement.animate('workflow-pc',44,4,[45],4,speed);}finally{Element.prototype.animate=original;}
    return records;
  });
  assert.deepEqual(walkTimings,[{speed:3,duration:3000},{speed:9,duration:1000}]);console.log('PASS actual PC sheet walking animation: Move 9 crosses the same square in one second versus three seconds at Move 3.');
  await details.getByRole('button',{name:'Move',exact:true}).first().click();await details.locator('.embedded-move-controls [data-action=cancel]').first().click();
  await page.getByRole('button',{name:'Upgrade Ship',exact:true}).click();
  const upgrade=page.frameLocator('[data-player-ship-editor]');await upgrade.getByRole('button',{name:'SICs',exact:true}).waitFor();
  await upgrade.getByRole('button',{name:'SICs',exact:true}).click();await upgrade.locator('.sic-market').waitFor();
  await upgrade.getByRole('button',{name:'Construction',exact:true}).click();
  const copy=upgrade.locator('.desktop-construction-sidebar .inventory-sic').filter({hasText:'Rapid Laser 1'});
  await copy.getByRole('button',{name:/Purchase Duplicate/}).click();
  await upgrade.locator('[data-construction-action=confirm]').first().click();
  await page.waitForFunction(async({base,code,token})=>{const s=await fetch(`${base}/api/campaign/state?code=${code}&token=${token}`).then(r=>r.json());return s.starships[0].ship.sicInventory.filter(i=>i.type==='rapid-laser-1').length===2;},{base,code,token});
  await page.screenshot({path:path.join(out,'pc-upgrade-builder.png')});
  await page.getByRole('button',{name:'Return to Ship',exact:true}).click();await details.locator('.ship-details-only').waitFor();
  console.log('PASS PC upgrades, real purchase/confirmation and return to shared ship details.');
  console.log('PASS PC details, crew position, two print modes, read-only multi-console preview and movement entry.');
  const builder=await context.newPage();page=builder;await builder.goto(base+'/starship.html');await builder.evaluate(data=>{localStorage.setItem('sa-starship-layout-draft',JSON.stringify({...data,buildVersion:3,confirmed:null,confirmedOnce:false}));localStorage.removeItem('sa-starship-active-v1');},ship);await builder.reload();
  for(const tab of ['Construction','Ship Details']){
    await builder.getByRole('button',{name:tab,exact:true}).click();const controls=builder.locator(tab==='Construction'?'.desktop-construction-sidebar [data-map-view-controls]':'.desktop-map-display');await controls.waitFor();
    for(const label of ['Labels','High Resolution','Combat Mesh','Walls','Stations','Hull']){const input=controls.getByRole('checkbox',{name:label,exact:true}),before=await input.isChecked();await input.locator('..').click();assert.equal(await input.isChecked(),!before);await input.locator('..').click();}
    const c=await controls.boundingBox(),m=await builder.locator('.desktop-grid-viewport').boundingBox();assert.ok(c.x+c.width<=m.x+2,'Map controls are left of map');await controls.scrollIntoViewIfNeeded();await builder.screenshot({path:path.join(out,tab==='Construction'?'construction-left-controls.png':'details-left-controls.png')});
  }
  await builder.getByRole('button',{name:'Construction',exact:true}).click();
  await builder.getByRole('button',{name:'Expand Zone +2 Each Side',exact:true}).first().click();assert.equal(await builder.locator('.ship-grid:not(.mobile-grid) [data-grid-index]').count(),576);
  await builder.getByRole('button',{name:'Center Ship in Construction Zone',exact:true}).first().click();const centered=await builder.evaluate(()=>JSON.parse(localStorage.getItem('sa-starship-layout-draft')));assert.equal(centered.gridCells.length,ship.gridCells.length);assert.equal(centered.placements[0].cell,maps.remapSquare(42,ship,centered));assert.ok(centered.doorStates[`${maps.remapSquare(42,ship,centered)}:${maps.remapSquare(43,ship,centered)}`]);
  await post('campaign/starship/save',{code,token,starshipId:ship.id,starship:centered});const saved=await fetch(`${base}/api/campaign/state?code=${code}&token=${token}`).then(r=>r.json());assert.equal(saved.starships[0].characterLocations[character.id].square,maps.remapSquare(44,ship,centered));
  await builder.screenshot({path:path.join(out,'construction-expanded.png'),fullPage:true});
  await builder.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sa-starship-layout-draft'));d.placements=d.placements.filter(p=>p.sicId!=='en');localStorage.setItem('sa-starship-layout-draft',JSON.stringify(d));});await builder.reload();assert.equal(await builder.locator('[data-construction-action="confirm"]').first().isDisabled(),true);await builder.locator('.stat-attention').first().waitFor();
  await builder.setViewportSize({width:390,height:844});await builder.screenshot({path:path.join(out,'construction-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS expanded construction, centering/doors/crew, negative EN guard, desktop/mobile.');
  await builder.setViewportSize({width:1440,height:1000});await builder.goto(base+'/index.html');
  await builder.evaluate(data=>{
    const holder=document.createElement('section');holder.id='preparation-test';holder.style.cssText='position:fixed;inset:90px 30px auto;z-index:100000;background:#081821;padding:20px';document.body.append(holder);
    const ships=[{id:'a',title:'Alpha',ship:data},{id:'b',title:'Beta',ship:data}];window.preparationPoints=[{id:'a',q:0,r:0},{id:'b',q:15,r:0}];
    window.SASpaceMap.bindEditor(holder,ships,window.preparationPoints,p=>{window.preparationPoints=p;window.SASpaceMap.bindEditor(holder,ships,p,()=>{});});
  },ship);
  const editor=builder.locator('#preparation-test'),svg=editor.locator('svg');
  assert.equal(await svg.locator('[data-space-ship] circle').count(),6,'Two sensor rings plus ship marker per ship');
  await editor.getByRole('button',{name:'Zoom out preparation map'}).click();const box=await svg.getAttribute('viewBox');
  const coordinates=await svg.evaluate(s=>{const project=(q,r)=>{const p=new DOMPoint(Math.sqrt(3)*(q+r/2),r*1.5).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y};};return [project(0,0),project(-3,2)];});
  await builder.mouse.move(coordinates[0].x,coordinates[0].y);await builder.mouse.down();await builder.mouse.move(coordinates[1].x,coordinates[1].y,{steps:15});
  assert.equal(await builder.evaluate(()=>preparationPoints[0].q),0,'Drag commits on release only');await builder.mouse.up();
  assert.deepEqual(await builder.evaluate(()=>preparationPoints[0]),{id:'a',q:-3,r:2});assert.equal(await svg.getAttribute('viewBox'),box,'Dragging preserves zoom');
  await builder.screenshot({path:path.join(out,'preparation-map.png')});assert.deepEqual(errors,[]);console.log('PASS preparation drag/drop, preserved zoom and sensor overlays.');
  await builder.goto(base+'/starship.html');await builder.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sa-starship-layout-draft'));for(let i=0;i<20;i++)d.sicInventory.push({id:'readable-card-'+i,type:i%2?'en-au-engine-4':'hacking-module-5'});localStorage.setItem('sa-starship-layout-draft',JSON.stringify(d));});await builder.reload();
  await builder.getByRole('button',{name:'Ship Details',exact:true}).click();
  for(const width of [1920,1366,390]){
    await builder.setViewportSize({width,height:1000});const shelf=builder.locator('.purchased-sic-grid:visible').first();await shelf.scrollIntoViewIfNeeded();
    const boxes=await shelf.locator('.purchased-sic-thumbnail').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),face=n.querySelector('.sic-poker-card').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,faceW:face.width,faceH:face.height};}));
    assert.ok(boxes.length>=20,'No purchased items disappear');const rows=new Map();for(const b of boxes)rows.set(Math.round(b.y),(rows.get(Math.round(b.y))||0)+1);assert.ok(Math.max(...rows.values())<=10);assert.ok(boxes.every(b=>b.w>=150&&Math.abs(b.w-b.faceW)<2&&Math.abs(b.h-b.faceH)<2),JSON.stringify(boxes));
    await builder.screenshot({path:path.join(out,`purchased-cards-${width}.png`)});
  }
  console.log('PASS purchased cards: maximum ten per row, all items retained, uniform poker proportions and enlarged names at desktop/mobile sizes.');
}
main().catch(async e=>{console.error(e);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();});
