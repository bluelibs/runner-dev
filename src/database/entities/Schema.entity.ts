import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity()
export class SchemaEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  version!: string;

  @Property({ type: 'json' })
  schema!: unknown;

  @Property()
  createdAt!: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt!: Date;
}