const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),{randomUUID}=require('node:crypto');
test('tab review loaders, messages and individual relocation retain authorization and persist',{timeout:30000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-surface-travel-'));let child,base;
 async function launch(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),8000);child.stdout.on('data',data=>{const url=String(data).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}
 t.after(stop);await launch();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/campaign/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const demo=await post('showcase/start',{}),template=await fetch(base+`/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());
 const fresh=await post('v03/create',{name:'Tab review QA',gmCode:'surface-qa'},201),code=fresh.campaign.code,initialToken=fresh.token;let token=initialToken;
 template.campaign.interfaceVersion='0.3';template.campaign.roomOpen=true;template.campaign.code=code;template.campaign.name='Tab review QA';await post('restore',{code,token,backup:template});const saved=await fetch(base+`/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());token=(await post('v03/load',{backup:saved,choice:'replace'})).token;
 const id=demo.players[0].id,pc=await post('v03/join',{code,name:'Travel tester'});await post('v03/claim',{code,token:pc.token,characterId:id,password:template.campaign.characters.find(r=>r.id===id).pcCode});
 const state=auth=>fetch(base+`/api/campaign/state?code=${code}&token=${auth}`).then(r=>r.json());
 let c=await state(token),p=c.starmaps.party,otherId=demo.players[1].id;
 const second=await post('v03/join',{code,name:'Second tester'});await post('v03/claim',{code,token:second.token,characterId:otherId,password:template.campaign.characters.find(r=>r.id===otherId).pcCode});
 await post('note/send',{code,token:pc.token,characterId:id,targetIds:[id],message:'Self'},400);
 await post('note/send',{code,token:pc.token,characterId:otherId,targetIds:['gm'],message:'Spoof'},403);
 await post('note/send',{code,token:pc.token,characterId:id,targetIds:[otherId],message:'Private peer note'});
 let view=await state(second.token);assert.ok(view.characters.find(r=>r.id===otherId).privateNotes.some(n=>n.message==='Private peer note'&&n.senderCharacterId===id));
 assert.ok(!(await state(pc.token)).characters.find(r=>r.id===otherId).privateNotes?.some(n=>n.message==='Private peer note'));
 await post('note/send',{code,token:second.token,characterId:otherId,targetIds:['gm'],message:'Private GM note'});
 const file={format:'sa2story',version:1,chapters:[{id:'attached',name:'The Cache',script:'The cache opens.'}],actions:[]},old=c.scriptChapters.map(ch=>ch.id);
 await post('script/import',{code,token:pc.token,file,append:true},403);
 const imported=await post('script/import',{code,token,file,append:true});c=await state(token);assert.ok(c.scriptChapters.some(ch=>ch.id===imported.chapterId&&ch.name==='The Cache'));for(const ch of old)assert.ok(c.scriptChapters.some(x=>x.id===ch));
 await post('v03/starmap',{code,token,kind:'planetHex',...p,hex:'500',attachments:{story:file},receipt:randomUUID()});
 await post('character/relocate',{code,token:pc.token,characterId:id,destinationId:'ship/'+p.shipId},403);
 const otherBefore=structuredClone(c.starships.find(s=>s.id===p.shipId).characterLocations[otherId]);
 await post('character/relocate',{code,token,characterId:id,destinationId:'ship/'+p.shipId});c=await state(token);
 assert.equal(c.starships.find(s=>s.id===p.shipId).characterLocations[id].environment,'starship');assert.deepEqual(c.starships.find(s=>s.id===p.shipId).characterLocations[otherId],otherBefore);
 const destination=c.relocationDestinations.find(d=>d.planetId&&d.id.endsWith('/500'))||c.relocationDestinations.find(d=>d.planetId);
 await post('character/relocate',{code,token,characterId:id,destinationId:destination.id});
 view=await state(pc.token);assert.equal(view.starmaps.party.planetId,destination.planetId);assert.equal(view.starmaps.characterWorldLocations,undefined);
 assert.equal(view.starmaps.maps.find(m=>m.id===p.mapId).stars.find(s=>s.id===p.starId).surfaces[p.planetId].hexes['500'].attachments,undefined);
 await stop();await launch();c=await state(token);assert.equal(c.starmaps.characterWorldLocations[id].planetId,destination.planetId);assert.ok(c.scriptChapters.some(ch=>ch.id===imported.chapterId));assert.equal(c.starmaps.maps.find(m=>m.id===p.mapId).stars.find(s=>s.id===p.starId).surfaces[p.planetId].hexes['500'].attachments.story.chapters[0].name,'The Cache');assert.ok(c.inbox.some(n=>n.message==='Private GM note'));
});
