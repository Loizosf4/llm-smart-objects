import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.js";

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
  const calls = [
    JSON.stringify({
      location: "break room",
      objects: [
        {
          id: "poster_01",
          type: "poster",
          advertisements: [{ need: "unknown", weight: 0.5 }]
        }
      ]
    }),
    JSON.stringify({
      location: "break room",
      objects: [
        {
          id: "water_dispenser_01",
          type: "water_dispenser",
          advertisements: [{ need: "thirst", weight: 0.9 }]
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
        needs: [{ name: "thirst", definition: "The need to drink." }]
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.objects[0].type, "water_dispenser");
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
          { name: "rest", definition: "Recover." },
          { name: "rest", definition: "Duplicate." }
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
