const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const health=require('../health-display'),maps=require('../ship-map-core'),sensors=require('../ship-sensors'),shields=require('../ship-shields');

function vessel(id='target'){
 return {id,title:id,currentHullHp:100,maximumHullHp:100,ship:{gridCells:[0,1,2,3,4,5],sicInventory:[
  {id:'outer',type:'shield-2'},{id:'inner',type:'shield-1'},{id:'reserve',type:'shield-3'},{id:'stored',type:'shield-10'}
 ],placements:[{sicId:'outer',cell:0},{sicId:'inner',cell:2},{sicId:'reserve',cell:3}],doorStates:{}},
 shieldSystems:{outer:{hp:10},inner:{hp:0},reserve:{hp:30},stored:{hp:100}}};
}
const icons=markup=>(markup.match(/class="sa-health-icon shield /g)||[]).length;
test('three icons represent every installed shield separately, including an empty burst layer',()=>{
 const ship=vessel(),layers=health.shieldLayers(ship),markup=health.shields(ship);
 assert.deepEqual(layers,[{current:10,maximum:20},{current:0,maximum:10},{current:30,maximum:30}]);
 assert.equal(icons(markup),9);assert.equal((markup.match(/class="sa-shield-group"/g)||[]).length,3);
 assert.equal((markup.match(/shield full/g)||[]).length,4);assert.equal((markup.match(/shield half/g)||[]).length,1);assert.equal((markup.match(/shield empty/g)||[]).length,4);
 assert.doesNotMatch(markup,/<small>/);assert.match(health.shields(ship,true),/10\/20/);
 const css=fs.readFileSync(require.resolve('../health-display.css'),'utf8');assert.match(css,/sa-shield-groups[^}]*flex-wrap: wrap[^}]*gap: 5px 12px/s);
});
test('shield groups retain inventory order as damage changes the next layer to be struck',()=>{
 const ship=vessel(),room={starships:[ship],units:[]};shields.refresh(room);shields.damage(room,ship.id,100000);
 assert.deepEqual(health.shieldLayers(ship).map(layer=>layer.current),[0,0,30]);
 assert.equal(icons(health.shields(ship)),9);assert.equal(ship.currentHullHp,100);
});
test('offline, disabled and destroyed installed shields retain empty groups; stored shields do not appear',()=>{
 const ship=vessel();ship.ship.sicInventory[0].disabled=true;ship.ship.sicInventory[1].status='offline';ship.ship.sicInventory[2].status='destroyed';
 assert.deepEqual(health.shieldLayers(ship).map(layer=>layer.current),[0,0,0]);assert.equal(icons(health.shields(ship)),9);
 const plain={ship:{sicInventory:[{id:'stored',type:'shield-1'}],placements:[]}};assert.equal(health.shields(plain),'');
});
test('unscanned contacts never reveal shield count and analyzed condition readings never become exact HP',()=>{
 assert.equal(health.shields({...vessel(),contactOnly:true,shieldConditions:[6,4,0]}),'');
 const contact={analyzedContact:true,shieldConditions:[6,3,0],ship:{sicInventory:[],placements:[]}};
 assert.equal(icons(health.shields(contact,true)),9);assert.doesNotMatch(health.shields(contact,true),/<small>|6\/6|3\/6/);
});
function mapApi(){const context={window:{SAHealthDisplay:health,SAShipMap:maps},document:{addEventListener(){}}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../space-map'),'utf8'),context);return context.window.SASpaceMap;}
test('starmap allocates room for two or three shield groups and retains Hull fallback',()=>{
 const space=mapApi();
 for(const count of [1,2,3,4]){
  const ship={id:'known',analyzedContact:true,shieldConditions:Array.from({length:count},(_,i)=>i%2?0:6),currentHullHp:4,maximumHullHp:6};
  const markup=space.conditionMarkup(ship,1,null);assert.equal(icons(markup),count*3);
  const width=Number(markup.match(/<foreignObject[^>]*width="([^"]+)"/)[1]),height=Number(markup.match(/<foreignObject[^>]*height="([^"]+)"/)[1]);
  assert.ok(width>=Math.min(3,count)*51+(Math.min(3,count)-1)*12);assert.ok(height>=Math.ceil(count/3)*20);
 }
 const hull=space.conditionMarkup({id:'plain',analyzedContact:true,shieldConditions:[],currentHullHp:3,maximumHullHp:6},1);
 assert.equal(icons(hull),0);assert.equal((hull.match(/sa-health-icon hull/g)||[]).length,3);
 assert.equal(space.conditionMarkup({...vessel(),contactOnly:true},1), '');
});
function sensorFixture(){
 const observer={id:'observer',title:'Observer',currentHullHp:50,maximumHullHp:50,ship:{gridCells:[0],placements:[{sicId:'sensor',cell:0}],sicInventory:[{id:'sensor',type:'sensors-9'}],doorStates:{}}};
 const target=vessel();target.sensorScenarioMasking=1;observer.sensorScenarioMasking=1;
 const room={showcase:true,starships:[observer,target],units:[],log:[],shipPositions:[{id:observer.id,q:0,r:0},{id:target.id,q:1,r:0}]};
 shields.refresh(room);sensors.detect(room,observer,target);return {room,observer,target};
}
test('sensor projection reveals per-system six-step readings only after analysis and refreshes damaged layers',()=>{
 const {room,observer,target}=sensorFixture();let view=sensors.view(room,observer.id),contact=view.starships.find(s=>s.id===target.id);
 assert.equal(contact.shieldConditions,undefined);assert.equal(view.starships[0].sensorState.contacts[target.id].shieldConditions,undefined);
 observer.sensorState.contacts[target.id].shieldConditions=[6,6,6];
 view=sensors.view(room,observer.id);assert.equal(view.starships.find(s=>s.id===target.id).contact.shieldConditions,undefined);assert.equal(view.starships[0].sensorState.contacts[target.id].shieldConditions,undefined,'Stale intelligence must not reveal installed count without analysis');
 observer.sensorState.analyses[target.id]={layout:structuredClone(target.ship)};sensors.refresh(room);
 contact=sensors.view(room,observer.id).starships.find(s=>s.id===target.id);assert.deepEqual(contact.shieldConditions,[3,0,6]);assert.equal(contact.shieldSystems,undefined);assert.deepEqual(Object.keys(contact.contact).filter(key=>key==='shieldSystems'),[]);
 shields.damage(room,target.id,100000);sensors.refresh(room);contact=sensors.view(room,observer.id).starships.find(s=>s.id===target.id);assert.deepEqual(contact.shieldConditions,[0,0,6]);assert.equal(icons(health.shields(contact)),9);
 target.ship.sicInventory.push({id:'new-secret-shield',type:'shield-4'});target.ship.placements.push({sicId:'new-secret-shield',cell:5});shields.refresh(room);sensors.refresh(room);
 contact=sensors.view(room,observer.id).starships.find(s=>s.id===target.id);assert.deepEqual(contact.shieldConditions,[0,0,6]);assert.doesNotMatch(JSON.stringify(contact),/new-secret-shield/,'Old analysis cannot reveal later equipment additions');
});
test('completed analysis stores each shield snapshot and projection works before the next sensor tick',()=>{
 const {room,observer,target}=sensorFixture(),effect={id:'report',sensorReport:{shipId:observer.id,targetId:target.id,values:[6,6],total:12}},unit={queuedEffects:[effect]};
 sensors.resolveReport(room,unit,effect);
 assert.deepEqual(observer.sensorState.analyses[target.id].shield.layers,health.shieldLayers(target));
 assert.deepEqual(sensors.view(room,observer.id).starships.find(s=>s.id===target.id).shieldConditions,[3,0,6]);
});
test('campaign ship tabs receive persisted per-system HP only for assigned crew and GM',async()=>{
 const {CampaignApi}=require('../campaign-api'),stored=new Map(),store={async create(c){stored.set(c.code,structuredClone(c));return true;},async get(code){return stored.get(code);},async save(c){stored.set(c.code,structuredClone(c));},async findByName(){return [];}};
 const api=new CampaignApi({store});let response;
 await api.handle({method:'POST'},{},new URL('http://local/api/campaign/create'),async()=>({name:'Shield groups',gmCode:'test-shield'}),(_res,status,body)=>{response={status,body};});
 assert.equal(response.status,201);const {code}=response.body.campaign,campaign=await api.campaign(code),record=vessel('assigned');
 record.controlType='pc';record.crewCharacterIds=['owner'];delete record.shieldSystems;campaign.starships=[record];
 campaign.encounter={encounterEndedAt:Date.now(),starships:[vessel('assigned')],units:[]};
 campaign.encounter.starships[0].shieldSystems.outer.protection=99;
 const owner=api.newSession(code,'character','owner'),outsider=api.newSession(code,'character','outsider');
 for(const token of [owner,response.body.token]){
  const shown=api.state(campaign,token).starships[0];assert.deepEqual(health.shieldLayers(shown).map(layer=>layer.current),[10,0,30]);assert.deepEqual(shown.shieldSystems.outer,{hp:10});
 }
 assert.equal(api.state(campaign,outsider).starships[0].shieldSystems,undefined);
 assert.equal(campaign.starships[0].shieldSystems,undefined,'Projection does not rewrite saved ships');
});
