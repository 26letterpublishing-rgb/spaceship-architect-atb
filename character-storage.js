(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SACharacterStorage = api;
}(typeof window !== "undefined" ? window : null, function () {
  const libraryKey = "sa2e-character-library-v1";
  const activeKey = "sa2e-active-character-v1";
  const campaignKey = "sa-character-campaign-code";
  const demoIds = new Set(["showcase-nova", "showcase-rex", "showcase-mira"]);
  function read(storage, key, fallback) {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function repair(storage) {
    const library = read(storage, libraryKey, []);
    const active = storage.getItem(activeKey);
    const code = storage.getItem(campaignKey);
    const cached = read(storage, `sa-character-campaign-cache-v1-${code}`, null);
    const demoEntries = Array.isArray(library) ? library.filter(entry => demoIds.has(entry.id)) : [];
    const demoCampaign = cached?.campaign?.showcase || demoEntries.some(entry => entry.campaignLink?.roomCode === code);
    if (!demoEntries.length && !demoIds.has(active) && !demoCampaign) return;
    // Keep the original contaminated snapshot before repairing only known demo records.
    const backupKey = "sa-character-pre-demo-repair-v1";
    if (!storage.getItem(backupKey)) storage.setItem(backupKey, JSON.stringify({ library, active, code }));
    if (demoEntries.length) storage.setItem(libraryKey, JSON.stringify(library.filter(entry => !demoIds.has(entry.id))));
    if (demoIds.has(active)) storage.removeItem(activeKey);
    if (demoCampaign || demoIds.has(active)) storage.removeItem(campaignKey);
  }
  function selectStorage(persistent, session, search) {
    const params = new URLSearchParams(search);
    if (params.get("showcase") !== "1") {
      repair(persistent);
      return persistent;
    }
    const prefix = `sa-demo-character-${params.get("campaign") || "local"}-`;
    return {
      getItem: key => session.getItem(prefix + key),
      setItem: (key, value) => session.setItem(prefix + key, value),
      removeItem: key => session.removeItem(prefix + key),
    };
  }
  return { selectStorage, repair };
}));
