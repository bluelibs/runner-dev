export function appTest() {
  return `import { resources, run } from '@bluelibs/runner';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from './app';

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  while (runtimes.length > 0) {
    await runtimes.pop()?.dispose();
  }
});

describe('app', () => {
  it('boots the runtime and exposes the dev docs endpoint', async () => {
    const runtime = await run(app);
    runtimes.push(runtime);
    const store = await runtime.getResourceValue(resources.store);

    expect(runtime).toBeDefined();
    expect(store).toBe(runtime.store);
  });
});
`;
}
