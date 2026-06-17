# LLM Smart Object Generator

An experimental environment-first generator for manually inspecting smart-object JSON. Version 5 tests whether an LLM can determine which generated objects genuinely require simple state flags or finite consumable resources, connect interactions to those declarations, distinguish direct need-satisfying interactions from object-side support actions, and avoid unnecessarily adding state to ordinary objects.

The generated structure is:

```text
Object
-> Capacity
-> State flags
-> Finite resources
-> Interactions
   -> Duration
   -> Capacity-aware availability
   -> Object-side requirements
   -> Declarative effects
   -> Advertised needs
   -> Weights
```

This remains a JSON-generation experiment. Version 5 adds only constrained object-side state and finite resource metadata. It does not include a simulator, runtime state changes, resource mutation, occupancy, reservations, queues, NPC conditions, planning, animations, Behavior Trees, executable code, databases, authentication, or cloud storage.

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

`GEMINI_API_KEY` and `GEMINI_MODEL` are required for live generation. The API key is sent only from the Express backend using the `x-goog-api-key` header and is never sent to browser code.

## Running

```bash
npm start
```

Open:

```text
http://127.0.0.1:3000
```

## Need Catalogue

The persistent editable need catalogue remains unchanged in Version 5. The frontend loads defaults from `public/default-needs.json`, autosaves edits in browser `localStorage` under `llm-smart-object-need-catalogue`, and keeps this catalogue separate from generated-result history.

Each need still has:

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

The twelve defaults are `hunger`, `thirst`, `rest`, `comfort`, `entertainment`, `social`, `safety`, `curiosity`, `bladder`, `hygiene`, `physical_activity`, and `mental_activity`. Add, remove, reset, import, export, autosave, and calibration prompt context are preserved.

## Output Example

```json
{
  "success": true,
  "data": {
    "location": "A break room",
    "objects": [
      {
        "id": "sofa_01",
        "type": "three_seat_sofa",
        "capacity": {
          "type": "limited",
          "slots": 3
        },
        "stateFlags": [],
        "resources": [],
        "interactions": [
          {
            "id": "sit_and_relax",
            "duration": {
              "type": "continuous"
            },
            "availability": {
              "type": "when_capacity_available"
            },
            "requirements": [],
            "effects": [],
            "advertisements": [
              {
                "need": "rest",
                "weight": 0.55
              }
            ]
          }
        ]
      },
      {
        "id": "coffee_machine_01",
        "type": "coffee_machine",
        "capacity": {
          "type": "limited",
          "slots": 1
        },
        "stateFlags": [
          {
            "id": "powered_on",
            "initial": true
          },
          {
            "id": "operational",
            "initial": true
          }
        ],
        "resources": [
          {
            "id": "coffee_servings",
            "initial": 20,
            "maximum": 20
          }
        ],
        "interactions": [
          {
            "id": "get_and_drink_coffee",
            "duration": {
              "type": "fixed",
              "seconds": 60
            },
            "availability": {
              "type": "when_capacity_available"
            },
            "requirements": [
              {
                "type": "state_equals",
                "state": "powered_on",
                "value": true
              },
              {
                "type": "state_equals",
                "state": "operational",
                "value": true
              },
              {
                "type": "resource_at_least",
                "resource": "coffee_servings",
                "amount": 1
              }
            ],
            "effects": [
              {
                "type": "change_resource",
                "resource": "coffee_servings",
                "amount": -1
              }
            ],
            "advertisements": [
              {
                "need": "mental_activity",
                "weight": 0.15
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Generated advertisements remain only `{ "need": "...", "weight": ... }`. Need definitions and calibration references are prompt context only.

Every interaction still has an `advertisements` array. The array may be empty only when the interaction has at least one valid object-side effect, such as turning a device on or off, cleaning an object, repairing it, opening or closing it, or refilling finite stock. Empty advertisements with no effects, or with requirements only, are invalid. The generator should not invent tiny advertisements merely to make this array non-empty.

## Capacity

Capacity remains object-level. Every object has `capacity`, and all interactions on that object share the same capacity pool.

- `limited` requires integer `slots` from `1` to `100`.
- `unlimited` must omit `slots`.
- Limited objects use interaction availability `when_capacity_available`.
- Unlimited objects use interaction availability `always`.

Capacity is static metadata. Runtime occupancy, current users, available slots, reservations, and queues are not generated or executed.

## State Flags

Every object has a `stateFlags` array. Empty arrays are valid and expected for ordinary passive objects.

State declarations have:

```json
{
  "id": "operational",
  "initial": true
}
```

Approved state IDs are exactly:

- `powered_on`
- `operational`
- `locked`
- `open`
- `clean`

Each state ID must be unique within an object. Every declared state must be referenced by at least one interaction requirement on that object. Effects may set declared states, but effect-only references do not satisfy the state-use rule. Do not create aftermath-only state flags that never affect whether an interaction is available. Do not use state flags for occupancy, reservations, queues, capacity, NPC needs, NPC inventory, time, duration, or object count.

When a reusable object can move into a blocking state, include a coherent restoration interaction when appropriate. For example, a toilet may have `use_toilet` requiring `clean: true` and setting `clean: false`, plus `clean_toilet` requiring `clean: false`, setting `clean: true`, and using empty advertisements because it is maintenance rather than direct need satisfaction.

## Finite Resources

Every object has a `resources` array. Empty arrays are valid and expected for objects without finite stock.

Resource declarations have:

```json
{
  "id": "snack_units",
  "initial": 12,
  "maximum": 20
}
```

Resource IDs are lowercase identifiers. `initial` is an integer from `0` to `100000`, `maximum` is an integer from `1` to `100000`, and `initial` must not exceed `maximum`. Every declared resource must be referenced by at least one requirement or effect on that object.

Use resources only for finite object-side stock such as `coffee_servings`, `snack_units`, `paper_sheets`, `soap_uses`, `water_bottles`, or `clean_towels`. Do not use resources for capacity slots, current users, NPC money, NPC inventory, need values, time, health, or utility scores.

## Requirements

Every interaction has a `requirements` array. Requirements are object-side conditions for a future simulator. Empty arrays are valid.

Allowed requirement types:

- `state_equals`: references a declared state and Boolean value.
- `resource_at_least`: references a declared resource and integer amount from `1` to `100000`.

Requirements must reference declarations on the same object only. They must not depend on NPC role, personality, inventory, money, need urgency, time of day, weather, distance, pathfinding, occupancy, capacity slots, queue state, or another object.

## Effects

Every interaction has an `effects` array. Effects are declarative object-side changes expected after successful completion. They are not executed by this generator.

Allowed effect types:

- `set_state`: references a declared state and Boolean value.
- `change_resource`: references a declared resource and a non-zero integer amount from `-100000` to `100000`.

Negative resource changes consume stock; positive changes replenish stock. Effects must not model need satisfaction, capacity, availability, occupancy, reservations, queues, scripts, or behavior logic.

## Validation

Generated JSON is schema-validated and then checked with custom validation. Validation rejects malformed JSON, unknown fields, invalid capacity, capacity/availability mismatches, old `when_free`, invalid duration, invalid IDs, duplicate IDs, unsupported need names, invalid weights, invalid or unused state declarations, invalid or unused resources, malformed requirements, malformed effects, undeclared local references, duplicate identical requirements/effects, and forbidden runtime/NPC/cross-object fields.

State declarations are considered used only when referenced by an interaction requirement. Resource declarations are considered used when referenced by either a requirement or an effect, so refill-only effects remain valid. Empty advertisements are valid only for interactions with at least one valid object-side effect.

The server asks the LLM for one focused repair attempt before returning a validation failure.

## Current Limitations

- Gemini is the only live LLM provider in this version.
- Recent successful generations and the need catalogue are stored separately in browser `localStorage`.
- Older browser history entries may display as historical JSON, but they are not treated as validated against the current Version 5 schema.
- Validation rejects invalid generated content but does not semantically rewrite it in application code.
- There is no simulator, runtime state engine, runtime resource engine, occupancy, reservations, queues, NPC conditions, planning, navigation, pathfinding, animations, Behavior Trees, executable code, utility execution, database, authentication, or cloud storage.

## Tests

```bash
npm test
```

The automated tests mock LLM responses and do not require a live API key.
