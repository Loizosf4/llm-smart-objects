import Ajv from "ajv";
import { parseJsonText } from "./parseJsonText.js";
import { smartObjectSchema } from "./smartObjectSchema.js";

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(smartObjectSchema);
const INTERACTION_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESOURCE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const DURATION_TYPES = new Set(["instant", "fixed", "continuous"]);
const CAPACITY_TYPES = new Set(["limited", "unlimited"]);
const AVAILABILITY_TYPES = new Set(["always", "when_capacity_available"]);
const STATE_IDS = new Set(["powered_on", "operational", "locked", "open", "clean"]);
const REQUIREMENT_TYPES = new Set(["state_equals", "resource_at_least"]);
const EFFECT_TYPES = new Set(["set_state", "change_resource"]);
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
const STATE_FIELDS = new Set(["id", "initial"]);
const RESOURCE_FIELDS = new Set(["id", "initial", "maximum"]);
const REQUIREMENT_FIELDS = new Set(["type", "state", "value", "resource", "amount"]);
const EFFECT_FIELDS = new Set(["type", "state", "value", "resource", "amount"]);

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

function validateStateFlags(object, objectId, errors) {
  const declaredStates = new Set();

  if (!Object.hasOwn(object, "stateFlags")) {
    errors.push(`Object "${objectId}" is missing stateFlags.`);
    return declaredStates;
  }

  if (!Array.isArray(object.stateFlags)) {
    errors.push(`stateFlags on object "${objectId}" must be an array.`);
    return declaredStates;
  }

  for (const state of object.stateFlags) {
    const stateId = state?.id ?? "unknown";

    if (!state || typeof state !== "object" || Array.isArray(state)) {
      errors.push(`State flag on object "${objectId}" must be an object.`);
      continue;
    }

    for (const field of Object.keys(state)) {
      if (!STATE_FIELDS.has(field)) {
        errors.push(`Unknown state flag field "${field}" on object "${objectId}".`);
      }
    }

    if (!Object.hasOwn(state, "id")) {
      errors.push(`State flag on object "${objectId}" is missing id.`);
    } else if (!STATE_IDS.has(state.id)) {
      errors.push(`Unsupported state flag "${state.id}" on object "${objectId}".`);
    } else {
      if (declaredStates.has(state.id)) {
        errors.push(`Duplicate state flag "${state.id}" on object "${objectId}".`);
      }
      declaredStates.add(state.id);
    }

    if (!Object.hasOwn(state, "initial") || typeof state.initial !== "boolean") {
      errors.push(`State flag "${stateId}" on object "${objectId}" requires Boolean initial value.`);
    }
  }

  return declaredStates;
}

function validateResources(object, objectId, errors) {
  const declaredResources = new Set();

  if (!Object.hasOwn(object, "resources")) {
    errors.push(`Object "${objectId}" is missing resources.`);
    return declaredResources;
  }

  if (!Array.isArray(object.resources)) {
    errors.push(`resources on object "${objectId}" must be an array.`);
    return declaredResources;
  }

  for (const resource of object.resources) {
    const resourceId = resource?.id ?? "unknown";

    if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
      errors.push(`Resource on object "${objectId}" must be an object.`);
      continue;
    }

    for (const field of Object.keys(resource)) {
      if (!RESOURCE_FIELDS.has(field)) {
        errors.push(`Unknown resource field "${field}" on object "${objectId}".`);
      }
    }

    if (!Object.hasOwn(resource, "id") || typeof resource.id !== "string" || !RESOURCE_ID_PATTERN.test(resource.id)) {
      errors.push(`Invalid resource id "${resourceId}" on object "${objectId}".`);
    } else {
      if (declaredResources.has(resource.id)) {
        errors.push(`Duplicate resource id "${resource.id}" on object "${objectId}".`);
      }
      declaredResources.add(resource.id);
    }

    if (!Object.hasOwn(resource, "initial")) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" is missing initial value.`);
    } else if (!Number.isInteger(resource.initial)) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" initial value must be an integer.`);
    } else if (resource.initial < 0 || resource.initial > 100000) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" initial value must be between 0 and 100000.`);
    }

    if (!Object.hasOwn(resource, "maximum")) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" is missing maximum value.`);
    } else if (!Number.isInteger(resource.maximum)) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" maximum value must be an integer.`);
    } else if (resource.maximum < 1 || resource.maximum > 100000) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" maximum value must be between 1 and 100000.`);
    }

    if (Number.isInteger(resource.initial) && Number.isInteger(resource.maximum) && resource.initial > resource.maximum) {
      errors.push(`Resource "${resourceId}" on object "${objectId}" has initial value greater than maximum.`);
    }
  }

  return declaredResources;
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

function validateRequirements(interaction, objectId, interactionId, declaredStates, declaredResources, requirementReferencedStates, referencedResources, errors) {
  if (!Object.hasOwn(interaction, "requirements")) {
    errors.push(`Interaction "${interactionId}" of object "${objectId}" is missing requirements.`);
    return;
  }

  if (!Array.isArray(interaction.requirements)) {
    errors.push(`Requirements on interaction "${interactionId}" of object "${objectId}" must be an array.`);
    return;
  }

  const seen = new Set();
  for (const requirement of interaction.requirements) {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
      errors.push(`Requirement on interaction "${interactionId}" of object "${objectId}" must be an object.`);
      continue;
    }

    const signature = JSON.stringify(requirement);
    if (seen.has(signature)) {
      errors.push(`Duplicate requirement on interaction "${interactionId}" of object "${objectId}".`);
    }
    seen.add(signature);

    for (const field of Object.keys(requirement)) {
      if (!REQUIREMENT_FIELDS.has(field)) {
        errors.push(`Unknown requirement field "${field}" on interaction "${interactionId}" of object "${objectId}".`);
      }
    }

    if (!Object.hasOwn(requirement, "type") || !REQUIREMENT_TYPES.has(requirement.type)) {
      errors.push(`Unsupported requirement type "${requirement.type}" on interaction "${interactionId}" of object "${objectId}".`);
      continue;
    }

    if (requirement.type === "state_equals") {
      if (!Object.hasOwn(requirement, "state")) {
        errors.push(`state_equals requirement on interaction "${interactionId}" of object "${objectId}" requires state.`);
      } else if (!declaredStates.has(requirement.state)) {
        errors.push(`Requirement on interaction "${interactionId}" of object "${objectId}" references undeclared state "${requirement.state}".`);
      } else {
        requirementReferencedStates.add(requirement.state);
      }

      if (!Object.hasOwn(requirement, "value") || typeof requirement.value !== "boolean") {
        errors.push(`state_equals requirement on interaction "${interactionId}" of object "${objectId}" requires Boolean value.`);
      }

      if (Object.hasOwn(requirement, "resource") || Object.hasOwn(requirement, "amount")) {
        errors.push(`state_equals requirement on interaction "${interactionId}" of object "${objectId}" must not contain resource fields.`);
      }
    }

    if (requirement.type === "resource_at_least") {
      if (!Object.hasOwn(requirement, "resource")) {
        errors.push(`resource_at_least requirement on interaction "${interactionId}" of object "${objectId}" requires resource.`);
      } else if (!declaredResources.has(requirement.resource)) {
        errors.push(`Requirement on interaction "${interactionId}" of object "${objectId}" references undeclared resource "${requirement.resource}".`);
      } else {
        referencedResources.add(requirement.resource);
      }

      if (!Object.hasOwn(requirement, "amount") || !Number.isInteger(requirement.amount) || requirement.amount < 1 || requirement.amount > 100000) {
        errors.push(`resource_at_least requirement on interaction "${interactionId}" of object "${objectId}" requires integer amount between 1 and 100000.`);
      }

      if (Object.hasOwn(requirement, "state") || Object.hasOwn(requirement, "value")) {
        errors.push(`resource_at_least requirement on interaction "${interactionId}" of object "${objectId}" must not contain state fields.`);
      }
    }
  }
}

function validateEffects(interaction, objectId, interactionId, declaredStates, declaredResources, referencedResources, errors) {
  if (!Object.hasOwn(interaction, "effects")) {
    errors.push(`Interaction "${interactionId}" of object "${objectId}" is missing effects.`);
    return 0;
  }

  if (!Array.isArray(interaction.effects)) {
    errors.push(`Effects on interaction "${interactionId}" of object "${objectId}" must be an array.`);
    return 0;
  }

  const seen = new Set();
  let validEffectCount = 0;
  for (const effect of interaction.effects) {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
      errors.push(`Effect on interaction "${interactionId}" of object "${objectId}" must be an object.`);
      continue;
    }

    let effectValid = true;
    const signature = JSON.stringify(effect);
    if (seen.has(signature)) {
      errors.push(`Duplicate effect on interaction "${interactionId}" of object "${objectId}".`);
      effectValid = false;
    }
    seen.add(signature);

    for (const field of Object.keys(effect)) {
      if (!EFFECT_FIELDS.has(field)) {
        errors.push(`Unknown effect field "${field}" on interaction "${interactionId}" of object "${objectId}".`);
        effectValid = false;
      }
    }

    if (!Object.hasOwn(effect, "type") || !EFFECT_TYPES.has(effect.type)) {
      errors.push(`Unsupported effect type "${effect.type}" on interaction "${interactionId}" of object "${objectId}".`);
      continue;
    }

    if (effect.type === "set_state") {
      if (!Object.hasOwn(effect, "state")) {
        errors.push(`set_state effect on interaction "${interactionId}" of object "${objectId}" requires state.`);
        effectValid = false;
      } else if (!declaredStates.has(effect.state)) {
        errors.push(`Effect on interaction "${interactionId}" of object "${objectId}" references undeclared state "${effect.state}".`);
        effectValid = false;
      }

      if (!Object.hasOwn(effect, "value") || typeof effect.value !== "boolean") {
        errors.push(`set_state effect on interaction "${interactionId}" of object "${objectId}" requires Boolean value.`);
        effectValid = false;
      }

      if (Object.hasOwn(effect, "resource") || Object.hasOwn(effect, "amount")) {
        errors.push(`set_state effect on interaction "${interactionId}" of object "${objectId}" must not contain resource fields.`);
        effectValid = false;
      }
    }

    if (effect.type === "change_resource") {
      if (!Object.hasOwn(effect, "resource")) {
        errors.push(`change_resource effect on interaction "${interactionId}" of object "${objectId}" requires resource.`);
        effectValid = false;
      } else if (!declaredResources.has(effect.resource)) {
        errors.push(`Effect on interaction "${interactionId}" of object "${objectId}" references undeclared resource "${effect.resource}".`);
        effectValid = false;
      } else {
        referencedResources.add(effect.resource);
      }

      if (!Object.hasOwn(effect, "amount") || !Number.isInteger(effect.amount) || effect.amount === 0 || effect.amount < -100000 || effect.amount > 100000) {
        errors.push(`change_resource effect on interaction "${interactionId}" of object "${objectId}" requires non-zero integer amount between -100000 and 100000.`);
        effectValid = false;
      }

      if (Object.hasOwn(effect, "state") || Object.hasOwn(effect, "value")) {
        errors.push(`change_resource effect on interaction "${interactionId}" of object "${objectId}" must not contain state fields.`);
        effectValid = false;
      }
    }

    if (effectValid) {
      validEffectCount += 1;
    }
  }

  return validEffectCount;
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
    const declaredStates = object && typeof object === "object" && !Array.isArray(object)
      ? validateStateFlags(object, objectId, errors)
      : new Set();
    const declaredResources = object && typeof object === "object" && !Array.isArray(object)
      ? validateResources(object, objectId, errors)
      : new Set();
    const requirementReferencedStates = new Set();
    const referencedResources = new Set();

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
        validateRequirements(interaction, objectId, interactionId, declaredStates, declaredResources, requirementReferencedStates, referencedResources, errors);
        const validEffectCount = validateEffects(interaction, objectId, interactionId, declaredStates, declaredResources, referencedResources, errors);

        if (Array.isArray(interaction.advertisements) && interaction.advertisements.length === 0 && validEffectCount === 0) {
          errors.push(`Interaction "${interactionId}" of object "${objectId}" must advertise at least one need or contain at least one object-side effect.`);
        }
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

    for (const stateId of declaredStates) {
      if (!requirementReferencedStates.has(stateId)) {
        errors.push(`State flag "${stateId}" on object "${objectId}" is never referenced by an interaction requirement.`);
      }
    }

    for (const resourceId of declaredResources) {
      if (!referencedResources.has(resourceId)) {
        errors.push(`Resource "${resourceId}" on object "${objectId}" is declared but never referenced.`);
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
