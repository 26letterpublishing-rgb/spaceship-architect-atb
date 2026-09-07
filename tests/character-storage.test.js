const test = require("node:test");
const assert = require("node:assert/strict");
const { selectStorage, repair } = require("../character-storage");
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), snapshot: () => Object.fromEntries(data) };
}
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
