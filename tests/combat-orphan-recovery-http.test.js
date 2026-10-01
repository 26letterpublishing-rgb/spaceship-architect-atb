const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('combat removal and simultaneous completions retain a reachable resolution or running clock', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'test-artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(artifacts, 'audit-atb-20260912-data-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill(); await done; }
  });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Startup timed out')), 8000);
    child.on('error', reject);
    child.stdout.on('data', chunk => {
      const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) { clearTimeout(timeout); resolve(url); }
    });
  });
  const post = async (route, body) => {
    body=await require('./helpers/confirmed-encounter.cjs')(base,body);
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
  };
  const room = await post('/api/campaign/showcase/start', {});
  await require('./helpers/combat-demo.cjs')(base,room);
  const gm = body => post('/api/action', { roomCode: room.code, gmToken: room.gmToken, ...body });
  const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
  await gm({ action: 'setHardPaused', paused: true });
  const saved = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
  const original = structuredClone(saved.campaign.encounter);
  const novaId = original.units.find(u => u.characterName === 'Nova Vale').id;
  const slugId = original.units.find(u => u.characterName === 'Space Slug').id;
  const player = room.players.find(p => p.id === original.units.find(u => u.id === novaId).characterId);
  const pc = body => post('/api/action', { roomCode: room.code, characterId: player.id, characterToken: player.token, ...body });
  const compact = s => ({ running: s.running, hardPaused: s.hardPaused, pausedForTurn: s.pausedForTurn,
    activeId: s.activeId, activeAction: s.activeAction, itemResolution: s.itemResolution,
    units: s.units.map(u => ({ id: u.id, atb: u.atb, timed: u.timedAction, delayed: u.delayedAction, queued: u.queuedEffects })) });
  const fixture = async configure => {
    const encounter = structuredClone(original);
    Object.assign(encounter, { running: false, hardPaused: true, pausedForTurn: false, resumeAfterTurn: true,
      activeId: null, activeAction: null, itemResolution: null, attackResolution: null,
      activeSource: null, holdPaused: false, delayRequest: null, commandRemaining: null, commandTotal: 0,
      commandExpired: false, commandHeldRemaining: null, hasEngagedClock: true });
    for (const u of encounter.units) Object.assign(u, { speed: 10, atb: 0, defeatedAt: null,
      delayTimer: null, delayedAction: null, timedAction: null, queuedEffects: [], thrownEffects: [],
      consoleHold: null, pendingShipRolls: [], pendingTimedResolutions: [] });
    const nova = encounter.units.find(u => u.id === novaId), slug = encounter.units.find(u => u.id === slugId);
    configure(encounter, nova, slug);
    await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: { ...saved, campaign: { ...saved.campaign, encounter } } });
    await gm({ action: 'setHardPaused', paused: false });
    await gm({ action: 'setRunning', running: true });
    await sleep(550);
    return state();
  };
  const aid = (u, targetId) => { u.timedAction = { id: `aid-${u.id}`, kind: 'firstAid', label: 'First Aid', remaining: 0.2,
    total: 12, targetId, useKit: false, treatmentRating: 1 }; };
  const manual = u => { u.delayedAction = { id: `manual-${u.id}`, kind: 'action', label: 'Deferred audit action',
    remaining: 20, total: 100, rate: 100, resolving: false }; };

  await t.test('control: a single First Aid completion returns to the natural clock after a PC roll', async () => {
    let s = await fixture((room, nova) => aid(nova, nova.id));
    assert.equal(s.itemResolution?.healerId, novaId);
    await gm({ action: 'setFirstAidDifficulty', difficulty: 12 });
    await pc({ action: 'submitFirstAidRoll', id: novaId, resolutionId: s.itemResolution.id, score: 0 });
    s = await state();
    const before = s.units.find(u => u.id === slugId).atb;
    await sleep(350);
    assert.ok((await state()).units.find(u => u.id === slugId).atb > before);
  });

  for (const removed of ['healer', 'patient']) await t.test(`removing First Aid ${removed} releases the pause`, async () => {
    let s = await fixture((room, nova, slug) => {
      slug.location = { ...nova.location, mesh: 1 };
      aid(nova, slug.id);
    });
    assert.equal(s.itemResolution?.healerId, novaId);
    s = await gm({ action: 'removeUnit', id: removed === 'healer' ? novaId : slugId });
    assert.equal(s.itemResolution, null);
    // Retry only normal clock controls; no Step, role switch, or hidden completeTurn recovery.
    await gm({ action: 'toggleClock' });
    await gm({ action: 'toggleClock' });
    await gm({ action: 'setRunning', running: true });
    await sleep(350);
    s = await state();
    console.log('FIRST_AID_REMOVAL', removed, JSON.stringify(compact(s)));
    assert.equal(s.pausedForTurn, false, 'No prompt/owner remains, so combat must not remain paused');
    assert.equal(s.running, true);
  });

  await t.test('automatic defeated-NPC removal releases its active deferred-action pause', async () => {
    let s = await fixture((room, nova, slug) => manual(slug));
    assert.equal(s.activeAction?.unitId, slugId);
    s = await gm({ action: 'setNpcHp', id: slugId, maximumHp: 24, currentHp: 0 });
    await sleep(6100);
    s = await state();
    assert.equal(s.units.find(u=>u.id===slugId)?.currentHp,0,'Unconscious NPC remains available to carry');
    assert.equal(s.activeAction, null);
    console.log('NPC_REMOVAL', JSON.stringify(compact(s)));
    assert.equal(s.pausedForTurn, false, 'Defeat removed the prompt, so it must also release its pause');
    assert.equal(s.running, true);
  });

  await t.test('automatic defeated-NPC patient removal releases the First Aid pause', async () => {
    let s = await fixture((room, nova, slug) => {
      slug.location = { ...nova.location, mesh: 1 };
      aid(nova, slug.id);
    });
    assert.equal(s.itemResolution?.targetId, slugId);
    await gm({ action: 'setNpcHp', id: slugId, maximumHp: 24, currentHp: 0 });
    await sleep(6100);
    s = await state();
    assert.equal(s.units.find(u => u.id === slugId)?.currentHp,0,'Unconscious crew remain available to carry');
    assert.equal(s.itemResolution, null);
    console.log('NPC_FIRST_AID_REMOVAL', JSON.stringify(compact(s)));
    assert.equal(s.pausedForTurn, false, 'Automatic patient removal must release the cancelled First Aid pause');
    assert.equal(s.running, true);
  });

  await t.test('simultaneous manual and automatic delayed completion resumes the natural clock', async () => {
    let s = await fixture((room, nova, slug) => {
      manual(nova);
      nova.delayedAction.remaining = 0;
      slug.queuedEffects = [{ id: 'analysis-same-boundary', label: 'Systems Analysis: processing report', progress: 100,
        rate: 100, resolving: false, sensorReport: { shipId: slug.location.starshipId,
          targetId: nova.location.starshipId, values: [8], total: 100 } }];
    });
    assert.equal(s.activeAction?.unitId, novaId);
    assert.equal(s.units.find(u => u.id === slugId).queuedEffects[0].resolving, true);
    s = await gm({ action: 'completeTurn', id: novaId });
    const atb = s.units.find(u => u.id === slugId).atb;
    assert.equal(s.units.find(u => u.id === slugId).queuedEffects.length, 0, 'Automatic report completed');
    await sleep(350);
    s = await state();
    console.log('SIMULTANEOUS_AUTO', JSON.stringify(compact(s)));
    assert.equal(s.running, true, 'Automatic completion must continue scheduler dispatch');
    assert.ok(s.units.find(u => u.id === slugId).atb > atb);
  });

  await t.test('simultaneous manual and First Aid completion retains the second resolution', async () => {
    let s = await fixture((room, nova, slug) => {
      manual(nova); aid(slug, slug.id);
      nova.delayedAction.remaining = 0;
      slug.timedAction.remaining = 0;
    });
    assert.equal(s.activeAction?.unitId, novaId);
    assert.equal(s.units.find(u => u.id === slugId).timedAction, null, 'First Aid timer reached completion');
    s = await gm({ action: 'completeTurn', id: novaId });
    await sleep(350);
    s = await state();
    console.log('LOST_FIRST_AID', JSON.stringify(compact(s)));
    assert.equal(s.itemResolution?.healerId, slugId, 'Every completed First Aid must reach its GM difficulty prompt');
  });

  const destructionState = s => ({ running: s.running, hardPaused: s.hardPaused, rollPaused: s.rollPaused,
    pausedForTurn: s.pausedForTurn, activeId: s.activeId, activeAction: s.activeAction, itemResolution: s.itemResolution,
    ships: s.starships.map(ship => ({ id: ship.id, destroyed: Boolean(ship.destroyedAt), armed: ship.commandSystems?.armed })),
    units: s.units.map(u => ({ id: u.id, atb: u.atb, defeated: Boolean(u.defeatedAt), pendingShipRolls: u.pendingShipRolls })) });
  const destroyNovaShip = async s => {
    const shipId = s.units.find(u => u.id === novaId).location.starshipId;
    const destroyed = await gm({ action: 'damageStarship', starshipId: shipId, amount: 1000000 });
    assert.ok(destroyed.starships.find(ship => ship.id === shipId).destroyedAt);
    assert.ok(destroyed.units.find(u => u.id === novaId).defeatedAt);
    assert.equal(destroyed.units.find(u => u.id === novaId).currentHp, s.units.find(u => u.id === novaId).currentHp,
      'Ship destruction removes crew participation without changing character HP');
    return destroyed;
  };
  const seatAtBridge = (encounter, unit) => {
    const maps = require('../ship-map-core');
    const ship = encounter.starships.find(entry => entry.id === unit.location.starshipId);
    const [square, cell] = [...maps.buildLayout(ship.ship).footprint].find(([, cell]) =>
      maps.definition(cell.type).bridge && cell.stations.some(p => p.x === cell.column && p.y === cell.row));
    const station = cell.stations.find(p => p.x === cell.column && p.y === cell.row);
    unit.location = { starshipId: ship.id, square, mesh: station.mesh, sicId: cell.sicId, stationed: true };
    return ship;
  };
  const armSensorOrder = (encounter, unit, trigger) => {
    // Keep this recovery fixture uncertain; veteran Nova's default scan is guaranteed now.
    unit.sensorSkill=0;
    const ship = seatAtBridge(encounter, unit);
    // The expanded area pulse must still leave a genuine roll to recover/cancel.
    for (const target of encounter.starships) if (target.id !== ship.id) target.sensorScenarioMasking = 26;
    const { square, mesh, sicId } = unit.location;
    unit.delayedAction = { id: 'destruction-conditional-sensor', kind: 'action', label: 'Area Scan', rate: 100,
      remaining: 0, total: 100, consumeTurn: true, resolving: true, rollController: 'player',
      sensorOrder: { kind: 'area', shipId: ship.id, sicId:ship.ship.sicInventory.find(i=>require('../ship-map-core').definition(i.type).sensor).id, station: `${ship.id}:${sicId}:${square}:${mesh}`,
        trigger, receipt: 'destruction-conditional-sensor' } };
    // Build the saved armed state through the real completion helper, including its AU cost.
    require('../ship-commands').armExternal(encounter, unit, 'sensor');
    assert.equal(ship.commandSystems?.armed?.unitId, unit.id);
  };

  await t.test('destruction cancels an active deferred resolution owned by defeated crew', async () => {
    let s = await fixture((room, nova) => manual(nova));
    assert.equal(s.activeAction?.unitId, novaId);
    s = await destroyNovaShip(s);
    const before = s.units.find(u => u.id === slugId).atb;
    await sleep(400);
    s = await state();
    console.log('DESTROYED_ACTIVE_ACTION', JSON.stringify(destructionState(s)));
    assert.equal(s.activeAction, null, 'Defeated crew must not retain a deferred-resolution prompt');
    assert.equal(s.pausedForTurn, false);
    assert.ok(s.units.find(u => u.id === slugId).atb > before, 'Surviving crew resume without resolving a destroyed action');
  });

  await t.test('destruction cancels First Aid involving defeated crew and releases its pause', async () => {
    let s = await fixture((room, nova) => aid(nova, nova.id));
    assert.equal(s.itemResolution?.healerId, novaId);
    s = await destroyNovaShip(s);
    const before = s.units.find(u => u.id === slugId).atb;
    await sleep(400);
    s = await state();
    console.log('DESTROYED_FIRST_AID', JSON.stringify(destructionState(s)));
    assert.equal(s.itemResolution, null, 'Defeated crew must not retain a First Aid roll/difficulty prompt');
    assert.equal(s.pausedForTurn, false);
    assert.ok(s.units.find(u => u.id === slugId).atb > before);
  });

  await t.test('destruction cancels an already-triggered conditional roll and releases the dice pause', async () => {
    let s = await fixture((room, nova, slug) => armSensorOrder(room, nova,
      { kind: 'range', targetId: slug.location.starshipId, distance: 100 }));
    assert.equal(s.units.find(u => u.id === novaId).pendingShipRolls.length, 1, 'The living operator received a natural trigger');
    assert.equal(s.rollPaused, true);
    s = await destroyNovaShip(s);
    const before = s.units.find(u => u.id === slugId).atb;
    await sleep(400);
    s = await state();
    console.log('DESTROYED_PENDING_ROLL', JSON.stringify(destructionState(s)));
    assert.equal(s.rollPaused, false, 'A destroyed ship must not freeze survivors awaiting its obsolete conditional roll');
    assert.equal(s.units.find(u => u.id === novaId).pendingShipRolls.length, 0);
    assert.ok(s.units.find(u => u.id === slugId).atb > before);
  });

  await t.test('destruction disarms conditional orders before subsequent movement can request a roll', async () => {
    let s = await fixture((room, nova, slug) => {
      const sourceId = nova.location.starshipId, targetId = slug.location.starshipId;
      room.shipPositions = [{ id: sourceId, q: 0, r: 0 }, { id: targetId, q: 3, r: 0 }];
      const moving = room.starships.find(ship => ship.id === targetId);
      moving.navigation = { phase: 'powered', baseSpeed: 10, speed: 10, remaining: 3,
        target: { q: 0, r: 0 }, direction: { q: -1, r: 0 }, boosts: [], traveled: 0 };
      armSensorOrder(room, nova, { kind: 'range', targetId, distance: 1 });
    });
    const shipId = s.units.find(u => u.id === novaId).location.starshipId;
    assert.ok(s.starships.find(ship => ship.id === shipId).commandSystems?.armed);
    assert.equal(s.rollPaused, false, 'Trigger range has not yet been reached');
    await destroyNovaShip(s);
    await sleep(2200);
    s = await state();
    console.log('DESTROYED_ARMED_ORDER', JSON.stringify(destructionState(s)));
    assert.equal(s.rollPaused, false, 'Movement must not create a fresh dice pause for a destroyed ship');
    assert.equal(s.units.find(u => u.id === novaId).pendingShipRolls.length, 0);
    assert.ok(!s.starships.find(ship => ship.id === shipId).commandSystems?.armed);
    assert.ok(s.units.find(u => u.id === slugId).atb > 20, 'Natural survivor progression must continue through the old trigger');
  });

  const twoTreatments = (room, nova, slug) => {
    aid(nova, nova.id); aid(slug, slug.id);
    nova.timedAction.remaining = 0;
    slug.timedAction.remaining = 0;
  };
  const failTreatment = async resolution => {
    await gm({ action: 'setFirstAidDifficulty', difficulty: 12 });
    const submit = resolution.healerId === novaId ? pc : gm;
    await submit({ action: 'submitFirstAidRoll', id: resolution.healerId, resolutionId: resolution.id, score: 0 });
    return state();
  };

  await t.test('two First Aid completions open sequential prompts without overwriting either treatment', async () => {
    let s = await fixture(twoTreatments);
    const first = s.itemResolution;
    assert.equal(first?.healerId, novaId);
    assert.equal(s.units.find(u => u.id === slugId).pendingTimedResolutions.length, 1);
    const pausedAtb = s.units.map(u => u.atb);
    await sleep(250);
    s = await state();
    assert.equal(s.itemResolution.id, first.id, 'Second treatment must not overwrite the active first prompt');
    assert.deepEqual(s.units.map(u => u.atb), pausedAtb);
    s = await failTreatment(first);
    const second = s.itemResolution;
    assert.equal(second?.healerId, slugId);
    assert.notEqual(second.id, first.id);
    assert.equal(s.units.find(u => u.id === slugId).pendingTimedResolutions.length, 0);
    await sleep(250);
    assert.equal((await state()).itemResolution.id, second.id, 'The second prompt must wait for its own submission');
    s = await failTreatment(second);
    assert.equal(s.itemResolution, null);
    const before = s.units.map(u => u.atb);
    await sleep(350);
    s = await state();
    assert.ok(s.units.every((u, i) => u.atb > before[i]));
    assert.ok(s.units.every(u => !u.pendingTimedResolutions?.length));
  });

  await t.test('persisted second First Aid completion survives restore while the first prompt is open', async () => {
    let s = await fixture(twoTreatments);
    const firstId = s.itemResolution.id;
    const secondActionId = s.units.find(u => u.id === slugId).pendingTimedResolutions[0].id;
    await gm({ action: 'setHardPaused', paused: true });
    await sleep(400);
    const checkpoint = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
    assert.equal(checkpoint.campaign.encounter.itemResolution.id, firstId);
    assert.equal(checkpoint.campaign.encounter.units.find(u => u.id === slugId).pendingTimedResolutions[0].id, secondActionId);
    await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: checkpoint });
    s = await state();
    assert.equal(s.hardPaused, true);
    assert.equal(s.itemResolution.id, firstId);
    s = await failTreatment(s.itemResolution);
    assert.equal(s.hardPaused, true, 'Resolving the first prompt must not bypass the restored GM pause');
    assert.equal(s.itemResolution?.healerId, slugId);
    assert.equal(s.units.find(u => u.id === slugId).pendingTimedResolutions.length, 0);
    s = await failTreatment(s.itemResolution);
    assert.equal(s.hardPaused, true);
    assert.equal(s.itemResolution, null);
    await gm({ action: 'setHardPaused', paused: false });
    await gm({ action: 'setRunning', running: true });
    const before = (await state()).units.map(u => u.atb);
    await sleep(350);
    s = await state();
    assert.ok(s.units.every((u, i) => u.atb > before[i]));
    assert.equal(s.itemResolution, null, 'A restored completion must not dispatch twice');
  });

  await t.test('explicit GM hard pause survives manual First Aid participant cleanup', async () => {
    let s = await fixture((room, nova, slug) => {
      slug.location = { ...nova.location, mesh: 1 };
      aid(nova, slug.id);
    });
    assert.ok(s.itemResolution);
    await gm({ action: 'setHardPaused', paused: true });
    s = await gm({ action: 'removeUnit', id: slugId });
    assert.equal(s.itemResolution, null);
    assert.equal(s.pausedForTurn, false);
    assert.equal(s.hardPaused, true);
    const before = s.units.find(u => u.id === novaId).atb;
    await sleep(400);
    s = await state();
    assert.equal(s.hardPaused, true);
    assert.equal(s.units.find(u => u.id === novaId).atb, before);
    await gm({ action: 'setHardPaused', paused: false });
    await gm({ action: 'setRunning', running: true });
    await sleep(350);
    assert.ok((await state()).units.find(u => u.id === novaId).atb > before);
  });

  await t.test('explicit GM hard pause survives automatic defeated deferred-action owner cleanup', async () => {
    let s = await fixture((room, nova, slug) => manual(slug));
    assert.equal(s.activeAction?.unitId, slugId);
    await gm({ action: 'setHardPaused', paused: true });
    s = await gm({ action: 'setNpcHp', id: slugId, maximumHp: 24, currentHp: 0 });
    const before = s.units.find(u => u.id === novaId).atb;
    await sleep(6100);
    s = await state();
    assert.equal(s.units.find(u => u.id === slugId)?.currentHp,0,'Unconscious crew remain available to carry');
    assert.equal(s.activeAction, null);
    assert.equal(s.pausedForTurn, false);
    assert.equal(s.hardPaused, true);
    assert.equal(s.units.find(u => u.id === novaId).atb, before);
    await gm({ action: 'setHardPaused', paused: false });
    await gm({ action: 'setRunning', running: true });
    await sleep(350);
    assert.ok((await state()).units.find(u => u.id === novaId).atb > before);
  });

  await t.test('ending the encounter drops pending timed resolutions instead of resurrecting a treatment', async () => {
    let s = await fixture(twoTreatments);
    assert.equal(s.units.find(u => u.id === slugId).pendingTimedResolutions.length, 1);
    await gm({ action: 'clearEncounter' });
    await gm({ action: 'setRunning', running: true });
    await sleep(400);
    s = await state();
    console.log('RESET_PENDING_TREATMENT', JSON.stringify(compact(s)));
    assert.equal(s.itemResolution, null, 'Reset must discard the old pending treatment, not reopen it');
    assert.ok(s.units.every(u => !u.pendingTimedResolutions?.length));
    assert.equal(s.pausedForTurn, false);
    assert.ok(s.units.every(u => u.atb > 0));
  });

  await t.test('ending the encounter drops pending ship rolls and permits natural clock progression', async () => {
    let s = await fixture((room, nova, slug) => armSensorOrder(room, nova,
      { kind: 'range', targetId: slug.location.starshipId, distance: 100 }));
    assert.equal(s.rollPaused, true);
    assert.equal(s.units.find(u => u.id === novaId).pendingShipRolls.length, 1);
    await gm({ action: 'clearEncounter' });
    await gm({ action: 'setRunning', running: true });
    await sleep(400);
    s = await state();
    console.log('RESET_PENDING_ROLL', JSON.stringify(destructionState(s)));
    assert.equal(s.rollPaused, false, 'Reset must discard the obsolete conditional roll');
    assert.ok(s.units.every(u => !u.pendingShipRolls?.length));
    assert.ok(s.units.every(u => u.atb > 0));
  });

  await t.test('pending locked weapon input retains its lock and spent AU across encounter restore', async () => {
    const waitForState = async (predicate, label) => {
      const until = Date.now() + 15000;
      let current;
      do {
        current = await state();
        if (predicate(current)) return current;
        await sleep(100);
      } while (Date.now() < until);
      assert.fail(`${label}: ${JSON.stringify(compact(current))}`);
    };
    let s = await fixture((room, nova, slug) => {
      seatAtBridge(room, nova);
      nova.speed = 100;
      nova.atb = 99;
      slug.speed = 1;
      room.shipPositions = [{ id: nova.location.starshipId, q: 0, r: 0 }, { id: slug.location.starshipId, q: 2, r: 0 }];
    });
    assert.equal(s.activeId, novaId, 'The PC gets a natural-clock turn');
    const shipId = s.units.find(u => u.id === novaId).location.starshipId;
    const source = s.starships.find(ship => ship.id === shipId), target = s.starships.find(ship => ship.id !== shipId);
    const targeting = source.ship.sicInventory.find(item => require('../ship-map-core').definition(item.type).lockOn);
    const weapon = source.ship.sicInventory.find(item => item.type === 'beam-laser-1');
    assert.ok(targeting && weapon);
    s = await pc({ action: 'lockCommand', id: novaId, kind: 'lock', sicId: targeting.id,
      targetId: target.id, requestId: 'audit-persist-weapon-lock' });
    const lockRoll = s.units.find(u => u.id === novaId).delayedAction;
    assert.ok(lockRoll.awaitingRoll);
    await pc({ action: 'rollShipAction', id: novaId, rollId: lockRoll.id, score: 100 });
    s = await waitForState(current => current.activeId === novaId && !current.units.find(u => u.id === novaId).delayedAction,
      'Lock input and the following natural PC turn');
    assert.ok(s.starships.find(ship => ship.id === shipId).lockState.targets.some(lock => lock.targetId === target.id));
    const auBeforeShot = s.starships.find(ship => ship.id === shipId).auState.current;
    await pc({ action: 'weaponCommand', id: novaId, sicId: weapon.id, targetId: target.id, boosts: 1,
      requestId: 'audit-persist-locked-shot' });
    s = await gm({ action: 'setHardPaused', paused: true });
    const pending = s.units.find(u => u.id === novaId).delayedAction;
    assert.ok(pending?.weaponOrder?.locked && pending.remaining > 0, 'Save during a real locked firing input');
    assert.ok(!pending.awaitingRoll, 'A locked shot needs no accuracy roll');
    const auAfterShot = s.starships.find(ship => ship.id === shipId).auState.current;
    assert.ok(auAfterShot < auBeforeShot, 'Firing committed AU before restart');
    await sleep(400);
    const checkpoint = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
    assert.equal(checkpoint.campaign.encounter.units.find(u => u.id === novaId).delayedAction.id, pending.id);
    assert.ok(checkpoint.campaign.encounter.starships.find(ship => ship.id === shipId).lockState.targets.some(lock => lock.targetId === target.id));
    await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: checkpoint });
    s = await state();
    assert.equal(s.hardPaused, true);
    assert.equal(s.units.find(u => u.id === novaId).delayedAction.id, pending.id);
    assert.equal(s.starships.find(ship => ship.id === shipId).auState.current, auAfterShot, 'Spent AU must neither refill nor charge twice on restore');
    const restoredLocks = s.starships.find(ship => ship.id === shipId).lockState.targets;
    await gm({ action: 'setHardPaused', paused: false });
    await gm({ action: 'setRunning', running: true });
    s = await waitForState(current => {
      const delayed = current.units.find(u => u.id === novaId).delayedAction;
      return !delayed || delayed.weaponDamage;
    }, 'Restored weapon input completion');
    const damage = s.units.find(u => u.id === novaId).delayedAction;
    const reports = s.starships.find(ship => ship.id === shipId).weaponState.reports;
    console.log('RESTORED_LOCKED_WEAPON', JSON.stringify({ restoredLocks, pending: damage, reports }));
    assert.ok(damage?.weaponDamage && damage.awaitingRoll,
      'A paid locked shot must reach manual damage after restart, not cancel because its saved lock disappeared');
    assert.ok(restoredLocks.some(lock => lock.targetId === target.id));
    assert.equal(s.rollPaused, true);
    const before = s.units.map(u => u.atb);
    await sleep(250);
    assert.deepEqual((await state()).units.map(u => u.atb), before, 'Damage confirmation must still freeze the clock');
    await pc({ action: 'rollShipAction', id: novaId, rollId: damage.id, diceResults: Array(damage.weaponDamage.count).fill(1) });
    assert.equal((await state()).rollPaused, false);
  });

  for (const resolution of ['deferred action', 'First Aid']) await t.test(`destruction preserves an explicit GM pause while cancelling ${resolution}`, async () => {
    let s = await fixture((room, nova) => resolution === 'First Aid' ? aid(nova, nova.id) : manual(nova));
    assert.ok(resolution === 'First Aid' ? s.itemResolution : s.activeAction);
    s = await gm({ action: 'setHardPaused', paused: true });
    const before = s.units.find(u => u.id === slugId).atb;
    await destroyNovaShip(s);
    await sleep(400);
    s = await state();
    assert.equal(s.activeAction, null);
    assert.equal(s.itemResolution, null);
    assert.equal(s.pausedForTurn, false, 'The cancelled resolution no longer owns a pause');
    assert.equal(s.hardPaused, true, 'Destruction must not release the separate explicit GM pause');
    assert.equal(s.units.find(u => u.id === slugId).atb, before);
    await gm({ action: 'setRunning', running: true });
    await sleep(250);
    s = await state();
    assert.equal(s.hardPaused, true, 'Starting the clock cannot bypass Pause Everything');
    assert.equal(s.units.find(u => u.id === slugId).atb, before);
    await gm({ action: 'setHardPaused', paused: false });
    await gm({ action: 'setRunning', running: true });
    await sleep(350);
    assert.ok((await state()).units.find(u => u.id === slugId).atb > before, 'Only explicit GM resume restarts time');
  });
});
