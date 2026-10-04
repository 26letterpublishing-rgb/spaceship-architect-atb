const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../quick-prompts.js'),'utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
test('queued composed rolls and saved prompts retain click-time recipients, skill and difficulty',async()=>{
 let unblock;const queue=new Promise(resolve=>{unblock=resolve;});const sent=[],saved=[],status={},fields={name:{value:'Spot danger'},attribute:{value:'Perception'},skill:{value:'Awareness'},difficulty:{value:'10'},send:{},add:{}};let recipients=['a'];
 const body={querySelector(selector){return fields[selector.slice(6,-1)];},querySelectorAll(){return recipients.map(value=>({value}));}};
 const c=vm.createContext({queue,status,state:{code:'TEST',characters:[{id:'a',character:{identity:{characterName:'Alex'}}},{id:'b',character:{identity:{characterName:'Blair'}}}]},token:'gm',body,presets:()=>[],save:async(column,list)=>saved.push({column,list}),prompt:async(ids,item)=>sent.push({ids,item})});
 vm.runInContext(section(' const run=',' async function save('),c);
 vm.runInContext(section(' const current=',' for(const column of [...names'),c);
 const sending=fields.send.onclick(),adding=fields.add.onclick();
 recipients=['b'];fields.name.value='Use computers';fields.skill.value='Computer Systems';fields.attribute.value='Intellect';fields.difficulty.value='21';unblock();await Promise.all([sending,adding]);
 assert.deepEqual([...sent[0].ids],['a']);assert.equal(sent[0].item.skill,'Awareness');assert.equal(sent[0].item.difficulty,10);assert.equal(saved[0].column,'a');assert.equal(saved[0].list[0].name,'Spot danger');
});
test('late difficulty timer and queued deletion cannot change a different preset after indexes shift',async()=>{
 const before=[{name:'Awareness',attribute:'Perception',skill:'Awareness',difficulty:10},{name:'Computer',attribute:'Intellect',skill:'Computer Systems',difficulty:10}],saved=[];
 const c=vm.createContext({items:structuredClone(before),presets:()=>structuredClone(c.items),save:async(column,list)=>saved.push(list)});vm.runInContext(section(' const presetShape=',' async function save('),c);
 const shape=vm.runInContext('presetShape(items)',c);c.items.shift();
 await assert.rejects(c.updatePresetDifficulty('everyone',0,shape,17),/Prompt list changed/);await assert.rejects(c.removePreset('everyone',0,shape),/Prompt list changed/);assert.equal(saved.length,0);assert.equal(c.items[0].difficulty,10);
 c.items=structuredClone(before);await c.updatePresetDifficulty('everyone',0,shape,17);assert.equal(saved[0][0].difficulty,17);
});
test('queued roll acknowledges its recipients and canceled campaign context sends nothing',async()=>{
 let unblock;const queue=new Promise(resolve=>{unblock=resolve;});let requests=0;const c=vm.createContext({queue,state:{code:'OLD',characters:[]},token:'gm',status:{},request:async()=>{requests++;}});
 vm.runInContext(section(' const run=',' async function save('),c);
 const pending=vm.runInContext("run(request,'Roll request sent to Alex.')()",c);c.state.code='NEW';unblock();await pending;assert.equal(requests,0);assert.match(c.status.textContent,/Campaign changed/);
 await vm.runInContext("run(request,'Roll request sent to Alex.')()",c);assert.equal(c.status.textContent,'Roll request sent to Alex.');
});
