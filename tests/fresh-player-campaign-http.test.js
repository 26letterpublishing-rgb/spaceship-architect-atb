const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const maps = require('../ship-map-core');
const power = require('../ship-power');
const budget = require('../ship-budget');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// A new construction, rather than an Explore/sample ship. Use the public
// catalog and the same geometry, power and airlock validation as the builder.
function constructShip(id, obscure = false) {
  const specs = [
    ['bridge', 'bridge-1', 63], ['engine', 'en-au-engine-4', 105],
    ['sensor', 'sensors-3', 66], ['life', 'life-support', 183],
    ['gun', 'rapid-laser-1', 43], ['thruster-n', 'exhaust-thruster-1', 50],
    ['thruster-s', 'exhaust-thruster-1', 223], ['thruster-e', 'exhaust-thruster-1', 230],
    ['thruster-w', 'exhaust-thruster-1', 62],
  ];
  if (obscure) specs.push(['screen', 'analysis-screening', 105], ['bot', 'hull-breach-repair-drone', 70], ['remote', 'remote-controller', 189]);
  else {
    // One engine plume plus basic Darkveil gives Defense 8: a genuine scan
    // and attack uncertainty, rather than the automatic impossible/easy path.
    specs.splice(6, 3);
    specs.push(['darkveil', 'darkveil-1', 67]);
  }
  const ship = {
    id, title: obscure ? 'Handbuilt Pathfinder' : 'Basic Raider', confirmedOnce: true,
    zoneColumns: 20, zoneRows: 20, gridCells: maps.rectangleCells({}, 63, 8, 8),
    sicInventory: specs.map(([key, type]) => ({ id: id + '-' + key, type, status: 'installed', ...(key === 'screen' ? { attachTo: id + '-engine' } : {}) })),
    placements: specs.map(([key, type, cell]) => ({ sicId: id + '-' + key, cell })),
    doorStates: {}, minerals: {},
  };
  const occupied = new Set();
  for (const placement of ship.placements) {
    const item = ship.sicInventory.find(i => i.id === placement.sicId);
    if (maps.definition(item.type).addon) continue;
    const def = maps.componentDefinition(item);
    for (const cell of maps.rectangleCells(ship, placement.cell, def.width, def.height)) {
      assert.ok(!occupied.has(cell), 'Fresh construction cannot overlap SICs');
      occupied.add(cell);
      assert.equal(ship.gridCells.includes(cell), !def.exterior, 'Rooms are inside and equipment is outside the hull');
    }
  }
  assert.equal(maps.exteriorError(ship), '');
  assert.equal(power.constructionError({ ship }), '');
  assert.equal(maps.ensureAirlocks(ship), '');
  assert.ok(maps.propulsion(ship).moveSpeed > 0);
  return ship;
}

function bridgeSeat(ship) {
  const entry = [...maps.buildLayout(ship.ship).footprint].find(([, c]) => maps.definition(c.type).bridge && c.stations.some(s => s.x === c.column && s.y === c.row));
  assert.ok(entry, 'Ship has a usable bridge station');
  const [square, c] = entry;
  return { starshipId: ship.id, square, sicId: c.sicId, mesh: c.stations.find(s => s.x === c.column && s.y === c.row).mesh, stationed: true };
}

test('fresh player builds an obscure-SIC ship, obtains paid GM approval, joins combat and preserves the journey after restart', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-first-player-'));
  let child, base, stderr = '';
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  }
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
      env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.on('data', chunk => { stderr += chunk; });
    base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Isolated server startup timed out: ' + stderr)), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.stdout.on('data', chunk => { const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1]; if (url) { clearTimeout(timeout); resolve(url); } });
    });
  }
  t.after(stop);
  await start();
  async function post(route, body, expected = 200) {
    if (route === 'action') body = await require('./helpers/confirmed-encounter.cjs')(base, body);
    const response = await fetch(base + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    assert.equal(response.status, expected, route + ': ' + JSON.stringify(result));
    return result;
  }
  async function get(route) {
    const response = await fetch(base + '/api/' + route, { signal: AbortSignal.timeout(10000) });
    const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
  }
  const created = await post('campaign/v03/create', { name: 'Isolated first-player journey' }, 201);
  const code = created.campaign.code, gm = created.token;
  assert.equal(created.campaign.shipCredits, 100000);
  const joined = await post('campaign/v03/join', { code, name: 'Alex' }), pc = joined.token;
  const character = await post('campaign/v03/character/create', { code, token: pc, password: 'test passenger', character: {
    phase: 'finalized', identity: { characterName: 'Alex Starling', raceId: 'human' },
    attributes: { health: [1, 1], dexterity: [1, 1], intellect: [1, 1], perception: [1, 1] },
    skills: { Engineering: { tenths: 20 }, 'Weapon Systems': { tenths: 30 }, 'Sensor Systems': { tenths: 30 }, Piloting: { tenths: 30 }, 'Athletics': { tenths: 20 } },
    computed: { maximumHp: 30, moveSpeed: 4, skills: { Engineering: 2, 'Weapon Systems': 3, 'Sensor Systems': 3, Piloting: 3, 'Athletics': 2 } },
    resources: { creditsBase: 1000 }, health: { current: 30 },
  } });
  const cid = character.campaign.ownCharacterId;
  assert.ok(cid);
  assert.equal(character.campaign.characters.find(c => c.id === cid).character.identity.playerName, 'Alex');
  const campaign = token => get(`campaign/state?code=${code}&token=${token}`);
  const combat = () => get(`state?room=${code}&token=${gm}`);
  const act = body => post('action', { roomCode: code, gmToken: gm, ...body });
  const playerAction = async body => {
    await post('action', { roomCode: code, characterId: cid, characterToken: pc, ...body });
    return combat(); // GM assertions include the NPCs hidden from player responses.
  };

  const draft = constructShip('first-player-design', true), price = budget.cost(draft);
  await post('campaign/v03/import', { code, token: pc, kind: 'ship', data: draft });
  let currentCampaign = await campaign(gm), request = currentCampaign.imports.find(r => r.kind === 'ship' && r.status === 'pending');
  assert.ok(request, 'GM can review the new ship through the pending-import inbox data');
  assert.equal(request.data.constructionCost, price);
  await post('campaign/v03/import/respond', { code, token: gm, requestId: request.id, approve: true, useGroupCredits: true });
  currentCampaign = await campaign(gm);
  const shipId = currentCampaign.imports.find(r => r.id === request.id).shipId;
  assert.ok(shipId);
  assert.equal(currentCampaign.shipCredits, 100000 - price);
  await post('campaign/starship/crew', { code, token: gm, starshipId: shipId, crewCharacterIds: [cid], crewNpcUnitIds: [] });
  const linked = await post('campaign/starship/link', { code, token: gm, controlType: 'gm', starship: constructShip('first-player-raider') }, 201);
  currentCampaign = await campaign(gm);
  const own = currentCampaign.starships.find(s => s.id === shipId), enemy = currentCampaign.starships.find(s => s.id === linked.starship.id);
  assert.deepEqual(own.crewCharacterIds, [cid]);
  assert.ok((await campaign(pc)).starships.some(s => s.id === shipId));
  assert.ok(own.ship.airlocks.length, 'Confirmed ship receives an editable airlock');

  let receipt = 0;
  const mapCommand = body => post('campaign/v03/starmap', { code, token: gm, receipt: 'first-journey-' + (++receipt), ...body });
  await mapCommand({ kind: 'create', name: 'First Sector' });
  const mapId = (await campaign(gm)).starmaps.maps[0].id;
  await mapCommand({ kind: 'star', mapId, name: 'Starting Sun', q: 0, r: 0, lore: 'A quiet starting system.', gmNotes: 'Test-only secret' });
  await mapCommand({ kind: 'position', mapId, shipId, q: 0, r: 0 });
  const playerMap = (await campaign(pc)).starmaps.maps[0];
  assert.equal(playerMap.lightYearsPerHex, 3.26);
  assert.equal(playerMap.stars[0].gmNotes, undefined);

  let state = await act({ action: 'prepareEncounter', preparationId: 'first-player-combat', mode: 'starship', starships: [own, enemy],
    shipPositions: [{ id: shipId, q: 0, r: 0 }, { id: enemy.id, q: 3, r: 0 }],
    spaceObjects: [{ id: 'object-first-rock', name: 'Mining practice', kind: 'asteroid', q: 1, r: 1, quantity: 5 }],
    units: [
      { characterId: cid, characterName: 'Alex Starling', team: 'pc', speed: .1, commandWindow: 120, location: bridgeSeat(own) },
      { preparationUnitId: 'first-raider-pilot', characterName: 'Raider Pilot', team: 'npc', speed: .1, commandWindow: 120, currentHp: 20, maximumHp: 20, location: bridgeSeat(enemy) },
    ] });
  const unitId = state.units.find(u => u.characterId === cid).id;
  const unit = () => state.units.find(u => u.id === unitId);
  await act({ action: 'setRunning', running: true });
  state = await act({ action: 'setHardPaused', paused: true });
  const ready = async () => { state = await act({ action: 'nudge', id: unitId, amount: 100 }); assert.equal(state.activeId, unitId); };
  const stepsUntil = async (predicate, label) => {
    for (let i = 0; i < 30 && !predicate(); i++) state = await act({ action: 'step' });
    assert.ok(predicate(), label + ': ' + JSON.stringify(unit().delayedAction));
  };
  await ready();
  state = await playerAction({ action: 'playerCombatAction', kind: 'moveStarship', id: unitId, destination: { q: 1, r: 0 }, requestId: 'first-player-move' });
  assert.ok(unit().delayedAction.shipOrder);
  await stepsUntil(() => !unit().delayedAction, 'PC movement input completes');
  await stepsUntil(() => state.shipPositions.find(p => p.id === shipId).q >= 1, 'Ship travels along the chosen route');

  await ready();
  state = await playerAction({ action: 'sensorCommand', id: unitId, sicId: own.ship.sicInventory.find(i => i.type === 'sensors-3').id, kind: 'analysis', targetId: enemy.id, requestId: 'first-player-analysis' });
  let pending = unit().delayedAction;
  assert.equal(pending.awaitingRoll, true, JSON.stringify(pending));
  assert.equal(state.rollPaused, true);
  const frozen = state.units.map(u => u.atb);
  await sleep(300);
  assert.deepEqual((await combat()).units.map(u => u.atb), frozen, 'A sensor roll awaits an explicit player confirmation');
  state = await playerAction({ action: 'rollShipAction', id: unitId, rollId: pending.id, score: 18 });
  await stepsUntil(() => !unit().delayedAction, 'Sensor roll resolves after normal input time');
  await stepsUntil(() => Boolean(state.starships.find(s => s.id === shipId).sensorState.analyses?.[enemy.id]?.layout), 'Successful scan finishes processing and keeps an inspectable enemy layout');

  await ready();
  const hullBefore = state.starships.find(s => s.id === enemy.id).currentHullHp;
  state = await playerAction({ action: 'weaponCommand', id: unitId, sicId: own.ship.sicInventory.find(i => i.type === 'rapid-laser-1').id, targetId: enemy.id, requestId: 'first-player-shot' });
  pending = unit().delayedAction;
  assert.equal(pending.awaitingRoll, true);
  state = await playerAction({ action: 'rollShipAction', id: unitId, rollId: pending.id, score: 18 });
  await stepsUntil(() => Boolean(unit().delayedAction?.weaponDamage), 'Weapon hit asks for a separate damage roll');
  pending = unit().delayedAction;
  assert.equal(state.rollPaused, true);
  state = await playerAction({ action: 'rollShipAction', id: unitId, rollId: pending.id, diceResults: Array(pending.weaponDamage.count).fill(2) });
  assert.equal(unit().delayedAction, null);
  assert.equal(state.rollPaused, false);
  assert.ok(state.starships.find(s => s.id === enemy.id).currentHullHp < hullBefore);
  state = await act({ action: 'setHardPaused', paused: true });
  const beforeRestart = await combat();
  await sleep(500); // Let the ordinary debounced persistence finish.
  await stop(); await start();
  const restored = await combat(), restoredCampaign = await campaign(gm), restoredPlayer = await campaign(pc);
  assert.equal(restoredPlayer.ownCharacterId, cid, 'A refreshed/reconnected player keeps the character link');
  assert.equal(restoredCampaign.shipCredits, 100000 - price);
  assert.deepEqual(restoredCampaign.starships.find(s => s.id === shipId).crewCharacterIds, [cid]);
  assert.equal(restoredCampaign.starmaps.maps[0].stars[0].name, 'Starting Sun');
  assert.deepEqual(restored.shipPositions, beforeRestart.shipPositions);
  assert.equal(restored.starships.find(s => s.id === enemy.id).currentHullHp, beforeRestart.starships.find(s => s.id === enemy.id).currentHullHp);
  assert.deepEqual(restored.starships.find(s => s.id === shipId).sensorState.analyses, beforeRestart.starships.find(s => s.id === shipId).sensorState.analyses);
  assert.deepEqual(restored.units.find(u => u.id === unitId).location, beforeRestart.units.find(u => u.id === unitId).location);
  assert.equal(restored.encounterId, beforeRestart.encounterId);
  t.diagnostic('Backend journey only: new campaign, linked finalized PC, catalog-built legal ship, paid GM approval, crew, galaxy start, PC move + explicitly confirmed scan/weapon/damage, persistence restart.');
});
