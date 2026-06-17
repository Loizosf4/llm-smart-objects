# LLM Smart Object Generator

An experimental environment-first generator for manually inspecting smart-object JSON. Version 3 tests whether an LLM can identify whether an interaction should always be advertised or should only be advertised while the object is free.

The generated structure is:

```text
Object
-> Interactions
   -> Duration
   -> Availability
   -> Advertised needs
   -> Weights
```

This remains a JSON-generation experiment. Version 3 deliberately generates only objects, interactions, duration information, simple availability rules, advertisements, and weights. It does not include simulator execution, capacity, occupancy tracking, reservations, queues, resources, object state, animations, Behavior Trees, utility-system generation, NPC execution logic, or advanced smart-object logic.

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
            "duration": {
              "type": "continuous"
            },
            "availability": {
              "type": "always"
            },
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
      },
      {
        "id": "single_chair_01",
        "type": "single_chair",
        "interactions": [
          {
            "id": "sit_and_rest",
            "duration": {
              "type": "continuous"
            },
            "availability": {
              "type": "when_free"
            },
            "advertisements": [
              {
                "need": "rest",
                "weight": 0.4
              },
              {
                "need": "comfort",
                "weight": 0.4
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

Generated JSON is schema-validated. Unknown fields, object-level advertisements, unsupported need names, duplicate object IDs, duplicate interaction IDs within one object, duplicate advertisements within one interaction, malformed JSON, empty interaction lists, empty advertisement lists, missing duration, invalid duration types, invalid fixed seconds, seconds on instant or continuous durations, invalid interaction IDs, out-of-range weights, missing availability, malformed availability, unknown availability types, extra availability fields, capacity fields, and runtime fields such as `occupied`, `current_users`, or `reserved_by` are rejected. The server asks the LLM for one focused repair attempt before returning a validation failure.

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

## Duration Types

Every interaction has exactly one `duration` object.

Use `instant` when the interaction completes almost immediately and does not meaningfully occupy the NPC over simulation time:

```json
{
  "type": "instant"
}
```

Use `fixed` when the interaction has a natural completion point and an approximately predictable duration:

```json
{
  "type": "fixed",
  "seconds": 30
}
```

Fixed interactions require `seconds`. `seconds` are approximate real-world seconds, must be greater than `0`, and must be no greater than `86400`.

Use `continuous` when there is no predetermined completion time:

```json
{
  "type": "continuous"
}
```

Continuous does not mean infinite. It means the smart object does not define a fixed stopping time; future NPC or utility-system logic may decide when to stop. Instant and continuous durations must not include `seconds`.

## Availability

Every interaction has exactly one `availability` object. Availability is a static object-side advertisement rule. It answers whether the interaction should currently be visible as a possible choice.

Availability is attached to interactions, not objects. Different interactions on the same object may use different availability types when that genuinely makes sense.

Use `always` when the interaction does not need exclusive control of the object in this simplified version:

```json
{
  "type": "always"
}
```

Examples include watching a television, listening to a radio, reading a notice board, looking at art, or using a large shared space.

Use `when_free` when only one NPC should use the interaction at a time:

```json
{
  "type": "when_free"
}
```

Examples include sleeping in a single bed, using a toilet, taking a shower, using a vending machine, sitting in a single chair, or using one computer.

The generated JSON contains only this static rule. A future simulator will maintain actual runtime usage, such as whether an object or interaction is currently in use. This version does not contain capacity, seat counts, user limits, available-slot counts, occupancy counts, reservations, or queues. Shared objects such as a large sofa, communal table, television, or notice board temporarily use `always`.

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
- Older browser history entries may display as historical JSON, but they are not treated as validated against the current availability schema.
- Validation rejects invalid generated content but does not semantically rewrite it in application code.
- There is no simulator execution, capacity, occupancy tracking, reservations, queues, resources, stock, object state, powered state, locked state, operational state, preconditions, arbitrary conditions, NPC role conditions, schedules, animations, Behavior Trees, action sequences, behavior logic, utility-system generation, NPC execution model, or advanced smart-object logic.
