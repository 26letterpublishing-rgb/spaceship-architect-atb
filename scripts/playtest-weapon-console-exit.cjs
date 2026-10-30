const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'../SA-ATB Local Development Files/outputs/weapon-exit-oct26/browser');fs.mkdirSync(out,{recursive:true});
// Reuse the owned-server helper; extend only its disposable seed requests.
const seedModule=require('C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/scripts/fixtures/console-debug-sensors.cjs'),seed=seedModule.seed;
function addLock(ship){if(!ship.sicInventory.some(i=>i.id==='lk')){ship.sicInventory.find(i=>i.id==='cp').type='bridge-1';ship.sicInventory.push({id:'lk',type:'beam-laser-6'},{id:'wp',type:'warp-drive-1'});ship.placements.push({sicId:'wp',cell:100});ship.gridCells=ship.gridCells.filter(c=>c!==10&&c!==30);ship.placements.push({sicId:'lk',cell:10});}}
seedModule.seed=(post,...args)=>seed((route,body)=>{if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')addLock(body.starship);if(route==='action'&&body.action==='prepareEncounter'){addLock(body.starships.find(s=>s.id==='debug-ship').ship);body.shipPositions.find(p=>p.id==='debug-target').q=1;const enemy=body.starships.find(s=>s.id==='debug-target');if(enemy)enemy.ship.sicInventory.find(i=>i.id==='veil').type='lock-on-1';}return post(route,body);},...args);
const {startHarness}=require('C:/Users/zombi/Desktop/Spaceship Architect 2026 Sorting/sa-atb-multiplayer/scripts/console-debug.cjs');seedModule.seed=seed;
let h;const result={rows:[],zoom:'100%',deviceScaleFactor:1};
(async()=>{try{
 h=await startHarness({headless:true});await h.gm.close();let p=h.pc;
 const select=()=>p.getByRole('combobox',{name:'Station console',exact:true});
 for(const id of ['cp','life','wp','sn','lk']){
 await select().selectOption(id);
 const active=p.locator(`dialog[open][data-operator-id][data-sic-id="${id}"]`);await active.waitFor();assert.equal(await active.locator('[data-leave]').count(),0);
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
 await p.setViewportSize({width,height});
 for(let i=0;i<2;i++){const before=(await h.state()).units.map(u=>u.location);await active.locator('[data-console-view]').click();await active.waitFor({state:'hidden'});await p.locator('[data-console-view]').click();await active.waitFor();await active.locator('[data-console-view]').waitFor({state:'visible'});assert.deepEqual((await h.state()).units.map(u=>u.location),before);result.rows.push({id,width,height,cycle:i,exitReopen:true});}
 await active.locator('[data-console-view]').waitFor({state:'visible'});result.rows.push({id,width,height,exitBeforeCapture:await active.locator('[data-console-view]').evaluate(el=>({text:el.textContent,display:getComputedStyle(el).display,rect:el.getBoundingClientRect().toJSON(),parent:el.parentElement.className}))});await p.screenshot({path:path.join(out,`${id}-${width}.png`)});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
 }
 }
 for(const id of ['cp','life','wp','sn','lk']){
 await h.reset();p=h.pc;await h.gm.close();await select().selectOption(id);const active=p.locator(`dialog[open][data-operator-id][data-sic-id="${id}"]`);await active.waitFor();
 const state=await h.state(),unit=state.units.find(u=>u.characterId===h.fixture.characterId);
 await h.fixture.act({action:'shipMaintenance',id:unit.id,sicId:id,kind:'off',requestId:'exit-off-'+id});
 await active.locator('.console-compromised').waitFor({state:'visible'});
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){await p.setViewportSize({width,height});const before=(await h.state()).units.map(u=>u.location);await active.locator('[data-console-view]').click();await active.waitFor({state:'hidden'});await p.locator('[data-console-view]').click();await active.waitFor();await active.locator('.console-compromised').waitFor({state:'visible'});await active.locator('[data-console-view]').waitFor({state:'visible'});assert.deepEqual((await h.state()).units.map(u=>u.location),before);result.rows.push({id,width,height,offlineExitReopen:true});await p.screenshot({path:path.join(out,`${id}-offline-${width}.png`)});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));}
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
 }finally{await h?.stop();}})().catch(e=>{console.error(e);process.exitCode=1});
