const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

test("real HTTP server supports a fresh GM, two PCs, and both ship-link workflows", { timeout: 30000 }, async (t) => {
  const root = path.resolve(__dirname, "..");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-http-workflow-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: "0", DATABASE_URL: "", SA_LOCAL_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  });
  let base = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10000);
    const finish = (error, address) => { clearTimeout(timer); error ? reject(error) : resolve(address); };
    child.once("error", (error) => finish(error));
    child.once("exit", (code) => finish(new Error(`Server exited ${code}: ${output}`)));
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
      if (match) finish(null, match[1]);
    });
  });
  const post = async (route, body, expected = 200) => {
    const response = await fetch(`${base}/api/campaign/${route}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    assert.equal(response.status, expected, `${route}: ${JSON.stringify(result)}`);
    return result;
  };
  const created = await post("create", { name: "HTTP Crew Regression", gmCode: "local-test-gm" }, 201);
  const code = created.campaign.code;
  let token = created.token;
  const playerTokens = [];
  for (const id of ["http-aster", "http-bram"]) {
    const character = { id, phase: "finalized", access: { pcCode: `${id}-code` }, identity: { characterName: id, playerName: `${id} player` },
      attributes: { health: [1, 0, -1, -1] }, computed: { maximumHp: 30, skills: { "Athletics/Endurance": 1.2 } }, health: { current: 10 },
      items: [{ catalogId: "jet-pack", name: "Jet-Pack", charges: 0, chargesMax: 5 }] };
    const pending = await post("join/request", { code, character }, 201);
    await post("join/respond", { code, token, requestId: pending.requestId, decision: "approve" });
    const joined = await post("join/status", { code, characterId: id, pcCode: `${id}-code` });
    assert.equal(joined.status, "approved");
    playerTokens.push(joined.token);
  }
  assert.notEqual(playerTokens[0], playerTokens[1]);
  const time = { code, token, amount: 12, unit: "hours", requestId: "http-time-first" };
  await post("time/pass", { ...time, token: playerTokens[0] }, 403);
  assert.equal((await post("time/pass", time)).healed, 0);
  assert.equal((await post("time/pass", time)).healed, 0);
  const day = await post("time/pass", { ...time, requestId: "http-time-second" });
  assert.ok(Math.abs(day.healed - 8.4) < 1e-9);
  assert.equal(day.recharged, 2);
  for (const pc of day.campaign.characters) {
    assert.equal(pc.character.health.current, 14.2);
    assert.equal(pc.character.items[0].charges, 5);
  }
  const requested = await post("roll/request", { code, token, targetIds: ["http-aster"], attribute: "Intellect", skill: "Computer Systems" }, 201);
  const roll = { code, token: playerTokens[0], characterId: "http-aster", requestId: requested.request.id, score: 13, outcome: "Success", mode: "automatic", diceResults: [6, 7] };
  assert.equal((await post("roll/respond", roll)).recorded, true);
  assert.equal((await post("roll/respond", roll)).alreadyRecorded, true);
  await post("roll/respond", { ...roll, score: 14 }, 409);
  await post("roll/close", { code, token, requestId: roll.requestId });
  assert.equal((await post("roll/respond", roll)).alreadyRecorded, true);
  for (const [id, owner, authenticated] of [["http-gm-ship", "http-aster", true], ["http-menu-ship", "http-bram", false]]) {
    await post("starship/link", {
      code, ...(authenticated ? { token } : {}), controlType: "pc",
      starship: { id, title: id, confirmedOnce: true, gridCells: [189, 190, 209, 210], placements: [], sicInventory: [] },
    }, 201);
    const assigned = await post("starship/crew", { code, token, starshipId: id, crewCharacterIds: [owner] });
    assert.deepEqual(assigned.starship.crewCharacterIds, [owner]);
  }
  await post("starship/crew", { code, token: playerTokens[1], characterId: "http-bram", starshipId: "http-gm-ship", crewCharacterIds: ["http-bram"] }, 403);
  const exteriorShip={id:'http-exterior',title:'Exterior validation',confirmedOnce:true,gridCells:[21,22,41,42],sicInventory:[{id:'thruster',type:'ionic-pulse-thruster-2',rotation:90},...Array.from({length:6},(_,i)=>({id:`stored-${i}`,type:'exhaust-thruster-1',storage:true}))],placements:[{sicId:'thruster',cell:20}]};
  await post('starship/link',{code,token,starship:{...exteriorShip,placements:[{sicId:'thruster',cell:21}]}},400);
  const exteriorLinked=await post('starship/link',{code,token,starship:exteriorShip},201);
  assert.equal(exteriorLinked.starship.ship.placements[0].cell,20);
  const exteriorSaved=await post('starship/save',{code,token,starship:exteriorShip});
  assert.equal(exteriorSaved.starship.ship.placements[0].cell,20);
  assert.equal(exteriorSaved.starship.ship.sicInventory[0].rotation,90);
  assert.equal(exteriorSaved.starship.ship.sicInventory.length,7);
  await post('starship/save',{code,token,starship:{...exteriorShip,placements:[{sicId:'thruster',cell:200}]}},400);
  const combat = async (payload, expected = 200) => {
    const response = await fetch(`${base}/api/action`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode: code, gmToken: token, ...payload }) });
    const state = await response.json();
    assert.equal(response.status, expected, JSON.stringify(state));
    return state;
  };
  const auShip = { id: "http-gm-ship", title: "AU Test", crewCharacterIds: ["http-aster"], ship: {
    gridCells: Array.from({ length: 16 }, (_, i) => Math.floor(i / 4) * 20 + i % 4),
    placements: [{ sicId: "au", cell: 0 }], sicInventory: [{ id: "au", type: "au-engine-4" }],
  } };
  const exteriorEncounter=await combat({action:'syncEncounterStarships',starships:[{id:exteriorShip.id,ship:exteriorShip}]});
  assert.equal(exteriorEncounter.starships[0].ship.placements[0].cell,20);
  assert.equal(exteriorEncounter.starships[0].ship.gridCells.length,4);
  assert.equal(exteriorEncounter.starships[0].ship.sicInventory[0].rotation,90);
  assert.equal(exteriorEncounter.starships[0].ship.sicInventory.length,7);
  let encounter = await combat({ action: "syncEncounterStarships", starships: [auShip] });
  assert.equal(encounter.starships[0].auState.current, 25);
  await combat({ action: "addUnit", characterName: "AU Clock Test", playerName: "GM", team: "npc", speed: 1, commandWindow: 10,
    location: { starshipId: auShip.id, square: 0, mesh: 4 } });
  await combat({ action: "toggleClock" });
  encounter = await combat({ action: "spendShipAu", starshipId: auShip.id, amount: 2 });
  assert.equal(encounter.starships[0].auState.current, 23);
  assert.equal(encounter.log.at(-1).starshipId, auShip.id);
  await combat({ action: "spendShipAu", starshipId: auShip.id, amount: 1, gmToken: "", characterId: "http-aster", characterToken: playerTokens[0] }, 403);
  // A normal ship sync must never restore spent AU from a stale client snapshot.
  encounter = await combat({ action: "syncEncounterStarships", starships: [{ ...auShip, auState: { current: 25, progress: 0 } }] });
  assert.equal(encounter.starships[0].auState.current, 23);
  await new Promise(resolve => setTimeout(resolve, 4250));
  encounter = await combat({ action: "setHardPaused", paused: true });
  assert.equal(encounter.starships[0].auState.current, 24);
  const paused = encounter.starships[0].auState.progress;
  await new Promise(resolve => setTimeout(resolve, 250));
  encounter = await (await fetch(`${base}/api/state?room=${code}`)).json();
  assert.equal(encounter.starships[0].auState.progress, paused);
  await combat({ action: "spendShipAu", starshipId: auShip.id, amount: 999 }, 409);
  const npcId = encounter.units.find(unit => unit.team === "npc").id;
  const assignedNpc = await post("starship/crew", { code, token, starshipId: auShip.id, crewCharacterIds: ["http-aster"], crewNpcUnitIds: [npcId] });
  assert.deepEqual(assignedNpc.starship.crewNpcUnitIds, [npcId]);
  // A PC saving their crew must not silently erase the GM's NPC assignments.
  const preservedNpc = await post("starship/crew", { code, token: playerTokens[0], characterId: "http-aster", starshipId: auShip.id, crewCharacterIds: ["http-aster"] });
  assert.deepEqual(preservedNpc.starship.crewNpcUnitIds, [npcId]);
  await combat({ action: "clearEncounter" });
  await combat({ action: "addUnit", npcRosterId: npcId, characterName: "AU Clock Test", team: "npc", speed: 1, location: {starshipId:auShip.id,square:0,mesh:4} });
  const restoredNpc = await (await fetch(`${base}/api/state?room=${code}`)).json();
  assert.equal(restoredNpc.units[0].id, npcId);
  await combat({ action: "addUnit", npcRosterId: npcId, team: "npc", characterName: "Duplicate", speed: 1, location: {starshipId:auShip.id,square:0,mesh:4} }, 409);
  const ships = Array.from({length:6}, (_, i) => ({...auShip, id:`pair-${i}`}));
  let fleet = await combat({action:"syncEncounterStarships", starships:ships});
  assert.equal(fleet.shipDistances.length, 15);
  assert.equal(fleet.shipPositions.length,6);
  assert.deepEqual(fleet.shipDistances,require('../ship-distances').fromPositions(fleet.starships,fleet.shipPositions));
  await combat({action:"setShipDistances", distances:[{a:"pair-0",b:"pair-1",units:40}]},409);
  await combat({action:"setShipDistances", distances:[{a:"pair-0",b:"pair-1",units:-1}]}, 409);
  await combat({action:"setShipDistances", distances:[], gmToken:"", characterId:"http-aster", characterToken:playerTokens[0]}, 403);
  await combat({action:"syncEncounterStarships", starships:[...ships, {...auShip,id:"seventh"}]}, 400);
  const demo = await post("showcase/start", {});
  const demoAction = payload => combat({roomCode:demo.code,gmToken:demo.gmToken,...payload});
  let demoState = await (await fetch(`${base}/api/state?room=${demo.code}`)).json();
  for(const ship of demoState.starships){
    const maps=require('../ship-map-core'),nav=require('../ship-navigation');
    assert.equal(maps.exteriorError(ship.ship),'');
    assert.equal(ship.ship.sicInventory.filter(item=>maps.definition(item.type).thruster).length,2);
    const cockpit=ship.ship.sicInventory.find(item=>maps.definition(item.type).shipControl);
    const cell=ship.ship.placements.find(p=>p.sicId===cockpit.id).cell;
    const pilot={location:{starshipId:ship.id,square:cell,mesh:0,sicId:cockpit.id,stationed:true}};
    assert.ok(nav.access(demoState,pilot)?.speed>0,'Each demo ship supports unboosted movement');
    assert.ok(ship.auState.maximum>=2,'Each demo ship supports an Ionic boost');
  }
  const demoPc = demoState.units.find(unit => unit.team === "pc");
  demoState = await demoAction({action:"removeUnit",id:demoPc.id});
  assert.ok(!demoState.units.some(unit => unit.id === demoPc.id));
  demoState = await demoAction({action:"clearEncounter",preparing:true});
  assert.equal(demoState.units.length, 0, "preparation must not restore the demo roster");
  const preparation = { action: "prepareEncounter", preparationId: "http-preparation-001", mode: "starship", starships: [auShip], shipDistances: [],
    shipPositions:[{id:auShip.id,q:12,r:-9}],
    units: ["http-aster", "http-bram"].map(characterId => ({ characterId, characterName: characterId, team: "pc", speed: 4, commandWindow: 10, location: { starshipId: auShip.id, square: 0, mesh: 4 } })) };
  const beforeInvalid = await (await fetch(`${base}/api/state?room=${code}`)).json();
  await combat({ ...preparation, units: [...preparation.units, preparation.units[0]] }, 400);
  const afterInvalid = await (await fetch(`${base}/api/state?room=${code}`)).json();
  assert.deepEqual(afterInvalid.units, beforeInvalid.units, "invalid setup must preserve all old combatants");
  assert.deepEqual(afterInvalid.starships, beforeInvalid.starships);
  await combat({ ...preparation, gmToken: "", characterId: "http-aster", characterToken: playerTokens[0] }, 403);
  const [preparedA, preparedB] = await Promise.all([combat(preparation), combat(preparation)]);
  assert.deepEqual(preparedA.units.map(unit => unit.id), preparedB.units.map(unit => unit.id), "concurrent retries must not create twice");
  assert.equal(preparedA.units.length, 2);
  assert.equal(preparedA.starships.length, 1);
  assert.equal(preparedA.running, false);
  assert.deepEqual(preparedA.shipPositions,preparation.shipPositions);
  const shipSave=JSON.parse(fs.readFileSync(path.join(dataDir,'campaigns.json'),'utf8')).find(record=>record.code===code);
  assert.deepEqual(shipSave.encounter.shipPositions,preparation.shipPositions);
  assert.equal(shipSave.starships.find(record=>record.id==='http-exterior').ship.placements[0].cell,20);
  const connection = new AbortController();
  t.after(() => connection.abort());
  const stream = await fetch(`${base}/events?room=${code}&unit=${preparedA.units[0].id}`, { signal: connection.signal });
  await stream.body.getReader().read();
  const spent = await combat({ action: "spendShipAu", starshipId: auShip.id, amount: 3 });
  const retried = await combat(preparation);
  assert.equal(retried.starships[0].auState.current, spent.starships[0].auState.current, "retry must not reset progress or refill AU");
  await combat({ ...preparation, units: preparation.units.slice(0, 1) }, 409);
  await combat({ ...preparation, preparationId: "http-preparation-002", mode: "surface" }, 400);
  const surface = await combat({ ...preparation, preparationId: "http-preparation-003", mode: "surface", starships: [], shipPositions: [], units: preparation.units.map(unit => ({ ...unit, location: { environment: "exterior", starshipId: "", square: null, mesh: 4 } })) });
  assert.equal(surface.starships.length, 0);
  assert.equal(surface.units.length, 2);
  assert.deepEqual(surface.units.map(unit => unit.id), preparedA.units.map(unit => unit.id), "connected PCs retain their identity when the encounter is replaced");
  assert.equal(surface.units[0].playerConnected, true, "a connected player must not be marked offline during replacement");
  const persisted = JSON.parse(fs.readFileSync(path.join(dataDir, "campaigns.json"), "utf8")).find(record => record.code === code);
  assert.ok(persisted.encounter.preparations.some(entry => entry.id === preparation.preparationId), "retry receipts must be durable, not browser-only");
  assert.equal(persisted.encounter.units.length, 2);
  connection.abort();
  await new Promise(resolve => setTimeout(resolve, 3250));
  const disconnected = await (await fetch(`${base}/api/state?room=${code}`)).json();
  assert.equal(disconnected.units[0].playerConnected, false, "disconnect callbacks must update the replacement unit, not the discarded one");
  const flightShips=['http-gm-ship','http-menu-ship'].map((id,i)=>({id,title:`Flight ${i+1}`,crewCharacterIds:[i?'http-bram':'http-aster'],ship:{
    id,title:`Flight ${i+1}`,confirmedOnce:true,gridCells:[21,22,41,42],
    sicInventory:[{id:'cp',type:'cockpit-1'},{id:'th',type:'ionic-pulse-thruster-1'},{id:'au',type:'au-engine-1'},{id:'en',type:'en-engine-1'}],
    placements:[{sicId:'cp',cell:21},{sicId:'th',cell:20},{sicId:'au',cell:42},{sicId:'en',cell:22}]}}));
  for(const ship of flightShips) await post('starship/save',{code,token,starship:ship.ship});
  await post('starship/save',{code,token,starship:{...flightShips[0].ship,gridCells:[0,1,2,20,21,22,40,41,42]}},400);
  let flight=await combat({action:'prepareEncounter',preparationId:'flight-prep-001',mode:'starship',starships:flightShips,
    shipPositions:[{id:flightShips[0].id,q:0,r:0},{id:flightShips[1].id,q:25,r:0}],
    units:[{characterId:'http-aster',characterName:'Aster',team:'pc',speed:1,commandWindow:30,location:{starshipId:flightShips[0].id,square:21,mesh:0,stationed:true}},
      {characterId:'http-bram',characterName:'Bram',team:'pc',speed:1,commandWindow:30,location:{starshipId:flightShips[1].id,square:22,mesh:4}},
      {preparationUnitId:'flight-npc',characterName:'NPC Pilot',team:'npc',speed:1,commandWindow:30,location:{starshipId:flightShips[1].id,square:21,mesh:0,stationed:true}}]});
  const pilot=flight.units.find(u=>u.characterId==='http-aster'), npcPilot=flight.units.find(u=>u.team==='npc');
  assert.equal(pilot.location.mesh,0);assert.equal(pilot.location.sicId,'cp');
  const fly=async (unit,destination,auth={})=>{
    flight=await combat({action:'nudge',id:unit.id,amount:100});assert.equal(flight.activeId,unit.id);
    flight=await combat({action:'playerCombatAction',kind:'moveStarship',id:unit.id,destination,...auth});
    assert.equal(flight.activeId,null);assert.equal(flight.units.find(u=>u.id===unit.id).timedAction,null);
    assert.ok(flight.units.find(u=>u.id===unit.id).delayedAction.shipOrder);
    for(let tick=0;tick<5&&flight.units.find(u=>u.id===unit.id).delayedAction;tick++)flight=await combat({action:'step'});
    assert.equal(flight.units.find(u=>u.id===unit.id).delayedAction,null);
    const ship=flight.starships.find(s=>s.id===unit.location.starshipId);assert.equal(ship.navigation.phase,'powered');
    return ship;
  };
  for(let i=0;i<3;i++) {
    await fly(pilot,{q:10+i,r:2-i},{gmToken:'',characterId:'http-aster',characterToken:playerTokens[0]});
    const before=flight.shipPositions.find(p=>p.id===flightShips[0].id);
    flight=await combat({action:'step'});assert.notDeepEqual(flight.shipPositions.find(p=>p.id===before.id),before);
    await fly(npcPilot,{q:15-i,r:-4+i});
    flight=await combat({action:'step'});
  }
  flight=await combat({action:'nudge',id:pilot.id,amount:100});
  await combat({action:'playerCombatAction',kind:'moveStarship',id:pilot.id,destination:{q:20,r:0},gmToken:'',characterId:'http-bram',characterToken:playerTokens[1]},403);
  flight=await combat({action:'playerCombatAction',kind:'moveStarship',id:pilot.id,destination:{q:20,r:0},boostIds:['th']});
  for(let tick=0;tick<5&&flight.units.find(u=>u.id===pilot.id).delayedAction;tick++)flight=await combat({action:'step'});
  assert.equal(flight.starships[0].auState.current,1);
  const oldNav=flight.starships[0].navigation;
  flight=await combat({action:'syncEncounterStarships',starships:flightShips.map(s=>({...s,navigation:{phase:'stopped'},auState:{current:3}}))});
  assert.deepEqual(flight.starships[0].navigation,oldNav);assert.equal(flight.starships[0].auState.current,1);
  flight=await combat({action:'setCombatLocation',id:pilot.id,location:{starshipId:flightShips[0].id,square:22,mesh:4,stationed:false}});
  const beforeLeave=flight.shipPositions[0].q;
  flight=await combat({action:'step'});assert.ok(flight.shipPositions[0].q>beforeLeave);
  await new Promise(resolve=>setTimeout(resolve,400));
  const flightSave=JSON.parse(fs.readFileSync(path.join(dataDir,'campaigns.json'),'utf8')).find(c=>c.code===code).encounter;
  assert.deepEqual(flightSave.shipPositions,flight.shipPositions);assert.deepEqual(flightSave.starships[0].navigation,flight.starships[0].navigation);
  const stopped=once(child,'exit');child.kill();await stopped;
  const restarted=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe'],windowsHide:true});
  t.after(async()=>{if(restarted.exitCode===null && restarted.signalCode===null){const exit=once(restarted,'exit');restarted.kill();await exit;}});
  base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Navigation restore server did not start')),5000);
    restarted.once('error',error=>{clearTimeout(timer);reject(error);});
    restarted.stdout.on('data',chunk=>{const url=String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});
  });
  const resumed=await (await fetch(`${base}/api/state?room=${code}`)).json();
  assert.deepEqual(resumed.shipPositions,flightSave.shipPositions);
  assert.deepEqual(resumed.starships[0].navigation,flightSave.starships[0].navigation);
  assert.equal(resumed.starships[0].auState.current,flightSave.starships[0].auState.current);
  assert.equal(resumed.running,false);assert.equal(resumed.hardPaused,true);
  token=(await post('open',{name:'HTTP Crew Regression',gmCode:'local-test-gm'})).token;
  flight=await combat({action:'reset'});assert.equal(flight.starships[0].navigation,null);
  for (const file of ["/data/campaigns.json", "/server.js", "/campaign-api.js", "/.git/config"]) {
    assert.equal((await fetch(base + file)).status, 404, file);
  }
  assert.equal((await fetch(base+'/cockpit-1-card.png')).headers.get('content-type'),'image/webp');
  for (const file of ["/", "/ship-map-presentation.css", "/ship-map-core.js", "/ship-power.js", "/ship-navigation.js", "/ship-navigation-ui.js", "/ship-navigation-ui.css", "/cockpit-1-card.png", "/cockpit-1-floor-plan.png", "/ionic-pulse-thruster-5-card.png", "/au-engine-6-floor-plan.png", "/life-support-floor-plan.png", "/nutritional-supplement-floor-plan.png", "/data/weapons.json"]) {
    assert.equal((await fetch(base + file)).status, 200, file);
  }
});
