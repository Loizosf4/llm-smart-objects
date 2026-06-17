import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.js";

function need(name, definition = `The need for ${name}.`) {
  return {
    name,
    definition,
    weakReference: {
      example: `${name}_weak_object -> weak_${name}`,
      weight: 0.1
    },
    strongReference: {
      example: `${name}_strong_object -> strong_${name}`,
      weight: 1.0
    }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("API repairs invalid first LLM output once", async () => {
  const requests = [];
  const calls = [
    JSON.stringify({
      location: "break room",
      objects: [
        {
          id: "poster_01",
          type: "poster",
          capacity: { type: "unlimited", slots: 2 },
          interactions: [
            {
              id: "look_at_poster",
              duration: { type: "fixed", seconds: 20 },
              availability: { type: "always" },
              advertisements: [{ need: "thirst", weight: 0.5 }]
            }
          ]
        }
      ]
    }),
    JSON.stringify({
      location: "break room",
      objects: [
        {
          id: "water_dispenser_01",
          type: "water_dispenser",
          capacity: { type: "limited", slots: 1 },
          interactions: [
            {
              id: "drink_water",
              duration: { type: "fixed", seconds: 20 },
              availability: { type: "when_capacity_available" },
              advertisements: [{ need: "thirst", weight: 0.9 }]
            }
          ]
        }
      ]
    })
  ];

  const app = createApp({
    llmClient: async (request) => {
      requests.push(request);
      return calls.shift();
    }
  });
  const server = await listen(app);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/generate-smart-objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationDescription: "break room",
        needs: [need("thirst", "The need to drink.")]
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.objects[0].type, "water_dispenser");
    assert.deepEqual(payload.data.objects[0].capacity, { type: "limited", slots: 1 });
    assert.equal(payload.data.objects[0].interactions[0].id, "drink_water");
    assert.deepEqual(payload.data.objects[0].interactions[0].duration, { type: "fixed", seconds: 20 });
    assert.deepEqual(payload.data.objects[0].interactions[0].availability, { type: "when_capacity_available" });
    assert.equal(requests.length, 2);
    assert.match(requests[0].prompt, /Generate a concise set/);
    assert.match(requests[1].prompt, /Correct the invalid/);
    assert.match(requests[1].prompt, /Unlimited capacity on object "poster_01" must not contain slots/);
    assert.deepEqual(
      requests[0].responseSchema.properties.objects.items.properties.interactions.items
        .properties.advertisements.items.properties.need.enum,
      ["thirst"]
    );
    assert.equal(
      requests[0].responseSchema.properties.objects.items.properties.interactions.items
        .properties.duration.properties.type.enum.includes("fixed"),
      true
    );
    assert.deepEqual(
      requests[0].responseSchema.properties.objects.items.properties.capacity.properties.type.enum,
      ["limited", "unlimited"]
    );
    assert.deepEqual(
      requests[0].responseSchema.properties.objects.items.properties.interactions.items
        .properties.availability.properties.type.enum,
      ["always", "when_capacity_available"]
    );
  } finally {
    await close(server);
  }
});

test("API repairs inconsistent availability once", async () => {
  const calls = [
    JSON.stringify({
      location: "break room",
      objects: [
        {
          id: "sofa_01",
          type: "three_seat_sofa",
          capacity: { type: "limited", slots: 3 },
          interactions: [
            {
              id: "sit_and_relax",
              duration: { type: "continuous" },
              availability: { type: "always" },
              advertisements: [{ need: "rest", weight: 0.6 }]
            }
          ]
        }
      ]
    }),
    JSON.stringify({
      location: "break room",
      objects: [
        {
          id: "sofa_01",
          type: "three_seat_sofa",
          capacity: { type: "limited", slots: 3 },
          interactions: [
            {
              id: "sit_and_relax",
              duration: { type: "continuous" },
              availability: { type: "when_capacity_available" },
              advertisements: [{ need: "rest", weight: 0.6 }]
            }
          ]
        }
      ]
    })
  ];

  const app = createApp({
    llmClient: async () => calls.shift()
  });
  const server = await listen(app);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/generate-smart-objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationDescription: "break room",
        needs: [need("rest", "Recover.")]
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data.objects[0].interactions[0].availability, { type: "when_capacity_available" });
  } finally {
    await close(server);
  }
});

test("API rejects duplicate need names before calling LLM", async () => {
  let called = false;
  const app = createApp({
    llmClient: async () => {
      called = true;
      return "{}";
    }
  });
  const server = await listen(app);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/generate-smart-objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationDescription: "break room",
        needs: [
          need("rest", "Recover."),
          need("rest", "Duplicate.")
        ]
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(called, false);
  } finally {
    await close(server);
  }
});
