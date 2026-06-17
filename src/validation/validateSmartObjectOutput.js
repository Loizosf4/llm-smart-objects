import Ajv from "ajv";
import { parseJsonText } from "./parseJsonText.js";
import { smartObjectSchema } from "./smartObjectSchema.js";

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(smartObjectSchema);
const INTERACTION_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const DURATION_TYPES = new Set(["instant", "fixed", "continuous"]);
const CAPACITY_TYPES = new Set(["limited", "unlimited"]);
const AVAILABILITY_TYPES = new Set(["always", "when_capacity_available"]);
const FORBIDDEN_AVAILABILITY_FIELDS = new Set([
  "available_slots",
  "remaining_slots",
  "claimed_slots",
  "occupied",
  "is_free",
  "current_users",
  "user_count",
  "occupant_ids",
  "reserved_by",
  "reservation",
  "queue",
  "queue_length",
  "queue_position"
]);

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

function validateCapacity(object, objectId, errors) {
  if (!Object.hasOwn(object, "capacity")) {
    errors.push(`Object "${objectId}" is missing capacity.`);
    return null;
  }

  const { capacity } = object;

  if (!capacity || typeof capacity !== "object" || Array.isArray(capacity)) {
    errors.push(`Capacity on object "${objectId}" must be an object.`);
    return null;
  }

  for (const field of Object.keys(capacity)) {
    if (field !== "type" && field !== "slots") {
      errors.push(`Unknown capacity field "${field}" on object "${objectId}".`);
    }
  }

  if (!Object.hasOwn(capacity, "type")) {
    errors.push(`Capacity on object "${objectId}" is missing type.`);
    return null;
  }

  if (!CAPACITY_TYPES.has(capacity.type)) {
    errors.push(`Unsupported capacity type "${capacity.type}" on object "${objectId}".`);
    return null;
  }

  if (capacity.type === "limited") {
    if (!Object.hasOwn(capacity, "slots")) {
      errors.push(`Limited capacity on object "${objectId}" requires slots.`);
      return capacity.type;
    }

    if (!Number.isInteger(capacity.slots) || capacity.slots < 1 || capacity.slots > 100) {
      errors.push(`Capacity slots on object "${objectId}" must be an integer between 1 and 100.`);
    }
  }

  if (capacity.type === "unlimited" && Object.hasOwn(capacity, "slots")) {
    errors.push(`Unlimited capacity on object "${objectId}" must not contain slots.`);
  }

  return capacity.type;
}

function validateAvailability(interaction, objectId, interactionId, objectCapacityType, errors) {
  if (!Object.hasOwn(interaction, "availability")) {
    errors.push(`Interaction "${interactionId}" of object "${objectId}" is missing availability.`);
    return;
  }

  const { availability } = interaction;

  if (!availability || typeof availability !== "object" || Array.isArray(availability)) {
    errors.push(`Availability on interaction "${interactionId}" of object "${objectId}" must be an object.`);
    return;
  }

  if (!Object.hasOwn(availability, "type")) {
    errors.push(`Availability on interaction "${interactionId}" of object "${objectId}" is missing type.`);
  } else if (availability.type === "when_free") {
    errors.push(`Availability type "when_free" on interaction "${interactionId}" of object "${objectId}" is no longer valid; use "when_capacity_available" for limited capacity objects.`);
  } else if (!AVAILABILITY_TYPES.has(availability.type)) {
    errors.push(`Unsupported availability type "${availability.type}" on interaction "${interactionId}" of object "${objectId}".`);
  } else if (objectCapacityType === "limited" && availability.type !== "when_capacity_available") {
    errors.push(`Interaction "${interactionId}" of limited object "${objectId}" must use availability "when_capacity_available".`);
  } else if (objectCapacityType === "unlimited" && availability.type !== "always") {
    errors.push(`Interaction "${interactionId}" of unlimited object "${objectId}" must use availability "always".`);
  }

  for (const field of Object.keys(availability)) {
    if (field === "type") {
      continue;
    }

    if (FORBIDDEN_AVAILABILITY_FIELDS.has(field)) {
      errors.push(`Availability on interaction "${interactionId}" of object "${objectId}" must not include "${field}".`);
    } else {
      errors.push(`Unknown availability field "${field}" on interaction "${interactionId}" of object "${objectId}".`);
    }
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
    const objectId = object?.id ?? "unknown";

    if (object && typeof object.id === "string") {
      if (objectIds.has(object.id)) {
        errors.push(`Duplicate object id "${object.id}".`);
      }
      objectIds.add(object.id);
    }

    const objectCapacityType = object && typeof object === "object" && !Array.isArray(object)
      ? validateCapacity(object, objectId, errors)
      : null;

    if (!object || !Array.isArray(object.interactions)) {
      continue;
    }

    const interactionIds = new Set();
    for (const interaction of object.interactions) {
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

      if (interaction) {
        if (Object.hasOwn(interaction, "capacity")) {
          errors.push(`Interaction "${interactionId}" of object "${objectId}" must not contain capacity. Capacity belongs to the object.`);
        }

        if (typeof interaction.duration?.type === "string" && DURATION_TYPES.has(interaction.duration.type)) {
          validateDuration(interaction.duration, objectId, interactionId, errors);
        }

        validateAvailability(interaction, objectId, interactionId, objectCapacityType, errors);
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
