const STORAGE_KEY = "sa-starship-layout-draft";

function defaultDraft() {
  return {
    title: "",
    affiliation: "",
    class: "",
    crew: ["", "", "", "", ""],
    gridCells: [],
    reputationSelections: [4, 5, 3, 4, 4],
    popularity: 0,
  };
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultDraft(),
      ...saved,
      crew: Array.isArray(saved.crew) && saved.crew.length ? saved.crew : defaultDraft().crew,
      gridCells: Array.isArray(saved.gridCells)
        ? [...new Set(saved.gridCells.filter((value) => Number.isInteger(value) && value >= 0 && value < 400))]
        : [],
      reputationSelections: Array.isArray(saved.reputationSelections) && saved.reputationSelections.length === 5
        ? saved.reputationSelections.map((value) => Math.max(0, Math.min(10, Number(value) || 0)))
        : defaultDraft().reputationSelections,
      popularity: Math.max(0, Math.min(100, Number(saved.popularity) || 0)),
    };
  } catch {
    return defaultDraft();
  }
}

let draft = loadDraft();
const shipFields = [...document.querySelectorAll("[data-ship-field]")];
const crewLists = [
  { list: document.querySelector("#crewmemberList"), mobile: false },
  { list: document.querySelector("#mobileCrewmemberList"), mobile: true },
];

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // The layout remains usable in privacy-restricted browser contexts.
  }
}

function syncShipField(key, value, source) {
  draft[key] = value;
  shipFields.forEach((field) => {
    if (field !== source && field.dataset.shipField === key) field.value = value;
  });
  saveDraft();
}

function focusCrewmember(index) {
  requestAnimationFrame(() => {
    crewLists.forEach(({ list }) => {
      const input = list?.querySelector(`[data-crew-index="${index}"]`);
      if (input && input.offsetParent !== null) {
        list.scrollTop = list.scrollHeight;
        input.focus({ preventScroll: true });
      }
    });
  });
}

function renderCrewList(list, mobile) {
  if (!list) return;
  list.replaceChildren();
  list.classList.toggle("has-overflow", draft.crew.length > 9);
  if (!mobile) list.style.gridTemplateRows = draft.crew.length <= 9 ? `repeat(${draft.crew.length}, 1fr)` : "";
  draft.crew.forEach((name, index) => {
    const row = document.createElement("div");
    row.className = mobile ? "mobile-crewmember-row" : "crewmember-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = name;
    input.placeholder = `Crewmember ${index + 1}`;
    input.dataset.crewIndex = String(index);
    input.setAttribute("aria-label", `Crewmember ${index + 1}`);
    input.addEventListener("input", () => {
      draft.crew[index] = input.value;
      crewLists.forEach(({ list: otherList }) => {
        const other = otherList?.querySelector(`[data-crew-index="${index}"]`);
        if (other && other !== input) other.value = input.value;
      });
      saveDraft();
    });
    row.append(input);

    if (draft.crew.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "-";
      remove.title = "Remove crewmember";
      remove.setAttribute("aria-label", `Remove crewmember ${index + 1}`);
      remove.addEventListener("click", () => {
        draft.crew.splice(index, 1);
        saveDraft();
        renderCrew();
      });
      row.append(remove);
    }

    list.append(row);
  });
}

function renderCrew() {
  crewLists.forEach(({ list, mobile }) => renderCrewList(list, mobile));
}

shipFields.forEach((field) => {
  const key = field.dataset.shipField;
  field.value = draft[key] || "";
  field.addEventListener("input", () => syncShipField(key, field.value, field));
});

function addCrewmember() {
  const index = draft.crew.length;
  draft.crew.push("");
  saveDraft();
  renderCrew();
  focusCrewmember(index);
}

document.querySelector("#addCrewmember")?.addEventListener("click", addCrewmember);
document.querySelector("#addMobileCrewmember")?.addEventListener("click", addCrewmember);

const shipGrids = [...document.querySelectorAll(".ship-grid")];
const gridOutputs = [...document.querySelectorAll(".mobile-grid-panel output:first-child")];

function renderGridCells() {
  const selected = new Set(draft.gridCells);
  shipGrids.forEach((grid) => {
    grid.querySelectorAll(".ship-grid-cell").forEach((cell) => {
      const active = selected.has(Number(cell.dataset.gridIndex));
      cell.classList.toggle("is-selected", active);
      cell.setAttribute("aria-pressed", String(active));
    });
  });
  gridOutputs.forEach((output) => { output.value = String(selected.size); });
}

function toggleGridCell(index) {
  const selected = new Set(draft.gridCells);
  if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  draft.gridCells = [...selected].sort((a, b) => a - b);
  renderGridCells();
  saveDraft();
}

shipGrids.forEach((grid) => {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 400; index += 1) {
    const cell = document.createElement("span");
    cell.className = "ship-grid-cell";
    cell.dataset.gridIndex = String(index);
    cell.tabIndex = 0;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Ship grid square ${index + 1}`);
    cell.addEventListener("click", () => toggleGridCell(index));
    cell.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleGridCell(index);
    });
    fragment.append(cell);
  }
  grid.append(fragment);
});

const reputationValues = ["+5", "+4", "+3", "+2", "+1", "0", "+1", "+2", "+3", "+4", "+5"];
const reputationNames = [
  ["Benevolent", "Ruthless"],
  ["Virtuous", "Treacherous"],
  ["Civil", "Savage"],
  ["Powerful", "Weak"],
  ["Cunning", "Exploitable"],
];

function renderReputationSelections() {
  document.querySelectorAll(".reputation-position").forEach((position) => {
    const selected = draft.reputationSelections[Number(position.dataset.row)] === Number(position.dataset.index);
    position.classList.toggle("selected", selected);
    position.setAttribute("aria-pressed", String(selected));
    position.querySelectorAll("circle, text").forEach((element) => element.classList.toggle("selected", selected));
  });
}

function chooseReputation(rowIndex, index) {
  draft.reputationSelections[rowIndex] = index;
  renderReputationSelections();
  saveDraft();
}

document.querySelectorAll(".reputation-chart").forEach((chart) => {
  chart.querySelectorAll(".reputation-row > g").forEach((track, rowIndex) => {
    const isDesktopTrack = chart.classList.contains("desktop-reputation-chart");
    reputationValues.forEach((value, index) => {
      const position = document.createElementNS("http://www.w3.org/2000/svg", "g");
      position.classList.add("reputation-position");
      position.dataset.row = String(rowIndex);
      position.dataset.index = String(index);
      position.setAttribute("transform", `translate(${index * 29} 0)`);
      position.setAttribute("role", "button");
      position.setAttribute("tabindex", "0");
      const [leftName, rightName] = reputationNames[rowIndex];
      position.setAttribute("aria-label", `${index < 5 ? leftName : index > 5 ? rightName : "Neutral"} ${value}`);
      position.addEventListener("click", () => chooseReputation(rowIndex, index));
      position.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        chooseReputation(rowIndex, index);
      });

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "0");
      circle.setAttribute("cy", "0");
      circle.setAttribute("r", isDesktopTrack ? "9.5" : "11.5");
      position.append(circle);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "0");
      label.setAttribute("y", "3");
      label.textContent = value;
      position.append(label);
      track.append(position);
    });
  });
});

const popularityInputs = [...document.querySelectorAll("[data-reputation-popularity]")];
function syncPopularity(value, source) {
  if (value === "") return;
  draft.popularity = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  popularityInputs.forEach((input) => {
    if (input !== source) input.value = String(draft.popularity);
  });
  saveDraft();
}

popularityInputs.forEach((input) => {
  input.value = String(draft.popularity);
  input.addEventListener("input", () => syncPopularity(input.value, input));
  input.addEventListener("change", () => {
    input.value = String(Math.max(0, Math.min(100, Math.round(Number(input.value) || 0))));
    syncPopularity(input.value, input);
  });
});

renderCrew();
renderGridCells();
renderReputationSelections();
