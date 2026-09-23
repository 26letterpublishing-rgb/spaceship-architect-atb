const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const objects=require('../space-objects');
const mineral=(id='object-iron',q=0,r=2)=>({id,kind:'mineral',name:'Iron Deposit',mineral:'Iron',quantity:3,q,r});
function editor(initial=[],ships=[]){
 let draft=structuredClone(initial),panel;
 const fields=Object.fromEntries(Object.entries({kind:'mineral',name:'Iron Deposit',mineral:'Iron',quantity:'1',q:'0',r:'2'}).map(([name,value])=>[name,{value,closest:()=>({hidden:false})}]));
 const nodes={form:{},output:{},'[data-object-list]':{}};
 const host={querySelector:()=>panel};
 const map={parentElement:host,hidden:false,after(node){panel=node;}};
 const context={window:{SASpaceObjects:objects},document:{createElement:()=>({dataset:{},querySelector:selector=>selector.startsWith('[name=')?fields[selector.slice(6,-1)]:nodes[selector]})},crypto:require('node:crypto').webcrypto,Uint32Array,FormData:class{get(key){return fields[key].value;}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../space-object-editor'),'utf8'),context);
 const bind=()=>context.window.SASpaceObjectEditor.bind(map,()=>draft,next=>{draft=next;bind();},{getPositions:()=>ships});bind();
 return {fields,nodes,bind,get draft(){return draft;},move(id,q,r){draft=objects.withPositions(draft,[{id,q,r}]);},add(){nodes.form.onsubmit({preventDefault(){},target:nodes.form});},remove(id){nodes['[data-object-list]'].onclick({target:{closest:()=>({dataset:{removeObject:id}})}});}};
}
test('adding and removing scenery use the current moved positions without requiring an editor refresh',()=>{
 const e=editor([mineral(),mineral('object-second',1,2)]);
 e.move('object-iron',17,-3);e.fields.kind.value='asteroid';e.fields.kind.onchange();e.add();
 assert.equal(e.draft.length,3);assert.deepEqual(e.draft[0],mineral('object-iron',17,-3));assert.equal(e.draft[2].name,'Asteroid');
 e.move('object-second',-12,15);e.remove('object-iron');assert.deepEqual(e.draft.find(o=>o.id==='object-second'),mineral('object-second',-12,15));assert.equal(e.draft.some(o=>o.id==='object-iron'),false);
});
test('successive default placements are distinct and near the fleet, while explicit shared hexes remain allowed',()=>{
 const e=editor([], [{id:'ship',q:25,r:10}]);e.add();e.add();e.add();
 assert.equal(e.draft.length,3);assert.equal(new Set(e.draft.map(o=>o.q+':'+o.r)).size,3);assert.ok(e.draft.every(o=>Math.abs(o.q-25)<=2&&Math.abs(o.r-10)<=2));
 const first=e.draft[0];e.fields.q.value=String(first.q);e.fields.r.value=String(first.r);e.fields.q.oninput();e.bind();
 assert.equal(e.fields.q.value,String(first.q),'re-render does not replace a manually chosen location');e.add();assert.equal(e.draft[3].q,first.q);assert.equal(e.draft[3].r,first.r);
});
test('object type/mineral changes update automatic names and retain the GM custom name',()=>{
 const e=editor();e.fields.kind.value='asteroid';e.fields.kind.onchange();assert.equal(e.fields.name.value,'Asteroid');
 e.fields.kind.value='planet';e.fields.kind.onchange();assert.equal(e.fields.name.value,'Unnamed Planet');
 e.fields.kind.value='mineral';e.fields.kind.onchange();e.fields.mineral.value='Magnesium';e.fields.mineral.onchange();assert.equal(e.fields.name.value,'Magnesium Deposit');
 e.fields.name.value='Grave of the Titans';e.fields.kind.value='asteroid';e.fields.kind.onchange();assert.equal(e.fields.name.value,'Grave of the Titans');
});
test('suggested planet placement avoids occupied footprints, stays bounded and does not alter existing positions',()=>{
 const occupied=[{...mineral(),q:10000,r:10000},{id:'object-planet',kind:'planet',q:9999,r:10000}];const before=structuredClone(occupied);
 const point=objects.suggestedPosition(occupied,'planet',{q:10000,r:10000});assert.ok(Math.abs(point.q)<=10000&&Math.abs(point.r)<=10000);
 for(const o of occupied){const q=point.q-o.q,r=point.r-o.r;assert.ok(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))>1+(o.kind==='planet'?1:0));}assert.deepEqual(occupied,before);
});
test('drag coordinate updates retain object identity, names, contents and planet aftermath',()=>{
 const planet={id:'object-world',kind:'planet',name:'Vesper',variant:'ice',destroyedAt:1234,destroyedBy:'ship',q:2,r:1,quantity:1};
 assert.deepEqual(objects.withPositions([planet],[{id:planet.id,q:-4,r:7,name:'Wrong'}]),[{...planet,q:-4,r:7}]);
 assert.deepEqual(objects.withPositions([planet],[{id:planet.id,q:Infinity,r:7}]),[planet]);
});
test('reopening a preparation draft preserves local moves and deletions while merging remote collection and new objects',()=>{
 const a=mineral(),b=mineral('object-second',3,4),remote=mineral('object-remote',9,4),local=mineral('object-local',5,9);
 const draft={baseline:[a,b],objects:[{...a,q:22,r:-3},local],positions:[{id:'ship-a',q:12,r:1},{id:'other-campaign',q:9,r:8}]};
 assert.deepEqual(objects.restoreDraft(draft,[a,b,remote],['ship-a']),{objects:[{...a,q:22,r:-3},local,remote],positions:[{id:'ship-a',q:12,r:1}]});
 assert.deepEqual(objects.restoreDraft(draft,[b,remote],['ship-a']).objects,[local,remote],'a remotely collected object must not be resurrected');
});
test('encounter preparation retains explicitly shared object hexes and moved coordinates exactly',()=>{
 const ship={id:'ship-a',title:'Wayfinder',ship:{gridCells:[0],placements:[],sicInventory:[]}};
 const scenery=objects.withPositions([mineral(),mineral('object-second',1,2)],[{id:'object-iron',q:17,r:-3},{id:'object-second',q:17,r:-3}]);
 const prepared=require('../encounter-preparation').validatePreparation({preparationId:'object-movement-receipt',mode:'starship',starships:[ship],units:[{team:'pc',characterId:'nova',location:{starshipId:ship.id,square:0,mesh:4}}],shipPositions:[{id:ship.id,q:25,r:4}],spaceObjects:scenery},{starships:[ship],characters:[{id:'nova',approved:true}]},ships=>structuredClone(ships));
 assert.deepEqual(prepared.spaceObjects,scenery);assert.deepEqual(prepared.shipPositions,[{id:ship.id,q:25,r:4}]);
});
test('GM draft survives a refresh with no checked ships, reselection and later server-authoritative positions',()=>{
 const source=fs.readFileSync(require.resolve('../gm'),'utf8'),start=source.indexOf('function saveEncounterMapDraft()'),end=source.indexOf('\nfunction playDramaJolt()',start),store=new Map();
 const c={window:{SASpaceObjects:objects,SAShipDistances:require('../ship-distances')},campaign:{starships:[{id:'last-word'}],spaceObjects:[]},code:'TEST',encounterPositions:[{id:'last-word',q:3,r:-2}],encounterPositionDraft:[],encounterObjects:[],encounterObjectBaseline:[],encounterMapDraftSaved:false,encounterState:null,encounterDistances:[],structuredClone,sessionStorage:{setItem:(key,value)=>store.set(key,value),getItem:key=>store.get(key),removeItem:key=>store.delete(key)}};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);c.saveEncounterMapDraft();
 c.restoreEncounterMapDraft();assert.equal(c.encounterPositions.length,0,'refresh initially has no ship checkbox selected');
 c.saveEncounterMapDraft();c.restoreEncounterMapDraft();
 const visible=c.window.SAShipDistances.positions(c.campaign.starships,[...c.encounterPositionDraft,...(c.encounterState?.shipPositions||[])]);
 assert.deepEqual(visible,[{id:'last-word',q:3,r:-2}]);
 // A successful preparation discards the local draft; reopening now follows the live encounter.
 store.clear();c.restoreEncounterMapDraft();c.encounterState={shipPositions:[{id:'last-word',q:9,r:6}]};
 assert.deepEqual(c.window.SAShipDistances.positions(c.campaign.starships,[...c.encounterPositionDraft,...c.encounterState.shipPositions]),[{id:'last-word',q:9,r:6}]);
});
