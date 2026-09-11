const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function browser() {
  const context = vm.createContext({
    state: { revision: 20, units: [] }, embeddedPlayer: false, mode: 'gm', myUnitId: '',
    currentRoomCode: 'TEST', gmCampaignToken: '', campaignCharacterToken: '', campaignCharacterId: '',
    window: { dispatchEvent() {} }, document: { hidden: false },
    CustomEvent: class {}, render() {}, playGmSound() {}, setConnected() {}, connectEvents() {},
    encounterStateUrl: () => '/api/state', lastCombatPromptKey: '', gmNpcPromptSignature: '',
  });
  vm.runInContext(source.slice(source.indexOf('function receiveState('), source.indexOf('window.SACombatBridge =')), context);
  vm.runInContext(source.slice(source.indexOf('async function recoverVisibleCombatState('), source.indexOf('function queueVisibleCombatRecovery(')), context);
  return context;
}

test('late action responses cannot rewind newer live combat state', async () => {
  const c = browser();
  c.fetch = async () => ({ ok: true, json: async () => ({ revision: 12, units: [] }) });
  await vm.runInContext("action({action:'rollShipAction'})", c);
  assert.equal(c.state.revision, 20);
});

test('focus recovery preserves newer events but can recover a restarted server', async () => {
  const c = browser();
  let deliver;
  c.fetch = () => new Promise(resolve => { deliver = resolve; });
  const pending = vm.runInContext('recoverVisibleCombatState()', c);
  c.receiveState({ revision: 30, units: [] });
  deliver({ ok: true, json: async () => ({ revision: 22, units: [] }) });
  await pending;
  assert.equal(c.state.revision, 30);
  c.fetch = async () => ({ ok: true, json: async () => ({ revision: 2, units: [] }) });
  await vm.runInContext('recoverVisibleCombatState()', c);
  assert.equal(c.state.revision, 2);
});
