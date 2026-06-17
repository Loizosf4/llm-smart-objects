# LLM Smart Object Generator

An experimental environment-first generator for manually inspecting smart-object JSON. Version 4 tests whether an LLM can assign plausible simultaneous-user capacities to generated environmental objects and distinguish finite-capacity objects from interactions that do not require meaningful exclusive usage slots.

The generated structure is:

```text
Object
-> Capacity
-> Interactions
   -> Duration
   -> Capacity-aware availability
   -> Advertised needs
   -> Weights
```

This remains a JSON-generation experiment. Version 4 adds only static object capacity and capacity-aware availability. It does not include runtime occupancy, reservations, queues, resources, object state, animations, Behavior Trees, utility execution, simulator code, databases, authentication, or cloud storage.

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

The persistent editable need catalogue remains unchanged in Version 4. The frontend loads defaults from `public/default-needs.json`, autosaves edits in browser `localStorage` under `llm-smart-object-need-catalogue`, and keeps this catalogue separate from generated-result history.

Each need still has this structure:

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

The default catalogue contains twelve editable needs: `hunger`, `thirst`, `rest`, `comfort`, `entertainment`, `social`, `safety`, `curiosity`, `bladder`, `hygiene`, `physical_activity`, and `mental_activity`.

Catalogue controls are unchanged:

- `Add need`
- `Reset to defaults`
- `Export catalogue`
- `Import catalogue`

`localStorage` is tied to the browser origin and port. A catalogue saved at `http://127.0.0.1:3000` is separate from one saved at another host or port.

## Calibration

Weak and strong references are prompt context only. They help Gemini choose better advertisement weights by comparing each generated interaction against examples for that specific need. Definitions and calibration references are not copied into generated smart-object output.

The generated advertisements remain:

```json
{
  "need": "rest",
  "weight": 0.6
}
```

The generated-output schema still uses only `needs[].name` for the dynamic advertisement need enum.

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

The server validates the full need structure, rejects unknown need fields, and preserves normalized calibration references for prompt construction.

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
        "type": "three_seat_sofa",
        "capacity": {
          "type": "limited",
          "slots": 3
        },
        "interactions": [
          {
            "id": "sit_and_relax",
            "duration": {
              "type": "continuous"
            },
            "availability": {
              "type": "when_capacity_available"
            },
            "advertisements": [
              {
                "need": "rest",
                "weight": 0.55
              },
              {
                "need": "comfort",
                "weight": 0.8
              }
            ]
          }
        ]
      },
      {
        "id": "television_01",
        "type": "television",
        "capacity": {
          "type": "unlimited"
        },
        "interactions": [
          {
            "id": "watch_television",
            "duration": {
              "type": "continuous"
            },
            "availability": {
              "type": "always"
            },
            "advertisements": [
              {
                "need": "entertainment",
                "weight": 0.75
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

## Object Capacity

Every object has exactly one `capacity` object. Capacity represents the number of NPCs that can simultaneously use one generated object instance.

Capacity is shared across all interactions on the object. For example, a sofa with `slots: 3` and interactions `sit_and_relax` and `socialize_while_seated` has three total shared slots, not three slots per interaction. A future simulator would enforce runtime usage; Version 4 only generates static metadata.

Use `limited` when the object has a meaningful finite number of simultaneous users:

```json
{
  "type": "limited",
  "slots": 3
}
```

`slots` must be an integer from `1` to `100`.

Use `unlimited` when the object does not require meaningful exclusive physical usage slots in this simplified simulation:

```json
{
  "type": "unlimited"
}
```

Unlimited capacity must not contain `slots`.

Each generated object entry represents one object instance. Several separate chairs should normally be generated as separate objects:

```text
chair_01
chair_02
chair_03
chair_04
```

Each chair should have `limited` capacity with `slots: 1`. Do not create one `chair_01` with `slots: 4` merely because the room contains four separate chairs. A multi-person object such as one sofa, bench, dining table, or vehicle seat bank may legitimately have multiple slots.

## Availability

Every interaction has exactly one `availability` object. Version 4 allows exactly two values:

- `always`
- `when_capacity_available`

Capacity and availability must agree:

- `limited` capacity objects must use `when_capacity_available` on every interaction.
- `unlimited` capacity objects must use `always` on every interaction.

The old `when_free` value is no longer valid current-schema output. A former single-user `when_free` object is now a `limited` object with `slots: 1` and interaction availability `when_capacity_available`.

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

## Validation

Generated JSON is schema-validated and then checked with custom validation. The server rejects malformed JSON, unknown fields, object-level advertisements, unsupported need names, duplicate object IDs, duplicate interaction IDs within one object, duplicate advertisements within one interaction, empty interaction lists, empty advertisement lists, invalid interaction IDs, invalid durations, out-of-range weights, missing capacity, malformed capacity, unknown capacity types, invalid `slots`, unlimited capacity containing `slots`, capacity placed inside interactions, missing availability, malformed availability, old `when_free`, and capacity/availability mismatches.

The server asks the LLM for one focused repair attempt before returning a validation failure.

## Current Limitations

- Gemini is the only live LLM provider in this version.
- Recent successful generations and the need catalogue are stored separately in browser `localStorage`.
- Older browser history entries may display as historical JSON, but they are not treated as validated against the current capacity schema.
- Validation rejects invalid generated content but does not semantically rewrite it in application code.
- There is no runtime occupancy, current user tracking, reservations, queues, resources, stock, object state, powered state, locked state, operational state, animations, Behavior Trees, action sequences, behavior logic, utility execution, NPC runtime need bars, simulator execution, database, authentication, or cloud storage.
