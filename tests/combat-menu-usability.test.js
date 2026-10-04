const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../combat-actions.js'), 'utf8');
const start = source.indexOf('  const stationCategories =');
const end = source.indexOf('  // Hold keeps', start);
const context = {};
vm.runInNewContext(source.slice(start, end), context);
const entries = labels => labels.map(label => [label, '[data-action]', '', 'station']);

test('an unstationed character has no empty ship action categories', () => {
  assert.equal(context.stationMenuCategories([]).length, 0);
  assert.deepEqual(Array.from(context.stationMenuCategories(entries(['Scan Area', 'Scan Hex'])), row => row.id), ['sensors']);
});

test('bridge categories contain only actual supported actions with accurate counts', () => {
  const labels = ['Move Ship', 'Ram', 'Skim', 'Scan Area', 'Hail Ship', 'Lock-On', 'Fire Beam Laser 4', 'Evasive Maneuvers', 'Break Lock-On', 'NUT Supplement'];
  const categories = context.stationMenuCategories(entries(labels));
  assert.deepEqual(Array.from(categories, ({ id, count }) => [id, count]), [['movement', 3], ['sensors', 2], ['weapons', 2], ['defense', 2], ['utilities', 1]]);
  assert.equal(categories.reduce((sum, row) => sum + row.count, 0), labels.length);
});

function menu(ids, actionCategories) {
  const tabs = ids.map(id => ({ dataset: { stationCategory: id }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }));
  const rows = actionCategories.map(id => ({ dataset: { actionCategory: id }, hidden: true }));
  const heading = { textContent: '' };
  return { dataset: {}, tabs, rows, heading,
    querySelectorAll(selector) { return selector === '[data-station-category]' ? tabs : rows; },
    querySelector() { return heading; },
  };
}

test('choosing a category shows its actions and keeps every category reachable', () => {
  const view = menu(['movement', 'sensors'], ['movement', 'movement', 'sensors']);
  context.chooseStationCategory(view, 'sensors', 'operator');
  assert.equal(view.dataset.category, 'sensors');
  assert.deepEqual(view.rows.map(row => row.hidden), [true, true, false]);
  assert.deepEqual(view.tabs.map(tab => tab.attributes['aria-pressed']), ['false', 'true']);
  assert.ok(view.tabs.every(tab => !tab.hidden));
  assert.equal(view.heading.textContent, 'Sensors & Comms');
  context.chooseStationCategory(view, 'movement', 'operator');
  assert.deepEqual(view.rows.map(row => row.hidden), [false, false, true]);
});

test('a lost station category falls back to the next real action group', () => {
  const view = menu(['defense'], ['defense']);
  context.chooseStationCategory(view, 'movement', 'operator');
  assert.equal(view.dataset.category, 'defense');
  assert.equal(view.rows[0].hidden, false);
  assert.equal(view.heading.textContent, 'Ship Defense');
});

test('a compact ship move keeps the explicitly selected remote helm', () => {
  const code = fs.readFileSync(require.resolve('../ship-navigation-ui.js'), 'utf8');
  const first = code.indexOf('  function openAction(');
  const last = code.indexOf('  function toggle(', first);
  const calls = [];
  const fixture = { window: {}, open: (unit, options) => calls.push({ unit, options }) };
  vm.runInNewContext(code.slice(first, last), fixture);
  const operator = { id: 'pilot', location: { starshipId: 'home' } };
  fixture.openAction(operator, 'remote-bridge', '[data-move-ship]');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.compact, true);
  assert.equal(calls[0].options.sicId, 'remote-bridge');
  assert.equal(calls[0].unit, operator);
});

test('every console remembers explicit close and Escape, without changing view during switching', () => {
  const code = fs.readFileSync(require.resolve('../console-common.js'), 'utf8');
  const first = code.indexOf('  function bindConsoleExit(');
  const last = code.indexOf('  function mount(', first);
  const listeners = {}, remembered = [];
  const fixture = { window: { SAShipNavigationUI: { remember: unit => remembered.push(unit) } } };
  vm.runInNewContext(code.slice(first, last), fixture);
  const unit = { id: 'nova' }, current = { ...unit, consoleHold: true };
  fixture.bindConsoleExit({ addEventListener: (name, fn) => listeners[name] = fn }, unit, { state: () => ({ units: [current] }) });
  listeners.click({ target: { closest: () => null } });
  assert.equal(remembered.length, 0, 'an ordinary console action must not opt out of returning to the console');
  assert.equal(listeners.close, undefined, 'programmatic closing must preserve console preference');
  listeners.click({ target: { closest: () => ({}) } });
  listeners.cancel();
  assert.deepEqual(remembered, [current, current]);
});

test('Transporter arrival preview uses only the source ship’s analyzed layout', () => {
  const code = fs.readFileSync(require.resolve('../transporter-console.js'), 'utf8');
  const first = code.indexOf(' function arrivalLayout(');
  const last = code.indexOf(' window.SATransporterConsole=', first);
  const sensors = require('../ship-sensors');
  const fixture = { window: { SAShipSensors: sensors } };
  vm.runInNewContext(code.slice(first, last), fixture);
  const ship = { id: 'observer', ship: {}, sensorState: { analyses: {} } };
  assert.equal(fixture.arrivalLayout(ship, 'enemy'), null, 'an unscanned target has no inspectable interior');
  const layout = { gridColumns: 3, gridCells: [0, 1, 2], sicInventory: [], screenedRooms: [{ name: 'Screened room', cells: [2] }] };
  sensors.knowledge(ship).analyses.enemy = { at: '2026-10-03T00:00:00Z', layout };
  assert.equal(fixture.arrivalLayout(ship, 'enemy'), layout, 'screening and last-known geometry must survive unchanged');
  assert.equal(fixture.arrivalLayout(ship, 'another-enemy'), null, 'one analyzed target must not reveal another ship');
});

test('console switching still completes when the cosmetic slide animation is cancelled', async () => {
  const code = fs.readFileSync(require.resolve('../ship-navigation-ui.js'), 'utf8');
  const first = code.indexOf('  function mountSelector(');
  const last = code.indexOf('  async function toggleHold(', first);
  let closed = 0;
  const operator = { id: 'nova' }, view = { dataset: {}, isConnected: true, open: true,
    addEventListener() {}, querySelectorAll: () => [], append() {},
    animate: () => ({ finished: Promise.reject(Error('Animation interrupted')) }),
  };
  const select = { value: '', innerHTML: '', selectedIndex: 1, isConnected: true, setAttribute() {}, closest: () => view };
  const container = { closest: () => view, prepend() {}, ownerDocument: { createElement: tag => tag === 'select' ? select : { setAttribute() {} } } };
  const fixture = { window: { SACombatBridge: { state: () => ({ units: [operator] }) },
    SAStationAccess: { consoles: () => ['first', 'second'].map(id => ({ item: { id }, definition: { name: id } })) },
    SAConsoleCommon: { mount() {} } }, esc: String, slidePending: 0, selectedConsoles: new Map(),
    sessionStorage: { setItem() {} }, seatKey: unit => unit.id, matchMedia: () => ({ matches: false }),
    setInterval: () => 1, clearInterval() {}, setTimeout: fn => fn(), open() {},
  };
  vm.runInNewContext(code.slice(first, last), fixture);
  fixture.mountSelector(container, operator, 'first', () => { closed++; view.open = false; });
  select.value = 'second';
  await select.onchange({});
  assert.equal(closed, 1, 'a cancelled animation must not leave a disabled console on screen');
  assert.equal(fixture.selectedConsoles.get(operator.id), 'second');
});
