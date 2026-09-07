const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolvePublicAsset } = require("../public-assets");
const root = path.resolve(__dirname, "..");

test("only intended browser assets are public", () => {
  assert.equal(resolvePublicAsset(root, "/campaign-api.js"), null);
  for (const file of ["/", "/character.html", "/ship-map-presentation.css", "/ship-map-core.js", "/life-support-floor-plan.png", "/data/weapons.json", "/vendor/three.core.min.js", "/fonts/Orbitron.woff2"]) {
    assert.ok(resolvePublicAsset(root, file), file);
  }
  for (const file of ["/data/campaigns.json", "/server.js", "/campaign-store.js", "/public-assets.js", "/.env", "/.git/config", "/package.json", "/test-artifacts/private.png", "/tests/combat-location.test.js", "/node_modules/pg/package.json", "/%2e%2e/server.js", "/data%5ccampaigns.json", "/bad%00.png", "/%ZZ"]) {
    assert.equal(resolvePublicAsset(root, file), null, file);
  }
});
