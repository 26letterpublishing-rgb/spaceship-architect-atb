const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../crew-logs-ui.js'),'utf8');
function fixture(){
 let finish;const records=new Map(),calls=[];
 const context=vm.createContext({state:{crewLogs:[]},saving:false,name:{value:'Voyage'},text:{value:'First words'},select:{value:'0'},revision:0,dirty:true,status:{textContent:''},own:()=> 'pc',storageKey:()=>`log:${context.select.value}`,localStorage:{getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},request:async body=>{calls.push(body);await new Promise(resolve=>finish=resolve);context.state.crewLogs=[{characterId:'pc',session:body.session,revision:1}];},load:()=>{context.dirty=false;context.revision=1;},stash:()=>records.set(`log:${context.select.value}`,JSON.stringify({name:context.name.value,text:context.text.value,revision:context.revision,dirty:context.dirty}))});
 vm.runInContext(source.slice(source.indexOf(' async function saveEntry'),source.indexOf(' function download')),context);
 return{context,records,calls,finish:()=>finish()};
}
test('crew log save preserves edits typed while its response was pending',async()=>{
 const f=fixture(),pending=f.context.saveEntry('save');f.context.text.value='New words';f.finish();await pending;
 assert.equal(f.context.text.value,'New words');assert.equal(f.context.dirty,true);assert.equal(f.context.revision,1);assert.equal(JSON.parse(f.records.get('log:0')).text,'New words');
});
test('crew log response does not clear a different session draft',async()=>{
 const f=fixture();f.records.set('log:0',JSON.stringify({name:'Voyage',text:'First words',dirty:true}));
 const pending=f.context.saveEntry('submit');f.context.select.value='1';f.context.text.value='Session one draft';f.records.set('log:1','keep');f.finish();await pending;
 assert.equal(f.records.get('log:1'),'keep');assert.equal(f.context.text.value,'Session one draft');assert.equal(f.records.has('log:0'),false);
});
test('crew log allows one outstanding write and clears only unchanged saved text',async()=>{
 const f=fixture(),pending=f.context.saveEntry('save');await f.context.saveEntry('submit');assert.equal(f.calls.length,1);f.finish();await pending;
 assert.equal(f.context.saving,false);assert.equal(f.context.dirty,false);assert.equal(f.context.status.textContent,'Entry saved.');
});
