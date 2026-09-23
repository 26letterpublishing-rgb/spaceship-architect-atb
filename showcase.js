const statusNode = document.querySelector("#showcaseStatus");
const frame = document.querySelector("#showcaseFrame");
const perspectives = document.querySelector("#showcasePerspectives");
const resetButton = document.querySelector("#resetShowcase");
const backButton = document.querySelector("#showcaseBack");
let room = null;
const roomSessionKey = 'sa-explore-room';

function clearShowcaseSession() {
  sessionStorage.removeItem(roomSessionKey);
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
  if(frame.getAttribute('src')===source)return;
  frame.hidden = false;
  statusNode.hidden = true;
  frame.src = source;
  sessionStorage.setItem(roomSessionKey, JSON.stringify({ ...room, perspective: isGm ? 'gm' : player.id }));
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
  const practice=document.createElement('a');practice.href='hacking-practice.html';practice.target='_blank';practice.rel='noopener';practice.className='hacking-practice-link';practice.textContent='Hacking Practice';perspectives.append(practice);
}

async function startShowcase(reset = false) {
  if (resetButton.disabled) return;
  resetButton.disabled = true;
  frame.hidden = true;
  frame.removeAttribute("src");
  statusNode.hidden = false;
  statusNode.classList.remove("error");
  statusNode.textContent = "Preparing Explore Features...";
  try {
    let saved = null;
    if (!reset) { try { saved = JSON.parse(sessionStorage.getItem(roomSessionKey) || 'null'); } catch {} }
    if (saved?.code && saved?.gmToken && Array.isArray(saved.players)) {
      const response = await fetch(`/api/campaign/state?code=${encodeURIComponent(saved.code)}&token=${encodeURIComponent(saved.gmToken)}`);
      if (response.ok) {
        const state = await response.json();
        if (state.role === 'gm') room = saved;
      } else if (![401,403,404].includes(response.status)) throw new Error('The playtest room is temporarily unavailable. Reload to retry.');
    }
    if (reset || !room) {
      const response = await fetch("/api/campaign/showcase/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The playtest room could not be created.");
      clearShowcaseSession();
      room = payload;
    }
    sessionStorage.setItem(`sa-gm-token-${room.code}`, room.gmToken);
    room.players.forEach((player) => sessionStorage.setItem(`sa-character-token-${room.code}-${player.id}`, player.token));
    renderPerspectives();
    const player = room.players.find(player => player.id === room.perspective);
    showPerspective(player ? 'player' : 'gm', player);
  } catch (error) {
    statusNode.classList.add("error");
    statusNode.textContent = `${error.message} Press Reset Room to try again.`;
  } finally {
    resetButton.disabled = false;
  }
}

resetButton.addEventListener("click", () => startShowcase(true));
backButton.addEventListener("click", (event) => { event.preventDefault(); leaveShowcase(); });
frame.addEventListener("load", () => {
  try {
    if (new URL(frame.contentWindow.location.href).pathname.endsWith("/index.html")) leaveShowcase();
  } catch {}
});
startShowcase();
