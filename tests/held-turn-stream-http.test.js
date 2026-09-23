const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const wire = require('../combat-wire');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a final clock update reaches GM and PC streams when an NPC becomes ready while a PC holds', { timeout: 20000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sa-held-stream-')) },
    stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const closed = once(child, 'exit'); child.kill(); await closed; }
  });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timeout')), 8000);
    child.on('error', reject);
    child.stdout.on('data', chunk => {
      const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) { clearTimeout(timer); resolve(url); }
    });
  });
  const post = async (route, body) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
  };
  const room = await post('/api/campaign/showcase/start', {});
  const act = body => post('/api/action', { roomCode: room.code, gmToken: room.gmToken, ...body });
  const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
  let current = await act({ action: 'setHardPaused', paused: true });
  const nova = current.units.find(u => u.characterName === 'Nova Vale');
  const slug = current.units.find(u => u.characterName === 'Space Slug');
  const ship = current.starships.find(s => s.id === nova.location.starshipId);
  const bridge = ship.ship.sicInventory.find(i => i.type === 'bridge-1');
  const cell = ship.ship.placements.find(p => p.sicId === bridge.id).cell;
  await act({ action: 'setCombatLocation', id: nova.id, location: { starshipId: ship.id, square: cell, mesh: 0 } });
  await act({ action: 'nudge', id: nova.id, amount: 100 });
  await act({ action: 'playerCombatAction', id: nova.id, kind: 'holdConsole' });
  await act({ action: 'setSpeed', id: slug.id, speed: 100 });

  const openStream = async token => {
    const controller = new AbortController();
    const response = await fetch(`${base}/events?delta=1&room=${room.code}&token=${token}`, { signal: controller.signal });
    assert.equal(response.status, 200);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    const view = { state: null, errors: [] };
    const pump = (async () => {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (!event.includes('data: ')) continue;
            const payload = JSON.parse(event.split('data: ')[1]);
            if (event.startsWith('event: state\n')) view.state = payload;
            else if (event.startsWith('event: state-delta\n')) view.state = wire.apply(view.state, payload);
          }
        }
      } catch (error) { if (!controller.signal.aborted) view.errors.push(error.message); }
    })();
    t.after(async () => { controller.abort(); await pump; });
    return view;
  };
  const gm = await openStream(room.gmToken);
  const pc = await openStream(room.players.find(p => p.id === nova.characterId).token);
  for (let turn = 0; turn < 4; turn++) {
    current = await act({ action: 'setHardPaused', paused: true });
    await act({ action: 'nudge', id: slug.id, amount: 95 - current.units.find(u => u.id === slug.id).atb });
    await act({ action: 'setHardPaused', paused: false });
    await act({ action: 'setRunning', running: true });
    // This final tick occurs inside the 200ms network limit, then NPC readiness
    // stops the clock. No action, refresh or subsequent tick may be needed.
    await sleep(650);
    current = await state();
    assert.equal(current.activeId, slug.id, 'NPC actually became ready on the server');
    assert.equal(gm.state?.activeId, slug.id, 'GM receives the final ready update without reloading');
    assert.equal(gm.state?.pausedForTurn, true);
    assert.equal(pc.state?.pausedForTurn, true, 'PC also learns the clock is waiting');
    assert.ok(pc.state.units.find(u => u.id === nova.id).consoleHold);
    assert.equal(pc.state.units.some(u => u.id === slug.id), false, 'Final delivery preserves NPC privacy');
    await act({ action: 'setHardPaused', paused: true });
    await act({ action: 'completeTurn', id: slug.id });
    await sleep(250);
    assert.equal(gm.state.activeId, null, 'An old queued snapshot cannot resurrect the completed turn');
  }
  assert.deepEqual(gm.errors, []);
  assert.deepEqual(pc.errors, []);
});
