import { ATTRIBUTE_DEFS, SPACECRAFT_SKILLS, GENERAL_SKILLS } from "./character-data.js?v=20260801-campaign-2";

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
  gatewayMessage: $("#gatewayMessage"),
  message: $("#gmMessage"),
  tabs: $(".gm-tabs"),
  script: $("#campaignScript"),
  scriptSaveState: $("#scriptSaveState"),
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
  storageMode: $("#storageMode"),
  deleteCampaign: $("#deleteCampaign"),
};

const allSkills = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
let campaign = null;
let code = "";
let token = "";
let events = null;
let scriptSaveTimer = null;
let scriptDirty = false;
let selectedTargets = new Set();
const executedCommands = new Set();

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

function renderScriptCommands() {
  const commands = scriptCommandList();
  dom.scriptCommands.innerHTML = commands.length ? commands.map((command) => {
    const needsSelection = ["choose", "target"].includes(command.scope) && (!command.targetName || command.scope === "choose");
    const options = campaign.characters.map((record) => `<option value="${record.id}" ${command.targetName.toLowerCase() === characterName(record).toLowerCase() ? "selected" : ""}>${escapeHtml(characterName(record))}${record.connected ? " | Connected" : " | Offline"}</option>`).join("");
    return `<article class="command-row ${command.valid ? "" : "invalid"}" data-command-index="${command.id.split("-").at(-1)}">
      <div><code>::${escapeHtml(command.raw)}::</code><div class="command-meta"><span>${escapeHtml(command.scope || "Invalid recipient")}</span><span>${escapeHtml(command.attribute || "Missing Attribute")}</span><span>${escapeHtml(command.skill || "Missing Skill")}</span><span>${command.difficulty === null ? "No Difficulty" : `Difficulty ${command.difficulty}`}</span></div>${needsSelection ? `<select data-command-target="${command.id}"><option value="">Choose Character</option>${options}</select>` : ""}</div>
      <button type="button" data-send-command="${command.id}" ${command.valid ? "" : "disabled"}>Send Roll Request</button>
    </article>`;
  }).join("") : "<p>No roll commands detected. Commands are enclosed by double colons.</p>";
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
}

function receiveCampaign(next) {
  campaign = next;
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
  dom.atbFrame.src = `index.html?embedded=gm&campaign=${encodeURIComponent(code)}`;
  renderCampaign();
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
});

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
  const index = Number(button.dataset.sendCommand.split("-").at(-1));
  const command = scriptCommandList()[index];
  if (!command?.valid) return;
  if (executedCommands.has(command.id) && !confirm("Send this roll request again?")) return;
  let targets = [];
  if (command.scope === "all") targets = campaign.characters.filter((record) => record.connected).map((record) => record.id);
  if (["choose", "target"].includes(command.scope)) {
    const select = dom.scriptCommands.querySelector(`[data-command-target="${command.id}"]`);
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
