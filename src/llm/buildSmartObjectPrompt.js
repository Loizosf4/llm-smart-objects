import { buildSmartObjectResponseSchema } from "../validation/smartObjectSchema.js";

function formatNeeds(needs) {
  return needs.map((need) => `- ${need.name}: ${need.definition}`).join("\n");
}

export function buildSmartObjectPrompt({ locationDescription, needs }) {
  const responseSchema = buildSmartObjectResponseSchema(needs);

  return [
    "You generate JSON for an experimental LLM Smart Object Generator.",
    "",
    "Task:",
    "Generate a concise set of useful physical or environmental objects appropriate for the described location.",
    "For each object, generate one or more meaningful interactions. Each interaction may advertise only the supplied NPC needs it can meaningfully satisfy.",
    "",
    `Location description: ${locationDescription}`,
    "",
    "Allowed needs and definitions:",
    formatNeeds(needs),
    "",
    "Meaning of an interaction and advertisement:",
    "An object is a physical or environmental entity.",
    "An interaction describes one complete way an NPC can use that object, such as sit_and_relax, sleep, watch_television, read_a_book, get_and_drink_coffee, or get_and_eat_food.",
    "Prefer complete need-satisfying interactions over incomplete enabling steps. For example, use get_and_drink_coffee instead of press_button, and read_a_book instead of take_book.",
    "An advertisement means the interaction communicates that performing it can help satisfy a particular NPC need.",
    "The advertisement weight is the base strength with which performing that interaction satisfies the advertised need.",
    "",
    "Weight anchors:",
    "- 0.1-0.3: weakly satisfies the need",
    "- 0.4-0.6: moderately satisfies the need",
    "- 0.7-0.9: strongly satisfies the need",
    "- 1.0: one of the strongest reasonable ways to satisfy the need",
    "Omit advertisements for needs the interaction does not reasonably help. Do not normally generate 0.0.",
    "",
    "Generation rules:",
    "1. Generate appropriate physical or environmental objects for the location.",
    "2. Generate one or more meaningful interactions for each object.",
    "3. Prefer one interaction when one is enough.",
    "4. Add multiple interactions only when they represent genuinely different uses.",
    "5. Use complete need-satisfying interactions, not partial enabling steps.",
    "6. Attach advertisements to interactions, not directly to objects.",
    "7. Use only the exact need names supplied above.",
    "8. Assign weights according to how strongly the interaction satisfies the need.",
    "9. Consider relative strengths between interactions.",
    "10. Avoid assigning every weight the same value.",
    "11. Avoid assigning nearly every value close to 1.0.",
    "12. Do not generate advertisements with no reasonable relationship to the interaction.",
    "13. Generate unique stable object IDs such as sofa_01.",
    "14. Generate stable interaction IDs such as sit_and_relax using lowercase letters, numbers, and underscores.",
    "15. Return only valid raw JSON.",
    "16. Follow the exact schema.",
    "17. Do not return any fields outside the schema.",
    "18. Do not generate duration, availability, capacity, occupancy, reservations, queues, object state, resources, preconditions, animation, execution templates, Behavior Trees, action sequences, utility formulas, NPC roles, NPC personalities, arbitrary code, or simulator logic.",
    "",
    "Required JSON schema:",
    JSON.stringify(responseSchema, null, 2),
    "",
    "Return raw JSON only. Do not include Markdown, code fences, comments, or explanations."
  ].join("\n");
}

export function buildSmartObjectRepairPrompt({ invalidOutput, validationErrors, locationDescription, needs }) {
  const responseSchema = buildSmartObjectResponseSchema(needs);

  return [
    "Correct the invalid smart-object JSON output.",
    "Return corrected raw JSON only. Do not include Markdown, code fences, comments, or explanations.",
    "Objects must contain interactions, and interactions must contain advertisements. Do not put advertisements directly on objects.",
    "Use complete need-satisfying interactions, not partial enabling steps.",
    "Do not generate duration, availability, capacity, occupancy, reservations, queues, object state, resources, preconditions, animation, execution templates, Behavior Trees, action sequences, utility formulas, NPC roles, NPC personalities, arbitrary code, or simulator logic.",
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
    JSON.stringify(responseSchema, null, 2),
    "",
    "Invalid output to repair:",
    invalidOutput
  ].join("\n");
}
