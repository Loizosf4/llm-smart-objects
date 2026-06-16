export function stripCodeFences(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseJsonText(text) {
  const cleaned = stripCodeFences(text);

  try {
    return { valid: true, data: JSON.parse(cleaned) };
  } catch {
    return { valid: false, errors: ["Generated output was not valid JSON."] };
  }
}
