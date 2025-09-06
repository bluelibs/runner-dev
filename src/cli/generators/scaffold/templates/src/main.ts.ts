export function mainTs(projectName: string) {
  return `import { run, resource } from '@bluelibs/runner';
import { dev } from '@bluelibs/runner-dev';

// Minimal Runner app using runner-dev's dev resource
const app = resource({
  id: 'app.${projectName}',
  register: [
    dev.with({ port: 1337 }),
  ],
});

run(app)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Runner app started on http://localhost:1337');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
`;
}
