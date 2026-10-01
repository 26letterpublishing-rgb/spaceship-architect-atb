const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),shields=require('../ship-shields'),power=require('../ship-power'),sensors=require('../ship-sensors'),commands=require('../ship-commands'),hacking=require('../ship-hacking'),stations=require('../station-access');
function hull(count=30){return {gridCells:Array.from({length:count},(_,i)=>21+Math.floor(i/10)*20+i%10),sicInventory:[],placements:[],doorStates:{}};}
function add(ship,type,id=type,attachTo='hull',cell=ship.gridCells[0]){const item={id,type,attachTo,storage:false};ship.sicInventory.push(item);ship.placements.push({sicId:id,cell});return item;}
test('printed Hull/Static card prices, zero-footprint hosts and source identifiers are retained',()=>{
 for(const [type,price,card,host]of [['hull-plating',450,'B-68','hull'],['heat-resistance',75,'B-69','hull'],['laser-resistance',300,'B-70','hull'],['static-shield',35000,'A-59','shield']]){
  const d=maps.definition(type);assert.equal(d.price,price);assert.equal(d.cardNumber,card);assert.equal(d.addon,host);assert.equal(d.threshold,null);assert.equal(d.width,0);assert.equal(d.height,0);assert.deepEqual(d.stations,[]);
  assert.deepEqual(maps.placementParts({type},{cell:21}),[]);assert.ok(d.floorplanPreview);
 }
 assert.equal(maps.definition('static-shield').energyCost,3);assert.equal(maps.definition('static-shield').security,3);
});
test('Hull Plating adds rounded-down ten percent per Scale Rank without raising the rank',()=>{
 for(const [count,rank]of [[3,1],[26,1],[27,2],[50,2],[51,3],[100,3],[101,4],[200,4],[201,5],[400,5]]){
  const ship=hull(count);add(ship,'hull-plating');assert.equal(maps.scaleRank(ship),rank);assert.equal(maps.hullHp(ship),count+Math.floor(count*rank/10));
 }
 const ship={...hull(3),gridCells:[21,22,41],triangleCells:[42]};add(ship,'hull-plating');assert.equal(maps.hullSections(ship),4);assert.equal(maps.hullHp(ship),4);assert.equal(maps.scaleRank(ship),1);
});
test('Hull upgrades share squares without floorplans and reject duplicates, forged hosts and storage',()=>{
 const ship=hull();for(const type of ['hull-plating','heat-resistance','laser-resistance'])add(ship,type);
 assert.equal(maps.exteriorError(ship),'');assert.equal(maps.buildLayout(ship).footprint.size,0);
 const duplicate=structuredClone(ship);add(duplicate,'hull-plating','second');assert.match(maps.exteriorError(duplicate),/Only one Hull Plating/);
 const bad=structuredClone(ship);bad.sicInventory[0].attachTo='other';assert.match(maps.exteriorError(bad),/attached/);
 const stored=structuredClone(ship);stored.placements=stored.placements.slice(1);stored.sicInventory[0].storage=true;assert.match(maps.exteriorError(stored),/Storage/);
});
test('prices follow all Hull sections and resizing never double-charges a newly purchased upgrade',()=>{
 const before=hull(10);for(const type of ['hull-plating','heat-resistance','laser-resistance']){const item=add(before,type);item.purchasePrice=maps.sicPrice(item,before);}
 assert.equal(before.sicInventory.reduce((n,i)=>n+maps.sicPrice(i),0),8250);
 const after=structuredClone(before);after.gridCells.push(61,62);assert.equal(maps.hullUpgradeResizeCost(after,before),1650);
 assert.equal(maps.sicPrice(after.sicInventory[0],after),5400);
 const shrink=structuredClone(before);shrink.gridCells.pop();assert.equal(maps.hullUpgradeResizeCost(shrink,before),-825);
 const fresh=hull(12),item=add(fresh,'hull-plating');item.pendingPurchase=true;assert.equal(maps.hullUpgradeResizeCost(fresh,hull(10)),0);assert.equal(maps.sicPrice(item,fresh),5400);
 after.sicInventory[0].pendingDisposition='sell';assert.equal(maps.hullUpgradeResizeCost(after,before),750);assert.equal(Math.ceil(maps.sicPrice(before.sicInventory[0])/2),2250);
 const triangle={...hull(3),gridCells:[21,22,41],triangleCells:[42]};const coating=add(triangle,'heat-resistance');assert.equal(maps.sicPrice(coating,triangle),300);
});
test('builder cancelling a Hull upgrade sale restores coverage and pending prices follow Hull resizing',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../starship.js'),'utf8');
 const draft=hull(12),item=add(draft,'hull-plating');Object.assign(item,{purchasePrice:4500,pendingDisposition:'sell',storage:true});
 const context={draft,SIC_CATALOG:maps.catalog,window:{SAShipMap:maps},rememberForUndo(){},saveDraft(){},showMessage(){},renderAll(){},placementForSic:id=>draft.placements.find(p=>p.sicId===id)};
 for(const [name,next]of [['sicDefinition','placementCells'],['keepSicDisposition','markSicDisposition']]){const start=source.indexOf('function '+name+'(');vm.runInNewContext(source.slice(start,source.indexOf('function '+next+'(',start)),context);}
 context.keepSicDisposition(item);assert.equal(item.storage,false);assert.equal(item.pendingDisposition,'');assert.equal(maps.exteriorError(draft),'');assert.equal(maps.hullHp(draft),13);
 assert.equal(context.sicDefinition(item).price,4500,'Confirmed item resale uses its last confirmed cost');item.pendingPurchase=true;assert.equal(context.sicDefinition(item).price,5400,'Pending item displays the entire current Hull price');
 draft.placements=[];item.pendingDisposition='sell';item.storage=true;context.keepSicDisposition(item);assert.equal(draft.placements.length,1);assert.equal(maps.exteriorError(draft),'');
});
test('laser and heat resistance reduce only their typed Hull hits and preserve the shield-layer stop',()=>{
 const ship={id:'ship',currentHullHp:100,ship:hull()};add(ship.ship,'laser-resistance');add(ship.ship,'heat-resistance');
 const room={starships:[ship],units:[]};shields.damage(room,ship.id,11,{damageType:'laser'});assert.equal(ship.currentHullHp,95);
 shields.damage(room,ship.id,11,{damageType:'heat'});assert.equal(ship.currentHullHp,92.25);
 shields.damage(room,ship.id,11,{damageType:'ballistic'});assert.equal(ship.currentHullHp,81.25);
 shields.damage(room,ship.id,11);assert.equal(ship.currentHullHp,70.25);
 add(ship.ship,'shield-1','host',null,24);shields.refresh(room);shields.damage(room,ship.id,11,{damageType:'laser'});assert.equal(ship.shieldSystems.host.hp,0);assert.equal(ship.currentHullHp,70.25,'A burst never spills resistant or raw excess onto Hull');
 ship.shieldSystems.host.hp=10;shields.damage(room,ship.id,8,{damageType:'heat',bypassShield:true});assert.equal(ship.currentHullHp,68.25);assert.equal(ship.shieldSystems.host.hp,10);
});
test('Static Shields follow their specific operational host, cost 3 EN and never stack Masking',()=>{
 const ship={id:'ship',ship:hull(),currentHullHp:100};add(ship.ship,'shield-1','first',null);add(ship.ship,'shield-2','second',null,23);const first=add(ship.ship,'static-shield','static-first','first');add(ship.ship,'static-shield','static-second','second',23);
 const room={starships:[ship],units:[]};shields.refresh(room);const base=maps.propulsion(ship).hsm;assert.equal(maps.masking(ship),base+4);assert.equal(power.demand(ship),5+10+5+6);
 ship.shieldSystems.first.hp=0;assert.equal(maps.staticShieldActive(ship),true);ship.shieldSystems.second.hp=0;assert.equal(maps.staticShieldActive(ship),false);assert.equal(maps.masking(ship),base);
 ship.shieldSystems.first.hp=10;first.disabled=true;assert.equal(maps.staticShieldActive(ship),false);first.disabled=false;ship.ship.sicInventory.find(i=>i.id==='first').disabled=true;assert.equal(maps.staticShieldActive(ship),false);
 ship.ship.sicInventory.find(i=>i.id==='first').disabled=false;add(ship.ship,'static-shield','duplicate','first');assert.match(maps.exteriorError(ship.ship),/Only one Static/);
 const wrong=hull();add(wrong,'life-support','life',null);add(wrong,'static-shield','static','life');assert.match(maps.exteriorError(wrong),/attached.*shield/);
});
function encounter(){
 const make=id=>{const ship={id,title:id,currentHullHp:100,ship:hull(80),sensorScenarioMasking:1};add(ship.ship,'cockpit-1','bridge',null,21);add(ship.ship,'sensors-3','sensor',null,22);add(ship.ship,'hacking-module-5','hacking',null,23);add(ship.ship,'en-engine-6','power',null,101);return ship;};
 const source=make('source'),target=make('target');add(target.ship,'shield-1','shield',null,24);add(target.ship,'static-shield','static','shield',24);
 const unit={id:'operator',team:'pc',characterName:'Operator',currentHp:20,atb:100,speed:5,hackingSkill:5,turnSerial:7,location:{starshipId:source.id,sicId:'bridge',square:21,mesh:0,stationed:true}};
 const room={showcase:true,hasEngagedClock:true,activeId:unit.id,threshold:100,starships:[source,target],units:[unit],log:[],shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:1,r:0}]};
 shields.refresh(room);sensors.refresh(room);sensors.knowledge(source).analyses[target.id]={layout:structuredClone(target.ship)};return {room,source,target,unit};
}
test('Static Shields block incoming hacking while up; host burst/offline permits normal access',()=>{
 const {room,target,unit}=encounter(),open=requestId=>hacking.command(room,unit,{kind:'open',sicId:'hacking',targetId:target.id,targetSicId:'bridge',requestId});
 assert.throws(()=>open('static-blocked'),/Hacking Bug/);target.shieldSystems.shield.hp=0;assert.ok(open('static-burst').sessionId);
 const session=hacking.state(room).sessions[0];assert.equal(hacking.connected(room,session),true);target.shieldSystems.shield.hp=10;assert.equal(hacking.connected(room,session),false);
 target.ship.sicInventory.find(i=>i.id==='static').disabled=true;assert.equal(hacking.connected(room,session),true);
});
test('an active attached Hacking Bug bypasses Static Shields without removing the field or Masking',()=>{
 const {room,source,target,unit}=encounter();add(source.ship,'probe-launcher','launcher',null,26);add(source.ship,'probe-1','probe','launcher',26);add(source.ship,'hacking-bug','bug','probe',26);
 source.ship.probeState={probes:{probe:{id:'deployed',sicId:'probe',launcherId:'launcher',phase:'attached',targetId:target.id,position:{q:1,r:0},bugActive:true}},launchers:{},receipts:[],reports:[]};
 const session={id:'session',unitId:unit.id,sourceId:source.id,targetId:target.id,moduleId:'hacking',sicId:'bridge',station:stations.station(room,unit).key};
 assert.equal(require('../ship-probes').bugLink(room,source,target),true);assert.equal(hacking.connected(room,session),true);assert.equal(maps.staticShieldActive(target),true);
 source.ship.probeState.probes.probe.bugActive=false;assert.equal(hacking.connected(room,session),false);
});
test('active Static Shields reject hails, cancel in-flight hail input and close existing calls on either side',()=>{
 const {room,source,target,unit}=encounter(),body={kind:'hail',sicId:'bridge',targetId:target.id,disclosedPosition:{q:0,r:0},requestId:'static-hail-start'};
 assert.match(commands.queue(room,unit,body).error,/Static Shields/);assert.equal(unit.delayedAction,undefined);
 target.shieldSystems.shield.hp=0;assert.equal(commands.queue(room,unit,body).ok,true);target.shieldSystems.shield.hp=10;commands.resolveInput(room,unit,()=>1);assert.match(source.sensorState.reports[0].text,/Hail cancelled: Static/);
 target.shieldSystems.shield.hp=0;assert.equal(commands.queue(room,unit,{...body,requestId:'static-hail-again'}).ok,true);commands.resolveInput(room,unit,()=>1);
 const call=target.commandSystems.calls[0];assert.equal(call.status,'incoming');target.shieldSystems.shield.hp=10;
 const targetUnit={...unit,id:'target-unit',location:{...unit.location,starshipId:target.id}};room.units.push(targetUnit);
 assert.match(commands.queue(room,targetUnit,{kind:'accept',sicId:'bridge',callId:call.id,requestId:'static-hail-accept'}).error,/Static Shields/);
 commands.reconcileCalls(room);assert.equal(call.status,'closed');assert.equal(source.commandSystems.calls[0].status,'closed');
 target.shieldSystems.shield.hp=0;add(source.ship,'shield-1','own-shield',null,24);add(source.ship,'static-shield','own-static','own-shield',24);shields.refresh(room);assert.match(commands.queue(room,unit,{...body,requestId:'static-outgoing'}).error,/Static Shields/);
});
