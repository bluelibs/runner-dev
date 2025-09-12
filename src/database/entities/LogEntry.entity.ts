import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import type { LogLevel } from '../../resources/live.resource';

@Entity()
@Index({ properties: ['timestampMs'] })
@Index({ properties: ['level'] })
@Index({ properties: ['correlationId'] })
export class LogEntryEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  timestampMs!: number;

  @Property()
  level!: LogLevel;

  @Property({ type: 'text' })
  message!: string;

  @Property({ nullable: true })
  sourceId?: string;

  @Property({ type: 'json', nullable: true })
  data?: unknown;

  @Property({ nullable: true })
  correlationId?: string;
}