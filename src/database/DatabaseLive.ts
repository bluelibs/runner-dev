import { EntityManager } from '@mikro-orm/core';
import { DatabaseService } from './DatabaseService';
import {
  Live,
  LogLevel,
  LogEntry,
  EmissionEntry,
  ErrorEntry,
  RunRecord,
} from '../resources/live.resource';
import {
  LogEntryEntity,
  EmissionEntryEntity,
  ErrorEntryEntity,
  RunRecordEntity,
} from './entities';
import { getCorrelationId } from '../resources/telemetry.chain';

export class DatabaseLive implements Live {
  private em: EntityManager;

  constructor(private databaseService: DatabaseService) {
    this.em = databaseService.getEntityManager();
  }

  private toOptions = <T extends object>(arg: number | T | undefined): T => {
    if (typeof arg === "number") {
      return { ...(arg != null ? { afterTimestamp: arg } : {}) } as T;
    }
    return (arg ?? ({} as T)) as T;
  };

  private normalizeError = (
    error: unknown
  ): { message: string; stack: string | null } => {
    if (error instanceof Error)
      return { message: error.message, stack: error.stack ?? null };
    if (typeof error === "string") return { message: error, stack: null };
    try {
      return { message: JSON.stringify(error), stack: null };
    } catch {
      return { message: String(error), stack: null };
    }
  };

  getLogs(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          levels?: LogLevel[];
          messageIncludes?: string;
          correlationIds?: string[];
        }
  ): LogEntry[] {
    throw new Error("Database-backed Live service only supports async operations. Use await live.getLogsAsync()");
  }

  getEmissions(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          eventIds?: string[];
          emitterIds?: string[];
          correlationIds?: string[];
        }
  ): EmissionEntry[] {
    throw new Error("Database-backed Live service only supports async operations. Use await live.getEmissionsAsync()");
  }

  getErrors(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          sourceKinds?: (
            | "TASK"
            | "HOOK"
            | "RESOURCE"
            | "MIDDLEWARE"
            | "INTERNAL"
          )[];
          sourceIds?: string[];
          messageIncludes?: string;
          correlationIds?: string[];
        }
  ): ErrorEntry[] {
    throw new Error("Database-backed Live service only supports async operations. Use await live.getErrorsAsync()");
  }

  getRuns(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          nodeKinds?: ("TASK" | "HOOK")[];
          nodeIds?: string[];
          ok?: boolean;
          parentIds?: string[];
          rootIds?: string[];
        }
  ): RunRecord[] {
    throw new Error("Database-backed Live service only supports async operations. Use await live.getRunsAsync()");
  }

  async getLogsAsync(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          levels?: LogLevel[];
          messageIncludes?: string;
          correlationIds?: string[];
        }
  ): Promise<LogEntry[]> {
    const opts = this.toOptions<{
      afterTimestamp?: number;
      last?: number;
      levels?: LogLevel[];
      messageIncludes?: string;
      correlationIds?: string[];
    }>(options);

    const where: any = {};

    if (typeof opts.afterTimestamp === "number") {
      where.timestampMs = { $gt: opts.afterTimestamp };
    }
    if (opts.levels && opts.levels.length > 0) {
      where.level = { $in: opts.levels };
    }
    if (opts.messageIncludes) {
      where.message = { $like: `%${opts.messageIncludes}%` };
    }
    if (opts.correlationIds && opts.correlationIds.length > 0) {
      where.correlationId = { $in: opts.correlationIds };
    }

    const entities = await this.em.find(LogEntryEntity, where, {
      orderBy: { timestampMs: 'ASC' },
      limit: opts.last && opts.last > 0 ? opts.last : undefined,
    });

    return entities.map((entity: LogEntryEntity) => ({
      timestampMs: entity.timestampMs,
      level: entity.level,
      message: entity.message,
      sourceId: entity.sourceId ?? null,
      data: entity.data,
      correlationId: entity.correlationId ?? null,
    }));
  }

  async getEmissionsAsync(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          eventIds?: string[];
          emitterIds?: string[];
          correlationIds?: string[];
        }
  ): Promise<EmissionEntry[]> {
    const opts = this.toOptions<{
      afterTimestamp?: number;
      last?: number;
      eventIds?: string[];
      emitterIds?: string[];
      correlationIds?: string[];
    }>(options);

    const where: any = {};

    if (typeof opts.afterTimestamp === "number") {
      where.timestampMs = { $gt: opts.afterTimestamp };
    }
    if (opts.eventIds && opts.eventIds.length > 0) {
      where.eventId = { $in: opts.eventIds };
    }
    if (opts.emitterIds && opts.emitterIds.length > 0) {
      where.emitterId = { $in: opts.emitterIds };
    }
    if (opts.correlationIds && opts.correlationIds.length > 0) {
      where.correlationId = { $in: opts.correlationIds };
    }

    const entities = await this.em.find(EmissionEntryEntity, where, {
      orderBy: { timestampMs: 'ASC' },
      limit: opts.last && opts.last > 0 ? opts.last : undefined,
    });

    return entities.map((entity: EmissionEntryEntity) => ({
      timestampMs: entity.timestampMs,
      eventId: entity.eventId,
      emitterId: entity.emitterId ?? null,
      payload: entity.payload,
      correlationId: entity.correlationId ?? null,
    }));
  }

  async getErrorsAsync(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          sourceKinds?: (
            | "TASK"
            | "HOOK"
            | "RESOURCE"
            | "MIDDLEWARE"
            | "INTERNAL"
          )[];
          sourceIds?: string[];
          messageIncludes?: string;
          correlationIds?: string[];
        }
  ): Promise<ErrorEntry[]> {
    const opts = this.toOptions<{
      afterTimestamp?: number;
      last?: number;
      sourceKinds?: (
        | "TASK"
        | "HOOK"
        | "RESOURCE"
        | "MIDDLEWARE"
        | "INTERNAL"
      )[];
      sourceIds?: string[];
      messageIncludes?: string;
      correlationIds?: string[];
    }>(options);

    const where: any = {};

    if (typeof opts.afterTimestamp === "number") {
      where.timestampMs = { $gt: opts.afterTimestamp };
    }
    if (opts.sourceKinds && opts.sourceKinds.length > 0) {
      where.sourceKind = { $in: opts.sourceKinds };
    }
    if (opts.sourceIds && opts.sourceIds.length > 0) {
      where.sourceId = { $in: opts.sourceIds };
    }
    if (opts.messageIncludes) {
      where.message = { $like: `%${opts.messageIncludes}%` };
    }
    if (opts.correlationIds && opts.correlationIds.length > 0) {
      where.correlationId = { $in: opts.correlationIds };
    }

    const entities = await this.em.find(ErrorEntryEntity, where, {
      orderBy: { timestampMs: 'ASC' },
      limit: opts.last && opts.last > 0 ? opts.last : undefined,
    });

    return entities.map((entity: ErrorEntryEntity) => ({
      timestampMs: entity.timestampMs,
      sourceId: entity.sourceId,
      sourceKind: entity.sourceKind,
      message: entity.message,
      stack: entity.stack ?? null,
      data: entity.data,
      correlationId: entity.correlationId ?? null,
    }));
  }

  async getRunsAsync(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          nodeKinds?: ("TASK" | "HOOK")[];
          nodeIds?: string[];
          ok?: boolean;
          parentIds?: string[];
          rootIds?: string[];
        }
  ): Promise<RunRecord[]> {
    const opts = this.toOptions<{
      afterTimestamp?: number;
      last?: number;
      nodeKinds?: ("TASK" | "HOOK")[];
      nodeIds?: string[];
      ok?: boolean;
      parentIds?: string[];
      rootIds?: string[];
    }>(options);

    const where: any = {};

    if (typeof opts.afterTimestamp === "number") {
      where.timestampMs = { $gt: opts.afterTimestamp };
    }
    if (opts.nodeKinds && opts.nodeKinds.length > 0) {
      where.nodeKind = { $in: opts.nodeKinds };
    }
    if (opts.nodeIds && opts.nodeIds.length > 0) {
      where.nodeId = { $in: opts.nodeIds };
    }
    if (typeof opts.ok === "boolean") {
      where.ok = opts.ok;
    }
    if (opts.parentIds && opts.parentIds.length > 0) {
      where.parentId = { $in: opts.parentIds };
    }
    if (opts.rootIds && opts.rootIds.length > 0) {
      where.rootId = { $in: opts.rootIds };
    }

    const entities = await this.em.find(RunRecordEntity, where, {
      orderBy: { timestampMs: 'ASC' },
      limit: opts.last && opts.last > 0 ? opts.last : undefined,
    });

    return entities.map((entity: RunRecordEntity) => ({
      timestampMs: entity.timestampMs,
      nodeId: entity.nodeId,
      nodeKind: entity.nodeKind,
      durationMs: entity.durationMs,
      ok: entity.ok,
      error: entity.error ?? null,
      parentId: entity.parentId ?? null,
      rootId: entity.rootId ?? null,
      correlationId: entity.correlationId ?? null,
    }));
  }

  recordLog(
    level: LogLevel,
    message: string,
    data?: unknown,
    correlationId?: string | null,
    sourceId?: string | null
  ): void {
    // Fire and forget for synchronous compatibility
    this.recordLogAsync(level, message, data, correlationId, sourceId).catch(console.error);
  }

  recordEmission(
    eventId: string,
    payload?: unknown,
    emitterId?: string | null
  ): void {
    // Fire and forget for synchronous compatibility
    this.recordEmissionAsync(eventId, payload, emitterId).catch(console.error);
  }

  recordError(
    sourceId: string,
    sourceKind: "TASK" | "HOOK" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL",
    error: unknown,
    data?: unknown
  ): void {
    // Fire and forget for synchronous compatibility
    this.recordErrorAsync(sourceId, sourceKind, error, data).catch(console.error);
  }

  recordRun(
    nodeId: string,
    nodeKind: "TASK" | "HOOK",
    durationMs: number,
    ok: boolean,
    error?: unknown,
    parentId?: string | null,
    rootId?: string | null
  ): void {
    // Fire and forget for synchronous compatibility
    this.recordRunAsync(nodeId, nodeKind, durationMs, ok, error, parentId, rootId).catch(console.error);
  }

  async recordLogAsync(
    level: LogLevel,
    message: string,
    data?: unknown,
    correlationId?: string | null,
    sourceId?: string | null
  ): Promise<void> {
    const entity = new LogEntryEntity();
    entity.timestampMs = Date.now();
    entity.level = level;
    entity.message = message;
    entity.sourceId = sourceId ?? undefined;
    entity.data = data;
    entity.correlationId = correlationId ?? getCorrelationId() ?? undefined;

    this.em.persist(entity);
    await this.em.flush();
  }

  async recordEmissionAsync(
    eventId: string,
    payload?: unknown,
    emitterId?: string | null
  ): Promise<void> {
    const entity = new EmissionEntryEntity();
    entity.timestampMs = Date.now();
    entity.eventId = eventId;
    entity.emitterId = emitterId ?? undefined;
    entity.payload = payload;
    entity.correlationId = getCorrelationId() ?? undefined;

    this.em.persist(entity);
    await this.em.flush();
  }

  async recordErrorAsync(
    sourceId: string,
    sourceKind: "TASK" | "HOOK" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL",
    error: unknown,
    data?: unknown
  ): Promise<void> {
    const { message, stack } = this.normalizeError(error);
    const entity = new ErrorEntryEntity();
    entity.timestampMs = Date.now();
    entity.sourceId = sourceId;
    entity.sourceKind = sourceKind;
    entity.message = message;
    entity.stack = stack ?? undefined;
    entity.data = data;
    entity.correlationId = getCorrelationId() ?? undefined;

    this.em.persist(entity);
    await this.em.flush();
  }

  async recordRunAsync(
    nodeId: string,
    nodeKind: "TASK" | "HOOK",
    durationMs: number,
    ok: boolean,
    error?: unknown,
    parentId?: string | null,
    rootId?: string | null
  ): Promise<void> {
    const errStr = (() => {
      if (error == null) return null;
      if (typeof error === "string") return error;
      if (error instanceof Error) return error.message;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    })();

    const entity = new RunRecordEntity();
    entity.timestampMs = Date.now();
    entity.nodeId = nodeId;
    entity.nodeKind = nodeKind;
    entity.durationMs = durationMs;
    entity.ok = ok;
    entity.error = errStr ?? undefined;
    entity.parentId = parentId ?? undefined;
    entity.rootId = rootId ?? undefined;
    entity.correlationId = getCorrelationId() ?? undefined;

    this.em.persist(entity);
    await this.em.flush();
  }
}