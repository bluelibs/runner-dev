import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity()
@Index({ properties: ['timestampMs'] })
@Index({ properties: ['sourceKind'] })
@Index({ properties: ['correlationId'] })
export class ErrorEntryEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  timestampMs!: number;

  @Property()
  sourceId!: string;

  @Property()
  sourceKind!: "TASK" | "HOOK" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL";

  @Property({ type: 'text' })
  message!: string;

  @Property({ type: 'text', nullable: true })
  stack?: string;

  @Property({ type: 'json', nullable: true })
  data?: unknown;

  @Property({ nullable: true })
  correlationId?: string;
}