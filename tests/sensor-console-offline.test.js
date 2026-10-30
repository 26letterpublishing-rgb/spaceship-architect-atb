const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the actual redraw prelude with unavailable stats; the browser pilot
// covers the complete renderer and live power/restart transition.
const source=fs.readFileSync(require.resolve('../sensor-console-ui.js'),'utf8');
const prelude=source.slice(source.indexOf('function redraw() {')+'function redraw() {'.length,source.indexOf('      const pulse=access.ship.sensorState?.pulse;'));
test('offline sensor redraw clears stale operational values without requiring sensor stats',()=>{
 for(const offline of [false,true]){
  const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,{textContent:'old range',value:50,style:{},replaceChildren(){this.cleared=true;}});return nodes.get(s);};
  const orders=[{disabled:false},{disabled:false}],notes=[{textContent:'Difficulty 6'}];
  const person={id:'pc'},access={seat:{key:'seat'},ship:{},offline};
  const context={get,view:{dataset:{selectHex:'true'},close(){throw Error('Must retain close/recovery interface');},querySelectorAll:s=>s==='[data-order]'?orders:notes},bridge:{state:()=>({units:[person],activeId:'pc',hardPaused:true}),consoleTick(){}},unit:person,sicId:'sn',initial:access,window:{SAStationAccess:{access:()=>access},SAShipSensors:{installed:()=>null,inputSettings:()=>({})},SAConsoleCommon:{standby:()=>''}},host:{hidden:false},performance:{now:()=>0},busy:false,beat:-1,selecting:{},scanPoint:{},hexSelected:true,lastMap:'cached'};
  vm.runInNewContext('(function(){'+prelude+'throw Error("Unavailable renderer fell through");})()',context);
  assert.ok(orders.every(b=>b.disabled));assert.match(get('[data-range]').textContent,/unavailable/);
  assert.equal(get('[data-map]').cleared,true);assert.equal(context.lastMap,'');assert.equal(context.selecting,null);
  assert.equal(get('[data-confirm-scan]').disabled,true);assert.equal(nodes.has('[data-leave]'),false,'removed movement shortcut is not touched during offline rendering');
  assert.equal(get('[data-hold]').disabled,false);assert.equal(get('[data-turn]').textContent,'SENSORS UNAVAILABLE');
 }
});
