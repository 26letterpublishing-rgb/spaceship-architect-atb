const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const maps = require('../ship-map-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-artifacts', 'held-turn');
fs.mkdirSync(out, { recursive: true });
let child, browser, page;
const errors = [];

async function main() {
  child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sa-held-turn-')) },
    stdio: ['ignore', 'pipe', 'pipe'] });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    child.on('error', reject);
    child.stdout.on('data', chunk => {
      const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) { clearTimeout(timeout); resolve(url); }
    });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  browser = await chromium.launch({ channel: process.env.SA_BROWSER_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.on('pageerror', error => { errors.push(error.stack); console.error(error.stack); });
  page.on('dialog', dialog => dialog.accept());
  const created = page.waitForResponse(response => response.url().endsWith('/api/campaign/showcase/start'));
  await page.goto(base + '/showcase.html');
  const room = await (await created).json();
  const act = async body => {
    const response = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: room.code, gmToken: room.gmToken, ...body }) });
    const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
  };
  const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
  const gm = page.frameLocator('#showcaseFrame');
  await gm.getByRole('button', { name: 'Combat', exact: true }).click();
  await gm.getByRole('button', { name: 'Resume Encounter', exact: true }).click();
  const combat = gm.frameLocator('#atbFrame');
  await combat.getByRole('button', { name: 'Engage Clock', exact: true }).click();
  await act({ action: 'setHardPaused', paused: true });
  const initial = await state();
  const nova = initial.units.find(u => u.characterName === 'Nova Vale');
  const slug = initial.units.find(u => u.characterName === 'Space Slug');
  for (const unit of initial.units) await act({ action: 'setSpeed', id: unit.id, speed: 1 });
  await act({ action: 'nudge', id: nova.id, amount: 100 });
  assert.equal(Boolean((await state()).units.find(u=>u.id===nova.id).location.stationed),false);
  await combat.locator('#turnDialog').getByRole('button',{name:'Hold',exact:true}).click();assert.equal((await state()).units.find(u=>u.id===nova.id).atb,99);
  await act({action:'playerCombatAction',id:nova.id,kind:'resumeConsole'});await act({action:'nudge',id:nova.id,amount:1});console.log('PASS unstationed Hold from the actual GM action panel.');
  await combat.getByRole('button', { name: 'Move', exact: true }).click();
  const ship = initial.starships.find(s => s.id === nova.location.starshipId);
  const bridge = ship.ship.sicInventory.find(item => maps.definition(item.type).shipControl);
  const placement = ship.ship.placements.find(p => p.sicId === bridge.id);
  const map = combat.locator(`[data-inline-ship-map="${ship.id}"]`);
  await map.locator(`[data-map-square="${placement.cell}"][data-map-mesh="0"]`).click();
  await map.locator('[data-inline-confirm-move]').click();
  for (let tick = 0; tick < 100 && !(await state()).units.find(u => u.id === nova.id).location.stationed; tick++) {
    await act({ action: 'step' });
  }
  assert.ok((await state()).units.find(u => u.id === nova.id).location.stationed);
  if ((await state()).activeId !== nova.id) await act({ action: 'nudge', id: nova.id, amount: 100 });
  await combat.locator('#turnDialog').getByRole('button', { name: 'Hold', exact: true }).click();
  await page.waitForTimeout(300);
  assert.ok((await state()).units.find(u => u.id === nova.id).consoleHold);
  await act({ action: 'setSpeed', id: slug.id, speed: 10 });
  const frameIdentity = await combat.locator('body').evaluate(body => body.ownerDocument.defaultView.__heldTurnTestIdentity = Math.random());
  const assertPrompt = async () => {
    await combat.locator('#turnDialog:not(.hidden) #activeName').filter({ hasText: 'Space Slug' }).waitFor({ timeout: 5000 }).catch(async error => {
      const current = await state();
      console.log('Missing prompt:', JSON.stringify({ active: current.activeId, running: current.running,
        units: current.units.map(u => ({ name: u.characterName, atb: u.atb, speed: u.speed, timed: u.timedAction, delay: u.delayedAction, hold: u.consoleHold })) }));
      throw error;
    });
    await page.waitForTimeout(150);
    const bounds = await combat.locator('#turnDialog').evaluate(panel => {
      const win = panel.ownerDocument.defaultView, style = getComputedStyle(panel.ownerDocument.body), rect = panel.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom,
        visibleTop: parseFloat(style.getPropertyValue('--embedded-visible-top')) || 0,
        visibleBottom: win.innerHeight - (parseFloat(style.getPropertyValue('--embedded-hidden-bottom')) || 0),
        collapsed: panel.classList.contains('npc-collapsed'), identity: win.__heldTurnTestIdentity };
    });
    assert.ok(bounds.top >= bounds.visibleTop + 6, 'Turn Ready must stay below the visible viewport edge: ' + JSON.stringify(bounds));
    assert.ok(bounds.bottom <= bounds.visibleBottom - 6, 'Turn actions must fit the visible window: ' + JSON.stringify(bounds));
    assert.equal(bounds.collapsed, false, 'A new turn restores a previously collapsed NPC panel');
    assert.equal(bounds.identity, frameIdentity, 'GM frame was never reloaded to recover its prompt');
    const current = await state();
    assert.equal(current.activeId, slug.id);
    assert.ok(current.units.find(u => u.id === nova.id).consoleHold);
  };
  for (const [index, viewport] of [{ width: 1440, height: 1000 }, { width: 1366, height: 768 }, { width: 900, height: 650 }].entries()) {
    await act({ action: 'setHardPaused', paused: true });
    await page.setViewportSize(viewport);
    await combat.locator('#gmCharacterName').scrollIntoViewIfNeeded();
    const currentSlug = (await state()).units.find(u => u.id === slug.id);
    await act({ action: 'nudge', id: slug.id, amount: 90 - currentSlug.atb });
    await act({ action: 'setHardPaused', paused: false });
    await act({ action: 'setRunning', running: true });
    await assertPrompt();
    await page.screenshot({ path: path.join(out, `space-slug-turn-${viewport.width}.png`) });
    await combat.locator('#collapseNpcTurn').click();
    assert.equal(await combat.locator('#turnDialog').evaluate(panel => panel.classList.contains('npc-collapsed')), true);
    await combat.locator('#restoreNpcTurn').click();
    await assertPrompt();
    if (index === 0) {
      await combat.locator('#turnDialog').getByRole('button', { name: 'Wait 3', exact: true }).click();
      for (let tick = 0; tick < 5 && (await state()).activeId !== slug.id; tick++) await act({ action: 'step' });
      await assertPrompt();
    }
    await act({ action: 'setHardPaused', paused: true });
    if (index === 1) {
      await combat.locator('#collapseNpcTurn').click();
      await act({ action: 'completeTurn', id: slug.id });
    } else await combat.locator('#completeTurn').click();
    console.log(`PASS live-clock held-PC/NPC turn at ${viewport.width}x${viewport.height}, collapse/restore and usable actions.`);
  }
  const pc = await context.newPage();
  pc.on('pageerror', error => errors.push(error.stack));
  pc.on('dialog', dialog => dialog.accept());
  const player = room.players.find(p => p.id === nova.characterId);
  await pc.addInitScript(({ code, player }) => {
    sessionStorage.setItem(`sa-character-token-${code}-${player.id}`, player.token);
  }, { code: room.code, player });
  await pc.goto(`${base}/character.html?campaign=${room.code}&character=${player.id}&showcase=1`);
  await pc.getByRole('button', { name: 'Combat', exact: true }).click();
  const pcCombat = pc.frameLocator('#playerAtbFrame');
  await pcCombat.locator(`[data-ship-combat-lane="${ship.id}"]`).getByRole('button', { name: 'Resume', exact: true }).click();
  await act({ action: 'setHardPaused', paused: false });
  await act({ action: 'setRunning', running: true });
  await pcCombat.locator('#myTurnBanner').getByRole('button', { name: 'Hold', exact: true }).click();
  await pc.waitForTimeout(200);
  assert.ok((await state()).units.find(u => u.id === nova.id).consoleHold, 'Nova holds from her actual player controls');
  await act({ action: 'setHardPaused', paused: true });
  await act({ action: 'setSpeed', id: slug.id, speed: 100 });
  await act({ action: 'nudge', id: slug.id, amount: 95 - (await state()).units.find(u => u.id === slug.id).atb });
  await act({ action: 'setHardPaused', paused: false });
  await act({ action: 'setRunning', running: true });
  await page.bringToFront();
  await assertPrompt();
  await page.screenshot({ path: path.join(out, 'player-held-gm-prompt.png') });
  await combat.locator('#completeTurn').click();
  await pc.close();
  console.log('PASS player-owned Hold reaches the unchanged GM view on the next natural NPC turn.');
  assert.deepEqual(errors, []);
  console.log('PASS: Nova holds, Space Slug receives a usable GM turn without switching perspectives.');
}
main().catch(async error => {
  console.error(error); process.exitCode = 1;
  await page?.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
}).finally(async () => {
  await browser?.close();
  if (child && child.exitCode === null) { const closed = once(child, 'exit'); child.kill(); await closed; }
});
