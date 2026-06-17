# LLM Smart Object Generator

An experimental environment-first generator for manually inspecting smart-object JSON. Version 3 generates objects, interactions, duration, simple interaction availability, need advertisements, and weights. This upgrade improves the input need catalogue and per-need weight calibration without changing the generated smart-object JSON.

The generated structure remains:

```text
Object
-> Interactions
   -> Duration
   -> Availability
   -> Advertised needs
   -> Weights
```

This remains a JSON-generation experiment. It does not include simulator execution, capacity, occupancy tracking, reservations, queues, resources, object state, animations, Behavior Trees, utility-system generation, NPC runtime need bars, databases, authentication, cloud storage, or Version 4 smart-object features.

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

## Need Catalogue

The frontend loads the editable default need catalogue from `public/default-needs.json`. User edits are autosaved in browser `localStorage` under `llm-smart-object-need-catalogue`, separate from generated-result history.

Each need has this structure:

```json
{
  "name": "rest",
  "definition": "The urgency to recover from physical or mental fatigue.",
  "weakReference": {
    "example": "wall -> lean_against_wall",
    "weight": 0.05
  },
  "strongReference": {
    "example": "bed -> sleep",
    "weight": 1.0
  }
}
```

Need names must be unique lowercase identifiers using letters, numbers, and underscores. Reference examples are complete object-to-interaction examples. Reference weights must be numbers from `0.0` to `1.0`, and the weak reference weight must be lower than the strong reference weight.

The default catalogue contains twelve editable needs:

- `hunger`
- `thirst`
- `rest`
- `comfort`
- `entertainment`
- `social`
- `safety`
- `curiosity`
- `bladder`
- `hygiene`
- `physical_activity`
- `mental_activity`

All needs use the same urgency convention: `0.0` means no urgency and `1.0` means critical urgency. Bladder is not reversed internally; a toilet interaction reduces bladder urgency, but its advertisement weight remains positive.

## Calibration

Weak and strong references are prompt context only. They help Gemini choose better advertisement weights by comparing each generated interaction against examples for that specific need.

Per-need calibration references take priority over the generic fallback bands:

- `0.01-0.19`: minimal effect
- `0.20-0.39`: weak effect
- `0.40-0.59`: moderate effect
- `0.60-0.79`: strong effect
- `0.80-1.00`: very strong effect

The generated advertisements remain unchanged and contain only the need name and weight:

```json
{
  "need": "rest",
  "weight": 0.6
}
```

Definitions and calibration references are not copied into generated smart-object output.

## Catalogue Persistence

The catalogue autosaves whenever a need is edited, added, or removed. On page load, the browser attempts to restore the saved catalogue. If saved data is missing or corrupt, the app loads `public/default-needs.json`.

Catalogue controls:

- `Add need` creates a blank editable need with default weak and strong weights.
- `Reset to defaults` confirms, reloads `default-needs.json`, saves it to `localStorage`, and re-renders the editor.
- `Export catalogue` validates and downloads `need-catalogue.json` with all fields.
- `Import catalogue` validates a local JSON file and replaces the current catalogue only if the whole file is valid.

`localStorage` is tied to the browser origin and port. A catalogue saved at `http://127.0.0.1:3000` is separate from one saved at another host or port.

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
      "definition": "The urgency to recover from physical or mental fatigue.",
      "weakReference": {
        "example": "wall -> lean_against_wall",
        "weight": 0.05
      },
      "strongReference": {
        "example": "bed -> sleep",
        "weight": 1.0
      }
    }
  ]
}
```

The server validates the full need structure, rejects unknown need fields, and preserves the normalized calibration references for prompt construction. The generated-output schema still uses only `needs[].name` for the dynamic advertisement need enum.

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

Instant and continuous durations must not include `seconds`.

## Availability

Every interaction has exactly one `availability` object. Availability is a static object-side advertisement rule attached to the interaction.

Use `always` when the interaction does not need exclusive control of the object in this simplified version:

```json
{
  "type": "always"
}
```

Use `when_free` when only one NPC should use the interaction at a time:

```json
{
  "type": "when_free"
}
```

The generated JSON contains only this static rule. A future simulator would maintain actual runtime usage. This version does not contain capacity, seat counts, user limits, available-slot counts, occupancy counts, reservations, or queues. Shared objects such as a large sofa, communal table, television, or notice board temporarily use `always`.

## Current Limitations

- Gemini is the only live LLM provider in this version.
- Recent successful generations and the need catalogue are stored separately in browser `localStorage`.
- Older browser history entries may display as historical JSON, but they are not treated as validated against the current availability schema.
- Validation rejects invalid generated content but does not semantically rewrite it in application code.
- There is no capacity, seats, user limits, occupancy, runtime users, reservations, queues, resources, state, animation, Behavior Trees, utility calculations, NPC runtime need bars, simulator execution, database, authentication, or cloud storage.
