import {
  buildClientSchema,
  getIntrospectionQuery,
  printSchema,
  type IntrospectionQuery,
} from "graphql";
import { callGraphQL } from "./http";

export async function fetchSchemaSDL(): Promise<string> {
  const introspectionQuery = getIntrospectionQuery();
  const result = (await callGraphQL({
    query: introspectionQuery,
  })) as { data?: IntrospectionQuery; errors?: unknown } | undefined;

  if (!result || !result.data) {
    throw new Error(
      `Introspection failed. Response: ${JSON.stringify(result ?? {}, null, 2)}`
    );
  }

  const schema = buildClientSchema(result.data);
  return printSchema(schema);
}


