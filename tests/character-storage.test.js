const test = require("node:test");
const assert = require("node:assert/strict");
const { selectStorage, repair, readyProvider } = require("../character-storage");
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), snapshot: () => Object.fromEntries(data) };
}

function providerView(search = '?shipRoll=1') {
  const own = { ready: Promise.resolve(), local: storage() };
  const parent = { location: { origin: 'http://localhost' }, SABrowserStorage: { ready: Promise.resolve(), local: storage({ sound: 'off' }) } };
  return { location: { search, origin: 'http://localhost' }, SABrowserStorage: own, parent };
}
test('embedded ship rolls reuse hydrated same-origin parent while own archive load is blocked', async () => {
  const view = providerView();
  view.SABrowserStorage.ready = new Promise(() => {});
  const selected = await readyProvider(view);
  assert.equal(selected, view.parent.SABrowserStorage);
  assert.equal(selected.local.getItem('sound'), 'off');
});
test('selected parent initialization is still awaited', async () => {
  const view = providerView(); let release, finished = false;
  view.parent.SABrowserStorage.ready = new Promise(resolve => { release = resolve; });
  const pending = readyProvider(view).then(value => { finished = true; return value; });
  await Promise.resolve(); assert.equal(finished, false);
  release(); assert.equal(await pending, view.parent.SABrowserStorage);
});
test('ordinary character pages retain their own initialization gate', async () => {
  const view = providerView('?campaign=TEST'); let release, finished = false;
  view.SABrowserStorage.ready = new Promise(resolve => { release = resolve; });
  const pending = readyProvider(view).then(value => { finished = true; return value; });
  await Promise.resolve(); assert.equal(finished, false);
  release(); assert.equal(await pending, view.SABrowserStorage);
});
test('standalone, foreign, inaccessible and incomplete hosts fall back to own provider', async () => {
  for (const change of [
    view => { view.parent = view; },
    view => { view.parent.location.origin = 'https://other.example'; },
    view => { Object.defineProperty(view.parent, 'location', { get() { throw Error('SecurityError'); } }); },
    view => { delete view.parent.SABrowserStorage; },
    view => { view.parent.SABrowserStorage.ready = null; },
    view => { view.parent.SABrowserStorage.local = {}; },
  ]) {
    const view = providerView(); change(view);
    assert.equal(await readyProvider(view), view.SABrowserStorage);
  }
});
test('failed initialization is not silently bypassed', async () => {
  const view = providerView();
  view.parent.SABrowserStorage.ready = Promise.reject(Error('initialization failed'));
  await assert.rejects(readyProvider(view), /initialization failed/);
});
test("demo character writes and removals never change personal saves or campaign", () => {
  const personal = storage({ "sa2e-character-library-v1": '[{"id":"real"}]', "sa-character-campaign-code": "REAL" });
  const before = personal.snapshot();
  const session = storage();
  const demo = selectStorage(personal, session, "?campaign=DEMO&showcase=1");
  demo.setItem("sa2e-character-library-v1", '[{"id":"showcase-nova"}]');
  demo.setItem("sa-character-campaign-code", "DEMO");
  demo.removeItem("sa2e-active-character-v1");
  assert.deepEqual(personal.snapshot(), before);
  assert.equal(selectStorage(personal, session, "?campaign=NEXT&showcase=1").getItem("sa2e-character-library-v1"), null);
  assert.equal(selectStorage(personal, session, "").getItem("sa-character-campaign-code"), "REAL");
});
test("legacy demo contamination is repaired without deleting real characters or drafts", () => {
  const real = { id: "real", identity: { characterName: "Nova Vale" } };
  const demo = { id: "showcase-mira", campaignLink: { roomCode: "DEMO" } };
  const saved = storage({ "sa2e-character-library-v1": JSON.stringify([real, demo]), "sa2e-active-character-v1": demo.id, "sa-character-campaign-code": "DEMO", "sa2e-character-recovery-v1": "draft" });
  repair(saved);
  assert.deepEqual(JSON.parse(saved.getItem("sa2e-character-library-v1")), [real]);
  assert.equal(saved.getItem("sa-character-campaign-code"), null);
  assert.equal(saved.getItem("sa2e-character-recovery-v1"), "draft");
  const repaired = saved.snapshot();
  repair(saved);
  assert.deepEqual(saved.snapshot(), repaired);
  assert.ok(saved.getItem("sa-character-pre-demo-repair-v1"));
});
