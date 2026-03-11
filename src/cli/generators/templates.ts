type TemplateParams = {
  header: string;
  id: string;
  camel: string;
  pascal: string;
};

export function resourceTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { resource } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Add your config shape here
}

export interface ${pascal}Value {
  // The resource value (what init returns)
}

export const ${camel} = resource({
  id: '${id}',
  meta: {
    title: '${pascal} Resource',
    description: 'TODO: Add description for ${pascal} resource',
  },
  // tags: [],
  // dependencies: { /* other resources */ },
  init: async (config: ${pascal}Config, deps): Promise<${pascal}Value> => {
    // Initialize and return the resource value
    return {} as ${pascal}Value;
  },
  // dispose: async (value, config, deps) => { /* clean up */ },
});
`;
}

export function taskTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { task } from '@bluelibs/runner';

export interface ${pascal}Input {
  // Define input fields
}

export interface ${pascal}Result {
  // Define result fields
}

export const ${camel} = task({
  id: '${id}',
  meta: {
    title: '${pascal} Task',
    description: 'TODO: Add description for ${pascal} task',
  },
  // middleware: [],
  // dependencies: { /* resources */ },
  run: async (_input: ${pascal}Input, deps): Promise<${pascal}Result> => {
    return {} as ${pascal}Result;
  },
  // inputSchema,
  // resultSchema,
});
`;
}

export function eventTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { event } from '@bluelibs/runner';

export interface ${pascal}Payload {
  // Define event payload
}

export const ${camel} = event<${pascal}Payload>({
  id: '${id}',
  meta: {
    title: '${pascal} Event',
    description: 'TODO: Add description for ${pascal} event',
  },
  // tags: [],
});
`;
}

export function hookTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { hook } from '@bluelibs/runner';

export interface ${pascal}Payload {
  // The payload delivered to the hook from the event
}

export const ${camel} = hook({
  id: '${id}',
  meta: {
    title: '${pascal} Hook',
    description: 'TODO: Add description for ${pascal} hook',
  },
  // on: someEvent, // import your event and set it here
  // dependencies: { /* resources */ },
  run: async (event, deps) => {
    // Implement hook reaction logic
  },
});
`;
}

export function tagTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { tag } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Optional config carried by the tag (available via extract())
}

export interface ${pascal}InputContract {
  // Optional contract for inputs when used on tasks/middleware/resources
}

export interface ${pascal}ResultContract {
  // Optional contract for results
}

export const ${camel} = tag<${pascal}Config, ${pascal}InputContract, ${pascal}ResultContract>({
  id: '${id}',
  meta: {
    title: '${pascal} Tag',
    description: 'TODO: Add description for ${pascal} tag',
  },
});
`;
}

export function taskMiddlewareTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { taskMiddleware } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Configuration passed via .with({ ... })
}

export interface ${pascal}Input {
  // The task input before middleware
}

export interface ${pascal}Output {
  // The task output after middleware
}

export const ${camel} = taskMiddleware<${pascal}Config, ${pascal}Input, ${pascal}Output>({
  id: '${id}',
  meta: {
    title: '${pascal} Task Middleware',
    description: 'TODO: Add description for ${pascal} task middleware',
  },
  // Auto-apply globally via resource.subtree({ tasks: { middleware: [${camel}] } })
  // or intercept executions with globals.resources.taskRunner.intercept(...).
  run: async ({ task, next }, deps, config) => {
    // pre-process task.input
    const result = await next(task.input as ${pascal}Input);
    // post-process result
    return result as ${pascal}Output;
  },
});
`;
}

export function resourceMiddlewareTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { resourceMiddleware } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Configuration passed via .with({ ... })
}

export const ${camel} = resourceMiddleware<${pascal}Config>({
  id: '${id}',
  meta: {
    title: '${pascal} Resource Middleware',
    description: 'TODO: Add description for ${pascal} resource middleware',
  },
  run: async ({ next }, deps, config) => {
    const value = await next();
    // Wrap or augment the resource value here
    return value;
  },
});
`;
}
