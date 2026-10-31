const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('shield-console-ui.js','utf8');
const readout=vm.runInNewContext('('+source.match(/function restoreReadout\(value,au\)\{[\s\S]*?\n  \}/)[0]+')');
test('restore readout uses current rather than spendable AU and refreshes quantity/state',()=>{
 assert.equal(readout('3',{current:26,available:11,reserved:15,maximum:40}),'Restore cost: 15 AU / Current AU: 26 / Max AU: 40');
 assert.equal(readout('2',{current:7,available:0,maximum:80}),'Restore cost: 10 AU / Current AU: 7 / Max AU: 80');
 for(const n of ['',0,-1,1.5,101,'bad'])assert.match(readout(n,{}),/^Restore cost: — AU/);
 assert.match(source,/amount.oninput=redraw/);assert.match(source,/setInterval\(redraw,200\)/);
});
test('displayed cost agrees with real restoration commands; reservations still reject purchases',()=>{
 const shields=require('../ship-shields'),power=require('../ship-power');
 for(const count of [1,2,5]){
  const ship={id:'ship',currentHullHp:20,ship:{gridCells:[21,22,23,24,41,42,43,44],sicInventory:[{id:'shield',type:'shield-1'},{id:'au',type:'au-engine-6'}],placements:[{sicId:'shield',cell:21},{sicId:'au',cell:44}]}};
  const unit={id:'local',speed:5,atb:25,engineeringSkill:0,location:{starshipId:'ship',sicId:'shield',square:21,mesh:0,stationed:true}};
  const room={units:[unit],starships:[ship],threshold:100};shields.refresh(room);power.refresh(room,{reset:true});ship.shieldSystems.shield.hp=1;ship.auState.current=30;
  const result=shields.command(room,unit,{sicId:'shield',kind:'restore',amount:count,requestId:'readout-first'});assert.equal(result.ok,true,result.error);
  assert.ok(readout(count,ship.auState).startsWith(`Restore cost: ${ship.auCommands[0].cost} AU`));
  ship.auCommands=[];ship.auState.current=5;const other={...unit,id:'other'};room.units.push(other);
  assert.equal(shields.command(room,other,{sicId:'shield',kind:'restore',amount:1,requestId:'reserve-other'}).ok,true);
  const denied=shields.command(room,unit,{sicId:'shield',kind:'restore',amount:1,requestId:'readout-second'});assert.equal(denied.ok,false);assert.match(denied.error,/Auxiliary/);
 }
});
