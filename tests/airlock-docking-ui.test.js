const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../ship-command-ui'),'utf8');
function harness(){
 const select={value:'target',options:[]},button={},output={};
 Object.defineProperty(select,'innerHTML',{set(html){this.options=[...html.matchAll(/value="([^"]+)"/g)].map(m=>({value:m[1]}));this.value=this.options[0]?.value||'';}});
 const c={docking:{querySelector:s=>({select,button,output}[s])},dialog:{open:true,dataset:{sicId:'bridge'}},unitId:'operator',esc:String,crypto:{randomUUID:()=> 'ui-test-receipt'},calls:0,data:{targets:[{id:'target',title:'Target'},{id:'other',title:'Other'}],links:[]},failure:'Both ships must share a hex, have airlocks, and have shields off.'};
 c.bridge={fieldUtilityRequest:async body=>{if(body.kind==='airlock-inspect')return {result:c.data};c.calls++;if(c.pending)await c.pending;if(c.failure)throw Error(c.failure);c.data.links=[{remaining:20,ready:false}];return {};}};
 vm.runInNewContext(source.slice(source.indexOf('    let dockBusy='),source.indexOf('    const dockingTimer='))+'this.inspect=inspectDocking;',c);
 return {c,select,button,output,settle:()=>new Promise(r=>setImmediate(r))};
}
test('docking rejection survives polling and missing targets while real connection status updates',async()=>{
 const h=harness();await h.c.inspect();await h.button.onclick();await h.settle();
 for(let i=0;i<3;i++)await h.c.inspect();assert.match(h.output.textContent,/have airlocks/);assert.equal(h.button.disabled,false);
 h.c.data.targets=[];await h.c.inspect();assert.match(h.output.textContent,/have airlocks/);assert.match(h.output.textContent,/No eligible ships/);assert.equal(h.button.disabled,true);
 h.c.data.links=[{remaining:4.2}];await h.c.inspect();assert.match(h.output.textContent,/Docking: 5 seconds/);assert.match(h.output.textContent,/have airlocks/);
 h.c.data.links=[{ready:true}];await h.c.inspect();assert.match(h.output.textContent,/Airlock connected/);
});
test('deliberate selection change and retry clear error; pending requests cannot duplicate docking',async()=>{
 const h=harness();await h.c.inspect();await h.button.onclick();await h.settle();h.select.value='other';h.select.onchange();await h.settle();assert.doesNotMatch(h.output.textContent,/have airlocks/);
 h.c.failure='Rejected again';await h.button.onclick();await h.settle();assert.match(h.output.textContent,/Rejected again/);
 let resolve;h.c.pending=new Promise(r=>resolve=r);h.c.failure='';const before=h.c.calls,request=h.button.onclick();assert.equal(h.button.disabled,true);await h.button.onclick();assert.equal(h.c.calls,before+1);assert.doesNotMatch(h.output.textContent,/Rejected again/);resolve();await request;await h.settle();assert.match(h.output.textContent,/Docking: 20 seconds/);assert.equal(h.button.disabled,false);
 const reopened=harness();await reopened.c.inspect();assert.equal(reopened.output.textContent,'');
});
