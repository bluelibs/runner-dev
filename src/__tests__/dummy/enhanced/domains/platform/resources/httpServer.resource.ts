import { defineResource } from "@bluelibs/runner";
import { HttpServerConfigSchema } from "../../../schemas";
import { httpTag } from "../tags/http.tag";

type HttpServerValue = {
  baseUrl: string;
  routes: Array<{ method: string; path: string }>;
  ingressReady: boolean;
  status: "booting" | "ready" | "cooling-down";
};

function registerHttpRoutes(): Array<{ method: string; path: string }> {
  return [
    { method: "GET", path: "/catalog/search" },
    { method: "POST", path: "/orders/review" },
  ];
}

export const httpServerResource = defineResource({
  id: "http-server",
  tags: [httpTag.with({ method: "GET", path: "/", visibility: "public" })],
  configSchema: HttpServerConfigSchema,
  meta: {
    title: "HTTP Server",
    description:
      "Represents the inbound API edge for the reference app.\n\n- Registers simulated routes during init\n- Uses ready() to model the point where ingress opens",
  },
  init: async (config): Promise<HttpServerValue> => ({
    baseUrl: `http://${config.host}:${config.port}`,
    routes: registerHttpRoutes(),
    ingressReady: false,
    status: "booting",
  }),
  ready: async (value) => {
    value.ingressReady = true;
    value.status = "ready";
  },
  cooldown: async (value) => {
    value.ingressReady = false;
    value.status = "cooling-down";
  },
  dispose: async (value) => {
    value.ingressReady = false;
    value.status = "cooling-down";
  },
  health: async (value) => ({
    status: value?.ingressReady ? "healthy" : "degraded",
    details: value
      ? {
          baseUrl: value.baseUrl,
          ingressReady: value.ingressReady,
          routeCount: value.routes.length,
        }
      : "not-initialized",
  }),
});
