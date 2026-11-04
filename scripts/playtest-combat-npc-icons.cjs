const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.SA_NPC_ICON_OUT||'../SA-ATB Local Development Files/outputs/combat-npc-icons-oct31');fs.mkdirSync(out,{recursive:true});let h;const results=[];
async function main(){
 h=await require('./console-debug.cjs').startHarness({headless:true});await h.gm.bringToFront();h.gm.setDefaultTimeout(12000);
 let f=h.gm.frames().find(f=>f.url().includes('/index.html'));await f.waitForFunction(()=>!!SACombatBridge.state(),null,{timeout:12000});
 await f.locator('#gmTeam').selectOption('npc');await f.locator('#gmCombatShip').selectOption('debug-ship');
 const add=async(name,speed,race,variant=0)=>{
  await f.locator('#gmCharacterName').fill(name);await f.locator('#gmSpeedRating').fill(String(speed));
  await f.locator('#gmAddUnit').click();const start=h.gm.getByRole('dialog',{name:'Starting location',exact:true});await start.locator('[data-start-square="40"]').click();
  const response=h.gm.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.action==='addUnit');await start.getByRole('button',{name:'Confirm starting location',exact:true}).click();const r=await response;assert.equal(r.status(),200);const sent=r.request().postDataJSON();assert.equal(sent.iconRace,race);assert.equal(sent.iconVariant,variant);
  await f.waitForFunction(({name,race})=>SACombatBridge.state().units.some(u=>u.characterName===name&&u.iconRace===race),{name,race},{timeout:12000});
  const unit=(await h.state()).units.find(u=>u.characterName===name);assert.equal(unit.iconRace,race);assert.equal(unit.iconVariant,variant);results.push({name,requestAndStateIcon:race,variant});
 };
 await add('Security Guard',5,'npc-security-guard');await add('Civilian',4,'npc-civilian');
 const template={id:'custom-icon-test',name:'Saved Icon Test',speed:5,maximumHp:30,moveSpeed:3,iconRace:'human',iconVariant:1,heldWeaponId:'unarmed'};
 const saved=await fetch(h.base+'/api/campaign/npc-templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:h.fixture.code,token:h.fixture.token,templates:[template]})});assert.equal(saved.status,200);
 const templateId=(await saved.json()).campaign.npcTemplates.find(n=>n.name===template.name).id;
 // The fixture saved through HTTP, outside the GM editor that normally consumes
 // its response. Reload to read the saved template through the normal startup.
 await h.gm.reload();await h.gm.getByRole('button',{name:'Combat',exact:true}).click();f=h.gm.frames().find(f=>f.url().includes('/index.html'));
 await f.locator('#gmNpcTemplate').selectOption(templateId);await f.locator('#gmCombatShip').selectOption('debug-ship');await add(template.name,5,'human',1);
 await h.gm.reload();await h.gm.getByRole('button',{name:'Combat',exact:true}).click();const fresh=h.gm.frames().find(f=>f.url().includes('/index.html'));await fresh.waitForFunction(()=>SACombatBridge.state()?.units.some(u=>u.characterName==='Saved Icon Test'&&u.iconVariant===1),null,{timeout:12000});
 const markers=fresh.locator('[data-token-race="npc-security-guard"]');assert.ok(await markers.count()>0);await h.gm.screenshot({path:path.join(out,'gm-icons.png')});results.push({reloadRetainsIcons:true,renderedGuardAtlas:true});
}
main().catch(error=>{results.push({failure:error.stack});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await h?.stop();console.log(out);});
