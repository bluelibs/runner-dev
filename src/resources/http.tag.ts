import { tag } from "@bluelibs/runner";

export type HttpTagConfig = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
};

export const httpTag = tag<HttpTagConfig>({
  id: "runner-dev.tags.http",
});
