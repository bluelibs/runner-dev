import { EntityManager } from '@mikro-orm/core';
import { DatabaseService } from './DatabaseService';
import { SchemaEntity } from './entities';

export interface SchemaData {
  tasks: any[];
  hooks: any[];
  resources: any[];
  events: any[];
  middlewares: any[];
  [key: string]: any;
}

export class SchemaService {
  private em: EntityManager;

  constructor(private databaseService: DatabaseService) {
    this.em = databaseService.getEntityManager();
  }

  async saveSchema(version: string, schema: SchemaData): Promise<void> {
    const existingSchema = await this.em.findOne(SchemaEntity, { version });
    
    if (existingSchema) {
      existingSchema.schema = schema;
      existingSchema.updatedAt = new Date();
    } else {
      const schemaEntity = new SchemaEntity();
      schemaEntity.version = version;
      schemaEntity.schema = schema;
      schemaEntity.createdAt = new Date();
      schemaEntity.updatedAt = new Date();
      this.em.persist(schemaEntity);
    }
    
    await this.em.flush();
  }

  async getLatestSchema(): Promise<SchemaData | null> {
    const latestSchema = await this.em.findOne(
      SchemaEntity,
      {},
      { orderBy: { updatedAt: 'DESC' } }
    );
    
    return latestSchema ? (latestSchema.schema as SchemaData) : null;
  }

  async getSchemaByVersion(version: string): Promise<SchemaData | null> {
    const schemaEntity = await this.em.findOne(SchemaEntity, { version });
    return schemaEntity ? (schemaEntity.schema as SchemaData) : null;
  }

  async getAllSchemaVersions(): Promise<string[]> {
    const schemas = await this.em.find(
      SchemaEntity,
      {},
      { orderBy: { updatedAt: 'DESC' } }
    );
    
    return schemas.map(s => s.version);
  }

  async deleteSchema(version: string): Promise<boolean> {
    const schema = await this.em.findOne(SchemaEntity, { version });
    if (schema) {
      await this.em.removeAndFlush(schema);
      return true;
    }
    return false;
  }
}