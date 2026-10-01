const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('Hull upgrades validate and persist without healing damage; GM typed hits apply resistance and reject invalid requests',{timeout:30000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-hull-upgrades-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}t.after(stop);await start();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const get=route=>fetch(base+'/api/'+route).then(r=>r.json()),made=await post('campaign/create',{name:'Hull upgrade persistence',gmCode:'hull-test'},201),code=made.campaign.code;let token=made.token;
 const ship={id:'hull-test',title:'Hull Test',confirmedOnce:true,gridCells:[21,22,23,24,25,26,27,28,29,30],sicInventory:[],placements:[],maximumHullHp:10,currentHullHp:9,groupCredits:50000};
 await post('campaign/starship/link',{code,token,controlType:'pc',starship:ship},201);
 ship.sicInventory.push({id:'plate',type:'hull-plating',attachTo:'hull',purchasePrice:1});ship.placements.push({sicId:'plate',cell:21});
 let saved=(await post('campaign/starship/save',{code,token,starship:ship})).starship;
 assert.equal(saved.ship.maximumHullHp,11);assert.equal(saved.ship.currentHullHp,10);assert.equal(saved.ship.sicInventory[0].purchasePrice,4500);
 const duplicate=structuredClone(ship);duplicate.sicInventory.push({id:'duplicate',type:'hull-plating',attachTo:'hull'});duplicate.placements.push({sicId:'duplicate',cell:21});await post('campaign/starship/save',{code,token,starship:duplicate},400);
 const bad=structuredClone(ship);bad.sicInventory[0].attachTo='unknown';await post('campaign/starship/save',{code,token,starship:bad},400);
 ship.gridCells.push(41,42);saved=(await post('campaign/starship/save',{code,token,starship:ship})).starship;assert.equal(saved.ship.maximumHullHp,13);assert.equal(saved.ship.currentHullHp,12);assert.equal(saved.ship.sicInventory[0].purchasePrice,5400);
 const demo=await post('campaign/showcase/start',{}),backup=await get(`campaign/backup?code=${demo.code}&token=${demo.gmToken}`),encounter=backup.campaign.encounter,target=encounter.starships.find(s=>s.controlType==='gm');
 const shieldIds=new Set(target.ship.sicInventory.filter(i=>require('../ship-map-core').definition(i.type).shield).map(i=>i.id));target.ship.sicInventory=target.ship.sicInventory.filter(i=>!shieldIds.has(i.id));target.ship.placements=target.ship.placements.filter(p=>!shieldIds.has(p.sicId));target.shieldSystems={};target.currentShieldHp=target.maximumShieldHp=0;
 for(const type of ['laser-resistance','heat-resistance']){target.ship.sicInventory.push({id:type,type,attachTo:'hull'});target.ship.placements.push({sicId:type,cell:target.ship.gridCells[0]});}
 target.currentHullHp=target.maximumHullHp=100;target.ship.currentHullHp=target.ship.maximumHullHp=100;target.ship.droneState=null;
 encounter.running=false;encounter.hardPaused=true;encounter.holdPaused=false;encounter.pausedForTurn=false;encounter.activeId=null;
 for(const unit of encounter.units){unit.automationMode='off';unit.delayedAction=null;unit.timedAction=null;unit.delayTimer=null;unit.consoleHold=null;unit.pendingShipRolls=[];}
 backup.campaign.starships=backup.campaign.starships.map(s=>s.id===target.id?structuredClone(target):s);
 await post('campaign/restore',{code:demo.code,token:demo.gmToken,backup});
 const act=(body,status=200)=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,action:'damageStarship',starshipId:target.id,amount:11,...body},status);
 let live=await act({damageType:'laser'});assert.equal(live.starships.find(s=>s.id===target.id).currentHullHp,95);
 live=await act({damageType:'heat'});assert.equal(live.starships.find(s=>s.id===target.id).currentHullHp,92.25);
 await act({damageType:'forged'},400);live=await act({});assert.equal(live.starships.find(s=>s.id===target.id).currentHullHp,81.25);
 const pc=demo.players[0];await post('action',{roomCode:demo.code,characterId:pc.id,characterToken:pc.token,action:'damageStarship',starshipId:target.id,amount:11,damageType:'laser'},403);
 await stop();await start();token=(await post('campaign/open',{name:'Hull upgrade persistence',gmCode:'hull-test'})).token;
 saved=(await get(`campaign/backup?code=${code}&token=${token}`)).campaign.starships[0];assert.equal(saved.ship.currentHullHp,12);assert.equal(saved.ship.maximumHullHp,13);assert.equal(saved.ship.sicInventory[0].purchasePrice,5400);assert.equal(saved.ship.sicInventory[0].attachTo,'hull');
});
