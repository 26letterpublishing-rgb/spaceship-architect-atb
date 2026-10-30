const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CampaignApi } = require('../campaign-api');
const checkpoints = require('../encounter-checkpoints');

function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-crew-transaction-'));
  const file = path.join(dir, 'campaign.json');
  const store = {
    fail: false, gate: null,
    async get() { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; },
    async create(c) { await this.save(c); return true; },
    async save(c) { if (this.gate) await this.gate.promise; if (this.fail) throw Error('owned disk failure'); fs.writeFileSync(file, JSON.stringify(c)); },
    async findByName() { return []; },
  };
  let live;
  const api = new CampaignApi({ store, liveEncounter: () => live });
  const post = async (route, body, target = api) => {
    let response;
    await target.handle({ method: 'POST' }, {}, new URL('http://test/api/campaign/' + route), async () => body,
      (_, status, payload) => { response = { status, payload }; });
    return response;
  };
  const created = await post('create', { name: 'Crew transaction', gmCode: 'owned-gm' });
  assert.equal(created.status, 201);
  const { token, campaign: { code } } = created.payload;
  const campaign = await api.campaign(code);
  campaign.characters = ['pc', 'other'].map(id => ({ id, approved: true, character: { identity: { characterName: id }, health: { current: 10 }, computed: { maximumHp: 10 }, items: [] } }));
  const linked = await post('starship/link', { code, token, controlType: 'pc', starship: {
    id: 'ship', title: 'Crew ship', confirmedOnce: true, gridCells: [0, 1, 20, 21], placements: [], sicInventory: [],
  } });
  assert.equal(linked.status, 201);
  const npc = { id: 'npc', team: 'npc', characterName: 'Crew NPC' };
  const unrelated = structuredClone(campaign.starships[0]);
  Object.assign(unrelated, { id: 'unrelated', title: 'Other crew', crewCharacterIds: ['other'], crewNpcUnitIds: ['other-npc'] });
  Object.assign(unrelated.ship, { id: 'unrelated', title: 'Other crew', crewCharacterIds: ['other'], crewNpcUnitIds: ['other-npc'] });
  campaign.starships.push(unrelated);
  live = { hasEngagedClock: true, running: false, hardPaused: true, units: [npc], starships: [structuredClone(campaign.starships[0])] };
  live.starships[0].auState = { current: 7, progress: 0 };
  live.starships[0].currentHullHp = 9;
  campaign.encounter = structuredClone(live);
  campaign.npcRoster = [npc, { id: 'other-npc', team: 'npc', characterName: 'Unrelated crew NPC' }];
  api.lastCheckpoint = new Map([[code, Date.now()]]);
  await api.save(campaign);
  const pcToken = api.newSession(code, 'character', 'pc');
  const body = { code, token, starshipId: 'ship', crewCharacterIds: ['pc'] };
  assert.equal((await post('starship/crew', body)).status, 200);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { api, store, campaign, live, post, body, pcToken, code, file };
}

test('crew assignment serializes behind an older encounter snapshot and commits before responding', { timeout: 10000 }, async t => {
  const f = await fixture(t), entered = deferred(), release = deferred();
  t.mock.method(checkpoints, 'softSave', async () => { entered.resolve(); await release.promise; });
  f.live.starships[0].auState.current = 6;
  f.live.starships[0].currentHullHp = 8;
  const oldSave = f.api.saveEncounter(f.code, structuredClone(f.live));
  await entered.promise;
  const oldQueue = f.api.saveQueues.get(f.code);
  let responded = false;
  const assign = f.post('starship/crew', { ...f.body, crewNpcUnitIds: ['npc'] }).then(r => { responded = true; return r; });
  // Wait for enqueue, not a timing guess or release coupled to the old buggy mutation.
  for (let i = 0; f.api.saveQueues.get(f.code) === oldQueue && i < 50; i++) await new Promise(setImmediate);
  assert.notEqual(f.api.saveQueues.get(f.code), oldQueue, 'crew transaction entered the queue');
  assert.equal(responded, false);
  assert.deepEqual(f.campaign.starships[0].crewNpcUnitIds, []);
  assert.deepEqual(f.live.starships[0].crewNpcUnitIds, []);
  release.resolve();
  await oldSave;
  const assigned = await assign;
  assert.equal(assigned.status, 200);
  assert.deepEqual(assigned.payload.starship.crewNpcUnitIds, ['npc']);
  const pc = await f.post('starship/crew', { ...f.body, token: f.pcToken, characterId: 'pc' });
  assert.equal(pc.status, 200);
  assert.deepEqual(pc.payload.starship.crewNpcUnitIds, ['npc']);
  for (const state of [f.campaign, await f.store.get()]) {
    assert.deepEqual(state.starships[0].crewNpcUnitIds, ['npc']);
    assert.deepEqual(state.encounter.starships[0].crewNpcUnitIds, ['npc']);
    assert.equal(state.starships[0].ship.encounterState.auState.current, 6);
    assert.equal(state.starships[0].ship.currentHullHp, 8);
    assert.deepEqual(state.starships.find(s => s.id === 'unrelated').crewNpcUnitIds, ['other-npc']);
    assert.deepEqual(state.starships.find(s => s.id === 'unrelated').crewCharacterIds, ['other']);
  }
  assert.deepEqual(f.live.starships[0].crewNpcUnitIds, ['npc']);
  const restarted = new CampaignApi({ store: f.store });
  assert.deepEqual((await restarted.campaign(f.code)).starships[0].crewNpcUnitIds, ['npc']);
  assert.equal(f.api.saveQueues.has(f.code), false);
});

test('crew permissions, explicit GM removal, invalid roster and queued authority stay intact', { timeout: 10000 }, async t => {
  const f = await fixture(t);
  await f.post('starship/crew', { ...f.body, crewNpcUnitIds: ['npc'] });
  const pc = await f.post('starship/crew', { ...f.body, token: f.pcToken, characterId: 'pc', crewNpcUnitIds: [] });
  assert.deepEqual(pc.payload.starship.crewNpcUnitIds, ['npc'], 'PC cannot erase GM NPC crew');
  assert.equal((await f.post('starship/crew', { ...f.body, crewCharacterIds: ['other'], crewNpcUnitIds: ['missing'] })).status, 409);
  assert.deepEqual(f.campaign.starships[0].crewCharacterIds, ['pc'], 'invalid NPC request must not partially change PC crew');
  const remove = await f.post('starship/crew', { ...f.body, crewNpcUnitIds: [] });
  assert.deepEqual(remove.payload.starship.crewNpcUnitIds, []);
  const gate = deferred(); f.api.saveQueues.set(f.code, gate.promise);
  const gm = f.post('starship/crew', { ...f.body, crewCharacterIds: ['other'] });
  const stalePc = f.post('starship/crew', { ...f.body, token: f.pcToken, characterId: 'pc' });
  await new Promise(setImmediate); gate.resolve();
  assert.equal((await gm).status, 200);
  assert.equal((await stalePc).status, 403, 'permission is checked against the preceding committed roster');
  assert.deepEqual((await f.store.get()).starships[0].crewCharacterIds, ['other']);
});

test('crew write failure publishes neither a success response nor partial crew, and queue recovers', { timeout: 10000 }, async t => {
  const f = await fixture(t), original = JSON.parse(fs.readFileSync(f.file));
  f.store.fail = true;
  await assert.rejects(f.post('starship/crew', { ...f.body, crewNpcUnitIds: ['npc'] }), /owned disk failure/);
  assert.deepEqual(f.campaign.starships[0].crewNpcUnitIds, []);
  assert.deepEqual(f.live.starships[0].crewNpcUnitIds, []);
  assert.deepEqual(await f.store.get(), original);
  assert.equal(f.api.saveQueues.has(f.code), false);
  f.store.fail = false;
  f.store.gate = deferred();
  let completed = false;
  const pending = f.post('starship/crew', { ...f.body, crewNpcUnitIds: ['npc'] }).then(r => { completed = true; return r; });
  await new Promise(setImmediate);
  assert.equal(completed, false);
  assert.deepEqual(f.live.starships[0].crewNpcUnitIds, []);
  f.store.gate.resolve();
  assert.equal((await pending).status, 200);
  assert.deepEqual((await f.store.get()).starships[0].crewNpcUnitIds, ['npc']);
});

for (const change of ['assign NPC', 'remove NPC', 'change PC crew']) {
  test(`queued gameplay snapshot preserves preceding committed ${change}`, { timeout: 10000 }, async t => {
    const f = await fixture(t);
    t.mock.method(checkpoints, 'softSave', async () => {});
    if (change !== 'assign NPC') await f.post('starship/crew', { ...f.body, crewNpcUnitIds: ['npc'] });
    const entered = deferred(), release = deferred(), save = f.store.save.bind(f.store);
    let gateOnce = true;
    f.store.save = async c => { if (gateOnce) { gateOnce = false; entered.resolve(); await release.promise; } return save(c); };
    const body = { ...f.body, crewNpcUnitIds: change === 'remove NPC' ? [] : ['npc'],
      crewCharacterIds: change === 'change PC crew' ? ['other'] : ['pc'] };
    const pendingCrew = f.post('starship/crew', body);
    await entered.promise;
    const snapshot = structuredClone(f.live);
    snapshot.starships[0].auState.current = 5;
    snapshot.starships[0].currentHullHp = 4;
    snapshot.shipPositions = { ship: { q: 3, r: 2 } };
    snapshot.units[0].delayedAction = { id: 'preserved-action', remaining: 7 };
    snapshot.starships.push({ id: 'encounter-only', crewCharacterIds: ['visitor'], crewNpcUnitIds: ['visitor-npc'], ship: { crewCharacterIds: ['visitor'], crewNpcUnitIds: ['visitor-npc'] } });
    const originalSnapshot = structuredClone(snapshot);
    const pendingEncounter = f.api.saveEncounter(f.code, snapshot);
    await new Promise(setImmediate);
    release.resolve();
    assert.equal((await pendingCrew).status, 200);
    await pendingEncounter;
    assert.deepEqual(snapshot, originalSnapshot, 'do not mutate the captured gameplay object');
    for (const state of [f.campaign, await f.store.get(), await new CampaignApi({ store: f.store }).campaign(f.code)]) {
      for (const ship of [state.starships[0], state.encounter.starships[0]]) {
        for (const key of ['crewCharacterIds', 'crewNpcUnitIds']) {
          assert.deepEqual(ship[key], body[key]);
          assert.deepEqual(ship.ship[key], body[key]);
        }
      }
      assert.equal(state.encounter.starships[0].auState.current, 5);
      assert.equal(state.encounter.starships[0].currentHullHp, 4);
      assert.deepEqual(state.encounter.shipPositions, originalSnapshot.shipPositions);
      assert.deepEqual(state.encounter.units[0].delayedAction, originalSnapshot.units[0].delayedAction);
      assert.deepEqual(state.encounter.starships[1], originalSnapshot.starships[1]);
      assert.deepEqual(state.starships[1].crewNpcUnitIds, ['other-npc']);
    }
    for (const key of ['crewCharacterIds', 'crewNpcUnitIds']) {
      assert.deepEqual(f.live.starships[0][key], body[key]);
      assert.deepEqual(f.live.starships[0].ship[key], body[key]);
    }
  });
}

test('campaign roster transfers replace old snapshots without resurrecting source crew', async t => {
  const f = await fixture(t);
  t.mock.method(checkpoints, 'softSave', async () => {});
  await f.post('starship/crew', { ...f.body, crewNpcUnitIds: ['npc'] });
  const snapshot = structuredClone(f.live);
  snapshot.starships.push(structuredClone(f.campaign.starships[1]));
  // The existing rescue handler copies these authoritative top-level rosters
  // from live ships into campaign records before saving (server utilityCommand).
  Object.assign(f.campaign.starships[0], { crewCharacterIds: [], crewNpcUnitIds: [] });
  Object.assign(f.campaign.starships[1], { crewCharacterIds: ['other', 'pc'], crewNpcUnitIds: ['other-npc', 'npc'] });
  await f.api.save(f.campaign);
  await f.api.saveEncounter(f.code, snapshot);
  const saved = await f.store.get();
  for (let i = 0; i < 2; i++) for (const key of ['crewCharacterIds', 'crewNpcUnitIds']) {
    assert.deepEqual(saved.encounter.starships[i][key], f.campaign.starships[i][key]);
    assert.deepEqual(saved.encounter.starships[i].ship[key], f.campaign.starships[i][key]);
  }
});

test('real gameplay during crew persistence retains roster through a fresh server room load', { timeout: 45000 }, async t => {
  const { spawn } = require('node:child_process');
  const { once } = require('node:events');
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-crew-http-order-'));
  const marker = name => path.join(dir, name);
  const preload = marker('gate.cjs');
  // Scheduling instrumentation only: no roster/state rewrites or timing-rule changes.
  fs.writeFileSync(preload, `
    const fs=require('fs'), p=require(${JSON.stringify(path.join(root, 'campaign-api'))}).CampaignApi.prototype;
    const save=p.save, encounter=p.saveEncounter;let used=false;
    p.save=async function(c,...args){
      if(!used&&fs.existsSync(${JSON.stringify(marker('arm'))})&&c.starships.some(s=>s.crewNpcUnitIds?.length)){
        used=true;fs.writeFileSync(${JSON.stringify(marker('entered'))},'crew persistence pending');
        const end=Date.now()+7000;
        while(!fs.existsSync(${JSON.stringify(marker('release'))})){
          if(Date.now()>end)throw Error('owned crew gate timed out');await new Promise(r=>setTimeout(r,5));
        }
      }return save.call(this,c,...args);
    };
    p.saveEncounter=async function(code,snapshot){
      const gated=fs.existsSync(${JSON.stringify(marker('entered'))})&&!fs.existsSync(${JSON.stringify(marker('release'))});
      const previous=this.saveQueues.get(code), pending=encounter.call(this,code,snapshot);
      if(gated){
        for(let i=0;this.saveQueues.get(code)===previous&&i<50;i++)await new Promise(setImmediate);
        if(this.saveQueues.get(code)===previous)throw Error('encounter did not enqueue');
        fs.writeFileSync(${JSON.stringify(marker('captured.json'))},JSON.stringify(snapshot));
        fs.writeFileSync(${JSON.stringify(marker('release'))},'encounter queued');
      }
      const result=await pending;if(gated)fs.writeFileSync(${JSON.stringify(marker('done'))},'persisted');return result;
    };
  `);
  let child, base;
  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill(); await exited;
  }
  async function start(instrumented) {
    child = spawn(process.execPath, [...(instrumented ? ['-r', preload] : []), 'server.js'], {
      cwd: root, env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: dir },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error('owned startup timeout: ' + output)), 10000);
      child.once('error', e => { clearTimeout(timer); reject(e); });
      child.once('exit', code => { clearTimeout(timer); reject(Error('owned server exited ' + code + ': ' + output)); });
      child.stderr.on('data', b => { output += b; });
      child.stdout.on('data', b => { output += b; const match = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
  }
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const post = async (route, body, expected = 200) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  };
  const waitMarker = async name => {
    const end = Date.now() + 10000;
    while (!fs.existsSync(marker(name))) { assert.ok(Date.now() < end, 'owned marker missing: ' + name); await new Promise(r => setTimeout(r, 10)); }
  };
  await start(true);
  const created = await post('/api/campaign/create', { name: 'Crew HTTP order', gmCode: 'test-gm' }, 201);
  const { token, campaign: { code } } = created;
  const ship = { id: 'crew-http-ship', title: 'Crew test', confirmedOnce: true,
    gridCells: Array.from({ length: 16 }, (_, i) => Math.floor(i / 4) * 20 + i % 4),
    placements: [{ sicId: 'au', cell: 0 }], sicInventory: [{ id: 'au', type: 'au-engine-4' }] };
  await post('/api/campaign/starship/link', { code, token, controlType: 'gm', starship: ship }, 201);
  const combat = async body => post('/api/action', await require('./helpers/confirmed-encounter.cjs')(base, { roomCode: code, gmToken: token, ...body }));
  await combat({ action: 'syncEncounterStarships', starships: [{ id: ship.id, title: ship.title, ship }] });
  let state = await combat({ action: 'addUnit', team: 'npc', characterName: 'Assigned NPC', playerName: 'GM', speed: 1, commandWindow: 10, location: { starshipId: ship.id, square: 0, mesh: 4 } });
  const npcId = state.units.find(u => u.team === 'npc').id;
  await combat({ action: 'toggleClock' });
  await combat({ action: 'setHardPaused', paused: true });
  fs.writeFileSync(marker('arm'), 'arm');
  const assignment = post('/api/campaign/starship/crew', { code, token, starshipId: ship.id, crewCharacterIds: [], crewNpcUnitIds: [npcId] });
  await waitMarker('entered');
  state = await combat({ action: 'spendShipAu', starshipId: ship.id, amount: 1 });
  assert.deepEqual((await assignment).starship.crewNpcUnitIds, [npcId]);
  await waitMarker('done');
  const captured = JSON.parse(fs.readFileSync(marker('captured.json')));
  assert.deepEqual(captured.starships.find(s => s.id === ship.id).crewNpcUnitIds, [], 'real gameplay captured the pre-commit roster');
  const expectedAu = state.starships.find(s => s.id === ship.id).auState.current;
  const disk = JSON.parse(fs.readFileSync(marker('campaigns.json'))).find(c => c.code === code);
  for (const saved of [disk.starships.find(s => s.id === ship.id), disk.encounter.starships.find(s => s.id === ship.id)]) {
    assert.deepEqual(saved.crewNpcUnitIds, [npcId]); assert.deepEqual(saved.ship.crewNpcUnitIds, [npcId]);
  }
  assert.equal(disk.encounter.starships.find(s => s.id === ship.id).auState.current, expectedAu);
  await stop();
  await start(false);
  const response = await fetch(base + '/api/state?room=' + code + '&token=' + token);
  assert.equal(response.status, 200);
  const restored = await response.json(), restoredShip = restored.starships.find(s => s.id === ship.id);
  assert.ok(restoredShip, 'fresh server restored the room ship');
  assert.deepEqual(restoredShip.crewNpcUnitIds, [npcId]);
  // normalizeEncounterStarships deliberately exposes roster fields on the outer
  // runtime record; the nested saved mirrors were checked on disk above.
  assert.equal(Object.hasOwn(restoredShip.ship, 'crewNpcUnitIds'), false);
  assert.equal(restoredShip.auState.current, expectedAu);
});
