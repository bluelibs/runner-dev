export function appTs(projectName: string) {
  return `import { r } from '@bluelibs/runner';
import { dev } from '@bluelibs/runner-dev';

export const app = r.resource('${projectName}')
  .register([
    dev.with({ port: 1337 }),
  ])
  .build();
`;
}
