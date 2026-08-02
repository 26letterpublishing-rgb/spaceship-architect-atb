import { ATTRIBUTE_DEFS, SPACECRAFT_SKILLS, GENERAL_SKILLS } from "./character-data.js?v=20260802-campaign-3";

const $ = (selector) => document.querySelector(selector);
const dom = {
  gateway: $("#campaignGateway"),
  workspace: $("#gmWorkspace"),
  heading: $("#campaignHeading"),
  codeHeading: $("#campaignCodeHeading"),
  nameHeading: $("#campaignNameHeading"),
  logout: $("#gmLogout"),
  openForm: $("#openCampaignForm"),
  code: $("#gmCampaignCode"),
  password: $("#gmCampaignPassword"),
  showCreate: $("#showCreateCampaign"),
  createForm: $("#createCampaignForm"),
  newName: $("#newCampaignName"),
  newPassword: $("#newCampaignPassword"),
  confirmPassword: $("#confirmCampaignPassword"),
  cancelCreate: $("#cancelCreateCampaign"),
  restoreFile: $("#restoreCampaignFile"),
  restoreForm: $("#restoreCampaignForm"),
  restoreCode: $("#restoreCampaignCode"),
  restoreName: $("#restoreCampaignName"),
  restorePassword: $("#restoreCampaignPassword"),
  cancelRestore: $("#cancelRestoreCampaign"),
  gatewayMessage: $("#gatewayMessage"),
  message: $("#gmMessage"),
  tabs: $(".gm-tabs"),
  script: $("#campaignScript"),
  scriptSaveState: $("#scriptSaveState"),
  editScriptMode: $("#editScriptMode"),
  runScriptMode: $("#runScriptMode"),
  scriptCommandBuilder: $("#scriptCommandBuilder"),
  scriptScope: $("#scriptScope"),
  scriptTargetWrap: $("#scriptTargetWrap"),
  scriptTarget: $("#scriptTarget"),
  scriptAttribute: $("#scriptAttribute"),
  scriptSkill: $("#scriptSkill"),
  scriptDifficulty: $("#scriptDifficulty"),
  scriptHideDifficulty: $("#scriptHideDifficulty"),
  insertCommand: $("#insertScriptCommand"),
  scriptCommands: $("#scriptCommands"),
  characterList: $("#gmCharacterList"),
  characterCount: $("#characterCount"),
  selectedTargetCount: $("#selectedTargetCount"),
  promptTargets: $("#promptTargets"),
  selectAllTargets: $("#selectAllTargets"),
  selectConnectedTargets: $("#selectConnectedTargets"),
  clearTargets: $("#clearTargets"),
  awardForm: $("#awardForm"),
  awardResource: $("#awardResource"),
  awardAmount: $("#awardAmount"),
  shipCredits: $("#shipCredits"),
  undoAward: $("#undoAward"),
  bankerCharacter: $("#bankerCharacter"),
  setBanker: $("#setBanker"),
  noteForm: $("#privateNoteForm"),
  noteMessage: $("#privateNoteMessage"),
  rollForm: $("#rollPromptForm"),
  promptAttribute: $("#promptAttribute"),
  promptSkill: $("#promptSkill"),
  promptDifficulty: $("#promptDifficulty"),
  promptHideDifficulty: $("#promptHideDifficulty"),
  rollResults: $("#gmRollResults"),
  atbFrame: $("#atbFrame"),
  atbSetup: $("#atbSetup"),
  atbLive: $("#atbLive"),
  encounterStatus: $("#encounterStatus"),
  existingEncounterActions: $("#existingEncounterActions"),
  existingEncounterSummary: $("#existingEncounterSummary"),
  encounterBuilder: $("#encounterBuilder"),
  encounterCharacterList: $("#encounterCharacterList"),
  encounterNpcList: $("#encounterNpcList"),
  addEncounterNpc: $("#addEncounterNpc"),
  beginEncounter: $("#beginEncounter"),
  resumeEncounter: $("#resumeEncounter"),
  prepareNewEncounter: $("#prepareNewEncounter"),
  returnToEncounterSetup: $("#returnToEncounterSetup"),
  liveEncounterCode: $("#liveEncounterCode"),
  storageMode: $("#storageMode"),
  saveCampaignBackup: $("#saveCampaignBackup"),
  restoreOpenCampaignFile: $("#restoreOpenCampaignFile"),
  deleteCampaign: $("#deleteCampaign"),
};

const allSkills = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
let campaign = null;
let code = "";
let token = "";
let events = null;
let scriptSaveTimer = null;
let scriptDirty = false;
let scriptMode = "edit";
let selectedTargets = new Set();
const executedCommands = new Set();
let pendingRestoreBackup = null;
let encounterState = null;
let npcSequence = 0;
let stagedNpcs = [];
let selectedEncounterCharacters = new Set();
const CAMPAIGN_CACHE_PREFIX = "sa-campaign-cache-v1-";
const npcDefaults = [
  ["Security Guard", 5, "#39e58f"],
  ["Space Slug", 3, "#7ad66d"],
  ["Civilian", 4, "#f2d16b"],
  ["Chief Security Guard", 7, "#35b7ff"],
  ["Thug", 6, "#f07a4a"],
  ["Purple Alien", 8, "#a65cff"],
  ["Mini Boss", 9, "#ff5fa2"],
  ["Robot Sentry", 10, "#8bd7ff"],
  ["Cyber Ninja", 11, "#20f5d0"],
  ["Final Boss", 12, "#ff3d55"],
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(element, message, tone = "") {
  element.textContent = message;
  element.className = `status-message ${tone}`.trim();
}

function tokenKey(campaignCode) {
  return `sa-gm-token-${campaignCode}`;
}

function cacheCampaignState(nextCampaign) {
  if (!nextCampaign?.code) return;
  try {
    localStorage.setItem(`${CAMPAIGN_CACHE_PREFIX}${nextCampaign.code}`, JSON.stringify({
      savedAt: new Date().toISOString(),
      campaign: nextCampaign,
    }));
  } catch {
    // The downloadable backup remains available if browser storage is full.
  }
}

function downloadJson(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function validateCampaignBackup(payload) {
  const backup = payload?.format === "spaceship-architect-campaign" ? payload : null;
  if (!backup?.campaign?.code || !backup?.campaign?.name || !Array.isArray(backup.campaign.characters)) {
    throw new Error("That file is not a Spaceship Architect campaign backup.");
  }
  return backup;
}

async function readCampaignBackup(file) {
  if (!file) throw new Error("Choose a campaign backup file first.");
  return validateCampaignBackup(JSON.parse(await file.text()));
}

function cacheFullCampaignBackup(backup) {
  try {
    localStorage.setItem(`sa-campaign-full-backup-v1-${backup.campaign.code}`, JSON.stringify(backup));
  } catch {
    // Portrait-heavy campaigns may exceed browser storage; the downloaded file remains complete.
  }
}

async function api(path, body = null, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: body === null ? undefined : { "Content-Type": "application/json" },
    body: body === null ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The server rejected that request.");
  return payload;
}

async function encounterAction(action, payload = {}) {
  return api("/api/action", { roomCode: code, gmToken: token, action, ...payload });
}

function characterName(record) {
  return record?.character?.identity?.characterName || "Unnamed Character";
}

function playerName(record) {
  return record?.character?.identity?.playerName || "No Player Name";
}

function skillRating(record, name) {
  return ((Number(record?.character?.skills?.[name]?.tenths) || 0) / 10).toFixed(1);
}

function boxesFilled(record, attribute) {
  return (record?.character?.attributes?.[attribute] || []).reduce((total, die) => total + Math.max(0, Number(die) + 1), 0);
}

function characterSpeed(record) {
  return record?.character?.computed?.speed
    ?? Math.max(1, boxesFilled(record, "intellect") + (Number(record?.character?.skills?.Initiative?.tenths) || 0) / 10);
}

function commandWindow(record) {
  return record?.character?.computed?.commandWindow
    ?? Math.max(1, boxesFilled(record, "perception") * 10 + ((Number(record?.character?.skills?.Awareness?.tenths) || 0) / 10) * 30);
}

function populateRulesControls() {
  const attributeOptions = ATTRIBUTE_DEFS.map((definition) => `<option value="${definition.label}">${definition.label}</option>`).join("");
  const skillOptions = allSkills.map((skill) => `<option value="${escapeHtml(skill)}">${escapeHtml(skill)}</option>`).join("");
  dom.scriptAttribute.innerHTML = attributeOptions;
  dom.promptAttribute.innerHTML = attributeOptions;
  dom.scriptSkill.innerHTML = skillOptions;
  dom.promptSkill.innerHTML = skillOptions;
}

function selectedRecords() {
  return campaign?.characters?.filter((record) => selectedTargets.has(record.id)) || [];
}

function syncSelectedTargets() {
  if (!campaign) return;
  const valid = new Set(campaign.characters.map((record) => record.id));
  selectedTargets = new Set([...selectedTargets].filter((id) => valid.has(id)));
  dom.selectedTargetCount.textContent = `${selectedTargets.size} Selected`;
}

function renderTargets() {
  syncSelectedTargets();
  dom.promptTargets.innerHTML = campaign.characters.length
    ? campaign.characters.map((record) => `
      <label class="target-option">
        <input type="checkbox" data-target-id="${record.id}" ${selectedTargets.has(record.id) ? "checked" : ""} />
        <span><strong>${escapeHtml(characterName(record))}</strong><small>${record.connected ? "Connected" : "Offline"}</small></span>
      </label>`).join("")
    : "<p>No characters have been created for this campaign.</p>";
}

function renderCharacters() {
  dom.characterCount.textContent = `${campaign.characters.length} Character${campaign.characters.length === 1 ? "" : "s"}`;
  dom.characterList.innerHTML = campaign.characters.length
    ? campaign.characters.map((record) => {
      const character = record.character || {};
      const color = character.presentation?.atbColor || "#39e58f";
      const notes = record.privateNotes || [];
      const readNotes = notes.filter((note) => note.readAt).length;
      const approval = record.approved === false ? '<strong class="approval-pending">IMPORTED - APPROVAL REQUIRED</strong>' : "";
      return `<article class="gm-character-card ${record.connected ? "connected" : ""}" style="--character-color:${color}">
        <div class="character-card-head"><span class="character-swatch"></span><div><strong>${escapeHtml(characterName(record))}</strong><small>${escapeHtml(playerName(record))} ${record.connected ? "| CONNECTED" : "| OFFLINE"}</small></div></div>
        ${approval}
        <div class="character-details">
          <div><span>Speed</span><strong>${Number(characterSpeed(record)).toFixed(1).replace(/\.0$/, "")}</strong></div>
          <div><span>Command</span><strong>${Math.round(commandWindow(record))} SEC</strong></div>
          <div><span>Notes Read</span><strong>${readNotes}/${notes.length}</strong></div>
        </div>
        <div class="pin-readout"><span>CHARACTER PIN</span><strong>${record.pin || "----"}</strong></div>
        <div class="character-card-actions"><a href="character.html?campaign=${campaign.code}&character=${encodeURIComponent(record.id)}&gm=1">Open / Edit Sheet</a>${record.approved === false ? `<button type="button" data-approve-character="${record.id}">Approve Import</button>` : ""}</div>
      </article>`;
    }).join("")
    : "<p>No characters yet. Players can create one from the Characters option on the main menu.</p>";
}

function renderRollResults() {
  const requests = [...(campaign.rollRequests || [])].reverse().filter((request) => !request.closedAt);
  dom.rollResults.innerHTML = requests.length ? requests.map((request) => {
    const rows = request.targetIds.map((targetId) => {
      const record = campaign.characters.find((entry) => entry.id === targetId);
      const result = request.results?.[targetId];
      return {
        name: characterName(record),
        result,
      };
    }).sort((a, b) => (b.result?.score ?? -Infinity) - (a.result?.score ?? -Infinity));
    return `<article class="roll-request-card">
      <div class="roll-request-head"><div><strong>${escapeHtml(request.attribute)} + ${escapeHtml(request.skill)}</strong><small>${request.difficulty === null ? "No Difficulty" : `Difficulty ${request.difficulty}${request.hideDifficulty ? " (Hidden)" : ""}`}</small></div><button type="button" data-close-roll="${request.id}">Close</button></div>
      ${rows.map(({ name, result }) => `<div class="result-row"><span>${escapeHtml(name)}</span>${result ? `<strong>${result.score}</strong><small>${escapeHtml(result.outcome || result.mode)}</small>` : '<span class="waiting">Waiting</span><small>Pending</small>'}</div>`).join("")}
    </article>`;
  }).join("") : "<p>No active roll requests.</p>";
}

function parseCommand(raw, index) {
  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  const scopePart = parts.shift() || "";
  const rollPart = parts.shift() || "";
  const [attribute, skill] = rollPart.split("+").map((part) => part?.trim());
  const difficultyPart = parts.find((part) => /^difficulty\s+/i.test(part));
  const difficulty = difficultyPart ? Number(difficultyPart.replace(/^difficulty\s+/i, "")) : null;
  const hideDifficulty = parts.some((part) => /^hidden$/i.test(part));
  let scope = "";
  let targetName = "";
  if (/^all players$/i.test(scopePart)) scope = "all";
  else if (/^choose pc$/i.test(scopePart)) scope = "choose";
  else if (/^target character/i.test(scopePart)) {
    scope = "target";
    targetName = scopePart.split(":").slice(1).join(":").trim();
  }
  const validAttribute = ATTRIBUTE_DEFS.some((definition) => definition.label.toLowerCase() === String(attribute || "").toLowerCase());
  const validSkill = allSkills.some((entry) => entry.toLowerCase() === String(skill || "").toLowerCase());
  return {
    id: `script-command-${index}`,
    raw,
    scope,
    targetName,
    attribute,
    skill,
    difficulty: Number.isFinite(difficulty) ? difficulty : null,
    hideDifficulty,
    valid: Boolean(scope && validAttribute && validSkill),
  };
}

function scriptCommandList() {
  const commands = [];
  const expression = /::([\s\S]*?)::/g;
  let match;
  while ((match = expression.exec(dom.script.value))) commands.push(parseCommand(match[1], commands.length));
  return commands;
}

function stagedNpc() {
  const [name, speed, color] = npcDefaults[npcSequence % npcDefaults.length];
  npcSequence += 1;
  return { id: `staged-npc-${Date.now()}-${npcSequence}`, name, speed, color };
}

function ensureEncounterDefaults() {
  const approved = (campaign?.characters || []).filter((record) => record.approved !== false);
  if (!selectedEncounterCharacters.size) selectedEncounterCharacters = new Set(approved.map((record) => record.id));
  if (!stagedNpcs.length) stagedNpcs = [stagedNpc()];
}

function renderEncounterBuilder() {
  if (!campaign) return;
  ensureEncounterDefaults();
  const approved = campaign.characters.filter((record) => record.approved !== false);
  dom.encounterCharacterList.innerHTML = approved.length ? approved.map((record) => {
    const color = record.character?.presentation?.atbColor || "#39e58f";
    return `<label class="encounter-character-option" style="--character-color:${escapeHtml(color)}">
      <input type="checkbox" data-encounter-character="${record.id}" ${selectedEncounterCharacters.has(record.id) ? "checked" : ""} />
      <span><strong>${escapeHtml(characterName(record))}</strong><small>${escapeHtml(playerName(record))}</small></span>
      <span class="encounter-stat">SPD ${Number(characterSpeed(record)).toFixed(1).replace(/\.0$/, "")}</span>
      <span class="encounter-stat">CMD ${Math.round(commandWindow(record))}</span>
    </label>`;
  }).join("") : '<p>No approved campaign characters are available yet.</p>';
  dom.encounterNpcList.innerHTML = stagedNpcs.map((npc) => `<div class="encounter-npc-row" data-staged-npc="${npc.id}">
    <label>Name<input data-npc-field="name" value="${escapeHtml(npc.name)}" maxlength="40" /></label>
    <label>Speed<input data-npc-field="speed" type="number" min="0.1" max="100" step="0.1" value="${npc.speed}" /></label>
    <label>Color<input data-npc-field="color" type="color" value="${escapeHtml(npc.color)}" /></label>
    <button type="button" class="danger" data-remove-staged-npc="${npc.id}" aria-label="Remove ${escapeHtml(npc.name)}">X</button>
  </div>`).join("");
  dom.beginEncounter.disabled = !selectedEncounterCharacters.size && !stagedNpcs.length;
}

function renderEncounterStatus() {
  const units = encounterState?.units || [];
  const hasEncounter = units.length > 0;
  dom.encounterStatus.textContent = hasEncounter ? `${units.length} Participant${units.length === 1 ? "" : "s"} Saved` : "No Active Encounter";
  dom.existingEncounterActions.hidden = !hasEncounter;
  dom.existingEncounterSummary.textContent = hasEncounter
    ? `${units.map((unit) => unit.characterName).join(", ")} ${encounterState.running ? "are currently on the clock." : "are preserved in a paused encounter."}`
    : "";
  dom.encounterBuilder.hidden = hasEncounter;
  renderEncounterBuilder();
}

async function refreshEncounterState() {
  if (!code) return null;
  encounterState = await api(`/api/state?room=${encodeURIComponent(code)}`, null, "GET");
  renderEncounterStatus();
  return encounterState;
}

function showEncounterLive() {
  dom.atbSetup.hidden = true;
  dom.atbLive.hidden = false;
  dom.liveEncounterCode.textContent = code;
  const expected = `index.html?embedded=gm&campaign=${encodeURIComponent(code)}`;
  if (!dom.atbFrame.getAttribute("src")) dom.atbFrame.src = expected;
}

function showEncounterSetup({ forceBuilder = false } = {}) {
  dom.atbLive.hidden = true;
  dom.atbSetup.hidden = false;
  if (forceBuilder) {
    dom.existingEncounterActions.hidden = true;
    dom.encounterBuilder.hidden = false;
    renderEncounterBuilder();
  } else {
    refreshEncounterState().catch((error) => showMessage(dom.message, error.message, "error"));
  }
}

async function beginEncounter() {
  const selected = campaign.characters.filter((record) => selectedEncounterCharacters.has(record.id) && record.approved !== false);
  if (!selected.length && !stagedNpcs.length) {
    showMessage(dom.message, "Select at least one character or add an NPC.", "error");
    return;
  }
  dom.beginEncounter.disabled = true;
  dom.beginEncounter.textContent = "Preparing Combat...";
  try {
    await encounterAction("clearEncounter");
    for (const record of selected) {
      await encounterAction("addUnit", {
        playerName: playerName(record),
        characterName: characterName(record),
        speed: characterSpeed(record),
        commandWindow: commandWindow(record),
        color: record.character?.presentation?.atbColor || "#39e58f",
        controlledBy: "player",
        team: "pc",
        actorType: "character",
        characterId: record.id,
      });
    }
    for (const npc of stagedNpcs) {
      await encounterAction("addUnit", {
        playerName: "GM",
        characterName: npc.name || "NPC",
        speed: npc.speed || 5,
        commandWindow: null,
        color: npc.color || "#39e58f",
        controlledBy: "gm",
        team: "npc",
        actorType: "character",
      });
    }
    encounterState = await api(`/api/state?room=${encodeURIComponent(code)}`, null, "GET");
    dom.atbFrame.src = `index.html?embedded=gm&campaign=${encodeURIComponent(code)}&encounter=${Date.now()}`;
    showEncounterLive();
    showMessage(dom.message, "Encounter prepared and paused. Engage the clock when the table is ready.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.beginEncounter.disabled = false;
    dom.beginEncounter.textContent = "Begin Combat";
  }
}

function renderScriptCommands() {
  const source = dom.script.value;
  if (!source.trim()) {
    dom.scriptCommands.innerHTML = '<div class="script-run-empty">Write your campaign script in Edit mode, then return here to run it.</div>';
    return;
  }
  const commands = scriptCommandList();
  const expression = /::([\s\S]*?)::/g;
  const pieces = [];
  let cursor = 0;
  let index = 0;
  let match;
  while ((match = expression.exec(source))) {
    pieces.push(escapeHtml(source.slice(cursor, match.index)));
    const command = commands[index];
    const options = (campaign?.characters || []).map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}${record.connected ? " | Connected" : " | Offline"}</option>`).join("");
    const needsSelection = command?.scope === "choose" || (command?.scope === "target" && !command.targetName);
    const label = command?.valid
      ? `${command.scope === "all" ? "ALL PLAYERS" : command.scope === "choose" ? "CHOOSE PC" : command.targetName.toUpperCase()} / ${command.attribute} + ${command.skill}${command.difficulty === null ? "" : ` / ${command.hideDifficulty ? "HIDDEN " : ""}DIFFICULTY ${command.difficulty}`}`
      : `INVALID ROLL PROMPT / ${match[1].trim()}`;
    pieces.push(`<button type="button" class="script-command-chip ${command?.valid ? "" : "invalid"} ${executedCommands.has(command?.id) ? "executed" : ""}" data-send-command="${index}" ${command?.valid ? "" : "disabled"}>${escapeHtml(label)}</button>`);
    if (needsSelection) pieces.push(`<select class="script-inline-target" data-command-target="${index}"><option value="">Choose Character</option>${options}</select>`);
    cursor = expression.lastIndex;
    index += 1;
  }
  pieces.push(escapeHtml(source.slice(cursor)));
  dom.scriptCommands.innerHTML = pieces.join("");
}

function setScriptMode(nextMode) {
  scriptMode = nextMode === "run" ? "run" : "edit";
  const running = scriptMode === "run";
  dom.editScriptMode.classList.toggle("active", !running);
  dom.runScriptMode.classList.toggle("active", running);
  dom.script.hidden = running;
  dom.scriptCommandBuilder.hidden = running;
  dom.scriptCommands.hidden = !running;
  if (running) {
    if (scriptDirty) saveScript();
    renderScriptCommands();
  }
}

function renderCampaign() {
  if (!campaign) return;
  dom.codeHeading.textContent = campaign.code;
  dom.nameHeading.textContent = campaign.name;
  dom.shipCredits.textContent = Number(campaign.shipCredits || 0).toLocaleString();
  dom.undoAward.disabled = !campaign.lastAward;
  dom.storageMode.textContent = campaign.storageMode === "postgres" ? "Persistent Database" : "Local Test Storage";
  dom.storageMode.style.color = campaign.storageMode === "postgres" ? "var(--green)" : "var(--yellow)";
  dom.scriptTarget.innerHTML = campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("");
  dom.bankerCharacter.innerHTML = `<option value="">No Banker - Any PC May Use Pool</option>${campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("")}`;
  dom.bankerCharacter.value = campaign.bankerCharacterId || "";
  if (!scriptDirty && document.activeElement !== dom.script) dom.script.value = campaign.script || "";
  renderScriptCommands();
  renderCharacters();
  renderTargets();
  renderRollResults();
  renderEncounterBuilder();
}

function receiveCampaign(next) {
  campaign = next;
  cacheCampaignState(next);
  renderCampaign();
}

function connectCampaignEvents() {
  events?.close();
  events = new EventSource(`/campaign-events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
  events.addEventListener("campaign", (event) => receiveCampaign(JSON.parse(event.data)));
  events.addEventListener("error", () => showMessage(dom.message, "Connection interrupted. The app will reconnect automatically.", "error"));
}

function openWorkspace(nextCampaign, nextToken) {
  campaign = nextCampaign;
  code = campaign.code;
  token = nextToken;
  localStorage.setItem(tokenKey(code), token);
  localStorage.setItem("sa-current-campaign-code", code);
  dom.gateway.hidden = true;
  dom.workspace.hidden = false;
  dom.heading.hidden = false;
  dom.logout.hidden = false;
  dom.atbFrame.removeAttribute("src");
  selectedEncounterCharacters = new Set(campaign.characters.filter((record) => record.approved !== false).map((record) => record.id));
  npcSequence = 0;
  stagedNpcs = [stagedNpc()];
  renderCampaign();
  showEncounterSetup();
  connectCampaignEvents();
}

async function refreshCampaign() {
  if (!code || !token) return;
  receiveCampaign(await api(`/api/campaign/state?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, null, "GET"));
}

async function saveScript() {
  if (!campaign) return;
  dom.scriptSaveState.textContent = "Saving...";
  try {
    await api("/api/campaign/script/save", { code, token, script: dom.script.value });
    scriptDirty = false;
    dom.scriptSaveState.textContent = "Saved";
  } catch (error) {
    dom.scriptSaveState.textContent = "Save Failed";
    showMessage(dom.message, error.message, "error");
  }
}

async function sendRollRequest({ targetIds, attribute, skill, difficulty = null, hideDifficulty = false, source = "GM Prompt", connectedOnly = false }) {
  const payload = await api("/api/campaign/roll/request", { code, token, targetIds, attribute, skill, difficulty, hideDifficulty, source, connectedOnly });
  showMessage(dom.message, `Roll request sent to ${payload.request.targetIds.length} character${payload.request.targetIds.length === 1 ? "" : "s"}.`, "success");
}

dom.code.addEventListener("input", () => { dom.code.value = dom.code.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); });
dom.openForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await api("/api/campaign/open", { code: dom.code.value, password: dom.password.value });
    openWorkspace(payload.campaign, payload.token);
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});
dom.showCreate.addEventListener("click", () => { dom.openForm.hidden = true; dom.createForm.hidden = false; dom.newName.focus(); });
dom.cancelCreate.addEventListener("click", () => { dom.createForm.hidden = true; dom.openForm.hidden = false; });
dom.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (dom.newPassword.value !== dom.confirmPassword.value) {
    showMessage(dom.gatewayMessage, "The two GM passwords do not match.", "error");
    return;
  }
  try {
    const payload = await api("/api/campaign/create", { name: dom.newName.value, password: dom.newPassword.value });
    openWorkspace(payload.campaign, payload.token);
    showMessage(dom.message, `Campaign ${payload.campaign.code} created. This code remains with the campaign.`, "success");
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.restoreFile.addEventListener("change", async () => {
  try {
    pendingRestoreBackup = await readCampaignBackup(dom.restoreFile.files?.[0]);
    dom.restoreCode.textContent = pendingRestoreBackup.campaign.code;
    dom.restoreName.textContent = pendingRestoreBackup.campaign.name;
    dom.restoreForm.hidden = false;
    dom.restorePassword.focus();
    showMessage(dom.gatewayMessage, "Backup loaded. Create a new GM password to restore it.", "success");
  } catch (error) {
    pendingRestoreBackup = null;
    dom.restoreForm.hidden = true;
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.cancelRestore.addEventListener("click", () => {
  pendingRestoreBackup = null;
  dom.restoreFile.value = "";
  dom.restorePassword.value = "";
  dom.restoreForm.hidden = true;
});

dom.restoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingRestoreBackup) return;
  try {
    const payload = await api("/api/campaign/restore-create", { backup: pendingRestoreBackup, password: dom.restorePassword.value });
    openWorkspace(payload.campaign, payload.token);
    showMessage(dom.message, `Campaign ${payload.campaign.code} restored from its local backup.`, "success");
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.logout.addEventListener("click", () => {
  events?.close();
  location.href = "index.html";
});

dom.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  document.querySelectorAll(".gm-tabs [data-tab]").forEach((entry) => entry.classList.toggle("active", entry === button));
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    const active = panel.dataset.tabPanel === button.dataset.tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (button.dataset.tab === "atb") showEncounterSetup();
});

dom.editScriptMode.addEventListener("click", () => setScriptMode("edit"));
dom.runScriptMode.addEventListener("click", () => setScriptMode("run"));

dom.script.addEventListener("input", () => {
  scriptDirty = true;
  dom.scriptSaveState.textContent = "Unsaved";
  clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(saveScript, 650);
  renderScriptCommands();
});
dom.scriptScope.addEventListener("change", () => { dom.scriptTargetWrap.hidden = dom.scriptScope.value !== "Target Character"; });
dom.insertCommand.addEventListener("click", () => {
  const scope = dom.scriptScope.value === "Target Character"
    ? `Target Character:${characterName(campaign.characters.find((record) => record.id === dom.scriptTarget.value))}`
    : dom.scriptScope.value;
  const parts = [`${scope}/${dom.scriptAttribute.value}+${dom.scriptSkill.value}`];
  if (dom.scriptDifficulty.value !== "") parts.push(`Difficulty ${dom.scriptDifficulty.value}`);
  if (dom.scriptHideDifficulty.checked) parts.push("Hidden");
  const command = `::${parts.join("/")}::`;
  const start = dom.script.selectionStart ?? dom.script.value.length;
  const end = dom.script.selectionEnd ?? start;
  dom.script.setRangeText(command, start, end, "end");
  dom.script.dispatchEvent(new Event("input", { bubbles: true }));
  dom.script.focus();
});

dom.scriptCommands.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-send-command]");
  if (!button) return;
  const index = Number(button.dataset.sendCommand);
  const command = scriptCommandList()[index];
  if (!command?.valid) return;
  if (executedCommands.has(command.id) && !confirm("Send this roll request again?")) return;
  let targets = [];
  if (command.scope === "all") targets = campaign.characters.filter((record) => record.connected).map((record) => record.id);
  if (["choose", "target"].includes(command.scope)) {
    const select = dom.scriptCommands.querySelector(`[data-command-target="${index}"]`);
    const selectedId = select?.value || campaign.characters.find((record) => characterName(record).toLowerCase() === command.targetName.toLowerCase())?.id;
    if (selectedId) targets = [selectedId];
  }
  if (!targets.length) {
    showMessage(dom.message, "That command has no connected target character.", "error");
    return;
  }
  try {
    await sendRollRequest({
      targetIds: targets,
      attribute: command.attribute,
      skill: command.skill,
      difficulty: command.difficulty,
      hideDifficulty: command.hideDifficulty,
      source: `Script: ${command.raw}`,
      connectedOnly: command.scope === "all",
    });
    executedCommands.add(command.id);
    renderScriptCommands();
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.promptTargets.addEventListener("change", (event) => {
  const input = event.target.closest("[data-target-id]");
  if (!input) return;
  if (input.checked) selectedTargets.add(input.dataset.targetId);
  else selectedTargets.delete(input.dataset.targetId);
  syncSelectedTargets();
});
dom.selectAllTargets.addEventListener("click", () => { selectedTargets = new Set(campaign.characters.map((record) => record.id)); renderTargets(); });
dom.selectConnectedTargets.addEventListener("click", () => { selectedTargets = new Set(campaign.characters.filter((record) => record.connected).map((record) => record.id)); renderTargets(); });
dom.clearTargets.addEventListener("click", () => { selectedTargets.clear(); renderTargets(); });

dom.characterList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-approve-character]");
  if (!button) return;
  try {
    await api("/api/campaign/character/approve", { code, token, characterId: button.dataset.approveCharacter });
    showMessage(dom.message, "Imported character approved for campaign play.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.setBanker.addEventListener("click", async () => {
  try {
    await api("/api/campaign/banker", { code, token, characterId: dom.bankerCharacter.value || null });
    showMessage(dom.message, dom.bankerCharacter.value ? "Campaign banker assigned." : "Ship Credit Pool is open to every unlocked character.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.awardResource.addEventListener("change", () => {
  const pool = dom.awardResource.value === "shipCredits";
  dom.promptTargets.closest(".target-console").classList.toggle("targets-optional", pool);
});
dom.awardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const resource = dom.awardResource.value;
  const targetIds = resource === "shipCredits" ? [] : [...selectedTargets];
  if (resource !== "shipCredits" && !targetIds.length) {
    showMessage(dom.message, "Select at least one character to receive the award.", "error");
    return;
  }
  try {
    await api("/api/campaign/award", { code, token, resource, amount: dom.awardAmount.value, targetIds });
    showMessage(dom.message, "Award delivered immediately.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.undoAward.addEventListener("click", async () => {
  if (!confirm("Undo the most recent campaign award?")) return;
  try {
    await api("/api/campaign/award/undo", { code, token });
    showMessage(dom.message, "The most recent award was undone.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedTargets.size) {
    showMessage(dom.message, "Select at least one private-note recipient.", "error");
    return;
  }
  try {
    await api("/api/campaign/note/send", { code, token, targetIds: [...selectedTargets], message: dom.noteMessage.value });
    dom.noteMessage.value = "";
    showMessage(dom.message, "Private note delivered.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.rollForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedTargets.size) {
    showMessage(dom.message, "Select at least one roll recipient.", "error");
    return;
  }
  try {
    await sendRollRequest({
      targetIds: [...selectedTargets],
      attribute: dom.promptAttribute.value,
      skill: dom.promptSkill.value,
      difficulty: dom.promptDifficulty.value === "" ? null : dom.promptDifficulty.value,
      hideDifficulty: dom.promptHideDifficulty.checked,
    });
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.rollResults.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-close-roll]");
  if (!button) return;
  try {
    await api("/api/campaign/roll/close", { code, token, requestId: button.dataset.closeRoll });
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.encounterCharacterList.addEventListener("change", (event) => {
  const input = event.target.closest("[data-encounter-character]");
  if (!input) return;
  if (input.checked) selectedEncounterCharacters.add(input.dataset.encounterCharacter);
  else selectedEncounterCharacters.delete(input.dataset.encounterCharacter);
  renderEncounterBuilder();
});

dom.encounterNpcList.addEventListener("input", (event) => {
  const row = event.target.closest("[data-staged-npc]");
  const field = event.target.dataset.npcField;
  const npc = stagedNpcs.find((entry) => entry.id === row?.dataset.stagedNpc);
  if (!npc || !field) return;
  npc[field] = field === "speed" ? Math.max(0.1, Math.min(100, Number(event.target.value) || 0.1)) : event.target.value;
});

dom.encounterNpcList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-staged-npc]");
  if (!button) return;
  stagedNpcs = stagedNpcs.filter((entry) => entry.id !== button.dataset.removeStagedNpc);
  renderEncounterBuilder();
});

dom.addEncounterNpc.addEventListener("click", () => {
  stagedNpcs.push(stagedNpc());
  renderEncounterBuilder();
});
dom.beginEncounter.addEventListener("click", beginEncounter);
dom.resumeEncounter.addEventListener("click", showEncounterLive);
dom.prepareNewEncounter.addEventListener("click", () => {
  if (!confirm("Replace the saved encounter when Begin Combat is pressed? The current encounter remains safe until then.")) return;
  showEncounterSetup({ forceBuilder: true });
});
dom.returnToEncounterSetup.addEventListener("click", () => showEncounterSetup());

dom.saveCampaignBackup.addEventListener("click", async () => {
  try {
    const backup = await api(`/api/campaign/backup?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, null, "GET");
    cacheFullCampaignBackup(backup);
    const safeName = campaign.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "campaign";
    downloadJson(backup, `${safeName}-${campaign.code}.sa2campaign`);
    showMessage(dom.message, "Campaign synchronized and backed up to this computer.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.restoreOpenCampaignFile.addEventListener("change", async () => {
  try {
    const backup = await readCampaignBackup(dom.restoreOpenCampaignFile.files?.[0]);
    if (backup.campaign.code !== code) throw new Error(`That backup belongs to campaign ${backup.campaign.code}, not ${code}.`);
    if (!confirm(`Restore ${campaign.name} from the backup made ${new Date(backup.exportedAt).toLocaleString()}? Current campaign data will be replaced.`)) return;
    const payload = await api("/api/campaign/restore", { code, token, backup });
    receiveCampaign(payload.campaign);
    await refreshEncounterState();
    showMessage(dom.message, "Campaign restored from backup.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.restoreOpenCampaignFile.value = "";
  }
});

dom.deleteCampaign.addEventListener("click", async () => {
  const typedName = prompt(`Type the campaign name exactly to delete it:\n${campaign.name}`);
  if (typedName === null) return;
  const password = prompt("Enter the GM password to permanently delete this campaign:");
  if (password === null) return;
  if (!confirm("Permanently delete the campaign, every character, script, note, and encounter?")) return;
  try {
    await api("/api/campaign/delete", { code, token, campaignName: typedName, password });
    localStorage.removeItem(tokenKey(code));
    location.href = "index.html";
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

populateRulesControls();
setScriptMode("edit");
const initialCode = new URLSearchParams(location.search).get("campaign")?.toUpperCase() || localStorage.getItem("sa-current-campaign-code") || "";
if (initialCode) {
  dom.code.value = initialCode;
  const savedToken = localStorage.getItem(tokenKey(initialCode)) || "";
  if (savedToken) {
    code = initialCode;
    token = savedToken;
    refreshCampaign().then(() => {
      if (campaign?.role === "gm") openWorkspace(campaign, token);
    }).catch(() => {});
  }
}
