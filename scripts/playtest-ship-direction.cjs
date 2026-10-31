const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-ship-direction-')),checks=[];
const seed=require('./fixtures/console-debug-sensors.cjs'),original=seed.seed;
seed.seed=(post,...args)=>original((route,body)=>{
  if(route==='campaign/starship/link')Object.assign(body.starship,{shipDirection:body.starship.id==='debug-ship'?90:270,shipRotation:body.starship.id==='debug-ship'?90:270,unifiedShipFacing:true});
  if(route==='action'&&body.action==='prepareEncounter')for(const s of body.starships)Object.assign(s.ship,{shipDirection:s.id==='debug-ship'?90:270,shipRotation:s.id==='debug-ship'?90:270,unifiedShipFacing:true});
  return post(route,body);
},...args);
let h;
async function main(){
  h=await require('./console-debug.cjs').startHarness({headless:true});
  const dismiss=h.gm.getByRole('button',{name:'Dismiss All hands on deck',exact:true});if(await dismiss.isVisible())await dismiss.click();
  const state=await h.state();assert.deepEqual(state.starships.map(s=>s.ship.shipDirection),[90,270]);assert.deepEqual(state.starships.map(s=>s.ship.shipRotation),[90,270]);assert.ok(state.starships.every(s=>s.ship.unifiedShipFacing));checks.push('real server normalization preserves direction');
  const p=await h.gm.context().newPage(),base=new URL(h.gm.url()).origin;
  p.setDefaultTimeout(10000);await p.goto(base+'/starship.html?new=1');await p.locator('[data-ship-direction]').first().waitFor({state:'attached'});
  assert.equal(await p.locator('[data-ship-direction]').first().inputValue(),'0');
  assert.equal(await p.getByRole('combobox',{name:'All weapons direction',exact:true}).count(),0);
  assert.equal(await p.getByRole('combobox',{name:'All thrusters direction',exact:true}).count(),0);
  await p.evaluate(()=>{draft.gridCells=[42,43,62,63,82,83,84];draft.sicInventory=[{id:'c',type:'science-lab',rotation:0}];draft.placements=[{sicId:'c',cell:42}];saveDraft();renderAll();});
  await p.reload();
  const shape=await p.evaluate(()=>JSON.stringify([draft.gridCells,draft.placements,draft.sicInventory]));
  if(process.env.SA_TOOLBAR_ONLY==='1'){
    for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
      await p.setViewportSize({width,height});await p.locator('[data-starship-tab="sheet"]').click();
      const toolbar=p.locator('.desktop-grid-toolbar');await toolbar.scrollIntoViewIfNeeded();
      const normal=await toolbar.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,scroll:el.scrollWidth,client:el.clientWidth,controls:[...el.querySelectorAll('button,label,output')].map(n=>{const b=n.getBoundingClientRect();return {text:n.textContent,left:b.left,right:b.right,y:b.y+b.height/2};})};});
      await toolbar.screenshot({path:path.join(out,`toolbar-normal-${width}.png`)});
      checks.push({normalToolbar:width,bounds:normal});assert.ok(normal.controls.every(c=>c.left>=normal.left&&c.right<=normal.right),JSON.stringify(normal));assert.ok(normal.scroll<=normal.client,JSON.stringify(normal));assert.ok(Math.max(...normal.controls.map(c=>c.y))-Math.min(...normal.controls.map(c=>c.y))<2,JSON.stringify(normal));
      assert.equal(await p.locator('.construction-summary .construction-zone-controls').count(),0);assert.equal(await p.locator('[data-ship-direction]').count(),1);
      await p.getByRole('button',{name:'Enlarge ship interior',exact:true}).filter({visible:true}).click();
      const dialog=p.getByRole('dialog',{name:'Enlarged starship interior',exact:true});await dialog.waitFor();
      const select=dialog.getByRole('combobox',{name:'Ship Direction',exact:true});await select.selectOption('90');
      const pose=await p.evaluate(()=>draft.shipRotation);await dialog.locator('[data-rotate-ship]').click();
      assert.equal(await select.inputValue(),'180');assert.equal(await p.evaluate(()=>draft.shipRotation),(pose+90)%360);
      const bounds=await dialog.locator('.interior-header nav').evaluate(el=>{const n=el.getBoundingClientRect();return {left:n.left,right:n.right,width:innerWidth,children:[...el.children].map(c=>{const r=c.getBoundingClientRect();return {y:r.y+r.height/2,left:r.left,right:r.right};})};});
      assert.ok(bounds.left>=0&&bounds.right<=width,JSON.stringify(bounds));assert.ok(Math.max(...bounds.children.map(c=>c.y))-Math.min(...bounds.children.map(c=>c.y))<2,JSON.stringify(bounds));
      await dialog.getByRole('button',{name:'Fit Ship',exact:true}).click();await p.waitForFunction(()=>{const g=enlargedShipInterior.grid,m=new DOMMatrix(getComputedStyle(g).transform);return Math.abs(((Math.atan2(m.b,m.a)*180/Math.PI+360)%360)-draft.shipRotation)<.01;});await p.screenshot({path:path.join(out,`toolbar-enlarged-${width}.png`)});
      await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
      assert.equal(await p.locator('[data-ship-direction]').count(),1);assert.equal(await p.locator('[data-rotate-ship]').count(),1);assert.equal(await p.locator('[data-ship-direction]').inputValue(),'180');
      assert.equal(await p.evaluate(()=>JSON.stringify([draft.gridCells,draft.placements,draft.sicInventory])),shape);
      checks.push({enlargedToolbar:width,bounds,reparented:true,synchronized:true});
    }
    await p.getByRole('button',{name:'Expand Zone +2 Each Side',exact:true}).click();assert.equal(await p.evaluate(()=>SAShipMap.gridColumns(draft)),24);
    await p.locator('[data-construction-action="undo"]').filter({visible:true}).first().click();assert.equal(await p.evaluate(()=>SAShipMap.gridColumns(draft)),20);
    await p.getByRole('button',{name:'Center Ship in Construction Zone',exact:true}).click();await p.locator('[data-construction-action="undo"]').filter({visible:true}).first().click();
    const triangle=p.getByRole('checkbox',{name:'Triangle Hull - 300 credits',exact:true});await triangle.check();assert.ok(await p.evaluate(()=>triangleHullMode));await triangle.uncheck();assert.equal(await p.evaluate(()=>triangleHullMode),false);
    await p.locator('.desktop-grid-toolbar [data-grid-zoom="in"]').click();await p.locator('.desktop-grid-toolbar [data-grid-zoom="fit"]').click();
    checks.push('compact Expand/Center/Undo/Triangle/Zoom/Fit actions retained');
    await p.reload();assert.equal(await p.evaluate(()=>draft.shipDirection),180);
    await p.locator('[data-starship-tab="sheet"]').click();await p.evaluate(()=>document.body.classList.add('ship-details-view'));
    await p.getByRole('button',{name:'Enlarge ship interior',exact:true}).filter({visible:true}).click();
    const readonly=p.getByRole('dialog',{name:'Enlarged starship interior',exact:true});await readonly.waitFor();assert.equal(await readonly.locator('.interior-header [data-ship-direction],.interior-header [data-rotate-ship]').count(),0);assert.equal(await readonly.locator('[data-ship-direction],[data-rotate-ship]').filter({visible:true}).count(),0);await readonly.press('Escape');
    checks.push('read-only details view exposes no construction direction controls');await p.close();return;
  }
  for(const facing of ['90','180','270','0']){
    await p.locator('[data-starship-tab="sheet"]').click();
    await p.getByRole('combobox',{name:'Ship Direction',exact:true}).first().selectOption(facing);
    assert.equal(await p.evaluate(()=>JSON.stringify([draft.gridCells,draft.placements,draft.sicInventory])),shape);
    await p.reload();assert.equal(await p.evaluate(()=>draft.shipDirection),Number(facing));assert.equal(await p.evaluate(()=>draft.shipRotation),0);
    await p.locator('[data-starship-tab="sheet"]').click();
    assert.equal(await p.evaluate(()=>{const g=shipGrids.find(g=>g.getClientRects().length),m=new DOMMatrix(getComputedStyle(g).transform);return Math.round(Math.atan2(m.b,m.a)*180/Math.PI);}),0,'direction must not rotate assembly');
  }
  checks.push('builder four direction values persist without rotating assembly or moving placements');
  await p.locator('[data-starship-tab="sheet"]').click();
  const initialRotation=await p.evaluate(()=>draft.shipRotation);
  for(let i=1;i<=4;i++){
    await p.locator('[data-rotate-ship]').first().click();
    assert.equal(await p.evaluate(()=>draft.shipRotation),(initialRotation+i*90)%360);
    assert.equal(await p.evaluate(()=>draft.shipDirection),(initialRotation+i*90)%360);
    assert.equal(await p.evaluate(()=>JSON.stringify([draft.gridCells,draft.placements,draft.sicInventory])),shape);
    await p.waitForFunction(()=>{const g=shipGrids.find(g=>g.getClientRects().length),m=new DOMMatrix(getComputedStyle(g).transform),angle=(Math.round(Math.atan2(m.b,m.a)*180/Math.PI)+360)%360;return angle===draft.shipRotation;});
    const upright=await p.evaluate(()=>{const grid=shipGrids.find(g=>g.getClientRects().length),label=grid.querySelector('.sic-grid-label'),m=new DOMMatrix(getComputedStyle(grid).transform).multiply(new DOMMatrix(getComputedStyle(label).transform));return {angle:Math.atan2(m.b,m.a)*180/Math.PI,text:label.textContent};});
    assert.ok(Math.abs(upright.angle)<.01,JSON.stringify(upright));
    assert.ok(await p.evaluate(()=>{const g=shipGrids.find(g=>g.getClientRects().length),m=new DOMMatrix(getComputedStyle(g).transform);return [...g.querySelectorAll('.sa-room-oxygen,.sa-reboot-status')].every(l=>{const t=m.multiply(new DOMMatrix(getComputedStyle(l).transform));return Math.abs(Math.atan2(t.b,t.a))<.001;});}),'status labels upright');checks.push({builderLabel:upright});
    const geometry=await p.evaluate(()=>{const grid=shipGrids.find(g=>g.getClientRects().length),a=grid.querySelector('[data-grid-index="42"]').getBoundingClientRect(),b=grid.querySelector('[data-grid-index="83"]').getBoundingClientRect();return {w:Math.max(a.right,b.right)-Math.min(a.left,b.left),h:Math.max(a.bottom,b.bottom)-Math.min(a.top,b.top)};});
    assert.ok(Math.abs(geometry.w/geometry.h-(i%2?3/2:2/3))<.04,JSON.stringify(geometry));
    await p.screenshot({path:path.join(out,`builder-turn-${i}.png`)});
    await p.locator('.desktop-grid-viewport').filter({visible:true}).first().screenshot({path:path.join(out,`builder-grid-turn-${i}.png`)});
    await p.evaluate(()=>{mapView.highResolution=true;renderAll();});
    await p.locator('.desktop-grid-viewport').filter({visible:true}).first().screenshot({path:path.join(out,`builder-art-turn-${i}.png`)});
    await p.evaluate(()=>{mapView.highResolution=false;renderAll();});
    await p.locator('.desktop-grid-viewport [data-grid-index="44"]').click();
    assert.ok(await p.evaluate(()=>draft.gridCells.includes(44)),'rotated builder pointer selects canonical square 44');
    await p.locator('[data-construction-action="undo"]').filter({visible:true}).first().click();
    assert.equal(await p.evaluate(()=>JSON.stringify([draft.gridCells,draft.placements,draft.sicInventory])),shape);
    assert.equal(await p.evaluate(()=>draft.shipRotation),(initialRotation+i*90)%360);

  }
  await p.reload();assert.equal(await p.evaluate(()=>draft.shipRotation),initialRotation);checks.push('four rigid turns restore rectangular footprint, coordinates and facing');
  await p.locator('[data-starship-tab="sheet"]').click();await p.locator('[data-rotate-ship]').first().click();
  const downloadPromise=p.waitForEvent('download');await p.evaluate(()=>{draft.confirmedOnce=true;draft.confirmed=constructionState(draft);exportStarship();});
  const download=await downloadPromise;const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.starship.shipDirection,90);assert.equal(exported.starship.shipRotation,90);
  await p.evaluate(async payload=>{await importStarship(new File([JSON.stringify(payload)],'fixture.sa2ship'));},exported);
  assert.equal(await p.evaluate(()=>draft.shipDirection),90);assert.equal(await p.evaluate(()=>draft.shipRotation),90);
  delete exported.starship.shipDirection;delete exported.starship.shipRotation;delete exported.starship.unifiedShipFacing;exported.starship.thrusterDirection=270;
  await p.evaluate(async payload=>{await importStarship(new File([JSON.stringify(payload)],'legacy.sa2ship'));},exported);
  assert.equal(await p.evaluate(()=>draft.shipDirection),null);assert.equal(await p.evaluate(()=>SAShipMap.shipDirection(draft)),270);
  checks.push('actual portable export/import and legacy import preserve direction compatibility');
  await p.screenshot({path:path.join(out,'builder.png')});await p.close();if(process.env.SA_DIRECTION_BUILDER_ONLY==='1')return;
  await h.pc.getByRole('button',{name:'Exit Console',exact:true}).click();
  // Finish the fixture's ready turn normally so its action dialog does not cover map controls.
  await h.fixture.act({action:'completeTurn',id:state.units.find(u=>u.characterId===h.fixture.characterId).id});
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
    await h.gm.setViewportSize({width,height});await h.gm.bringToFront();
    const f=h.gm.frames().find(f=>f.url().includes('index.html'))||h.gm.frames().find(f=>f!==h.gm.mainFrame());
    await f.locator('.inline-map-orientation').first().waitFor();
    const hosts=f.locator('.ship-combat-lane [data-inline-ship-map]');assert.equal(await hosts.count(),2);
    for(let i=0;i<2;i++){
      const host=hosts.nth(i);await host.getByRole('button',{name:'Fit Ship',exact:true}).click();
      const m=await host.evaluate(el=>{const g=el.querySelector('.inline-combat-map-grid'),w=g.parentElement,v=el.querySelector('.inline-map-viewport'),r=g.getBoundingClientRect(),b=w.getBoundingClientRect();return {rotation:Number(g.dataset.displayRotation),width:r.width,height:r.height,boxWidth:b.width,boxHeight:b.height,vw:v.clientWidth,vh:v.clientHeight};});
      assert.equal(m.rotation,i?270:90);assert.ok(Math.abs(m.width-m.boxWidth)<1&&Math.abs(m.height-m.boxHeight)<1,JSON.stringify(m));assert.ok(m.width<=m.vw&&m.height<=m.vh,JSON.stringify(m));
      const labels=await host.evaluate(el=>{const g=el.querySelector('.inline-combat-map-grid'),m=new DOMMatrix(getComputedStyle(g).transform);return [...g.querySelectorAll('.combat-map-label,.sa-room-oxygen,.sa-reboot-status')].map(l=>{const t=m.multiply(new DOMMatrix(getComputedStyle(l).transform));return {text:l.textContent,angle:Math.atan2(t.b,t.a)*180/Math.PI};});});
      assert.ok(labels.length);assert.ok(labels.every(l=>Math.abs(l.angle)<.01),JSON.stringify(labels));checks.push({combatLabels:labels});
      // Native transformed hit testing must resolve the original canonical cell.
      const button=host.locator('[data-map-square]').filter({visible:true}).first();
      const hit=await button.evaluate(b=>{const r=b.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {expected:b.dataset.mapSquare,actual:at?.closest('[data-map-square]')?.dataset.mapSquare};});
      assert.equal(hit.actual,hit.expected);checks.push({viewportWidth:width,ship:i,...m,hit});
      await host.locator('.inline-map-viewport').screenshot({path:path.join(out,`map-${width}-${i}.png`)});
      await host.getByRole('button',{name:'Zoom in interior',exact:true}).click();await host.getByRole('button',{name:'Fit Ship',exact:true}).click();
    }
    await h.gm.screenshot({path:path.join(out,`combat-${width}.png`)});
    await hosts.first().getByRole('button',{name:'Enlarge ship interior',exact:true}).click();
    const d=h.gm.locator('.expanded-interior-dialog[open]');await d.waitFor();assert.equal(await d.locator('[data-display-rotation]').getAttribute('data-display-rotation'),'90');
    await d.getByRole('button',{name:'Fit Ship',exact:true}).click();await h.gm.screenshot({path:path.join(out,`expanded-${width}.png`)});await d.press('Escape');await d.waitFor({state:'detached'});
  }
  const id=state.units.find(u=>u.characterId===h.fixture.characterId).id;
  await h.fixture.act({action:'nudge',id,amount:100});await h.pc.bringToFront();
  let pf;for(const frame of h.pc.frames())if(await frame.evaluate(()=>!!window.SACombatMap).catch(()=>false)){pf=frame;break;}
  assert.ok(pf);await pf.evaluate(id=>SACombatMap.openMove(SACombatBridge.state().units.find(u=>u.id===id)),id);
  const moving=pf.locator('[data-inline-ship-map="debug-ship"]');
  await moving.getByRole('button',{name:'Fit Ship',exact:true}).click();
  await moving.locator('[data-map-square="201"][data-map-mesh="4"]').click();
  const confirm=moving.locator('[data-inline-confirm-move]');assert.ok(await confirm.isEnabled());
  const responsePromise=h.pc.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.kind==='move');
  await confirm.click();const response=await responsePromise;assert.equal(response.status(),200);
  const route=response.request().postDataJSON().route;assert.equal(route.at(-1).square,201);assert.equal(route.at(-1).mesh,4);
  checks.push({actualPCMove:true,canonicalDestination:route.at(-1)});
  assert.deepEqual(h.errors,[]);
}
main().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack);console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));await h?.stop();console.log('Evidence: '+out);});
