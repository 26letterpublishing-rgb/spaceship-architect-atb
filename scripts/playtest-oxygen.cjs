const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const maps=require('../ship-map-core'),root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','oxygen');fs.mkdirSync(out,{recursive:true});
let child,browser,pc,gm;const errors=[];
async function main(){
  child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-oxygen-browser-'))},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});child.stderr.on('data',c=>process.stderr.write(c));});
  const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
  const start=await post('campaign/showcase/start',{}),template=await fetch(`${base}/api/campaign/backup?code=${start.code}&token=${start.gmToken}`).then(r=>r.json());
  const created=await post('campaign/create',{name:'Oxygen Browser',gmCode:'oxygen-test'}),code=created.campaign.code,token=created.token;
  template.campaign.code=code;template.campaign.name='Oxygen Browser';
  const nova=template.campaign.characters[0];nova.character.attributes.health=[3,1,-1,-1];nova.character.skills['Athletics']={tenths:25};
  await post('campaign/restore',{code,token,backup:template});
  const player={id:nova.id,...await post('campaign/character/unlock',{code,characterId:nova.id,pcCode:nova.pcCode})};
  const campaign=()=>fetch(`${base}/api/campaign/state?code=${code}&token=${token}`).then(r=>r.json()),backup=()=>fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json()),restore=backup=>post('campaign/restore',{code,token,backup});
  const ship=(await campaign()).starships.find(s=>s.crewCharacterIds.includes(player.id)),life=ship.ship.sicInventory.find(i=>i.type==='life-support');
  const station=[...maps.buildLayout(ship.ship).footprint].find(([,c])=>c.sicId===life.id&&c.stations.some(s=>s.x===c.column&&s.y===c.row)),spot=station[1].stations.find(s=>s.x===station[1].column&&s.y===station[1].row);
  await post('campaign/starship/move-character',{code,token,starshipId:ship.id,characterId:player.id,square:station[0],mesh:spot.mesh,stationed:true});
  browser=await chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'chrome',headless:true});
  const gc=await browser.newContext({viewport:{width:1366,height:768}}),cc=await browser.newContext({viewport:{width:1366,height:768}});
  await gc.addInitScript(({code,token})=>localStorage.setItem(`sa-gm-token-${code}`,token),{code,token});
  await cc.addInitScript(({code,player})=>localStorage.setItem(`sa-character-token-${code}-${player.id}`,player.token),{code,player});
  gm=await gc.newPage();pc=await cc.newPage();for(const page of [gm,pc]){page.on('pageerror',e=>errors.push(e.stack));page.on('dialog',d=>d.accept());}
  await gm.goto(`${base}/gm.html?campaign=${code}`);await pc.goto(`${base}/character.html?campaign=${code}&character=${player.id}`);
  await pc.getByRole('button',{name:'Starships',exact:true}).click();await pc.frameLocator('[data-player-ship-details]').getByRole('button',{name:'Toggle Console',exact:true}).click();
  let dialog=pc.getByRole('dialog',{name:'Life Support console',exact:true});await dialog.waitFor();await dialog.locator('[data-oxygen]').uncheck();
  await dialog.getByText('Life Support setting confirmed.',{exact:true}).waitFor();
  await pc.locator('.oxygen-panel:popover-open').waitFor();assert.match(await pc.locator('.oxygen-panel').innerText(),/Breath reserve 1:36/);
  await pc.waitForFunction(()=>{const e=document.querySelector('.oxygen-panel'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+20,r.y+20)===e||e.contains(document.elementFromPoint(r.x+20,r.y+20));},null,{timeout:5000});
  await gm.locator('.oxygen-panel:popover-open').waitFor();await pc.waitForTimeout(1300);assert.equal(await dialog.getByText(/Paused:.*Awaiting GM/).isVisible(),false);
  await pc.screenshot({path:path.join(out,'life-support-grace.png')});console.log('PASS actual oxygen switch, visible grace and personal breath timer over console, no out-of-combat ATB pause.');
  let saved=await backup();const data=saved.campaign.starships.find(s=>s.id===ship.id).ship.oxygenState;data.graceRemaining=0;data.crew[player.id].remaining=.05;await restore(saved);
  let roll=pc.getByRole('dialog',{name:'Oxygen resistance roll',exact:true});await roll.waitFor();let dice=roll.frameLocator('iframe');await dice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).waitFor();
  assert.equal(await dice.locator('body').evaluate(e=>e.classList.contains('damage-roll')),false);
  await dice.getByRole('button',{name:'Cancel',exact:true}).click();await roll.waitFor({state:'detached'});await pc.locator('[data-oxygen-roll]').click();await roll.waitFor();dice=roll.frameLocator('iframe');
  await dice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill('30');await dice.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await dice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});
  await pc.locator('.oxygen-panel').getByText(/Passed: 30 against 14/).waitFor();await gm.locator('.oxygen-panel').getByText(/Passed: 30 against 14/).waitFor();await pc.screenshot({path:path.join(out,'resistance-result.png')});
  saved=await backup();saved.campaign.starships.find(s=>s.id===ship.id).ship.oxygenState.crew[player.id].remaining=.05;await restore(saved);await roll.waitFor();
  await gm.locator('[data-oxygen-roll]').click();const gmRoll=gm.getByRole('dialog',{name:'Oxygen resistance roll',exact:true}),gmDice=gmRoll.frameLocator('iframe');
  await gmDice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill('0');await gmDice.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await gmDice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await gmRoll.waitFor({state:'detached'});await roll.waitFor({state:'detached'});
  await pc.locator('.oxygen-panel').getByText(/Failed: 0 against 18. Lost 5 HP/).waitFor();
  await dialog.locator('[data-oxygen]').check();await pc.locator('.oxygen-panel:popover-open').waitFor({state:'hidden'});await gm.locator('.oxygen-panel:popover-open').waitFor({state:'hidden'});
  console.log('PASS real manual Health/Endurance dice, cancel and reopen, explicit results, GM takeover closes PC request, oxygen restoration.');
  await dialog.getByRole('button',{name:'Close Console',exact:true}).click();
  // Move to the nutritional station through the authorized campaign endpoint.
  const nut=ship.ship.sicInventory.find(i=>i.type==='nutritional-supplement'),nutCell=[...maps.buildLayout(ship.ship).footprint].find(([,c])=>c.sicId===nut.id&&c.stations.some(s=>s.x===c.column&&s.y===c.row)),nutSpot=nutCell[1].stations.find(s=>s.x===nutCell[1].column&&s.y===nutCell[1].row);
  await post('campaign/starship/move-character',{code,token,starshipId:ship.id,characterId:player.id,square:nutCell[0],mesh:nutSpot.mesh,stationed:true});
  await pc.frameLocator('[data-player-ship-details]').getByRole('button',{name:'Toggle Console',exact:true}).click();dialog=pc.getByRole('dialog',{name:'Nut Supplement console',exact:true});await dialog.waitFor();
  const heights=[];for(const texture of ['Silky','Extra thick','Questionably chunky']){
    await dialog.getByRole('combobox',{name:'Texture',exact:true}).selectOption(texture);await dialog.getByRole('button',{name:'Dispense Paste',exact:true}).click();await dialog.getByRole('button',{name:'Eat paste',exact:true}).waitFor();
    heights.push((await dialog.locator('.nut-blob').boundingBox()).height);await pc.screenshot({path:path.join(out,`paste-${texture.split(' ')[0]}.png`)});
    await dialog.getByRole('button',{name:'Eat paste',exact:true}).click();await dialog.locator('[data-status]').getByText('Tastes like chicken',{exact:true}).waitFor();assert.equal(await dialog.locator('.nut-blob').isVisible(),false);assert.equal(await dialog.getAttribute('data-served'),'true','puddle remains after eating');
  }
  assert.ok(heights[1]>heights[0]);assert.notEqual(heights[1],heights[2]);console.log('PASS three visibly different paste textures, click-to-eat, persistent puddle and chicken message.');
  assert.deepEqual(errors,[]);
}
main().catch(async error=>{console.error(error,errors);console.error(await pc?.evaluate(()=>({ui:!!window.SAOxygenUI,updates:window.oxygenUpdates,panels:[...document.querySelectorAll('.oxygen-panel')].map(e=>({html:e.outerHTML,open:e.matches(':popover-open'),style:getComputedStyle(e).display,parent:e.parentElement.tagName,rect:e.getBoundingClientRect().toJSON(),over:document.elementFromPoint(e.getBoundingClientRect().x+20,e.getBoundingClientRect().y+20)?.outerHTML?.slice(0,150)}))})).catch(()=>null));await pc?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();});
