export function mainTs(projectName: string) {
  return `import { run } from '@bluelibs/runner';
import { app } from './app';

run(app)
  .then(({ logger }) => {
    logger.info('${projectName} is running!');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
`;
}
