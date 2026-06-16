# LLM Smart Object Generator

An experimental environment-first generator for manually inspecting smart-object JSON. This version tests whether an LLM can generate sensible interactions for environmental objects and correctly associate those interactions with predefined NPC needs and relative advertisement weights.

The generated structure is:

```text
Object
-> Interactions
-> Advertised needs
-> Weights
```

This version deliberately generates only objects, interactions, advertisements, and weights. It does not include a simulator, availability, capacity, time, object state, animation, Behavior Trees, action sequences, utility-system generation, NPC roles, NPC personalities, or advanced smart-object logic.

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
        "interactions": [
          {
            "id": "sit_and_relax",
            "advertisements": [
              {
                "need": "rest",
                "weight": 0.6
              },
              {
                "need": "comfort",
                "weight": 0.7
              }
            ]
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

Generated JSON is schema-validated. Unknown fields, object-level advertisements, unsupported need names, duplicate object IDs, duplicate interaction IDs within one object, duplicate advertisements within one interaction, malformed JSON, empty interaction lists, empty advertisement lists, invalid interaction IDs, and out-of-range weights are rejected. The server asks the LLM for one focused repair attempt before returning a validation failure.

## Objects And Interactions

An object is a physical or environmental entity, such as a sofa, bed, television, bookshelf, refrigerator, or coffee machine.

An interaction describes one complete way an NPC can use that object. Interaction IDs must be lowercase identifiers using letters, numbers, and underscores, such as:

- `sit_and_relax`
- `sleep`
- `watch_television`
- `read_a_book`
- `get_and_drink_coffee`
- `get_and_eat_food`

Interactions should be complete need-satisfying abstractions. Prefer `get_and_drink_coffee` over `press_button`, `get_and_eat_food` over `open_door`, and `read_a_book` over `take_book`.

## Advertisement And Weight Meaning

An advertisement means the interaction communicates that performing it can help satisfy a particular NPC need.

The advertisement weight is the base strength with which the interaction can satisfy that need. It is not the final utility score. A future utility system may combine it with NPC need urgency, preferences, and NPC-specific modifiers.

Weight anchors:

- `0.1-0.3`: weak effect
- `0.4-0.6`: moderate effect
- `0.7-0.9`: strong effect
- `1.0`: one of the strongest reasonable ways to satisfy the need

Weights of `0.0` are valid by schema but should not normally be generated. If an interaction does not help a need, that advertisement should be omitted.

## Current Limitations

- Gemini is the only live LLM provider in this version.
- The app stores optional recent successful generations only in browser `localStorage`.
- Older browser history entries may display as historical JSON, but they are not treated as validated against the current interaction schema.
- Validation rejects invalid generated content but does not semantically rewrite it in application code.
- There is no database, simulator, availability, capacity, time, state, animation, Behavior Trees, utility-system generation, NPC execution model, or advanced smart-object logic.
