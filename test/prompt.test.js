import assert from "node:assert/strict";
import test from "node:test";
import { buildSmartObjectPrompt, buildSmartObjectRepairPrompt } from "../src/llm/buildSmartObjectPrompt.js";
import { buildSmartObjectResponseSchema } from "../src/validation/smartObjectSchema.js";

const needs = [
  {
    name: "rest",
    definition: "The urgency to recover from physical or mental fatigue.",
    weakReference: {
      example: "wall -> lean_against_wall",
      weight: 0.05
    },
    strongReference: {
      example: "bed -> sleep",
      weight: 1.0
    }
  },
  {
    name: "hygiene",
    definition: "The urgency to restore personal cleanliness.",
    weakReference: {
      example: "sink -> wash_hands",
      weight: 0.2
    },
    strongReference: {
      example: "shower -> take_thorough_shower",
      weight: 0.9
    }
  }
];

test("prompt includes weak and strong calibration references", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Need: rest/);
  assert.match(prompt, /Weak calibration reference:\n- interaction: wall -> lean_against_wall/);
  assert.match(prompt, /Strong calibration reference:\n- interaction: bed -> sleep/);
});

test("prompt identifies reference weights", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /- weight: 0\.05/);
  assert.match(prompt, /- weight: 1/);
});

test("prompt states references are calibration examples only", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Calibration references define the approximate low and high ends/);
  assert.match(prompt, /The references are examples, not mandatory objects for the location/);
});

test("prompt says not to automatically generate reference objects", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Do not generate a reference object merely because it appears in the calibration context/);
});

test("prompt includes the new generic weight bands", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /0\.01-0\.19 = minimal effect/);
  assert.match(prompt, /0\.80-1\.00 = very strong effect/);
});

test("repair prompt also includes calibration references", () => {
  const prompt = buildSmartObjectRepairPrompt({
    invalidOutput: "{}",
    validationErrors: ["invalid"],
    locationDescription: "staff room",
    needs
  });
  assert.match(prompt, /Weak calibration reference:\n- interaction: sink -> wash_hands/);
  assert.match(prompt, /Strong calibration reference:\n- interaction: shower -> take_thorough_shower/);
  assert.match(prompt, /references are examples only/);
});

test("dynamic generated-output need enum still uses only need names", () => {
  const schema = buildSmartObjectResponseSchema(needs);
  assert.deepEqual(
    schema.properties.objects.items.properties.interactions.items
      .properties.advertisements.items.properties.need.enum,
    ["rest", "hygiene"]
  );
});
