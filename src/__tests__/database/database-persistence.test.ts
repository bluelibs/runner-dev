import { DatabaseService, DatabaseLive } from '../../database';
import { LogLevel } from '../../resources/live.resource';
import path from 'path';
import fs from 'fs';

describe('Database Persistence', () => {
  let databaseService: DatabaseService;
  let databaseLive: DatabaseLive;
  const testDbPath = path.join(__dirname, 'test-telemetry.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    databaseService = new DatabaseService();
    await databaseService.initialize({
      driver: 'sqlite',
      options: {
        filePath: testDbPath,
      },
    });
    databaseLive = new DatabaseLive(databaseService);
  });

  afterEach(async () => {
    await databaseService.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should initialize database service', () => {
    expect(databaseService.isInitialized()).toBe(true);
  });

  test('should persist and retrieve log entries', async () => {
    // Record a log entry
    await databaseLive.recordLogAsync('info', 'Test message', { test: true }, 'corr-123', 'test-source');

    // Retrieve log entries
    const logs = await databaseLive.getLogsAsync();
    
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('Test message');
    expect(logs[0].sourceId).toBe('test-source');
    expect(logs[0].correlationId).toBe('corr-123');
    expect(logs[0].data).toEqual({ test: true });
    expect(logs[0].timestampMs).toBeGreaterThan(0);
  });

  test('should persist and retrieve emission entries', async () => {
    // Record an emission entry
    await databaseLive.recordEmissionAsync('test.event', { eventData: 'value' }, 'test-emitter');

    // Retrieve emission entries
    const emissions = await databaseLive.getEmissionsAsync();
    
    expect(emissions).toHaveLength(1);
    expect(emissions[0].eventId).toBe('test.event');
    expect(emissions[0].emitterId).toBe('test-emitter');
    expect(emissions[0].payload).toEqual({ eventData: 'value' });
    expect(emissions[0].timestampMs).toBeGreaterThan(0);
  });

  test('should persist and retrieve error entries', async () => {
    const testError = new Error('Test error');
    
    // Record an error entry
    await databaseLive.recordErrorAsync('test-source', 'TASK', testError, { extra: 'data' });

    // Retrieve error entries
    const errors = await databaseLive.getErrorsAsync();
    
    expect(errors).toHaveLength(1);
    expect(errors[0].sourceId).toBe('test-source');
    expect(errors[0].sourceKind).toBe('TASK');
    expect(errors[0].message).toBe('Test error');
    expect(errors[0].stack).toContain('Error: Test error');
    expect(errors[0].data).toEqual({ extra: 'data' });
    expect(errors[0].timestampMs).toBeGreaterThan(0);
  });

  test('should persist and retrieve run records', async () => {
    // Record a run record
    await databaseLive.recordRunAsync('test.task', 'TASK', 150, true, undefined, 'parent-123', 'root-456');

    // Retrieve run records
    const runs = await databaseLive.getRunsAsync();
    
    expect(runs).toHaveLength(1);
    expect(runs[0].nodeId).toBe('test.task');
    expect(runs[0].nodeKind).toBe('TASK');
    expect(runs[0].durationMs).toBe(150);
    expect(runs[0].ok).toBe(true);
    expect(runs[0].error).toBeNull();
    expect(runs[0].parentId).toBe('parent-123');
    expect(runs[0].rootId).toBe('root-456');
    expect(runs[0].timestampMs).toBeGreaterThan(0);
  });

  test('should filter log entries by level', async () => {
    // Record multiple log entries with different levels
    await databaseLive.recordLogAsync('info', 'Info message');
    await databaseLive.recordLogAsync('error', 'Error message');
    await databaseLive.recordLogAsync('debug', 'Debug message');

    // Filter by error level only
    const errorLogs = await databaseLive.getLogsAsync({ levels: ['error'] });
    
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe('error');
    expect(errorLogs[0].message).toBe('Error message');
  });

  test('should limit results with last parameter', async () => {
    // Record multiple log entries
    for (let i = 0; i < 5; i++) {
      await databaseLive.recordLogAsync('info', `Message ${i}`);
    }

    // Get only last 2 entries
    const recentLogs = await databaseLive.getLogsAsync({ last: 2 });
    
    expect(recentLogs).toHaveLength(2);
  });

  test('should throw error for synchronous methods', () => {
    expect(() => databaseLive.getLogs()).toThrow('Database-backed Live service only supports async operations');
    expect(() => databaseLive.getEmissions()).toThrow('Database-backed Live service only supports async operations');
    expect(() => databaseLive.getErrors()).toThrow('Database-backed Live service only supports async operations');
    expect(() => databaseLive.getRuns()).toThrow('Database-backed Live service only supports async operations');
  });
});