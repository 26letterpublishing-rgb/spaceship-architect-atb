const path = require("path");

const browserScripts = new Set([
  "app.js", "character.js", "character-data.js", "character-print.js",
  "combat-actions.js", "combat-engine.js", "combat-rules.js", "data-reset.js",
  "dice-roller.js", "drama-card-data.js", "fubs-data.js", "gear-data.js", "gm.js",
  "npc-combat-dice.js", "race-lore-data.js", "ship-map-core.js", "ship-combat-map.js",
  "showcase.js", "starship.js", "weapon-data.js", "ship-power.js", "character-storage.js", "ship-distances.js", "live-dom.js", "crew-overview.js", "health-display.js",
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
  const absolute = path.resolve(root, file);
  return path.dirname(absolute) === root || absolute.startsWith(root + path.sep) ? absolute : null;
}

module.exports = { resolvePublicAsset };
