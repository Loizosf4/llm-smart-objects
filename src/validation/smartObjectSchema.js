export const smartObjectSchema = {
  type: "object",
  additionalProperties: false,
  required: ["location", "objects"],
  properties: {
    location: {
      type: "string",
      minLength: 1
    },
    objects: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "capacity", "interactions"],
        properties: {
          id: {
            type: "string",
            minLength: 1
          },
          type: {
            type: "string",
            minLength: 1
          },
          capacity: {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: {
                type: "string",
                enum: ["limited", "unlimited"]
              },
              slots: {
                type: "integer",
                minimum: 1,
                maximum: 100
              }
            }
          },
          interactions: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "duration", "availability", "advertisements"],
              properties: {
                id: {
                  type: "string",
                  pattern: "^[a-z][a-z0-9_]*$"
                },
                duration: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["instant", "fixed", "continuous"]
                    },
                    seconds: {
                      type: "number",
                      minimum: 0,
                      maximum: 86400
                    }
                  }
                },
                availability: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["always", "when_capacity_available"]
                    }
                  }
                },
                advertisements: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["need", "weight"],
                    properties: {
                      need: {
                        type: "string",
                        minLength: 1
                      },
                      weight: {
                        type: "number",
                        minimum: 0,
                        maximum: 1
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const smartObjectSchemaForPrompt = {
  ...smartObjectSchema,
  properties: {
    ...smartObjectSchema.properties,
    objects: {
      ...smartObjectSchema.properties.objects,
      description: "A non-empty array of generated physical or environmental smart objects."
    }
  }
};

export function buildSmartObjectResponseSchema(needs) {
  const allowedNeedNames = needs.map((need) => need.name);

  return {
    ...smartObjectSchema,
    properties: {
      ...smartObjectSchema.properties,
      objects: {
        ...smartObjectSchema.properties.objects,
        items: {
          ...smartObjectSchema.properties.objects.items,
          properties: {
            ...smartObjectSchema.properties.objects.items.properties,
            interactions: {
              ...smartObjectSchema.properties.objects.items.properties.interactions,
              items: {
                ...smartObjectSchema.properties.objects.items.properties.interactions.items,
                properties: {
                  ...smartObjectSchema.properties.objects.items.properties.interactions.items.properties,
                  advertisements: {
                    ...smartObjectSchema.properties.objects.items.properties.interactions.items.properties.advertisements,
                    items: {
                      ...smartObjectSchema.properties.objects.items.properties.interactions.items.properties.advertisements.items,
                      properties: {
                        ...smartObjectSchema.properties.objects.items.properties.interactions.items.properties.advertisements.items.properties,
                        need: {
                          type: "string",
                          enum: allowedNeedNames
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}
