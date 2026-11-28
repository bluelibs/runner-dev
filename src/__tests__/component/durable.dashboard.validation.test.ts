import { fixture, close } from "./durable.dashboard.fixtures";
import { createRequire } from "node:module";
import { ZodError } from "zod/v3";
import { isZodValidationError } from "../../durable/errors";

const loadConsumerPackage = createRequire(__filename);

test("recognizes validation errors from a separate consumer Zod copy", () => {
  let foreignError: unknown;
  jest.isolateModules(() => {
    const consumerZod: typeof import("zod/v3") = loadConsumerPackage("zod/v3");
    foreignError = new consumerZod.ZodError([]);
  });
  expect(foreignError).not.toBeInstanceOf(ZodError);
  expect(isZodValidationError(foreignError)).toBe(true);
  expect(isZodValidationError(new Error("Unexpected failure"))).toBe(false);
  expect(isZodValidationError({ name: "ZodError", issues: [] })).toBe(false);
});

test.each([3, 4])(
  "schedule updates report Zod %i consumer validation failures as HTTP 400",
  async (version) => {
    const app = await fixture(true, version === 3);
    try {
      const runtimes = await app.get("/runtimes");
      const runtimeId = runtimes.body.runtimes.find((entry: { id: string }) =>
        entry.id.endsWith(".left")
      ).id;
      const id = await app.seedSchedule("validation", 600000, "Original");
      const route = `${app.prefix}/schedules/${id}?runtimeId=${runtimeId}`;
      const invalid = await app.client
        .patch(route)
        .set("Authorization", app.auth)
        .send({ input: { name: 7 } });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error).toContain("name");
      const unchanged = await app.get(`/schedules?runtimeId=${runtimeId}`);
      expect(unchanged.body.schedules[0].input.name).toBe("Original");

      const updated = await app.client
        .patch(route)
        .set("Authorization", app.auth)
        .send({ input: { name: "Updated", wait: false } });
      expect(updated.status).toBe(200);
      const schedules = await app.get(`/schedules?runtimeId=${runtimeId}`);
      expect(schedules.body.schedules[0].input.name).toBe("Updated");
    } finally {
      await close(app.server);
      await app.runtime.dispose();
    }
  }
);
