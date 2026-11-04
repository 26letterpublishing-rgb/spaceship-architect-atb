const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.SA_NPC_EXERTION_OUT||'../SA-ATB Local Development Files/outputs/npc-exertion-nov01/browser');fs.mkdirSync(out,{recursive:true});
let h;const result={checks:[],errors:[]};
(async()=>{try{
  h=await require('./console-debug.cjs').startHarness({headless:true});const frame=()=>h.gm.frames().find(f=>f.url().includes('/index.html'));
  h.gm.setDefaultTimeout(12000);await h.gm.bringToFront();let s=await h.state();const pc=s.units.find(u=>u.characterId===h.fixture.characterId);
  await h.fixture.act({action:'addUnit',team:'npc',controlledBy:'gm',characterName:'Exertion Review NPC',mentalAttribute:5,physicalAttribute:4,speed:5,maximumHp:40,currentHp:40,location:{...pc.location,stationed:false,sicId:''}});
  s=await h.state();const npc=s.units.find(u=>u.characterName==='Exertion Review NPC'),id=npc.id;assert.equal(npc.exertionCurrent,4);
  await h.fixture.act({action:'completeTurn',id:pc.id});
  await h.gm.locator('.critical-flight-banner:not(.combat-waiting-notice)').waitFor({state:'detached',timeout:25000});
  const edit=()=>frame().locator(`[data-field="exertionCurrent"][data-id="${id}"]`).first();await edit().waitFor();
  h.gm.once('dialog',d=>d.accept('3'));await edit().click();await frame().waitForFunction(id=>SACombatBridge.state().units.find(u=>u.id===id)?.exertionCurrent===3,id);result.checks.push('GM actual current-value edit');
  for(const width of [1920,1366]){await h.gm.setViewportSize({width,height:width===1920?1080:768});await edit().scrollIntoViewIfNeeded();await h.gm.screenshot({path:path.join(out,'npc-exertion-'+width+'.png')});const bounds=await edit().boundingBox();assert.ok(bounds.width>30&&bounds.height>15);}
  await h.fixture.act({action:'nudge',id,amount:100});
  await h.fixture.act({action:'gmBeginNpcAttack',attackerId:id,defenderId:pc.id,distance:0,weaponName:'Unarmed',damageFormula:'1D4'});
  const attack=(await h.state()).attackResolution;assert.ok(attack);
  await h.fixture.act({action:'submitAttackRoll',id:pc.id,attackId:attack.id,rollRole:'defender',score:100,mode:'gm-manual'});
  const form=()=>frame().locator(`[data-gm-roll-form][data-unit-id="${id}"]`),spend=()=>form().locator('[data-gm-roll-exertion]');await spend().waitFor();
  await h.fixture.act({action:'setAutomation',id,mode:'npc'});await spend().waitFor({state:'detached'});assert.equal((await h.state()).units.find(u=>u.id===id).exertionCurrent,3);
  await h.fixture.act({action:'setAutomation',id,mode:'off'});await spend().waitFor();await spend().fill('1');await h.gm.screenshot({path:path.join(out,'npc-exertion-roll.png')});
  await form().getByRole('button',{name:'Roll for NPC',exact:true}).click();
  await frame().waitForFunction(id=>SACombatBridge.state().units.find(u=>u.id===id)?.exertionCurrent===2,id,{timeout:45000});
  result.checks.push('real animated NPC check spends once','automation on/off hides/restores spending without refill');
  await h.gm.reload();await h.gm.getByRole('button',{name:'Combat',exact:true}).click();const resume=h.gm.getByRole('button',{name:'Resume Encounter',exact:true});if(await resume.isVisible())await resume.click();
  await frame().waitForFunction(id=>SACombatBridge.state()?.units.find(u=>u.id===id)?.exertionCurrent===2,id);await edit().waitFor();result.checks.push('GM reload keeps spent balance');
  assert.equal(await h.pc.locator('[data-field="exertionCurrent"]').count(),0);result.errors=h.errors;assert.deepEqual(result.errors,[]);result.completed=true;
}catch(error){result.failure=error.stack;throw error;}finally{if(h)await h.stop();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(out);}})().catch(e=>{console.error(e);process.exitCode=1;});
