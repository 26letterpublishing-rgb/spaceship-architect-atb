(function resetOldPlaytestData() {
  const epochKey = "sa-data-epoch";
  const currentEpoch = "2026-08-11-fresh-start-1";

  try {
    if (localStorage.getItem(epochKey) === currentEpoch) return;
    const oldKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && (key.startsWith("sa-") || key.startsWith("sa2e-"))) oldKeys.push(key);
    }
    oldKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(epochKey, currentEpoch);
  } catch {
    // The app remains usable when private browsing blocks persistent storage.
  }
})();
