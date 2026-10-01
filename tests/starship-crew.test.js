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

test('link and save reject negative design EN without altering the saved ship',async()=>{
  const api=new CampaignApi({store:memoryStore(),storageMode:'memory'});
  const made=await request(api,'POST','/api/campaign/create',{name:'EN validation',gmCode:'en-test'});
  const {token,campaign:{code}}=made.payload;
  const starship={...ship('power-test','Power Test'),sicInventory:[{id:'engine',type:'en-engine-1'},{id:'shield',type:'shield-1'}],placements:[{sicId:'engine',cell:189},{sicId:'shield',cell:190}]};
  const invalid=structuredClone(starship);invalid.sicInventory.push({id:'life',type:'life-support'});invalid.placements.push({sicId:'life',cell:209});
  const rejected=await request(api,'POST','/api/campaign/starship/link',{code,token,starship:invalid});
  assert.equal(rejected.status,400);assert.match(rejected.payload.error,/Not enough EN/);
  assert.equal((await request(api,'POST','/api/campaign/starship/link',{code,token,starship})).status,201,'Exactly zero spare EN is valid');
  const outside=structuredClone(starship);outside.placements[0].cell=999;
  assert.equal((await request(api,'POST','/api/campaign/starship/save',{code,token,starship:outside})).status,400,'An engine removed by normalization cannot supply EN');
  const saved=await request(api,'POST','/api/campaign/starship/save',{code,token,starship:invalid});
  assert.equal(saved.status,400);assert.match(saved.payload.error,/Not enough EN/);
  assert.equal((await api.campaign(code)).starships[0].ship.sicInventory.length,2);
  invalid.sicInventory.find(i=>i.id==='engine').type='en-engine-2';invalid.gridCells.push(188);
  assert.equal((await request(api,'POST','/api/campaign/starship/save',{code,token,starship:invalid})).status,200);
});

test('restoring Explore updates its active campaign and stays out of normal campaign storage',async()=>{
  const store=memoryStore();let durableSaves=0;const save=store.save;
  store.save=async c=>{durableSaves++;return save(c);};
  const api=new CampaignApi({store,storageMode:'memory'});
  const made=await request(api,'POST','/api/campaign/showcase/start');
  const {code,gmToken:token}=made.payload;
  const before=await api.campaign(code);
  const backup=await request(api,'GET',`/api/campaign/backup?code=${code}&token=${token}`);
  backup.payload.campaign.starships[0].ship.title='Restored Explorer';
  backup.payload.campaign.starships[0].title='Restored Explorer';
  assert.equal((await request(api,'POST','/api/campaign/restore',{code,token,backup:backup.payload})).status,200);
  const after=await api.campaign(code);
  assert.notEqual(after,before);assert.equal(after.starships[0].title,'Restored Explorer');
  assert.equal(after.showcase,true);assert.equal(durableSaves,0);
  assert.equal(await store.get(code),null);
});

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
test("expanded split mounts preserve crew, NPCs, stations and doors in campaign saves", async()=>{
  const maps=require('../ship-map-core'),api=new CampaignApi({store:memoryStore(),storageMode:'memory'});
  const made=await request(api,'POST','/api/campaign/create',{name:'Flexible Campaign',gmCode:'flex-gm'}),{token,campaign:{code}}=made.payload;
  const campaign=await api.campaign(code);campaign.characters=[character('aster','Aster Reed')];
  campaign.npcRoster=[{id:'flex-npc',characterName:'Engineer',team:'npc',location:{starshipId:'flex',square:188,mesh:4}}];await api.save(campaign);
  const original={id:'flex',title:'Flexible Ship',confirmedOnce:true,gridCells:[168,169,188,189],sicInventory:[{id:'gun',type:'beam-laser-3',rotation:90,exteriorRotation:90},{id:'en',type:'en-engine-1'}],placements:[{sicId:'gun',cell:168,exteriorCell:148},{sicId:'en',cell:188}],doorStates:{'168:188':'closed'}};
  assert.equal((await request(api,'POST','/api/campaign/starship/link',{code,token,starship:original})).status,201);
  await request(api,'POST','/api/campaign/starship/crew',{code,token,starshipId:'flex',crewCharacterIds:['aster']});
  const layout=maps.buildLayout(original),seat=[...layout.footprint].flatMap(([square,c])=>c.stations.filter(s=>s.x===c.column&&s.y===c.row).map(s=>({square,...s})))[0];
  const playerToken=api.newSession(code,'character','aster');
  assert.equal((await request(api,'POST','/api/campaign/starship/move-character',{code,token:playerToken,starshipId:'flex',characterId:'aster',square:seat.square,mesh:seat.mesh,stationed:true,stationSlot:0})).status,200);
  const expanded=maps.resizeZone(original,24,24,2,2);
  const saved=await request(api,'POST','/api/campaign/starship/save',{code,token:playerToken,characterId:'aster',starship:expanded});
  assert.equal(saved.status,200);assert.equal(saved.payload.starship.ship.placements[0].exteriorCell,226);
  assert.equal(saved.payload.starship.ship.sicInventory[0].exteriorRotation,90);
  assert.equal(saved.payload.starship.characterLocations.aster.square,maps.remapSquare(seat.square,original,expanded));
  assert.equal(saved.payload.starship.characterLocations.aster.stationed,true);
  assert.equal((await api.campaign(code)).npcRoster[0].location.square,274);
  assert.equal((await request(api,'POST','/api/campaign/starship/door',{code,token:playerToken,starshipId:'flex',characterId:'aster',doorKey:'250:274'})).status,200);
  const invalid=structuredClone(expanded);invalid.placements[0].exteriorCell=202;
  assert.equal((await request(api,'POST','/api/campaign/starship/save',{code,token:playerToken,characterId:'aster',starship:invalid})).status,400,'Detached mount rejected by server');
});
