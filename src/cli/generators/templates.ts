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
  // tags: [],
  // dependencies: { /* other resources */ },
  init: async (_config: ${pascal}Config, _deps): Promise<${pascal}Value> => {
    // Initialize and return the resource value
    return {} as ${pascal}Value;
  },
  // dispose: async (value, _config, _deps) => { /* clean up */ },
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
  // middleware: [],
  // dependencies: { /* resources */ },
  run: async (_input: ${pascal}Input, _deps): Promise<${pascal}Result> => {
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
  // tags: [],
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
  // everywhere: true,
  run: async ({ task, next }, _deps, _config) => {
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
  run: async ({ next }, _deps, _config) => {
    const value = await next();
    // Wrap or augment the resource value here
    return value;
  },
});
`;
}
