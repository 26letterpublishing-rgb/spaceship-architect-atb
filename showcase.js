const statusNode = document.querySelector("#showcaseStatus");
const frame = document.querySelector("#showcaseFrame");
const perspectives = document.querySelector("#showcasePerspectives");
const resetButton = document.querySelector("#resetShowcase");
const backButton = document.querySelector("#showcaseBack");
let room = null;

function clearShowcaseSession() {
  if (!room) return;
  sessionStorage.removeItem(`sa-gm-token-${room.code}`);
  room.players?.forEach((player) => sessionStorage.removeItem(`sa-character-token-${room.code}-${player.id}`));
}

function leaveShowcase() {
  clearShowcaseSession();
  window.top.location.href = "index.html";
}

function showPerspective(kind, player = null) {
  if (!room) return;
  const isGm = kind === "gm";
  const source = isGm
    ? `gm.html?campaign=${encodeURIComponent(room.code)}&showcase=1`
    : `character.html?campaign=${encodeURIComponent(room.code)}&character=${encodeURIComponent(player.id)}&showcase=1`;
  frame.hidden = false;
  statusNode.hidden = true;
  frame.src = source;
  perspectives.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.perspective === (isGm ? "gm" : player.id)));
}

function renderPerspectives() {
  perspectives.replaceChildren();
  const gm = document.createElement("button");
  gm.type = "button";
  gm.dataset.perspective = "gm";
  gm.textContent = "GM";
  gm.addEventListener("click", () => showPerspective("gm"));
  perspectives.append(gm);
  room.players.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.perspective = player.id;
    button.textContent = player.name;
    button.style.borderColor = player.color;
    button.addEventListener("click", () => showPerspective("player", player));
    perspectives.append(button);
  });
}

async function startShowcase() {
  resetButton.disabled = true;
  frame.hidden = true;
  frame.removeAttribute("src");
  statusNode.hidden = false;
  statusNode.classList.remove("error");
  statusNode.textContent = "Preparing a fresh encounter...";
  try {
    const response = await fetch("/api/campaign/showcase/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The playtest room could not be created.");
    room = payload;
    sessionStorage.setItem(`sa-gm-token-${room.code}`, room.gmToken);
    room.players.forEach((player) => sessionStorage.setItem(`sa-character-token-${room.code}-${player.id}`, player.token));
    renderPerspectives();
    showPerspective("gm");
  } catch (error) {
    statusNode.classList.add("error");
    statusNode.textContent = `${error.message} Press Reset Room to try again.`;
  } finally {
    resetButton.disabled = false;
  }
}

resetButton.addEventListener("click", startShowcase);
backButton.addEventListener("click", (event) => { event.preventDefault(); leaveShowcase(); });
frame.addEventListener("load", () => {
  try {
    if (new URL(frame.contentWindow.location.href).pathname.endsWith("/index.html")) leaveShowcase();
  } catch {}
});
startShowcase();
