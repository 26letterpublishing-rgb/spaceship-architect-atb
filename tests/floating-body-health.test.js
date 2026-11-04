const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../space-map'),'utf8');
const c={};vm.runInNewContext(source.slice(source.indexOf('  function floatingHealth('),source.indexOf('  function refreshFloatingHealth('))+';this.health=floatingHealth;',c);
test('floating health reads live disclosed actor without changing targeting proxy',()=>{
 const proxy={id:'body',isFloatingBody:true,currentHullHp:1,maximumHullHp:1},actor={characterName:'Ally',currentHp:20,maximumHp:30,vacuum:{id:'body'}};
 assert.equal(c.health(proxy,[actor]),'Ally — HP 20/30');actor.currentHp=0;assert.equal(c.health(proxy,[actor]),'Ally — HP 0/30');assert.equal(proxy.currentHullHp,1);
 delete actor.vacuum;assert.equal(c.health(proxy,[actor]),null);
});
test('floating health does not disclose absent actors or unknown contacts',()=>{
 const p={id:'body',isFloatingBody:true},u={currentHp:10,maximumHp:30,vacuum:{id:'body'}};
 assert.equal(c.health(p,[]),null);assert.equal(c.health({...p,contactLevel:'unknown'},[u]),null);assert.equal(c.health(p,[u],{sensorState:{contacts:{}}}),null);
 assert.match(c.health(p,[u],{sensorState:{contacts:{body:{level:'detected'}}}}),/10\/30/);
});
