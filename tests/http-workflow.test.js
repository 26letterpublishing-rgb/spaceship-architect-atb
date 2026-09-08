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
  const base = await new Promise((resolve, reject) => {
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
  const token = created.token;
  const playerTokens = [];
  for (const id of ["http-aster", "http-bram"]) {
    const character = { id, phase: "finalized", access: { pcCode: `${id}-code` }, identity: { characterName: id, playerName: `${id} player` } };
    const pending = await post("join/request", { code, character }, 201);
    await post("join/respond", { code, token, requestId: pending.requestId, decision: "approve" });
    const joined = await post("join/status", { code, characterId: id, pcCode: `${id}-code` });
    assert.equal(joined.status, "approved");
    playerTokens.push(joined.token);
  }
  assert.notEqual(playerTokens[0], playerTokens[1]);
  for (const [id, owner, authenticated] of [["http-gm-ship", "http-aster", true], ["http-menu-ship", "http-bram", false]]) {
    await post("starship/link", {
      code, ...(authenticated ? { token } : {}), controlType: "pc",
      starship: { id, title: id, confirmedOnce: true, gridCells: [189, 190, 209, 210], placements: [], sicInventory: [] },
    }, 201);
    const assigned = await post("starship/crew", { code, token, starshipId: id, crewCharacterIds: [owner] });
    assert.deepEqual(assigned.starship.crewCharacterIds, [owner]);
  }
  await post("starship/crew", { code, token: playerTokens[1], characterId: "http-bram", starshipId: "http-gm-ship", crewCharacterIds: ["http-bram"] }, 403);
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
  fleet = await combat({action:"setShipDistances", distances:[{a:"pair-0",b:"pair-1",units:40}]});
  assert.equal(fleet.shipDistances.filter(pair => pair.units === 25).length, 14);
  await combat({action:"setShipDistances", distances:[{a:"pair-0",b:"pair-1",units:-1}]}, 400);
  await combat({action:"setShipDistances", distances:[], gmToken:"", characterId:"http-aster", characterToken:playerTokens[0]}, 403);
  await combat({action:"syncEncounterStarships", starships:[...ships, {...auShip,id:"seventh"}]}, 400);
  const demo = await post("showcase/start", {});
  const demoAction = payload => combat({roomCode:demo.code,gmToken:demo.gmToken,...payload});
  let demoState = await (await fetch(`${base}/api/state?room=${demo.code}`)).json();
  const demoPc = demoState.units.find(unit => unit.team === "pc");
  demoState = await demoAction({action:"removeUnit",id:demoPc.id});
  assert.ok(!demoState.units.some(unit => unit.id === demoPc.id));
  demoState = await demoAction({action:"clearEncounter",preparing:true});
  assert.equal(demoState.units.length, 0, "preparation must not restore the demo roster");
  const preparation = { action: "prepareEncounter", preparationId: "http-preparation-001", mode: "starship", starships: [auShip], shipDistances: [],
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
  const connection = new AbortController();
  t.after(() => connection.abort());
  const stream = await fetch(`${base}/events?room=${code}&unit=${preparedA.units[0].id}`, { signal: connection.signal });
  await stream.body.getReader().read();
  const spent = await combat({ action: "spendShipAu", starshipId: auShip.id, amount: 3 });
  const retried = await combat(preparation);
  assert.equal(retried.starships[0].auState.current, spent.starships[0].auState.current, "retry must not reset progress or refill AU");
  await combat({ ...preparation, units: preparation.units.slice(0, 1) }, 409);
  await combat({ ...preparation, preparationId: "http-preparation-002", mode: "surface" }, 400);
  const surface = await combat({ ...preparation, preparationId: "http-preparation-003", mode: "surface", starships: [], units: preparation.units.map(unit => ({ ...unit, location: { environment: "exterior", starshipId: "", square: null, mesh: 4 } })) });
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
  for (const file of ["/data/campaigns.json", "/server.js", "/campaign-api.js", "/.git/config"]) {
    assert.equal((await fetch(base + file)).status, 404, file);
  }
  for (const file of ["/", "/ship-map-presentation.css", "/ship-map-core.js", "/ship-power.js", "/au-engine-6-floor-plan.png", "/life-support-floor-plan.png", "/nutritional-supplement-floor-plan.png", "/data/weapons.json"]) {
    assert.equal((await fetch(base + file)).status, 200, file);
  }
});
