import { PhysicalDiceRoller } from "./dice-roller.js?v=20260813-feedback-2";

const roller = new PhysicalDiceRoller({
  shell: document.querySelector("#npcDiceRoller"),
  stage: document.querySelector("#npcDiceRoller .dice-stage"),
  title: document.querySelector("#npcDiceTitle"),
  subtitle: document.querySelector("#npcDiceSubtitle"),
  result: document.querySelector("#npcDiceResult"),
  actions: document.querySelector("#npcDiceActions"),
  canvasHost: document.querySelector("#npcDiceCanvas"),
});

function fusedTopTwo(results) {
  const groups = new Map();
  results.forEach((value, index) => {
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(index);
  });
  const used = new Set();
  const values = [];
  groups.forEach((indices, value) => {
    for (let offset = 0; offset + 1 < indices.length; offset += 2) {
      used.add(indices[offset]);
      used.add(indices[offset + 1]);
      values.push(value * 2);
    }
  });
  results.forEach((value, index) => { if (!used.has(index)) values.push(value); });
  return values.sort((a, b) => b - a).slice(0, 2);
}

function roll({ sides, title, subtitle, fusion, flat = 0, skill = 0 }) {
  return new Promise((resolve) => {
    roller.rollPool({
      sides,
      title,
      subtitle,
      fusion,
      onResolved: () => {},
      onSettled: (results) => {
        const kept = fusion ? fusedTopTwo(results) : results;
        const score = kept.reduce((sum, value) => sum + value, 0) + Number(skill || 0) + Number(flat || 0);
        roller.stop();
        resolve({ score, results, kept });
      },
    });
  });
}

window.SANpcDice = {
  rollCheck({ sides, skill, title }) {
    return roll({ sides, skill, title, subtitle: `${sides.map((die) => `D${die}`).join(" + ")} | top two + ${Number(skill || 0).toFixed(1)}`, fusion: true });
  },
  rollDamage({ sides, flat, title }) {
    return roll({ sides, flat, title, subtitle: "Add every die. No fusion.", fusion: false });
  },
};
window.dispatchEvent(new CustomEvent("sa-npc-dice-ready"));
