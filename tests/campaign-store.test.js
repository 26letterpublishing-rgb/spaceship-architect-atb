const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("legacy browser bootstrap preserves saved player data", () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "../data-reset.js"), "utf8");
  const storage = new Map([["sa-data-epoch", "older-version"], ["sa2e-character-library-v1", "saved-character"], ["sa-starships", "saved-ship"]]);
  const before = [...storage];
  vm.runInNewContext(source, { localStorage: {
    get length() { return storage.size; },
    key: (index) => [...storage.keys()][index],
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  } });
  assert.deepEqual([...storage], before);
});

test("local startup preserves campaigns with absent or stale epoch metadata", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-store-regression-"));
  const file = path.join(dir, "campaigns.json");
  const contents = JSON.stringify([{ code: "TEST", name: "Preserved campaign" }]);
  fs.writeFileSync(file, contents);
  const run = () => spawnSync(process.execPath, ["-e", `
    const { CampaignStore } = require('./campaign-store');
    (async () => { const store = new CampaignStore(); await store.init();
      if ((await store.get('TEST'))?.name !== 'Preserved campaign') throw Error('lost campaign');
      await store.close(); })().catch(() => process.exit(1));
  `], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, SA_LOCAL_DATA_DIR: dir, DATABASE_URL: "" } });
  assert.equal(run().status, 0);
  fs.writeFileSync(path.join(dir, "campaign-epoch.txt"), "old-version");
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), contents);
});

test("unreadable campaign data fails startup without overwriting the file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-store-corrupt-"));
  const file = path.join(dir, "campaigns.json");
  fs.writeFileSync(file, "{broken json");
  const result = spawnSync(process.execPath, ["-e", `
    const { CampaignStore } = require('./campaign-store');
    new CampaignStore().init().then(() => process.exit(1), () => process.exit(0));
  `], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, SA_LOCAL_DATA_DIR: dir, DATABASE_URL: "" } });
  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), "{broken json");
});

test("failed local writes preserve the old campaign and do not poison subsequent saves", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-store-failure-"));
  const result = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const { CampaignStore } = require('./campaign-store');
    (async () => {
      const store = new CampaignStore(); await store.init();
      await store.save({code:'TEST',name:'original'});
      const rename = fs.promises.rename;
      fs.promises.rename = async () => { throw Error('disk unavailable'); };
      await assert.rejects(store.save({code:'TEST',name:'failed'}));
      assert.equal((await store.get('TEST')).name,'original');
      fs.promises.rename = rename;
      await store.save({code:'TEST',name:'recovered'});
      assert.equal((await store.get('TEST')).name,'recovered');
      await store.close();
    })().catch(error => { console.error(error); process.exit(1); });
  `], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, SA_LOCAL_DATA_DIR: dir, DATABASE_URL: "" } });
  assert.equal(result.status, 0, result.stderr.toString());
});
