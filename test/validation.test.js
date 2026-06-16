import assert from "node:assert/strict";
import test from "node:test";
import { validateGenerationRequest } from "../src/validation/validateGenerationRequest.js";
import { validateSmartObjectOutput } from "../src/validation/validateSmartObjectOutput.js";

const needs = [
  { name: "rest", definition: "The need to recover from tiredness." },
  { name: "thirst", definition: "The need to drink." }
];

function output(overrides = {}) {
  return JSON.stringify({
    location: "break room",
    objects: [
      {
        id: "sofa_01",
        type: "sofa",
        advertisements: [{ need: "rest", weight: 0.6 }]
      }
    ],
    ...overrides
  });
}

test("valid output passes", () => {
  const result = validateSmartObjectOutput(output(), needs);
  assert.equal(result.valid, true);
});

test("unknown need fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "sink_01",
        type: "sink",
        advertisements: [{ need: "hygiene", weight: 0.8 }]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported need/);
});

test("weight below 0.0 fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "water_01",
        type: "water_dispenser",
        advertisements: [{ need: "thirst", weight: -0.1 }]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("weight above 1.0 fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "water_01",
        type: "water_dispenser",
        advertisements: [{ need: "thirst", weight: 1.1 }]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("duplicate object ids fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "sofa_01",
        type: "sofa",
        advertisements: [{ need: "rest", weight: 0.6 }]
      },
      {
        id: "sofa_01",
        type: "couch",
        advertisements: [{ need: "rest", weight: 0.5 }]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate object id/);
});

test("duplicate need advertisements on one object fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "sofa_01",
        type: "sofa",
        advertisements: [
          { need: "rest", weight: 0.6 },
          { need: "rest", weight: 0.4 }
        ]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate advertisement/);
});

test("missing advertisements fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "sofa_01",
        type: "sofa"
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("extra fields fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "sofa_01",
        type: "sofa",
        capacity: 2,
        advertisements: [{ need: "rest", weight: 0.6 }]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("malformed JSON produces a controlled error", () => {
  const result = validateSmartObjectOutput("{ not json", needs);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["Generated output was not valid JSON."]);
});

test("request with duplicate need definitions fails before the LLM call", () => {
  const result = validateGenerationRequest({
    locationDescription: "break room",
    needs: [
      { name: "rest", definition: "Recover." },
      { name: "rest", definition: "Duplicate." }
    ]
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /Duplicate need name/);
});
