const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('remaining launcher ammunition purchases use server prices and retry-safe owned inventory',{timeout:30000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-weapon-ammo-')),child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/campaign/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const demo=await post('showcase/start',{}),gm={code:demo.code,token:demo.gmToken},pc={code:demo.code,token:demo.players[0].token,characterId:demo.players[0].id};
 await post('shops',{...gm,operation:'save',shop:{id:'explore-supply',name:'Ammo Test',active:true,modifier:-99}});
 let credits=500;
 for(const [id,price] of [['skull-bore',5],['hull-bore',2],['rubber-bouncy-bombs',3],['mini-nuke',50]]){
   const purchase={...pc,mode:'purchase',inventoryType:'weapon',requestId:'ammo-'+id,expectedPrice:price,item:{id:'owned-'+id,weaponId:id,name:id,unitCost:1}};
   await post('item/transaction',{...purchase,expectedPrice:price+1},409);
   credits-=price;
   for(let retry=0;retry<2;retry++){
     const result=await post('item/transaction',purchase),character=result.campaign.characters.find(c=>c.id===pc.characterId).character;
     assert.equal(character.resources.creditsBase,credits);
     assert.equal(character.weapons.filter(w=>w.weaponId===id).length,1);
   }
 }
 const state=await fetch(`${base}/api/campaign/state?code=${demo.code}&token=${pc.token}`).then(r=>r.json());
 assert.equal(state.shops.offers.filter(i=>i.id.startsWith('weapon:')).length,49);
 assert.ok(!state.shops.offers.some(i=>/arm.?cannon|charge-beam/i.test(i.id)));
});
