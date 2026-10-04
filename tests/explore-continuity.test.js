const test=require('node:test'),assert=require('node:assert/strict'),maps=require('../ship-map-core'),walks=require('../ship-walking'),{CampaignApi}=require('../campaign-api');
function fixture(){const records=new Map(),store={get:async c=>structuredClone(records.get(c)||null),create:async c=>(records.set(c.code,structuredClone(c)),true),save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]},api=new CampaignApi({store,storageMode:'test'});return {api,async call(path,body={},status=200){let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,s,data)=>{assert.equal(s,status,JSON.stringify(data));result=data;});return result;}};}
test('walking is shared before arrival, advances without a player page and is saved at completion',async()=>{
 const f=fixture(),room=await f.call('showcase/start'),c=await f.api.campaign(room.code),ship=c.starships[0],person=room.players[0],start=ship.characterLocations[person.id]||{square:ship.ship.gridCells[0],mesh:4};ship.characterLocations[person.id]=start;
 const dest={square:start.square,mesh:start.mesh===4?5:4};
 await f.call('starship/move-character',{code:room.code,token:person.token,starshipId:ship.id,characterId:person.id,...dest,animate:true});
 const job=ship.characterWalks[person.id];assert.ok(job);assert.equal(f.api.state(c,room.players[1].token).starships[0].characterWalks[person.id].duration,job.duration);
 const half=walks.sample(job,job.startedAt+job.duration/2);assert.ok(half.x!==walks.sample(job,job.startedAt).x||half.y!==walks.sample(job,job.startedAt).y);
 await f.api.tickEnvironment(job.startedAt+job.duration+10);assert.equal(ship.characterWalks[person.id],undefined);assert.equal(ship.characterLocations[person.id].mesh,dest.mesh);
 assert.equal(f.api.state(c,room.gmToken).starships[0].characterLocations[person.id].mesh,dest.mesh);
});
test('serializing a walking route preserves its progress and combat handoff stops at the current cell',()=>{
 const record={ship:{gridCells:[21,22,23],sicInventory:[],placements:[]},characterLocations:{a:{square:21,mesh:4}}};
 const job=walks.plan(record,'a',{square:23,mesh:4,stationed:false},3,1000);record.characterWalks={a:job};const restored=JSON.parse(JSON.stringify(record));
 assert.deepEqual(walks.sample(restored.characterWalks.a,4000),walks.sample(job,4000));walks.advance(restored,4000,true);assert.equal(restored.characterWalks.a,undefined);assert.notEqual(restored.characterLocations.a.square,23);
});
test('stopping a shared walk settles its current position and permits a new route',async()=>{
 const f=fixture(),room=await f.call('showcase/start'),c=await f.api.campaign(room.code),ship=c.starships[0],person=room.players[0],start=structuredClone(ship.characterLocations[person.id]);
 const layout=maps.buildLayout(ship.ship),destination={square:ship.ship.gridCells.at(-1),mesh:4};
 assert.ok(maps.meshRoute(layout,start,destination));
 const request={code:room.code,token:person.token,starshipId:ship.id,characterId:person.id};
 await f.call('starship/move-character',{...request,...destination,animate:true});
 const job=ship.characterWalks[person.id];job.startedAt=Date.now()-job.duration/2;
 const expected=walks.sample(job).location;
 await f.call('starship/move-character',{...request,stop:true});
 assert.equal(ship.characterWalks[person.id],undefined);assert.equal(ship.characterLocations[person.id].square,expected.square);assert.equal(ship.characterLocations[person.id].stationed,false);
 await f.call('starship/move-character',{...request,...start,animate:true});assert.ok(ship.characterWalks[person.id]);
});
test('special weapon artwork resolves to files rather than nonexistent generic tier sprites',()=>{
 const fs=require('node:fs'),path=require('node:path');
 for(const type of ['devastation-laser-1','devastation-laser-2','ion-disruptor','black-hole-gun']){
  const d=maps.definition(type);for(const field of ['sprite','cardArt'])assert.ok(fs.existsSync(path.join(__dirname,'..',d[field].split(/[?#]/)[0])),type+' '+field);
 }
});
test('Explore duplicate creates a visible crewless copy and rejects a PC duplicating it',async()=>{
 const f=fixture(),room=await f.call('showcase/start'),c=await f.api.campaign(room.code),old=c.starships.length;
 const result=await f.call('v03/ship/duplicate',{code:room.code,token:room.gmToken,shipId:c.starships[0].id});const copy=result.campaign.starships.at(-1);
 assert.equal(result.campaign.starships.length,old+1);assert.match(copy.title,/Copy/);assert.deepEqual(copy.crewCharacterIds,[]);assert.deepEqual(copy.crewNpcUnitIds,[]);assert.deepEqual(copy.characterLocations,{});
 await f.call('v03/ship/duplicate',{code:room.code,token:room.players[0].token,shipId:copy.id},400);
});
test('flagship supplies all science upgrades, craftable blueprints, spread ammunition and legal systems',()=>{
 const s=require('../showcase-everything')('flag'),inventory=s.ship.sicInventory;
 for(const type of ['security-droid','black-hole-gun','warp-drive-5','hacking-module-5','science-lab','3d-printer','mineral-processor','missile-launcher-3'])assert.ok(inventory.some(i=>i.type===type&&!i.storage),type);
 const lab=inventory.find(i=>i.type==='science-lab');for(const type of ['3d-printer','mineral-processor'])assert.equal(inventory.find(i=>i.type===type).attachTo,lab.id);
 const craftable=Object.keys(maps.catalog).filter(t=>require('../ship-fabrication').recipe(t));
 assert.deepEqual(inventory.filter(i=>i.type==='blueprint').map(i=>i.blueprintType).sort(),craftable.sort());
 const launcher=inventory.find(i=>i.type==='missile-launcher-3');assert.equal(require('../missile-ammunition').used(s,launcher.id),8);assert.ok(s.ship.missileAmmo[launcher.id]['spread-missiles-1']);
 assert.ok(s.ship.missileStorage['spread-missiles-1']);assert.equal(maps.exteriorError(s.ship),'');assert.ok(require('../ship-power').designBudget(s).available>=0);
});

test('campaign environment advances galaxy travel with no browser connected',async()=>{
 const f=fixture(),result=await f.call('showcase/start'),c=await f.api.campaign(result.code),ship=c.starships[0],map=c.starmaps.maps[0],star=map.stars.find(s=>s.name==='Ember');
 await f.call('v03/starmap',{code:c.code,token:result.gmToken,kind:'travel',mapId:map.id,starId:star.id,shipId:ship.id,receipt:'real-clock-test'});
 const start=c.starmaps.journeys[ship.id].clockAt,w=ship.ship.warpState;
 await f.api.tickEnvironment(start+5000);assert.equal(w.remaining,w.total-5);
 f.api.canPassTime=()=>false;await f.api.tickEnvironment(start+15000);assert.equal(w.remaining,w.total-5);
 f.api.canPassTime=()=>true;await f.api.tickEnvironment(start+16000);assert.equal(w.remaining,w.total-6);
});
test('PC roster shares Drama Card counts without revealing another character’s hand',async()=>{
 const f=fixture(),room=await f.call('showcase/start'),c=await f.api.campaign(room.code),other=room.players[1];
 const state=f.api.state(c,room.players[0].token);assert.equal(typeof state.characters.find(r=>r.id===other.id).character.resources.dramaCards,'number');
 assert.equal(state.dramaDeck.hands,undefined);
});
