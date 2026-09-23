const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a weapon input with a subnormal remainder resolves on the live clock and releases ATB after manual damage', { timeout: 15000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sa-weapon-clock-')) },
    stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill(); await done; } });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timed out')), 8000);
    child.on('error', reject);
    child.stdout.on('data', chunk => { const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1]; if (url) { clearTimeout(timeout); resolve(url); } });
  });
  const post = async (route, body) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
  };
  const room = await post('/api/campaign/showcase/start', {});
  await require('./helpers/combat-demo.cjs')(base,room);
  const act = body => post('/api/action', { roomCode: room.code, gmToken: room.gmToken, ...body });
  const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
  let current = await act({ action: 'setHardPaused', paused: true });
  const nova = current.units.find(u => u.characterName === 'Nova Vale'), slug = current.units.find(u => u.characterName === 'Space Slug');
  const ship = current.starships.find(s => s.id === nova.location.starshipId), target = current.starships.find(s => s.id !== ship.id);
  const bridge = ship.ship.sicInventory.find(i => i.type === 'bridge-1'), gun = ship.ship.sicInventory.find(i => i.type === 'ripple-cannon-1');
  const square = ship.ship.placements.find(p => p.sicId === bridge.id).cell;
  const initialBackup = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
  initialBackup.campaign.encounter = { ...current, shipPositions: [{ id: ship.id, q: 0, r: 0 }, { id: target.id, q: 2, r: 0 }] };
  await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: initialBackup });
  await act({ action: 'setCombatLocation', id: nova.id, location: { starshipId: ship.id, square, mesh: 0 } });
  await act({ action: 'nudge', id: nova.id, amount: 100 });
  current = await act({ action: 'weaponCommand', id: nova.id, sicId: gun.id, targetId: target.id, boosts: 2, requestId: 'tiny-remainder-weapon' });
  let pending = current.units.find(u => u.id === nova.id).delayedAction;
  assert.ok(pending.awaitingRoll);
  await act({ action: 'rollShipAction', id: nova.id, rollId: pending.id, score: 100 });
  current = await state();
  // Replay the floating-point remainder observed when rate * (remaining/rate)
  // rounds down repeatedly. This is test-only data, restored through the API.
  const saved = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
  saved.campaign.encounter = { ...current, running: false, hardPaused: true, resumeAfterTurn: true };
  saved.campaign.encounter.units.find(u => u.id === nova.id).delayedAction.remaining = Number.MIN_VALUE;
  await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: saved });
  await act({ action: 'setHardPaused', paused: false });
  await act({ action: 'setRunning', running: true });
  await sleep(600);
  current = await state();
  pending = current.units.find(u => u.id === nova.id).delayedAction;
  assert.ok(pending?.weaponDamage, 'A displayed 00:00 input must reach its manual damage prompt, not stall the entire clock: ' + JSON.stringify(pending));
  assert.equal(current.rollPaused, true, 'Damage still requires an explicit roll');
  const before = current.units.map(u => u.atb);
  await sleep(300);
  assert.deepEqual((await state()).units.map(u => u.atb), before, 'ATB remains frozen until damage is confirmed');
  const damage = Array(pending.weaponDamage.count).fill(1);
  await act({ action: 'rollShipAction', id: nova.id, rollId: pending.id, diceResults: damage });
  const after = await state();
  assert.equal(after.rollPaused, false);
  assert.equal(after.units.find(u => u.id === nova.id).delayedAction, null);
  await sleep(400);
  assert.ok((await state()).units.find(u => u.id === slug.id).atb > after.units.find(u => u.id === slug.id).atb, 'ATB resumes without menu switching or GM stepping');
  const settled = await act({ action: 'setHardPaused', paused: true });
  for (const [name, configure, completed] of [
    ['reload', u => { u.delayTimer = { id: 'tiny-reload', kind: 'timer', rate: 25.4, remaining: Number.MIN_VALUE, total: 100, resolving: false }; }, s => !s.units.find(u => u.id === nova.id).delayTimer],
    ['queued effect', u => { u.queuedEffects = [{ id: 'tiny-queued', label: 'Precision test', rate: 25.4, progress: 100 - 1e-14, resolving: false }]; }, s => s.activeAction?.effectId === 'tiny-queued'],
    ['zero-duration wait', u => { u.atb = 100; u.timedAction = { id: 'zero-wait', kind: 'wait', label: 'Wait 3', remaining: 0, total: 3, commandRemaining: 30 }; }, s => !s.units.find(u => u.id === nova.id).timedAction && s.activeId === nova.id],
  ]) {
    const fixture = structuredClone(settled);
    Object.assign(fixture, { activeId: null, activeAction: null, pausedForTurn: false, resumeAfterTurn: true, command: null, commandRemaining: null });
    const u = fixture.units.find(u => u.id === nova.id);
    Object.assign(u, { atb: 0, delayedAction: null, delayTimer: null, timedAction: null, queuedEffects: [] });
    configure(u);
    saved.campaign.encounter = fixture;
    await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: saved });
    await act({ action: 'setHardPaused', paused: false });
    await act({ action: 'setRunning', running: true });
    await sleep(500);
    assert.ok(completed(await state()), name + ' must cross its boundary instead of stalling the live clock');
  }
});
