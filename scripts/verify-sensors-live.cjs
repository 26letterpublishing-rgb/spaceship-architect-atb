// Hosted smoke test creates only an isolated Explore Features room.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=process.env.SA_VERIFY_BASE||'https://spaceship-architect-atb.onrender.com',artifacts=path.join(root,'test-artifacts','sensors-live');
fs.mkdirSync(artifacts,{recursive:true});
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const scripts=['app.js','character.js','gm.js','combat-actions.js','combat-engine.js','ship-map-core.js','ship-combat-map.js','station-access.js','ship-sensors.js','sensor-console-ui.js','sensor-console-ui.css','ship-navigation-ui.js','ship-navigation.js','ship-shields.js','shield-console-ui.js','starship.js','starship.html','space-map.js','index.html'];
let browser;
async function main(){
  let deployed=false;
  for(let n=0;n<40;n++){
    try{
      deployed=true;
      for(const name of ['ship-sensors.js','sensor-console-ui.css']){
        const response=await fetch(base+'/'+name+'?release='+Date.now(),{signal:AbortSignal.timeout(20000)});
        deployed=deployed&&response.ok&&hash(Buffer.from(await response.arrayBuffer()))===hash(fs.readFileSync(path.join(root,name)));
      }
    }catch{deployed=false;}
    if(deployed)break;await new Promise(r=>setTimeout(r,15000));
  }
  assert.ok(deployed,'Render has not deployed the sensor release');
  for(const name of scripts){const response=await fetch(base+'/'+name+'?verify='+Date.now());assert.equal(response.status,200,name);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.join(root,name))),name);}
  const manifest=require('../sic-web-assets.json'),images=Object.keys(manifest).filter(n=>n.startsWith('sensors-')||n.startsWith('sensor-console-'));
  for(const name of images){const response=await fetch(base+'/'+name);assert.equal(response.status,200,name);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.join(root,manifest[name].file))),name);}
  console.log(`${scripts.length} code/style files and ${images.length} optimized images match Render.`);
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/starship.html');await page.getByRole('button',{name:'SICs',exact:true}).click();await page.locator('summary').filter({hasText:'Sensors'}).click();await page.getByRole('dialog',{name:'Sensors',exact:true}).waitFor();assert.equal(await page.locator('.sic-picker-slot').count(),9);await page.locator('.sic-picker-slot img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.waitForTimeout(900);await page.screenshot({path:path.join(artifacts,'live-sensor-cards.png')});
  const started=page.waitForResponse(r=>r.url().endsWith('/api/campaign/showcase/start'));await page.goto(base+'/showcase.html');const room=await(await started).json();
  const act=async body=>{const response=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomCode:room.code,gmToken:room.gmToken,...body})});const json=await response.json();assert.equal(response.status,200,JSON.stringify(json));return json;};
  const state=()=>fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  const gm=page.frameLocator('#showcaseFrame');await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();await gm.frameLocator('#atbFrame').getByRole('button',{name:'Engage Clock',exact:true}).click();await act({action:'setHardPaused',paused:true});
  const initial=await state();assert.equal(initial.starships.length,2);assert.equal(initial.starships[0].sensorState.contacts[initial.starships[1].id].level,'unknown');
  const unit=initial.units.find(u=>u.characterName==='Nova Vale'),ship=initial.starships.find(s=>s.id===unit.location.starshipId),cp=ship.ship.sicInventory.find(i=>i.type==='bridge-1'),placement=ship.ship.placements.find(p=>p.sicId===cp.id),sensor=ship.ship.sicInventory.find(i=>i.type==='sensors-3');
  if(initial.activeId)await act({action:'completeTurn',id:initial.activeId});
  await act({action:'setCombatLocation',id:unit.id,location:{starshipId:ship.id,square:placement.cell,mesh:0,stationed:true}});await act({action:'nudge',id:unit.id,amount:100});
  await page.getByRole('button',{name:'Nova Vale',exact:true}).click();await page.frameLocator('#showcaseFrame').getByRole('button',{name:'Combat',exact:true}).click();await page.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();await page.getByRole('combobox',{name:'Station console',exact:true}).selectOption(sensor.id);
  const consoleView=page.getByRole('dialog',{name:'Sensor console',exact:true});await consoleView.waitFor();assert.ok((await consoleView.locator('[data-map]').innerText()).includes('Unknown contact'));assert.ok(!(await consoleView.locator('[data-map]').innerText()).includes('Red Horizon'));
  await consoleView.locator('[data-q]').fill('10');await consoleView.locator('[data-r]').fill('0');await consoleView.getByRole('button',{name:'Scan Hex',exact:true}).click();await consoleView.locator('[data-turn]').filter({hasText:'SCANNING'}).waitFor();
  for(let i=0;i<12;i++){const s=await state();if(s.activeId)await act({action:'completeTurn',id:s.activeId});await act({action:'step'});}
  await consoleView.locator('[data-reports]').filter({hasText:'Hex scan complete'}).waitFor();await page.screenshot({path:path.join(artifacts,'live-sensor-console.png')});
  assert.deepEqual(errors,[]);console.log('Live Render cards, demo GM/PC switch, unknown contact and browser scan passed.');
}
main().catch(async error=>{console.error(error);process.exitCode=1;if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});}).finally(async()=>{if(browser)await browser.close();});
