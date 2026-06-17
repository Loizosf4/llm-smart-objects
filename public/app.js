import {
  CATALOGUE_STORAGE_KEY,
  createEmptyNeed,
  parseCatalogueJson,
  validateNeedCatalogue
} from "./needCatalogue.js";

const historyKey = "llm-smart-object-history";

const form = document.querySelector("#generator-form");
const locationInput = document.querySelector("#location-description");
const needsList = document.querySelector("#needs-list");
const addNeedButton = document.querySelector("#add-need");
const resetNeedsButton = document.querySelector("#reset-needs");
const exportNeedsButton = document.querySelector("#export-needs");
const importNeedsButton = document.querySelector("#import-needs");
const importNeedsFile = document.querySelector("#import-needs-file");
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
let saveTimer = 0;
let suppressAutosave = false;

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

function createTextInput(className, value, placeholder = "") {
  const input = document.createElement("input");
  input.className = className;
  input.value = value ?? "";
  input.placeholder = placeholder;
  return input;
}

function createWeightInput(className, value) {
  const input = createTextInput(className, value ?? "");
  input.type = "number";
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  return input;
}

function createLabel(text, input) {
  const label = document.createElement("label");
  label.textContent = text;
  label.append(input);
  return label;
}

function normalizeNeedForEditor(need) {
  return {
    name: typeof need?.name === "string" ? need.name : "",
    definition: typeof need?.definition === "string" ? need.definition : "",
    weakReference: {
      example: typeof need?.weakReference?.example === "string" ? need.weakReference.example : "",
      weight: typeof need?.weakReference?.weight === "number" ? need.weakReference.weight : 0.1
    },
    strongReference: {
      example: typeof need?.strongReference?.example === "string" ? need.strongReference.example : "",
      weight: typeof need?.strongReference?.weight === "number" ? need.strongReference.weight : 1.0
    }
  };
}

function renderNeedRow(need = createEmptyNeed()) {
  const normalized = normalizeNeedForEditor(need);
  const row = document.createElement("div");
  row.className = "need-row";

  const removeButton = document.createElement("button");
  removeButton.className = "icon-button";
  removeButton.type = "button";
  removeButton.title = "Remove need";
  removeButton.setAttribute("aria-label", "Remove need");
  removeButton.textContent = "x";
  removeButton.addEventListener("click", () => {
    row.remove();
    saveCatalogueSoon();
  });

  row.append(
    createLabel("Name", createTextInput("need-name", normalized.name, "rest")),
    createLabel("Definition", createTextInput("need-definition", normalized.definition, "The urgency to recover from fatigue.")),
    createLabel("Weak reference interaction", createTextInput("need-weak-example", normalized.weakReference.example, "wall -> lean_against_wall")),
    createLabel("Weak reference weight", createWeightInput("need-weak-weight", normalized.weakReference.weight)),
    createLabel("Strong reference interaction", createTextInput("need-strong-example", normalized.strongReference.example, "bed -> sleep")),
    createLabel("Strong reference weight", createWeightInput("need-strong-weight", normalized.strongReference.weight)),
    removeButton
  );

  needsList.append(row);
}

function renderCatalogue(needs) {
  suppressAutosave = true;
  needsList.textContent = "";
  needs.forEach(renderNeedRow);
  suppressAutosave = false;
}

function readWeight(row, selector) {
  const value = row.querySelector(selector).value.trim();
  return value === "" ? Number.NaN : Number(value);
}

function collectNeeds() {
  return [...needsList.querySelectorAll(".need-row")].map((row) => ({
    name: row.querySelector(".need-name").value.trim(),
    definition: row.querySelector(".need-definition").value.trim(),
    weakReference: {
      example: row.querySelector(".need-weak-example").value.trim(),
      weight: readWeight(row, ".need-weak-weight")
    },
    strongReference: {
      example: row.querySelector(".need-strong-example").value.trim(),
      weight: readWeight(row, ".need-strong-weight")
    }
  }));
}

function validateClientInput(locationDescription, needs) {
  if (!locationDescription) {
    return "Location description is required.";
  }

  const validation = validateNeedCatalogue(needs);
  return validation.valid ? "" : validation.error;
}

function saveCatalogue() {
  if (suppressAutosave) {
    return;
  }

  localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(collectNeeds()));
}

function saveCatalogueSoon() {
  if (suppressAutosave) {
    return;
  }

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveCatalogue, 150);
}

async function loadDefaultCatalogue() {
  const response = await fetch("/default-needs.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Default need catalogue could not be loaded.");
  }

  const data = await response.json();
  const validation = validateNeedCatalogue(data);
  if (!validation.valid) {
    throw new Error(`Default need catalogue is invalid: ${validation.error}`);
  }

  return validation.needs;
}

function loadSavedCatalogue() {
  const saved = localStorage.getItem(CATALOGUE_STORAGE_KEY);
  if (!saved) {
    return null;
  }

  const parsed = parseCatalogueJson(saved);
  if (!parsed.valid) {
    return null;
  }

  if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
    return null;
  }

  if (!parsed.data.every((need) => need && typeof need === "object" && !Array.isArray(need))) {
    return null;
  }

  return parsed.data.map(normalizeNeedForEditor);
}

async function initializeCatalogue() {
  const saved = loadSavedCatalogue();
  if (saved) {
    renderCatalogue(saved);
    return;
  }

  try {
    const defaults = await loadDefaultCatalogue();
    renderCatalogue(defaults);
  } catch (error) {
    renderCatalogue([createEmptyNeed()]);
    setError(error instanceof Error ? error.message : "Need catalogue could not be loaded.");
  }
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
      if (isCurrentInteractionOutput(item.generatedJson)) {
        showJson(item.generatedJson);
      } else {
        showJson(item.generatedJson, "Loaded historical JSON from an older schema; not validated against the current availability schema.");
      }
      setError("");
      setStatus("Loaded a previous successful generation. The current saved need catalogue was not changed.");
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

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

addNeedButton.addEventListener("click", () => {
  renderNeedRow(createEmptyNeed());
  saveCatalogueSoon();
});

needsList.addEventListener("input", saveCatalogueSoon);
needsList.addEventListener("change", saveCatalogueSoon);

resetNeedsButton.addEventListener("click", async () => {
  if (!window.confirm("Reset the need catalogue to defaults? Current need edits will be replaced.")) {
    return;
  }

  try {
    const defaults = await loadDefaultCatalogue();
    localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(defaults));
    renderCatalogue(defaults);
    setError("");
    setStatus("Need catalogue reset to defaults.");
  } catch (error) {
    setError(error instanceof Error ? error.message : "Need catalogue could not be reset.");
  }
});

exportNeedsButton.addEventListener("click", () => {
  const validation = validateNeedCatalogue(collectNeeds());
  if (!validation.valid) {
    setError(validation.error);
    return;
  }

  downloadJson(validation.needs, "need-catalogue.json");
  setError("");
  setStatus("Need catalogue exported.");
});

importNeedsButton.addEventListener("click", () => {
  importNeedsFile.click();
});

importNeedsFile.addEventListener("change", async () => {
  const file = importNeedsFile.files?.[0];
  importNeedsFile.value = "";
  if (!file) {
    return;
  }

  try {
    const parsed = parseCatalogueJson(await file.text());
    if (!parsed.valid) {
      throw new Error(parsed.error);
    }

    const validation = validateNeedCatalogue(parsed.data);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(validation.needs));
    renderCatalogue(validation.needs);
    setError("");
    setStatus("Need catalogue imported.");
  } catch (error) {
    setError(error instanceof Error ? error.message : "Need catalogue import failed.");
  }
});

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

  const normalizedNeeds = validateNeedCatalogue(needs).needs;

  setLoading(true);
  setStatus("Generating and validating JSON...");

  try {
    const response = await fetch("/api/generate-smart-objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationDescription, needs: normalizedNeeds })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Generation failed.");
    }

    showJson(payload.data);
    saveHistory({
      timestamp: new Date().toISOString(),
      locationDescription,
      needs: normalizedNeeds,
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

initializeCatalogue();
renderHistory();
