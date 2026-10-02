const path = require("path");
const optimized = require('./sic-web-assets.json');

const browserScripts = new Set([
  "illusion-droid-console.js","relay-console.js","sensor-snapshot-view.js","breach-drone-view.js","breach-drone-console.js","vacuum-ui.js","extraction-console.js",
  "crew-logs-ui.js","interior-pan.js","black-hole-gun-console.js","black-hole-gun-console.css",
  'ship-fabrication.js','science-console.js','ship-devastation.js','ship-doors.js','transporter-console.js','intruder-alert.js','crew-deployment.js','quick-prompts.js', 'character-statistics.js', 'ship-floorplan-snapshot.js', 'campaign-recovery.js', 'room-v03.js', 'sic-categories.js',
  'cleanser-ui.js','cleanser-timeline.js','cleanser-impact.js',
  'warp-effects.js','automation-ui.js','fleet-notices.js','drone-console.js','ship-probes.js','probe-console.js','drone-map.js','surveillance-console.js','skill-catalog.js',
  'space-objects.js','space-object-editor.js',
  'field-utility-console.js',
  'field-utility-status.js',
  'crew-room-console.js','crew-room-status.js',
  'ship-targets.js','missile-ammunition.js','missile-ui.js',
  'transit-console-ui.js','transit-status.js',
  'hacking-practice-ui.js',
  'hacking-console-ui.js',
  'combat-wire.js', 'view-ready.js', 'result-feedback.js',
  'ship-print.js','crew-tokens.js','utility-console-ui.js','oxygen-ui.js',
  'ship-locks.js','lock-console-ui.js','console-common.js','combat-feedback.js','combat-order-ui.js',
  "station-access.js", "ship-shields.js", "shield-console-ui.js", "ship-roll-ui.js", "console-feedback.js",
  "ship-weapons.js", "weapon-console-ui.js", "ship-sensors.js", "sensor-console-ui.js", "ship-cooperation.js", "ship-command-ui.js", "action-help.js", "maintenance-ui.js",
  "delay-rules.js", "skill-descriptions.js",
  "app.js", "character.js", "character-data.js", "character-print.js",
  "combat-actions.js", "combat-engine.js", "combat-rules.js", "data-reset.js",
  "dice-roller.js", "drama-card-data.js", "fubs-data.js", "gear-data.js", "gm.js",
  "npc-combat-dice.js", "race-lore-data.js", "ship-map-core.js", "ship-combat-map.js",
  "showcase.js", "starship.js", "weapon-data.js", "ship-power.js", "ship-navigation.js", "ship-navigation-ui.js", "character-storage.js", "ship-distances.js", "space-map.js", "live-dom.js", "crew-overview.js", "health-display.js",
]);
const publicData = new Set(["data/weapons.json", "data/npc-templates.json"]);
const vendorScripts = new Set(["vendor/three.module.min.js", "vendor/three.core.min.js", "vendor/cannon-es.js"]);
const mediaExtensions = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".ico", ".mp4", ".m4a", ".mp3", ".wav", ".ogg"]);

function resolvePublicAsset(root, pathname) {
  let file;
  try { file = decodeURIComponent(pathname); } catch { return null; }
  if (!file.startsWith("/") || file.includes("\\") || file.includes("\0")) return null;
  file = file === "/" ? "index.html" : file.slice(1);
  if (file.split("/").some((part) => !part || part.startsWith("."))) return null;
  const extension = path.extname(file).toLowerCase();
  const rootFile = !file.includes("/");
  const allowed = publicData.has(file) || vendorScripts.has(file)
    || (rootFile && (browserScripts.has(file) || [".html", ".css"].includes(extension) || mediaExtensions.has(extension)))
    || (/^fonts\/[^/]+$/.test(file) && [".woff", ".woff2", ".ttf", ".otf"].includes(extension));
  if (!allowed) return null;
  if(optimized[file])file=optimized[file].file;
  const absolute = path.resolve(root, file);
  return path.dirname(absolute) === root || absolute.startsWith(root + path.sep) ? absolute : null;
}

module.exports = { resolvePublicAsset };
