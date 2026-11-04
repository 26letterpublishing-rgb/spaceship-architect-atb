const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('../SA-ATB Local Development Files/outputs/starmap-camera-nov02');fs.mkdirSync(out,{recursive:true});
if(process.env.SA_CAMERA_STAGE==='2'){
 const seedModule=require('./fixtures/console-debug-sensors.cjs'),seed=seedModule.seed;
 const add=ship=>{for(const [id,type,cell] of [['lk','lock-on-1',220],['gun','rapid-laser-1',280],['probe','probe-launcher',258],['hole','black-hole-gun',250]])if(!ship.sicInventory.some(i=>i.id===id)){ship.sicInventory.push({id,type});ship.placements.push({sicId:id,cell,...(id==='hole'?{exteriorCell:290}:{})});}};
 seedModule.seed=(post,...args)=>seed((route,body)=>{if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')add(body.starship);if(route==='action'&&body.action==='prepareEncounter')add(body.starships.find(s=>s.id==='debug-ship').ship);return post(route,body);},...args);
}
const box=locator=>locator.getAttribute('viewBox'),close=(a,b)=>{const x=a.split(' ').map(Number),y=b.split(' ').map(Number);assert.ok(x.every((v,i)=>Math.abs(v-y[i])<.02),a+' != '+b);};
(async()=>{let h;const evidence=[];try{
 h=await require('./console-debug.cjs').startHarness({headless:true});const p=h.pc;p.setDefaultTimeout(12000);await p.waitForTimeout(1500);
 if(process.env.SA_CAMERA_STAGE==='2'){
  for(const [id,selector] of [['cp','.ship-navigation-dialog'],['gun','.weapon-console'],['lk','.lock-console'],['probe','.probe-console:not(.black-hole-console)'],['hole','.black-hole-console']]){
   await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption(id);const view=p.locator(selector),svg=view.locator('[data-space-canvas]');await view.waitFor();await p.waitForTimeout(1300);
   const initial=await box(svg),frame=()=>p.frames().find(f=>f.url().includes('/index.html'));
   await frame().evaluate(sel=>{const svg=parent.document.querySelector(sel+' [data-space-canvas]');SASpaceMap.fitRendered(svg);},selector);close(initial,await box(svg));
   await p.screenshot({path:path.join(out,id+'-before.png')});const bounds=await svg.boundingBox();await p.mouse.move(bounds.x+bounds.width*.45,bounds.y+bounds.height*.3);await p.mouse.down();await p.mouse.move(bounds.x+bounds.width*.45+35,bounds.y+bounds.height*.3+15,{steps:4});await p.mouse.up();const manual=await box(svg);assert.notEqual(manual,initial);
   await p.waitForTimeout(500);close(manual,await box(svg));await p.screenshot({path:path.join(out,id+'-manual.png')});
   await h.openConsole();await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption(id);await view.waitFor();await p.waitForTimeout(1300);close(manual,await box(svg));
   if(id==='lk'){await view.getByRole('tab',{name:'Component',exact:true}).click();await view.getByRole('tab',{name:'Ship',exact:true}).click();close(manual,await box(svg));}
   if(id==='probe'){await view.locator('[data-auto-zoom]').click();const link=await box(svg);assert.notEqual(link,manual);await h.openConsole();await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption(id);await view.waitFor();await p.waitForTimeout(1000);close(link,await box(svg));}
   evidence.push({id,initial,manual,reload:true});
  }
  assert.deepEqual(h.errors,[]);return;
 }
 let svg=p.locator('.sensor-console [data-map] svg[data-space-canvas]');const first=await box(svg);await p.locator('.sensor-console [data-auto-zoom]').click();close(first,await box(svg));
 await p.locator('.sensor-console [data-zoom="in"]').click();const b=await svg.boundingBox();await p.mouse.move(b.x+b.width*.4,b.y+b.height*.25);await p.mouse.down();await p.mouse.move(b.x+b.width*.4+40,b.y+b.height*.25+20,{steps:4});await p.mouse.up();const manual=await box(svg);assert.notEqual(manual,first);
 await p.waitForTimeout(500);close(manual,await box(svg));await p.screenshot({path:path.join(out,'sensors-manual.png')});await h.openConsole();await p.waitForTimeout(1300);svg=p.locator('.sensor-console [data-map] svg[data-space-canvas]');close(manual,await box(svg));
 await p.locator('.sensor-console [data-auto-zoom]').click();const fit=await box(svg);assert.notEqual(fit,manual);await h.openConsole();await p.waitForTimeout(1300);close(fit,await box(p.locator('.sensor-console [data-map] svg[data-space-canvas]')));evidence.push({sensors:{first,manual,fit,reload:true}});
 await p.getByRole('button',{name:'Exit Console',exact:true}).click();const frame=p.frames().find(f=>f.url().includes('/index.html')),main=frame.locator('.combat-space-map svg[data-space-canvas]');await main.waitFor();
 const initial=await box(main);await frame.evaluate(()=>SASpaceMap.zoom(document.querySelector('.combat-space-map svg'),.7));const zoom=await box(main);assert.notEqual(initial,zoom);
 await frame.evaluate(()=>SASpaceMap.enlarge(document.querySelector('.combat-space-map .space-map')));const enlarged=p.locator('.space-map-dialog svg');await enlarged.waitFor();close(zoom,await box(enlarged));await p.locator('.space-map-dialog [data-map-zoom=".7"]').click();const expanded=await box(enlarged);await p.locator('.space-map-dialog').press('Escape');await frame.waitForFunction(value=>document.querySelector('.combat-space-map svg').getAttribute('viewBox')===value,expanded);close(expanded,await box(main));
 await frame.evaluate(()=>SASpaceMap.enlarge(document.querySelector('.combat-space-map .space-map')));await enlarged.waitFor();close(expanded,await box(enlarged));await p.screenshot({path:path.join(out,'combat-enlarged.png')});await p.locator('.space-map-dialog').press('Escape');
 evidence.push({combat:{initial,zoom,expanded,enlargedReopen:true}});
 await h.reset();await h.pc.waitForTimeout(1300);const fresh=await box(h.pc.locator('.sensor-console [data-map] svg'));close(first,fresh);evidence.push({newRoomResets:true});
 assert.deepEqual(h.errors,[]);
 }finally{fs.writeFileSync(path.join(out,'results-stage'+(process.env.SA_CAMERA_STAGE||'1')+'.json'),JSON.stringify({evidence,errors:h?.errors},null,2));await h?.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
