const STORAGE_KEY = "sa-starship-layout-draft";
const shipFields = [...document.querySelectorAll("[data-ship-field]")];
const crewmemberList = document.querySelector("#crewmemberList");
const addCrewmember = document.querySelector("#addCrewmember");

function defaultDraft() {
  return { title: "", affiliation: "", class: "", crew: ["", "", "", "", ""] };
}

function loadDraft() {
  try {
    return { ...defaultDraft(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaultDraft();
  }
}

let draft = loadDraft();

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

function renderCrew() {
  crewmemberList.replaceChildren();
  draft.crew.forEach((name, index) => {
    const row = document.createElement("div");
    row.className = "crewmember-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = name;
    input.placeholder = `Crewmember ${index + 1}`;
    input.setAttribute("aria-label", `Crewmember ${index + 1}`);
    input.addEventListener("input", () => {
      draft.crew[index] = input.value;
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
    crewmemberList.append(row);
  });
}

shipFields.forEach((field) => {
  const key = field.dataset.shipField;
  field.value = draft[key] || "";
  field.addEventListener("input", () => {
    draft[key] = field.value;
    saveDraft();
  });
});

addCrewmember.addEventListener("click", () => {
  draft.crew.push("");
  saveDraft();
  renderCrew();
  crewmemberList.lastElementChild?.querySelector("input")?.focus({ preventScroll: true });
});

renderCrew();

document.querySelectorAll("[data-reputation]").forEach((track) => {
  const values = ["+5", "+4", "+3", "+2", "+1", "0", "+1", "+2", "+3", "+4", "+5"];
  values.forEach((value) => {
    const pip = document.createElement("i");
    pip.textContent = value;
    track.append(pip);
  });
});

const minerals = [
  "Aethion", "Infinium", "Carmot", "Dark Phaedon", "Endernium", "Necronium",
  "Phaedon", "Drakonite", "Mirium", "Argol", "Paridon", "Crystilium", "Ragnaron",
  "Transpherion", "Hpidium", "Umbrehium", "Dianium", "Zennium", "Rupium", "Crixium",
  "Zeltera", "Magnesium", "Iron"
];

const mineralRows = document.querySelector("#mineralRows");
minerals.forEach((mineral) => {
  const row = document.createElement("tr");
  const name = document.createElement("td");
  const quantity = document.createElement("td");
  name.textContent = mineral;
  row.append(name, quantity);
  mineralRows.append(row);
});

const shipGrid = document.querySelector(".ship-grid");
for (let index = 0; index < 400; index += 1) {
  const cell = document.createElement("span");
  cell.className = "ship-grid-cell";
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", `Ship grid square ${index + 1}`);
  shipGrid.append(cell);
}
