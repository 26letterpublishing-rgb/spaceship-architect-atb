const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/zombi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {startFixture}=require('../tests/melee-adjacency-http.test');
const out=path.resolve('../SA-ATB Local Development Files/outputs/hierarchy-placement-nov02');fs.mkdirSync(out,{recursive:true});
(async()=>{let f,b;const results=[];try{
 f=await startFixture();const s=await f.post('/api/campaign/showcase/start',{}),read=()=>fetch(f.base+'/api/campaign/state?code='+s.code+'&token='+s.gmToken).then(r=>r.json());
 let state=await read();const original=structuredClone(state.starships[0].ship),party=structuredClone(state.starmaps.party);
 const map=state.starmaps.maps.find(m=>m.stars.some(st=>Object.keys(st.surfaces||{}).length)),star=map.stars.find(st=>Object.keys(st.surfaces||{}).length),planet=star.system.find(o=>star.surfaces?.[o.id]),regionId=Object.keys(star.surfaces[planet.id].regions)[0];assert.ok(regionId);
 b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1366,height:768}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(f.base+'/');await p.evaluate(s=>sessionStorage.setItem('sa-gm-token-'+s.code,s.gmToken),s);await p.goto(f.base+'/gm.html?campaign='+s.code);
 const browse=async level=>{await p.evaluate(({level,mapId,starId,planetId})=>{const c=SACampaignNavigationUI.context(),m=c.data.maps.find(m=>m.id===mapId),st=m.stars.find(st=>st.id===starId),pl=st.system.find(o=>o.id===planetId);if(level==='system')SACampaignNavigationUI.open(c,m,st);else SACampaignNavigationUI.openPlanet(c,m,st,pl);},{level,mapId:map.id,starId:star.id,planetId:planet.id});if(level==='galaxy')await p.locator('[data-nav-level=galaxy]').click();if(level==='region'){await p.locator('[data-hex="'+regionId+'"]').focus();await p.keyboard.press('Enter');await p.getByRole('button',{name:/Enlarge Region/}).click();}};
 for(const level of ['galaxy','system','surface','region']){
  const source={...structuredClone(original),id:'qa-'+level,title:'Imported '+level+' QA',confirmedOnce:true};
  await p.locator('[data-tab=starships]').click();await p.locator('#campaignStarshipFile').setInputFiles({name:level+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'spaceship-architect-2e-starship',starship:source}))});await p.getByRole('dialog').getByRole('button',{name:'Load Starship',exact:true}).click();
  let ship;for(let i=0;i<50;i++){state=await read();ship=state.starships.find(x=>x.title===source.title);if(ship)break;await p.waitForTimeout(100);}assert.ok(ship);assert.ok(!state.starmaps.positions[ship.id]);
  await p.locator('[data-tab=campaign]').click();await p.waitForFunction(()=>SACampaignNavigationUI.context()?.state);await browse(level);
  const header=await p.locator('[data-galaxy-host] h2').textContent();await p.getByLabel('Unplaced ship',{exact:true}).selectOption(ship.id);await p.getByRole('button',{name:'Place Ship',exact:true}).click();assert.equal(await p.locator('[data-galaxy-host] h2').textContent(),header,'Placement retains zoom '+level);
  if(level!=='galaxy'){await p.getByRole('button',{name:'Cancel Ship Placement',exact:true}).click();assert.ok(!(await read()).starmaps.positions[ship.id]);await p.getByRole('button',{name:'Place Ship',exact:true}).click();}
  if(level==='surface'||level==='region'){const hex=level==='surface'?'100':'82';await p.locator('[data-hex="'+hex+'"]').focus();await p.keyboard.press('Enter');}
  else{const svg=p.locator(level==='galaxy'?'.galaxy-map-surface svg':'[data-space-canvas]').first();await svg.click({position:{x:220,y:180}});}
  for(let i=0;i<50;i++){state=await read();if(state.starmaps.positions[ship.id])break;await p.waitForTimeout(100);}assert.ok(state.starmaps.positions[ship.id],'Placed at '+level);
  const position=structuredClone(state.starmaps.localPositions[ship.id]||state.starmaps.positions[ship.id]);
  if(level==='surface')assert.equal(position.surfaceHex,'100');if(level==='region'){assert.equal(position.regionId,regionId);assert.equal(position.regionHex,'82');await p.screenshot({path:path.join(out,'region-child-placed.png')});await p.locator('[data-nav-level=surface]').click();await p.locator('[data-surface-ship="'+ship.id+'"]').waitFor({state:'attached'});}
  assert.deepEqual(state.starmaps.party,party,'Placing does not move party');await p.screenshot({path:path.join(out,level+'-placed.png')});
  await p.reload();await p.locator('[data-tab=campaign]').click();state=await read();assert.deepEqual(state.starmaps.localPositions[ship.id]||state.starmaps.positions[ship.id],position);
  const saved=await fetch(f.base+'/api/campaign/backup?code='+s.code+'&token='+s.gmToken).then(r=>r.json());assert.deepEqual(saved.campaign.starships.find(x=>x.id===ship.id).ship.sicInventory,source.sicInventory);
  const denied=await fetch(f.base+'/api/campaign/v03/starmap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:s.code,token:s.players[0].token,kind:'systemPosition',placementOnly:true,phase:'galaxy',shipId:ship.id,mapId:map.id,q:1,r:1,receipt:crypto.randomUUID()})});assert.equal(denied.ok,false);
  results.push({level,position,reload:true,inventoryPreserved:true,pcDenied:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({results,errors},null,2));
}finally{await b?.close();await f?.stop();}})().catch(e=>{console.error(e);process.exitCode=1});
