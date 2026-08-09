import { ATTRIBUTE_DEFS, DICE_FACES, SPACECRAFT_SKILLS, GENERAL_SKILLS } from "./character-data.js?v=20260807-rules-3";
import { weaponById } from "./weapon-data.js?v=20260809-weapons-1";

const $ = (selector) => document.querySelector(selector);
const dom = {
  gateway: $("#campaignGateway"),
  workspace: $("#gmWorkspace"),
  heading: $("#campaignHeading"),
  codeHeading: $("#campaignCodeHeading"),
  nameHeading: $("#campaignNameHeading"),
  logout: $("#gmLogout"),
  exitEncounter: $("#exitEncounter"),
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
  scriptCommandBuilder: $("#scriptCommandBuilder"),
  scriptScope: $("#scriptScope"),
  scriptTargetWrap: $("#scriptTargetWrap"),
  scriptTarget: $("#scriptTarget"),
  scriptAttribute: $("#scriptAttribute"),
  scriptSkill: $("#scriptSkill"),
  scriptDifficulty: $("#scriptDifficulty"),
  scriptHideDifficulty: $("#scriptHideDifficulty"),
  insertCommand: $("#insertScriptCommand"),
  endSession: $("#endSession"),
  sessionNumberLabel: $("#sessionNumberLabel"),
  characterList: $("#gmCharacterList"),
  characterCount: $("#characterCount"),
  sheetViewer: $("#gmSheetViewer"),
  sheetViewerTitle: $("#gmSheetViewerTitle"),
  sheetFrame: $("#gmSheetFrame"),
  closeSheetViewer: $("#closeGmSheetViewer"),
  selectedTargetCount: $("#selectedTargetCount"),
  promptTargets: $("#promptTargets"),
  selectAllTargets: $("#selectAllTargets"),
  selectConnectedTargets: $("#selectConnectedTargets"),
  clearTargets: $("#clearTargets"),
  awardForm: $("#awardForm"),
  awardResource: $("#awardResource"),
  awardAmount: $("#awardAmount"),
  awardMessage: $("#awardMessage"),
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
  inboxCount: $("#gmInboxCount"),
  pendingJoinCount: $("#pendingJoinCount"),
  inboxList: $("#gmInboxList"),
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
  kickCharacter: $("#kickCharacter"),
  kickCharacterButton: $("#kickCharacterButton"),
  adjustCharacter: $("#adjustCharacter"),
  adjustCharacterButton: $("#adjustCharacterButton"),
};

const allSkills = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
let campaign = null;
let code = "";
let token = "";
let events = null;
let scriptSaveTimer = null;
let scriptDirty = false;
let lastScriptRange = null;
let selectedTargets = new Set();
let targetSelectionTouched = false;
const executedCommands = new Set();
const scriptTargetSelections = new Map();
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
  const baseClass = element === dom.awardMessage ? "tool-message" : "status-message";
  element.className = `${baseClass} ${tone}`.trim();
}

function tokenKey(campaignCode) {
  return `sa-gm-token-${campaignCode}`;
}

function clearAtbBrowserIdentity() {
  localStorage.setItem("sa-atb-mode", "welcome");
  localStorage.removeItem("sa-atb-room-code");
  localStorage.removeItem("sa-atb-unit-id");
  localStorage.removeItem("sa-atb-campaign-character-id");
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

function highestAttributeDie(record, attribute) {
  return Math.max(0, ...(record?.character?.attributes?.[attribute] || [])
    .filter((value) => Number(value) >= 0)
    .map((value) => DICE_FACES[Number(value)] || 0));
}

function characterSpeed(record) {
  const initiative = (Number(record?.character?.skills?.Initiative?.tenths) || 0) / 10;
  const multiplier = record?.character?.identity?.classId === "mastermind" ? 1.5 : 1;
  return record?.character?.computed?.speed
    ?? Math.max(1, boxesFilled(record, "intellect") + initiative * multiplier);
}

function commandWindow(record) {
  const awarenessMultiplier = record?.character?.identity?.classId === "mastermind" ? 45 : 12;
  return record?.character?.computed?.commandWindow
    ?? Math.max(1, boxesFilled(record, "perception") * 8 + ((Number(record?.character?.skills?.Awareness?.tenths) || 0) / 10) * awarenessMultiplier);
}

function combatWeaponInventory(record) {
  return (record?.character?.weapons || []).flatMap((entry) => {
    const weapon = weaponById(entry?.weaponId);
    if (!weapon) return [];
    return [{ inventoryId: String(entry.id || weapon.id), weaponId: weapon.id }];
  });
}

function encounterRuleFields(record) {
  const identity = record?.character?.identity || {};
  const heldEntry = (record?.character?.weapons || []).find((entry) => entry?.held && weaponById(entry.weaponId));
  return {
    initialAtb: identity.classId === "rogue-drifter" ? 99 : 0,
    regenerationRate: identity.raceId === "antropic" && identity.raceType === "fins" ? boxesFilled(record, "health") : 0,
    dexterityBoxes: boxesFilled(record, "dexterity"),
    highestPerceptionDie: highestAttributeDie(record, "perception"),
    moveSpeed: Math.max(1, Number(record?.character?.computed?.moveSpeed) || 1),
    weaponMechanics: Number(skillRating(record, "Weapon Mechanics")) || 0,
    weapons: combatWeaponInventory(record),
    heldWeaponId: heldEntry ? String(heldEntry.id || heldEntry.weaponId) : "",
  };
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
  if (!targetSelectionTouched && !selectedTargets.size && campaign.characters.length === 1) {
    selectedTargets.add(campaign.characters[0].id);
  }
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
      const classId = character.identity?.classId || "";
      const classActions = classId === "playboy-minx"
        ? `<button type="button" data-class-action="playboy-reward" data-character-id="${record.id}">+1 REV / +5 XP</button>`
        : classId === "psychopath"
          ? `<button type="button" data-class-action="psychopath-reward" data-character-id="${record.id}">+8 XP KILL</button>`
          : classId === "peacekeeper"
            ? `<button type="button" data-class-action="peacekeeper-reward" data-character-id="${record.id}">PREVENTED COMBAT: +1 DRAMA</button>`
            : "";
      return `<article class="gm-character-card ${record.connected ? "connected" : ""}" style="--character-color:${color}">
        <div class="character-card-head"><span class="character-swatch"></span><div><strong>${escapeHtml(characterName(record))}</strong><small>${escapeHtml(playerName(record))} ${record.connected ? "| CONNECTED" : "| OFFLINE"}</small></div></div>
        <div class="character-details">
          <div><span>Speed</span><strong>${Number(characterSpeed(record)).toFixed(1).replace(/\.0$/, "")}</strong></div>
          <div><span>Command</span><strong>${Math.round(commandWindow(record))} SEC</strong></div>
          <div><span>Notes Read</span><strong>${readNotes}/${notes.length}</strong></div>
        </div>
        <div class="pin-readout"><span>PC CODE</span><strong>${escapeHtml(record.pcCode || "----")}</strong></div>
        <div class="character-card-actions"><button type="button" data-view-sheet="${record.id}">View Sheet</button>${classActions}</div>
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

function scriptSource() {
  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.matches("[data-script-command]")) return `::${node.dataset.commandRaw || ""}::`;
    if (node.tagName === "BR") return "\n";
    const content = [...node.childNodes].map(serialize).join("");
    return ["DIV", "P"].includes(node.tagName) ? `${content}\n` : content;
  }
  return [...dom.script.childNodes]
    .map(serialize)
    .join("")
    .replaceAll("\u00a0", " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n$/, "");
}

function renderInbox() {
  const requests = campaign.joinRequests || [];
  const inbox = [...(campaign.inbox || [])].reverse();
  const unread = inbox.filter((entry) => entry.direction === "to-gm" && !entry.readAt).length + requests.length;
  dom.inboxCount.textContent = unread ? String(unread) : "0";
  dom.pendingJoinCount.textContent = `${requests.length} Pending`;
  const requestMarkup = requests.map((request) => {
    const name = request.character?.identity?.characterName || "Unnamed Character";
    const player = request.character?.identity?.playerName || "Player";
    return `<article class="gm-inbox-card join-request-card" data-join-request="${request.id}">
      <div><span>JOIN REQUEST</span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(player)} | PC Code: ${escapeHtml(request.pcCode)}</small></div>
      <div class="inbox-actions"><button type="button" data-join-decision="reject">Reject</button><button class="primary" type="button" data-join-decision="approve">Approve</button></div>
    </article>`;
  }).join("");
  const messageMarkup = inbox.map((note) => `<article class="gm-inbox-card ${note.direction === "to-gm" && !note.readAt ? "unread" : ""}" data-gm-note="${note.id}">
    <div><span>${note.kind === "roll-request" ? "ROLL REQUEST" : note.kind === "award" ? "GM AWARD" : note.kind === "system" ? "CAMPAIGN NOTICE" : note.direction === "to-gm" ? "PLAYER MESSAGE" : "SENT MESSAGE"}</span><strong>${escapeHtml(note.characterName || "Character")}</strong><small>${new Date(note.createdAt).toLocaleString()}</small></div>
    <p>${escapeHtml(note.message)}</p>
  </article>`).join("");
  dom.inboxList.innerHTML = requestMarkup + messageMarkup || '<p class="empty-inbox">No campaign messages or pending characters.</p>';
}

function renderSettings() {
  const options = campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("");
  dom.kickCharacter.innerHTML = options || '<option value="">No campaign characters</option>';
  dom.adjustCharacter.innerHTML = options || '<option value="">No campaign characters</option>';
  dom.kickCharacterButton.disabled = !campaign.characters.length;
  dom.adjustCharacterButton.disabled = !campaign.characters.length;
}

function scriptCommandList(source = scriptSource()) {
  const commands = [];
  const expression = /::([\s\S]*?)::/g;
  let match;
  while ((match = expression.exec(source))) commands.push(parseCommand(match[1], commands.length));
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
  updateExitEncounterVisibility();
}

function updateExitEncounterVisibility() {
  const atbSelected = document.querySelector('.gm-tabs [data-tab="atb"]')?.classList.contains("active");
  dom.exitEncounter.hidden = !campaign || !atbSelected || !(encounterState?.units?.length);
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
  updateExitEncounterVisibility();
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
  updateExitEncounterVisibility();
}

async function resumeEncounterWithFreshCharacters() {
  try {
    await refreshCampaign();
    await refreshEncounterState();
    const updates = (encounterState?.units || []).flatMap((unit) => {
      if (!unit.characterId) return [];
      const record = campaign.characters.find((entry) => entry.id === unit.characterId);
      if (!record) return [];
      return [{
        characterId: record.id,
        playerName: playerName(record),
        characterName: characterName(record),
        speed: characterSpeed(record),
        commandWindow: commandWindow(record),
        color: record.character?.presentation?.atbColor || "#39e58f",
        ...encounterRuleFields(record),
      }];
    });
    if (updates.length) encounterState = await encounterAction("syncCampaignUnits", { units: updates });
    showEncounterLive();
    showMessage(dom.message, updates.length ? "Encounter resumed with current campaign character statistics." : "Encounter resumed.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
}

async function exitCampaignEncounter() {
  if (!confirm("End this encounter for every player and return everyone to the campaign roster?")) return;
  try {
    encounterState = await encounterAction("exitEncounter");
    dom.atbFrame.removeAttribute("src");
    showEncounterSetup({ forceBuilder: true });
    renderEncounterStatus();
    showMessage(dom.message, "Combat ended for the entire campaign. Character and campaign data remain saved.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
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
        ...encounterRuleFields(record),
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

function renderScriptEditor(source = scriptSource()) {
  const commands = scriptCommandList(source);
  const expression = /::([\s\S]*?)::/g;
  const pieces = [];
  let cursor = 0;
  let index = 0;
  let match;
  while ((match = expression.exec(source))) {
    pieces.push(escapeHtml(source.slice(cursor, match.index)));
    const command = commands[index];
    const selectionKey = `${index}:${command?.raw || ""}`;
    const selectedTargetId = scriptTargetSelections.get(selectionKey) || "";
    const options = (campaign?.characters || []).map((record) => `<option value="${record.id}" ${record.id === selectedTargetId ? "selected" : ""}>${escapeHtml(characterName(record))}${record.connected ? " | Connected" : " | Offline"}</option>`).join("");
    const needsSelection = command?.scope === "choose" || (command?.scope === "target" && !command.targetName);
    const label = command?.valid
      ? `${command.scope === "all" ? "ALL PLAYERS" : command.scope === "choose" ? "CHOOSE PC" : command.targetName.toUpperCase()} / ${command.attribute} + ${command.skill}${command.difficulty === null ? "" : ` / ${command.hideDifficulty ? "HIDDEN " : ""}DIFFICULTY ${command.difficulty}`}`
      : `INVALID ROLL PROMPT / ${match[1].trim()}`;
    pieces.push(`<span class="script-command-token" contenteditable="false" data-script-command data-command-raw="${escapeHtml(match[1])}"><button type="button" class="script-command-chip ${command?.valid ? "" : "invalid"} ${executedCommands.has(command?.id) ? "executed" : ""}" data-send-command="${index}" ${command?.valid ? "" : "disabled"}>${escapeHtml(label)}</button>${needsSelection ? `<select class="script-inline-target" data-command-target="${index}"><option value="">Choose Character</option>${options}</select>` : ""}</span>`);
    cursor = expression.lastIndex;
    index += 1;
  }
  pieces.push(escapeHtml(source.slice(cursor)));
  dom.script.innerHTML = pieces.join("").replaceAll("\n", "<br>");
  lastScriptRange = null;
}

function rememberScriptSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (dom.script.contains(range.commonAncestorContainer)) lastScriptRange = range.cloneRange();
}

function renderCampaign() {
  if (!campaign) return;
  dom.codeHeading.textContent = campaign.code;
  dom.nameHeading.textContent = campaign.name;
  dom.shipCredits.textContent = Number(campaign.shipCredits || 0).toLocaleString();
  dom.sessionNumberLabel.textContent = `Session ${campaign.sessionNumber || 1}`;
  dom.endSession.textContent = `End Session ${campaign.sessionNumber || 1}`;
  dom.undoAward.disabled = !campaign.lastAward;
  dom.storageMode.textContent = campaign.storageMode === "postgres" ? "Persistent Database" : "Local Test Storage";
  dom.storageMode.style.color = campaign.storageMode === "postgres" ? "var(--green)" : "var(--yellow)";
  dom.scriptTarget.innerHTML = campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("");
  dom.bankerCharacter.innerHTML = `<option value="">No Banker - Any PC May Use Pool</option>${campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("")}`;
  dom.bankerCharacter.value = campaign.bankerCharacterId || "";
  if (!scriptDirty && document.activeElement !== dom.script && scriptSource() !== (campaign.script || "")) {
    renderScriptEditor(campaign.script || "");
  }
  renderCharacters();
  renderInbox();
  renderSettings();
  renderTargets();
  renderRollResults();
  renderEncounterBuilder();
}

function receiveCampaign(next) {
  campaign = next;
  if (!targetSelectionTouched && !selectedTargets.size && next.characters?.length === 1) {
    selectedTargets.add(next.characters[0].id);
  }
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
  targetSelectionTouched = false;
  selectedTargets = campaign.characters.length === 1 ? new Set([campaign.characters[0].id]) : new Set();
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
    await api("/api/campaign/script/save", { code, token, script: scriptSource() });
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

dom.openForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await api("/api/campaign/open", { name: dom.code.value, gmCode: dom.password.value });
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
    showMessage(dom.gatewayMessage, "The two GM Codes do not match.", "error");
    return;
  }
  try {
    const payload = await api("/api/campaign/create", { name: dom.newName.value, gmCode: dom.newPassword.value });
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
    const payload = await api("/api/campaign/restore-create", { backup: pendingRestoreBackup, gmCode: dom.restorePassword.value });
    openWorkspace(payload.campaign, payload.token);
    showMessage(dom.message, `Campaign ${payload.campaign.code} restored from its local backup.`, "success");
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.logout.addEventListener("click", () => {
  events?.close();
  localStorage.removeItem(tokenKey(code));
  localStorage.removeItem("sa-current-campaign-code");
  clearAtbBrowserIdentity();
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
  updateExitEncounterVisibility();
});

dom.script.addEventListener("change", (event) => {
  const select = event.target.closest("[data-command-target]");
  if (!select) return;
  const index = Number(select.dataset.commandTarget);
  const command = scriptCommandList()[index];
  if (command) scriptTargetSelections.set(`${index}:${command.raw}`, select.value);
});
dom.script.addEventListener("input", () => {
  rememberScriptSelection();
  scriptDirty = true;
  dom.scriptSaveState.textContent = "Unsaved";
  clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(saveScript, 650);
});
dom.script.addEventListener("keydown", (event) => {
  if (!['Backspace', 'Delete'].includes(event.key)) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const backward = event.key === 'Backspace';
  let candidate = null;
  if (range.startContainer === dom.script) {
    candidate = dom.script.childNodes[range.startOffset + (backward ? -1 : 0)] || null;
  } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const atEdge = backward ? range.startOffset === 0 : range.startOffset === range.startContainer.nodeValue.length;
    if (atEdge) candidate = backward ? range.startContainer.previousSibling : range.startContainer.nextSibling;
  }
  if (candidate?.nodeName === 'BR') candidate = backward ? candidate.previousSibling : candidate.nextSibling;
  const token = candidate?.nodeType === Node.ELEMENT_NODE && candidate.matches('[data-script-command]') ? candidate : null;
  if (!token) return;
  event.preventDefault();
  token.remove();
  dom.script.dispatchEvent(new Event('input', { bubbles: true }));
});
dom.script.addEventListener("keyup", rememberScriptSelection);
dom.script.addEventListener("mouseup", rememberScriptSelection);
dom.script.addEventListener("blur", (event) => {
  if (event.relatedTarget && dom.script.contains(event.relatedTarget)) return;
  if (event.relatedTarget?.closest?.("#scriptCommandBuilder")) return;
  renderScriptEditor(scriptSource());
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
  const range = lastScriptRange?.cloneRange();
  if (range && dom.script.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(document.createTextNode(command));
  } else {
    dom.script.append(document.createTextNode(`${scriptSource() ? "\n" : ""}${command}`));
  }
  dom.script.dispatchEvent(new Event("input", { bubbles: true }));
  renderScriptEditor(scriptSource());
  dom.script.focus();
});

dom.script.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-send-command]");
  if (!button) return;
  event.preventDefault();
  const index = Number(button.dataset.sendCommand);
  const command = scriptCommandList()[index];
  if (!command?.valid) return;
  if (executedCommands.has(command.id) && !confirm("Send this roll request again?")) return;
  let targets = [];
  if (command.scope === "all") targets = campaign.characters.filter((record) => record.connected).map((record) => record.id);
  if (["choose", "target"].includes(command.scope)) {
    const select = dom.script.querySelector(`[data-command-target="${index}"]`);
    const selectionKey = `${index}:${command.raw}`;
    const namedTarget = command.targetName
      ? campaign.characters.find((record) => characterName(record).toLowerCase() === command.targetName.toLowerCase())?.id
      : "";
    const selectedId = select?.value || scriptTargetSelections.get(selectionKey) || namedTarget;
    if (selectedId) {
      scriptTargetSelections.set(selectionKey, selectedId);
      targets = [selectedId];
    }
  }
  if (!targets.length) {
    showMessage(dom.message, "Choose a target character for that command.", "error");
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
    renderScriptEditor(scriptSource());
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.promptTargets.addEventListener("change", (event) => {
  const input = event.target.closest("[data-target-id]");
  if (!input) return;
  targetSelectionTouched = true;
  if (input.checked) selectedTargets.add(input.dataset.targetId);
  else selectedTargets.delete(input.dataset.targetId);
  syncSelectedTargets();
});
dom.selectAllTargets.addEventListener("click", () => { targetSelectionTouched = true; selectedTargets = new Set(campaign.characters.map((record) => record.id)); renderTargets(); });
dom.selectConnectedTargets.addEventListener("click", () => { targetSelectionTouched = true; selectedTargets = new Set(campaign.characters.filter((record) => record.connected).map((record) => record.id)); renderTargets(); });
dom.clearTargets.addEventListener("click", () => { targetSelectionTouched = true; selectedTargets.clear(); renderTargets(); });

dom.inboxList.addEventListener("click", async (event) => {
  const decisionButton = event.target.closest("[data-join-decision]");
  const requestCard = decisionButton?.closest("[data-join-request]");
  if (decisionButton && requestCard) {
    const decision = decisionButton.dataset.joinDecision;
    if (decision === "reject" && !confirm("Reject this character's campaign request?")) return;
    try {
      const payload = await api("/api/campaign/join/respond", {
        code,
        token,
        requestId: requestCard.dataset.joinRequest,
        decision,
      });
      if (payload.campaign) receiveCampaign(payload.campaign);
      showMessage(dom.message, decision === "approve" ? "Character approved and linked to the campaign." : "Character request rejected.", "success");
    } catch (error) {
      showMessage(dom.message, error.message, "error");
    }
    return;
  }
  const note = event.target.closest("[data-gm-note]");
  if (!note) return;
  try {
    await api("/api/campaign/note/gm-read", { code, token, noteId: note.dataset.gmNote });
    note.classList.remove("unread");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.characterList.addEventListener("click", (event) => {
  const classAction = event.target.closest("[data-class-action]");
  if (classAction) {
    classAction.disabled = true;
    api("/api/campaign/class-action", {
      code,
      token,
      characterId: classAction.dataset.characterId,
      action: classAction.dataset.classAction,
    }).then((payload) => {
      receiveCampaign(payload.campaign);
      showMessage(dom.message, payload.message, "success");
    }).catch((error) => {
      classAction.disabled = false;
      showMessage(dom.message, error.message, "error");
    });
    return;
  }
  const button = event.target.closest("[data-view-sheet]");
  if (!button) return;
  const record = campaign.characters.find((entry) => entry.id === button.dataset.viewSheet);
  if (!record) return;
  dom.sheetViewerTitle.textContent = `${characterName(record)} - GM View`;
  dom.sheetFrame.src = `character.html?campaign=${encodeURIComponent(code)}&character=${encodeURIComponent(record.id)}&gm=1&embedded=1`;
  dom.sheetViewer.hidden = false;
  dom.characterList.hidden = true;
  dom.sheetViewer.scrollIntoView({ behavior: "smooth", block: "start" });
});

dom.closeSheetViewer.addEventListener("click", () => {
  dom.sheetViewer.hidden = true;
  dom.sheetFrame.removeAttribute("src");
  dom.characterList.hidden = false;
});

dom.endSession.addEventListener("click", async () => {
  const sessionNumber = campaign.sessionNumber || 1;
  if (!confirm(`End Session ${sessionNumber}, reset session abilities, and notify every player?`)) return;
  dom.endSession.disabled = true;
  try {
    const payload = await api("/api/campaign/session/end", { code, token });
    receiveCampaign(payload.campaign);
    showMessage(dom.message, `Session ${payload.sessionEnded} ended. Player abilities and counters were reset.`, "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.endSession.disabled = false;
  }
});

dom.kickCharacterButton.addEventListener("click", async () => {
  const characterId = dom.kickCharacter.value;
  const record = campaign.characters.find((entry) => entry.id === characterId);
  if (!record || !confirm(`Kick ${characterName(record)} from this campaign?`)) return;
  try {
    const payload = await api("/api/campaign/character/kick", { code, token, characterId });
    receiveCampaign(payload.campaign);
    showMessage(dom.message, `${characterName(record)} was removed from the campaign.`, "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.adjustCharacterButton.addEventListener("click", () => {
  const characterId = dom.adjustCharacter.value;
  if (!characterId) return;
  window.location.href = `character.html?campaign=${encodeURIComponent(code)}&character=${encodeURIComponent(characterId)}&gm=1`;
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
  showMessage(dom.awardMessage, "Delivering award...");
  const resource = dom.awardResource.value;
  const targetIds = resource === "shipCredits" ? [] : [...selectedTargets];
  if (resource !== "shipCredits" && !targetIds.length) {
    showMessage(dom.awardMessage, "Choose at least one recipient above.", "error");
    return;
  }
  try {
    const androidTargets = resource === "credits" && Number(dom.awardAmount.value) > 0
      ? selectedRecords().filter((record) => record.character?.identity?.raceId === "android")
      : [];
    const convertAndroid = androidTargets.length
      ? confirm(`Convert this Credit award into Experience for ${androidTargets.map(characterName).join(", ")} at 75 Credits per XP?`)
      : false;
    const payload = await api("/api/campaign/award", {
      code,
      token,
      resource,
      amount: dom.awardAmount.value,
      targetIds,
      androidExperienceIds: convertAndroid ? androidTargets.map((record) => record.id) : [],
    });
    receiveCampaign(payload.campaign);
    const amount = Number(dom.awardAmount.value).toLocaleString();
    const recipients = resource === "shipCredits" ? "Ship Credit Pool" : selectedRecords().map(characterName).join(", ");
    showMessage(dom.awardMessage, `${amount} ${dom.awardResource.selectedOptions[0].text} delivered to ${recipients}.`, "success");
  } catch (error) {
    showMessage(dom.awardMessage, error.message, "error");
  }
});
dom.undoAward.addEventListener("click", async () => {
  if (!confirm("Undo the most recent campaign award?")) return;
  try {
    const payload = await api("/api/campaign/award/undo", { code, token });
    receiveCampaign(payload.campaign);
    showMessage(dom.awardMessage, "The most recent award was undone.", "success");
  } catch (error) {
    showMessage(dom.awardMessage, error.message, "error");
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
dom.resumeEncounter.addEventListener("click", resumeEncounterWithFreshCharacters);
dom.exitEncounter.addEventListener("click", exitCampaignEncounter);
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
  const gmCode = prompt("Enter the GM Code to permanently delete this campaign:");
  if (gmCode === null) return;
  if (!confirm("Permanently delete this campaign, its script, notes, and encounter? Player characters will be unlinked and preserved on their devices.")) return;
  try {
    await api("/api/campaign/delete", { code, token, campaignName: typedName, gmCode });
    localStorage.removeItem(tokenKey(code));
    localStorage.removeItem("sa-current-campaign-code");
    clearAtbBrowserIdentity();
    location.href = "index.html";
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

populateRulesControls();
renderScriptEditor("");
const initialCode = new URLSearchParams(location.search).get("campaign")?.toUpperCase() || localStorage.getItem("sa-current-campaign-code") || "";
if (initialCode) {
  const savedToken = localStorage.getItem(tokenKey(initialCode)) || "";
  if (savedToken) {
    dom.code.value = initialCode;
    code = initialCode;
    token = savedToken;
    refreshCampaign().then(() => {
      if (campaign?.role === "gm") openWorkspace(campaign, token);
    }).catch(() => {});
  }
}
