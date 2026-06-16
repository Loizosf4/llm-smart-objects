import assert from "node:assert/strict";
import test from "node:test";
import { validateGenerationRequest } from "../src/validation/validateGenerationRequest.js";
import { validateSmartObjectOutput } from "../src/validation/validateSmartObjectOutput.js";

const needs = [
  { name: "rest", definition: "The need to recover from tiredness." },
  { name: "thirst", definition: "The need to drink." }
];

function interaction(overrides = {}) {
  return {
    id: "sit_and_relax",
    duration: { type: "continuous" },
    advertisements: [{ need: "rest", weight: 0.6 }],
    ...overrides
  };
}

function object(overrides = {}) {
  return {
    id: "sofa_01",
    type: "sofa",
    interactions: [interaction()],
    ...overrides
  };
}

function output(overrides = {}) {
  return JSON.stringify({
    location: "break room",
    objects: [object()],
    ...overrides
  });
}

test("valid continuous duration passes", () => {
  const result = validateSmartObjectOutput(output(), needs);
  assert.equal(result.valid, true);
});

test("valid instant duration passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({
            id: "turn_on_light",
            duration: { type: "instant" }
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("valid fixed duration with seconds passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({
            id: "drink_water",
            duration: { type: "fixed", seconds: 30 },
            advertisements: [{ need: "thirst", weight: 0.8 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("missing duration fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          {
            id: "sit_and_relax",
            advertisements: [{ need: "rest", weight: 0.5 }]
          }
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("unknown duration type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ duration: { type: "brief" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("fixed duration without seconds fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "drink_water", duration: { type: "fixed" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /requires seconds/);
});

test("fixed duration with zero seconds fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "drink_water", duration: { type: "fixed", seconds: 0 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("fixed duration with negative seconds fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "drink_water", duration: { type: "fixed", seconds: -1 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("fixed duration above 86400 fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "sleep", duration: { type: "fixed", seconds: 86401 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("fixed duration with non-numeric seconds fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "drink_water", duration: { type: "fixed", seconds: "30" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("instant duration containing seconds fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "turn_on_light", duration: { type: "instant", seconds: 1 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain seconds/);
});

test("continuous duration containing seconds fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ duration: { type: "continuous", seconds: 600 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain seconds/);
});

test("extra field inside duration fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ duration: { type: "continuous", scale: "minutes" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("object-level advertisements fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        advertisements: [{ need: "rest", weight: 0.5 }]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("missing interactions fail", () => {
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

test("empty interactions fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [] })]
  }), needs);
  assert.equal(result.valid, false);
});

test("missing interaction ID fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          {
            duration: { type: "continuous" },
            advertisements: [{ need: "rest", weight: 0.5 }]
          }
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("invalid interaction ID format fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "Sit And Relax" })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("duplicate interaction IDs within one object fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction(),
          interaction({ advertisements: [{ need: "rest", weight: 0.4 }] })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate interaction id/);
});

test("same interaction ID on different objects is allowed", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object(),
      {
        id: "armchair_01",
        type: "armchair",
        interactions: [
          interaction({ advertisements: [{ need: "rest", weight: 0.5 }] })
        ]
      }
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("missing interaction advertisements fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          {
            id: "sit_and_relax",
            duration: { type: "continuous" }
          }
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("unknown need inside an interaction fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({
            id: "wash_hands",
            duration: { type: "fixed", seconds: 30 },
            advertisements: [{ need: "hygiene", weight: 0.8 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported need/);
});

test("duplicate need advertisement within one interaction fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({
            advertisements: [
              { need: "rest", weight: 0.6 },
              { need: "rest", weight: 0.4 }
            ]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate advertisement/);
});

test("weight below 0.0 fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({
            id: "drink_water",
            duration: { type: "fixed", seconds: 20 },
            advertisements: [{ need: "thirst", weight: -0.1 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("weight above 1.0 fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({
            id: "drink_water",
            duration: { type: "fixed", seconds: 20 },
            advertisements: [{ need: "thirst", weight: 1.1 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("duplicate object ids fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object(),
      object({ type: "couch" })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate object id/);
});

test("extra fields on an interaction fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: "always" })
        ]
      })
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
