const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Point Spend survives replaced shop nodes, rapid spend/refund and character switching',()=>{
 let now=0,id=0;const frames=new Map();const window={matchMedia:()=>({matches:false})};
 const ctx={window,performance:{now:()=>now},requestAnimationFrame:f=>{frames.set(++id,f);return id},cancelAnimationFrame:i=>frames.delete(i)};vm.runInNewContext(fs.readFileSync(require.resolve('../point-spend'),'utf8'),ctx);
 const node=()=>({isConnected:true,id:'balance',children:[],classList:{add(){}},style:{},ownerDocument:{createElement:()=>({style:{},setAttribute(){}}),createTextNode:text=>({textContent:text})},replaceChildren(...c){this.children=c},prepend(c){this.children.unshift(c)},setAttribute(k,v){this[k]=v}});
 const tick=t=>{now=t;const pending=[...frames.values()];frames.clear();pending.forEach(f=>f());};const update=window.SAPointSpend.update;
 let n=node();update(n,500,{key:'credits',scope:'nova'});update(n,340,{key:'credits',scope:'nova'});assert.equal(n.children[0].textContent,'−160');assert.equal(n.children[1].textContent,'500');assert.equal(n['aria-label'],'340');
 now=400;n.isConnected=false;const replacement=node();update(replacement,340,{key:'credits',scope:'nova'});tick(1000);assert.ok(Number(replacement.children[1].textContent)<500);update(replacement,400,{key:'credits',scope:'nova'});assert.equal(replacement.children[0].textContent,'+60');tick(2300);assert.equal(replacement.children[0].textContent,'400');assert.equal(frames.size,0);
 const other=node();update(other,25,{key:'credits',scope:'orion'});assert.equal(other.children[0].textContent,'25');
 window.matchMedia=()=>({matches:true});update(other,20,{key:'credits',scope:'orion'});assert.equal(other.children[1].textContent,'20');tick(3200);assert.equal(other.children[0].textContent,'20');
});
