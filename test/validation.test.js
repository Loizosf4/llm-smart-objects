import assert from "node:assert/strict";
import test from "node:test";
import { validateGenerationRequest } from "../src/validation/validateGenerationRequest.js";
import { validateSmartObjectOutput } from "../src/validation/validateSmartObjectOutput.js";

const needs = [
  { name: "rest", definition: "The need to recover from tiredness." },
  { name: "thirst", definition: "The need to drink." }
];

function requestNeed(overrides = {}) {
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

function requestBody(needsOverride = [requestNeed()]) {
  return {
    locationDescription: "break room",
    needs: needsOverride
  };
}

function interaction(overrides = {}) {
  return {
    id: "sit_and_relax",
    duration: { type: "continuous" },
    availability: { type: "when_capacity_available" },
    advertisements: [{ need: "rest", weight: 0.6 }],
    ...overrides
  };
}

function object(overrides = {}) {
  return {
    id: "sofa_01",
    type: "sofa",
    capacity: { type: "limited", slots: 3 },
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

test("valid limited capacity with one slot passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        id: "single_chair_01",
        type: "single_chair",
        capacity: { type: "limited", slots: 1 }
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("valid limited capacity with multiple slots passes", () => {
  const result = validateSmartObjectOutput(output(), needs);
  assert.equal(result.valid, true);
});

test("valid unlimited capacity passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        id: "television_01",
        type: "television",
        capacity: { type: "unlimited" },
        interactions: [
          interaction({ availability: { type: "always" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("old when_free availability fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "when_free" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /when_free/);
});

test("missing capacity fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      {
        id: "sofa_01",
        type: "sofa",
        interactions: [interaction()]
      }
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing capacity/);
});

test("capacity as a string fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: "limited" })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must be an object/);
});

test("missing capacity type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { slots: 3 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Capacity on object "sofa_01" is missing type/);
});

test("unknown capacity type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "shared", slots: 3 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported capacity type "shared"/);
});

test("limited capacity without slots fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "limited" } })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /requires slots/);
});

test("limited capacity with zero slots fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "limited", slots: 0 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /integer between 1 and 100/);
});

test("limited capacity with negative slots fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "limited", slots: -1 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("limited capacity with fractional slots fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "limited", slots: 1.5 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /integer between 1 and 100/);
});

test("limited capacity above 100 fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "limited", slots: 101 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("unlimited capacity containing slots fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        capacity: { type: "unlimited", slots: 5 },
        interactions: [interaction({ availability: { type: "always" } })]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain slots/);
});

test("extra field inside capacity fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({ capacity: { type: "limited", slots: 3, occupied: 1 } })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown capacity field "occupied"/);
});

test("capacity inside an interaction fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ capacity: { type: "limited", slots: 1 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Capacity belongs to the object/);
});

test("limited object with always fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "always" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /limited object "sofa_01" must use availability "when_capacity_available"/);
});

test("unlimited object with when_capacity_available fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        capacity: { type: "unlimited" },
        interactions: [
          interaction({ availability: { type: "when_capacity_available" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /unlimited object "sofa_01" must use availability "always"/);
});

test("limited object with when_capacity_available passes", () => {
  const result = validateSmartObjectOutput(output(), needs);
  assert.equal(result.valid, true);
});

test("unlimited object with always passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        id: "notice_board_01",
        type: "notice_board",
        capacity: { type: "unlimited" },
        interactions: [
          interaction({ id: "read_information", availability: { type: "always" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("different objects may have different capacities", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object(),
      object({
        id: "radio_01",
        type: "radio",
        capacity: { type: "unlimited" },
        interactions: [
          interaction({ id: "listen_to_radio", availability: { type: "always" } })
        ]
      })
    ]
  }), needs);
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
            availability: { type: "when_capacity_available" },
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
            availability: { type: "when_capacity_available" },
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
        capacity: { type: "limited", slots: 1 },
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
            duration: { type: "continuous" },
            availability: { type: "when_capacity_available" }
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
          interaction({ mood: "relaxed" })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
});

test("missing availability fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          {
            id: "sit_and_relax",
            duration: { type: "continuous" },
            advertisements: [{ need: "rest", weight: 0.5 }]
          }
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing availability/);
});

test("availability as a string fails", () => {
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
  assert.match(result.errors.join(" "), /must be an object/);
});

test("missing availability type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: {} })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing type/);
});

test("unknown availability type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "sometimes" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported availability type "sometimes"/);
});

test("extra availability field fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "always", reason: "shared" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown availability field "reason"/);
});

test("capacity inside availability fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "when_capacity_available", capacity: 3 } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown availability field "capacity"/);
});

test("runtime field occupied fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "when_capacity_available", occupied: false } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not include "occupied"/);
});

test("runtime field current_users fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "when_capacity_available", current_users: [] } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not include "current_users"/);
});

test("runtime field reserved_by fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ availability: { type: "when_capacity_available", reserved_by: "npc_01" } })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not include "reserved_by"/);
});

test("availability is required on every interaction", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction(),
          {
            id: "nap",
            duration: { type: "continuous" },
            advertisements: [{ need: "rest", weight: 0.7 }]
          }
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Interaction "nap" of object "sofa_01" is missing availability/);
});

test("multiple interactions on one object share the same object capacity structure", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        interactions: [
          interaction({ id: "sit_and_relax" }),
          interaction({ id: "socialize_while_seated" })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("malformed JSON produces a controlled error", () => {
  const result = validateSmartObjectOutput("{ not json", needs);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["Generated output was not valid JSON."]);
});

test("request with duplicate need definitions fails before the LLM call", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ definition: "Recover." }),
    requestNeed({ definition: "Duplicate." })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /Duplicate need name/);
});

test("valid need with both references passes request validation", () => {
  const result = validateGenerationRequest(requestBody());
  assert.equal(result.valid, true);
});

test("missing weak reference fails request validation", () => {
  const { weakReference, ...need } = requestNeed();
  const result = validateGenerationRequest(requestBody([need]));
  assert.equal(result.valid, false);
  assert.match(result.error, /missing a weak reference/);
});

test("missing weak example fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ weakReference: { weight: 0.05 } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /missing a weak reference example/);
});

test("missing weak weight fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ weakReference: { example: "wall -> lean_against_wall" } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /missing a weak reference weight/);
});

test("missing strong reference fails request validation", () => {
  const { strongReference, ...need } = requestNeed();
  const result = validateGenerationRequest(requestBody([need]));
  assert.equal(result.valid, false);
  assert.match(result.error, /missing a strong reference/);
});

test("missing strong example fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ strongReference: { weight: 1.0 } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /missing a strong reference example/);
});

test("missing strong weight fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ strongReference: { example: "bed -> sleep" } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /missing a strong reference weight/);
});

test("weak weight below zero fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ weakReference: { example: "wall -> lean_against_wall", weight: -0.01 } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /weak reference weight must be between 0 and 1/);
});

test("weak weight above one fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ weakReference: { example: "wall -> lean_against_wall", weight: 1.1 } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /weak reference weight must be between 0 and 1/);
});

test("strong weight below zero fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ strongReference: { example: "bed -> sleep", weight: -0.01 } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /strong reference weight must be between 0 and 1/);
});

test("strong weight above one fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ strongReference: { example: "bed -> sleep", weight: 1.1 } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /strong reference weight must be between 0 and 1/);
});

test("non-numeric reference weight fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ weakReference: { example: "wall -> lean_against_wall", weight: "0.05" } })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /weak reference weight must be numeric/);
});

test("weak weight equal to strong weight fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({
      weakReference: { example: "wall -> lean_against_wall", weight: 1.0 }
    })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /weak reference weight must be lower/);
});

test("weak weight greater than strong weight fails request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({
      weakReference: { example: "wall -> lean_against_wall", weight: 0.8 },
      strongReference: { example: "bed -> sleep", weight: 0.7 }
    })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /weak reference weight must be lower/);
});

test("unknown extra need fields fail request validation", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({ displayName: "Rest" })
  ]));
  assert.equal(result.valid, false);
  assert.match(result.error, /unsupported field "displayName"/);
});

test("normalized request retains full reference structures", () => {
  const result = validateGenerationRequest(requestBody([
    requestNeed({
      name: "rest",
      definition: " Recover. ",
      weakReference: { example: " wall -> lean_against_wall ", weight: 0.05 },
      strongReference: { example: " bed -> sleep ", weight: 1.0 }
    })
  ]));
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.needs[0], {
    name: "rest",
    definition: "Recover.",
    weakReference: {
      example: "wall -> lean_against_wall",
      weight: 0.05
    },
    strongReference: {
      example: "bed -> sleep",
      weight: 1.0
    }
  });
});
