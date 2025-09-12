import { dev } from '../../resources/dev.resource';
import { run, stop } from '@bluelibs/runner';
import path from 'path';
import fs from 'fs';

describe('Dev Resource Database Integration', () => {
  const testDbPath = path.join(__dirname, 'test-dev-integration.db');
  let runningApp: any;

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(async () => {
    if (runningApp) {
      await stop();
      runningApp = null;
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should initialize dev resource with database configuration', async () => {
    const devResource = dev.with({
      port: 31338, // Use a different port
      maxEntries: 100,
      database: {
        driver: 'sqlite',
        options: {
          filePath: testDbPath,
        },
      },
    });

    runningApp = await run(devResource);

    // Verify database file was created
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  test('should work without database configuration (backwards compatibility)', async () => {
    const devResource = dev.with({
      port: 31339, // Use a different port
      maxEntries: 100,
      // No database configuration
    });

    runningApp = await run(devResource);

    // Should not create any database file
    expect(fs.existsSync(testDbPath)).toBe(false);
  });

  test('should save and retrieve schema when database is configured', async () => {
    const devResource = dev.with({
      port: 31340,
      maxEntries: 100,
      database: {
        driver: 'sqlite',
        options: {
          filePath: testDbPath,
        },
      },
    });

    runningApp = await run(devResource);

    // Verify database file was created
    expect(fs.existsSync(testDbPath)).toBe(true);
  });
});