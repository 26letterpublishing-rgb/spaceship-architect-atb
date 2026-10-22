const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process'), { once } = require('node:events');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('GM takeover retains follow-up roll ownership without taking over a different combatant', { timeout: 15000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: '0', DATABASE_URL: '', SA_LOCAL_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sa-roll-takeover-')) },
    stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill(); await done; } });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timed out')), 8000);
    child.on('error', reject);
    child.stdout.on('data', chunk => { const url = String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1]; if (url) { clearTimeout(timeout); resolve(url); } });
  });
  const post = async (route, body, status = 200) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
  };
  const room = await post('/api/campaign/showcase/start', {}), player = room.players.find(p => p.name === 'Nova Vale');
  const gm = body => post('/api/action', { roomCode: room.code, gmToken: room.gmToken, ...body });
  const pc = (body, status) => post('/api/action', { roomCode: room.code, characterId: player.id, characterToken: player.token, ...body }, status);
  const state = () => fetch(`${base}/api/state?room=${room.code}&token=${room.gmToken}`).then(r => r.json());
  const initial = await gm({ action: 'setHardPaused', paused: true });
  const saved = await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r => r.json());
  const nova = initial.units.find(u => u.characterId === player.id), slug = initial.units.find(u => u.team === 'npc');
  async function restore(configure) {
    const encounter = structuredClone(initial);
    Object.assign(encounter, { activeId: null, activeAction: null, pausedForTurn: false, commandRemaining: null,
      commandDeadline: null, commandTotal: 0, holdPaused: false, resumeAfterTurn: true });
    for (const unit of encounter.units) Object.assign(unit, { atb: 0, speed: 1 });
    configure(encounter);
    await post('/api/campaign/restore', { code: room.code, token: room.gmToken, backup: { ...saved, campaign: { ...saved.campaign, encounter } } });
  }
  const attack = () => ({ id: 'takeover-attack', phase: 'checks', attackerId: nova.id, defenderId: slug.id,
    attackerName: nova.characterName, defenderName: slug.characterName, attackType: 'melee', weaponId: 'unarmed', weaponName: 'Unarmed',
    source: 'clock', distance: 0, plan: { allowed: true, attackModifier: 0, defenseRangeModifier: 0,
      damageFormula: '1D4', damageFormulaSupported: true, rangeExplanation: 'Melee' } });

  await t.test('taking over First Aid skill check retains the healing roll', async () => {
    await restore(s => { s.units.find(u => u.id === nova.id).timedAction = { id: 'takeover-aid', kind: 'firstAid', targetId: nova.id,
      remaining: .1, total: .1, label: 'First Aid', useKit: false, treatmentRating: 10 }; });
    await gm({ action: 'setHardPaused', paused: false }); await gm({ action: 'setRunning', running: true }); await sleep(350);
    let s = await state(); assert.equal(s.itemResolution?.healerId, nova.id);
    await gm({ action: 'setFirstAidDifficulty', difficulty: 12 });
    s = await gm({ action: 'submitFirstAidRoll', id: nova.id, resolutionId: s.itemResolution.id, score: 12 });
    assert.equal(s.itemResolution.phase, 'healing');
    assert.equal(s.itemResolution.rollController, 'gm', 'Healing belongs to the GM who took over the skill roll');
    await pc({ action: 'submitFirstAidHealing', id: nova.id, resolutionId: s.itemResolution.id, rolledHealing: 1 }, 403);
    s = await gm({ action: 'submitFirstAidHealing', id: nova.id, resolutionId: s.itemResolution.id, rolledHealing: 1 });
    assert.equal(s.itemResolution, null); assert.equal(s.pausedForTurn, false);
  });
  await t.test('taking over To-Hit retains damage but resolving Defense does not steal the attack', async () => {
    await restore(s => { s.attackResolution = attack(); s.pausedForTurn = true; s.activeId = nova.id; });
    let s = await gm({ action: 'submitAttackRoll', id: slug.id, attackId: 'takeover-attack', rollRole: 'defender', score: 1 });
    assert.notEqual(s.attackResolution.rollController, 'gm', 'GM-controlled defender does not take over the player attacker');
    s = await gm({ action: 'submitAttackRoll', id: nova.id, attackId: 'takeover-attack', rollRole: 'attacker', score: 10 });
    assert.equal(s.attackResolution.phase, 'damage');
    assert.equal(s.attackResolution.rollController, 'gm', 'GM-submitted To-Hit keeps damage with the same GM');
    await pc({ action: 'submitAttackDamage', id: nova.id, attackId: 'takeover-attack', rolledDamage: 1 }, 403);
  });
  await t.test('an old form cannot act on a later turn of the same character', async () => {
    await restore(() => {});
    let s = await gm({ action: 'nudge', id: nova.id, amount: 100 });
    const oldTurn = s.units.find(u => u.id === nova.id).turnSerial;
    await gm({ action: 'completeTurn', id: nova.id });
    s = await gm({ action: 'nudge', id: nova.id, amount: 100 });
    assert.notEqual(s.units.find(u => u.id === nova.id).turnSerial, oldTurn);
    await post('/api/action', { roomCode: room.code, gmToken: room.gmToken, action: 'playerCombatAction',
      id: nova.id, turnSerial: oldTurn, kind: 'defense', seconds: 7 }, 409);
    s = await state();
    assert.equal(s.activeId, nova.id);
    assert.equal(s.units.find(u => u.id === nova.id).timedAction, null);
  });
  await t.test('GM can finish a disconnected attacker from To-Hit through damage and NPC confirmation', async () => {
    await restore(s => { s.attackResolution = attack(); s.pausedForTurn = true; s.activeId = nova.id; });
    await post('/api/action',{roomCode:room.code,gmToken:room.gmToken,action:'submitAttackRoll',id:nova.id,attackId:'takeover-attack',rollRole:'attacker',score:10},409);
    await gm({ action:'submitAttackRoll', id:slug.id, attackId:'takeover-attack', rollRole:'defender', score:1 });
    let s = await gm({ action:'submitAttackRoll', id:nova.id, attackId:'takeover-attack', rollRole:'attacker', score:10 });
    assert.equal(s.attackResolution.attackerRoll.submittedBy,'gm');
    const pendingId=s.attackResolution.id;
    s = await gm({ action:'submitAttackDamage', id:nova.id, attackId:pendingId, rolledDamage:2 });
    assert.equal(s.attackResolution.phase,'gmDamage');
    s = await gm({ action:'confirmNpcDamage', attackId:pendingId, finalDamage:2 });
    assert.equal(s.attackResolution,null);assert.equal(s.pausedForTurn,false);
    await post('/api/action',{roomCode:room.code,gmToken:room.gmToken,action:'submitAttackDamage',id:nova.id,attackId:pendingId,rolledDamage:2},409);
  });
  await t.test('GM can finish a disconnected PC defender without requiring a player response', async () => {
    await restore(s => { s.attackResolution={...attack(),attackerId:slug.id,defenderId:nova.id,attackerName:slug.characterName,defenderName:nova.characterName};s.pausedForTurn=true;s.activeId=slug.id; });
    await gm({action:'submitAttackRoll',id:nova.id,attackId:'takeover-attack',rollRole:'defender',score:1});
    let s=await gm({action:'submitAttackRoll',id:slug.id,attackId:'takeover-attack',rollRole:'attacker',score:10});
    s=await gm({action:'submitAttackDamage',id:slug.id,attackId:s.attackResolution.id,rolledDamage:1});
    assert.equal(s.attackResolution,null);assert.equal(s.pausedForTurn,false);
  });
  await t.test('GM takeover at damage-count retains ownership of the final damage roll', async () => {
    await restore(s=>{s.attackResolution={...attack(),phase:'damage',weaponId:'thunder-rifle',weaponName:'Thunder Rifle',chargeCount:0,attackerRoll:{score:10},defenseRoll:{score:1},attackResult:{critical:false},followup:{kind:'damageCount',plan:attack().plan}};s.pausedForTurn=true;s.activeId=nova.id;});
    let s=await gm({action:'submitAttackDamage',id:nova.id,attackId:'takeover-attack',rolledDamage:2});
    assert.equal(s.attackResolution.phase,'damage');assert.notEqual(s.attackResolution.id,'takeover-attack');assert.equal(s.attackResolution.rollController,'gm');
    await pc({action:'submitAttackDamage',id:nova.id,attackId:s.attackResolution.id,rolledDamage:4},403);
    s=await gm({action:'submitAttackDamage',id:nova.id,attackId:s.attackResolution.id,rolledDamage:4});
    s=await gm({action:'confirmNpcDamage',attackId:s.attackResolution.id,finalDamage:4});
    assert.equal(s.attackResolution,null);assert.equal(s.pausedForTurn,false);
  });
});
