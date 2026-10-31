const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),{spawn}=require('node:child_process'),{once}=require('node:events'),{randomUUID}=require('node:crypto');
const galaxy=require('../campaign-starmaps'),navigation=require('../campaign-navigation');
const source=fs.readFileSync(path.join(__dirname,'../campaign-api.js'),'utf8');
const inbox=vm.runInNewContext('('+source.match(/function gmInboxNotes\(notes\) \{[\s\S]*?\n\}/)[0]+')',{GM_INBOX_LIMIT:3});
function arrival(crew){
 const ship=require('../showcase-starters')('pc','pc',crew),c={showcase:true,starships:[ship],characters:[],npcRoster:[],privateNotes:[]};galaxy.seedShowcase(c);
 const map=c.starmaps.maps[0],star=map.stars[0],planet=star.system.find(o=>o.kind==='planet');
 const send=(kind,extra={})=>galaxy.command(c,{kind,mapId:map.id,starId:star.id,shipId:ship.id,receipt:randomUUID(),...extra},{gm:true,combatActive:false});
 send('systemPosition',{phase:'surface',planetId:planet.id});send('leavePlanet');navigation.advance(c,20);
 assert.equal(c.starmaps.localPositions.pc.phase,'orbit');
 const notes=c.privateNotes.filter(n=>n.message==='Protos reached orbit.');navigation.advance(c,20);assert.equal(c.privateNotes.filter(n=>n.message==='Protos reached orbit.').length,notes.length);
 return {c,ship,notes};
}
for(const count of [0,1,2])test(`one ascent with ${count} crew has one GM notice and separate PC deliveries`,()=>{
 const ids=Array.from({length:count},(_,i)=>'pc-'+i),{notes}=arrival(ids);
 assert.equal(notes.length,count+1);assert.equal(new Set(notes.map(n=>n.id)).size,count+1);assert.equal(new Set(notes.map(n=>n.travelEventId)).size,1);
 assert.deepEqual(notes.filter(n=>n.direction==='to-character').map(n=>n.characterId),ids);
 assert.equal(inbox(JSON.parse(JSON.stringify(notes))).length,1);assert.equal(inbox(notes)[0].direction,'to-gm');
});
test('separate same-text events, unmarked history and actionable messages survive; copies do not consume GM limit',()=>{
 const {c,ship,notes}=arrival(['pc-0','pc-1']);galaxy.note(c,'Protos reached orbit.',ship);
 const all=c.privateNotes.filter(n=>n.message==='Protos reached orbit.');assert.equal(inbox(all).length,2);assert.notEqual(all[0].travelEventId,all[3].travelEventId);
 const special=[{id:'old',kind:'system',direction:'to-character',message:'Protos reached orbit.'},{id:'approval',kind:'rest-request',requestStatus:'pending',travelEventId:notes[0].travelEventId,direction:'to-character'},{id:'sent',kind:'message',direction:'to-character',travelEventId:notes[0].travelEventId}];
 assert.deepEqual(Array.from(inbox([...special,...notes]),n=>n.id),['approval','sent',notes[0].id]);
 assert.equal(inbox([special[0],...notes]).length,2);assert.equal(inbox(notes.slice(1)).length,2,'without canonical GM record do not suppress copies');
 assert.equal(c.privateNotes.length,all.length,'projection must not delete stored recipient copies');
});
test('actual HTTP GM/PC state projects linked restored arrival records without losing PC copies',{timeout:30000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-orbit-notes-'));
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Owned server startup timeout')),10000);child.once('error',reject);child.stdout.on('data',d=>{const url=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(route,body)=>{const response=await fetch(base+'/api/campaign/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
 const demo=await post('showcase/start',{}),code=demo.code,token=demo.gmToken;
 const backup=await fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());
 const ids=demo.players.slice(0,2).map(p=>p.id),{notes}=arrival(ids);assert.equal(ids.length,2);
 backup.campaign.privateNotes.push(...notes);await post('restore',{code,token,backup});
 const state=auth=>fetch(`${base}/api/campaign/state?code=${code}&token=${auth}`).then(r=>r.json());
 for(let i=0;i<2;i++){
  const gm=await state(token);assert.equal(gm.inbox.filter(n=>n.travelEventId===notes[0].travelEventId).length,1);
  for(const pc of demo.players.slice(0,2)){const view=await state(pc.token),own=view.characters.find(c=>c.id===pc.id);assert.equal(own.privateNotes.filter(n=>n.travelEventId===notes[0].travelEventId).length,1);assert.equal(own.privateNotes.find(n=>n.travelEventId===notes[0].travelEventId).characterId,pc.id);}
 }
 const saved=await fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());assert.equal(saved.campaign.privateNotes.filter(n=>n.travelEventId===notes[0].travelEventId).length,3);
});
