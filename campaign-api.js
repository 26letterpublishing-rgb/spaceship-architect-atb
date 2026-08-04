const crypto = require("crypto");

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_SCRIPT_LENGTH = 250000;
const PLAYER_INBOX_LIMIT = 20;
const GM_INBOX_LIMIT = 50;

function uid(prefix = "id") {
  return `${prefix}-${crypto.randomBytes(9).toString("base64url")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function campaignCode() {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const actual = Buffer.from(record.hash, "hex");
  const candidate = crypto.scryptSync(String(password), record.salt, 64);
  return actual.length === candidate.length && crypto.timingSafeEqual(actual, candidate);
}

function boundedNumber(value, min, max) {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : 0));
}

function safeCharacterName(record) {
  return String(record?.character?.identity?.characterName || "Unnamed Character").trim().slice(0, 80) || "Unnamed Character";
}

function trimPrivateNotes(campaign) {
  const notes = Array.isArray(campaign.privateNotes) ? campaign.privateNotes : [];
  const keep = new Set(notes.slice(-GM_INBOX_LIMIT).map((note) => note.id));
  for (const record of campaign.characters || []) {
    notes.filter((note) => note.characterId === record.id).slice(-PLAYER_INBOX_LIMIT).forEach((note) => keep.add(note.id));
  }
  campaign.privateNotes = notes.filter((note) => keep.has(note.id));
}
function defaultCampaign({ code, name, gmCode }) {
  const now = new Date().toISOString();
  return {
    version: 2,
    code,
    name: String(name || "New Campaign").trim().slice(0, 80) || "New Campaign",
    gmCode: passwordRecord(gmCode),
    createdAt: now,
    updatedAt: now,
    script: "",
    characters: [],
    joinRequests: [],
    shipCredits: 0,
    bankerCharacterId: null,
    awardHistory: [],
    privateNotes: [],
    rollRequests: [],
    encounter: null,
  };
}

function normalizeCampaign(raw) {
  const campaign = raw && typeof raw === "object" ? raw : {};
  campaign.version = 2;
  campaign.code = String(campaign.code || "").trim().toUpperCase();
  campaign.name = String(campaign.name || "Campaign").trim().slice(0, 80) || "Campaign";
  campaign.gmCode = campaign.gmCode || campaign.password || null;
  delete campaign.password;
  campaign.script = String(campaign.script || "").slice(0, MAX_SCRIPT_LENGTH);
  campaign.characters = Array.isArray(campaign.characters) ? campaign.characters : [];
  campaign.characters = campaign.characters.map((record) => ({
    id: String(record?.id || record?.character?.id || uid("character")),
    pcCode: String(record?.pcCode ?? record?.pin ?? "").slice(0, 120),
    approved: true,
    imported: Boolean(record?.imported),
    createdAt: record?.createdAt || new Date().toISOString(),
    updatedAt: record?.updatedAt || new Date().toISOString(),
    character: record?.character && typeof record.character === "object" ? record.character : {},
  }));
  campaign.joinRequests = (Array.isArray(campaign.joinRequests) ? campaign.joinRequests : []).slice(-250).map((request) => ({
    id: String(request?.id || uid("join")),
    characterId: String(request?.characterId || request?.character?.id || uid("character")),
    pcCode: String(request?.pcCode || "").slice(0, 120),
    status: ["pending", "approved", "rejected"].includes(request?.status) ? request.status : "pending",
    requestedAt: request?.requestedAt || new Date().toISOString(),
    resolvedAt: request?.resolvedAt || null,
    message: String(request?.message || "").slice(0, 1000),
    character: request?.character && typeof request.character === "object" ? request.character : {},
  }));
  campaign.shipCredits = Math.round(boundedNumber(campaign.shipCredits, 0, 999999999999));
  campaign.bankerCharacterId = campaign.characters.some((record) => record.id === campaign.bankerCharacterId)
    ? campaign.bankerCharacterId
    : null;
  campaign.awardHistory = Array.isArray(campaign.awardHistory) ? campaign.awardHistory.slice(-20) : [];
  campaign.privateNotes = (Array.isArray(campaign.privateNotes) ? campaign.privateNotes : []).slice(-1000).map((note) => ({
    id: String(note?.id || uid("note")),
    characterId: String(note?.characterId || ""),
    characterName: String(note?.characterName || "").slice(0, 80),
    direction: note?.direction === "to-gm" ? "to-gm" : "to-character",
    kind: ["system", "award", "roll-request"].includes(note?.kind) ? note.kind : "message",
    rollRequestId: String(note?.rollRequestId || ""),
    awardId: String(note?.awardId || ""),
    message: String(note?.message || "").slice(0, 4000),
    createdAt: note?.createdAt || new Date().toISOString(),
    readAt: note?.readAt || null,
  }));
  campaign.rollRequests = Array.isArray(campaign.rollRequests) ? campaign.rollRequests.slice(-250) : [];
  trimPrivateNotes(campaign);
  return campaign;
}

function campaignBackup(campaign) {
  return {
    format: "spaceship-architect-campaign",
    version: 1,
    exportedAt: new Date().toISOString(),
    campaign: clone({
      version: campaign.version,
      code: campaign.code,
      name: campaign.name,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      script: campaign.script,
      characters: campaign.characters,
      joinRequests: campaign.joinRequests,
      shipCredits: campaign.shipCredits,
      bankerCharacterId: campaign.bankerCharacterId,
      awardHistory: campaign.awardHistory,
      privateNotes: campaign.privateNotes,
      rollRequests: campaign.rollRequests,
      encounter: campaign.encounter,
    }),
  };
}

function campaignFromBackup(backup, { code = "", gmCode = null, currentGmCode = null } = {}) {
  if (backup?.format !== "spaceship-architect-campaign" || !backup?.campaign || !Array.isArray(backup.campaign.characters)) return null;
  const restored = normalizeCampaign(clone(backup.campaign));
  restored.code = String(code || restored.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(restored.code)) return null;
  restored.gmCode = currentGmCode || passwordRecord(gmCode);
  restored.updatedAt = new Date().toISOString();
  return restored;
}

function publicCharacter(record, { gm = false, own = false, notes = [] } = {}) {
  return {
    id: record.id,
    pcCode: gm || own ? record.pcCode : undefined,
    approved: record.approved,
    imported: record.imported,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    character: clone(record.character),
    privateNotes: gm || own ? clone(notes) : undefined,
  };
}

function writeEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

class CampaignApi {
  constructor({ store, storageMode, connectedCharacterIds = () => [], restoreEncounter = () => {} }) {
    this.store = store;
    this.storageMode = storageMode;
    this.connectedCharacterIds = connectedCharacterIds;
    this.restoreEncounter = restoreEncounter;
    this.sessions = new Map();
    this.clients = new Map();
    this.campaignCache = new Map();
    this.campaignLoads = new Map();
    this.saveQueues = new Map();
  }

  newSession(code, role, characterId = null) {
    const token = crypto.randomBytes(24).toString("base64url");
    this.sessions.set(token, {
      code,
      role,
      characterId,
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
    });
    return token;
  }

  session(token, code) {
    const record = this.sessions.get(String(token || ""));
    if (!record || record.code !== code || record.expiresAt < Date.now()) {
      if (record) this.sessions.delete(String(token || ""));
      return null;
    }
    record.expiresAt = Date.now() + SESSION_LIFETIME_MS;
    return record;
  }

  gmSession(token, code) {
    const session = this.session(token, code);
    return session?.role === "gm" ? session : null;
  }

  characterSession(token, code, characterId) {
    const session = this.session(token, code);
    if (session?.role === "gm") return session;
    return session?.role === "character" && session.characterId === characterId ? session : null;
  }

  invalidateCharacterSessions(code, characterId) {
    for (const [token, session] of this.sessions) {
      if (session.code === code && session.role === "character" && session.characterId === characterId) {
        this.sessions.delete(token);
      }
    }
  }

  async campaignsNamed(name) {
    const records = await this.store.findByName(name);
    return records.map(normalizeCampaign);
  }

  async campaign(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    if (this.campaignCache.has(normalizedCode)) return this.campaignCache.get(normalizedCode);
    if (!this.campaignLoads.has(normalizedCode)) {
      this.campaignLoads.set(normalizedCode, this.store.get(normalizedCode).then((stored) => {
        const campaign = stored ? normalizeCampaign(stored) : null;
        if (campaign) this.campaignCache.set(normalizedCode, campaign);
        return campaign;
      }).finally(() => this.campaignLoads.delete(normalizedCode)));
    }
    return this.campaignLoads.get(normalizedCode);
  }

  async save(campaign, { broadcast = true } = {}) {
    trimPrivateNotes(campaign);
    this.campaignCache.set(campaign.code, campaign);
    const previous = this.saveQueues.get(campaign.code) || Promise.resolve();
    const queued = previous.catch(() => {}).then(async () => {
      campaign.updatedAt = new Date().toISOString();
      await this.store.save(campaign);
      if (broadcast) await this.broadcast(campaign.code, campaign);
    });
    this.saveQueues.set(campaign.code, queued);
    try {
      await queued;
    } finally {
      if (this.saveQueues.get(campaign.code) === queued) this.saveQueues.delete(campaign.code);
    }
  }

  state(campaign, token = "") {
    const session = this.session(token, campaign.code);
    const gm = session?.role === "gm";
    const ownId = session?.role === "character" ? session.characterId : null;
    const connectedIds = new Set(this.connectedCharacterIds(campaign.code));
    const notesByCharacter = new Map();
    for (const note of campaign.privateNotes) {
      if (!notesByCharacter.has(note.characterId)) notesByCharacter.set(note.characterId, []);
      notesByCharacter.get(note.characterId).push(note);
    }
    const requests = gm
      ? campaign.rollRequests
      : ownId
        ? campaign.rollRequests.filter((request) => request.targetIds.includes(ownId))
        : [];
    return {
      code: campaign.code,
      roomCode: campaign.code,
      name: campaign.name,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      storageMode: this.storageMode,
      role: gm ? "gm" : ownId ? "character" : "viewer",
      ownCharacterId: ownId,
      script: gm ? campaign.script : undefined,
      shipCredits: campaign.shipCredits,
      bankerCharacterId: campaign.bankerCharacterId,
      lastAward: gm ? campaign.awardHistory.at(-1) || null : undefined,
      joinRequests: gm ? clone(campaign.joinRequests.filter((request) => request.status === "pending")) : undefined,
      inbox: gm ? clone(campaign.privateNotes.slice(-GM_INBOX_LIMIT)) : undefined,
      characters: campaign.characters.map((record) => ({
        ...publicCharacter(record, {
          gm,
          own: record.id === ownId,
          notes: (notesByCharacter.get(record.id) || []).slice(-PLAYER_INBOX_LIMIT),
        }),
        connected: connectedIds.has(record.id),
      })),
      rollRequests: clone(requests.slice(-50)),
    };
  }

  async broadcast(code, campaignValue = null) {
    const campaign = campaignValue || await this.campaign(code);
    if (!campaign) return;
    for (const client of this.clients.get(code) || []) {
      writeEvent(client.response, "campaign", this.state(campaign, client.token));
    }
  }

  async saveEncounter(code, encounter) {
    const campaign = await this.campaign(code);
    if (!campaign) return false;
    campaign.encounter = encounter;
    await this.save(campaign, { broadcast: false });
    return true;
  }

  async getEncounter(code) {
    return (await this.campaign(code))?.encounter || null;
  }

  async verifyCharacterAccess(code, characterId, token) {
    return Boolean(this.characterSession(token, code, characterId));
  }

  async verifyGmAccess(code, token) {
    return Boolean(this.gmSession(token, code));
  }

  async handle(req, res, url, readBody, sendJson) {
    const path = url.pathname;
    if (!path.startsWith("/api/campaign/") && path !== "/campaign-events") return false;

    if (path === "/campaign-events" && req.method === "GET") {
      const code = String(url.searchParams.get("code") || "").trim().toUpperCase();
      const campaign = await this.campaign(code);
      if (!campaign) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Campaign not found");
        return true;
      }
      const token = String(url.searchParams.get("token") || "");
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const client = { response: res, token };
      const set = this.clients.get(code) || new Set();
      this.clients.set(code, set);
      set.add(client);
      writeEvent(res, "campaign", this.state(campaign, token));
      const heartbeat = setInterval(() => res.write(`: keep-alive ${Date.now()}\n\n`), 25000);
      req.on("close", () => {
        clearInterval(heartbeat);
        set.delete(client);
      });
      return true;
    }

    let body = {};
    if (req.method !== "GET") {
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Bad JSON" });
        return true;
      }
    }
    const code = String(body.code || url.searchParams.get("code") || "").trim().toUpperCase();
    const token = String(body.token || url.searchParams.get("token") || "");

    if (path === "/api/campaign/create" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const gmCode = String(body.gmCode ?? body.password ?? "");
      if (!name || !gmCode) {
        sendJson(res, 400, { error: "Campaign Name and GM Code are required." });
        return true;
      }
      let campaign;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        campaign = defaultCampaign({ code: campaignCode(), name, gmCode });
        if (await this.store.create(campaign)) break;
        campaign = null;
      }
      if (!campaign) {
        sendJson(res, 503, { error: "A unique campaign code could not be created." });
        return true;
      }
      this.campaignCache.set(campaign.code, campaign);
      const gmToken = this.newSession(campaign.code, "gm");
      sendJson(res, 201, { token: gmToken, campaign: this.state(campaign, gmToken) });
      return true;
    }

    if (path === "/api/campaign/restore-create" && req.method === "POST") {
      const gmCode = String(body.gmCode ?? body.password ?? "");
      const restored = gmCode ? campaignFromBackup(body.backup, { gmCode }) : null;
      if (!restored) {
        sendJson(res, 400, { error: "A valid campaign backup and a new GM Code are required." });
        return true;
      }
      if (!await this.store.create(restored)) {
        sendJson(res, 409, { error: `Campaign ${restored.code} already exists. Open it and use Restore This Campaign instead.` });
        return true;
      }
      this.campaignCache.set(restored.code, restored);
      this.restoreEncounter(restored.code, restored.encounter);
      const gmToken = this.newSession(restored.code, "gm");
      sendJson(res, 201, { token: gmToken, campaign: this.state(restored, gmToken) });
      return true;
    }

    if (path === "/api/campaign/open" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const gmCode = String(body.gmCode ?? body.password ?? "");
      const candidates = name ? await this.campaignsNamed(name) : [];
      const campaign = candidates.find((entry) => passwordMatches(gmCode, entry.gmCode));
      if (!campaign) {
        sendJson(res, 403, { error: "Campaign Name or GM Code is incorrect." });
        return true;
      }
      this.campaignCache.set(campaign.code, campaign);
      const gmToken = this.newSession(campaign.code, "gm");
      sendJson(res, 200, { token: gmToken, campaign: this.state(campaign, gmToken) });
      return true;
    }

    if (path === "/api/campaign/player/open" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const pcCode = String(body.pcCode || "");
      const candidates = name ? await this.campaignsNamed(name) : [];
      let match = null;
      let campaign = null;
      for (const candidate of candidates) {
        const record = candidate.characters.find((entry) => entry.pcCode === pcCode);
        if (record) {
          match = record;
          campaign = candidate;
          break;
        }
      }
      if (!campaign || !match) {
        sendJson(res, 403, { error: "Campaign Name or PC Code is incorrect." });
        return true;
      }
      this.campaignCache.set(campaign.code, campaign);
      const characterToken = this.newSession(campaign.code, "character", match.id);
      sendJson(res, 200, {
        token: characterToken,
        characterId: match.id,
        campaign: this.state(campaign, characterToken),
      });
      return true;
    }

    const campaign = await this.campaign(code);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found." });
      return true;
    }

    if (path === "/api/campaign/state" && req.method === "GET") {
      sendJson(res, 200, this.state(campaign, token));
      return true;
    }

    if (path === "/api/campaign/join/request" && req.method === "POST") {
      const source = body.character && typeof body.character === "object" ? clone(body.character) : null;
      const pcCode = String(body.pcCode || source?.access?.pcCode || "");
      if (!source?.id || source.phase !== "finalized" || !pcCode) {
        sendJson(res, 400, { error: "A finalized character and PC Code are required." });
        return true;
      }
      const codeInUse = campaign.characters.some((entry) => entry.pcCode === pcCode)
        || campaign.joinRequests.some((entry) => entry.status === "pending" && entry.pcCode === pcCode && entry.characterId !== source.id);
      if (codeInUse) {
        sendJson(res, 409, { error: "Error: Please try a different code" });
        return true;
      }
      campaign.joinRequests = campaign.joinRequests.filter((entry) => entry.characterId !== source.id || entry.status === "approved");
      source.access = { ...(source.access || {}), pcCode };
      source.campaignLink = {
        roomCode: campaign.code,
        campaignName: campaign.name,
        status: "pending",
      };
      const request = {
        id: uid("join"),
        characterId: String(source.id),
        pcCode,
        status: "pending",
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
        message: "Awaiting GM approval.",
        character: source,
      };
      campaign.joinRequests.push(request);
      await this.save(campaign);
      sendJson(res, 201, {
        requestId: request.id,
        status: request.status,
        roomCode: campaign.code,
        campaignName: campaign.name,
      });
      return true;
    }

    if (path === "/api/campaign/join/status" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const pcCode = String(body.pcCode || "");
      const linked = campaign.characters.find((entry) => entry.id === characterId && entry.pcCode === pcCode);
      if (linked) {
        const characterToken = this.newSession(code, "character", linked.id);
        sendJson(res, 200, {
          status: "approved",
          token: characterToken,
          characterId: linked.id,
          campaign: this.state(campaign, characterToken),
        });
        return true;
      }
      const request = [...campaign.joinRequests].reverse().find((entry) => entry.characterId === characterId && entry.pcCode === pcCode);
      if (!request) {
        sendJson(res, 404, { error: "No campaign request was found for this character." });
        return true;
      }
      if (request.status === "pending" && body.character && typeof body.character === "object") {
        request.character = clone(body.character);
        request.character.access = { ...(request.character.access || {}), pcCode };
        request.character.campaignLink = { roomCode: campaign.code, campaignName: campaign.name, status: "pending" };
        await this.save(campaign);
      }
      sendJson(res, 200, {
        status: request.status,
        message: request.message,
        roomCode: campaign.code,
        campaignName: campaign.name,
      });
      return true;
    }

    if (path === "/api/campaign/join/cancel" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const pcCode = String(body.pcCode || "");
      const request = campaign.joinRequests.find((entry) => entry.characterId === characterId && entry.pcCode === pcCode && entry.status === "pending");
      if (!request) {
        sendJson(res, 404, { error: "No pending campaign request was found." });
        return true;
      }
      campaign.joinRequests = campaign.joinRequests.filter((entry) => entry.id !== request.id);
      await this.save(campaign);
      sendJson(res, 200, { cancelled: true });
      return true;
    }

    if (path === "/api/campaign/join/respond" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const request = campaign.joinRequests.find((entry) => entry.id === body.requestId && entry.status === "pending");
      if (!request) {
        sendJson(res, 404, { error: "That join request is no longer pending." });
        return true;
      }
      const approve = body.decision === "approve";
      request.status = approve ? "approved" : "rejected";
      request.resolvedAt = new Date().toISOString();
      request.message = approve
        ? `${campaign.name} approved this character.`
        : `${campaign.name} declined this character's join request.`;
      if (approve) {
        if (campaign.characters.some((entry) => entry.pcCode === request.pcCode)) {
          request.status = "rejected";
          request.message = "Error: Please try a different code";
          await this.save(campaign);
          sendJson(res, 409, { error: request.message });
          return true;
        }
        const source = clone(request.character);
        source.campaignLink = { roomCode: campaign.code, campaignName: campaign.name, status: "linked" };
        source.access = { ...(source.access || {}), pcCode: request.pcCode };
        campaign.characters.push({
          id: request.characterId,
          pcCode: request.pcCode,
          approved: true,
          imported: Boolean(source.imported),
          createdAt: request.requestedAt,
          updatedAt: new Date().toISOString(),
          character: source,
        });
        campaign.privateNotes.push({
          id: uid("note"),
          characterId: request.characterId,
          characterName: safeCharacterName({ character: source }),
          direction: "to-character",
          message: `Your character has been approved for ${campaign.name}.`,
          createdAt: new Date().toISOString(),
          readAt: null,
        });
      }
      await this.save(campaign);
      sendJson(res, 200, { status: request.status, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/backup" && req.method === "GET") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required to download a campaign backup." });
        return true;
      }
      sendJson(res, 200, campaignBackup(campaign));
      return true;
    }

    if (path === "/api/campaign/restore" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required to restore this campaign." });
        return true;
      }
      const backupCode = String(body.backup?.campaign?.code || "").trim().toUpperCase();
      const restored = backupCode === code ? campaignFromBackup(body.backup, { code, currentGmCode: campaign.gmCode }) : null;
      if (!restored) {
        sendJson(res, 400, { error: "That backup does not match this campaign." });
        return true;
      }
      await this.save(restored);
      this.restoreEncounter(code, restored.encounter);
      sendJson(res, 200, { campaign: this.state(restored, token) });
      return true;
    }

    if (path === "/api/campaign/delete" && req.method === "POST") {
      if (!this.gmSession(token, code) || body.campaignName !== campaign.name || !passwordMatches(body.gmCode ?? body.password, campaign.gmCode)) {
        sendJson(res, 403, { error: "GM authorization, the GM Code, and the exact campaign name are required." });
        return true;
      }
      await this.store.delete(code);
      this.campaignCache.delete(code);
      this.campaignLoads.delete(code);
      this.saveQueues.delete(code);
      this.clients.delete(code);
      sendJson(res, 200, { deleted: true });
      return true;
    }

    if (path === "/api/campaign/character/create" && req.method === "POST") {
      const source = body.character && typeof body.character === "object" ? clone(body.character) : {};
      const id = String(source.id || uid("character"));
      const pcCode = String(body.pcCode || source?.access?.pcCode || "");
      if (!pcCode || campaign.characters.some((entry) => entry.pcCode === pcCode)) {
        sendJson(res, 409, { error: "Error: Please try a different code" });
        return true;
      }
      source.id = id;
      const record = {
        id,
        pcCode,
        approved: true,
        imported: Boolean(body.imported),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        character: source,
      };
      campaign.characters.push(record);
      await this.save(campaign);
      const characterToken = this.newSession(code, "character", id);
      sendJson(res, 201, { token: characterToken, pcCode: record.pcCode, record: publicCharacter(record, { own: true, notes: [] }) });
      return true;
    }

    if (path === "/api/campaign/character/unlock" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || String(body.pcCode ?? body.pin ?? "") !== record.pcCode) {
        sendJson(res, 403, { error: "PC Code is incorrect." });
        return true;
      }
      const characterToken = this.newSession(code, "character", record.id);
      sendJson(res, 200, { token: characterToken, record: publicCharacter(record, {
        own: true,
        notes: campaign.privateNotes.filter((note) => note.characterId === record.id),
      }) });
      return true;
    }

    if (path === "/api/campaign/character/save" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character editing authorization is required." });
        return true;
      }
      if (!body.character || typeof body.character !== "object") {
        sendJson(res, 400, { error: "Character data is required." });
        return true;
      }
      const next = clone(body.character);
      next.id = record.id;
      next.resources ||= {};
      const serverCredits = Number(record.character?.resources?.creditsBase) || 0;
      const submittedCredits = Number(next.resources.creditsBase) || 0;
      const baseCredits = Number(body.baseCredits);
      next.resources.creditsBase = Number.isFinite(baseCredits)
        ? Math.round(boundedNumber(serverCredits + (submittedCredits - baseCredits), 0, 999999999))
        : Math.round(boundedNumber(submittedCredits, 0, 999999999));
      record.character = next;
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { saved: true, updatedAt: record.updatedAt, creditsBase: next.resources.creditsBase });
      return true;
    }

    if ((path === "/api/campaign/character/change-pc-code" || path === "/api/campaign/character/change-pin") && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      const pcCode = String(body.pcCode ?? body.pin ?? "");
      if (!record || !this.characterSession(token, code, record.id) || !pcCode) {
        sendJson(res, 403, { error: "Authorization and a PC Code are required." });
        return true;
      }
      if (campaign.characters.some((entry) => entry.id !== record.id && entry.pcCode === pcCode)) {
        sendJson(res, 409, { error: "Error: Please try a different code" });
        return true;
      }
      record.pcCode = pcCode;
      record.character.access = { ...(record.character.access || {}), pcCode };
      await this.save(campaign);
      sendJson(res, 200, { changed: true, pcCode: record.pcCode });
      return true;
    }

    if (path === "/api/campaign/character/delete" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      campaign.characters = campaign.characters.filter((entry) => entry.id !== record.id);
      campaign.privateNotes = campaign.privateNotes.filter((note) => note.characterId !== record.id);
      campaign.rollRequests = campaign.rollRequests.filter((request) => !request.targetIds.includes(record.id));
      if (campaign.bankerCharacterId === record.id) campaign.bankerCharacterId = null;
      await this.save(campaign);
      sendJson(res, 200, { deleted: true });
      return true;
    }

    if (path === "/api/campaign/character/leave" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const detachedCharacter = clone(record.character);
      detachedCharacter.campaignLink = { roomCode: "", campaignName: "", status: "unlinked" };
      campaign.characters = campaign.characters.filter((entry) => entry.id !== record.id);
      campaign.rollRequests = campaign.rollRequests.filter((request) => !request.targetIds.includes(record.id));
      if (campaign.bankerCharacterId === record.id) campaign.bankerCharacterId = null;
      campaign.privateNotes.push({
        id: uid("note"),
        characterId: record.id,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "system",
        message: `${safeCharacterName(record)} left the campaign.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      this.invalidateCharacterSessions(code, record.id);
      await this.save(campaign);
      sendJson(res, 200, { left: true, character: detachedCharacter });
      return true;
    }

    if (path === "/api/campaign/character/kick" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record) {
        sendJson(res, 404, { error: "Character not found." });
        return true;
      }
      campaign.characters = campaign.characters.filter((entry) => entry.id !== record.id);
      campaign.rollRequests = campaign.rollRequests.filter((request) => !request.targetIds.includes(record.id));
      if (campaign.bankerCharacterId === record.id) campaign.bankerCharacterId = null;
      campaign.privateNotes.push({
        id: uid("note"),
        characterId: record.id,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "system",
        message: `${safeCharacterName(record)} was removed from the campaign by the GM.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      this.invalidateCharacterSessions(code, record.id);
      await this.save(campaign);
      sendJson(res, 200, { kicked: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/character/approve" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record) {
        sendJson(res, 404, { error: "Character not found." });
        return true;
      }
      record.approved = true;
      await this.save(campaign);
      sendJson(res, 200, { approved: true });
      return true;
    }

    if (path === "/api/campaign/script/save" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      campaign.script = String(body.script || "").slice(0, MAX_SCRIPT_LENGTH);
      await this.save(campaign);
      sendJson(res, 200, { saved: true, updatedAt: campaign.updatedAt });
      return true;
    }

    if (path === "/api/campaign/award" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const resource = String(body.resource || "");
      const amount = Math.round(Number(body.amount) || 0);
      const targetIds = [...new Set(Array.isArray(body.targetIds) ? body.targetIds.map(String) : [])];
      if (!amount || !["experience", "credits", "reverence", "shipCredits"].includes(resource)) {
        sendJson(res, 400, { error: "A resource and non-zero amount are required." });
        return true;
      }
      const before = { shipCredits: campaign.shipCredits, characters: [] };
      if (resource === "shipCredits") {
        campaign.shipCredits = Math.round(boundedNumber(campaign.shipCredits + amount, 0, 999999999999));
      } else {
        for (const record of campaign.characters.filter((entry) => targetIds.includes(entry.id))) {
          const character = record.character;
          character.experience ||= { available: 0, spent: 0, totalGained: 0 };
          character.resources ||= {};
          before.characters.push({
            id: record.id,
            experience: clone(character.experience),
            creditsBase: Number(character.resources.creditsBase) || 0,
            reverence: Number(character.resources.reverence) || 0,
          });
          if (resource === "experience") {
            character.experience.available = Math.max(0, Math.round((Number(character.experience.available) || 0) + amount));
            character.experience.totalGained = Math.max(
              Number(character.experience.spent) + character.experience.available,
              Math.round((Number(character.experience.totalGained) || 0) + amount),
            );
          }
          if (resource === "credits") character.resources.creditsBase = Math.round(boundedNumber((Number(character.resources.creditsBase) || 0) + amount, 0, 999999999));
          if (resource === "reverence") character.resources.reverence = Math.round(boundedNumber((Number(character.resources.reverence) || 0) + amount, 0, 10));
          record.updatedAt = new Date().toISOString();
        }
      }
      const award = {
        id: uid("award"),
        resource,
        amount,
        targetIds,
        before,
        at: new Date().toISOString(),
      };
      if (resource !== "shipCredits") {
        const label = { experience: "Experience", credits: "Credits", reverence: "Reverence" }[resource] || resource;
        const verb = amount > 0 ? "awarded" : "adjusted";
        for (const record of campaign.characters.filter((entry) => targetIds.includes(entry.id))) {
          campaign.privateNotes.push({
            id: uid("note"),
            characterId: record.id,
            characterName: safeCharacterName(record),
            direction: "to-character",
            kind: "award",
            awardId: award.id,
            message: `The GM ${verb} ${Math.abs(amount).toLocaleString()} ${label}.`,
            createdAt: award.at,
            readAt: null,
          });
        }
      }
      campaign.awardHistory.push(award);
      campaign.awardHistory = campaign.awardHistory.slice(-20);
      await this.save(campaign);
      sendJson(res, 200, { award: clone(award), campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/award/undo" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const award = campaign.awardHistory.pop();
      if (!award) {
        sendJson(res, 400, { error: "There is no award to undo." });
        return true;
      }
      campaign.shipCredits = award.before.shipCredits;
      for (const snapshot of award.before.characters || []) {
        const record = campaign.characters.find((entry) => entry.id === snapshot.id);
        if (!record) continue;
        record.character.experience = snapshot.experience;
        record.character.resources ||= {};
        record.character.resources.creditsBase = snapshot.creditsBase;
        record.character.resources.reverence = snapshot.reverence;
        record.updatedAt = new Date().toISOString();
      }
      if (award.resource !== "shipCredits") {
        const label = { experience: "Experience", credits: "Credits", reverence: "Reverence" }[award.resource] || award.resource;
        for (const snapshot of award.before.characters || []) {
          const record = campaign.characters.find((entry) => entry.id === snapshot.id);
          if (!record) continue;
          campaign.privateNotes.push({
            id: uid("note"),
            characterId: record.id,
            characterName: safeCharacterName(record),
            direction: "to-character",
            kind: "system",
            awardId: award.id,
            message: `The GM reversed the most recent ${label} award. Your balance has been restored.`,
            createdAt: new Date().toISOString(),
            readAt: null,
          });
        }
      }
      await this.save(campaign);
      sendJson(res, 200, { undone: award.id, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/note/send" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const message = String(body.message || "").trim().slice(0, 4000);
      const targetIds = [...new Set(Array.isArray(body.targetIds) ? body.targetIds.map(String) : [])];
      if (!message || !targetIds.length) {
        sendJson(res, 400, { error: "A private note and at least one character are required." });
        return true;
      }
      const notes = targetIds.filter((targetId) => campaign.characters.some((entry) => entry.id === targetId)).map((characterId) => ({
        id: uid("note"),
        characterId,
        characterName: safeCharacterName(campaign.characters.find((entry) => entry.id === characterId)),
        direction: "to-character",
        kind: "message",
        message,
        createdAt: new Date().toISOString(),
        readAt: null,
      }));
      campaign.privateNotes.push(...notes);
      await this.save(campaign);
      sendJson(res, 200, { sent: notes.length });
      return true;
    }

    if (path === "/api/campaign/note/send-to-gm" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const record = campaign.characters.find((entry) => entry.id === characterId);
      if (!record || !this.characterSession(token, code, characterId)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const message = String(body.message || "").trim().slice(0, 1000);
      if (!message) {
        sendJson(res, 400, { error: "Type a message first." });
        return true;
      }
      const note = {
        id: uid("note"),
        characterId,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "message",
        message,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      campaign.privateNotes.push(note);
      await this.save(campaign);
      sendJson(res, 201, { sent: true, note: clone(note) });
      return true;
    }

    if (path === "/api/campaign/note/gm-read" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId && entry.direction === "to-gm");
      if (note) note.readAt ||= new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { read: Boolean(note), readAt: note?.readAt || null });
      return true;
    }

    if (path === "/api/campaign/note/read" && req.method === "POST") {
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId);
      if (!note || !this.characterSession(token, code, note.characterId)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      note.readAt ||= new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { read: true, readAt: note.readAt });
      return true;
    }

    if (path === "/api/campaign/note/delete" && req.method === "POST") {
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId);
      if (!note || !this.characterSession(token, code, note.characterId)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      campaign.privateNotes = campaign.privateNotes.filter((entry) => entry.id !== note.id);
      await this.save(campaign);
      sendJson(res, 200, { deleted: true });
      return true;
    }

    if (path === "/api/campaign/roll/request" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      let targetIds = [...new Set(Array.isArray(body.targetIds) ? body.targetIds.map(String) : [])];
      if (body.connectedOnly) {
        const connected = new Set(this.connectedCharacterIds(code));
        targetIds = targetIds.filter((targetId) => connected.has(targetId));
      }
      targetIds = targetIds.filter((targetId) => campaign.characters.some((entry) => entry.id === targetId));
      if (!targetIds.length || !body.attribute || !body.skill) {
        sendJson(res, 400, { error: "At least one connected target, an Attribute, and a Skill are required." });
        return true;
      }
      const difficulty = body.difficulty === "" || body.difficulty === null || body.difficulty === undefined
        ? null
        : Number(body.difficulty);
      const request = {
        id: uid("roll"),
        source: String(body.source || "GM Prompt").slice(0, 160),
        attribute: String(body.attribute).slice(0, 40),
        skill: String(body.skill).slice(0, 80),
        difficulty: Number.isFinite(difficulty) ? difficulty : null,
        hideDifficulty: Boolean(body.hideDifficulty),
        targetIds,
        results: {},
        createdAt: new Date().toISOString(),
        closedAt: null,
      };
      campaign.rollRequests.push(request);
      for (const characterId of targetIds) {
        const record = campaign.characters.find((entry) => entry.id === characterId);
        if (!record) continue;
        const difficultyText = request.hideDifficulty
          ? "Hidden Difficulty"
          : request.difficulty === null ? "No Difficulty" : `Difficulty ${request.difficulty}`;
        campaign.privateNotes.push({
          id: uid("note"),
          characterId,
          characterName: safeCharacterName(record),
          direction: "to-character",
          kind: "roll-request",
          rollRequestId: request.id,
          message: `Roll requested: ${request.attribute} + ${request.skill} (${difficultyText}).`,
          createdAt: request.createdAt,
          readAt: null,
        });
      }
      await this.save(campaign);
      sendJson(res, 201, { request: clone(request) });
      return true;
    }

    if (path === "/api/campaign/roll/respond" && req.method === "POST") {
      const request = campaign.rollRequests.find((entry) => entry.id === body.requestId && !entry.closedAt);
      const characterId = String(body.characterId || "");
      if (!request || !request.targetIds.includes(characterId) || !this.characterSession(token, code, characterId)) {
        sendJson(res, 403, { error: "This roll request is not available to that character." });
        return true;
      }
      request.results[characterId] = {
        score: Number(body.score) || 0,
        mode: body.mode === "manual" ? "manual" : "automatic",
        diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number) : [],
        outcome: String(body.outcome || "").slice(0, 40),
        respondedAt: new Date().toISOString(),
      };
      campaign.privateNotes = campaign.privateNotes.filter((note) => !(note.rollRequestId === request.id && note.characterId === characterId));
      await this.save(campaign);
      sendJson(res, 200, { recorded: true });
      return true;
    }

    if (path === "/api/campaign/roll/close" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const request = campaign.rollRequests.find((entry) => entry.id === body.requestId);
      if (request) {
        request.closedAt = new Date().toISOString();
        campaign.privateNotes = campaign.privateNotes.filter((note) => note.rollRequestId !== request.id);
      }
      await this.save(campaign);
      sendJson(res, 200, { closed: Boolean(request) });
      return true;
    }

    if (path === "/api/campaign/banker" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      campaign.bankerCharacterId = campaign.characters.some((entry) => entry.id === body.characterId)
        ? body.characterId
        : null;
      await this.save(campaign);
      sendJson(res, 200, { bankerCharacterId: campaign.bankerCharacterId });
      return true;
    }

    if (path === "/api/campaign/credits/transfer" && req.method === "POST") {
      const actor = campaign.characters.find((entry) => entry.id === body.characterId);
      const session = this.session(token, code);
      const gm = session?.role === "gm";
      const ownsActor = session?.role === "character" && session.characterId === actor?.id;
      const operation = String(body.operation || "");
      const amount = Math.round(Number(body.amount) || 0);
      const target = campaign.characters.find((entry) => entry.id === body.targetCharacterId);
      if (!actor || (!gm && !ownsActor)) {
        sendJson(res, 403, { error: "Unlock this character before transferring credits." });
        return true;
      }
      if (amount < 1 || !["deposit", "withdraw", "giftPersonal", "giftShip"].includes(operation)) {
        sendJson(res, 400, { error: "Choose a valid transfer and a positive whole-credit amount." });
        return true;
      }
      const usesPool = ["deposit", "withdraw", "giftShip"].includes(operation);
      if (usesPool && !gm && campaign.bankerCharacterId && campaign.bankerCharacterId !== actor.id) {
        sendJson(res, 403, { error: "Only the campaign banker may transfer credits to or from the Ship Credit Pool." });
        return true;
      }
      if (["giftPersonal", "giftShip"].includes(operation) && (!target || target.id === actor.id)) {
        sendJson(res, 400, { error: "Choose another campaign character to receive those credits." });
        return true;
      }
      actor.character.resources ||= {};
      actor.character.resources.creditsBase = Math.round(boundedNumber(actor.character.resources.creditsBase, 0, 999999999));
      if (target) {
        target.character.resources ||= {};
        target.character.resources.creditsBase = Math.round(boundedNumber(target.character.resources.creditsBase, 0, 999999999));
      }
      if (["deposit", "giftPersonal"].includes(operation) && actor.character.resources.creditsBase < amount) {
        sendJson(res, 400, { error: "That character does not have enough personal credits." });
        return true;
      }
      if (["withdraw", "giftShip"].includes(operation) && campaign.shipCredits < amount) {
        sendJson(res, 400, { error: "The Ship Credit Pool does not contain enough credits." });
        return true;
      }
      if (operation === "deposit") {
        actor.character.resources.creditsBase -= amount;
        campaign.shipCredits += amount;
      } else if (operation === "withdraw") {
        campaign.shipCredits -= amount;
        actor.character.resources.creditsBase += amount;
      } else if (operation === "giftPersonal") {
        actor.character.resources.creditsBase -= amount;
        target.character.resources.creditsBase += amount;
      } else if (operation === "giftShip") {
        campaign.shipCredits -= amount;
        target.character.resources.creditsBase += amount;
      }
      actor.updatedAt = new Date().toISOString();
      if (target) target.updatedAt = actor.updatedAt;
      await this.save(campaign);
      sendJson(res, 200, { transferred: true, campaign: this.state(campaign, token) });
      return true;
    }

    sendJson(res, 404, { error: "Campaign endpoint not found." });
    return true;
  }
}

module.exports = { CampaignApi };
