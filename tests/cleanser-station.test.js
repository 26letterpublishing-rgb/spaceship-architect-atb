const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../cleanser-ui.js'),'utf8');
function helper(name,next,context={}){const start=source.indexOf('function '+name+'('),end=source.indexOf('function '+next+'(',start);vm.runInNewContext(source.slice(start,end),context);return context[name];}
const visual=helper('stationChargeVisual','stationTargets');
test('Cleanser reactor motion depends only on active charge progress and stays unchanged during a pause',()=>{
 const charge={phase:'charging',remaining:42};const before=visual(charge);
 assert.deepEqual(visual({...charge,startedAt:Date.now()+1e7}),before);
 assert.equal(before.elapsed,78);assert.equal(before.progress,.65);assert.equal(before.critical,false);
 const after=visual({...charge,remaining:41});assert.notEqual(after.angle,before.angle);assert.notEqual(after.wave,before.wave);
});
test('final five active seconds enable containment sparks, idle and cooldown do not',()=>{
 assert.equal(visual({phase:'charging',remaining:5.01}).critical,false);
 assert.equal(visual({phase:'charging',remaining:5}).critical,true);
 assert.equal(visual({phase:'charging',remaining:.1}).critical,true);
 assert.equal(visual({phase:'cooldown',remaining:0}).critical,false);
 assert.equal(visual({phase:'cooldown'},true).progress,1);
 assert.equal(visual({phase:'idle',remaining:0}).progress,0);
});
test('reduced-motion reactor keeps ring angles fixed while retaining charge information',()=>{
 const early=visual({phase:'charging',remaining:119},false,true),late=visual({phase:'charging',remaining:1},false,true);
 assert.equal(early.angle,0);assert.equal(late.angle,0);assert.ok(late.progress>early.progress);assert.equal(late.remaining,1);
});
test('Cleanser target list excludes hidden or ineligible ships without requiring undisclosed hull totals',()=>{
 const owner={id:'ours',sensorState:{contacts:{visible:{level:'detected'},unknown:{level:'unknown'},cloaked:{level:'detected'},dead:{level:'detected'},probe:{level:'detected'},docked:{level:'detected'}}}};
 const targets=helper('stationTargets','stationStyle',{window:{SAShipMap:{cloaked:s=>s.cloaked,sensorStats:()=>({range:18})},SAShipDistances:{hexDistance:()=>0}}});
 const room={shipPositions:[{id:'ours',q:0,r:0},{id:'visible',q:1,r:0},{id:'unscanned',q:1,r:0},{id:'analyzed',q:1,r:0}],spaceObjects:[{id:'planet',kind:'planet'},{id:'debris',kind:'planet',destroyedAt:1},{id:'ore',kind:'mineral'}],starships:[owner,{id:'visible',title:'Known ship'},{id:'unknown'},{id:'unseen'},{id:'cloaked',cloaked:true},{id:'dead',currentHullHp:0},{id:'probe',isProbe:true},{id:'docked',dockedIn:'carrier'}]};
 assert.equal(JSON.stringify(targets(room,owner).map(t=>t.id)),JSON.stringify(['planet','visible']));
});
test('living detected contacts remain targetable when their rounded Hull condition is zero',()=>{
 const owner={id:'ours',sensorState:{contacts:{unscanned:{level:'detected'},analyzed:{level:'detected'},wreck:{level:'detected'}}}};
 const targets=helper('stationTargets','stationStyle',{window:{SAShipMap:{cloaked:()=>false,sensorStats:()=>({range:18})},SAShipDistances:{hexDistance:()=>0}}});
 const room={shipPositions:[{id:'ours',q:0,r:0},{id:'unscanned',q:1,r:0},{id:'analyzed',q:1,r:0}],starships:[owner,{id:'unscanned',contactOnly:true,currentHullHp:0,maximumHullHp:6},{id:'analyzed',analyzedContact:true,currentHullHp:0,maximumHullHp:6},{id:'wreck',contactOnly:true,currentHullHp:0,maximumHullHp:6,destroyedAt:1}]};
 assert.equal(JSON.stringify(targets(room,owner).map(t=>t.id)),JSON.stringify(['unscanned','analyzed']));
});
