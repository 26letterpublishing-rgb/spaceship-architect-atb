const {chromium}=require('playwright'),{spawn}=require('node:child_process'),{once}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','sic-expansion');fs.mkdirSync(out,{recursive:true});
let child,browser,pc;const errors=[];
async function main(){
 child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-sic-expansion-'))},stdio:['ignore','pipe','pipe']});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});child.stderr.on('data',c=>process.stderr.write(c));});
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),saved=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());
 const made=await post('campaign/create',{name:'SIC Expansion',gmCode:'sic-test'}),code=made.campaign.code,token=made.token;
 saved.campaign.code=code;saved.campaign.showcase=false;const person=saved.campaign.characters[0],ships=saved.campaign.starships,own=ships.find(s=>s.controlType==='pc'),enemy=ships.find(s=>s.id!==own.id);
 for(const s of ships){
  const specs=[['cp','cockpit-1',82],['sn','sensors-3',83],['en','en-au-engine-4',144],['backup','backup-generator',89],...(s===own?[1,2,3,4].map(t=>['ant'+t,'antenna-'+t,40+t*2]):[])];
  s.ship={...s.ship,gridCells:maps.rectangleCells({},82,8,7),sicInventory:specs.map(([id,type])=>({id,type,status:'installed'})),placements:specs.map(([sicId,type,cell])=>({sicId,cell})),doorStates:{},currentHullHp:56,maximumHullHp:56};
  Object.assign(s,{currentHullHp:56,maximumHullHp:56,currentShieldHp:0,maximumShieldHp:0});s.characterLocations={};assert.equal(maps.exteriorError(s.ship),'');
 }
 own.characterLocations[person.id]={square:82,mesh:0,stationed:true,sicId:'cp'};
 enemy.commandSystems={evasions:[{defense:20,remaining:1000}],preparations:[],calls:[],receipts:[]};
 for(const u of saved.campaign.encounter.units){const s=u.characterId===person.id?own:enemy;u.location={starshipId:s.id,square:82,mesh:0,stationed:true,sicId:'cp'};Object.assign(u,{sensorSkill:0,speed:.01,atb:0,delayedAction:null,timedAction:null});}
 saved.campaign.encounter={...saved.campaign.encounter,starships:ships,shipPositions:[{id:own.id,q:0,r:0},{id:enemy.id,q:5,r:0}],running:false,hardPaused:true,hasEngagedClock:true,encounterEndedAt:null,activeId:null,pausedForTurn:false};
 await post('campaign/restore',{code,token,backup:saved});const player=await post('campaign/character/unlock',{code,characterId:person.id,pcCode:person.pcCode});
 const act=body=>post('action',{roomCode:code,gmToken:token,...body}),state=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json()),unit=(await state()).units.find(u=>u.characterId===person.id);
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(({code,id,token})=>localStorage.setItem(`sa-character-token-${code}-${id}`,token),{code,id:person.id,token:player.token});pc=await context.newPage();pc.on('pageerror',e=>errors.push(e.stack));pc.on('dialog',d=>d.accept());
 await pc.goto(`${base}/character.html?campaign=${code}&character=${person.id}`);await pc.getByRole('button',{name:'Starships',exact:true}).click();const sheet=pc.frameLocator('[data-player-ship-details]');
 await sheet.locator('[data-sensor-range]').first().waitFor();assert.equal(await sheet.locator('[data-sensor-range]').first().textContent(),'22');assert.equal(await sheet.locator('[data-sensor-dice]').first().textContent(),'4D6 + 1D8 + 1D10 + 1D12');
 await pc.screenshot({path:path.join(out,'antenna-ship-sheet.png')});
 await pc.getByRole('button',{name:'Combat',exact:true}).click();await pc.frameLocator('#playerAtbFrame').locator('[data-console-operator]').first().selectOption(unit.id);await pc.getByRole('dialog',{name:'Pilot console',exact:true}).waitFor();await pc.getByRole('combobox',{name:'Station console',exact:true}).selectOption('sn');
 const view=pc.getByRole('dialog',{name:'Sensor console',exact:true});await view.waitFor();await pc.waitForTimeout(700);assert.match(await view.locator('[data-dice]').innerText(),/4D6 \+ 1D8 \+ 1D10 \+ 1D12/);await pc.screenshot({path:path.join(out,'antenna-sensor-console.png')});
 await act({action:'nudge',id:unit.id,amount:100});await view.locator('[data-turn]').filter({hasText:'YOUR TURN'}).waitFor();await view.getByRole('combobox',{name:'Detected contact',exact:true}).selectOption(enemy.id);await view.getByRole('button',{name:'Systems Analysis',exact:true}).click();
 const roll=pc.getByRole('dialog',{name:'Ship action dice roll'});await roll.waitFor();const dice=roll.frameLocator('iframe');await dice.getByRole('button',{name:'Roll for Me',exact:true}).waitFor();
 const pending=(await state()).units.find(u=>u.id===unit.id).delayedAction;assert.ok(pending.awaitingRoll);assert.equal((await state()).rollPaused,true);
 await dice.getByRole('button',{name:'Roll for Me',exact:true}).click();await dice.locator('#skillResultStage').waitFor();await pc.screenshot({path:path.join(out,'antenna-mixed-dice.png')});await dice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});
 assert.equal((await state()).rollPaused,false);await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
 await view.locator('[data-reports]').filter({hasText:'Systems Analysis'}).waitFor({timeout:30000});await act({action:'setHardPaused',paused:true});
 console.log('PASS actual PC sheet and sensor console share all antenna dice/range; uncertain analysis uses confirmed physical mixed dice and real input/report timing.');
 await view.getByRole('button',{name:'Combat View',exact:true}).click().catch(async()=>{await view.locator('[data-close]').click();});
 const damaged=await fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());
 for(const list of [damaged.campaign.starships,damaged.campaign.encounter.starships]){const s=list.find(s=>s.id===own.id);for(const i of s.ship.sicInventory){if(i.type.startsWith('antenna-')){i.impaired=true;i.impairmentPoints=1;}if(i.id==='backup'){i.impaired=true;i.impairmentPoints=2;}if(i.id==='en')i.disabled=true;}}
 await post('campaign/restore',{code,token,backup:damaged});await pc.reload();await pc.getByRole('button',{name:'Starships',exact:true}).click();
 await sheet.locator('[data-sensor-dice]').first().filter({hasText:'5D6 + 2D4'}).waitFor();assert.equal(await sheet.locator('[data-sensor-range]').first().textContent(),'22');assert.equal(require('../ship-power').output((await state()).starships.find(s=>s.id===own.id)).en,3);
 await pc.screenshot({path:path.join(out,'impaired-antennas-generator.png')});assert.deepEqual(errors,[]);console.log('PASS impaired antenna dice and retained range persist through restore/reload; impaired backup supplies 3 EN with main engine offline.');
}
main().catch(async e=>{console.error(e);await pc?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();if(child&&child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
