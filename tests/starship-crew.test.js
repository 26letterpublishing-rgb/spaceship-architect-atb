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
