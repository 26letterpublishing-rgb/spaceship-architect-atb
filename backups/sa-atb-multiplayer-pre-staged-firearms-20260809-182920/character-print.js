function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filled(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return escapeHtml(text || fallback);
}

function splitColumns(items, count = 3) {
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function trackerSlots(count, className, inner = "") {
  return Array.from({ length: Math.max(0, Number(count) || 0) }, () => `<span class="${className}">${inner}</span>`).join("");
}

export function buildPrintableCharacterSheet(data) {
  const identity = data.identity || {};
  const crew = [...(data.crew || [])].filter((member) => member.name || member.title);
  while (crew.length < 3) crew.push({ name: "", title: "" });
  const skillColumns = splitColumns(data.skills || [], 3);
  const modifierLength = (data.modifiers || []).flatMap((group) => group.entries || []).join(" ").length;
  const modifierDensity = modifierLength > 1200 ? "dense-3" : modifierLength > 760 ? "dense-2" : "";
  const safeTitle = filled(identity.characterName, "Unnamed Character");
  const attributes = (data.attributes || []).map((attribute) => `
    <article class="attribute-card">
      <strong>${filled(attribute.name)}</strong>
      <div class="attribute-dice">${(attribute.dice || []).map((die) => `<span>${filled(die)}</span>`).join("") || "<em>No dice</em>"}</div>
    </article>`).join("");
  const modifiers = (data.modifiers || []).map((group) => `
    <section class="modifier-group">
      <strong>${filled(group.title)}</strong>
      <ul>${(group.entries || []).map((entry) => `<li>${filled(entry)}</li>`).join("")}</ul>
    </section>`).join("") || '<p class="empty-copy">No listed advantages or disadvantages.</p>';
  const skills = skillColumns.map((column) => `<div class="skill-column">${column.map((skill) => `
    <div class="skill-row ${skill.bold ? "bold-skill" : ""}"><span class="skill-group">${filled(String(skill.group || "").slice(0, 1))}</span><span>${filled(skill.name)}</span><strong>${filled(skill.value, "0.0")}</strong></div>`).join("")}</div>`).join("");
  const crewRows = crew.slice(0, 7).map((member) => `<div class="crew-row"><span>${filled(member.name, "")}</span><span>${filled(member.title, "")}</span></div>`).join("");
  const exertionMax = Math.max(0, Number(data.resources?.exertionMax) || 0);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle} - Spaceship Architect Character Sheet</title>
  <style>
    @page { size:Letter landscape; margin:.25in; }
    * { box-sizing:border-box; }
    :root { color-scheme:light; }
    html,body { margin:0; padding:0; color:#111; background:#777; font-family:Arial,Helvetica,sans-serif; }
    body { padding:20px; }
    .print-toolbar { width:10.5in; margin:0 auto 12px; display:flex; justify-content:flex-end; gap:8px; }
    .print-toolbar button { min-height:38px; padding:0 18px; border:1px solid #222; border-radius:999px; color:#fff; background:linear-gradient(#4d4d4d,#111); font-weight:800; cursor:pointer; }
    .sheet { width:10.5in; height:8in; margin:auto; padding:.12in; overflow:hidden; display:grid; grid-template-rows:.68in 1.42in minmax(0,1fr) .2in; gap:.07in; background:#f6f6f4; box-shadow:0 8px 34px rgba(0,0,0,.45); }
    .halftone { background-color:#e5e5e3; background-image:radial-gradient(#8b8b8b .45px,transparent .55px); background-size:4px 4px; }
    .sheet-header { display:grid; grid-template-columns:1.58in minmax(0,1fr) 2.34in; align-items:stretch; overflow:hidden; border:2px solid #111; background:linear-gradient(110deg,#101010 0 26%,#555 26% 27%,#ededeb 27% 100%); }
    .edition { padding:.08in .12in; display:grid; align-content:center; color:#fff; }
    .edition strong { font-size:13.5pt; letter-spacing:.055em; line-height:.92; }
    .edition span { margin-top:4px; font-size:5.2pt; line-height:1.15; letter-spacing:.1em; }
    .character-title { min-width:0; padding:.06in .14in; display:grid; align-content:center; border-left:1px solid #777; }
    .character-title span { color:#555; font-size:6pt; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
    .character-title h1 { overflow:hidden; margin:1px 0 0; font-size:16pt; line-height:1.05; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
    .header-meta { min-width:0; padding:.045in .09in; display:grid; grid-template-columns:.68in minmax(0,1fr); gap:2px 6px; align-content:center; border-left:1px solid #777; font-size:5.8pt; }
    .header-meta span { color:#555; font-weight:800; text-transform:uppercase; }
    .header-meta strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .top-grid { display:grid; grid-template-columns:3.45fr 2.75fr 3.8fr; gap:.06in; min-height:0; }
    .panel { min-width:0; overflow:hidden; border:1.4px solid #222; background:#fafafa; }
    .panel-title { min-height:.2in; padding:3px 7px; display:flex; align-items:center; justify-content:space-between; color:#fff; background:linear-gradient(180deg,#555,#1d1d1d); font-size:7pt; font-weight:950; letter-spacing:.1em; text-transform:uppercase; }
    .identity-grid { height:calc(100% - .2in); padding:5px 6px; display:grid; grid-template-columns:repeat(4,1fr); gap:3px 6px; }
    .field { min-width:0; border-bottom:1px solid #777; }
    .field.wide { grid-column:span 2; }
    .field.description { grid-column:1 / -1; }
    .field label { display:block; color:#666; font-size:4.8pt; font-weight:900; text-transform:uppercase; }
    .field strong { display:block; overflow:hidden; font-size:7pt; line-height:1.15; text-overflow:ellipsis; white-space:nowrap; }
    .field.description strong { white-space:normal; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
    .vital-grid { height:calc(100% - .2in); display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:1fr 1fr; }
    .vital { padding:4px; display:grid; align-content:center; text-align:center; border-right:1px solid #999; border-bottom:1px solid #999; }
    .vital:nth-child(3n) { border-right:0; }
    .vital:nth-child(n+4) { border-bottom:0; }
    .vital span { color:#666; font-size:4.7pt; font-weight:900; text-transform:uppercase; }
    .vital strong { font-size:12pt; }
    .vital.current-hp strong { min-height:16px; border-bottom:1.5px solid #111; }
    .tracker-layout { height:calc(100% - .2in); padding:5px; display:grid; grid-template-columns:1.25fr 1fr; gap:6px; }
    .trackers { display:grid; align-content:start; gap:4px; }
    .tracker-label { display:flex; justify-content:space-between; color:#555; font-size:5pt; font-weight:900; text-transform:uppercase; }
    .exertion-track { display:flex; gap:4px; align-items:end; }
    .exertion-slot { width:27px; display:grid; gap:3px; }
    .exertion-slot::before { content:""; height:12px; border:1.4px solid #111; border-radius:8px; background:#fff; }
    .exertion-slot::after { content:""; height:3px; background:#1b1b1b; }
    .reverence-track { display:flex; gap:3px; }
    .reverence-track span { width:8px; height:22px; border:1.2px solid #111; background:#fff; }
    .resource-line { display:grid; grid-template-columns:1fr auto; align-items:end; border-bottom:1px solid #777; font-size:6pt; }
    .crew-mini { min-width:0; display:grid; grid-template-rows:auto 1fr; border-left:1px solid #aaa; padding-left:5px; }
    .crew-mini h3 { margin:0 0 3px; font-size:5.5pt; text-transform:uppercase; }
    .crew-row { min-height:13px; display:grid; grid-template-columns:1fr 1fr; border-top:1px solid #aaa; font-size:5.7pt; }
    .crew-row span { overflow:hidden; padding:2px 3px; border-right:1px solid #aaa; text-overflow:ellipsis; white-space:nowrap; }
    .body-grid { min-height:0; display:grid; grid-template-columns:1.04fr .96fr; gap:.06in; }
    .left-stack { min-height:0; display:grid; grid-template-rows:2.33in minmax(0,1fr); gap:.06in; }
    .attributes-panel { display:grid; grid-template-rows:.2in 1fr; }
    .attributes-grid { padding:5px; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:repeat(4,1fr); gap:4px; }
    .attribute-card { min-width:0; display:grid; grid-template-columns:.88in 1fr; align-items:center; border:1px solid #777; background:linear-gradient(90deg,#d4d4d1,#fafafa); }
    .attribute-card > strong { height:100%; padding:4px 5px; display:grid; align-items:center; border-right:1px solid #999; font-size:6.5pt; text-transform:uppercase; }
    .attribute-dice { padding:2px 4px; display:flex; gap:4px; align-items:center; }
    .attribute-dice span { min-width:30px; height:24px; display:grid; place-items:center; border:1.3px solid #222; clip-path:polygon(50% 0,94% 22%,100% 72%,72% 100%,28% 100%,0 72%,6% 22%); background:linear-gradient(145deg,#fff,#bbb); font-size:6.6pt; font-weight:950; }
    .attribute-dice em { color:#777; font-size:6pt; }
    .modifiers-panel { display:grid; grid-template-rows:.2in 1fr; }
    .modifier-content { min-height:0; padding:5px 7px; overflow:hidden; column-count:2; column-gap:14px; font-size:6pt; line-height:1.22; }
    .modifier-content.dense-2 { font-size:5.3pt; }
    .modifier-content.dense-3 { column-count:3; font-size:4.8pt; }
    .modifier-group { break-inside:avoid; margin-bottom:5px; }
    .modifier-group > strong { display:block; padding-bottom:1px; border-bottom:1px solid #777; text-transform:uppercase; }
    .modifier-group ul { margin:2px 0 0; padding-left:12px; }
    .modifier-group li { margin-bottom:2px; }
    .skills-panel { min-height:0; display:grid; grid-template-rows:.2in 1fr; }
    .skill-columns { min-height:0; padding:4px; display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
    .skill-column { min-width:0; display:grid; align-content:start; }
    .skill-row { min-height:16px; display:grid; grid-template-columns:12px minmax(0,1fr) 28px; align-items:center; border-bottom:1px dotted #888; font-size:5.65pt; }
    .skill-row > span:nth-child(2) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .skill-row strong { font-size:6.5pt; text-align:right; }
    .skill-row.bold-skill > span:nth-child(2), .skill-row.bold-skill strong { font-weight:950; }
    .skill-row.bold-skill > span:nth-child(2) { text-decoration:underline; text-decoration-thickness:.7px; text-underline-offset:1px; }
    .skill-group { width:10px; height:10px; display:grid; place-items:center; color:#fff; background:#555; font-size:4.5pt; font-weight:900; }
    .sheet-footer { display:flex; align-items:center; justify-content:space-between; color:#555; border-top:1px solid #777; font-size:5pt; }
    .empty-copy { color:#777; font-style:italic; }
    @media print {
      html,body { width:10.5in; height:8in; background:#fff; }
      body { padding:0; }
      .print-toolbar { display:none; }
      .sheet { margin:0; box-shadow:none; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    }
    @media screen and (max-width:900px) {
      body { min-width:10.75in; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  <main class="sheet">
    <header class="sheet-header">
      <div class="edition"><strong>SPACESHIP<br>ARCHITECT</strong><span>SECOND EDITION CHARACTER RECORD</span></div>
      <div class="character-title"><span>Character</span><h1>${safeTitle}</h1></div>
      <div class="header-meta halftone"><span>Player</span><strong>${filled(identity.playerName)}</strong><span>Campaign</span><strong>${filled(data.campaign)}</strong><span>Room</span><strong>${filled(data.roomCode)}</strong><span>FUBS</span><strong>${filled(data.fubs)}</strong></div>
    </header>

    <section class="top-grid">
      <section class="panel">
        <div class="panel-title"><span>Identity</span></div>
        <div class="identity-grid">
          <div class="field wide"><label>Race</label><strong>${filled(identity.race)}</strong></div>
          <div class="field wide"><label>Class</label><strong>${filled(identity.className)}</strong></div>
          <div class="field wide"><label>Home Planet</label><strong>${filled(identity.homePlanet)}</strong></div>
          <div class="field"><label>Sex / Gender</label><strong>${filled(identity.sex)}</strong></div>
          <div class="field"><label>Age</label><strong>${filled(identity.age)}</strong></div>
          <div class="field"><label>Height</label><strong>${filled(identity.height)}</strong></div>
          <div class="field"><label>Weight</label><strong>${filled(identity.weight)}</strong></div>
          <div class="field"><label>Hair</label><strong>${filled(identity.hair)}</strong></div>
          <div class="field"><label>Eyes</label><strong>${filled(identity.eyes)}</strong></div>
          <div class="field description"><label>Physical Description</label><strong>${filled(identity.description)}</strong></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><span>Timing &amp; Health</span></div>
        <div class="vital-grid">
          <div class="vital"><span>Speed</span><strong>${filled(data.stats?.speed)}</strong></div>
          <div class="vital"><span>Command</span><strong>${filled(data.stats?.command)}</strong></div>
          <div class="vital"><span>Move Speed</span><strong>${filled(data.stats?.moveSpeed)}</strong></div>
          <div class="vital current-hp"><span>Current HP</span><strong></strong></div>
          <div class="vital"><span>Maximum HP</span><strong>${filled(data.stats?.maximumHp)}</strong></div>
          <div class="vital"><span>Damage Reduction</span><strong>${filled(data.stats?.damageReduction)}</strong></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><span>Session Resources</span><small>Manual tracking</small></div>
        <div class="tracker-layout">
          <div class="trackers">
            <div class="tracker-label"><span>Exertion</span><span>Maximum ${exertionMax}</span></div>
            <div class="exertion-track">${trackerSlots(exertionMax, "exertion-slot")}</div>
            <div class="tracker-label"><span>Reverence</span><span>Digital ${filled(data.resources?.reverence, "0")}/10</span></div>
            <div class="reverence-track">${trackerSlots(10, "reverence-slot")}</div>
            <div class="resource-line"><span>Experience</span><strong>${filled(data.experience?.available, "0")} / ${filled(data.experience?.totalGained, "0")}</strong></div>
            <div class="resource-line"><span>Credits</span><strong>${Number(data.resources?.credits || 0).toLocaleString()}</strong></div>
            <div class="resource-line"><span>Drama Cards</span><strong>${filled(data.resources?.dramaCards, "0")}</strong></div>
          </div>
          <div class="crew-mini"><h3>Crew Roster</h3><div>${crewRows}</div></div>
        </div>
      </section>
    </section>

    <section class="body-grid">
      <div class="left-stack">
        <section class="panel attributes-panel"><div class="panel-title"><span>Attributes</span><small>Current dice</small></div><div class="attributes-grid">${attributes}</div></section>
        <section class="panel modifiers-panel"><div class="panel-title"><span>Advantages / Disadvantages</span></div><div class="modifier-content ${modifierDensity}">${modifiers}</div></section>
      </div>
      <section class="panel skills-panel"><div class="panel-title"><span>Skills</span><small>S Spacecraft / G General / C Custom</small></div><div class="skill-columns">${skills}</div></section>
    </section>

    <footer class="sheet-footer"><span>SPACESHIP ARCHITECT SECOND EDITION</span><span>Printed ${new Date().toLocaleDateString()}</span></footer>
  </main>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.focus(); window.print(); }, 450); });<\/script>
</body>
</html>`;
}

export function openPrintableCharacterSheet(data) {
  const preview = window.open("", "_blank");
  if (!preview) {
    window.alert("The printable sheet was blocked. Allow pop-ups for this site and press Print Character Sheet again.");
    return false;
  }
  preview.document.open();
  preview.document.write(buildPrintableCharacterSheet(data));
  preview.document.close();
  return true;
}
