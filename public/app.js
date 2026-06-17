const defaultNeeds = [
  { name: "hunger", definition: "The need to obtain food or a complete eating opportunity." },
  { name: "thirst", definition: "The need to drink and restore hydration." },
  { name: "rest", definition: "The need to recover from physical or mental tiredness." },
  { name: "comfort", definition: "The need to feel physically at ease and sheltered." },
  { name: "entertainment", definition: "The need to reduce boredom through enjoyable activity." },
  { name: "social", definition: "The need to interact with or be near other people." }
];

const historyKey = "llm-smart-object-history";

const form = document.querySelector("#generator-form");
const locationInput = document.querySelector("#location-description");
const needsList = document.querySelector("#needs-list");
const addNeedButton = document.querySelector("#add-need");
const generateButton = document.querySelector("#generate-button");
const buttonLabel = document.querySelector("#button-label");
const errorBox = document.querySelector("#error-box");
const statusBox = document.querySelector("#status-box");
const jsonViewer = document.querySelector("#json-viewer");
const validationState = document.querySelector("#validation-state");
const copyButton = document.querySelector("#copy-json");
const downloadButton = document.querySelector("#download-json");
const clearButton = document.querySelector("#clear-result");
const historyList = document.querySelector("#history-list");

let currentJson = "";

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function setStatus(message) {
  statusBox.textContent = message;
  statusBox.hidden = !message;
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  buttonLabel.textContent = isLoading ? "Generating..." : "Generate smart objects";
}

function renderNeedRow(need = { name: "", definition: "" }) {
  const row = document.createElement("div");
  row.className = "need-row";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.className = "need-name";
  nameInput.value = need.name;
  nameInput.placeholder = "rest";
  nameLabel.append(nameInput);

  const definitionLabel = document.createElement("label");
  definitionLabel.textContent = "Definition";
  const definitionInput = document.createElement("input");
  definitionInput.className = "need-definition";
  definitionInput.value = need.definition;
  definitionInput.placeholder = "The need to recover from tiredness.";
  definitionLabel.append(definitionInput);

  const removeButton = document.createElement("button");
  removeButton.className = "icon-button";
  removeButton.type = "button";
  removeButton.title = "Remove need";
  removeButton.setAttribute("aria-label", "Remove need");
  removeButton.textContent = "x";
  removeButton.addEventListener("click", () => row.remove());

  row.append(nameLabel, definitionLabel, removeButton);
  needsList.append(row);
}

function collectNeeds() {
  return [...needsList.querySelectorAll(".need-row")].map((row) => ({
    name: row.querySelector(".need-name").value.trim(),
    definition: row.querySelector(".need-definition").value.trim()
  }));
}

function validateClientInput(locationDescription, needs) {
  if (!locationDescription) {
    return "Location description is required.";
  }

  if (needs.length === 0) {
    return "At least one need is required.";
  }

  const seen = new Set();
  const pattern = /^[a-z][a-z0-9_]*$/;

  for (const [index, need] of needs.entries()) {
    if (!need.name) {
      return `Need ${index + 1} is missing a name.`;
    }
    if (!pattern.test(need.name)) {
      return `Need "${need.name}" must be a lowercase identifier using letters, numbers, and underscores.`;
    }
    if (!need.definition) {
      return `Need "${need.name}" is missing a definition.`;
    }
    if (seen.has(need.name)) {
      return `Duplicate need name "${need.name}".`;
    }
    seen.add(need.name);
  }

  return "";
}

function isCurrentInteractionOutput(data) {
  return Boolean(data?.objects?.every((object) => (
    Array.isArray(object.interactions)
    && object.interactions.every((interaction) => (
      interaction?.duration
      && typeof interaction.duration === "object"
      && interaction.availability
      && typeof interaction.availability === "object"
    ))
  )));
}

function showJson(data, validationMessage = "Schema validation passed.") {
  currentJson = JSON.stringify(data, null, 2);
  jsonViewer.textContent = currentJson;
  validationState.textContent = validationMessage;
  copyButton.disabled = false;
  downloadButton.disabled = false;
  clearButton.disabled = false;
}

function clearResult() {
  currentJson = "";
  jsonViewer.textContent = "";
  validationState.textContent = "No generated output yet.";
  copyButton.disabled = true;
  downloadButton.disabled = true;
  clearButton.disabled = true;
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(historyKey) || "[]");
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(historyKey, JSON.stringify(items.slice(0, 8)));
}

function saveHistory(item) {
  const items = readHistory();
  items.unshift(item);
  writeHistory(items);
  renderHistory();
}

function renderHistory() {
  const items = readHistory();
  historyList.textContent = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No saved generations.";
    historyList.append(empty);
    return;
  }

  for (const [index, item] of items.entries()) {
    const row = document.createElement("div");
    row.className = "history-item";

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = `${new Date(item.timestamp).toLocaleString()} - ${item.locationDescription}`;

    const openButton = document.createElement("button");
    openButton.className = "secondary-button";
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      locationInput.value = item.locationDescription;
      needsList.textContent = "";
      if (Array.isArray(item.needs)) {
        item.needs.forEach(renderNeedRow);
      }
      if (isCurrentInteractionOutput(item.generatedJson)) {
        showJson(item.generatedJson);
      } else {
        showJson(item.generatedJson, "Loaded historical JSON from an older schema; not validated against the current availability schema.");
      }
      setError("");
      setStatus("Loaded a previous successful generation.");
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      const nextItems = readHistory();
      nextItems.splice(index, 1);
      writeHistory(nextItems);
      renderHistory();
    });

    row.append(title, openButton, deleteButton);
    historyList.append(row);
  }
}

addNeedButton.addEventListener("click", () => renderNeedRow());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");
  setStatus("");

  const locationDescription = locationInput.value.trim();
  const needs = collectNeeds();
  const validationError = validateClientInput(locationDescription, needs);

  if (validationError) {
    setError(validationError);
    return;
  }

  setLoading(true);
  setStatus("Generating and validating JSON...");

  try {
    const response = await fetch("/api/generate-smart-objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationDescription, needs })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Generation failed.");
    }

    showJson(payload.data);
    saveHistory({
      timestamp: new Date().toISOString(),
      locationDescription,
      needs,
      generatedJson: payload.data
    });
    setStatus("Generation completed and schema validation passed.");
  } catch (error) {
    clearResult();
    setError(error instanceof Error ? error.message : "Generation failed.");
    setStatus("");
  } finally {
    setLoading(false);
  }
});

copyButton.addEventListener("click", async () => {
  if (!currentJson) {
    return;
  }
  await navigator.clipboard.writeText(currentJson);
  setStatus("JSON copied to clipboard.");
});

downloadButton.addEventListener("click", () => {
  if (!currentJson) {
    return;
  }
  const blob = new Blob([currentJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "smart-objects-with-availability.json";
  link.click();
  URL.revokeObjectURL(url);
});

clearButton.addEventListener("click", () => {
  clearResult();
  setStatus("");
  setError("");
});

defaultNeeds.forEach(renderNeedRow);
renderHistory();
