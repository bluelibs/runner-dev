import { defineTag } from "@bluelibs/runner";

export type HttpTagConfig = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
};

export const httpTag = defineTag<HttpTagConfig>({
  id: "http",
});
