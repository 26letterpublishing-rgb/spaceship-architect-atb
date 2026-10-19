const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function screen(role = 'gm') {
  let shown;
  const window = { SAPlanetSurfaces: { prompt() {}, render(c, args) { shown = args; return true; } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../campaign-navigation-ui.js'), 'utf8'), {
    window, document: { querySelector() { return null; } }, performance: { now: () => 0 }, cancelAnimationFrame() {}
  });
  const api = window.SACampaignNavigationUI;
  const star = { id: 'star', system: [{ id: 'harbor', kind: 'planet' }, { id: 'other', kind: 'planet' }] };
  const map = { id: 'map', stars: [star] };
  const c = {
    state: { code: 'TEST', role, ownCharacterId: role === 'gm' ? undefined : 'nova' },
    ships: [{ id: 'enemy', controlType: 'gm' }, { id: 'protos', controlType: 'pc', crewCharacterIds: ['nova'] }],
    data: { maps: [map], navigation: { mode: 'galaxy' }, party: { mapId: 'map', starId: 'star', planetId: 'harbor', regionId: '198', shipId: 'protos' }, localPositions: {}, localJourneys: {} },
    host: { classList: { remove() {} } },
    draw() { return api.render(c); }
  };
  return { c, api, map, star, shown: () => shown };
}

test('GM initially opens the shared party planet and region with the PC ship', () => {
  const f = screen();
  f.c.draw();
  assert.equal(f.shown().planet.id, 'harbor');
  assert.equal(f.shown().view.regionId, '198');
  assert.equal(f.shown().ship.id, 'protos');
});

test('GM can inspect elsewhere until Campaign is opened again, then uses the latest player location', () => {
  const f = screen();
  f.c.draw();
  f.api.openPlanet(f.c, f.map, f.star, f.star.system[1]);
  f.c.draw();
  assert.equal(f.shown().planet.id, 'other');
  f.c.data.party.regionId = '204';
  f.api.showPlayerView();
  assert.equal(f.shown().planet.id, 'harbor');
  assert.equal(f.shown().view.regionId, '204');
  assert.equal(f.c.state.role, 'gm');
});

test('without a surface party, Campaign defaults to the configured player map instead of a stale GM planet', () => {
  const f = screen();
  f.c.draw();
  delete f.c.data.party;
  f.api.showPlayerView();
  assert.equal(f.c.draw(), false); // Galaxy overview owns this view.
  f.c.data.navigation = { mode: 'surface', mapId: 'map', starId: 'star', planetId: 'other' };
  f.api.showPlayerView();
  assert.equal(f.shown().planet.id, 'other');
  assert.equal(f.shown().ship.id, 'protos');
});

test('PC and GM defaults resolve the same party location even when navigation metadata is older', () => {
  const gm = screen(), pc = screen('player');
  for (const f of [gm, pc]) {
    f.c.data.navigation = { mode: 'surface', mapId: 'old', starId: 'old', planetId: 'other' };
    f.c.draw();
    assert.equal(f.shown().planet.id, 'harbor');
    assert.equal(f.shown().view.regionId, '198');
  }
});

function named(f) {
  f.map.name = 'Frontier Sector'; f.star.name = 'Haven';
  f.star.system[0].name = 'Harbor';
  f.star.surfaces = { harbor: { regions: { '198': { name: 'Harbor Landing District' } } } };
  f.c.map = f.map;
}

test('GM and PC hierarchy retain four named slots with separate active and party indicators', () => {
  for (const role of ['gm', 'player']) {
    const f = screen(role); named(f); f.c.draw();
    const entries = f.api.navigationEntries(f.c, 'surface');
    assert.deepEqual(Array.from(entries, e => e.level), ['galaxy', 'system', 'surface', 'region']);
    assert.deepEqual(Array.from(entries, e => e.name), ['Frontier Sector', 'Haven', 'Harbor', 'Harbor Landing District']);
    assert.equal(entries.find(e => e.active).level, 'surface');
    assert.equal(entries.find(e => e.party).level, 'region');
    assert.ok(entries.every(e => !e.disabled));
  }
});

test('empty planet and region slots stay blank and disabled; orbit uses the planet slot', () => {
  const f = screen('player'); named(f); delete f.c.data.party;
  f.c.data.navigation = { mode: 'galaxy', mapId: 'map', starId: 'star' }; f.c.draw();
  let entries = f.api.navigationEntries(f.c, 'galaxy');
  assert.equal(entries.length, 4); assert.ok(entries.slice(2).every(e => !e.name && e.disabled));
  f.c.data.navigation = { mode: 'orbit', mapId: 'map', starId: 'star', planetId: 'harbor' };
  // Hierarchy uses the configured location before the orbit renderer is needed.
  entries = f.api.navigationEntries(f.c, 'orbit');
  assert.equal(entries[2].name, 'Harbor'); assert.equal(entries[2].active, true);
  assert.equal(entries[2].party, true); assert.equal(entries[3].disabled, true);
});

test('PC browses without movement or redraw snapback, then follows an approved travel event', () => {
  const f = screen('player'); named(f); f.c.draw();
  const original = JSON.stringify(f.c.data.party);
  f.shown().set({ mode: 'galaxy', mapId: 'map' });
  assert.equal(f.c.draw(), false); assert.equal(JSON.stringify(f.c.data.party), original);
  f.c.data.viewEvent = { id: 'approved-travel' }; f.c.draw();
  assert.equal(f.shown().view.mode, 'surface'); assert.equal(f.shown().view.regionId, '198');
});

test('PC visibility restrictions block hierarchy browsing and reset an invalidated view', () => {
  const f = screen('player'); named(f); f.c.draw();
  f.c.data.navigation.allowed = { galaxy: false, system: false };
  f.shown().set({ mode: 'galaxy' });
  assert.equal(f.shown().view.mode, 'surface');
  const entries = f.api.navigationEntries(f.c, 'region');
  assert.ok(entries[0].disabled && entries[1].disabled); assert.equal(entries[3].disabled, false);
  const gm = screen(); named(gm); gm.c.data.navigation.allowed = { galaxy: false }; gm.c.draw();
  assert.equal(gm.api.navigationEntries(gm.c, 'region')[0].disabled, false);
});

test('the location pin uses actual ship orbit/system state rather than a stale configured planet view', () => {
  const f = screen('player'); named(f); delete f.c.data.party;
  f.c.data.navigation = { mode: 'galaxy', mapId: 'map', starId: 'star', planetId: 'harbor' }; f.c.draw();
  f.c.data.localPositions.protos = { mapId: 'map', starId: 'star', phase: 'orbit', planetId: 'harbor' };
  let entries = f.api.navigationEntries(f.c, 'galaxy');
  assert.equal(entries[2].party, true); assert.equal(entries[2].target.mode, 'orbit');
  f.c.data.localPositions.protos = { mapId: 'map', starId: 'star', phase: 'system' };
  entries = f.api.navigationEntries(f.c, 'galaxy');
  assert.equal(entries[1].party, true); assert.ok(entries.slice(2).every(e => !e.name && e.disabled));
});
