import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSmartObjectPrompt, buildSmartObjectRepairPrompt } from "./src/llm/buildSmartObjectPrompt.js";
import { generateGeminiText } from "./src/llm/geminiClient.js";
import { buildSmartObjectResponseSchema } from "./src/validation/smartObjectSchema.js";
import { validateGenerationRequest } from "./src/validation/validateGenerationRequest.js";
import { validateSmartObjectOutput } from "./src/validation/validateSmartObjectOutput.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(options = {}) {
  const app = express();
  const llmClient = options.llmClient ?? generateGeminiText;

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, status: "ok" });
  });

  app.post("/api/generate-smart-objects", async (req, res) => {
    const requestValidation = validateGenerationRequest(req.body);
    if (!requestValidation.valid) {
      return res.status(400).json({ success: false, error: requestValidation.error });
    }

    const { locationDescription, needs } = requestValidation.value;
    const prompt = buildSmartObjectPrompt({ locationDescription, needs });
    const responseSchema = buildSmartObjectResponseSchema(needs);

    try {
      const firstText = await llmClient({ prompt, responseSchema });
      const firstValidation = validateSmartObjectOutput(firstText, needs);

      if (firstValidation.valid) {
        return res.json({ success: true, data: firstValidation.data });
      }

      const repairPrompt = buildSmartObjectRepairPrompt({
        invalidOutput: firstText,
        validationErrors: firstValidation.errors,
        locationDescription,
        needs
      });
      const repairText = await llmClient({ prompt: repairPrompt, responseSchema });
      const repairValidation = validateSmartObjectOutput(repairText, needs);

      if (repairValidation.valid) {
        return res.json({ success: true, data: repairValidation.data });
      }

      return res.status(422).json({
        success: false,
        error: `Generated JSON failed validation after one repair attempt: ${repairValidation.errors.join("; ")}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error";
      return res.status(502).json({ success: false, error: message });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });

  return app;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => {
    console.log(`LLM Smart Object Generator running at http://127.0.0.1:${port}`);
  });
}
