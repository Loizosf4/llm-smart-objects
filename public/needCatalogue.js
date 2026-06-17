export const CATALOGUE_STORAGE_KEY = "llm-smart-object-need-catalogue";

export const NEW_NEED_TEMPLATE = {
  name: "",
  definition: "",
  weakReference: {
    example: "",
    weight: 0.1
  },
  strongReference: {
    example: "",
    weight: 1.0
  }
};

const NEED_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const NEED_FIELDS = new Set(["name", "definition", "weakReference", "strongReference"]);
const REFERENCE_FIELDS = new Set(["example", "weight"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createEmptyNeed() {
  return clone(NEW_NEED_TEMPLATE);
}

function needLabel(rawNeed, index) {
  const name = typeof rawNeed?.name === "string" ? rawNeed.name.trim() : "";
  return name || `${index + 1}`;
}

function validateReference(rawNeed, index, key, label) {
  const displayName = needLabel(rawNeed, index);
  const reference = rawNeed?.[key];

  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    return { valid: false, error: `Need "${displayName}" is missing a ${label} reference.` };
  }

  for (const field of Object.keys(reference)) {
    if (!REFERENCE_FIELDS.has(field)) {
      return { valid: false, error: `Need "${displayName}" ${label} reference contains unsupported field "${field}".` };
    }
  }

  const example = typeof reference.example === "string" ? reference.example.trim() : "";
  if (!example) {
    return { valid: false, error: `Need "${displayName}" is missing a ${label} reference example.` };
  }

  if (!Object.hasOwn(reference, "weight")) {
    return { valid: false, error: `Need "${displayName}" is missing a ${label} reference weight.` };
  }

  const weight = typeof reference.weight === "number" ? reference.weight : Number.NaN;
  if (!Number.isFinite(weight)) {
    return { valid: false, error: `Need "${displayName}" ${label} reference weight must be numeric.` };
  }

  if (weight < 0 || weight > 1) {
    return { valid: false, error: `Need "${displayName}" ${label} reference weight must be between 0 and 1.` };
  }

  return {
    valid: true,
    value: {
      example,
      weight
    }
  };
}

export function validateNeedCatalogue(rawNeeds) {
  if (!Array.isArray(rawNeeds) || rawNeeds.length === 0) {
    return { valid: false, error: "At least one need is required." };
  }

  const needs = [];
  const seenNames = new Set();

  for (const [index, rawNeed] of rawNeeds.entries()) {
    if (!rawNeed || typeof rawNeed !== "object" || Array.isArray(rawNeed)) {
      return { valid: false, error: `Need ${index + 1} must be an object.` };
    }

    for (const field of Object.keys(rawNeed)) {
      if (!NEED_FIELDS.has(field)) {
        return { valid: false, error: `Need "${needLabel(rawNeed, index)}" contains unsupported field "${field}".` };
      }
    }

    const name = typeof rawNeed.name === "string" ? rawNeed.name.trim() : "";
    const definition = typeof rawNeed.definition === "string" ? rawNeed.definition.trim() : "";

    if (!name) {
      return { valid: false, error: `Need ${index + 1} is missing a name.` };
    }

    if (!NEED_NAME_PATTERN.test(name)) {
      return {
        valid: false,
        error: `Need "${name}" must be a lowercase identifier using letters, numbers, and underscores.`
      };
    }

    if (seenNames.has(name)) {
      return { valid: false, error: `Duplicate need name "${name}".` };
    }

    if (!definition) {
      return { valid: false, error: `Need "${name}" is missing a definition.` };
    }

    const weak = validateReference(rawNeed, index, "weakReference", "weak");
    if (!weak.valid) {
      return weak;
    }

    const strong = validateReference(rawNeed, index, "strongReference", "strong");
    if (!strong.valid) {
      return strong;
    }

    if (weak.value.weight >= strong.value.weight) {
      return {
        valid: false,
        error: `Need "${name}" weak reference weight must be lower than its strong reference weight.`
      };
    }

    seenNames.add(name);
    needs.push({
      name,
      definition,
      weakReference: weak.value,
      strongReference: strong.value
    });
  }

  return { valid: true, needs };
}

export function parseCatalogueJson(text) {
  try {
    return { valid: true, data: JSON.parse(text) };
  } catch {
    return { valid: false, error: "Catalogue file was not valid JSON." };
  }
}

