(function initializeShipMapCore() {
  const ASSET_VERSION = "20260901-floorplans-1";
  const image = (filename) => `${filename}?v=${ASSET_VERSION}`;
  const catalog = {
    "en-engine-1": { width: 1, height: 1, label: "EN 1", image: image("en-engine-1-floor-plan.png"), output: 5, stations: [{ x: 0, y: 0, mesh: 1 }] },
    "en-engine-2": { width: 2, height: 2, label: "EN 2", image: image("en-engine-2-floor-plan.png"), output: 13, stations: [{ x: 0, y: 0, mesh: 1 }, { x: 1, y: 1, mesh: 7 }] },
    "en-engine-3": { width: 3, height: 3, label: "EN 3", image: image("en-engine-3-floor-plan.png"), output: 29, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 1, y: 2, mesh: 7 }] },
    "en-engine-4": { width: 4, height: 4, label: "EN 4", image: image("en-engine-4-floor-plan.png"), output: 50, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 3, y: 1, mesh: 5 }, { x: 1, y: 3, mesh: 7 }] },
    "en-engine-5": { width: 5, height: 5, label: "EN 5", image: image("en-engine-5-floor-plan.png"), output: 77, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 4, y: 2, mesh: 5 }, { x: 2, y: 4, mesh: 7 }] },
    "en-engine-6": { width: 6, height: 6, label: "EN 6", image: image("en-engine-6-floor-plan.png"), output: 110, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 5, y: 2, mesh: 5 }, { x: 3, y: 5, mesh: 7 }, { x: 0, y: 3, mesh: 3 }] },
    "life-support": { width: 2, height: 2, label: "LIFE", image: image("life-support-floor-plan.png"), output: 0, stations: [] },
    "nutritional-supplement": { width: 1, height: 1, label: "NUT.", image: image("nutritional-supplement-floor-plan.png"), output: 0, stations: [] },
  };

  function definition(type) {
    return catalog[type] || { width: 1, height: 1, label: type || "SIC", image: "", output: 0, stations: [] };
  }

  function floorplanStyle(type, column = 0, row = 0) {
    const entry = definition(type);
    if (!entry.image) return "";
    const x = entry.width === 1 ? 50 : (Number(column) / (entry.width - 1)) * 100;
    const y = entry.height === 1 ? 50 : (Number(row) / (entry.height - 1)) * 100;
    return `background-image:url('${entry.image}');background-size:${entry.width * 100}% ${entry.height * 100}%;background-position:${x}% ${y}%;background-repeat:no-repeat`;
  }

  window.SAShipMap = Object.freeze({ ASSET_VERSION, catalog: Object.freeze(catalog), definition, floorplanStyle, image });
}());
