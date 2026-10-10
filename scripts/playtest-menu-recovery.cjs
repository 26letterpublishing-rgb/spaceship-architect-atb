// Local-only menu recovery regressions. Optional arguments: cvc firstaid defeat stale epoch.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'test-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const out = fs.mkdtempSync(path.join(artifacts, 'menu-recovery-'));
const dataDir = path.join(out, 'isolated-data');
fs.mkdirSync(dataDir);
const cases = process.argv.slice(2);
assert.ok(cases.every(name => ['cvc', 'firstaid', 'defeat', 'stale', 'epoch'].includes(name)), 'Unknown test case');
const enabled = name => !cases.length || cases.includes(name);
const results = [];
const errors = [];
let failure = null;
const contexts = [];
let child, browser, gm, pc, gf, pf, base, room, person, player, preparation, nova, npc;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function pass(name, detail = {}) {
  results.push({ name, ...detail });
  console.log('PASS ' + name);
}
async function start(port = '0') {
  child = spawn(process.execPath, ['server.js'], {
    cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', SA_LOCAL_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', chunk => {
      const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) { clearTimeout(timer); resolve(url); }
    });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
  });
}
async function stop() {
  if (child && child.exitCode === null) {
    const done = once(child, 'exit');
    child.kill();
    await done;
  }
}
async function post(route, body) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(response.ok, route + ': ' + JSON.stringify(result));
  return result;
}
const act = body => post('/api/action', { roomCode: room.code, gmToken: room.gmToken, ...body });
const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
async function until(predicate, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const current = await state();
    if (predicate(current)) return current;
    await sleep(80);
  }
  throw Error(label + ': ' + JSON.stringify(await state()));
}
async function snapshot(frame) { return frame.evaluate(() => structuredClone(SACombatBridge.state())); }
async function visibleViewportBounds(page, frame, locator, label) {
  assert.ok(await locator.isVisible(), label + ' must be visible');
  const bounds = await locator.boundingBox();
  const viewport = { x: 0, y: 0, ...page.viewportSize() };
  const containers = [viewport];
  for (let current = frame; current.parentFrame(); current = current.parentFrame()) {
    const element = await current.frameElement();
    try { containers.push(await element.boundingBox()); } finally { await element.dispose(); }
  }
  for (const container of containers) {
    assert.ok(bounds && container && bounds.width > 0 && bounds.height > 0 &&
      bounds.x >= container.x - 1 && bounds.y >= container.y - 1 &&
      bounds.x + bounds.width <= container.x + container.width + 1 &&
      bounds.y + bounds.height <= container.y + container.height + 1,
    label + ' must fit within every enclosing viewport: ' + JSON.stringify({ bounds, container }));
  }
  const textFits = await locator.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()].every(rect => rect.left >= bounds.left - 1 && rect.top >= bounds.top - 1 &&
      rect.right <= bounds.right + 1 && rect.bottom <= bounds.bottom + 1);
  });
  assert.ok(textFits, label + ' text must not overflow its banner');
  return { bounds, containers };
}
async function prepare(name) {
  await act({ ...preparation, preparationId: 'menu-recovery-' + name + '-' + Date.now() });
  const current = await state();
  nova = current.units.find(u => u.characterId === person.id);
  npc = current.units.find(u => u.team === 'npc');
  await gf.waitForFunction(id => SACombatBridge.state()?.units.some(u => u.id === id), npc.id);
  await pf.waitForFunction(id => SACombatBridge.myUnitId() === id, nova.id);
  await act({ action: 'setHardPaused', paused: true });
  await pc.getByRole('button', { name: 'Combat', exact: true }).click();
}
async function ready(unit = nova) {
  const current = await state();
  assert.equal(current.activeId, null, 'Previous turn must be resolved before readiness');
  await act({ action: 'nudge', id: unit.id, amount: 100 });
  await gf.waitForFunction(id => SACombatBridge.state()?.activeId === id, unit.id);
  await pf.waitForFunction(id => SACombatBridge.state()?.activeId === id, unit.id);
}
async function setup() {
  base = await start();
  const demo = await post('/api/campaign/showcase/start', {});
  const campaign = await fetch(`${base}/api/campaign/state?code=${demo.code}&token=${demo.gmToken}`).then(r => r.json());
  const encounter = await fetch(`${base}/api/state?room=${demo.code}&token=${demo.gmToken}`).then(r => r.json());
  const created = await post('/api/campaign/create', { name: 'Menu recovery test', gmCode: 'isolated-menu-gm' });
  room = { code: created.campaign.code, gmToken: created.token };
  person = campaign.characters[0].character;
  person.access = { pcCode: 'isolated-menu-pc' };
  // A fast synthetic clinician keeps the normal First Aid timer test short.
  person.attributes.intellect = [4, 4, 4, 4];
  person.skills['First Aid'] = { tenths: 60 };
  if (person.computed) person.computed.skills = { ...person.computed.skills, 'First Aid': 6 };
  const joined = await post('/api/campaign/join/request', { code: room.code, character: person });
  await post('/api/campaign/join/respond', { code: room.code, token: room.gmToken, requestId: joined.requestId, decision: 'approve' });
  player = await post('/api/campaign/join/status', { code: room.code, characterId: person.id, pcCode: person.access.pcCode });
  for (const ship of encounter.starships) {
    ship.ship.confirmedOnce = true;
    ship.ship.id = ship.id;
    await post('/api/campaign/starship/link', { code: room.code, token: room.gmToken, controlType: ship.controlType, starship: ship.ship });
    await post('/api/campaign/starship/crew', { code: room.code, token: room.gmToken, starshipId: ship.id, crewCharacterIds: ship.controlType === 'pc' ? [person.id] : [] });
  }
  const pcUnit = encounter.units.find(u => u.team === 'pc');
  preparation = {
    action: 'prepareEncounter', mode: 'starship', starships: encounter.starships, shipPositions: encounter.shipPositions,
    units: encounter.units.map(unit => ({
      ...unit, preparationUnitId: unit.id, commandWindow: 120, speed: .1,
      intellectBoxes: unit.team === 'pc' ? 20 : unit.intellectBoxes,
      anatomySkill: unit.team === 'pc' ? 6 : unit.anatomySkill,
      location: unit.team === 'npc' ? { ...pcUnit.location, mesh: 5 } : unit.location,
    })),
  };
  await act({ ...preparation, preparationId: 'menu-recovery-initial' });
  browser = await chromium.launch({ channel: process.env.SA_BROWSER_CHANNEL || 'chrome', headless: true });
  for (let index = 0; index < 2; index++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addInitScript(() => {
      window.__menuStreams = [];
      window.__menuMessages = [];
      window.addEventListener('message', event => {
        if (event.origin === location.origin && String(event.data?.type).startsWith('sa-combat-')) {
          window.__menuMessages.push({ type: event.data.type, attackId: event.data.attackId, rollRole: event.data.rollRole });
        }
      });
      const Native = window.EventSource;
      window.EventSource = class extends Native {
        constructor(url, options) {
          super(url, options);
          if (String(url).startsWith('/events?')) window.__menuStreams.push(this);
        }
      };
    });
    contexts.push(context);
  }
  gm = await contexts[0].newPage();
  pc = await contexts[1].newPage();
  for (const page of [gm, pc]) {
    page.on('pageerror', error => errors.push(error.stack));
    page.on('dialog', dialog => dialog.accept());
  }
  await gm.addInitScript(({ code, token }) => sessionStorage.setItem(`sa-gm-token-${code}`, token), { code: room.code, token: room.gmToken });
  await pc.addInitScript(({ code, id, token }) => sessionStorage.setItem(`sa-character-token-${code}-${id}`, token), { code: room.code, id: person.id, token: player.token });
  await gm.goto(`${base}/gm.html?campaign=${room.code}&showcase=1`);
  await gm.getByRole('button', { name: 'Combat', exact: true }).click();
  await gm.getByRole('button', { name: 'Resume Encounter', exact: true }).click();
  await gm.frameLocator('#atbFrame').locator('#gmPanicPause').waitFor();
  gf = gm.frames().find(frame => frame.url().includes('embedded=gm'));
  await pc.goto(`${base}/character.html?campaign=${room.code}&character=${person.id}&showcase=1`);
  await pc.getByRole('button', { name: 'Combat', exact: true }).click();
  await pc.frameLocator('#playerAtbFrame').locator('body').waitFor({ state: 'attached' });
  pf = pc.frames().find(frame => frame.url().includes('embedded=player'));
  await gf.waitForFunction(() => window.SACombatBridge?.state()?.units.length);
  await pf.waitForFunction(() => window.SACombatBridge?.myUnitId());
}

async function cancellation(label, match) {
  await pc.locator('#skillCheckModal').waitFor({ state: 'visible' });
  const count = await pc.evaluate(() => __menuMessages.filter(m => m.type === 'sa-combat-roll-request').length);
  for (const selector of ['#cancelSkillCheck', '#skillCheckClose', '#cancelSkillCheck']) {
    await pc.locator(selector).click();
    await sleep(180);
    assert.ok(await pc.locator('#skillCheckModal').isVisible(), label + ' reopens');
    assert.match(await pc.locator('#skillCheckTitle').innerText(), match);
  }
  assert.equal(await pc.evaluate(() => __menuMessages.filter(m => m.type === 'sa-combat-roll-request').length), count,
    'Cancellation must requeue locally, without depending on another server prompt');
  pass(label + ': Cancel and Close preserve the pending request');
}

async function retrySubmission(actionName, value, { damage = false, pending, beforeFailure }) {
  const attempts = [];
  const received = deferred(), release = deferred();
  const routeHandler = async route => {
    const payload = route.request().postDataJSON();
    if (payload?.action !== actionName) return route.fallback();
    attempts.push(payload);
    if (attempts.length === 1) {
      received.resolve(payload);
      if (beforeFailure) await release.promise;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Menu recovery simulated outage' }) });
    }
    return route.fallback();
  };
  await contexts[1].route('**/api/action', routeHandler);
  const modal = pc.locator(damage ? '#combatDamageModal' : '#skillCheckModal');
  const scoreDisplay = pc.locator(damage ? '#combatDamageResult' : '#skillDiceValues');
  try {
    await modal.waitFor({ state: 'visible' });
    if (damage) {
      await pc.locator('#combatDamageManual').fill(String(value));
      await pc.locator('#submitManualCombatDamage').click();
    } else {
      await pc.locator('#manualSkillScore').fill(String(value));
      await pc.locator('#calculateManualSkill').click();
      await pc.getByRole('button', { name: 'Confirm and Submit', exact: true }).click();
    }
    if (beforeFailure) {
      await Promise.race([received.promise, sleep(5000).then(() => { throw Error('Submission was not captured'); })]);
      await beforeFailure(attempts[0]);
      release.resolve();
    }
    const retry = modal.getByRole('button', { name: 'Retry Submit', exact: true });
    await retry.waitFor({ state: 'visible' });
    assert.equal(attempts.length, 1);
    assert.ok(pending(await state()), 'Failed POST must leave the server awaiting this result');
    const retained = await scoreDisplay.innerText();
    assert.match(retained, new RegExp('\\b' + value + '\\b'), 'Entered score remains visible');
    await act({ action: 'setSpeed', id: nova.id, speed: .1 });
    await sleep(300);
    assert.ok(await retry.isVisible(), 'SSE rendering must not dismiss retry');
    assert.equal(await scoreDisplay.innerText(), retained);
    await pc.screenshot({ path: path.join(out, actionName + (beforeFailure ? '-after-defeat' : '') + '-retry.png') });
    await retry.click();
    await until(s => !pending(s), actionName + ' retry must be accepted');
    assert.equal(attempts.length, 2, 'One failure and one explicit retry, without duplicate posts');
    const fields = ['action', 'id', 'attackId', 'resolutionId', 'rollRole', 'score', 'rolledDamage', 'rolledHealing', 'mode', 'diceResults'];
    const submitted = payload => Object.fromEntries(fields.filter(key => payload[key] !== undefined).map(key => [key, payload[key]]));
    assert.deepEqual(submitted(attempts[1]), submitted(attempts[0]), 'Retry must retain the same actor, request, score, and dice');
    if (damage) {
      const close = pc.locator('#exitCombatDamageResult');
      if (await close.isVisible()) await close.click();
    }
    pass(actionName + ': visible retry retains and submits the same result', { value, attempts: attempts.map(submitted) });
  } finally {
    release.resolve();
    await contexts[1].unroute('**/api/action', routeHandler);
  }
}

async function cvc() {
  await prepare('cvc-defense');
  await ready(npc);
  await act({ action: 'gmBeginNpcAttack', attackerId: npc.id, defenderId: nova.id, weaponName: 'Menu recovery attack', distance: 1, damageFormula: '2D6' });
  const attack = (await state()).attackResolution;
  await act({ action: 'submitAttackRoll', id: npc.id, attackId: attack.id, rollRole: 'attacker', score: 0 });
  await cancellation('CvC defense', /Dodge/);
  await retrySubmission('submitAttackRoll', 30, { pending: s => s.attackResolution?.id === attack.id && !s.attackResolution.defenseRoll });
  await until(s => !s.attackResolution, 'Successful defense resolves the missed attack');

  await prepare('cvc-damage');
  await ready();
  await pf.locator('#myTurnBanner [data-combat-action="melee"]').click();
  await pf.locator('#combatTarget').selectOption(npc.id);
  await pf.locator('#combatActionForm button[type="submit"]').click();
  const attacking = await until(s => s.attackResolution?.attackerId === nova.id, 'PC melee attack begins');
  const id = attacking.attackResolution.id;
  await act({ action: 'submitAttackRoll', id: npc.id, attackId: id, rollRole: 'defender', score: 15 });
  await retrySubmission('submitAttackRoll', 20, { pending: s => s.attackResolution?.id === id && !s.attackResolution.attackerRoll });
  await retrySubmission('submitAttackDamage', 7, { damage: true, pending: s => s.attackResolution?.id === id && !s.attackResolution.damageRoll });
  const afterDamage = await state();
  if (afterDamage.attackResolution?.phase === 'gmDamage') {
    await gf.locator('#gmNpcFinalDamage').fill(String(afterDamage.attackResolution.damageSummary.applied));
    await gf.locator('#gmNpcDamageForm button[type="submit"]').click();
  }
  await until(s => !s.attackResolution, 'Damage completes the attack');
}

async function startFirstAid(name) {
  await prepare(name);
  await ready();
  await pf.locator('#myTurnBanner [data-combat-action="firstAid"]').click();
  await pf.locator('#combatTarget').selectOption(nova.id);
  await pf.locator('#combatUseKit').uncheck();
  await pf.locator('#combatActionForm button[type="submit"]').click();
  const treating = await until(s => s.units.find(u => u.id === nova.id)?.timedAction?.kind === 'firstAid', 'Normal First Aid click begins treatment');
  const duration = treating.units.find(u => u.id === nova.id).timedAction.total;
  assert.ok(duration <= 6, 'Synthetic clinician should finish treatment within six seconds');
  await act({ action: 'setHardPaused', paused: false });
  await act({ action: 'setRunning', running: true });
  const completed = await until(s => s.itemResolution?.phase === 'gmDifficulty', 'First Aid completes on the natural clock');
  return { aid: completed.itemResolution, duration };
}

async function firstAid() {
  const { aid, duration } = await startFirstAid('firstaid');
  await pc.getByRole('button', { name: 'Character Sheet', exact: true }).click();
  const attributes = pc.locator('[data-sheet-section-tab="attributes"]');
  if (await attributes.isVisible()) await attributes.click();
  await pc.locator('[data-roll-attribute="strength"]').click();
  const existingTitle = await pc.locator('#skillCheckTitle').innerText();
  await act({ action: 'setFirstAidDifficulty', resolutionId: aid.id, difficulty: 15 });
  await sleep(300);
  assert.equal(await pc.locator('#skillCheckTitle').innerText(), existingTitle, 'Incoming First Aid must preserve the existing attribute check');
  await pc.locator('#cancelSkillCheck').click();
  await pc.locator('#skillCheckTitle').filter({ hasText: 'First Aid' }).waitFor();
  assert.equal(await pc.locator('#playerAtbFrame').isVisible(), false);
  pass('First Aid queues behind another parent dialog while Combat is hidden', { duration });
  await cancellation('First Aid skill', /First Aid/);
  await retrySubmission('submitFirstAidRoll', 30, { pending: s => s.itemResolution?.id === aid.id && !s.itemResolution.roll });
  await retrySubmission('submitFirstAidHealing', 3, { damage: true, pending: s => s.itemResolution?.id === aid.id && !s.itemResolution.healingRoll });
  await until(s => !s.itemResolution, 'First Aid healing completes');
}

async function defeatUnrelatedNpcs(modalSelector) {
  const current = await state();
  const ship = current.starships.find(entry => entry.id === nova.location.starshipId);
  const square = ship.ship.gridCells.find(cell => !current.units.some(unit => unit.location?.starshipId === ship.id && unit.location?.square === cell));
  assert.notEqual(square, undefined, 'Second unrelated NPC needs an unoccupied fixture square');
  const added = await act({ action: 'addUnit', characterName: 'Menu Recovery Observer', playerName: 'GM',
    controlledBy: 'gm', team: 'npc', speed: .1, commandWindow: 120, currentHp: 10, maximumHp: 10,
    location: { starshipId: ship.id, square, mesh: 0 } });
  const second = added.units.find(unit => unit.characterName === 'Menu Recovery Observer');
  assert.ok(second && second.id !== npc.id);
  await pf.waitForFunction(id => SACombatBridge.state()?.units.some(unit => unit.id === id), second.id);
  const before = await pc.evaluate(() => __menuMessages.filter(message => message.type === 'sa-combat-defeat-sequence').length);
  await act({ action: 'applyDamage', id: npc.id, amount: 999, source: 'Menu recovery unrelated NPC defeat' });
  await pc.locator('body.combat-death-sequence').waitFor();
  assert.equal(await pc.locator(modalSelector).isVisible(), false, 'First defeat must hide the pending dialog before the second defeat');
  await sleep(250);
  await act({ action: 'applyDamage', id: second.id, amount: 999, source: 'Menu recovery overlapping NPC defeat' });
  await pc.waitForFunction(count => __menuMessages.filter(message => message.type === 'sa-combat-defeat-sequence').length >= count + 2, before);
  assert.ok(await pc.locator('body.combat-death-sequence').count());
  assert.equal(await pc.locator(modalSelector).isVisible(), false, 'Second defeat overlaps the already suspended dialog');
}

async function firstAidDefeat() {
  const { aid } = await startFirstAid('firstaid-unconfirmed-defeat');
  await act({ action: 'setFirstAidDifficulty', resolutionId: aid.id, difficulty: 15 });
  await pc.locator('#skillCheckModal').waitFor({ state: 'visible' });
  await pc.locator('#manualSkillScore').fill('30');
  await pc.locator('#calculateManualSkill').click();
  const result = pc.locator('#skillDiceValues');
  const original = await result.innerText();
  await result.evaluate(element => element.dataset.menuIdentity = 'unconfirmed-firstaid');
  const requests = [];
  const track = request => {
    if (request.url().endsWith('/api/action') && request.postDataJSON()?.action === 'submitFirstAidRoll') requests.push(request.postDataJSON());
  };
  pc.on('request', track);
  try {
    await defeatUnrelatedNpcs('#skillCheckModal');
    assert.equal(await pc.locator('#skillCheckModal').isVisible(), false, 'Defeat temporarily suspends the skill result');
    await pc.locator('body.combat-death-sequence').waitFor({ state: 'detached' });
    await pc.locator('#skillCheckModal').waitFor({ state: 'visible' });
    assert.equal(await result.innerText(), original);
    assert.match(original, /\b30\b/);
    assert.equal(await result.getAttribute('data-menu-identity'), 'unconfirmed-firstaid');
    assert.equal((await state()).itemResolution.id, aid.id);
    assert.equal((await state()).itemResolution.roll, null);
    assert.deepEqual(requests, [], 'Defeat must not submit or replace the unconfirmed score');
    const confirm = pc.getByRole('button', { name: 'Confirm and Submit', exact: true });
    assert.ok(await confirm.isEnabled());
    await pc.screenshot({ path: path.join(out, 'firstaid-unconfirmed-after-defeat.png') });
    await confirm.click();
    await until(s => s.itemResolution?.id === aid.id && s.itemResolution.phase === 'healing', 'Original First Aid score submits after defeat');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].resolutionId, aid.id);
    assert.equal(requests[0].score, 30);
    pass('Unconfirmed First Aid score 30 survives two overlapping unrelated NPC defeats and submits the same request');
    await pc.locator('#combatDamageManual').fill('3');
    await pc.locator('#submitManualCombatDamage').click();
    await until(s => !s.itemResolution, 'First Aid after defeat completes');
    await pc.locator('#exitCombatDamageResult').click();
  } finally { pc.off('request', track); }

  const next = (await startFirstAid('firstaid-pending-healing-defeat')).aid;
  await act({ action: 'setFirstAidDifficulty', resolutionId: next.id, difficulty: 15 });
  await pc.locator('#manualSkillScore').fill('30');
  await pc.locator('#calculateManualSkill').click();
  await pc.getByRole('button', { name: 'Confirm and Submit', exact: true }).click();
  await retrySubmission('submitFirstAidHealing', 3, {
    damage: true,
    pending: s => s.itemResolution?.id === next.id && !s.itemResolution.healingRoll,
    beforeFailure: async payload => {
      assert.equal(payload.resolutionId, next.id);
      await defeatUnrelatedNpcs('#combatDamageModal');
      assert.equal(await pc.locator('#combatDamageModal').isVisible(), false);
      await pc.locator('body.combat-death-sequence').waitFor({ state: 'detached' });
      assert.ok((await state()).itemResolution?.id === next.id, 'Unrelated defeat preserves First Aid resolution');
    },
  });
  pass('Healing submission held through two overlapping NPC defeats restores its original result and Retry after 503');
}

async function staleForm() {
  await prepare('stale-form');
  await ready();
  await gf.locator('#turnDialog [data-combat-action="defense"]').click();
  await gf.locator('#combatAmount').fill('7');
  await gf.locator('#combatAmount').evaluate(e => e.dataset.menuIdentity = 'preserved');
  await act({ action: 'damageStarship', starshipId: nova.location.starshipId, amount: 1 });
  await gm.getByRole('dialog', { name: 'Starship combat animation', exact: true }).waitFor();
  await gm.getByRole('dialog', { name: 'Starship combat animation', exact: true }).waitFor({ state: 'detached' });
  assert.equal(await gf.locator('#combatAmount').inputValue(), '7');
  assert.equal(await gf.locator('#combatAmount').getAttribute('data-menu-identity'), 'preserved');
  pass('Damage presentation restores the same action form and unfinished input');
  const requests = [];
  const track = request => { if (request.url().endsWith('/api/action') && request.postDataJSON()?.kind === 'defense') requests.push(request.postDataJSON()); };
  gm.on('request', track);
  try {
    await pf.locator('#playerEndTurn').click();
    await until(s => s.activeId === null, 'PC ends Nova turn independently');
    await ready(npc);
    const form = gf.locator('#combatActionDialog');
    await form.getByText('This turn has ended', { exact: false }).waitFor();
    assert.ok(await form.isVisible(), 'Stale form remains visible with its explanation');
    assert.ok(await gf.locator('#combatActionForm button[type="submit"]').isDisabled());
    assert.equal(await gf.locator('#combatAmount').inputValue(), '7');
    assert.equal(await gf.locator('#cancelCombatAction').isEnabled(), true);
    await gm.screenshot({ path: path.join(out, 'stale-gm-form.png') });
    await gf.locator('#cancelCombatAction').click();
    await form.waitFor({ state: 'hidden' });
    const current = await state();
    assert.equal(current.activeId, npc.id);
    assert.equal(current.units.find(u => u.id === npc.id).timedAction, null);
    assert.deepEqual(requests, [], 'Stale form must never submit a Defense for the replacement actor');
    pass('Stale GM form warns, disables submission, and cancels without changing the NPC turn');
  } finally { gm.off('request', track); }
}

async function epoch() {
  await prepare('epoch');
  for (let n = 0; n < 250; n++) await state();
  await act({ action: 'setSpeed', id: npc.id, speed: .1 });
  const before = { gm: await snapshot(gf), pc: await snapshot(pf) };
  const held = [];
  const handlers = [];
  try {
    for (const [index, frame] of [gf, pf].entries()) {
      const received = deferred(), release = deferred();
      held.push({ received, release });
      const handler = async route => {
        if (route.request().postDataJSON()?.action !== 'setColor') return route.fallback();
        try {
          const response = await route.fetch();
          const body = await response.text();
          received.resolve(JSON.parse(body));
          await release.promise;
          await route.fulfill({ status: response.status(), contentType: 'application/json', body });
        } catch (error) { received.reject(error); throw error; }
      };
      handlers.push(handler);
      await contexts[index].route('**/api/action', handler);
      await frame.evaluate(id => {
        window.__menuOldStream = __menuStreams.at(-1);
        window.__menuOldActionDone = false;
        window.__menuOldAction = SACombatBridge.action({ action: 'setColor', id, color: '#39e58f' })
          .finally(() => { window.__menuOldActionDone = true; });
      }, nova.id);
      await Promise.race([received.promise, sleep(5000).then(() => { throw Error('Old action response was not captured'); })]);
    }
    await sleep(350);
    const port = new URL(base).port;
    await stop();
    await start(port);
    const warnings = [];
    for (const [index, frame] of [gf, pf].entries()) {
      await frame.waitForFunction(() => document.querySelector('#connectionStatus')?.textContent.includes('Campaign access expired'), null, { timeout: 7000 });
      const status = frame.locator('#connectionStatus');
      assert.match(await status.getAttribute('class'), /disconnected/);
      assert.equal((await snapshot(frame)).stateEpoch, before.gm.stateEpoch, 'Anonymous reconnect must not replace authenticated state');
      await [gm, pc][index].screenshot({ path: path.join(out, index === 0 ? 'expired-auth-gm.png' : 'expired-auth-pc.png') });
      const role = index === 0 ? 'GM' : 'PC';
      warnings.push({ role, text: await status.innerText(), ...await visibleViewportBounds([gm, pc][index], frame, status, role + ' expired-access warning') });
    }
    pass('Restart rejects anonymous snapshots and requests renewed GM/PC credentials within the visible viewport', { warnings });
    const reopened = await post('/api/campaign/open', { name: 'Menu recovery test', gmCode: 'isolated-menu-gm' });
    room.gmToken = reopened.token;
    player = await post('/api/campaign/join/status', { code: room.code, characterId: person.id, pcCode: person.access.pcCode });
    await act({ action: 'nudge', id: nova.id, amount: 100 });
    const current = await state();
    assert.ok(current.stateEpoch && current.stateEpoch !== before.gm.stateEpoch);
    // Renewal is explicit: this tests epoch recovery, not automatic reauthentication.
    await gf.evaluate(token => { gmCampaignToken = token; connectEvents(); }, room.gmToken);
    await pf.evaluate(({ token, id }) => { campaignCharacterToken = token; myUnitId = id; connectEvents(); }, { token: player.token, id: nova.id });
    for (const frame of [gf, pf]) await frame.waitForFunction(({ epoch, id }) => SACombatBridge.state()?.stateEpoch === epoch && SACombatBridge.state()?.activeId === id, { epoch: current.stateEpoch, id: nova.id });
    const fresh = { gm: await snapshot(gf), pc: await snapshot(pf) };
    assert.equal(fresh.gm.accessRole, 'gm');
    assert.equal(fresh.pc.accessRole, 'character');
    assert.ok(fresh.gm.revision < before.gm.revision);
    assert.ok(fresh.pc.revision < before.pc.revision);
    await gf.locator('#turnDialog:not(.hidden)').waitFor();
    await pf.locator('#myTurnBanner:not(.hidden)').waitFor();
    for (const frame of [gf, pf]) assert.equal(await frame.evaluate(() => window.__menuOldActionDone), false, 'Old HTTP response remains pending until explicitly released');
    for (const item of held) item.release.resolve();
    for (const frame of [gf, pf]) await frame.waitForFunction(() => window.__menuOldActionDone);
    for (const [index, frame] of [gf, pf].entries()) {
      const oldResponse = await held[index].received.promise;
      assert.equal(oldResponse.stateEpoch, before.gm.stateEpoch);
      await frame.evaluate(old => __menuOldStream.dispatchEvent(new MessageEvent('state', { data: JSON.stringify(old) })), oldResponse);
      const after = await snapshot(frame);
      assert.equal(after.stateEpoch, current.stateEpoch, 'Delayed HTTP and retired SSE source must not restore the previous epoch');
      assert.equal(after.activeId, nova.id);
      assert.equal(after.hardPaused, true);
    }
    await gm.screenshot({ path: path.join(out, 'restart-gm-turn.png') });
    await pc.screenshot({ path: path.join(out, 'restart-pc-turn.png') });
    pass('Authenticated reconnect accepts a lower revision in a new epoch and ignores old HTTP/SSE responses', {
      previousRevision: before.gm.revision, nextRevision: fresh.gm.revision,
      previousEpoch: before.gm.stateEpoch, nextEpoch: fresh.gm.stateEpoch,
    });
  } finally {
    for (const item of held) item.release.resolve();
    for (const [index, handler] of handlers.entries()) await contexts[index].unroute('**/api/action', handler);
  }
}

async function main() {
  console.log('Artifacts: ' + out);
  await setup();
  if (enabled('cvc')) await cvc();
  if (enabled('firstaid')) await firstAid();
  if (enabled('defeat')) await firstAidDefeat();
  if (enabled('stale')) await staleForm();
  if (enabled('epoch')) await epoch();
  assert.deepEqual(errors, [], 'No unexpected page errors');
}
main().catch(async error => {
  failure = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
  for (const [name, page] of [['gm', gm], ['pc', pc]]) await page?.screenshot({ path: path.join(out, 'failure-' + name + '.png') }).catch(() => {});
}).finally(async () => {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: !failure, results, errors, failure }, null, 2));
  try { await browser?.close(); } finally { await stop(); }
});
