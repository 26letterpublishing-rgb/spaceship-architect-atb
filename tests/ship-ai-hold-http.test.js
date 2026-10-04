const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('Ship AI Hold and Resume pass HTTP authorization while leaving its Bridge remains forbidden',{timeout:30000},async t=>{
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-ai-hold-'))},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',chunk=>{const url=String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const demo=await post('campaign/showcase/start',{}),act=(body,status)=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,...body},status);
 let s=await act({action:'setHardPaused',paused:true}),ai=s.units.find(u=>u.shipAi);assert.ok(ai);
 s=await act({action:'setAutomation',id:ai.id,mode:'offense'});ai=s.units.find(u=>u.id===ai.id);const location=structuredClone(ai.location);assert.equal(location.stationed,true);
 await act({action:'nudge',id:ai.id,amount:100});
 s=await act({action:'playerCombatAction',id:ai.id,kind:'holdConsole'});assert.ok(s.units.find(u=>u.id===ai.id).consoleHold);
 s=await act({action:'playerCombatAction',id:ai.id,kind:'resumeConsole'});assert.equal(s.units.find(u=>u.id===ai.id).consoleHold,null);
 await act({action:'playerCombatAction',id:ai.id,kind:'getUp'},409);
 await act({action:'setCombatLocation',id:ai.id,location:{...location,stationed:false}},409);
 assert.deepEqual(s.units.find(u=>u.id===ai.id).location,location);
});
