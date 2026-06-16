import assert from "node:assert/strict";
import test from "node:test";
import { generateGeminiText } from "../src/llm/geminiClient.js";
import { buildSmartObjectResponseSchema } from "../src/validation/smartObjectSchema.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreGlobals() {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
}

function configureGeminiEnv(overrides = {}) {
  process.env.GEMINI_API_KEY = overrides.apiKey ?? "test-api-key";
  process.env.GEMINI_MODEL = overrides.model ?? "gemini-2.5-flash";
  process.env.GEMINI_TIMEOUT_MS = overrides.timeout ?? "60000";
}

function responseSchema() {
  return buildSmartObjectResponseSchema([
    { name: "rest", definition: "Recover from tiredness." },
    { name: "comfort", definition: "Feel physically at ease." },
    { name: "entertainment", definition: "Reduce boredom." }
  ]);
}

test("Gemini request uses API key header and keeps key out of URL", async (t) => {
  t.after(restoreGlobals);
  configureGeminiEnv({ apiKey: "secret-key", model: "gemini-2.5-flash" });

  let capturedUrl = "";
  let capturedOptions;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "{\"location\":\"break room\",\"objects\":[]}" }]
            }
          }
        ]
      })
    };
  };

  await generateGeminiText({ prompt: "Generate JSON.", responseSchema: responseSchema() });

  assert.equal(capturedOptions.headers["x-goog-api-key"], "secret-key");
  assert.equal(capturedUrl.includes("secret-key"), false);
  assert.match(capturedUrl, /models\/gemini-2\.5-flash:generateContent$/);
});

test("Gemini request contains structured output config with need enum", async (t) => {
  t.after(restoreGlobals);
  configureGeminiEnv();

  let capturedBody;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "{\"location\":\"break room\",\"objects\":[]}" }]
            }
          }
        ]
      })
    };
  };

  await generateGeminiText({ prompt: "Generate JSON.", responseSchema: responseSchema() });

  const textFormat = capturedBody.generationConfig.responseFormat.text;
  assert.equal(capturedBody.generationConfig.temperature, 0.35);
  assert.equal(textFormat.mimeType, "application/json");
  assert.deepEqual(
    textFormat.schema.properties.objects.items.properties.advertisements.items.properties.need.enum,
    ["rest", "comfort", "entertainment"]
  );
});

test("Gemini non-success responses include readable provider errors", async (t) => {
  t.after(restoreGlobals);
  configureGeminiEnv();

  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({
      error: {
        message: "quota exceeded."
      }
    })
  });

  await assert.rejects(
    () => generateGeminiText({ prompt: "Generate JSON.", responseSchema: responseSchema() }),
    /Gemini request failed with status 429: quota exceeded\./
  );
});

test("Gemini non-success responses fall back to status when body parsing fails", async (t) => {
  t.after(restoreGlobals);
  configureGeminiEnv();

  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => {
      throw new Error("not json");
    }
  });

  await assert.rejects(
    () => generateGeminiText({ prompt: "Generate JSON.", responseSchema: responseSchema() }),
    /Gemini request failed with status 400\./
  );
});

test("Gemini timeout failures are handled cleanly", async (t) => {
  t.after(restoreGlobals);
  configureGeminiEnv({ timeout: "5" });

  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  await assert.rejects(
    () => generateGeminiText({ prompt: "Generate JSON.", responseSchema: responseSchema() }),
    /Gemini request timed out after 5ms\./
  );
});
