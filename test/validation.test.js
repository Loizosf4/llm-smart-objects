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
    requirements: [],
    effects: [],
    advertisements: [{ need: "rest", weight: 0.6 }],
    ...overrides
  };
}

function object(overrides = {}) {
  return {
    id: "sofa_01",
    type: "sofa",
    capacity: { type: "limited", slots: 3 },
    stateFlags: [],
    resources: [],
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
        stateFlags: [],
        resources: [],
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

test("passive object with empty state and resource arrays passes", () => {
  const result = validateSmartObjectOutput(output(), needs);
  assert.equal(result.valid, true);
});

test("valid state declaration and requirement passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        stateFlags: [{ id: "operational", initial: true }],
        interactions: [
          interaction({
            requirements: [{ type: "state_equals", state: "operational", value: true }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("valid state declaration and state effect passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        stateFlags: [{ id: "open", initial: false }],
        interactions: [
          interaction({
            id: "open_cabinet",
            effects: [{ type: "set_state", state: "open", value: true }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("valid resource declaration and requirement passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        resources: [{ id: "snack_units", initial: 12, maximum: 20 }],
        interactions: [
          interaction({
            requirements: [{ type: "resource_at_least", resource: "snack_units", amount: 1 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("valid negative resource change passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        resources: [{ id: "coffee_servings", initial: 20, maximum: 20 }],
        interactions: [
          interaction({
            effects: [{ type: "change_resource", resource: "coffee_servings", amount: -1 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("valid positive resource change passes", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        resources: [{ id: "paper_sheets", initial: 0, maximum: 100 }],
        interactions: [
          interaction({
            id: "refill_paper",
            effects: [{ type: "change_resource", resource: "paper_sheets", amount: 20 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("state and resource declarations are shared across interactions", () => {
  const result = validateSmartObjectOutput(output({
    objects: [
      object({
        stateFlags: [{ id: "operational", initial: true }],
        resources: [{ id: "snack_units", initial: 4, maximum: 10 }],
        interactions: [
          interaction({
            id: "check_machine",
            requirements: [{ type: "state_equals", state: "operational", value: true }]
          }),
          interaction({
            id: "get_snack",
            requirements: [{ type: "resource_at_least", resource: "snack_units", amount: 1 }],
            effects: [{ type: "change_resource", resource: "snack_units", amount: -1 }]
          })
        ]
      })
    ]
  }), needs);
  assert.equal(result.valid, true);
});

test("missing stateFlags fails", () => {
  const { stateFlags, ...rawObject } = object();
  const result = validateSmartObjectOutput(output({ objects: [rawObject] }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing stateFlags/);
});

test("unsupported state ID fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ stateFlags: [{ id: "occupied", initial: false }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported state flag "occupied"/);
});

test("duplicate state IDs fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      stateFlags: [
        { id: "operational", initial: true },
        { id: "operational", initial: false }
      ],
      interactions: [interaction({ requirements: [{ type: "state_equals", state: "operational", value: true }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate state flag "operational"/);
});

test("non-Boolean initial state fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ stateFlags: [{ id: "operational", initial: "true" }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /requires Boolean initial value/);
});

test("extra state field fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ stateFlags: [{ id: "operational", initial: true, since: "now" }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown state flag field "since"/);
});

test("unused state declaration fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ stateFlags: [{ id: "operational", initial: true }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /declared but never referenced/);
});

test("missing resources fails", () => {
  const { resources, ...rawObject } = object();
  const result = validateSmartObjectOutput(output({ objects: [rawObject] }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing resources/);
});

test("invalid resource ID fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "Snack Units", initial: 1, maximum: 2 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Invalid resource id/);
});

test("duplicate resource IDs fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      resources: [
        { id: "snack_units", initial: 1, maximum: 2 },
        { id: "snack_units", initial: 1, maximum: 2 }
      ],
      interactions: [interaction({ requirements: [{ type: "resource_at_least", resource: "snack_units", amount: 1 }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate resource id "snack_units"/);
});

test("resource initial below zero fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "snack_units", initial: -1, maximum: 2 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /initial value must be between 0 and 100000/);
});

test("resource initial greater than maximum fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "snack_units", initial: 3, maximum: 2 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /initial value greater than maximum/);
});

test("resource maximum below one fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "snack_units", initial: 0, maximum: 0 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /maximum value must be between 1 and 100000/);
});

test("fractional resource values fail", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "snack_units", initial: 1.5, maximum: 2 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /initial value must be an integer/);
});

test("extra resource field fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "snack_units", initial: 1, maximum: 2, current_users: 0 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown resource field "current_users"/);
});

test("unused resource declaration fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ resources: [{ id: "snack_units", initial: 1, maximum: 2 }] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Resource "snack_units" on object "sofa_01" is declared but never referenced/);
});

test("missing requirements fails", () => {
  const { requirements, ...rawInteraction } = interaction();
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [rawInteraction] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing requirements/);
});

test("unknown requirement type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ requirements: [{ type: "npc_need_at_least", need: "hunger", amount: 0.5 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported requirement type/);
});

test("invalid state_equals shape fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      stateFlags: [{ id: "operational", initial: true }],
      interactions: [interaction({ requirements: [{ type: "state_equals", state: "operational", value: true, resource: "snack_units" }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain resource fields/);
});

test("undeclared state requirement fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ requirements: [{ type: "state_equals", state: "operational", value: true }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /references undeclared state "operational"/);
});

test("invalid resource_at_least shape fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      resources: [{ id: "snack_units", initial: 1, maximum: 2 }],
      interactions: [interaction({ requirements: [{ type: "resource_at_least", resource: "snack_units", amount: 1, value: true }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain state fields/);
});

test("undeclared resource requirement fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ requirements: [{ type: "resource_at_least", resource: "snack_units", amount: 1 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /references undeclared resource "snack_units"/);
});

test("resource requirement amount below one fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      resources: [{ id: "snack_units", initial: 1, maximum: 2 }],
      interactions: [interaction({ requirements: [{ type: "resource_at_least", resource: "snack_units", amount: 0 }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /requires integer amount between 1 and 100000/);
});

test("extra requirement field fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ requirements: [{ type: "state_equals", state: "operational", value: true, role: "staff" }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown requirement field "role"/);
});

test("duplicate identical requirement fails", () => {
  const req = { type: "state_equals", state: "operational", value: true };
  const result = validateSmartObjectOutput(output({
    objects: [object({
      stateFlags: [{ id: "operational", initial: true }],
      interactions: [interaction({ requirements: [req, req] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate requirement/);
});

test("capacity requirement field fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ requirements: [{ type: "resource_at_least", resource: "capacity_slots", amount: 1, available_slots: 1 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown requirement field "available_slots"/);
});

test("missing effects fails", () => {
  const { effects, ...rawInteraction } = interaction();
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [rawInteraction] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /missing effects/);
});

test("unknown effect type fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ effects: [{ type: "satisfy_need", need: "hunger", amount: 0.5 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported effect type/);
});

test("invalid set_state shape fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      stateFlags: [{ id: "open", initial: false }],
      interactions: [interaction({ effects: [{ type: "set_state", state: "open", value: true, amount: 1 }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain resource fields/);
});

test("undeclared state effect fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ effects: [{ type: "set_state", state: "open", value: true }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /references undeclared state "open"/);
});

test("invalid change_resource shape fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      resources: [{ id: "snack_units", initial: 1, maximum: 2 }],
      interactions: [interaction({ effects: [{ type: "change_resource", resource: "snack_units", amount: -1, state: "open" }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /must not contain state fields/);
});

test("undeclared resource effect fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ effects: [{ type: "change_resource", resource: "snack_units", amount: -1 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /references undeclared resource "snack_units"/);
});

test("zero resource-change amount fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      resources: [{ id: "snack_units", initial: 1, maximum: 2 }],
      interactions: [interaction({ effects: [{ type: "change_resource", resource: "snack_units", amount: 0 }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /non-zero integer amount/);
});

test("fractional resource-change amount fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({
      resources: [{ id: "snack_units", initial: 1, maximum: 2 }],
      interactions: [interaction({ effects: [{ type: "change_resource", resource: "snack_units", amount: -0.5 }] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /non-zero integer amount/);
});

test("extra effect field fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ effects: [{ type: "set_state", state: "open", value: true, queue_length: 1 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown effect field "queue_length"/);
});

test("duplicate identical effect fails", () => {
  const effect = { type: "set_state", state: "open", value: true };
  const result = validateSmartObjectOutput(output({
    objects: [object({
      stateFlags: [{ id: "open", initial: false }],
      interactions: [interaction({ effects: [effect, effect] })]
    })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate effect/);
});

test("need-change effect fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ effects: [{ type: "change_need", need: "hunger", amount: -1 }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unsupported effect type/);
});

test("occupancy effect fails", () => {
  const result = validateSmartObjectOutput(output({
    objects: [object({ interactions: [interaction({ effects: [{ type: "change_resource", resource: "current_users", amount: 1, occupant_ids: ["npc_01"] }] })] })]
  }), needs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown effect field "occupant_ids"/);
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
