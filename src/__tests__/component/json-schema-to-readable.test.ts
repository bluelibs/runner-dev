import { jsonSchemaToReadableText } from "../../utils/json-schema-to-readable";

describe("jsonSchemaToReadableText", () => {
  test("handles invalid JSON gracefully", () => {
    const result = jsonSchemaToReadableText("invalid json");
    expect(result).toContain("Error parsing JSON schema:");
  });

  test("formats basic string type", () => {
    const schema = { type: "string" };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toBe("Type: string");
  });

  test("formats object with title and description", () => {
    const schema = {
      title: "User Schema",
      description: "A schema for user data",
      type: "object",
      properties: {
        name: { type: "string", description: "User's name" },
      },
      required: ["name"],
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Schema: User Schema");
    expect(result).toContain("Description: A schema for user data");
    expect(result).toContain("Type: Object");
    expect(result).toContain("Required fields: name");
    expect(result).toContain("name (required):");
  });

  test("formats string with constraints", () => {
    const schema = {
      type: "object",
      properties: {
        email: {
          type: "string",
          format: "email",
          minLength: 5,
          maxLength: 100,
          pattern: ".*@.*",
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Type: string");
    expect(result).toContain("Format: email");
    expect(result).toContain("Minimum length: 5");
    expect(result).toContain("Maximum length: 100");
    expect(result).toContain("Pattern: .*@.*");
  });

  test("formats number with constraints", () => {
    const schema = {
      type: "object",
      properties: {
        age: {
          type: "integer",
          minimum: 0,
          maximum: 120,
          exclusiveMinimum: true,
          multipleOf: 1,
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Type: integer");
    expect(result).toContain("Minimum: 0 (exclusive)");
    expect(result).toContain("Maximum: 120");
    expect(result).toContain("Must be multiple of: 1");
  });

  test("formats array type", () => {
    const schema = {
      type: "array",
      minItems: 1,
      maxItems: 10,
      uniqueItems: true,
      items: { type: "string" },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Type: Array");
    expect(result).toContain("Minimum items: 1");
    expect(result).toContain("Maximum items: 10");
    expect(result).toContain("Items must be unique");
    expect(result).toContain("Item type:");
    expect(result).toContain("Type: string");
  });

  test("formats enum values", () => {
    const schema = {
      type: "object",
      properties: {
        status: {
          enum: ["active", "inactive", "pending"],
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain('Allowed values: "active", "inactive", "pending"');
  });

  test("formats const value", () => {
    const schema = {
      type: "object",
      properties: {
        version: {
          const: "1.0.0",
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain('Constant value: "1.0.0"');
  });

  test("formats oneOf constraint", () => {
    const schema = {
      oneOf: [{ type: "string" }, { type: "number" }],
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Must match exactly one of:");
    expect(result).toContain("Option 1:");
    expect(result).toContain("Option 2:");
  });

  test("formats anyOf constraint", () => {
    const schema = {
      anyOf: [{ type: "string" }, { type: "number" }],
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Must match at least one of:");
    expect(result).toContain("Option 1:");
    expect(result).toContain("Option 2:");
  });

  test("formats allOf constraint", () => {
    const schema = {
      allOf: [{ type: "object" }, { required: ["id"] }],
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Must match all of:");
    expect(result).toContain("Constraint 1:");
    expect(result).toContain("Constraint 2:");
  });

  test("formats nested objects", () => {
    const schema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
          required: ["street"],
          additionalProperties: false,
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("address (optional):");
    expect(result).toContain("Required fields: street");
    expect(result).toContain("street (required):");
    expect(result).toContain("city (optional):");
    expect(result).toContain("Additional properties: not allowed");
  });

  test("formats array of objects", () => {
    const schema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Type: array");
    expect(result).toContain("Item type:");
    expect(result).toContain("Type: object");
    expect(result).toContain("id (optional):");
  });

  test("formats property with default value", () => {
    const schema = {
      type: "object",
      properties: {
        count: {
          type: "integer",
          default: 10,
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Default: 10");
  });

  test("formats property with examples", () => {
    const schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          examples: ["John", "Jane", "Bob"],
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain('Examples: "John", "Jane", "Bob"');
  });

  test("handles additionalProperties true", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      additionalProperties: true,
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Additional properties: allowed");
  });

  test("handles complex nested schema", () => {
    const schema = {
      title: "API Response",
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                },
              },
            ],
          },
        },
        meta: {
          type: "object",
          properties: {
            count: { type: "integer", minimum: 0 },
          },
        },
      },
      required: ["data"],
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Schema: API Response");
    expect(result).toContain("Required fields: data");
    expect(result).toContain("data (required):");
    expect(result).toContain("meta (optional):");
    expect(result).toContain("Must match exactly one of:");
  });

  test("resolves $ref references", () => {
    const schema = {
      $ref: "#/definitions/Schema",
      definitions: {
        Schema: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      $schema: "http://json-schema.org/draft-07/schema#",
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("Type: Object");
    expect(result).toContain("Required fields: name");
    expect(result).toContain("name (required):");
    expect(result).toContain("Additional properties: not allowed");
  });

  test("handles unresolvable $ref", () => {
    const schema = {
      $ref: "#/definitions/NonExistent",
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain(
      "Reference: #/definitions/NonExistent (unresolved)"
    );
  });

  test("handles $ref in nested properties", () => {
    const schema = {
      type: "object",
      properties: {
        user: { $ref: "#/definitions/User" },
      },
      definitions: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    };
    const result = jsonSchemaToReadableText(JSON.stringify(schema));
    expect(result).toContain("user (optional):");
    expect(result).toContain("Type: object");
    expect(result).toContain("id (optional):");
    expect(result).toContain("name (optional):");
  });
});
