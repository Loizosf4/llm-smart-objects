import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CATALOGUE_STORAGE_KEY,
  createEmptyNeed,
  parseCatalogueJson,
  validateNeedCatalogue
} from "../public/needCatalogue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validNeed(overrides = {}) {
  return {
    name: "rest",
    definition: "The urgency to recover from fatigue.",
    weakReference: {
      example: "wall -> lean_against_wall",
      weight: 0.05
    },
    strongReference: {
      example: "bed -> sleep",
      weight: 1.0
    },
    ...overrides
  };
}

test("valid saved catalogue can be parsed", () => {
  const parsed = parseCatalogueJson(JSON.stringify([validNeed()]));
  assert.equal(parsed.valid, true);
  const validation = validateNeedCatalogue(parsed.data);
  assert.equal(validation.valid, true);
});

test("corrupt localStorage catalogue falls back safely", () => {
  const parsed = parseCatalogueJson("{ not json");
  assert.equal(parsed.valid, false);
  assert.match(parsed.error, /not valid JSON/);
});

test("export preserves all catalogue fields", () => {
  const validation = validateNeedCatalogue([validNeed()]);
  assert.equal(validation.valid, true);
  assert.deepEqual(Object.keys(validation.needs[0]).sort(), [
    "definition",
    "name",
    "strongReference",
    "weakReference"
  ]);
  assert.deepEqual(validation.needs[0].weakReference, {
    example: "wall -> lean_against_wall",
    weight: 0.05
  });
});

test("invalid imported catalogue is rejected", () => {
  const validation = validateNeedCatalogue([
    validNeed({
      weakReference: { example: "wall -> lean_against_wall", weight: 1.0 }
    })
  ]);
  assert.equal(validation.valid, false);
  assert.match(validation.error, /weak reference weight must be lower/);
});

test("imported catalogue does not replace current data when validation fails", () => {
  const current = [validNeed()];
  const imported = [
    validNeed({
      name: "broken",
      weakReference: { example: "broken -> weak", weight: 0.9 },
      strongReference: { example: "broken -> strong", weight: 0.8 }
    })
  ];

  const validation = validateNeedCatalogue(imported);
  const next = validation.valid ? validation.needs : current;

  assert.equal(validation.valid, false);
  assert.deepEqual(next, current);
});

test("added or removed needs can be persisted", () => {
  const storage = new Map();
  const added = [
    validNeed(),
    {
      ...createEmptyNeed(),
      name: "custom",
      definition: "A custom need.",
      weakReference: { example: "custom_object -> weak_custom", weight: 0.1 },
      strongReference: { example: "custom_object -> strong_custom", weight: 0.9 }
    }
  ];
  storage.set(CATALOGUE_STORAGE_KEY, JSON.stringify(added));
  const restored = JSON.parse(storage.get(CATALOGUE_STORAGE_KEY));
  assert.equal(restored.length, 2);

  restored.splice(0, 1);
  storage.set(CATALOGUE_STORAGE_KEY, JSON.stringify(restored));
  assert.equal(JSON.parse(storage.get(CATALOGUE_STORAGE_KEY)).length, 1);
});

test("reset restores the committed defaults", () => {
  const defaultsPath = path.join(__dirname, "..", "public", "default-needs.json");
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));
  const validation = validateNeedCatalogue(defaults);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.needs.map((need) => need.name), [
    "hunger",
    "thirst",
    "rest",
    "comfort",
    "entertainment",
    "social",
    "safety",
    "curiosity",
    "bladder",
    "hygiene",
    "physical_activity",
    "mental_activity"
  ]);
});
