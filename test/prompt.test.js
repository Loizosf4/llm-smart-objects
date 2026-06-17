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

test("prompt includes the object-instance rule", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Each generated object entry represents one object instance/);
  assert.match(prompt, /chair_01 is one chair, chair_02 is a second chair/);
});

test("prompt distinguishes object capacity from object count", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Capacity does not represent the number of object copies/);
  assert.match(prompt, /Do not create chair_01 with slots 5/);
});

test("prompt includes capacity and availability consistency rules", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /limited capacity -> when_capacity_available/);
  assert.match(prompt, /unlimited capacity -> always/);
  assert.match(prompt, /Do not generate the old when_free availability value/);
});

test("prompt instructs use of empty arrays", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Use empty arrays when no state, stock, requirement, or effect is needed/);
  assert.match(prompt, /sofa -> no state flags -> no resources -> empty requirements -> empty effects/);
});

test("prompt warns against over-modelling", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Avoid over-modelling simple objects/);
  assert.match(prompt, /Do not give every electronic device all possible states/);
});

test("prompt forbids NPC-specific requirements", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /Requirements must be object-side only/);
  assert.match(prompt, /NPC inventory, NPC money/);
});

test("prompt forbids runtime state execution", () => {
  const prompt = buildSmartObjectPrompt({ locationDescription: "staff room", needs });
  assert.match(prompt, /This generator does not execute them/);
  assert.match(prompt, /Do not generate runtime state engine/);
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

test("repair prompt includes capacity consistency rules", () => {
  const prompt = buildSmartObjectRepairPrompt({
    invalidOutput: "{}",
    validationErrors: ["invalid"],
    locationDescription: "staff room",
    needs
  });
  assert.match(prompt, /Every object must contain a capacity object/);
  assert.match(prompt, /limited capacity -> when_capacity_available/);
  assert.match(prompt, /Unlimited capacity must omit slots/);
});

test("repair prompt includes declaration and reference rules", () => {
  const prompt = buildSmartObjectRepairPrompt({
    invalidOutput: "{}",
    validationErrors: ["invalid"],
    locationDescription: "staff room",
    needs
  });
  assert.match(prompt, /Every object must contain stateFlags and resources arrays/);
  assert.match(prompt, /Every declared state or resource must be referenced/);
  assert.match(prompt, /Requirements and effects must reference declarations on the same parent object only/);
});

test("dynamic generated-output need enum still uses only need names", () => {
  const schema = buildSmartObjectResponseSchema(needs);
  assert.deepEqual(
    schema.properties.objects.items.properties.interactions.items
      .properties.advertisements.items.properties.need.enum,
    ["rest", "hygiene"]
  );
});
