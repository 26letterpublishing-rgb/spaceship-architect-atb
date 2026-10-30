// Existing tactical-ring presentation extracted without changing markup.
(function(root){
function geometry(escapeHtml){
function polarPoint(cx, cy, radius, degrees) {
  const radians = (degrees - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeWedge(cx, cy, radius, startAngle, endAngle) {
  if (radius <= 1) return `M ${cx} ${cy}`;
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function describeRingSideWall(cx, cy, radius, startAngle, endAngle, depth) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const startDrop = { x: start.x, y: start.y + depth };
  const endDrop = { x: end.x, y: end.y + depth };
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    `L ${endDrop.x.toFixed(2)} ${endDrop.y.toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 0 ${startDrop.x.toFixed(2)} ${startDrop.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function frontDepthForAngle(angle, depth = 38) {
  const normalized = (angle + 360) % 360;
  if (normalized < 88 || normalized > 272) return 0;
  const frontFactor = Math.sin(((normalized - 88) / 184) * Math.PI);
  return frontFactor <= 0.08 ? 0 : depth * (0.28 + frontFactor * 0.72);
}

function ringFrontSeamPath(angle, radius = 141, depth = 38) {
  const normalized = (angle + 360) % 360;
  const seamDepth = frontDepthForAngle(angle, depth);
  if (!seamDepth) return "";
  const top = polarPoint(160, 160, radius, normalized);
  const bottom = { x: top.x, y: top.y + seamDepth };
  return `<path class="ring-side-seam" d="M ${top.x.toFixed(2)} ${top.y.toFixed(2)} L ${bottom.x.toFixed(2)} ${bottom.y.toFixed(2)}" />`;
}

function ringFrontWallSegment(unit, startAngle, endAngle, rgb, radius = 141, depth = 38) {
  const segmentStart = Math.max(startAngle, 88);
  const segmentEnd = Math.min(endAngle, 272);
  if (segmentEnd <= segmentStart) return "";
  const color = unit.color || "#39e58f";
  const dark = `rgb(${Math.max(0, rgb.r - 78)}, ${Math.max(0, rgb.g - 78)}, ${Math.max(0, rgb.b - 78)})`;
  return `
    <path
      class="ring-side-wall-segment"
      d="${describeRingSideWall(160, 160, radius, segmentStart, segmentEnd, depth)}"
      style="--segment-color:${escapeHtml(color)}; --segment-dark:${dark}; --bar-rgb:${rgb.r}, ${rgb.g}, ${rgb.b};"
    />
  `;
}

function ringInnerLabel(unit, sliceCount) {
  const name = unit.characterName || "Character";
  const words = name.split(/\s+/).filter(Boolean);
  if (sliceCount >= 12) {
    return words
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  }
  if (sliceCount >= 9 && words.length > 2) return `${words[0]} ${words[words.length - 1]}`;
  if (sliceCount >= 9 && name.length > 14) return name.slice(0, 13).trim() + ".";
  return name;
}

function ringInnerLabelSize(label, sliceCount) {
  const base = sliceCount <= 6 ? 17 : sliceCount <= 8 ? 14 : sliceCount <= 10 ? 11.5 : 9.5;
  const lengthPenalty = Math.max(0, label.length - 9) * 0.55;
  return Math.max(6.8, base - lengthPenalty);
}


return {polarPoint,describeWedge,describeArc,describeRingSideWall,frontDepthForAngle,ringFrontSeamPath,ringFrontWallSegment,ringInnerLabel,ringInnerLabelSize};
}
function overlays(c){const {delayPercent,commandFor,commandPercent,queuedEffectsFor,queuedEffectPercent}=c;const {describeArc,describeWedge}=geometry(c.escapeHtml);
function ringDelayPocket(delay, startAngle, endAngle, radius, className) {
  if (!delay) return "";
  const gap = Math.min(5, Math.max(1.5, (endAngle - startAngle) * 0.08));
  const usableStart = startAngle + gap;
  const usableEnd = Math.max(usableStart + 0.1, endAngle - gap);
  const targetEnd = usableStart + (usableEnd - usableStart) * (delayPercent(delay) / 100);
  return `<path class="ring-delay-pocket ${className}" d="${describeArc(160, 160, radius, usableStart, targetEnd)}" />`;
}

function ringCommandDrain(unit, startAngle, endAngle) {
  const command = commandFor(unit);
  if (!command || command.unitId !== unit.id) return "";
  const remaining = command.expired ? 0 : commandPercent(command);
  const drainRadius = 18 + (118 * (100 - remaining)) / 100;
  if (drainRadius <= 20) return "";
  return `<path class="ring-command-drain" d="${describeWedge(160, 160, Math.min(136, drainRadius), startAngle, endAngle)}" />`;
}

function ringQueuedEffects(unit, startAngle, endAngle) {
  const effects = queuedEffectsFor(unit);
  if (!effects.length) return "";
  const width = Math.max(4, (endAngle - startAngle) * 0.22);
  return effects
    .map((effect, index) => {
      const miniStart = endAngle + 1.5 + index * (width + 1);
      const miniEnd = miniStart + width;
      const fillRadius = 18 + (116 * queuedEffectPercent(effect)) / 100;
      return `
        <g class="ring-queued-effect ${effect.resolving ? "resolving" : ""}">
          <path class="ring-queued-shell" d="${describeWedge(160, 160, 136, miniStart, miniEnd)}"></path>
          <path class="ring-queued-fill" d="${describeWedge(160, 160, Math.min(136, fillRadius), miniStart, miniEnd)}"></path>
        </g>
      `;
    })
    .join("");
}


return {ringDelayPocket,ringCommandDrain,ringQueuedEffects};
}
function render(c,units,groupId='',groupTitle='',readOnly=false){const {escapeHtml,coreLabel,mode,myUnitId,ringDrag,ringMovedId,readyCount,activeUnit,hexToRgb,pct,hasAnyDelay,myIconForUnit,delayedActionFor,delayTimerFor,ringActionButtons,isReady}=c;const {polarPoint,describeWedge,describeArc,describeRingSideWall,frontDepthForAngle,ringFrontSeamPath,ringFrontWallSegment,ringInnerLabel,ringInnerLabelSize}=geometry(escapeHtml);const {ringDelayPocket,ringCommandDrain,ringQueuedEffects}=c;

  if (!units.length) {
    return `
      <section class="tactical-ring-group" data-ring-group="${escapeHtml(groupId)}">
        ${groupTitle ? `<h3>${escapeHtml(groupTitle)}</h3>` : ""}
        <div class="tactical-ring-empty">
        <strong>No combatants loaded.</strong>
        <span>No combatants are currently aboard.</span>
        </div>
      </section>
    `;
  }

  const ordered = units;
  const slice = 360 / ordered.length;
  const gap = Math.min(2.2, slice * 0.08);
  const active = activeUnit();
  const defs = [];
  const slices = [];
  const controls = [];
  const actionButtons = [];
  const sideWalls = [];
  const sideSeams = [];

  ordered.forEach((unit, index) => {
    const start = index * slice + gap / 2;
    const end = (index + 1) * slice - gap / 2;
    const mid = start + (end - start) / 2;
    const rgb = hexToRgb(unit.color || "#39e58f");
    const gradId = `${readOnly ? 'helm' : ''}ringGrad${unit.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    const atbRadius = 18 + (116 * pct(unit)) / 100;
    const delayed = hasAnyDelay(unit);
    const ready = isReady(unit);
    const own = mode === "player" && unit.id === myUnitId;
    const icon = mode === "player" ? myIconForUnit(unit) : "";
    const labelPoint = polarPoint(160, 160, 83, mid);
    const allyPoint = polarPoint(160, 160, 112, mid);
    const label = ringInnerLabel(unit, ordered.length)+(unit.consoleHold?' [HOLD]':'');
    const labelSize = ringInnerLabelSize(label, ordered.length);

    defs.push(`
      <radialGradient id="${gradId}" cx="50%" cy="46%" r="70%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.36)" />
        <stop offset="22%" stop-color="rgba(${rgb.r},${rgb.g},${rgb.b},0.84)" />
        <stop offset="67%" stop-color="${escapeHtml(unit.color || "#39e58f")}" />
        <stop offset="100%" stop-color="rgba(${Math.max(0, rgb.r - 58)},${Math.max(0, rgb.g - 58)},${Math.max(0, rgb.b - 58)},0.96)" />
      </radialGradient>
    `);

    slices.push(`
      <g class="ring-unit ${ready ? "ready" : ""} ${delayed ? "delayed" : ""} ${unit.defeatedAt ? "combatant-defeated" : ""} ${own ? "own-ring-unit" : ""} ${active?.id === unit.id ? "active-ring-unit" : ""} ${ringDrag?.id === unit.id ? "dragging" : ""} ${ringMovedId === unit.id ? "moved" : ""}" data-unit-id="${unit.id}" style="--bar-color:${escapeHtml(unit.color || "#39e58f")}; --bar-rgb:${rgb.r}, ${rgb.g}, ${rgb.b};">
        <path class="ring-slice-shell" d="${describeWedge(160, 160, 136, start, end)}" />
        <path class="ring-slice-fill" d="${describeWedge(160, 160, atbRadius, start, end)}" fill="url(#${gradId})" />
        <path class="ring-slice-sheen" d="${describeWedge(160, 160, Math.min(136, atbRadius + 2), start, end)}" />
        ${active?.id === unit.id ? ringCommandDrain(unit, start, end) : ""}
        ${ringDelayPocket(delayedActionFor(unit), start, end, 106, "action-delay")}
        ${ringDelayPocket(delayTimerFor(unit), start, end, 92, "timer-delay")}
        ${ringQueuedEffects(unit, start, end)}
        <text class="ring-slice-name" x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" style="font-size:${labelSize.toFixed(2)}px;"><tspan>${escapeHtml(label)}</tspan>${unit.team === "pc" ? '<tspan class="ring-pc-role" dx="4">(PC)</tspan>' : ""}</text>
        ${unit.allyNpc ? `<image class="ring-ally-marker" href="SMILE.png?v=20260817" x="${(allyPoint.x - 10.5).toFixed(2)}" y="${(allyPoint.y - 10.5).toFixed(2)}" width="21" height="21" preserveAspectRatio="xMidYMid meet" aria-label="Ally NPC" />` : ""}
        ${icon ? `<image class="ring-avatar" href="${escapeHtml(icon)}" x="${(labelPoint.x - 12).toFixed(2)}" y="${(labelPoint.y - 12).toFixed(2)}" width="24" height="24" />` : ""}
      </g>
    `);

    controls.push(`<path class="ring-slice-control draggable" data-unit-id="${unit.id}" d="${describeWedge(160, 160, 154, start, end)}" />`);
    actionButtons.push(ringActionButtons(unit, mid));
    sideWalls.push(ringFrontWallSegment(unit, start, end, rgb));
    sideSeams.push(ringFrontSeamPath(start), ringFrontSeamPath(end));
  });

  return `
    <section class="tactical-ring-group" data-ring-group="${escapeHtml(groupId)}">
      ${groupTitle ? `<h3>${escapeHtml(groupTitle)}</h3>` : ""}
      <div class="tactical-ring-view" data-count="${ordered.length}">
      <div class="ring-instructions">${mode === "gm" ? "Long-hold any slice to reposition it around the table." : "Tactical ring view is local to this screen."}</div>
      <div class="ring-stage">
        <svg class="tactical-ring-svg" data-ring-group="${escapeHtml(groupId)}" viewBox="${readOnly ? '-4 -4 328 390' : '0 0 320 320'}" role="img" aria-label="${escapeHtml(groupTitle || "ATB")} tactical ring" xmlns:xlink="http://www.w3.org/1999/xlink">
          <defs>
            <linearGradient id="ringLipGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#5e0710" />
              <stop offset="18%" stop-color="#e31928" />
              <stop offset="52%" stop-color="#ff2936" />
              <stop offset="82%" stop-color="#93101a" />
              <stop offset="100%" stop-color="#3b0509" />
            </linearGradient>
            ${defs.join("")}
          </defs>
          <ellipse class="ring-shadow" cx="160" cy="174" rx="132" ry="116" />
          ${sideWalls.join("")}
          ${sideSeams.join("")}
          <circle class="ring-backplate" cx="160" cy="160" r="139" />
          ${slices.join("")}
          <path class="ring-front-lip" d="${describeArc(160, 160, 141, 88, 272)}" />
          <circle class="ring-core" cx="160" cy="160" r="34" />
          <text class="ring-core-text" x="160" y="153">${coreLabel}</text>
          <text class="ring-core-subtext" x="160" y="172">${readyCount.textContent}</text>
          ${readOnly ? '' : controls.join("")}
        </svg>
        ${mode === "gm" && !readOnly ? `<div class="ring-action-orbit">${actionButtons.join("")}</div>` : ""}
      </div>
      <div class="ring-legend">
        <span><i class="timer-delay"></i>Reload/Recovery</span>
        <span><i class="action-delay"></i>Delayed Resolution</span>
      </div>
      </div>
    </section>
  `;

}
const api={geometry,overlays,render};if(typeof module==='object')module.exports=api;if(root)root.SATacticalRingRenderer=api;
})(typeof window==='undefined'?null:window);
