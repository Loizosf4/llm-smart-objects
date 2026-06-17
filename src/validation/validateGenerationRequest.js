import { validateNeedCatalogue } from "../../public/needCatalogue.js";

export function validateGenerationRequest(body) {
  const locationDescription = typeof body?.locationDescription === "string"
    ? body.locationDescription.trim()
    : "";

  if (!locationDescription) {
    return { valid: false, error: "Location description is required." };
  }

  const needValidation = validateNeedCatalogue(body?.needs);
  if (!needValidation.valid) {
    return { valid: false, error: needValidation.error };
  }

  return {
    valid: true,
    value: {
      locationDescription,
      needs: needValidation.needs
    }
  };
}
