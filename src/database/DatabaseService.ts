import { MikroORM, EntityManager, Options } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { 
  LogEntryEntity, 
  EmissionEntryEntity, 
  ErrorEntryEntity, 
  RunRecordEntity,
  SchemaEntity 
} from './entities';

export interface DatabaseConfig {
  driver: 'sqlite';
  options: {
    filePath: string;
  };
}

export class DatabaseService {
  private orm?: MikroORM;
  private em?: EntityManager;

  async initialize(config: DatabaseConfig): Promise<void> {
    const mikroOrmConfig: Options = {
      driver: SqliteDriver,
      dbName: config.options.filePath,
      entities: [
        LogEntryEntity, 
        EmissionEntryEntity, 
        ErrorEntryEntity, 
        RunRecordEntity,
        SchemaEntity
      ],
      debug: false,
      strict: true,
    };

    this.orm = await MikroORM.init(mikroOrmConfig);
    this.em = this.orm.em.fork();

    // Create schema if it doesn't exist
    const generator = this.orm.getSchemaGenerator();
    await generator.ensureDatabase();
    try {
      await generator.createSchema();
    } catch (error) {
      // If tables already exist, try updating the schema
      try {
        await generator.updateSchema();
      } catch {
        // If updating fails, schema might already be correct
      }
    }
  }

  async close(): Promise<void> {
    if (this.orm) {
      await this.orm.close();
    }
  }

  getEntityManager(): EntityManager {
    if (!this.em) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.em;
  }

  isInitialized(): boolean {
    return !!this.orm && !!this.em;
  }
}