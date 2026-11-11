const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('GM prompt expiry is idempotent, private, authoritative and durable across reload/restore',{timeout:30000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-orbit-notes-'));
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Owned server startup timeout')),10000);child.once('error',reject);child.stdout.on('data',d=>{const url=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(route,body)=>{const response=await fetch(base+'/api/campaign/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
 const demo=await post('showcase/start',{}),code=demo.code,token=demo.gmToken;
 const backup=await fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());

 const pc=demo.players[0];const raw=async auth=>fetch(base+'/api/campaign/state?code='+code+'&token='+auth).then(r=>r.json());
 const request=async()=>{const r=await post('roll/request',{code,token,targetIds:[pc.id],attribute:'Intellect',skill:'Computer Systems',difficulty:12});await post('roll/respond',{code,token:pc.token,requestId:r.request.id,characterId:pc.id,score:3,outcome:'Critical Failure',mode:'manual',diceResults:[]});return r.request.id;};
 const send=async(id,action,auth=token)=>fetch(base+'/api/campaign/roll/notification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,token:auth,requestId:id,characterId:pc.id,action,message:'FORGED'})});
 const expired=await request();assert.equal((await send(expired,'expire',pc.token)).status,403);await Promise.all([send(expired,'expire'),send(expired,'expire')]);let gm=await raw(token);assert.equal(gm.inbox.filter(n=>n.kind==='prompt-result').length,1);assert.match(gm.inbox.find(n=>n.kind==='prompt-result').message,/Critical Failure/);assert.ok(!JSON.stringify(gm.inbox).includes('FORGED'));
 for(const action of ['view','dismiss']){const id=await request();assert.equal((await send(id,action)).status,200);await send(id,'expire');assert.equal((await raw(token)).rollRequests.find(r=>r.id===id).results[pc.id].gmNotification.action,action);}
 const race=await request();await Promise.all([send(race,'view'),send(race,'expire'),send(race,'dismiss')]);gm=await raw(token);const decision=gm.rollRequests.find(r=>r.id===race).results[pc.id].gmNotification;assert.ok(['view','expire','dismiss'].includes(decision.action));assert.equal(gm.inbox.filter(n=>n.kind==='prompt-result').length,decision.action==='expire'?2:1);
 for(const player of demo.players){const view=await raw(player.token);assert.equal(view.inbox,undefined);assert.ok(!JSON.stringify(view).includes('gmNotification'));assert.ok(!JSON.stringify(view).includes('prompt-result'));}
 const saved=await fetch(base+'/api/campaign/backup?code='+code+'&token='+token).then(r=>r.json());await post('restore',{code,token,backup:saved});await send(expired,'expire');assert.equal((await raw(token)).inbox.filter(n=>n.kind==='prompt-result').length,decision.action==='expire'?2:1);
 assert.equal((await send(expired,'bogus')).status,400);
});
