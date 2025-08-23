File: src/ai/model.ts

```ts
import OpenAI from "openai";
import { z, ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export type ChatRole = "system" | "user" | "assistant" | "tool";
export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AskOptions<T> {
  history?: ChatMessage[];
  system?: string;
  temperature?: number;
  responseSchema?: ZodTypeAny;
  tools?: ToolSpec[]; // optional tool calling
  maxToolLoops?: number; // stop infinite tool loops
}

export interface AskResult<T = unknown> {
  answer: T;
  history: ChatMessage[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface IModel {
  ask<T = unknown>(
    prompt: string,
    options?: AskOptions<T>
  ): Promise<AskResult<T>>;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  handler: (args: any) => Promise<any>;
}

function toOpenAITools(tools: ToolSpec[]) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: "object", properties: {} },
    },
  }));
}

export class OpenAIModel implements IModel {
  constructor(
    private cfg: {
      apiKey: string;
      model: string;
      defaultSystem?: string;
      jsonStrict?: boolean;
    }
  ) {
    if (!cfg.apiKey) throw new Error("OpenAI apiKey missing");
    this.client = new OpenAI({ apiKey: cfg.apiKey });
  }

  private client: OpenAI;

  async ask<T = unknown>(
    prompt: string,
    options?: AskOptions<T>
  ): Promise<AskResult<T>> {
    const system = options?.system ?? this.cfg.defaultSystem;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: "system", content: system });
    if (options?.history?.length) {
      for (const m of options.history) {
        messages.push({
          role: m.role as any,
          content: m.content,
          name: m.name,
          tool_call_id: (m as any).tool_call_id,
        });
      }
    }
    messages.push({ role: "user", content: prompt });

    const tools = options?.tools;
    const toolsOpenAI = tools?.length ? toOpenAITools(tools) : undefined;

    let history = (options?.history || []).slice();
    if (system) history = [{ role: "system", content: system }, ...history];

    const runOnce = async () => {
      const responseFormat = options?.responseSchema
        ? {
            type: "json_schema" as const,
            json_schema: {
              name: "Response",
              schema: zodToJsonSchema(options.responseSchema!, "Response"),
              strict: this.cfg.jsonStrict ?? true,
            },
          }
        : undefined;

      const resp = await this.client.chat.completions.create({
        model: this.cfg.model,
        messages,
        temperature: options?.temperature ?? 0.2,
        tools: toolsOpenAI as any,
        tool_choice: toolsOpenAI ? "auto" : undefined,
        response_format: responseFormat as any,
      });

      const choice = resp.choices[0];
      const msg = choice.message;
      return { resp, msg };
    };

    if (!toolsOpenAI) {
      const { resp, msg } = await runOnce();
      const text = msg.content || "";
      const answer = options?.responseSchema ? JSON.parse(text) : (text as any);
      const assistantMsg: ChatMessage = { role: "assistant", content: text };
      return {
        answer,
        history: [...history, assistantMsg],
        usage: {
          promptTokens: resp.usage?.prompt_tokens,
          completionTokens: resp.usage?.completion_tokens,
          totalTokens: resp.usage?.total_tokens,
        },
      };
    }

    // Tool-calling loop
    let loop = 0;
    let localMessages = messages.slice();
    while (loop++ < (options?.maxToolLoops ?? 5)) {
      const { resp, msg } = await this.client.chat.completions.create({
        model: this.cfg.model,
        messages: localMessages,
        temperature: options?.temperature ?? 0.2,
        tools: toolsOpenAI as any,
        tool_choice: "auto",
      });

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        const text = msg.content || "";
        const answer = options?.responseSchema
          ? JSON.parse(text)
          : (text as any);
        const assistantMsg: ChatMessage = { role: "assistant", content: text };
        return {
          answer,
          history: [...history, assistantMsg],
          usage: {
            promptTokens: resp.usage?.prompt_tokens,
            completionTokens: resp.usage?.completion_tokens,
            totalTokens: resp.usage?.total_tokens,
          },
        };
      }

      // Execute tools
      localMessages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: toolCalls,
      } as any);
      for (const call of toolCalls) {
        const toolName = call.function?.name!;
        const tool = tools!.find((t) => t.name === toolName);
        if (!tool) {
          localMessages.push({
            role: "tool",
            tool_call_id: call.id!,
            content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
          } as any);
          continue;
        }
        const args = JSON.parse(call.function?.arguments || "{}");
        const result = await tool.handler(args);
        localMessages.push({
          role: "tool",
          tool_call_id: call.id!,
          content: JSON.stringify(result ?? null),
        } as any);
      }
    }

    throw new Error("Tool-calling exceeded max loops");
  }
}

export class MockModel implements IModel {
  constructor(private scripted: Array<any>) {}
  private i = 0;
  async ask<T = unknown>(
    _prompt: string,
    options?: AskOptions<T>
  ): Promise<AskResult<T>> {
    const next = this.scripted[this.i++];
    let answer: any = next;
    if (options?.responseSchema) {
      // Validate via schema for extra safety
      answer = options.responseSchema.parse(next);
    }
    return {
      answer,
      history: [{ role: "assistant", content: JSON.stringify(answer) }],
    };
  }
}
```

File: src/ai/agent.ts

```ts
import { IModel, AskOptions } from "./model";

export class Agent {
  constructor(
    public id: string,
    private cfg: {
      description?: string;
      system?: string;
      model: IModel;
    }
  ) {}

  async ask<T>(prompt: string, options?: Omit<AskOptions<T>, "system">) {
    return this.cfg.model.ask<T>(prompt, {
      ...options,
      system: this.cfg.system,
    });
  }
}
```

File: src/ai/schemas.ts

```ts
import { z } from "zod";

// Utility primitives
export const zJSONSchema = z.any(); // placeholder, can be refined

export const ResourceSpec = z.object({
  id: z.string(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  config: z.record(z.any()).optional(),
});

export const MiddlewareSpec = z.object({
  id: z.string(),
  type: z.enum(["task", "resource"]),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
});

export const EventSpec = z.object({
  id: z.string(),
  payloadSchema: zJSONSchema.optional(),
  description: z.string().optional(),
});

export const HookSpec = z.object({
  id: z.string(),
  on: z.string(), // event id
  description: z.string().optional(),
});

export const TaskRoute = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().optional(),
});

export const TaskSpec = z.object({
  id: z.string(),
  description: z.string().optional(),
  inputSchema: zJSONSchema.optional(),
  resultSchema: zJSONSchema.optional(),
  route: TaskRoute.optional(),
  meta: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export const TestSpec = z.object({
  id: z.string(),
  description: z.string(),
  acceptance: z.array(z.string()),
});

export const Plan = z.object({
  resources: z.array(ResourceSpec).default([]),
  middleware: z.array(MiddlewareSpec).default([]),
  events: z.array(EventSpec).default([]),
  hooks: z.array(HookSpec).default([]),
  tasks: z.array(TaskSpec).default([]),
  tests: z.array(TestSpec).default([]),
});

export type TPlan = z.infer<typeof Plan>;

export const ProjectSpec = z.object({
  brief: z.string().describe("High-level project description"),
  existingResources: z.array(z.string()).default([]),
  nonFunctional: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  docs: z.string().optional(), // pass BlueLibs Runner docs here if desired
});

export type TProjectSpec = z.infer<typeof ProjectSpec>;
```

File: src/ai/prompts.ts

```ts
import { TProjectSpec } from "./schemas";

export function planPrompt(spec: TProjectSpec) {
  return `
You are the Lead Software Architect. You must design a plan consisting of resources, middleware, events, hooks, and tasks for an application built with BlueLibs Runner.

Project brief:
${spec.brief}

Existing resources:
${spec.existingResources.join("\n") || "None"}

Non-functional requirements:
${spec.nonFunctional.join("\n") || "None"}

Constraints:
${spec.constraints.join("\n") || "None"}

Library context (BlueLibs Runner Guide):
${
  spec.docs ||
  "The caller can supply the guide content here. Use standard patterns from the guide."
}

Return ONLY valid JSON matching the Plan schema. Be realistic and minimal, with ids following the recommended namespacing.
`;
}
```

File: src/resources/aiModel.resource.ts

```ts
import { resource } from "@bluelibs/runner";
import { IModel, OpenAIModel } from "../ai/model";

export const aiModel = resource({
  id: "ai.resources.model",
  configSchema: (v: any) => v, // optional
  init: async (cfg?: {
    apiKey?: string;
    model?: string;
    jsonStrict?: boolean;
  }) => {
    const apiKey = cfg?.apiKey ?? process.env.OPENAI_API_KEY!;
    const model = cfg?.model ?? "gpt-4o-mini"; // pick your default
    const instance: IModel = new OpenAIModel({
      apiKey,
      model,
      jsonStrict: cfg?.jsonStrict ?? true,
      defaultSystem:
        "You are a precise TypeScript architect. You MUST honor provided JSON Schemas when asked.",
    });
    return instance;
  },
});
```

File: src/resources/fs.resource.ts

```ts
import { resource } from "@bluelibs/runner";
import { promises as fs } from "fs";
import * as path from "path";

export interface FileMap {
  [relativePath: string]: { contents: string };
}

export const fsWriter = resource({
  id: "platform.resources.fsWriter",
  init: async () => {
    return {
      writeFiles: async (rootDir: string, files: FileMap) => {
        const written: string[] = [];
        for (const [rel, { contents }] of Object.entries(files)) {
          const full = path.join(rootDir, rel);
          await fs.mkdir(path.dirname(full), { recursive: true });
          await fs.writeFile(full, contents, "utf8");
          written.push(full);
        }
        return written;
      },
    };
  },
});
```

File: src/events/ai.events.ts

```ts
import { event } from "@bluelibs/runner";
import { Plan } from "../ai/schemas";

export const planCreated = event<{ plan: any; spec: any }>({
  id: "ai.events.planCreated",
});

export const codeGenerated = event<{
  files: Record<string, { contents: string }>;
  plan: any;
}>({
  id: "ai.events.codeGenerated",
});

export const filesWritten = event<{ paths: string[] }>({
  id: "ai.events.filesWritten",
});

export const agentCompleted = event<{ agentId: string; summary: string }>({
  id: "ai.events.agentCompleted",
});
```

File: src/tags/http.tag.ts

```ts
import { tag } from "@bluelibs/runner";

export const httpTag = tag<{
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}>({
  id: "app.tags.http",
});
```

File: src/middleware/auth.middleware.ts

```ts
import { taskMiddleware } from "@bluelibs/runner";

export const auth = taskMiddleware<{ role: string }, any, any>({
  id: "security.middleware.auth",
  run: async ({ task, next }, _deps, cfg) => {
    const role = (task.input as any)?.user?.role;
    if (role !== cfg.role) throw new Error("Unauthorized");
    return next(task.input);
  },
});
```

File: src/middleware/guardrails.middleware.ts

```ts
import { taskMiddleware, globals } from "@bluelibs/runner";

export const guardrails = taskMiddleware<{ max?: number }, any, any>({
  id: "ai.middleware.guardrails",
  run: async ({ next }, _deps, cfg) => {
    const tryMax = cfg.max ?? 2;
    let lastErr: any;
    for (let i = 0; i < tryMax; i++) {
      try {
        return await next();
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
});

// reuse globals.middleware.retry/timeout/cache as needed in tasks
```

File: src/hooks/registerRoutes.hook.ts

```ts
import { hook, globals } from "@bluelibs/runner";
import { httpTag } from "../tags/http.tag";
import express from "express";

export const expressServer = (() => {
  // Simple server as resource
  return {
    id: "infra.resources.expressServer",
    resource: true,
  };
})();

export const registerRoutes = hook({
  id: "app.hooks.registerRoutes",
  on: globals.events.ready,
  dependencies: {
    store: globals.resources.store,
    logger: globals.resources.logger,
  },
  run: async (_e, { store, logger }) => {
    const tasks = store.getTasksWithTag(httpTag);
    if (!tasks.length) return;

    // If you already have an express server resource, use it here.
    logger.info(`Discovered ${tasks.length} http-tagged tasks for routing`);
    // Example: see docs how to wire to your own express resource.
  },
});
```

File: src/tasks/architect.plan.task.ts

```ts
import { task, globals } from "@bluelibs/runner";
import { aiModel } from "../resources/aiModel.resource";
import { Agent } from "../ai/agent";
import { planPrompt } from "../ai/prompts";
import { Plan, ProjectSpec } from "../ai/schemas";
import { planCreated, agentCompleted } from "../events/ai.events";

export const architectPlan = task({
  id: "ai.tasks.architect.plan",
  dependencies: {
    model: aiModel,
    logger: globals.resources.logger,
    eventManager: globals.resources.eventManager,
  },
  inputSchema: ProjectSpec,
  resultSchema: Plan,
  middleware: [
    globals.middleware.retry.with({
      retries: 2,
      delayStrategy: (n) => 500 * n,
    }),
    globals.middleware.timeout.with({ ttl: 60_000 }),
  ],
  run: async (spec, { model, logger, eventManager }) => {
    const architect = new Agent("architect", {
      description: "Designs Runner-based plans",
      system:
        "You output only JSON for planning. Use BlueLibs Runner primitives. Keep it concise and implementable.",
      model,
    });
    const { answer } = await architect.ask(planPrompt(spec), {
      responseSchema: Plan,
    });
    await eventManager.emit(planCreated, { plan: answer, spec });
    await eventManager.emit(agentCompleted, {
      agentId: "architect",
      summary: `Planned ${answer.resources.length} resources, ${answer.tasks.length} tasks`,
    });
    logger.info("Architect produced a plan", {
      counts: {
        resources: answer.resources.length,
        tasks: answer.tasks.length,
      },
    });
    return answer;
  },
});
```

File: src/tasks/codegen.generate.task.ts

```ts
import { task, globals } from "@bluelibs/runner";
import { aiModel } from "../resources/aiModel.resource";
import { Agent } from "../ai/agent";
import { Plan } from "../ai/schemas";
import { codeGenerated } from "../events/ai.events";

const FileMapSchema = (v: any) => v; // simple passthrough

export const codegenGenerate = task({
  id: "ai.tasks.codegen.generate",
  dependencies: {
    model: aiModel,
    eventManager: globals.resources.eventManager,
  },
  inputSchema: (v: any) => v, // expects { plan: Plan, style?: string }
  resultSchema: (v: any) => v, // returns { files: { [path]: { contents } } }
  run: async (
    input: { plan: any; style?: string },
    { model, eventManager }
  ) => {
    const codegen = new Agent("codegen", {
      description: "Generates TypeScript code for BlueLibs Runner",
      system:
        "Generate minimal, elegant TypeScript using BlueLibs Runner. Do not include explanations.",
      model,
    });

    const prompt = `
Generate TypeScript files implementing the following plan using BlueLibs Runner.
- Include resources, tasks, middleware, events, hooks aligned to the plan.
- Keep files small and composable; prefer clear namespacing.
- Return ONLY JSON as: { "files": { "<relative-path>": { "contents": "..." } } }

Plan:
${JSON.stringify(input.plan, null, 2)}
`;
    const schema = (v: any) => v; // accept JSON shape
    const { answer } = await codegen.ask<{
      files: Record<string, { contents: string }>;
    }>(prompt, {
      responseSchema: schema as any,
    });
    await eventManager.emit(codeGenerated, {
      files: (answer as any).files,
      plan: input.plan,
    });
    return answer;
  },
});
```

File: src/tasks/platform.writeFiles.task.ts

```ts
import { task, globals } from "@bluelibs/runner";
import { fsWriter } from "../resources/fs.resource";
import { filesWritten } from "../events/ai.events";

export const writeFiles = task({
  id: "platform.tasks.writeFiles",
  dependencies: {
    fsWriter,
    eventManager: globals.resources.eventManager,
    logger: globals.resources.logger,
  },
  inputSchema: (v: any) => v, // expects { rootDir: string, files: Record<string, { contents: string }> }
  resultSchema: (v: any) => v, // returns { written: string[] }
  run: async (
    input: { rootDir: string; files: Record<string, { contents: string }> },
    { fsWriter, eventManager, logger }
  ) => {
    const written = await fsWriter.writeFiles(input.rootDir, input.files);
    await eventManager.emit(filesWritten, { paths: written });
    logger.info("Files written", { count: written.length });
    return { written };
  },
});
```

File: src/tasks/orchestrator.run.task.ts

```ts
import { task, globals } from "@bluelibs/runner";
import { architectPlan } from "./architect.plan.task";
import { codegenGenerate } from "./codegen.generate.task";
import { writeFiles } from "./platform.writeFiles.task";

export const orchestrate = task({
  id: "ai.tasks.orchestrator.run",
  dependencies: { architectPlan, codegenGenerate, writeFiles },
  inputSchema: (v: any) => v, // { spec: ProjectSpec, rootDir: string }
  resultSchema: (v: any) => v, // { plan, files, written }
  run: async (
    input: { spec: any; rootDir: string },
    { architectPlan, codegenGenerate, writeFiles }
  ) => {
    const plan = await architectPlan(input.spec);
    const code = await codegenGenerate({ plan });
    const { written } = await writeFiles({
      rootDir: input.rootDir,
      files: code.files || {},
    });
    return { plan, files: code.files, written };
  },
});
```

File: src/tasks/design_utilities.task.ts

```ts
import { task } from "@bluelibs/runner";
import { z } from "zod";

export const design_utilities = task({
  id: "planning.tasks.design_utilities",
  inputSchema: z
    .object({
      // optionally accept inputs
    })
    .optional(),
  resultSchema: z.object({
    domains: z.array(z.string()),
    db: z
      .object({
        engine: z.string().nullable(),
        models: z.array(
          z.object({ name: z.string(), fields: z.array(z.string()) })
        ),
      })
      .optional(),
    routing: z.array(z.string()),
    authorization: z.array(z.string()),
    helpers: z.array(z.string()),
  }),
  run: async () => {
    return {
      domains: [
        "planning",
        "codegen",
        "ai",
        "platform",
        "security",
        "infra",
        "telemetry",
      ],
      db: { engine: null, models: [] },
      routing: ["express-ready-hook via httpTag"],
      authorization: ["task middleware role-based"],
      helpers: [
        "logger (built-in)",
        "fs writer resource",
        "smtp (future)",
        "winston (optional)",
      ],
    };
  },
});
```

File: src/tasks/architect_project.task.ts

```ts
import { task } from "@bluelibs/runner";
import { z } from "zod";

export const architect_project = task({
  id: "planning.tasks.architect_project",
  inputSchema: z
    .object({
      // general usage scope
    })
    .optional(),
  resultSchema: z.object({
    events: z.array(z.string()),
    hooks: z.array(z.string()),
    tasks: z.array(
      z.object({
        id: z.string(),
        payloadSchema: z.string().optional(),
        route: z.string().optional(),
        meta: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
          })
          .optional(),
      })
    ),
  }),
  run: async () => {
    return {
      events: [
        "ai.events.planCreated",
        "ai.events.codeGenerated",
        "ai.events.filesWritten",
        "ai.events.agentCompleted",
      ],
      hooks: ["app.hooks.registerRoutes"],
      tasks: [
        {
          id: "ai.tasks.architect.plan",
          meta: {
            title: "Architect Plan",
            description: "Plan Runner elements",
          },
        },
        {
          id: "ai.tasks.codegen.generate",
          meta: { title: "Generate Code", description: "Generate TS files" },
        },
        {
          id: "platform.tasks.writeFiles",
          meta: { title: "Write Files", description: "Persist files" },
        },
        {
          id: "ai.tasks.orchestrator.run",
          meta: { title: "Orchestrate", description: "E2E pipeline" },
        },
      ],
    };
  },
});
```

File: src/tasks/task_designer.task.ts

```ts
import { task } from "@bluelibs/runner";
import { z } from "zod";

export const task_designer = task({
  id: "planning.tasks.task_designer",
  inputSchema: z.object({
    bigContext: z.string(),
  }),
  resultSchema: z.object({
    plan: z.object({
      sequence: z.array(z.string()),
      parallel: z.array(z.array(z.string())),
      files: z.array(z.string()),
    }),
  }),
  run: async ({ bigContext }) => {
    return {
      plan: {
        sequence: [
          "1.1",
          "1.2",
          "2.1",
          "2.2",
          "2.3",
          "3.1",
          "3.2",
          "4.1",
          "5.1",
          "5.2",
        ],
        parallel: [
          ["2.2", "2.3"],
          ["3.1", "3.2"],
        ],
        files: [
          "tasks/1.1-bootstrap-runner.md",
          "tasks/1.2-model-and-agents.md",
          "tasks/2.1-architect-plan-task.md",
          "tasks/2.2-codegen-generate-task.md",
          "tasks/2.3-filesystem-writer-task.md",
          "tasks/3.1-events-and-hooks.md",
          "tasks/3.2-middleware-and-tags.md",
          "tasks/4.1-orchestrator-pipeline.md",
          "tasks/5.1-testing-harness.md",
          "tasks/5.2-sample-tests.md",
        ],
      },
    };
  },
});
```

File: src/tasks/implement.task.ts

```ts
import { task } from "@bluelibs/runner";
import { z } from "zod";

export const write_task = task({
  id: "planning.tasks.write_task",
  inputSchema: z.object({
    resources: z.array(z.string()).default([]),
    middleware: z.array(z.string()).default([]),
    model: z.string().optional(),
    acceptance: z.array(z.string()).default([]),
  }),
  resultSchema: z.object({
    ok: z.boolean(),
  }),
  run: async () => ({ ok: true }),
});

export const write_event = task({
  id: "planning.tasks.write_event",
  run: async () => ({ ok: true }),
});

export const write_middleware = task({
  id: "planning.tasks.write_middleware",
  run: async () => ({ ok: true }),
});
```

File: src/app.ts (root resource and wiring)

```ts
import { resource, run, globals } from "@bluelibs/runner";
import { aiModel } from "./resources/aiModel.resource";
import { fsWriter } from "./resources/fs.resource";
import { architectPlan } from "./tasks/architect.plan.task";
import { codegenGenerate } from "./tasks/codegen.generate.task";
import { writeFiles } from "./tasks/platform.writeFiles.task";
import { orchestrate } from "./tasks/orchestrator.run.task";
import { registerRoutes } from "./hooks/registerRoutes.hook";
import { design_utilities } from "./tasks/design_utilities.task";
import { architect_project } from "./tasks/architect_project.task";
import { task_designer } from "./tasks/task_designer.task";
import {
  write_task,
  write_event,
  write_middleware,
} from "./tasks/implement.task";

export const app = resource({
  id: "app",
  register: [
    aiModel.with({ model: "gpt-4o-mini" }),
    fsWriter,
    architectPlan,
    codegenGenerate,
    writeFiles,
    orchestrate,
    registerRoutes,
    design_utilities,
    architect_project,
    task_designer,
    write_task,
    write_event,
    write_middleware,
  ],
  init: async (_, {}) => {},
});

export async function main() {
  const rr = await run(app, {
    debug: "normal",
    logs: { printThreshold: "info", printStrategy: "pretty" },
  });

  // Example execution: architect.plan(resources)
  const plan = await rr.runTask(architectPlan, {
    brief:
      "Create a simple service that plans, generates, and writes runner-based code using AI.",
    existingResources: ["ai.resources.model", "platform.resources.fsWriter"],
    nonFunctional: [
      "testable",
      "composable agents",
      "observability via events",
    ],
    constraints: ["use BlueLibs Runner only", "TypeScript"],
    docs: "BlueLibs Runner minimal guide here (shortened)...",
  });

  // Full pipeline
  // const res = await rr.runTask(orchestrate, { spec: ..., rootDir: "./out" });

  await rr.dispose();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

Tests

File: tests/architect.plan.spec.ts

```ts
import { resource, run, override } from "@bluelibs/runner";
import { app } from "../src/app";
import { aiModel } from "../src/resources/aiModel.resource";
import { MockModel } from "../src/ai/model";
import { Plan } from "../src/ai/schemas";
import { architectPlan } from "../src/tasks/architect.plan.task";

const mockPlan = Plan.parse({
  resources: [{ id: "platform.resources.fsWriter" }],
  middleware: [{ id: "security.middleware.auth", type: "task" }],
  events: [{ id: "ai.events.planCreated" }],
  hooks: [{ id: "app.hooks.registerRoutes", on: "ready" }],
  tasks: [{ id: "ai.tasks.architect.plan" }],
  tests: [{ id: "T-1", description: "Plan emitted", acceptance: ["ok"] }],
});

const mockedModelResource = override(aiModel, {
  init: async () => new MockModel([mockPlan]),
});

const harness = resource({
  id: "test",
  register: [app],
  overrides: [mockedModelResource],
});

describe("architect.plan", () => {
  it("returns a valid plan", async () => {
    const rr = await run(harness);
    const out = await rr.runTask(architectPlan, {
      brief: "Test brief",
      existingResources: [],
      nonFunctional: [],
      constraints: [],
      docs: "Runner docs",
    });
    expect(out).toBeTruthy();
    expect(out.resources.length).toBeGreaterThan(0);
    await rr.dispose();
  });
});
```

File: tests/orchestrator.run.spec.ts

```ts
import { resource, run, override } from "@bluelibs/runner";
import { app } from "../src/app";
import { aiModel } from "../src/resources/aiModel.resource";
import { MockModel } from "../src/ai/model";
import { orchestrate } from "../src/tasks/orchestrator.run.task";
import { Plan } from "../src/ai/schemas";

const mockPlan = Plan.parse({
  resources: [{ id: "platform.resources.fsWriter" }],
  middleware: [],
  events: [],
  hooks: [],
  tasks: [],
  tests: [],
});

const mockFiles = {
  files: {
    "src/hello.ts": { contents: `export const hello = () => "world";` },
  },
};

const mockedModelResource = override(aiModel, {
  init: async () => new MockModel([mockPlan, mockFiles]),
});

const harness = resource({
  id: "test",
  register: [app],
  overrides: [mockedModelResource],
});

describe("orchestrator.run", () => {
  it("runs full pipeline", async () => {
    const rr = await run(harness);
    const out = await rr.runTask(orchestrate, {
      spec: {
        brief: "Generate a small file",
        existingResources: [],
        nonFunctional: [],
        constraints: [],
        docs: "Runner docs",
      },
      rootDir: "./.out-test",
    });
    expect(out.plan.resources.length).toBeGreaterThan(0);
    expect(out.files["src/hello.ts"].contents).toContain("hello");
    expect(out.written.length).toBeGreaterThan(0);
    await rr.dispose();
  });
});
```

How the multi-agent composition works

- Agent base class abstracts a model with consistent ask() semantics, schema enforcement, and optional tool calling.
- ArchitectAgent is represented via the architectPlan task using an Agent configured for planning with a Plan schema; it returns a strongly typed Plan.
- CodeGenAgent is represented via codegenGenerate task using an Agent configured for code generation that returns a file map.
- A CriticAgent is simple to add: e.g., a reviewing task that uses a schema { ok: boolean; comments: string[] }, and returns feedback; you can then wire it before writeFiles, and optionally re-ask the codegen with the feedback in history.
- Orchestrator composes the pipeline using tasks; you can add middleware at each step, and subscribe to events for observability.

Design strategy as markdown (sequential with some parallelizable groups)

- Task1: Bootstrap Runner
- Task2: Model & Agents
- Task3: Plan & Codegen
  - Task3.1: Architect Plan
    - Task3.1.1: Plan schema and prompt
    - Task3.1.2: Plan task with retries
  - Task3.2: Codegen Generate
    - Task3.2.1: Codegen prompt
    - Task3.2.2: Schema and output map
- Task4: IO & Infra
  - Task4.1: Filesystem Writer task
  - Task4.2: Events and Hooks
  - Task4.3: Middleware and Tags
- Task5: Orchestrator and Tests
  - Task5.1: Orchestrate pipeline
  - Task5.2: Harness and MockModel tests

Backlog and task files

I created the following files for you to download:

- Backlog.md: [Download Backlog.md](sandbox:/mnt/data/ai-runner-plan/Backlog.md)
- Tasks directory: [Open tasks](sandbox:/mnt/data/ai-runner-plan/tasks)

They contain:

- 1.1-bootstrap-runner.md
- 1.2-model-and-agents.md
- 2.1-architect-plan-task.md
- 2.2-codegen-generate-task.md
- 2.3-filesystem-writer-task.md
- 3.1-events-and-hooks.md
- 3.2-middleware-and-tags.md
- 4.1-orchestrator-pipeline.md
- 5.1-testing-harness.md
- 5.2-sample-tests.md

Usage examples

- architect.plan(resources) to get a JSON Plan via OpenAI:

```ts
const rr = await run(app);
const plan = await rr.runTask("ai.tasks.architect.plan", {
  brief: "Build a user API with events and hooks",
  existingResources: ["platform.resources.fsWriter"],
  nonFunctional: ["Resilient", "Observable"],
  constraints: ["Use BlueLibs Runner only"],
  docs: "Paste the Runner guide here for best results",
});
console.log(plan);
await rr.dispose();
```

- Orchestrate the full pipeline:

```ts
const res = await rr.runTask("ai.tasks.orchestrator.run", {
  spec: {
    brief: "Simple service scaffold",
    existingResources: ["ai.resources.model"],
    nonFunctional: ["testable", "elegant"],
    constraints: [],
    docs: "Runner guide here",
  },
  rootDir: "./out",
});
console.log(res.written);
```
