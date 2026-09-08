(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAHealthDisplay = api;
}(typeof window === "undefined" ? null : window, function () {
  function segments(current, maximum) {
    const max = Math.max(0, Number(maximum) || 0);
    const filled = max ? Math.round(Math.max(0, Math.min(max, Number(current) || 0)) / max * 6) : 0;
    return [0, 1, 2].map(index => filled >= index * 2 + 2 ? "full" : filled === index * 2 + 1 ? "half" : "empty");
  }
  function track(kind, current, maximum, exact = false) {
    const label = kind === "shield" ? "Shields" : "Hull";
    const value = `${Math.max(0, Number(current) || 0)}/${Math.max(0, Number(maximum) || 0)}`;
    return `<span class="sa-health-track" title="${label}${exact ? ` ${value}` : ""}" aria-label="${label}${exact ? ` ${value}` : " condition"}">${segments(current, maximum).map(fill => `<i class="sa-health-icon ${kind} ${fill}" aria-hidden="true"></i>`).join("")}${exact ? `<small>${value}</small>` : ""}</span>`;
  }
  function logText(text, exact) {
    if (exact) return String(text || "");
    return String(text || "").replace(/;?\s*HP\s*:?\s*-?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\.?/gi, "")
      .replace(/\bto\s+-?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*HP\b/gi, "to updated health");
  }
  return Object.freeze({ segments, track, logText });
}));
