# LLM Smart Object Generator

An experimental environment-first generator for manually inspecting smart-object JSON. The research question for this version is whether an LLM can generate appropriate objects for a described location, identify which predefined NPC needs each object can satisfy, and assign sensible advertisement weights.

This version deliberately generates only objects, advertisements, and weights. It does not include a simulator, Behavior Trees, action sequences, utility curves, object state, capacity, reservations, availability, duration, animations, NPC roles, NPC personalities, or advanced smart-object logic.

## Installation

Requires Node.js 18 or newer because the backend uses the built-in `fetch` API.

```bash
npm install
```

## Environment

Create a local `.env` file from `.env.example`:

```text
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=60000
PORT=3000
```

`GEMINI_API_KEY` and `GEMINI_MODEL` are required for live generation. `GEMINI_TIMEOUT_MS` controls the Gemini request timeout and defaults to 60000 when omitted or invalid. The API key is sent only from the Express backend using the `x-goog-api-key` header and is never sent to browser code.

## Running

```bash
npm start
```

Open:

```text
http://127.0.0.1:3000
```

## Tests

```bash
npm test
```

The automated tests mock LLM responses and do not require a live API key.

## Input Format

The API endpoint is:

```text
POST /api/generate-smart-objects
```

Request body:

```json
{
  "locationDescription": "A small living room",
  "needs": [
    {
      "name": "rest",
      "definition": "The need to recover from tiredness."
    },
    {
      "name": "entertainment",
      "definition": "The need to reduce boredom through enjoyable activity."
    }
  ]
}
```

Need names must be non-empty, unique lowercase identifiers using letters, numbers, and underscores. Each need must include a non-empty definition.

## Output Format

Successful response:

```json
{
  "success": true,
  "data": {
    "location": "A small living room",
    "objects": [
      {
        "id": "sofa_01",
        "type": "sofa",
        "advertisements": [
          {
            "need": "rest",
            "weight": 0.6
          }
        ]
      }
    ]
  }
}
```

Failure response:

```json
{
  "success": false,
  "error": "Readable error message"
}
```

Generated JSON is schema-validated. Unknown fields, unsupported need names, duplicate object IDs, duplicate advertisements on one object, malformed JSON, empty advertisement lists, and out-of-range weights are rejected. The server asks the LLM for one focused repair attempt before returning a validation failure.

## Weight Interpretation

An advertisement means the object communicates that using it can help satisfy a particular NPC need.

The advertisement weight is the base strength with which the object can satisfy that need. It is not the final utility score. A future utility system may combine it with NPC need urgency, preferences, and other NPC-specific data.

Weight anchors:

- `0.1-0.3`: weakly satisfies the need
- `0.4-0.6`: moderately satisfies the need
- `0.7-0.9`: strongly satisfies the need
- `1.0`: one of the strongest reasonable ways to satisfy the need

Weights of `0.0` are valid by schema but should not normally be generated. If an object does not help a need, that advertisement should be omitted.

## Current Limitations

- Gemini is the only live LLM provider in this first version.
- The app stores optional recent successful generations only in browser `localStorage`.
- Validation rejects invalid generated content but does not semantically rewrite it in application code.
- There is no database, simulator, NPC execution model, or advanced smart-object logic.
