import { smartObjectSchemaForPrompt } from "../validation/smartObjectSchema.js";

function formatNeeds(needs) {
  return needs.map((need) => `- ${need.name}: ${need.definition}`).join("\n");
}

export function buildSmartObjectPrompt({ locationDescription, needs }) {
  return [
    "You generate JSON for an experimental LLM Smart Object Generator.",
    "",
    "Task:",
    "Generate a concise set of useful physical or environmental objects appropriate for the described location.",
    "Each object may advertise only the supplied NPC needs it can meaningfully satisfy.",
    "",
    `Location description: ${locationDescription}`,
    "",
    "Allowed needs and definitions:",
    formatNeeds(needs),
    "",
    "Meaning of an advertisement:",
    "An advertisement means the object communicates that using it can help satisfy a particular NPC need.",
    "The advertisement weight is the base strength with which that object can satisfy the advertised need.",
    "",
    "Weight anchors:",
    "- 0.1-0.3: weakly satisfies the need",
    "- 0.4-0.6: moderately satisfies the need",
    "- 0.7-0.9: strongly satisfies the need",
    "- 1.0: one of the strongest reasonable ways to satisfy the need",
    "Omit advertisements for needs the object does not reasonably help. Do not normally generate 0.0.",
    "",
    "Generation rules:",
    "1. Prefer objects that meaningfully contribute to at least one allowed need.",
    "2. Do not generate unrelated decorative objects unless they advertise an allowed need.",
    "3. Use only the exact need names supplied above.",
    "4. Assign weights according to how strongly the object satisfies the need.",
    "5. Consider relative strengths between objects.",
    "6. Avoid assigning every weight the same value.",
    "7. Avoid assigning nearly every value close to 1.0.",
    "8. Do not generate advertisements with no reasonable relationship to the object.",
    "9. Generate unique stable IDs such as sofa_01.",
    "10. Return only valid raw JSON.",
    "11. Do not return any fields outside the schema.",
    "12. Do not generate capacity, timing, availability, occupancy, reservations, state, behavior, animation, actions, utility curves, NPC roles, personalities, Behavior Trees, or interaction logic.",
    "",
    "Required JSON schema:",
    JSON.stringify(smartObjectSchemaForPrompt, null, 2),
    "",
    "Return raw JSON only. Do not include Markdown, code fences, comments, or explanations."
  ].join("\n");
}

export function buildSmartObjectRepairPrompt({ invalidOutput, validationErrors, locationDescription, needs }) {
  return [
    "Correct the invalid smart-object JSON output.",
    "Return corrected raw JSON only. Do not include Markdown, code fences, comments, or explanations.",
    "",
    `Location description: ${locationDescription}`,
    "",
    "Allowed needs and definitions:",
    formatNeeds(needs),
    "",
    "Validation errors:",
    validationErrors.map((error) => `- ${error}`).join("\n"),
    "",
    "Required JSON schema:",
    JSON.stringify(smartObjectSchemaForPrompt, null, 2),
    "",
    "Invalid output to repair:",
    invalidOutput
  ].join("\n");
}
