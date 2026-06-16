import Ajv from "ajv";
import { parseJsonText } from "./parseJsonText.js";
import { smartObjectSchema } from "./smartObjectSchema.js";

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(smartObjectSchema);

function formatAjvError(error) {
  const path = error.instancePath || "/";
  return `${path} ${error.message}`;
}

export function validateSmartObjectData(data, needs) {
  const errors = [];
  const schemaValid = validateSchema(data);

  if (!schemaValid) {
    errors.push(...validateSchema.errors.map(formatAjvError));
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.objects)) {
    return { valid: false, errors };
  }

  const allowedNeeds = new Set(needs.map((need) => need.name));
  const objectIds = new Set();

  for (const object of data.objects) {
    if (object && typeof object.id === "string") {
      if (objectIds.has(object.id)) {
        errors.push(`Duplicate object id "${object.id}".`);
      }
      objectIds.add(object.id);
    }

    if (!object || !Array.isArray(object.advertisements)) {
      continue;
    }

    const advertisedNeeds = new Set();
    for (const advertisement of object.advertisements) {
      if (!advertisement || typeof advertisement.need !== "string") {
        continue;
      }

      if (!allowedNeeds.has(advertisement.need)) {
        errors.push(`Unsupported need "${advertisement.need}" on object "${object.id ?? "unknown"}".`);
      }

      if (advertisedNeeds.has(advertisement.need)) {
        errors.push(`Duplicate advertisement for need "${advertisement.need}" on object "${object.id ?? "unknown"}".`);
      }
      advertisedNeeds.add(advertisement.need);
    }
  }

  return {
    valid: errors.length === 0,
    data,
    errors
  };
}

export function validateSmartObjectOutput(text, needs) {
  const parsed = parseJsonText(text);
  if (!parsed.valid) {
    return parsed;
  }

  return validateSmartObjectData(parsed.data, needs);
}
