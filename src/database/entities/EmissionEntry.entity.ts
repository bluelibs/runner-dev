import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity()
@Index({ properties: ['timestampMs'] })
@Index({ properties: ['eventId'] })
@Index({ properties: ['correlationId'] })
export class EmissionEntryEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  timestampMs!: number;

  @Property()
  eventId!: string;

  @Property({ nullable: true })
  emitterId?: string;

  @Property({ type: 'json', nullable: true })
  payload?: unknown;

  @Property({ nullable: true })
  correlationId?: string;
}