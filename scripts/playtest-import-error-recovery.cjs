const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.SA_IMPORT_ERRORS_OUT||'../SA-ATB Local Development Files/outputs/import-error-recovery-nov03');fs.mkdirSync(out,{recursive:true});
const result={checks:[],errors:[]};let h;
function local(name,value){const file=path.join(out,name);fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));return file;}
const bad=local('Damaged.json','PRIVATE FILE CONTENT'),shop=local('Review.sa2shop',{format:'sa2shop',version:1,shop:{id:'review',name:'Import Review Shop',modifier:10}}),story=local('Wrong-Type.sa2story',{format:'sa2story',version:1,chapters:[]});
(async()=>{try{
 h=await require('./console-debug.cjs').startHarness({headless:true});const p=h.gm;p.setDefaultTimeout(15000);
 const backup=()=>fetch(`${h.base}/api/campaign/backup?code=${h.fixture.code}&token=${h.fixture.token}`).then(r=>r.json());
 const requests=[];p.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/content/load'))requests.push(r.postDataJSON());});
 async function choose(button,file,pointer=false){
  let click=()=>button.click();
  if(pointer){const pt=await button.evaluate(el=>{el.scrollIntoView({block:'center'});const b=el.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return {x,y,visible:b.width>0&&b.height>0&&el.contains(document.elementFromPoint(x,y))};});assert.ok(pt.visible,'picker button is unobscured');click=()=>p.mouse.click(pt.x,pt.y);}
  const [picker]=await Promise.all([p.waitForEvent('filechooser'),click()]);await picker.setFiles(file);
 }
 async function notice(){const d=p.getByRole('dialog',{name:'Saved content',exact:true});await d.waitFor();assert.ok(!(await d.innerText()).includes('PRIVATE'));return d;}
 async function close(d){await d.locator('.dialog-circle-close').click();await d.waitFor({state:'detached'});}
 async function badThenRetry(button,file,label){const before=requests.length;await choose(button,bad);const d=await notice();assert.match(await d.innerText(),/Could not read/);assert.equal(requests.length,before);await p.screenshot({path:path.join(out,label+'-error.png')});await close(d);await choose(button,file);}
 await p.locator('[data-tab="shop"]').click();const shopButton=p.locator('[data-load-shop]');
 await choose(shopButton,story);let d=await notice();assert.match(await d.innerText(),/Choose a Shop/);await close(d);assert.equal(requests.length,0);
 await badThenRetry(shopButton,shop,'shop');d=p.getByRole('dialog',{name:'Load Shop',exact:true});await close(d);assert.equal(requests.length,0,'review cancellation does not import');
 // Empty file selection is also silent. Native picker cancellation is covered by the unit test.
 const picker=p.waitForEvent('filechooser');await shopButton.click();await (await picker).setFiles([]);await p.waitForTimeout(100);assert.equal(await p.locator('dialog[open]').count(),0);
 await choose(shopButton,shop);await p.getByRole('dialog',{name:'Load Shop',exact:true}).getByRole('button',{name:'Confirm Load',exact:true}).click();await p.getByRole('heading',{name:'Import Review Shop',exact:true}).waitFor();
 let campaign=(await backup()).campaign;assert.equal(campaign.shops.list.filter(s=>s.name==='Import Review Shop').length,1);assert.equal(campaign.shops.list.find(s=>s.name==='Import Review Shop').active,false);result.checks.push('Shop wrong-type/malformed errors, silent cancellation and valid confirmed retry');
 await p.locator('[data-tab="script"]').click();const scriptShop=local('Script.sa2shop',{format:'sa2shop',version:1,shop:{id:'script-review',name:'Script Review Shop'}});
 await badThenRetry(p.locator('[data-load-script-shop]'),scriptShop,'script-shop');await p.getByRole('dialog',{name:'Load Shop',exact:true}).getByRole('button',{name:'Confirm Load',exact:true}).click();
 campaign=(await backup()).campaign;assert.equal(campaign.shops.list.find(s=>s.name==='Script Review Shop').scriptLoaded,true);result.checks.push('Script Shop caller retains scriptShop option after error/retry');
 await p.locator('[data-tab="characters"]').click();const roster=local('Roster.sa2roster',{format:'sa2roster',version:1,characters:[],npcs:[{id:'qa-import-npc',name:'Imported Review NPC',physicalAttribute:4,mentalAttribute:4,maximumHp:20,speed:3,iconRace:'npc-crab',iconVariant:0}]});
 await badThenRetry(p.locator('#loadCharacterRoster'),roster,'roster');await p.getByRole('dialog',{name:'Load NPC / Character Roster',exact:true}).getByRole('button',{name:'Confirm Load',exact:true}).click();await close(await notice());
 campaign=(await backup()).campaign;assert.equal(campaign.npcTemplates.filter(n=>n.name==='Imported Review NPC').length,1);result.checks.push('Characters roster caller imports one NPC after malformed-file retry');
 await p.locator('[data-tab="campaign"]').click();const galaxy=local('Galaxy.sa2galaxy',{format:'sa2-galaxy',version:1,map:{name:'Import Review Galaxy',lightYearsPerHex:3.31,stars:[{id:'review-star',name:'Review Star',q:0,r:0,system:[{id:'review-planet',kind:'planet',quantity:1,name:'Review Planet',q:3,r:0,size:'small'}],surfaces:{'review-planet':{gridVersion:2,size:'small',seed:'review',hexes:{},regions:{}}}}]}});
 await badThenRetry(p.getByRole('button',{name:'Load Galaxy Map',exact:true}),galaxy,'galaxy');await p.getByRole('dialog',{name:'Load Galaxy Map',exact:true}).getByRole('button',{name:'Confirm Load',exact:true}).click();await close(await notice());
 campaign=(await backup()).campaign;const map=campaign.starmaps.maps.find(m=>m.name==='Import Review Galaxy'),star=map.stars[0],planet=star.system.find(x=>x.kind==='planet');assert.ok(planet);result.checks.push('Galaxy caller imports valid map after error/retry');
 const ids={mapId:map.id,starId:star.id,planetId:planet.id};
 // Fixture navigation only: the Region file picker, retry, review and submission are actual clicks.
 await p.evaluate(ids=>{const c=SACampaignNavigationUI.context(),m=c.data.maps.find(m=>m.id===ids.mapId),s=m.stars.find(s=>s.id===ids.starId),planet=s.system.find(p=>p.id===ids.planetId);SACampaignNavigationUI.openPlanet(c,m,s,planet);},ids);
 await p.getByRole('button',{name:'Edit Locations',exact:true}).click();await p.locator('[data-hex="100"]').press('Enter');await p.getByRole('button',{name:'Edit Location Details',exact:true}).click();
 const region=local('Region.sa2region',{format:'sa2-region',version:1,region:{name:'Imported Review Region',hexes:{'1':{label:'Retry Landmark'}}}});
 await badThenRetry(p.getByRole('button',{name:'Load Region Here',exact:true}),region,'region');const regionDialog=p.getByRole('dialog',{name:'Load Region',exact:true}),regionConfirm=regionDialog.getByRole('button',{name:'Confirm Load',exact:true});await regionConfirm.click();await regionDialog.getByText('End the encounter before replacing maps.',{exact:true}).waitFor();await h.fixture.act({action:'exitEncounter'});await regionConfirm.click();await close(await notice());
 campaign=(await backup()).campaign;assert.equal(campaign.starmaps.maps.find(m=>m.id===ids.mapId).stars.find(s=>s.id===ids.starId).surfaces[ids.planetId].regions['100'].name,'Imported Review Region');result.checks.push('Region caller preserves exact parent target across nested error/retry');
 await p.reload();await p.locator('[data-tab="shop"]').click();await p.getByRole('heading',{name:'Import Review Shop',exact:true}).waitFor();await choose(p.locator('[data-load-shop]'),shop,true);d=p.getByRole('dialog',{name:'Previously loaded content',exact:true});await d.waitFor();await close(d);assert.equal((await backup()).campaign.shops.list.filter(s=>s.name==='Import Review Shop').length,1);result.checks.push('reload retains imported content and duplicate protection (real pointer click on continuously rerendered Shop button)');
 result.errors=h.errors;assert.deepEqual(result.errors,[]);result.completed=true;
}catch(e){result.failure=e.stack;if(h)await h.gm.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{if(h)await h.stop();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
