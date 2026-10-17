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
