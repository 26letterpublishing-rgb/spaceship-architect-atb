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

// Contextual help stays in the Explore shell, including nested ship/ATB frames.
(function contextualTutorial(){
 const topics=[
  [/script|story|quick prompt|prompt.*give/i,'GM Prompts',['Choose the PCs who should receive the roll, then select the attribute, skill and difficulty. Sending a request notifies the player; their submitted result returns to the GM.','Quick Prompts save common checks and their most recently chosen difficulty. Everyone sends the request to all PCs.']],
  [/inbox|message|notification/i,'Messages',['Review incoming roll requests and campaign notifications here. Finish a requested roll through the standard dice interface so its result is sent back to the GM.']],
  [/prepare|starting.*position|crew deployment/i,'Prepare Combat',['Choose ships and crew. Each character participates aboard only one selected ship.','Drag ships to arrange starting distances. Sensor rings preview detection reach. Confirm crew positions before engaging the clock.']],
  [/combat/i,'Combat',['ATB advances while the clock runs. When your character is ready, choose an action or Hold. Dice requests pause the clock.','Move to a station and open Console View for its controls. Combat View returns to the shared map and activity log.']],
  [/starship|construction|upgrade/i,'Starships',['Select a ship to inspect its rooms, crew and capabilities. Move your character to a station to use its console.','Upgrade Ship opens construction. Purchases and layout changes need confirmation; Cancel Upgrade discards unfinished changes.']],
  [/blueprint|printer|fabricat/i,'Fabrication',['Blueprints unlock SIC recipes for this ship. A printer accepts six jobs including the active job.','Minerals are consumed when a job starts. Printing follows campaign time; the completed SIC goes into ship storage.']],
  [/sic|purchase|core.*propulsion/i,'SIC Cards',['Open a category, then select a card to read its rules. Scroll over an enlarged card to zoom.','Buy Blueprint is separate from buying the SIC. Installed SICs offer placement and storage options.']],
  [/campaign|private notes|crew log/i,'Campaign',['Review shared PC ships, private messages and crew records here. Character imports require GM approval, and the GM assigns ship crew.']],
  [/settings/i,'Settings',['Manage tutorial prompts, sound and campaign preferences here. The GM also manages characters, imports and campaign saves.']],
  [/character|attribute|skill|equipment|inventory|advancement|reverence|background/i,'Character Sheet',['Attributes and skills can be selected to roll using the standard dice interface. Equipment and notes remain available for reference.','The thin right sidebar gives quick access to your sheet while you use other screens.']],
  [/hacking|hack sic/i,'Hacking',['Choose an available enemy SIC and work through its code. Repeated letter guesses are permitted even when the secret code has no repeats.','A successful connected hack exposes that system’s permitted controls. Captured systems spend the enemy ship’s resources. Disconnecting or losing access ends remote control.']],
  [/shield|reinforce|restabilize/i,'Shields',['The large HP reading shows the ship’s remaining shields and maximum. Each installed shield has its own three-segment group.','Hits strike the lowest-HP active layer first. Damage beyond that layer’s HP is discarded. Maintenance, recovery and AU spending apply to the selected system.']],
  [/sensor|scan area|scan hex|life scan|systems analysis/i,'Sensors',['Scan Area searches your sensor range; Scan Hex investigates a chosen location. Results depend on your roll and the target’s Masking.','Reports appear in Combat Activity. Hover named objects in a report to highlight them on the map. Undetected objects do not expand a player’s Fit Contacts view.']],
  [/transporter/i,'Transporter',['Transporter range is eight space units. Place passengers at its stations, select the destination and satisfy the boarding requirements shown in the console.','Transport follows active encounter time. Intruders remain hidden from the defenders until detected by shared room visibility or their ship’s security cameras.']],
  [/weapon|laser|cannon|missile|mine launcher|fire control/i,'Weapons',['Choose a detected target and review the weapon’s AU cost, range and lock requirements. Use the standard dice prompt when an accuracy or damage roll is requested.','Missiles load from ship storage; reloading requires the launcher station. Mines remain on their launch hex and do not trigger for their own launching ship.']],
  [/planetary|cleanser/i,'Planetary Cleanser',['Choose a target inside sensor range. Charging fixes the aim on that hex even if the target moves away.','When charged, complete Roll Damage first. The sound and firing spectacle follow the result; shields still absorb an entire hit without overflow to Hull.']],
  [/console|helm|shield|sensor|weapon|hacking|transporter/i,'Station Consoles',['Consoles operate the station your character occupies, or systems accessible from a Bridge. Your turn and available AU determine which commands are ready.','SIC Maintenance is inside the console. A powered-off system can be inspected and turned on locally, but cannot perform its normal actions.']],
  [/enlarge|map|navigation/i,'Maps',['Click a destination to select it, then confirm your move. Zoom and Fit controls help you frame the action.','Enlarge Map preserves the current task. Drag the enlarged starmap to pan, then return without losing your selection.']],
  [/gm|nova|orion/i,'Explore Perspectives',['Switch between the GM and either PC to test both sides. These sample characters and ships are separate from your personal campaigns.']]
 ];
 let popup=null,lastKey='',lastAt=0;
 function show(title,pages){
  if(localStorage.getItem('sa-tutorial')!=='on')return;
  if(title===lastKey&&Date.now()-lastAt<600)return;lastKey=title;lastAt=Date.now();popup?.remove();
  document.querySelectorAll('.v03-tutorial:not(#v03ImportNotice)').forEach(e=>e.remove());
  const d=document.createElement('dialog');popup=d;d.className='explore-tutorial';d.style.cssText='position:fixed;inset:auto auto 18px 24px;margin:0;max-width:calc(100vw - 48px);width:380px;background:#14313f;color:#fff;border:1px solid #e8d268;padding:18px;box-sizing:border-box;font:16px/1.35 Arial,sans-serif;z-index:2147483646';
  const heading=document.createElement('h2'),text=document.createElement('p'),row=document.createElement('div'),back=document.createElement('button'),next=document.createElement('button'),ok=document.createElement('button'),count=document.createElement('span'),label=document.createElement('label'),box=document.createElement('input');
  heading.textContent=title;back.textContent='Previous';next.textContent='Next';ok.textContent='Okay';box.type='checkbox';label.append(box,' Disable Tutorial Popups');label.style.cssText='display:block;font-size:12px;margin-top:18px';row.style.cssText='display:flex;gap:12px;align-items:center';
  heading.style.cssText='font:bold 16px Arial;margin:0 0 16px';text.style.whiteSpace='pre-line';for(const b of [back,next,ok])b.style.cssText='background:#d9eaf1;color:#183747;border:1px solid #799aa8;padding:7px 12px';
  let page=0;const render=()=>{text.textContent=pages[page];count.textContent=`Page ${page+1} of ${pages.length}`;back.disabled=page===0;next.disabled=page===pages.length-1;row.hidden=pages.length===1;};
  back.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};ok.onclick=()=>{if(box.checked)localStorage.setItem('sa-tutorial','off');d.close();};d.onclose=()=>{d.remove();if(popup===d)popup=null;};row.append(back,count,next);d.append(heading,text,row,label,ok);document.body.append(d);const original=[...pages];pages=[original.join('\n\n')];render();d.showModal();for(const width of [440,520,620]){if(d.offsetWidth*d.scrollHeight<=innerWidth*innerHeight*.25&&d.scrollHeight<=innerHeight*.75)break;d.style.width=Math.min(width,innerWidth-48)+'px';}if(d.offsetWidth*d.scrollHeight>innerWidth*innerHeight*.25||d.scrollHeight>innerHeight*.75){pages=original;render();}d.style.maxHeight='75vh';d.style.overflow='auto';
 }
 const bound=new WeakSet();
 function bind(doc){if(!doc||bound.has(doc))return;bound.add(doc);
  doc.addEventListener('click',e=>{const target=e.target.closest('button,a,[role=tab],summary');if(!target||target.closest('.explore-tutorial'))return;const label=(target.getAttribute('aria-label')||target.textContent||'').trim();const topic=topics.find(t=>t[0].test(label));if(topic)setTimeout(()=>show(topic[1],topic[2]),120);});
  doc.addEventListener('change',e=>{if(!e.target.matches('.station-console-select'))return;const text=e.target.selectedOptions[0]?.textContent||'';const topic=topics.find(t=>t[0].test(text));if(topic)setTimeout(()=>show(topic[1],topic[2]),120);});
  const frames=()=>{for(const iframe of doc.querySelectorAll('iframe')){if(!iframe.dataset.tutorialBound){iframe.dataset.tutorialBound='1';iframe.addEventListener('load',()=>{try{bind(iframe.contentDocument);}catch{}});}try{bind(iframe.contentDocument);}catch{}}};frames();new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('iframe')||n.querySelector('iframe')))))frames();}).observe(doc.body,{childList:true,subtree:true});
 }
 bind(document);
}());
