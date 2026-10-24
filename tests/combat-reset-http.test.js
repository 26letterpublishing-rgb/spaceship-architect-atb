const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process'), { once } = require('node:events');

test('Reset and Undo notify all clients and reject pre-reset actions', { timeout: 15000 }, async t => {
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
  let current=await gm({action:'setHardPaused',paused:true});
  const id=current.units.find(u=>u.characterId===player.id).id;
  await pc({action:'reset'},403);
  current=await gm({action:'reset'});assert.equal(current.combatReset.kind,'reset');
  const first=current.combatReset.id;assert.ok(first);
  assert.equal((await state()).combatReset.id,first);
  await pc({action:'setColor',id,color:'#ffffff',expectedCombatResetId:''},409);
  await pc({action:'setColor',id,color:'#abcdef',expectedCombatResetId:first});
  await gm({action:'setHardPaused',paused:true,expectedCombatResetId:first});
  current=await gm({action:'undoLastAction'});assert.equal(current.combatReset.kind,'undo');assert.notEqual(current.combatReset.id,first);
  await pc({action:'setColor',id,color:'#ffffff',expectedCombatResetId:first},409);
  current=await gm({action:'reset'});assert.ok(current.combatReset.id,'Reset is available even without another undo snapshot');
  const saved=await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  const encounter=structuredClone(current);encounter.arena=require('../combat-arena').normalize();encounter.hasEngagedClock=true;encounter.encounterEndedAt=null;encounter.hardPaused=true;encounter.surfaceVictoryAt=null;
  for(const u of encounter.units){u.currentHp=u.maximumHp||30;delete u.defeatedAt;}
  await post('/api/campaign/restore',{code:room.code,token:room.gmToken,backup:{...saved,campaign:{...saved.campaign,encounter}}});
  let s=await state();assert.equal(s.surfaceVictoryAt,null);
  for(const u of s.units.filter(u=>u.team==='npc'&&!u.allyNpc))s=await gm({action:'setNpcHp',id:u.id,maximumHp:u.maximumHp||30,currentHp:0});
  assert.ok(s.surfaceVictoryAt,'Defeating surface opposition announces victory');
  const victory=s.surfaceVictoryAt;assert.equal((await state()).surfaceVictoryAt,victory,'Victory is stable across updates');
  s=await gm({action:'undoLastAction'});assert.equal(s.surfaceVictoryAt,null,'Undo clears the reverted victory');
  assert.ok(s.units.some(u=>u.team==='npc'&&u.currentHp>0));
  const aboard=structuredClone(encounter);aboard.arena=null;aboard.surfaceVictoryAt=null;
  assert.ok(aboard.starships.length,'Fixture includes ships');
  const foes=aboard.units.filter(u=>u.team==='npc'&&!u.allyNpc);
  assert.ok(foes.length);aboard.units.push({...structuredClone(foes[0]),id:'surviving-ally',allyNpc:true,currentHp:30,maximumHp:30});
  await post('/api/campaign/restore',{code:room.code,token:room.gmToken,backup:{...saved,campaign:{...saved.campaign,encounter:aboard}}});
  for(let i=0;i<foes.length;i++){
    s=await gm({action:'setNpcHp',id:foes[i].id,maximumHp:30,currentHp:0});
    if(i<foes.length-1)assert.equal(s.surfaceVictoryAt,null,'Living hostile prevents infantry victory aboard ships');
  }
  assert.ok(s.surfaceVictoryAt,'Infantry victory aboard ships ignores surviving allies');
  assert.equal(s.units.find(u=>u.id==='surviving-ally').currentHp,30);
  const shipVictory=s.surfaceVictoryAt;assert.equal((await state()).surfaceVictoryAt,shipVictory);
  s=await gm({action:'undoLastAction'});assert.equal(s.surfaceVictoryAt,null);

});
