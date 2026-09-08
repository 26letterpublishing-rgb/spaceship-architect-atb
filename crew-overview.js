(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SACrewOverview = api;
}(typeof window === "undefined" ? null : window, function () {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  function details(id, npc, ships, liveUnits = [], fallback = null) {
    const assigned = ships.filter(ship => (npc ? ship.crewNpcUnitIds : ship.crewCharacterIds)?.includes(id));
    const live = liveUnits.find(unit => npc ? unit.id === id : unit.characterId === id);
    const saved = ships.find(ship => ship.characterLocations?.[id]);
    const location = live?.location || (saved ? { ...saved.characterLocations[id], starshipId: saved.id } : fallback?.location);
    const aboard = ships.find(ship => ship.id === location?.starshipId);
    const square = Number.isInteger(location?.square) ? `, square ${location.square + 1}${Number.isInteger(location.mesh) ? `.${location.mesh + 1}` : ""}` : "";
    const stationItem = aboard?.ship?.sicInventory?.find(item => item.id === location?.sicId);
    const map = typeof window === "undefined" ? require("./ship-map-core") : window.SAShipMap;
    const stationType = stationItem?.type || (location?.stationed && aboard ? map?.buildLayout(aboard.ship || {}).footprint.get(location.square)?.type : "");
    return {
      assigned: assigned.map(ship => ship.title || "Unnamed Ship").join(", ") || "Unassigned",
      location: aboard ? `${aboard.title}${square}${live?.timedAction?.kind === "move" ? " (moving)" : ""}` : location && !location.starshipId ? "Surface" : "Not deployed",
      station: location?.stationed ? `${stationType?.replaceAll("-", " ").toUpperCase() || "Station"}${square}` : "Not stationed",
    };
  }
  function markup(detail) {
    return `<small class="crew-overview">${[["Assigned ship", detail.assigned], ["Current location", detail.location], ["Station", detail.station]].map(([label, value]) => `<span><b>${label}</b> ${escape(value)}</span>`).join("")}</small>`;
  }
  return Object.freeze({ details, markup });
}));
