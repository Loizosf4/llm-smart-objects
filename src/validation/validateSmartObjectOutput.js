import Ajv from "ajv";
import { parseJsonText } from "./parseJsonText.js";
import { smartObjectSchema } from "./smartObjectSchema.js";

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(smartObjectSchema);
const INTERACTION_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const DURATION_TYPES = new Set(["instant", "fixed", "continuous"]);

function formatAjvError(error) {
  const path = error.instancePath || "/";
  return `${path} ${error.message}`;
}

function validateDuration(duration, objectId, interactionId, errors) {
  if (!duration || typeof duration !== "object" || Array.isArray(duration)) {
    return;
  }

  if (duration.type === "fixed" && !Object.hasOwn(duration, "seconds")) {
    errors.push(`Fixed duration on interaction "${interactionId}" of object "${objectId}" requires seconds.`);
    return;
  }

  if (duration.type === "fixed" && typeof duration.seconds !== "number") {
    errors.push(`Fixed duration on interaction "${interactionId}" of object "${objectId}" requires numeric seconds.`);
    return;
  }

  if (duration.type === "fixed" && duration.seconds <= 0) {
    errors.push(`Fixed duration on interaction "${interactionId}" of object "${objectId}" requires seconds greater than 0.`);
    return;
  }

  if (duration.type === "fixed" && duration.seconds > 86400) {
    errors.push(`Fixed duration on interaction "${interactionId}" of object "${objectId}" must not exceed 86400 seconds.`);
    return;
  }

  if (duration.type === "instant" && Object.hasOwn(duration, "seconds")) {
    errors.push(`Instant duration on interaction "${interactionId}" of object "${objectId}" must not contain seconds.`);
    return;
  }

  if (duration.type === "continuous" && Object.hasOwn(duration, "seconds")) {
    errors.push(`Continuous duration on interaction "${interactionId}" of object "${objectId}" must not contain seconds.`);
  }
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

    if (!object || !Array.isArray(object.interactions)) {
      continue;
    }

    const interactionIds = new Set();
    for (const interaction of object.interactions) {
      const objectId = object.id ?? "unknown";
      const interactionId = interaction?.id ?? "unknown";

      if (interaction && typeof interaction.id === "string") {
        if (!INTERACTION_ID_PATTERN.test(interaction.id)) {
          errors.push(`Invalid interaction id "${interaction.id}" on object "${objectId}".`);
        }

        if (interactionIds.has(interaction.id)) {
          errors.push(`Duplicate interaction id "${interaction.id}" on object "${objectId}".`);
        }
        interactionIds.add(interaction.id);
      }

      if (interaction && typeof interaction.duration?.type === "string" && DURATION_TYPES.has(interaction.duration.type)) {
        validateDuration(interaction.duration, objectId, interactionId, errors);
      }

      if (!interaction || !Array.isArray(interaction.advertisements)) {
        continue;
      }

      const advertisedNeeds = new Set();
      for (const advertisement of interaction.advertisements) {
        if (!advertisement || typeof advertisement.need !== "string") {
          continue;
        }

        if (!allowedNeeds.has(advertisement.need)) {
          errors.push(`Unsupported need "${advertisement.need}" on interaction "${interactionId}" of object "${objectId}".`);
        }

        if (advertisedNeeds.has(advertisement.need)) {
          errors.push(`Duplicate advertisement for need "${advertisement.need}" on interaction "${interactionId}" of object "${objectId}".`);
        }
        advertisedNeeds.add(advertisement.need);
      }
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
