export function mainTs(projectName: string) {
  return `import { r, run } from '@bluelibs/runner';
import { dev } from '@bluelibs/runner-dev';

// Minimal Runner 6.2 app using a root resource and runner-dev's dev resource
const app = r.resource('${projectName}')
  .register([
    dev.with({ port: 1337 }),
  ])
  .build();

run(app)
  .then(({ logger }) => {
    logger.info('Runner app started on http://localhost:1337');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
`;
}
