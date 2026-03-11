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
import { r } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Add your config shape here
}

export interface ${pascal}Value {
  // The resource value (what init returns)
}

export const ${camel} = r
  .resource<${pascal}Config>('${id}')
  .meta({
    title: '${pascal} Resource',
    description: 'TODO: Add description for ${pascal} resource',
  })
  // .tags([])
  // .dependencies({ /* other resources */ })
  .init(async (config, deps): Promise<${pascal}Value> => {
    // Initialize and return the resource value
    return {} as ${pascal}Value;
  })
  // .dispose(async (value, config, deps) => { /* clean up */ })
  .build();
`;
}

export function taskTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { r } from '@bluelibs/runner';

export interface ${pascal}Input {
  // Define input fields
}

export interface ${pascal}Result {
  // Define result fields
}

export const ${camel} = r
  .task<${pascal}Input>('${id}')
  .meta({
    title: '${pascal} Task',
    description: 'TODO: Add description for ${pascal} task',
  })
  // .middleware([])
  // .dependencies({ /* resources */ })
  .run(async (_input, deps): Promise<${pascal}Result> => {
    return {} as ${pascal}Result;
  })
  // .inputSchema(...)
  // .resultSchema(...)
  .build();
`;
}

export function eventTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { r } from '@bluelibs/runner';

export interface ${pascal}Payload {
  // Define event payload
}

export const ${camel} = r
  .event<${pascal}Payload>('${id}')
  .meta({
    title: '${pascal} Event',
    description: 'TODO: Add description for ${pascal} event',
  })
  // .tags([])
  .build();
`;
}

export function hookTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { r } from '@bluelibs/runner';

export interface ${pascal}Payload {
  // The payload delivered to the hook from the event
}

export const ${camel} = r
  .hook('${id}')
  .meta({
    title: '${pascal} Hook',
    description: 'TODO: Add description for ${pascal} hook',
  })
  // .on(someEvent) // import your event and set it here
  // .dependencies({ /* resources */ })
  .run(async (event, deps) => {
    // Implement hook reaction logic
  })
  .build();
`;
}

export function tagTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { r } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Optional config carried by the tag (available via extract())
}

export interface ${pascal}InputContract {
  // Optional contract for inputs when used on tasks/middleware/resources
}

export interface ${pascal}ResultContract {
  // Optional contract for results
}

export const ${camel} = r
  .tag<${pascal}Config, ${pascal}InputContract, ${pascal}ResultContract>('${id}')
  .meta({
    title: '${pascal} Tag',
    description: 'TODO: Add description for ${pascal} tag',
  })
  .build();
`;
}

export function taskMiddlewareTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { r } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Configuration passed via .with({ ... })
}

export interface ${pascal}Input {
  // The task input before middleware
}

export interface ${pascal}Output {
  // The task output after middleware
}

export const ${camel} = r
  .taskMiddleware<${pascal}Config, ${pascal}Input, ${pascal}Output>('${id}')
  .meta({
    title: '${pascal} Task Middleware',
    description: 'TODO: Add description for ${pascal} task middleware',
  })
  // Auto-apply globally via resource.subtree({ tasks: { middleware: [${camel}] } })
  // or intercept executions with globals.resources.taskRunner.intercept(...).
  .run(async ({ task, next }, deps, config) => {
    // pre-process task.input
    const result = await next(task.input as ${pascal}Input);
    // post-process result
    return result as ${pascal}Output;
  })
  .build();
`;
}

export function resourceMiddlewareTemplate({
  header,
  id,
  camel,
  pascal,
}: TemplateParams): string {
  return `${header}
import { r } from '@bluelibs/runner';

export interface ${pascal}Config {
  // Configuration passed via .with({ ... })
}

export const ${camel} = r
  .resourceMiddleware<${pascal}Config>('${id}')
  .meta({
    title: '${pascal} Resource Middleware',
    description: 'TODO: Add description for ${pascal} resource middleware',
  })
  .run(async ({ next }, deps, config) => {
    const value = await next();
    // Wrap or augment the resource value here
    return value;
  })
  .build();
`;
}
