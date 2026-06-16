const NEED_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateGenerationRequest(body) {
  const locationDescription = typeof body?.locationDescription === "string"
    ? body.locationDescription.trim()
    : "";

  if (!locationDescription) {
    return { valid: false, error: "Location description is required." };
  }

  if (!Array.isArray(body?.needs) || body.needs.length === 0) {
    return { valid: false, error: "At least one need is required." };
  }

  const normalizedNeeds = [];
  const seenNames = new Set();

  for (const [index, rawNeed] of body.needs.entries()) {
    const name = typeof rawNeed?.name === "string" ? rawNeed.name.trim() : "";
    const definition = typeof rawNeed?.definition === "string" ? rawNeed.definition.trim() : "";

    if (!name) {
      return { valid: false, error: `Need ${index + 1} is missing a name.` };
    }

    if (!NEED_NAME_PATTERN.test(name)) {
      return {
        valid: false,
        error: `Need "${name}" must be a lowercase identifier using letters, numbers, and underscores.`
      };
    }

    if (!definition) {
      return { valid: false, error: `Need "${name}" is missing a definition.` };
    }

    if (seenNames.has(name)) {
      return { valid: false, error: `Duplicate need name "${name}".` };
    }

    seenNames.add(name);
    normalizedNeeds.push({ name, definition });
  }

  return {
    valid: true,
    value: {
      locationDescription,
      needs: normalizedNeeds
    }
  };
}
