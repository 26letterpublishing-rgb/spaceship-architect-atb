const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.SA_FLEET_STATS_OUT||'../SA-ATB Local Development Files/outputs/fleet-shields-nov01');fs.mkdirSync(out,{recursive:true});let h;const results=[];
(async()=>{
 h=await require('./console-debug.cjs').startHarness({headless:true});const page=h.gm;
 // Open the real Starships tab; all writes remain in this harness's disposable room.
 await page.getByRole('button',{name:'Starships',exact:true}).click();
 const card=page.locator('.gm-starship-card').first();await card.waitFor({state:'visible'});
 const id=await card.getAttribute('data-starship-id'),maps=require('../ship-map-core');
 const ship=(await h.state()).starships.find(r=>r.id===id);assert.ok(ship,'Card matches owned fixture ship');
 const expected=maps.installedItems(ship).reduce((n,i)=>{const d=maps.definition(i.type);return n+(d.shield?d.shieldHp:0)},0);
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
  await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();
  const stats=await card.locator('.gm-starship-summary dl').evaluate(dl=>({labels:[...dl.querySelectorAll('dt')].map(e=>e.textContent),values:[...dl.querySelectorAll('dd')].map(e=>e.textContent),overflow:dl.scrollWidth>dl.clientWidth,tiles:[...dl.children].map(e=>({top:e.getBoundingClientRect().top,width:e.getBoundingClientRect().width,overflow:e.scrollWidth>e.clientWidth}))}));
  assert.deepEqual(stats.labels,['Hull','Shields','EN','AU','Crew']);assert.equal(Number(stats.values[1]),expected);assert.equal(stats.overflow,false);assert.ok(stats.tiles.every(t=>!t.overflow&&t.top===stats.tiles[0].top));
  assert.ok(await card.locator('[data-starship-control]').isVisible());assert.ok(await card.locator('[data-save-starship-crew]').isVisible());
  await card.screenshot({path:path.join(out,'fleet-shields-'+width+'.png')});results.push({width,height,...stats});
 }
 const control=card.locator('[data-starship-control]'),original=await control.inputValue();await control.selectOption(original==='pc'?'gm':'pc');await control.selectOption(original);assert.equal(await control.inputValue(),original);
 const crew=card.locator('[data-starship-crew]').first();if(await crew.count()){const checked=await crew.isChecked();await crew.setChecked(!checked);await crew.setChecked(checked);assert.equal(await crew.isChecked(),checked);}
 assert.deepEqual(h.errors,[]);
})().catch(e=>{results.push({failure:e.stack});process.exitCode=1}).finally(async()=>{await h?.stop();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));});
