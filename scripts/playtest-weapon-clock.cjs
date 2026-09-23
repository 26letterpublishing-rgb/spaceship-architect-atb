const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','weapon-clock');
fs.mkdirSync(out,{recursive:true});
let child,browser,pc,gm;
async function main(){
  child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-weapon-clock-browser-'))},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),8000);child.on('error',reject);child.stdout.on('data',chunk=>{const url=String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});child.stderr.on('data',chunk=>process.stderr.write(chunk));});
  const post=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;};
  const room=await post('/api/campaign/showcase/start',{}),player=room.players.find(p=>p.name==='Nova Vale');
  const act=body=>post('/api/action',{roomCode:room.code,gmToken:room.gmToken,...body});
  const state=()=>fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  const ships=['a','b'].map(id=>({id,title:id==='a'?'Wayfinder':'Red Horizon',controlType:id==='a'?'pc':'gm',crewCharacterIds:id==='a'?[player.id]:[],ship:{id,title:id,confirmedOnce:true,
    gridCells:Array.from({length:80},(_,n)=>82+Math.floor(n/10)*20+n%10),sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-4'},{id:'lock',type:'lock-on-1'},
      {id:'ripple',type:'ripple-cannon-1',rotation:90},{id:'ion',type:'ion-pulse-cannon-1',rotation:90},
      {id:'au1',type:'au-engine-2'},{id:'au2',type:'au-engine-2'},{id:'au3',type:'au-engine-2'}],
    placements:[{sicId:'cp',cell:82},{sicId:'sn',cell:83},{sicId:'en',cell:164},{sicId:'lock',cell:84},{sicId:'ripple',cell:110},{sicId:'ion',cell:150},
      {sicId:'au1',cell:102},{sicId:'au2',cell:104},{sicId:'au3',cell:162}]}}));
  for(const ship of ships){await post('/api/campaign/starship/link',{code:room.code,token:room.gmToken,controlType:ship.controlType,starship:ship.ship});await post('/api/campaign/starship/crew',{code:room.code,token:room.gmToken,starshipId:ship.id,crewCharacterIds:ship.crewCharacterIds});}
  await act({action:'prepareEncounter',preparationId:'weapon-clock',mode:'starship',starships:ships,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:2,r:0}],units:[
    {characterId:player.id,characterName:'Nova Vale',team:'pc',speed:1,commandWindow:120,weaponSystemsSkill:6,dexterityDice:[10,8,6],location:{starshipId:'a',square:82,mesh:0,stationed:true}},
    {preparationUnitId:'slug',characterName:'Space Slug',team:'npc',speed:.1,location:{starshipId:'b',square:83,mesh:4}}]});
  const initial=await state(),nova=initial.units.find(u=>u.characterId===player.id),slug=initial.units.find(u=>u.team==='npc');
  browser=await chromium.launch({channel:process.env.SA_BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.on('page',p=>{p.on('pageerror',e=>errors.push(e.stack));p.on('dialog',d=>d.accept());});
  gm=await context.newPage();await gm.addInitScript(({code,token})=>sessionStorage.setItem(`sa-gm-token-${code}`,token),{code:room.code,token:room.gmToken});
  await gm.goto(`${base}/gm.html?campaign=${room.code}&showcase=1`);await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.getByRole('button',{name:'Resume Encounter',exact:true}).click();
  const gmCombat=gm.frameLocator('#atbFrame');
  await gmCombat.getByRole('button',{name:'Engage Clock',exact:true}).click();await act({action:'setHardPaused',paused:true});
  pc=await context.newPage();await pc.addInitScript(({code,player})=>sessionStorage.setItem(`sa-character-token-${code}-${player.id}`,player.token),{code:room.code,player});
  await pc.goto(`${base}/character.html?campaign=${room.code}&character=${player.id}&showcase=1`);await pc.getByRole('button',{name:'Combat',exact:true}).click();
  const pcCombat=pc.frameLocator('#playerAtbFrame');await pcCombat.locator('[data-space-ship]').first().waitFor();
  const waitUntil=async(predicate,label,timeout=12000)=>{const end=Date.now()+timeout;while(Date.now()<end){const s=await state();if(predicate(s))return s;await pc.waitForTimeout(100);}throw Error(label+': '+JSON.stringify(await state()));};
  async function ready(){
    await act({action:'setHardPaused',paused:true});
    const s=await state();assert.equal(s.units.find(u=>u.id===nova.id).delayedAction,null);
    await act({action:'nudge',id:nova.id,amount:100-s.units.find(u=>u.id===nova.id).atb});
  }
  async function roll(page,total){
    const dialog=page.getByRole('dialog',{name:'Ship action dice roll',exact:true});await dialog.waitFor();
    const dice=dialog.frameLocator('iframe');await dice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill(String(total));
    await dice.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await dice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await dialog.waitFor({state:'detached'});
  }
  async function fire(id,{locked=false,owner=pc}={}){
    await ready();
    const name=id==='ripple'?'Ripple Cannon 1':'Ion Pulse Cannon 1';
    if(owner===gm)await act({action:'weaponCommand',id:nova.id,sicId:id,targetId:'b',boosts:id==='ripple'?2:0,requestId:'gm-weapon-clock-'+Date.now()});
    else{
      await pcCombat.getByRole('button',{name:'Fire '+name,exact:true}).click();
      const consoleView=pc.locator('dialog[data-operator-id="'+nova.id+'"]').filter({has:pc.locator('[data-fire]')});
      await consoleView.waitFor();if(id==='ripple')await consoleView.locator('[data-boosts]').fill('2');
      await consoleView.locator('[data-fire]').click();
    }
    const order=(await state()).units.find(u=>u.id===nova.id).delayedAction;assert.ok(order.weaponOrder);
    assert.equal(Boolean(order.weaponOrder.locked),locked);
    if(!locked)await roll(owner,100);
    await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
    const waiting=await waitUntil(s=>s.units.find(u=>u.id===nova.id).delayedAction?.weaponDamage,'Weapon must finish on the natural clock');
    const damage=waiting.units.find(u=>u.id===nova.id).delayedAction;
    await owner.getByRole('dialog',{name:'Ship action dice roll',exact:true}).waitFor();
    const other=owner===pc?gm:pc;
    assert.equal(await other.getByRole('dialog',{name:'Ship action dice roll',exact:true}).count(),0,'Follow-up damage goes only to the acting side');
    await owner.screenshot({path:path.join(out,id+(locked?'-locked':'-unlocked')+(owner===gm?'-gm':'-pc')+'-damage.png')});
    const pausedAtb=waiting.units.map(u=>u.atb);await pc.waitForTimeout(400);
    assert.deepEqual((await state()).units.map(u=>u.atb),pausedAtb,'Dice freeze all ATB while the player decides damage');
    await roll(owner,damage.weaponDamage.count+(damage.weaponDamage.damageBonus||0));
    const after=await state();assert.equal(after.rollPaused,false);assert.equal(after.units.find(u=>u.id===nova.id).delayedAction,null);
    await waitUntil(s=>s.units.find(u=>u.id===slug.id).atb>after.units.find(u=>u.id===slug.id).atb,'Combat resumes without menu switching');
    await owner.getByRole('dialog',{name:'Starship combat animation',exact:true}).waitFor({state:'detached'});
    for(const p of [pc,gm]){const back=p.locator('dialog[data-operator-id] [data-close]');if(await back.isVisible())await back.click();}
    await pc.waitForTimeout(200);
    const consoleBack=pc.getByRole('button',{name:'Combat View',exact:true});if(await consoleBack.isVisible())await consoleBack.click();
    await act({action:'setHardPaused',paused:true});
    console.log(`PASS ${name}: ${locked?'locked':'unlocked'}, ${owner===gm?'GM':'PC'} rolls, live input, damage pause, normal ATB recovery.`);
  }
  await fire('ripple');
  await fire('ion');
  await ready();await act({action:'lockCommand',id:nova.id,sicId:'lock',targetId:'b',kind:'lock',requestId:'weapon-clock-lock'});await roll(gm,100);
  await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
  await waitUntil(s=>!s.units.find(u=>u.id===nova.id).delayedAction,'Lock must finish on the natural clock');
  await fire('ripple',{locked:true});
  await fire('ion',{locked:true,owner:gm});
  assert.deepEqual(errors,[]);
}
main().catch(async e=>{console.error(e);process.exitCode=1;for(const [name,p]of[['pc',pc],['gm',gm]])await p?.screenshot({path:path.join(out,'failure-'+name+'.png')}).catch(()=>{});})
 .finally(async()=>{await browser?.close();if(child&&child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
