const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process'), { once } = require('node:events');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-artifacts', 'combat-recovery');
fs.mkdirSync(out, { recursive: true });
let child, browser, gm, pc;
const errors = [];

async function main() {
  child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sa-combat-recovery-')) },
    stdio: ['ignore', 'pipe', 'pipe'] });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    child.on('error', reject);
    child.stdout.on('data', chunk => { const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1]; if (url) { clearTimeout(timeout); resolve(url); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  const post = async (route, body) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
  };
  const room = await post('/api/campaign/showcase/start', {}), player = room.players.find(p => p.name === 'Nova Vale');
  await require('../tests/helpers/combat-demo.cjs')(base, room);
  const act = body => post('/api/action', { roomCode: room.code, gmToken: room.gmToken, ...body });
  const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
  const initial = await act({ action: 'setHardPaused', paused: true });
  const nova = initial.units.find(u => u.characterId === player.id), slug = initial.units.find(u => u.team === 'npc');
  const ship = initial.starships.find(s => s.id === nova.location.starshipId), target = initial.starships.find(s => s.id !== ship.id);
  const bridge = ship.ship.sicInventory.find(i => i.type === 'bridge-1');
  const square = ship.ship.placements.find(p => p.sicId === bridge.id).cell;
  const saved = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
  saved.campaign.encounter = { ...initial, shipPositions: [{ id: ship.id, q: 0, r: 0 }, { id: target.id, q: 2, r: 0 }] };
  await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: saved });
  await act({ action: 'setCombatLocation', id: nova.id, location: { starshipId: ship.id, square, mesh: 0 } });
  await act({ action: 'setSpeed', id: nova.id, speed: 1 });
  await act({ action: 'setSpeed', id: slug.id, speed: .1 });
  browser = await chromium.launch({ channel: process.env.SA_BROWSER_CHANNEL || 'chrome', headless: true });
  const gmContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const pcContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  let dropped=false,dropSubmission=false,breakDiceLoad=false,brokenDiceLoad=false;
  await pcContext.route('**/api/action',async route=>{
    if(dropSubmission&&!dropped&&route.request().postDataJSON()?.action==='rollShipAction'){dropped=true;await route.abort('failed');}
    else await route.continue();
  });
  await pcContext.route('**/character.js*',async route=>{
    if(breakDiceLoad&&!brokenDiceLoad&&route.request().frame().url().includes('shipRoll=1')){brokenDiceLoad=true;await route.abort('failed');}
    else await route.continue();
  });
  function monitor(page) { page.on('pageerror', e => errors.push(e.stack)); page.on('dialog', d => d.accept()); }
  gm = await gmContext.newPage(); monitor(gm);
  await gm.addInitScript(({ code, token }) => sessionStorage.setItem(`sa-gm-token-${code}`, token), { code: room.code, token: room.gmToken });
  await gm.goto(`${base}/gm.html?campaign=${room.code}&showcase=1`);
  await gm.getByRole('button', { name: 'Combat', exact: true }).click();
  await gm.getByRole('button', { name: 'Resume Encounter', exact: true }).click();
  const gc = gm.frameLocator('#atbFrame');
  await gc.locator('body').waitFor();
  pc = await pcContext.newPage(); monitor(pc);
  await pc.addInitScript(({ code, player }) => sessionStorage.setItem(`sa-character-token-${code}-${player.id}`, player.token), { code: room.code, player });
  const pcUrl = `${base}/character.html?campaign=${room.code}&character=${player.id}&showcase=1`;
  await pc.goto(pcUrl); await pc.getByRole('button', { name: 'Combat', exact: true }).click();
  const pcCombat = () => pc.frameLocator('#playerAtbFrame');
  const gmIdentity = await gc.locator('body').evaluate(b => b.ownerDocument.defaultView.__recoveryIdentity = Math.random());
  const waitUntil = async (predicate, label, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const current = await state(); if (predicate(current)) return current; await gm.waitForTimeout(100); }
    throw Error(label + ': ' + JSON.stringify(await state()));
  };
  const rollDialog = page => page.getByRole('dialog', { name: 'Ship action dice roll', exact: true });
  async function roll(page, total) {
    const view = rollDialog(page); await view.waitFor();
    const dice = view.frameLocator('iframe');
    await dice.getByRole('spinbutton', { name: 'Manual Final Score', exact: true }).fill(String(total));
    await dice.getByRole('button', { name: 'Calculate Manual Result', exact: true }).click();
    await dice.getByRole('button', { name: 'Confirm and Submit', exact: true }).click();
  }
  async function ready() {
    await act({ action: 'setHardPaused', paused: true });
    const s = await state(); assert.equal(s.units.find(u => u.id === nova.id).delayedAction, null);
    await act({ action: 'nudge', id: nova.id, amount: 100 - s.units.find(u => u.id === nova.id).atb });
  }
  async function fire() {
    await ready();
    await pcCombat().getByRole('button', { name: 'Fire Ripple Cannon 1', exact: true }).click();
    const consoleView = pc.locator(`dialog[data-operator-id="${nova.id}"]`).filter({ has: pc.locator('[data-fire]') });
    await consoleView.locator('[data-boosts]').fill('2');
    await consoleView.locator('[data-fire]').click();
    await rollDialog(pc).waitFor();
  }
  async function runInput() {
    await act({ action: 'setHardPaused', paused: false }); await act({ action: 'setRunning', running: true });
    return waitUntil(s => s.units.find(u => u.id === nova.id).delayedAction?.weaponDamage, 'Input must reach damage on the natural clock');
  }
  async function finishDamage(page) {
    const s = await state(), pending = s.units.find(u => u.id === nova.id).delayedAction;
    assert.ok(pending?.weaponDamage);
    await roll(page, pending.weaponDamage.count + (pending.weaponDamage.damageBonus || 0));
    await rollDialog(page).waitFor({ state: 'detached' });
    const after = await state(); assert.equal(after.rollPaused, false);
    await waitUntil(s => s.units.find(u => u.id === slug.id).atb > after.units.find(u => u.id === slug.id).atb, 'ATB resumes after damage');
    for (const page of [gm, pc]) {
      await page.getByRole('dialog', { name: 'Starship combat animation', exact: true }).waitFor({ state: 'detached' });
      const back = page.locator('dialog[data-operator-id] [data-close]'); if (await back.isVisible()) await back.click();
    }
    const combatView = pc.getByRole('button', { name: 'Combat View', exact: true }); if (await combatView.isVisible()) await combatView.click();
  }

  await fire();
  const beforeCancel = (await state()).units.find(u => u.id === nova.id).delayedAction.id;
  assert.equal(await rollDialog(pc).frameLocator('iframe').getByRole('button', { name: 'Cancel', exact: true }).isVisible(),false);
  await pc.keyboard.press('Escape');assert.equal(await rollDialog(pc).isVisible(),true);
  breakDiceLoad=true;
  await pc.reload(); await pc.locator('button[data-character-tab=atb].active').waitFor();
  await rollDialog(pc).getByRole('button',{name:'Retry Loading Dice',exact:true}).waitFor();
  assert.equal((await state()).units.find(u=>u.id===nova.id).delayedAction.id,beforeCancel);
  assert.equal((await state()).rollPaused,true);breakDiceLoad=false;
  await rollDialog(pc).getByRole('button',{name:'Retry Loading Dice',exact:true}).click();
  await rollDialog(pc).frameLocator('iframe').getByRole('spinbutton',{name:'Manual Final Score',exact:true}).waitFor();
  assert.equal(await rollDialog(pc).getByText('Loading dice...',{exact:true}).isVisible(),false);
  console.log('PASS blocked dice script offers a visible loading retry, preserving the original pending roll and ATB pause.');
  await rollDialog(pc).waitFor();
  assert.equal((await state()).units.find(u => u.id === nova.id).delayedAction.id, beforeCancel);
  await roll(pc, 100); await rollDialog(pc).waitFor({ state: 'detached' });
  await runInput(); await rollDialog(pc).waitFor();
  console.log('PASS required dice cannot be cancelled; player reload recovers the same pending roll, then input reaches damage.');

  // Drop one submitted request. The same visible roll must remain retryable.
  dropSubmission=true;
  const damage = (await state()).units.find(u => u.id === nova.id).delayedAction.weaponDamage;
  await roll(pc, damage.count + (damage.damageBonus || 0));
  await rollDialog(pc).getByRole('button', { name: 'Retry Submit', exact: true }).waitFor();
  assert.equal((await state()).rollPaused, true);
  await rollDialog(pc).getByRole('button', { name: 'Retry Submit', exact: true }).click();
  await rollDialog(pc).waitFor({ state: 'detached' });
  dropSubmission=false;
  await waitUntil(s => !s.rollPaused && !s.units.find(u => u.id === nova.id).delayedAction, 'Retry completes exactly one damage roll');
  for (const page of [gm, pc]) await page.getByRole('dialog', { name: 'Starship combat animation', exact: true }).waitFor({ state: 'detached' });
  const back = pc.locator('dialog[data-operator-id] [data-close]'); if (await back.isVisible()) await back.click();
  const combatView = pc.getByRole('button', { name: 'Combat View', exact: true }); if (await combatView.isVisible()) await combatView.click();
  console.log('PASS interrupted damage submission stays paused and the visible retry finishes it.');

  await fire();
  await pcContext.setOffline(true);
  await gm.getByRole('status').filter({ hasText: 'roll required' }).click();
  await roll(gm, 100); await rollDialog(gm).waitFor({ state: 'detached' });
  const waiting = await runInput();
  assert.equal(waiting.units.find(u => u.id === nova.id).delayedAction.rollController, 'gm', 'A GM takeover must retain ownership for follow-up damage while the PC is offline');
  await rollDialog(gm).waitFor();
  await gm.screenshot({ path: path.join(out, 'gm-takeover-damage.png') });
  await pcContext.setOffline(false);
  await finishDamage(gm);
  assert.equal(await gc.locator('body').evaluate(b => b.ownerDocument.defaultView.__recoveryIdentity), gmIdentity, 'GM never switches roles or reloads to recover a prompt');
  console.log('PASS disconnected-player takeover keeps follow-up damage with the unchanged GM window.');
  assert.deepEqual(errors, []);
}
main().catch(async error => {
  console.error(error); process.exitCode = 1;
  for (const [name, page] of [['gm', gm], ['pc', pc]]) await page?.screenshot({ path: path.join(out, 'failure-' + name + '.png') }).catch(() => {});
}).finally(async () => { await browser?.close(); if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } });
