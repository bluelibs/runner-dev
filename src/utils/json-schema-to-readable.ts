export function jsonSchemaToReadableText(schemaString: string): string {
  try {
    const schema = JSON.parse(schemaString);
    return formatSchema(schema, 0, schema);
  } catch (error) {
    return `Error parsing JSON schema: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}

function resolveRef(ref: string, rootSchema: any): any {
  if (!ref.startsWith("#/")) return null;

  const path = ref.slice(2).split("/");
  let current = rootSchema;

  for (const part of path) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return current;
}

function formatSchema(
  schema: any,
  depth: number = 0,
  rootSchema?: any
): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  // Handle $ref
  if (schema.$ref && rootSchema) {
    const resolved = resolveRef(schema.$ref, rootSchema);
    if (resolved) {
      return formatSchema(resolved, depth, rootSchema);
    } else {
      lines.push(`${indent}Reference: ${schema.$ref} (unresolved)`);
      return lines.join("\n");
    }
  }

  // Handle title and description at root level
  if (depth === 0) {
    if (schema.title) {
      lines.push(`Schema: ${schema.title}`);
      lines.push("");
    }
    if (schema.description) {
      lines.push(`Description: ${schema.description}`);
      lines.push("");
    }
  }

  // Handle different schema types
  if (schema.type === "object") {
    if (depth === 0) {
      lines.push("Type: Object");
      if (schema.required && schema.required.length > 0) {
        lines.push(`Required fields: ${schema.required.join(", ")}`);
      }
      lines.push("");
      lines.push("Properties:");
    }

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(propName)
          ? " (required)"
          : " (optional)";
        lines.push("");
        lines.push(`${indent}  ${propName}${required}:`);
        lines.push(formatProperty(propSchema as any, depth + 2, rootSchema));
      }
    }

    if (schema.additionalProperties !== undefined) {
      lines.push("");
      lines.push(
        `${indent}  Additional properties: ${
          schema.additionalProperties === false ? "not allowed" : "allowed"
        }`
      );
    }
  } else if (schema.type === "array") {
    lines.push(`${indent}Type: Array`);
    if (schema.minItems !== undefined) {
      lines.push(`${indent}Minimum items: ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined) {
      lines.push(`${indent}Maximum items: ${schema.maxItems}`);
    }
    if (schema.uniqueItems) {
      lines.push(`${indent}Items must be unique`);
    }
    if (schema.items) {
      lines.push(`${indent}Item type:`);
      lines.push(formatProperty(schema.items, depth + 1, rootSchema));
    }
  } else if (schema.enum) {
    lines.push(
      `${indent}Allowed values: ${schema.enum
        .map((v: any) => JSON.stringify(v))
        .join(", ")}`
    );
  } else if (schema.const !== undefined) {
    lines.push(`${indent}Constant value: ${JSON.stringify(schema.const)}`);
  } else if (schema.type) {
    lines.push(`${indent}Type: ${schema.type}`);
  }

  // Handle oneOf, anyOf, allOf
  if (schema.oneOf) {
    lines.push(`${indent}Must match exactly one of:`);
    schema.oneOf.forEach((subSchema: any, index: number) => {
      lines.push(`${indent}  Option ${index + 1}:`);
      lines.push(formatProperty(subSchema, depth + 2, rootSchema));
    });
  }
  if (schema.anyOf) {
    lines.push(`${indent}Must match at least one of:`);
    schema.anyOf.forEach((subSchema: any, index: number) => {
      lines.push(`${indent}  Option ${index + 1}:`);
      lines.push(formatProperty(subSchema, depth + 2, rootSchema));
    });
  }
  if (schema.allOf) {
    lines.push(`${indent}Must match all of:`);
    schema.allOf.forEach((subSchema: any, index: number) => {
      lines.push(`${indent}  Constraint ${index + 1}:`);
      lines.push(formatProperty(subSchema, depth + 2, rootSchema));
    });
  }

  return lines.join("\n");
}

function formatProperty(prop: any, depth: number, rootSchema?: any): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  // Handle $ref
  if (prop.$ref && rootSchema) {
    const resolved = resolveRef(prop.$ref, rootSchema);
    if (resolved) {
      return formatProperty(resolved, depth, rootSchema);
    } else {
      lines.push(`${indent}Reference: ${prop.$ref} (unresolved)`);
      return lines.join("\n");
    }
  }

  // Type
  if (prop.type) {
    lines.push(`${indent}Type: ${prop.type}`);
  }

  // Description
  if (prop.description) {
    lines.push(`${indent}Description: ${prop.description}`);
  }

  // Format
  if (prop.format) {
    lines.push(`${indent}Format: ${prop.format}`);
  }

  // Default value
  if (prop.default !== undefined) {
    lines.push(`${indent}Default: ${JSON.stringify(prop.default)}`);
  }

  // String constraints
  if (prop.type === "string") {
    if (prop.minLength !== undefined) {
      lines.push(`${indent}Minimum length: ${prop.minLength}`);
    }
    if (prop.maxLength !== undefined) {
      lines.push(`${indent}Maximum length: ${prop.maxLength}`);
    }
    if (prop.pattern) {
      lines.push(`${indent}Pattern: ${prop.pattern}`);
    }
  }

  // Number constraints
  if (prop.type === "number" || prop.type === "integer") {
    if (prop.minimum !== undefined) {
      lines.push(
        `${indent}Minimum: ${prop.minimum}${
          prop.exclusiveMinimum ? " (exclusive)" : ""
        }`
      );
    }
    if (prop.maximum !== undefined) {
      lines.push(
        `${indent}Maximum: ${prop.maximum}${
          prop.exclusiveMaximum ? " (exclusive)" : ""
        }`
      );
    }
    if (prop.multipleOf !== undefined) {
      lines.push(`${indent}Must be multiple of: ${prop.multipleOf}`);
    }
  }

  // Enum values
  if (prop.enum) {
    lines.push(
      `${indent}Allowed values: ${prop.enum
        .map((v: any) => JSON.stringify(v))
        .join(", ")}`
    );
  }

  // Const value
  if (prop.const !== undefined) {
    lines.push(`${indent}Constant value: ${JSON.stringify(prop.const)}`);
  }

  // Handle nested objects
  if (prop.type === "object" && prop.properties) {
    if (prop.required && prop.required.length > 0) {
      lines.push(`${indent}Required fields: ${prop.required.join(", ")}`);
    }
    lines.push(`${indent}Properties:`);
    for (const [nestedPropName, nestedPropSchema] of Object.entries(
      prop.properties
    )) {
      const required = prop.required?.includes(nestedPropName)
        ? " (required)"
        : " (optional)";
      lines.push(`${indent}  ${nestedPropName}${required}:`);
      lines.push(
        formatProperty(nestedPropSchema as any, depth + 2, rootSchema)
      );
    }
    if (prop.additionalProperties !== undefined) {
      lines.push(
        `${indent}Additional properties: ${
          prop.additionalProperties === false ? "not allowed" : "allowed"
        }`
      );
    }
  }

  // Handle arrays
  if (prop.type === "array") {
    if (prop.minItems !== undefined) {
      lines.push(`${indent}Minimum items: ${prop.minItems}`);
    }
    if (prop.maxItems !== undefined) {
      lines.push(`${indent}Maximum items: ${prop.maxItems}`);
    }
    if (prop.uniqueItems) {
      lines.push(`${indent}Items must be unique`);
    }
    if (prop.items) {
      lines.push(`${indent}Item type:`);
      lines.push(formatProperty(prop.items, depth + 1, rootSchema));
    }
  }

  // Handle oneOf, anyOf, allOf
  if (prop.oneOf) {
    lines.push(`${indent}Must match exactly one of:`);
    prop.oneOf.forEach((subSchema: any, index: number) => {
      lines.push(`${indent}  Option ${index + 1}:`);
      lines.push(formatProperty(subSchema, depth + 2, rootSchema));
    });
  }
  if (prop.anyOf) {
    lines.push(`${indent}Must match at least one of:`);
    prop.anyOf.forEach((subSchema: any, index: number) => {
      lines.push(`${indent}  Option ${index + 1}:`);
      lines.push(formatProperty(subSchema, depth + 2, rootSchema));
    });
  }
  if (prop.allOf) {
    lines.push(`${indent}Must match all of:`);
    prop.allOf.forEach((subSchema: any, index: number) => {
      lines.push(`${indent}  Constraint ${index + 1}:`);
      lines.push(formatProperty(subSchema, depth + 2, rootSchema));
    });
  }

  // Examples
  if (prop.examples && prop.examples.length > 0) {
    lines.push(
      `${indent}Examples: ${prop.examples
        .map((e: any) => JSON.stringify(e))
        .join(", ")}`
    );
  }

  return lines.join("\n");
}
