const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const weapons=require('../ship-weapons'),maps=require('../ship-map-core'),stations=require('../station-access');
const power=require('../ship-power'),sensors=require('../ship-sensors'),shields=require('../ship-shields'),locks=require('../ship-locks');
const definition={name:'Ballistic Rail Cannon',weapon:true,weaponFamily:'ballistic-rail-cannon',manualOnly:true,noShieldDamage:true,damageCount:6,damageDie:6,tier:1,energyCost:0,fireAu:0};
const order={sicId:'gun',targetId:'b',requestId:'rail-cannon-shot'};

function fixture(t){
  const make=id=>({id,title:id,currentHullHp:80,maximumHullHp:80,currentShieldHp:0,ship:{
    minerals:{Iron:3,Copper:7},defenseScore:10,
    gridCells:Array.from({length:80},(_,n)=>82+Math.floor(n/10)*20+n%10),
    sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-4'},{id:'lock',type:'lock-on-1'},{id:'gun',type:'ballistic-rail-cannon'}],
    placements:[{sicId:'cp',cell:82},{sicId:'sn',cell:83},{sicId:'en',cell:164},{sicId:'lock',cell:84},{sicId:'gun',cell:26}]
  }});
  const a=make('a'),b=make('b'),unit={id:'u',team:'pc',weaponSystemsSkill:6,dexterityDice:[8,6],atb:100,location:{starshipId:'a',sicId:'cp',square:82,mesh:0,stationed:true}};
  const room={starships:[a,b],units:[unit],activeId:'u',threshold:100,showcase:true,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0}],log:[]};
  // The catalog is owned separately. Use its real entry once integrated; otherwise
  // inject only weapon station discovery so gameplay tests can run independently.
  if(!maps.definition('ballistic-rail-cannon').weapon){
    const original=stations.access;
    t.mock.method(stations,'access',(state,person,sicId)=>{
      if(sicId!=='gun')return original(state,person,sicId);
      const seat=stations.station(state,person),item=seat?.ship.ship.sicInventory.find(i=>i.id===sicId);
      if(!seat||!maps.definition(seat.cell.type).bridge||!stations.online(item)||!seat.ship.ship.placements.some(p=>p.sicId===sicId))return null;
      return {ship:seat.ship,item,definition,id:sicId,seat,kind:'weapon',remote:true};
    });
  }
  a.sensorScenarioMasking=b.sensorScenarioMasking=10;
  power.refresh(room,{reset:true});sensors.refresh(room);
  return {room,a,b,unit,gun:a.ship.sicInventory.find(i=>i.id==='gun')};
}
function resolve(room,unit,score=11){
  const roll=()=>{throw Error('Unexpected automatic roll');};roll.submittedScore=score;
  weapons.resolveInput(room,unit,roll,roll);
}
function shield(room,target,hp=1){
  target.ship.sicInventory.push({id:'shield',type:'shield-1'});
  target.ship.placements.push({sicId:'shield',cell:85});
  shields.refresh(room);shields.entries(target)[0].state.hp=hp;shields.refresh(room);
}

test('rail cannon starts at 6D6, loses two dice per impairment, and never boosts',()=>{
  for(const [item,count] of [[{},6],[{impaired:true},4],[{status:'impaired'},4],[{impairmentPoints:1},4],[{impairmentPoints:2},2],[{impairmentPoints:3},0],[{impairmentPoints:4},0]]){
    const shot=weapons.profile(definition,item,100,{boosts:10,sacrifice:3});
    assert.equal(shot.count,count);assert.equal(shot.cost,0);assert.equal(shot.bonus,0);assert.equal(shot.boostAllowed,false);
  }
});

test('manual accuracy remains mandatory with a controlled component lock',t=>{
  const {room,a,b,unit}=fixture(t);
  locks.state(a).targets.push({targetId:'b',systemId:'lock',controllerUnitId:'u',sicId:'lock'});
  assert.ok(weapons.weaponLock(room,unit,a,'b'));
  assert.equal(weapons.queue(room,unit,order).ok,true);
  assert.equal(unit.delayedAction.rollConfirmed,undefined);
  assert.equal(unit.delayedAction.weaponOrder.locked,undefined);
  assert.equal(unit.delayedAction.weaponOrder.targetSicId,null);
  assert.equal(unit.delayedAction.settings.base,10);assert.equal(unit.delayedAction.settings.factors.Quality,1);
  resolve(room,unit,9);
  assert.equal(unit.delayedAction,null);assert.equal(b.currentHullHp,80);
  assert.equal(a.weaponState.reports[0].hit,false);assert.equal(a.ship.minerals.Iron,2);
});

test('a serialized rail order cannot inherit automatic lock-hit behavior',t=>{
  const {room,a,unit}=fixture(t);assert.equal(weapons.queue(room,unit,order).ok,true);
  unit.delayedAction.weaponOrder.locked=true;
  resolve(room,unit,9);
  assert.equal(unit.delayedAction,null);assert.equal(a.weaponState.reports[0].hit,false);
  assert.equal(a.weaponState.reports[0].total,9);
});

test('accepted shots consume Iron once across retries, misses, and serialization',t=>{
  const {room,a,unit}=fixture(t);
  assert.equal(weapons.queue(room,unit,order).ok,true);
  assert.equal(weapons.queue(room,unit,order).duplicate,true);assert.equal(a.ship.minerals.Iron,2);
  const saved=JSON.parse(JSON.stringify(room)),actor=saved.units[0],ship=saved.starships[0];
  assert.equal(weapons.queue(saved,actor,order).duplicate,true);
  resolve(saved,actor,9);
  assert.equal(weapons.queue(saved,actor,order).duplicate,true);assert.equal(ship.ship.minerals.Iron,2);
  assert.equal(weapons.queue(saved,actor,{...order,requestId:'rail-second-shot'}).ok,true);
  resolve(saved,actor,9);assert.equal(ship.ship.minerals.Iron,1);assert.equal(ship.ship.minerals.Copper,7);
});

test('missing, fractional, negative, string, and nonfinite Iron cannot fire',t=>{
  const {room,a,unit}=fixture(t);
  for(const value of [undefined,null,0,-1,0.5,1.5,'3',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    a.ship.minerals.Iron=value;
    assert.match(weapons.queue(room,unit,order).error,/1 Iron/);
    assert.equal(unit.delayedAction,undefined);assert.equal(a.weaponState.receipts.length,0);
  }
  delete a.ship.minerals;assert.match(weapons.queue(room,unit,order).error,/1 Iron/);
  a.ship.minerals={Iron:1};assert.equal(weapons.queue(room,unit,order).ok,true);
  assert.equal(a.ship.minerals.Iron,0);assert.equal(weapons.queue(room,unit,order).duplicate,true);
});

test('invalid fire options, no dice, and turn rejection do not spend Iron',t=>{
  const {room,a,unit,gun}=fixture(t);
  for(const body of [{boosts:1},{sacrifice:1},{boosts:-1},{boosts:0.5},{requestId:'bad'},{targetId:'missing'}]){
    assert.equal(weapons.queue(room,unit,{...order,...body}).ok,false);assert.equal(a.ship.minerals.Iron,3);
  }
  gun.impairmentPoints=3;assert.match(weapons.queue(room,unit,order).error,/No damage dice/);
  gun.impairmentPoints=0;room.activeId='other';assert.equal(weapons.queue(room,unit,order).ok,false);
  assert.equal(a.ship.minerals.Iron,3);assert.equal(unit.delayedAction,undefined);
});

test('rail fire needs no EN or AU and repeat fire adds no charge',t=>{
  const {room,a,unit}=fixture(t);
  a.ship.sicInventory.find(i=>i.id==='en').status='powered-down';power.refresh(room);
  assert.equal(power.output(a,room.units).en,0);assert.equal(a.auState.current,0);
  for(let n=0;n<2;n++){
    assert.equal(weapons.queue(room,unit,{...order,requestId:`rail-zero-power-${n}`}).ok,true);
    resolve(room,unit,9);assert.equal(a.auState.current,0);
  }
  assert.equal(a.ship.minerals.Iron,1);
});

test('hits wait for manual 6D6 confirmation, retain GM ownership, and resolve only once',t=>{
  const {room,a,b,unit}=fixture(t);assert.equal(weapons.queue(room,unit,order).ok,true);
  unit.delayedAction.rollController='gm';resolve(room,unit);
  assert.equal(b.currentHullHp,80);assert.equal(unit.delayedAction.rollController,'gm');
  assert.equal(unit.delayedAction.awaitingRoll,true);assert.deepEqual(unit.delayedAction.rollSpec.sides,[6,6,6,6,6,6]);
  assert.equal(unit.delayedAction.rollSpec.damage,true);assert.equal(unit.delayedAction.consumeTurn,false);
  const saved=JSON.parse(JSON.stringify(room)),actor=saved.units[0];
  assert.throws(()=>weapons.resolveDamage(saved,actor,[],37),/damage dice/);
  assert.throws(()=>weapons.resolveDamage(saved,actor,[],5),/damage dice/);
  const report=weapons.resolveDamage(saved,actor,[],21);
  assert.equal(report.hullDamage,21);assert.equal(report.shieldDamage,0);assert.equal(saved.starships[1].currentHullHp,59);
  weapons.resolveDamage(saved,actor,[],21);assert.equal(saved.starships[1].currentHullHp,59);
  assert.equal(a.ship.minerals.Iron,2);assert.equal(saved.starships[0].ship.minerals.Iron,2);
});

test('current impairment controls damage, including impairment gained during Fast input',t=>{
  const {room,b,unit,gun}=fixture(t);assert.equal(weapons.queue(room,unit,order).ok,true);
  gun.impairmentPoints=2;resolve(room,unit,100);
  assert.deepEqual(unit.delayedAction.rollSpec.sides,[6,6]);
  weapons.resolveDamage(room,unit,[4,5]);assert.equal(b.currentHullHp,71);
  assert.equal(weapons.queue(room,unit,{...order,requestId:'rail-impaired-shot'}).ok,true);
  gun.impairmentPoints=3;resolve(room,unit,100);assert.equal(unit.delayedAction,null);assert.equal(b.currentHullHp,71);
});

test('shielded hits consume ammo but never damage shields, hull, or prompt damage',t=>{
  const {room,a,b,unit}=fixture(t);shield(room,b);
  assert.equal(weapons.queue(room,unit,order).ok,true);resolve(room,unit,100);
  assert.equal(a.ship.minerals.Iron,2);assert.equal(b.currentHullHp,80);assert.equal(b.currentShieldHp,1);
  assert.equal(unit.delayedAction,null);assert.equal(a.weaponState.reports[0].awaitingDamage,false);
  assert.equal(a.weaponState.reports[0].blockedByShields,true);assert.match(a.weaponState.reports[0].text,/No effect/);
});

test('shield checks refresh stale totals and protect aggregate-only shields',t=>{
  const {room,a,b,unit}=fixture(t);shield(room,b);b.currentShieldHp=0;
  assert.equal(weapons.queue(room,unit,order).ok,true);resolve(room,unit);
  assert.equal(unit.delayedAction,null);assert.equal(b.currentShieldHp,1);
  b.ship.sicInventory=b.ship.sicInventory.filter(i=>i.id!=='shield');delete b.shieldSystems;b.currentShieldHp=5;
  assert.equal(weapons.queue(room,unit,{...order,requestId:'rail-aggregate-shield'}).ok,true);resolve(room,unit);
  assert.equal(unit.delayedAction,null);assert.equal(b.currentHullHp,80);assert.equal(b.currentShieldHp,5);
  assert.equal(a.ship.minerals.Iron,1);
});

test('burst or offline shields permit manual hull damage',t=>{
  const {room,b,unit}=fixture(t);shield(room,b,0);
  assert.equal(weapons.queue(room,unit,order).ok,true);resolve(room,unit);
  weapons.resolveDamage(room,unit,[1,2,3,4,5,6]);assert.equal(b.currentHullHp,59);
  shields.entries(b)[0].state.hp=10;b.ship.sicInventory.find(i=>i.id==='shield').status='powered-down';
  assert.equal(weapons.queue(room,unit,{...order,requestId:'rail-offline-shield'}).ok,true);resolve(room,unit);
  weapons.resolveDamage(room,unit,[],6);assert.equal(b.currentHullHp,53);
});

test('shields recovering during manual damage confirmation protect hull and remain intact',t=>{
  const {room,a,b,unit}=fixture(t);assert.equal(weapons.queue(room,unit,order).ok,true);resolve(room,unit);
  shield(room,b,1);
  const entry=weapons.resolveDamage(room,unit,[6,6,6,6,6,6]);
  assert.equal(entry.hullDamage,0);assert.equal(entry.shieldDamage,0);
  assert.equal(b.currentHullHp,80);assert.equal(b.currentShieldHp,1);assert.equal(unit.delayedAction,null);assert.equal(a.ship.minerals.Iron,2);
});

test('interrupted input keeps committed ammunition without generating damage',t=>{
  const {room,a,b,unit}=fixture(t);assert.equal(weapons.queue(room,unit,order).ok,true);
  unit.location.stationed=false;resolve(room,unit,100);
  assert.equal(a.ship.minerals.Iron,2);assert.equal(b.currentHullHp,80);assert.equal(unit.delayedAction,null);
  assert.match(a.weaponState.reports[0].text,/interrupted.*Iron/);
});

test('console displays Iron, manual-only fire, shield immunity, and disables empty ammo',t=>{
  const {room,a,unit}=fixture(t),nodes=new Map(),intervals=[];
  function node(){return {value:'0',textContent:'',innerHTML:'',hidden:false,disabled:false,validity:{valid:true},dataset:{},style:{},options:[0,1,2,3].map(value=>({value:String(value)})),
    clientWidth:300,clientHeight:200,viewBox:{baseVal:{x:0,y:0,width:10,height:10}},classList:{contains:()=>false},
    append(){},prepend(){},before(){},after(){},setAttribute(){},addEventListener(){},showModal(){},closest(){return this;},querySelectorAll(){return [];},
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}};}
  const document={...node(),defaultView:{frameElement:null},body:node(),head:node(),createElement:node,querySelector:()=>null};
  const window={SACombatBridge:{state:()=>room,soundIcon:()=>'',delayIcon:()=>'',consoleTick(){},resumeAudio(){}},
    SAShipLocks:locks,SAStationAccess:stations,SAShipWeapons:weapons,SAShipSensors:sensors,SASpaceMap:{markup:()=>'',update(){}} ,
    SAShipNavigationUI:{mountSelector(){}},SAConsoleCommon:{updateSound(){}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','weapon-console-ui.js'),'utf8'),{
    window,document,location:{href:'http://localhost/'},URL,performance:{now:()=>0},setInterval:callback=>intervals.push(callback)
  });
  locks.state(a).targets.push({targetId:'b',systemId:'lock',controllerUnitId:'u'});
  window.SAWeaponConsoleUI.open(unit,'gun');
  assert.match(nodes.get('[data-au]').textContent,/3 IRON.*1 PER SHOT.*0 EN.*0 AU/);
  assert.equal(nodes.get('.weapon-plot h3 span').textContent,'MANUAL ONLY');
  assert.match(nodes.get('[data-formula]').textContent,/6D6.*Manual only.*No shield damage/);
  assert.doesNotMatch(nodes.get('[data-warning]').textContent,/automatic hit/);
  assert.equal(nodes.get('[data-fire]').disabled,false);
  a.ship.minerals.Iron=0;intervals.at(-1)();
  assert.equal(nodes.get('[data-fire]').disabled,true);assert.match(nodes.get('[data-warning]').textContent,/Out of ammunition/);
  a.ship.minerals.Iron=2;a.ship.sicInventory.find(i=>i.id==='gun').impairmentPoints=3;intervals.at(-1)();
  assert.equal(nodes.get('[data-fire]').disabled,true);assert.match(nodes.get('[data-warning]').textContent,/repair the cannon/);
});
