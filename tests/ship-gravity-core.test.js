const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const gravity=require('../ship-black-holes'),core=require('../ship-gravity-core'),maps=require('../ship-map-core'),distances=require('../ship-distances'),power=require('../ship-power');
// Immutable pre-extraction implementation, with original repository dependencies.
const old={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fixtures/ship-black-holes-before-gravity-extraction.txt'),'utf8'),{module:old,require:p=>require(path.resolve(__dirname,'..',p))});
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const ship=id=>({id,title:id,currentHullHp:100,currentShieldHp:100,ship:{gridCells:[0,1,2,3],placements:[],sicInventory:[],mapHeading:83},auState:{current:9,available:9,maximum:9}});
 const starships=['normal','docked','escaped','warp','immune','unfunded','impaired','dead'].map(ship);
 const room={starships,shipPositions:starships.map(s=>({id:s.id,q:2,r:0})),spaceObjects:[{id:'hole',kind:'black-hole',intensity:3,q:0,r:0},{id:'cargo',kind:'object',q:3,r:0}],units:[]};
 starships[1].dockedIn='bay';starships[2].escapedAt='now';starships[3].ship.warpState={phase:'traveling'};starships[7].currentHullHp=0;
 for(const s of starships.slice(4,7)){
  s.ship.sicInventory=[{id:'g',type:'gravity-absolution-field'},{id:'shield',type:'shield-1'}];s.ship.placements=[{sicId:'g',cell:0},{sicId:'shield',cell:1}];s.ship.gravityFieldState={active:true,sicId:'g',remaining:1,receipts:[]};
 }
 starships[5].auState.current=starships[5].auState.available=0;starships[6].ship.sicInventory[0].impaired=true;
 return room;
}
test('complete production gravity mutations/reports match frozen implementation across partitions and exclusions',()=>{
 for(const steps of [[.2,2.3,2.5,7],[12],[0,-1,NaN,Infinity],[.2,.2,.2]])for(const pull of [true,false]){
  const a=fixture(),b=structuredClone(a);assert(maps.gravityFieldActive(a.starships[4]));
  for(const seconds of steps){assert.deepEqual(plain(gravity.advance(a,seconds,[],pull)),plain(old.exports.advance(b,seconds,[],pull)));assert.deepEqual(plain(a),plain(b));}
 }
});
test('center-crossing destruction and old cadence migration remain equivalent',()=>{
 const a=fixture(),b=structuredClone(a);a.starships[0].ship.gravityFieldState={active:false,pullCycle:{remaining:20,fields:[]}};b.starships[0].ship.gravityFieldState=structuredClone(a.starships[0].ship.gravityFieldState);
 const before=[{id:'normal',q:-2,r:0}];assert.deepEqual(plain(gravity.advance(a,.2,before)),plain(old.exports.advance(b,.2,before)));assert.deepEqual(plain(a),plain(b));assert.equal(a.starships[0].currentHullHp,0);
});
test('browser core and Node core agree on ships, immunity and AU upkeep without scenery simulation',()=>{
 const window={SAShipMap:maps,SAShipDistances:distances,SAShipPower:power};vm.runInNewContext(fs.readFileSync(require.resolve('../ship-gravity-core'),'utf8'),{window});
 const a=fixture(),b=structuredClone(a);for(const seconds of [.5,.5,5,12]){assert.deepEqual(plain(core.advance(a,seconds)),plain(window.SAShipGravityCore.advance(b,seconds)));assert.deepEqual(plain(a),plain(b));}
 assert.equal(a.shipPositions.find(p=>p.id==='docked').q,2);assert.equal(a.starships[0].currentHullHp,0);assert.equal(a.spaceObjects.length,2);
});
