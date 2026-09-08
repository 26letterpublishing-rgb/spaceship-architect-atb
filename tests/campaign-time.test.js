const test = require("node:test");
const assert = require("node:assert/strict");
const { durationMinutes, dailyHealing, passCharacterTime } = require("../campaign-time");
const { CampaignApi } = require("../campaign-api");

const character = () => ({ identity: { characterName: "Time Tester" }, attributes: { health: [1, 0, -1, -1] },
  skills: { "Athletics/Endurance": { tenths: 12 } }, computed: { maximumHp: 30 }, health: { current: 0 },
  items: [{ catalogId: "jet-pack", name: "Jet-Pack", charges: 0, chargesMax: 5 }, { catalogId: "mobile-zero-point-energy", chargeState: "Empty" }] });

test("time units, health boxes, fractional skills, and partial days are preserved", () => {
  assert.equal(durationMinutes(2, "weeks"), 20160);
  assert.equal(durationMinutes(.5, "days"), 720);
  for (const [amount, unit] of [[-1, "days"], [0, "hours"], [Infinity, "days"], [1, "years"], [.001, "minutes"]]) assert.throws(() => durationMinutes(amount, unit));
  const pc = character();
  assert.equal(dailyHealing(pc), 4.2);
  assert.equal(passCharacterTime(pc, 720).healed, 0);
  assert.equal(pc.items[0].charges, 5);
  assert.equal(pc.items[1].chargeState, "Full");
  const saved = structuredClone(pc);
  assert.equal(passCharacterTime(saved, 720).healed, 4.2);
  assert.equal(saved.health.recoveryMinutes, 0);
  passCharacterTime(saved, durationMinutes(2, "weeks"));
  assert.equal(saved.health.current, 30);
  saved.computed.skills = { "Athletics/Endurance": 2.7 };
  assert.equal(dailyHealing(saved), 5.7);
});

test("Pass Time is GM-only, atomic, retry-safe, and persists across campaign reloads", async () => {
  let stored, fail = false, active = false;
  const store = { async create(value) { stored = structuredClone(value); return true; }, async save(value) { if (fail) throw Error("disk offline"); stored = structuredClone(value); }, async get() { return structuredClone(stored); } };
  const api = new CampaignApi({ store, canPassTime: () => !active });
  store.findByName = async () => [];
  async function post(path, body, target = api) {
    let result;
    await target.handle({ method: "POST" }, {}, new URL(`http://localhost/api/campaign/${path}`), async () => body, (_, status, payload) => { result = { status, payload }; });
    return result;
  }
  const created = await post("create", { name: "Time Regression", gmCode: "test-gm" });
  const { token, campaign: { code } } = created.payload;
  const campaign = await api.campaign(code);
  campaign.characters = [{ id: "pc", approved: true, character: character() }];
  await api.save(campaign);
  const body = { code, token, amount: 12, unit: "hours", requestId: "time-request-one" };
  assert.equal((await post("time/pass", { ...body, token: api.newSession(code, "character", "pc") })).status, 403);
  active = true;
  assert.equal((await post("time/pass", body)).status, 400);
  active = false; fail = true;
  assert.equal((await post("time/pass", body)).status, 400);
  assert.equal(campaign.elapsedMinutes, undefined);
  assert.equal(campaign.characters[0].character.items[0].charges, 0);
  fail = false;
  const results = await Promise.all([post("time/pass", body), post("time/pass", body)]);
  assert.ok(results.every(result => result.status === 200));
  assert.equal(campaign.elapsedMinutes, 720);
  assert.equal(campaign.characters[0].character.health.current, 0);
  assert.equal((await post("time/pass", { ...body, amount: 24 })).status, 400);
  const restarted = new CampaignApi({ store });
  const newToken = restarted.newSession(code, "gm");
  await post("time/pass", { ...body, token: newToken }, restarted);
  assert.equal(stored.elapsedMinutes, 720);
  await post("time/pass", { ...body, token: newToken, requestId: "time-request-two" }, restarted);
  assert.equal(stored.elapsedMinutes, 1440);
  assert.equal(stored.characters[0].character.health.current, 4.2);
});
