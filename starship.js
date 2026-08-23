const STORAGE_KEY = "sa-starship-layout-draft";

function defaultDraft() {
  return {
    title: "",
    affiliation: "",
    class: "",
    crew: ["", "", "", "", ""],
  };
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultDraft(),
      ...saved,
      crew: Array.isArray(saved.crew) && saved.crew.length ? saved.crew : defaultDraft().crew,
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
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
      if (input && input.offsetParent !== null) input.focus({ preventScroll: true });
    });
  });
}

function renderCrewList(list, mobile) {
  if (!list) return;
  list.replaceChildren();
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

document.querySelectorAll(".ship-grid").forEach((grid) => {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 400; index += 1) {
    const cell = document.createElement("span");
    cell.className = "ship-grid-cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Ship grid square ${index + 1}`);
    fragment.append(cell);
  }
  grid.append(fragment);
});

const reputationValues = ["+5", "+4", "+3", "+2", "+1", "0", "+1", "+2", "+3", "+4", "+5"];
const reputationSelections = [4, 5, 3, 4, 4];

document.querySelectorAll(".reputation-row > g").forEach((track, rowIndex) => {
  reputationValues.forEach((value, index) => {
    const selected = reputationSelections[rowIndex] === index;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(index * 29));
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", "11.5");
    circle.classList.toggle("selected", selected);
    track.append(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(index * 29));
    label.setAttribute("y", "3");
    label.classList.toggle("selected", selected);
    label.textContent = value;
    track.append(label);
  });
});

renderCrew();
