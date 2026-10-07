import express from "express";
import request from "supertest";
import type { Logger } from "@bluelibs/runner";
import * as assets from "../../resources/docsUiAssets";
import { createDurableServeHandler } from "../../resources/routeHandlers/createDurableServeHandler";

const warn = jest.fn();
const logger = { warn } as unknown as Logger;
afterEach(() => {
  jest.restoreAllMocks();
  warn.mockClear();
});

test("serves the isolated durable bundle and its styles", async () => {
  const read = jest.spyOn(assets, "readDocsBuildEntry").mockResolvedValue({
    file: "assets/studio.js",
    css: ["assets/studio.css"],
  });
  const app = express();
  app.get("/durable", createDurableServeHandler("/ui", logger));
  const response = await request(app).get("/durable");
  expect(response.status).toBe(200);
  expect(response.text).toContain("/durable/assets/studio.js");
  expect(response.text).toContain("/durable/assets/studio.css");
  expect(response.text).toContain("Runner Dev · Durable Workflows");
  expect(read).toHaveBeenCalledWith("/ui/durable");
});

test("fails visibly when the dashboard has not been built", async () => {
  jest
    .spyOn(assets, "readDocsBuildEntry")
    .mockRejectedValue(new Error("missing manifest"));
  const app = express();
  app.get("/durable", createDurableServeHandler("/ui", logger));
  expect((await request(app).get("/durable")).status).toBe(503);
  expect(warn).toHaveBeenCalledTimes(1);
});
