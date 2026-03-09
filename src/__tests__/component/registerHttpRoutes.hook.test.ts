import { httpTag } from "../../resources/http.tag";
import { registerHttpRoutes } from "../../resources/routeHandlers/registerHttpRoutes.hook";

describe("registerHttpRoutes hook", () => {
  test("registers tagged tasks from the tag accessor and executes them", async () => {
    const task = { id: "task-http-probe", meta: {} } as any;
    const runTask = jest.fn().mockResolvedValue({ ok: true });

    let registeredHandler: ((req: any, res: any) => Promise<void>) | undefined;

    const app = {
      get: jest.fn(
        (_path: string, handler: (req: any, res: any) => Promise<void>) => {
          registeredHandler = handler;
        }
      ),
    };

    const store = {
      getTagAccessor: jest.fn().mockReturnValue({
        tasks: [
          {
            definition: task,
            config: {
              method: "GET",
              path: "/health",
            },
          },
        ],
      }),
    };

    await registerHttpRoutes.run(
      undefined as any,
      {
        store,
        server: { app },
        taskRunner: { run: runTask },
      } as any
    );

    expect(store.getTagAccessor).toHaveBeenCalledWith(httpTag);
    expect(app.get).toHaveBeenCalledWith("/health", expect.any(Function));
    expect(registeredHandler).toBeDefined();

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await registeredHandler?.(
      {
        body: { ok: true },
        params: { id: "123" },
        query: { filter: "all" },
      },
      res
    );

    expect(runTask).toHaveBeenCalledWith(task, {
      ok: true,
      id: "123",
      filter: "all",
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.status).not.toHaveBeenCalled();
  });
});
