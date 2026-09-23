const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','missile-damage-recovery');fs.mkdirSync(out,{recursive:true});let server,browser,gm,pc;const errors=[];
async function main(){
 server=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-impact-recovery-'))},stdio:['ignore','pipe','pipe']});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),created=await post('campaign/create',{name:'Missile GM Recovery',gmCode:'gm-impact'}),code=created.campaign.code,token=created.token;
 await require('../tests/helpers/combat-demo.cjs')(base,demo);
 const backup=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());backup.campaign.code=code;backup.campaign.name='Missile GM Recovery';backup.campaign.showcase=false;
 const c=backup.campaign,room=c.encounter,own=room.starships.find(s=>s.title==='Wayfinder'),enemy=room.starships.find(s=>s.title==='Red Horizon'),person=c.characters[0],unit=room.units.find(u=>u.characterId===person.id);
 Object.assign(room,{hasEngagedClock:true,encounterEndedAt:null,running:false,hardPaused:true,activeId:null,pausedForTurn:false});for(const u of room.units){u.delayedAction=null;u.atb=0;u.speed=.01;}
 own.ship.missileState={flights:[{id:'gm-impact-recovery',name:'Missile 1',sourceId:own.id,targetId:enemy.id,unitId:unit.id,characterId:person.id,controller:'gm',phase:'impact',position:{q:10,r:0},age:12,speed:1,acceleration:1,masking:8,dice:2}],cooldowns:{},receipts:[]};
 await post('campaign/restore',{code,token,backup});const player=await post('campaign/character/unlock',{code,characterId:person.id,pcCode:person.pcCode});
 const state=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json()),before=(await state()).starships.find(s=>s.id===enemy.id).currentHullHp;
 browser=await chromium.launch({channel:'chrome',headless:true});const gc=await browser.newContext({viewport:{width:1366,height:768}}),cc=await browser.newContext({viewport:{width:1366,height:768}});
 await gc.addInitScript(({code,token})=>localStorage.setItem(`sa-gm-token-${code}`,token),{code,token});await cc.addInitScript(({code,id,token})=>localStorage.setItem(`sa-character-token-${code}-${id}`,token),{code,id:person.id,token:player.token});
 gm=await gc.newPage();pc=await cc.newPage();for(const p of [gm,pc])p.on('pageerror',e=>errors.push(e.stack));
 await gm.goto(`${base}/gm.html?campaign=${code}`);await pc.goto(`${base}/character.html?campaign=${code}&character=${person.id}`);await pc.getByRole('button',{name:'Combat',exact:true}).click();
 await gm.getByRole('dialog',{name:'Missile Damage',exact:true}).waitFor();assert.equal(await pc.getByRole('button',{name:'Roll 2D8 Damage',exact:true}).count(),0);
 let dialog=gm.getByRole('dialog',{name:'Missile Damage',exact:true});await dialog.frameLocator('iframe').getByRole('spinbutton',{name:'Manual Final Score',exact:true}).waitFor();
 await gm.reload();dialog=gm.getByRole('dialog',{name:'Missile Damage',exact:true});const dice=dialog.frameLocator('iframe');
 await dice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill('2');await dice.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();assert.equal(await dice.locator('#skillResultScore').innerText(),'10');assert.equal(await dice.locator('#cancelSkillCheck').isVisible(),false);assert.equal((await state()).rollPaused,true);assert.equal((await state()).starships.find(s=>s.id===enemy.id).currentHullHp,before);
 await gm.screenshot({path:path.join(out,'gm-confirmation.png')});await dice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await dialog.waitFor({state:'detached'});
 const after=await state();assert.equal(after.starships.find(s=>s.id===enemy.id).currentHullHp,before-10);assert.equal(after.rollPaused,false);assert.deepEqual(errors,[]);
 console.log('PASS independent GM-owned standard damage dice, player exclusion, reload recovery, one confirmation and automatic x5 Hull damage.');
}
main().catch(async e=>{console.error(e);process.exitCode=1;await gm?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}).finally(async()=>{await browser?.close();if(server?.exitCode===null){const done=once(server,'exit');server.kill();await done;}});
