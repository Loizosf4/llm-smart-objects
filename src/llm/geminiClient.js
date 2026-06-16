const DEFAULT_TEMPERATURE = 0.35;
const DEFAULT_TIMEOUT_MS = 60000;

function getTimeoutMs() {
  const configuredTimeout = Number(process.env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS;
}

async function readProviderError(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.error?.status || "";
  } catch {
    return "";
  }
}

function buildProviderError(status, providerMessage) {
  return providerMessage
    ? `Gemini request failed with status ${status}: ${providerMessage}`
    : `Gemini request failed with status ${status}.`;
}

export async function generateGeminiText({ prompt, responseSchema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const timeoutMs = getTimeoutMs();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!model) {
    throw new Error("GEMINI_MODEL is not configured.");
  }

  if (!responseSchema) {
    throw new Error("Gemini response schema is not configured.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: DEFAULT_TEMPERATURE,
          responseFormat: {
            text: {
              mimeType: "application/json",
              schema: responseSchema
            }
          }
        }
      })
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const providerMessage = await readProviderError(response);
    throw new Error(buildProviderError(response.status, providerMessage));
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("");

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
