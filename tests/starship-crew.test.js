const test = require("node:test");
const assert = require("node:assert/strict");
const { CampaignApi } = require("../campaign-api");

function memoryStore() {
  const campaigns = new Map();
  return {
    async create(campaign) {
      if (campaigns.has(campaign.code)) return false;
      campaigns.set(campaign.code, structuredClone(campaign));
      return true;
    },
    async findByName(name) {
      return [...campaigns.values()].filter((campaign) => campaign.name === name).map(structuredClone);
    },
    async get(code) {
      return campaigns.has(code) ? structuredClone(campaigns.get(code)) : null;
    },
    async save(campaign) {
      campaigns.set(campaign.code, structuredClone(campaign));
    },
  };
}

async function request(api, method, path, body = {}) {
  let response;
  const handled = await api.handle(
    { method },
    {},
    new URL(`http://localhost${path}`),
    async () => body,
    (_res, status, payload) => { response = { status, payload }; },
  );
  assert.equal(handled, true);
  return response;
}

function character(id, name) {
  const now = new Date().toISOString();
  return {
    id,
    pcCode: `${id}-code`,
    approved: true,
    imported: false,
    createdAt: now,
    updatedAt: now,
    character: { id, identity: { characterName: name, playerName: `${name} Player` } },
  };
}

function ship(id, title) {
  return {
    id,
    title,
    affiliation: "Workflow Test",
    class: "Test Craft",
    confirmedOnce: true,
    gridCells: [189, 190, 209, 210],
    placements: [],
    sicInventory: [],
  };
}

test("player ship movement preserves corner mesh zero", async () => {
  const api = new CampaignApi({ store: memoryStore(), storageMode: "memory" });
  const created = await request(api, "POST", "/api/campaign/create", { name: "Corner Move", gmCode: "gm-corner" });
  const { token, campaign: { code } } = created.payload;
  const campaign = await api.campaign(code);
  campaign.characters = [character("aster", "Aster Reed")];
  await api.save(campaign);
  await request(api, "POST", "/api/campaign/starship/link", { code, token, starship: ship("corner", "Corner") });
  await request(api, "POST", "/api/campaign/starship/crew", { code, token, starshipId: "corner", crewCharacterIds: ["aster"] });
  const playerToken = api.newSession(code, "character", "aster");
  const moved = await request(api, "POST", "/api/campaign/starship/move-character", {
    code, token: playerToken, starshipId: "corner", characterId: "aster", square: 210, mesh: 0,
  });
  assert.equal(moved.status, 200);
  assert.equal((await api.campaign(code)).starships[0].characterLocations.aster.mesh, 0);
});

test("GM and standalone ship links support persistent PC crew assignments", async () => {
  const api = new CampaignApi({ store: memoryStore(), storageMode: "memory" });
  const created = await request(api, "POST", "/api/campaign/create", {
    name: "Fresh Workflow",
    gmCode: "gm-test-code",
  });
  assert.equal(created.status, 201);

  const code = created.payload.campaign.code;
  const gmToken = created.payload.token;
  const campaign = await api.campaign(code);
  campaign.characters = [character("aster", "Aster Reed"), character("bram", "Bram Keel")];
  await api.save(campaign);

  const gmShip = await request(api, "POST", "/api/campaign/starship/link", {
    code,
    token: gmToken,
    controlType: "pc",
    starship: ship("gm-cutter", "GM Test Cutter"),
  });
  const standaloneShip = await request(api, "POST", "/api/campaign/starship/link", {
    code,
    controlType: "pc",
    starship: ship("menu-courier", "Main Menu Courier"),
  });
  assert.equal(gmShip.status, 201);
  assert.equal(standaloneShip.status, 201);

  const assignAster = await request(api, "POST", "/api/campaign/starship/crew", {
    code,
    token: gmToken,
    starshipId: "gm-cutter",
    crewCharacterIds: ["aster"],
  });
  const assignBram = await request(api, "POST", "/api/campaign/starship/crew", {
    code,
    token: gmToken,
    starshipId: "menu-courier",
    crewCharacterIds: ["bram"],
  });
  assert.deepEqual(assignAster.payload.starship.crewCharacterIds, ["aster"]);
  assert.deepEqual(assignBram.payload.starship.crewCharacterIds, ["bram"]);

  const saved = await api.campaign(code);
  assert.deepEqual(saved.starships.map((record) => [record.title, record.crewCharacterIds]), [
    ["GM Test Cutter", ["aster"]],
    ["Main Menu Courier", ["bram"]],
  ]);

  const asterToken = api.newSession(code, "character", "aster");
  const rejected = await request(api, "POST", "/api/campaign/starship/crew", {
    code,
    token: asterToken,
    characterId: "aster",
    starshipId: "menu-courier",
    crewCharacterIds: ["aster", "bram"],
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.payload.error, "Once a ship has crew, only assigned crewmembers or the GM may change its roster.");
});

test("fresh GM and two player sessions join, link ships, and survive a storage restart", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const oldDir = process.env.SA_LOCAL_DATA_DIR;
  const oldUrl = process.env.DATABASE_URL;
  process.env.SA_LOCAL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sa-fresh-campaign-"));
  process.env.DATABASE_URL = "";
  const { CampaignStore } = require("../campaign-store");
  const store = new CampaignStore();
  await store.init();
  const api = new CampaignApi({ store, storageMode: "local-file" });
  try {
    const created = await request(api, "POST", "/api/campaign/create", { name: "Persistent Crew Test", gmCode: "regression-gm" });
    assert.equal(created.status, 201);
    const code = created.payload.campaign.code;
    const token = created.payload.token;
    const playerTokens = [];
    for (const [id, name] of [["fresh-a", "Fresh Aster"], ["fresh-b", "Fresh Bram"]]) {
      const source = { ...character(id, name).character, phase: "finalized", access: { pcCode: `${id}-code` } };
      const joined = await request(api, "POST", "/api/campaign/join/request", { code, character: source });
      assert.equal(joined.status, 201);
      const approved = await request(api, "POST", "/api/campaign/join/respond", { code, token, requestId: joined.payload.requestId, decision: "approve" });
      assert.equal(approved.status, 200);
      const login = await request(api, "POST", "/api/campaign/join/status", { code, characterId: id, pcCode: `${id}-code` });
      assert.equal(login.payload.status, "approved");
      playerTokens.push(login.payload.token);
    }
    assert.notEqual(playerTokens[0], playerTokens[1]);
    for (const [id, owner, authenticated] of [["gm-built", "fresh-a", true], ["menu-built", "fresh-b", false]]) {
      const linked = await request(api, "POST", "/api/campaign/starship/link", {
        code, ...(authenticated ? { token } : {}), controlType: "pc", starship: ship(id, id),
      });
      assert.equal(linked.status, 201);
      const assigned = await request(api, "POST", "/api/campaign/starship/crew", { code, token, starshipId: id, crewCharacterIds: [owner] });
      assert.equal(assigned.status, 200);
    }
    await store.close();
    const reopened = new CampaignStore();
    await reopened.init();
    const restored = await reopened.get(code);
    assert.deepEqual(restored.characters.map((entry) => entry.id), ["fresh-a", "fresh-b"]);
    assert.deepEqual(restored.starships.map((entry) => entry.crewCharacterIds), [["fresh-a"], ["fresh-b"]]);
    await reopened.close();
  } finally {
    await store.close();
    if (oldDir === undefined) delete process.env.SA_LOCAL_DATA_DIR; else process.env.SA_LOCAL_DATA_DIR = oldDir;
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
  }
});
