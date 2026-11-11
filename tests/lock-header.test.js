const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('shared named header keeps existing status, title and command binding while escaping names as text',()=>{
 const window={};vm.runInNewContext(fs.readFileSync('console-common.js','utf8'),{window,crypto:{randomUUID:()=> 'fixture'}});
 const identity={append(node){this.ship=node;}},title={parentElement:identity},status={textContent:'ROLL REQUIRED'},turn={prepend(node){this.title=node;}},meter={value:.6,hidden:false};
 const nodes={'header h2':title,'.weapon-turn':turn,'[data-command]':meter};
 const view={ownerDocument:{createElement:()=>({})},classList:{add(name){this.name=name;}},querySelector:s=>nodes[s]};
 window.SAConsoleCommon.namedHeader(view,'<Lock-On & 10>','Ship <script>');
 assert.equal(turn.title,title);assert.equal(title.textContent,'<Lock-On & 10>');assert.equal(identity.ship.textContent,'Ship <script>');assert.equal(identity.ship.innerHTML,undefined);assert.equal(meter.hidden,true);assert.equal(meter.value,.6);assert.equal(status.textContent,'ROLL REQUIRED');
});
test('ten Lock-On ALMA proposals retain notes, edited bounds, removals and unrelated work',()=>{
 const api=require('../console-layout-editor'),store=require('../console-layout-store'),catalog=require('../alma-snapshots/catalog.json'),w=store.fresh();
 for(let n=1;n<=10;n++){const id='lock-on-'+n,p=api.fresh(catalog.baselines[id]);p.sections.find(x=>x.id==='header').x+=16;p.sections[1].removed=true;w.layouts[id]=p;}
 w.typeNotes['lock-on-system']='Newer note';w.sectionNotes['lock-on-system']={header:'Preserve exact text\nSecond line.'};w.typeNotes.warp='Unrelated note';
 const restored=store.validate(store.exportWorkspace(w,catalog,api),catalog,api);assert.deepEqual(restored.typeNotes,w.typeNotes);assert.deepEqual(restored.sectionNotes,w.sectionNotes);
 for(let n=1;n<=10;n++)assert.deepEqual(store.proposal(restored,'lock-on-'+n,catalog,api),store.proposal(w,'lock-on-'+n,catalog,api));
});
