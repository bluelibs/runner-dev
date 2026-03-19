export function mainTs(projectName: string) {
  return `import { run } from '@bluelibs/runner';
import { app } from './app';

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
