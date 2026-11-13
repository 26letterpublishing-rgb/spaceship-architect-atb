const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const factory=require('../cleanser-rules-core'),viewer=require('../console-viewer');
const plain=x=>JSON.parse(JSON.stringify(x));
function pair(){
 const old={exports:{}},aCalls=[],bCalls=[],crypto={randomUUID:()=> 'fixed-event',randomInt:(min,max)=>min+Math.floor((max-min)/2)};
 const deps={crypto,maps:require('../ship-map-core'),stations:require('../station-access'),power:require('../ship-power'),distances:require('../ship-distances'),shields:require('../ship-shields'),timeline:require('../cleanser-timeline').current,now:()=>100000,relayFired:(...a)=>aCalls.push(a.slice(1).map(x=>x?.id||x))};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fixtures/ship-cleanser-before-core.txt'),'utf8'),{module:old,Date:{now:()=>100000},structuredClone,require:p=>p==='node:crypto'?crypto:p==='./ship-relays'?{fired:(...a)=>bCalls.push(a.slice(1).map(x=>x?.id||x))}:require(path.resolve(__dirname,'..',p))});
 return {current:factory.create(deps),previous:old.exports,aCalls,bCalls,deps};
}
test('shared Cleanser preserves complete production sequence, result replay, exclusions and blast effects',()=>{
 for(const variant of ['ship','planet','moved','warp','docked','shielded']){
  const {current,previous,aCalls,bCalls}=pair(),a=viewer.visualFixture('planetary-cleanser');
  if(variant==='planet')a.spaceObjects.push({id:'planet',kind:'planet',name:'Test',variant:'ice',q:5,r:0});
  if(variant==='shielded'){const s=a.starships[1];s.ship.sicInventory.push({id:'shield',type:'shield-1'});s.ship.placements.push({sicId:'shield',cell:2});require('../ship-shields').refresh(a,{reset:true});}
  const b=structuredClone(a),body={sicId:'preview',kind:'cleanser-charge',targetId:variant==='planet'?'planet':'dummy',receipt:'equivalence-charge'};
  assert.equal(current.command(a,a.units[0],body).ok,true);assert.equal(previous.command(b,b.units[0],body).ok,true);assert.deepEqual(plain(a),plain(b));
  for(const r of [a,b]){if(variant==='moved')r.shipPositions[1].q+=3;if(variant==='warp')r.starships[1].ship.warpState={phase:'traveling'};if(variant==='docked')r.starships[1].dockedIn='bay';}
  for(const seconds of [30,60,30]){assert.deepEqual(plain(current.advance(a,seconds)),plain(previous.advance(b,seconds)));assert.deepEqual(plain(a),plain(b));}
  for(const kind of ['roll','roll','shown','shown','confirm','confirm']){
   current.resolve(a,{eventId:a.planetaryEvent.id,kind},{unit:a.units[0]});previous.resolve(b,{eventId:b.planetaryEvent.id,kind},{unit:b.units[0]});assert.deepEqual(plain(a),plain(b));
  }
  assert.deepEqual(aCalls,bCalls);assert.equal(current.finish(a,a.planetaryEvent.endsAt-1),false);assert.equal(previous.finish(b,b.planetaryEvent.endsAt-1),false);
  assert.equal(current.finish(a,a.planetaryEvent.endsAt),true);assert.equal(previous.finish(b,b.planetaryEvent.endsAt),true);assert.deepEqual(plain(a),plain(b));assert.equal(current.finish(a,1e9),false);
 }
});
test('browser factory uses identical rules and enforces roll ownership',()=>{
 const {deps,current}=pair(),window={};vm.runInNewContext(fs.readFileSync(require.resolve('../cleanser-rules-core'),'utf8'),{window,structuredClone});const browser=window.SACleanserRulesCore.create(deps),a=viewer.visualFixture('planetary-cleanser'),b=structuredClone(a),body={sicId:'preview',kind:'cleanser-charge',targetId:'dummy',receipt:'browser-charge'};
 for(const [rules,room] of [[current,a],[browser,b]]){assert(rules.command(room,room.units[0],body).ok);rules.advance(room,120);assert.throws(()=>rules.resolve(room,{eventId:room.planetaryEvent.id,kind:'roll'},{unit:{id:'other'}}),/operator or GM/);rules.resolve(room,{eventId:room.planetaryEvent.id,kind:'roll'},{unit:room.units[0]});}
 assert.deepEqual(plain(a),plain(b));
});
