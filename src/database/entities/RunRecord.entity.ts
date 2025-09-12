import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity()
@Index({ properties: ['timestampMs'] })
@Index({ properties: ['nodeKind'] })
@Index({ properties: ['ok'] })
@Index({ properties: ['correlationId'] })
export class RunRecordEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  timestampMs!: number;

  @Property()
  nodeId!: string;

  @Property()
  nodeKind!: "TASK" | "HOOK";

  @Property()
  durationMs!: number;

  @Property()
  ok!: boolean;

  @Property({ type: 'text', nullable: true })
  error?: string;

  @Property({ nullable: true })
  parentId?: string;

  @Property({ nullable: true })
  rootId?: string;

  @Property({ nullable: true })
  correlationId?: string;
}