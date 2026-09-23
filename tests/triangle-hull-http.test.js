const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),maps=require('../ship-map-core');
test('triangle hull and host add-ons survive authorized saves and restart without healing existing damage',{timeout:30000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-hull-http-'));let child,base;
 async function launch(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});}
 async function stop(){if(child?.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}}t.after(stop);await launch();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const made=await post('campaign/create',{name:'Triangle persistence',gmCode:'hull-gm'},201),code=made.campaign.code;let token=made.token;
 const ship={id:'triangle-test',title:'Triangle test',confirmedOnce:true,gridCells:maps.rectangleCells({},21,7,7).filter(n=>n!==27),triangleCells:[27],maximumHullHp:49,currentHullHp:35,groupCredits:9000,sicInventory:[{id:'life',type:'life-support'},{id:'power',type:'en-engine-2'},{id:'fort1',type:'vulnerability-fortification',attachTo:'life',purchasePrice:500},{id:'fort2',type:'vulnerability-fortification',attachTo:'life',purchasePrice:1000}],placements:[{sicId:'life',cell:21},{sicId:'power',cell:85},{sicId:'fort1',cell:21},{sicId:'fort2',cell:21}]};
 const linked=await post('campaign/starship/link',{code,token,controlType:'pc',starship:ship},201);assert.deepEqual(linked.starship.ship.triangleCells,[27]);
 await post('campaign/starship/save',{code,token:'unrelated',starship:ship},403);
 let saved=(await post('campaign/starship/save',{code,token,starship:ship})).starship;
 assert.equal(saved.ship.maximumHullHp,49);assert.equal(saved.ship.currentHullHp,35);assert.equal(maps.effectiveThreshold(saved,saved.ship.sicInventory[0]),20);assert.equal(saved.ship.sicInventory[3].purchasePrice,1000);
 const invalid={...ship,gridCells:ship.gridCells.filter(n=>n!==26)};await post('campaign/starship/save',{code,token,starship:invalid},400);
 const removed={...ship,triangleCells:[]};saved=(await post('campaign/starship/save',{code,token,starship:removed})).starship;assert.equal(saved.ship.maximumHullHp,48);assert.equal(saved.ship.currentHullHp,34);
 // A stale client HP field must not erase existing damage when construction is saved.
 saved=(await post('campaign/starship/save',{code,token,starship:{...ship,currentHullHp:49}})).starship;assert.equal(saved.ship.currentHullHp,35);
 await stop();await launch();token=(await post('campaign/open',{name:'Triangle persistence',gmCode:'hull-gm'})).token;
 const backup=await fetch(base+`/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());saved=backup.campaign.starships.find(s=>s.id===ship.id);assert.deepEqual(saved.ship.triangleCells,[27]);assert.equal(saved.ship.currentHullHp,35);assert.equal(maps.effectiveThreshold(saved,saved.ship.sicInventory[0]),20);
});
