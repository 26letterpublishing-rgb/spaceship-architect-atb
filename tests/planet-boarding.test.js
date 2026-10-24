const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {CampaignApi}=require('../campaign-api'),maps=require('../ship-map-core'),boarding=require('../planet-boarding'),galaxy=require('../campaign-starmaps');
async function fixture(){const records=new Map(),api=new CampaignApi({store:{get:async id=>records.get(id),save:async c=>records.set(c.code,structuredClone(c)),create:async c=>(records.set(c.code,c),true),findByName:async()=>[]}});
 const call=async(path,body={},status=200)=>{let out;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,s,r)=>{assert.equal(s,status,JSON.stringify(r));out=r;});return out;};
 const room=await call('showcase/start'),c=await api.campaign(room.code),ship=c.starships.find(s=>s.controlType==='pc'),party=c.starmaps.party,park=c.starmaps.localPositions[ship.id];
 const move=hex=>galaxy.command(c,{kind:'planetMoveParty',mapId:party.mapId,starId:party.starId,planetId:party.planetId,hex,receipt:randomUUID()},{gm:true});
 return {api,call,room,c,ship,party,park,move};}
test('Explore starts ashore five hexes from a stationary working ship; direct movement is rejected',async()=>{
 const f=await fixture();assert.equal(require('../planet-terrain').route(f.party.hex,f.park.surfaceHex).distance,5);assert.equal(require('../campaign-planets').canLaunch(f.c,f.ship),true);
 assert.equal(boarding.atShip(f.c,f.ship),false);assert.ok(f.room.players.every(p=>f.ship.characterLocations[p.id].environment==='surface'));
 const p=f.room.players[0];await f.call('starship/move-character',{code:f.room.code,token:p.token,starshipId:f.ship.id,characterId:p.id,square:f.ship.ship.airlocks[0].square,mesh:4},409);
 const copy=JSON.parse(JSON.stringify(f.c));assert.equal(boarding.atShip(copy,copy.starships.find(s=>s.id===f.ship.id)),false);
 const parked=structuredClone(f.park);f.move(String(Number(f.party.hex)+1));assert.deepEqual(f.park,parked);assert.equal(galaxy.view(f.c,false).launchableShipIds.includes(f.ship.id),false);
});
test('boarding uses free airlock spaces, preserves crew, survives a repeat move, and departure needs a Bridge',async()=>{
 const f=await fixture(),airlock=f.ship.ship.airlocks[0].square;f.move(f.park.surfaceHex);assert.equal(boarding.atShip(f.c,f.ship),true);
 const locations=f.room.players.map(p=>f.ship.characterLocations[p.id]);assert.ok(locations.every(l=>l.square===airlock&&!l.stationed));assert.ok(locations.every(l=>locations.filter(x=>x.square===l.square&&x.mesh===l.mesh).length<=2));
 const before=structuredClone(f.ship.characterLocations);f.move(f.park.surfaceHex);assert.deepEqual(f.ship.characterLocations,before);
 const p=f.room.players[0],body={code:f.room.code,token:p.token,kind:'leavePlanet',mapId:f.park.mapId,starId:f.park.starId,planetId:f.park.planetId,shipId:f.ship.id,receipt:randomUUID()};
 await f.call('v03/starmap',body,400);
 const layout=maps.buildLayout(f.ship.ship);let seat;for(const [square,cell]of layout.footprint)if(maps.definition(cell.type).bridge){const st=cell.stations.find(s=>s.x===cell.column&&s.y===cell.row);if(st){seat={square,mesh:st.mesh,stationed:true};break;}}
 await f.call('starship/move-character',{code:f.room.code,token:p.token,starshipId:f.ship.id,characterId:p.id,...seat});
 await f.call('v03/starmap',{...body,receipt:randomUUID()});require('../campaign-navigation').advance(f.c,20);assert.equal(f.c.starmaps.party,undefined);assert.equal(f.park.phase,'orbit');assert.equal(boarding.terrainAt(f.c,f.ship),null);
});
test('walking away clears stations and routes; terrain follows the parked hex, not the party',async()=>{
 const f=await fixture();f.move(f.park.surfaceHex);const p=f.room.players[0];f.ship.characterLocations[p.id].stationed=true;f.ship.characterWalks={[p.id]:{destination:{square:1}}};
 f.move(f.party.hex);assert.equal(f.ship.characterLocations[p.id].environment,'surface');assert.equal(f.ship.characterWalks[p.id],undefined);assert.equal(galaxy.canPilot(f.c,f.ship,p.id),false);assert.equal(boarding.terrainAt(f.c,f.ship),'temperate');
 const v=f.api.state(f.c,p.token).starships.find(s=>s.id===f.ship.id);assert.equal(v.surfaceTerrain,'temperate');assert.ok(v.surfaceAwayCharacterIds.includes(p.id));
});

test('saved campaigns retain separate parked position and ashore locations after loading',async()=>{
 const f=await fixture(),r=await f.call('v03/create',{name:'Boarding save test'},201),c=await f.api.campaign(r.campaign.code);
 c.characters=structuredClone(f.c.characters);c.starships=structuredClone(f.c.starships);c.starmaps=structuredClone(f.c.starmaps);await f.api.save(c);
 let backup;await f.api.handle({method:'GET'},{},new URL('http://test/api/campaign/backup?code='+c.code+'&token='+r.token),async()=>({}),(_,status,value)=>{assert.equal(status,200);backup=value;});
 const loaded=await f.call('v03/load',{backup,choice:'replace'}),ship=loaded.campaign.starships.find(s=>s.id===f.ship.id);
 assert.equal(loaded.campaign.starmaps.localPositions[ship.id].surfaceHex,f.park.surfaceHex);assert.equal(loaded.campaign.starmaps.party.hex,f.party.hex);assert.equal(ship.characterLocations[f.room.players[0].id].environment,'surface');assert.equal(ship.surfaceTerrain,'temperate');
});
test('planet rename preserves its surface and legacy directory; boarding another assigned ship selects its real location',async()=>{
 const f=await fixture(),star=f.c.starmaps.maps[0].stars[0],planet=star.system.find(p=>p.id===f.party.planetId),world=star.surfaces[planet.id];
 galaxy.command(f.c,{kind:'planetType',mapId:f.party.mapId,starId:star.id,planetId:planet.id,name:'New Harbor',terrain:'ice',receipt:randomUUID()},{gm:true});assert.equal(planet.name,'New Harbor');assert.equal(star.surfaces[planet.id],world);assert.equal(planet.variant,'ice');
 const second=structuredClone(f.ship);second.id='other-pc-ship';f.c.starships.push(second);f.c.starmaps.localPositions[second.id]={...f.park,surfaceHex:String(Number(f.park.surfaceHex)+1)};
 f.move(f.c.starmaps.localPositions[second.id].surfaceHex);const room=require('../campaign-ship-room')(f.c),id=f.room.players[0].id;assert.equal(room.units.filter(u=>u.id===id).length,1);assert.equal(room.units.find(u=>u.id===id).location.starshipId,second.id);
});
