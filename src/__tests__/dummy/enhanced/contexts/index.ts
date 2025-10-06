import { r } from "@bluelibs/runner";
import { z } from "zod";

// ====================
// REQUEST CONTEXT
// ====================

export const RequestContext = r
  .asyncContext<{
    requestId: string;
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
  }>("app.contexts.request")
  .parse((value) => value as any)
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// TENANT CONTEXT
// ====================

export const TenantContext = r
  .asyncContext<{
    tenantId: string;
    tenantName: string;
    timezone: string;
    currency: string;
    locale: string;
    features: Record<string, boolean>;
    settings: Record<string, any>;
  }>("app.contexts.tenant")
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// AUDIT CONTEXT
// ====================

export const AuditContext = r
  .asyncContext<{
    traceId: string;
    parentTraceId?: string;
    startTime: Date;
    operation: string;
    userId?: string;
    metadata: Record<string, any>;
    tags: string[];
  }>("app.contexts.audit")
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// SECURITY CONTEXT
// ====================

export const SecurityContext = r
  .asyncContext<{
    authToken?: string;
    permissions: string[];
    roles: string[];
    securityLevel: "public" | "user" | "admin" | "system";
    sessionId?: string;
    tokenExpiry?: Date;
    mfaVerified: boolean;
    ipAddress?: string;
  }>("app.contexts.security")
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// BUSINESS CONTEXT
// ====================

export const BusinessContext = r
  .asyncContext<{
    businessUnit: string;
    productLine?: string;
    costCenter?: string;
    region: string;
    channel: "web" | "mobile" | "api" | "batch";
    campaign?: string;
    segment?: string;
  }>("app.contexts.business")
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// PERFORMANCE CONTEXT
// ====================

export const PerformanceContext = r
  .asyncContext<{
    operationId: string;
    parentOperationId?: string;
    startTime: Date;
    checkpoints: Array<{
      name: string;
      timestamp: Date;
      duration: number;
      metadata?: Record<string, any>;
    }>;
    memoryUsage?: {
      initial: number;
      peak: number;
      final: number;
    };
    warnings: string[];
    slowQueries: Array<{
      query: string;
      duration: number;
      threshold: number;
    }>;
  }>("app.contexts.performance")
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// CACHE CONTEXT
// ====================

export const CacheContext = r
  .asyncContext<{
    cacheStrategy: "aggressive" | "moderate" | "minimal" | "disabled";
    ttlOverrides: Record<string, number>;
    invalidationTags: string[];
    cacheHits: number;
    cacheMisses: number;
    cacheKeyPrefix?: string;
  }>("app.contexts.cache")
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// CONTEXT MIDDLEWARE
// ====================

export const requestContextMiddleware = r.middleware
  .task("app.middleware.requestContext")
  .dependencies({ requestContext: RequestContext })
  .everywhere((task) => !task.id.startsWith("system."))
  .run(async ({ task, next }, { requestContext }) => {
    const contextData = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    return await next(task.input);
  })
  .build();

export const auditContextMiddleware = r.middleware
  .task("app.middleware.auditContext")
  .dependencies({ auditContext: AuditContext })
  .everywhere(
    (task) => task.id.startsWith("app.") || task.id.startsWith("api.")
  )
  .run(async ({ task, next }, { auditContext }) => {
    auditContext.provide(
      {
        traceId: `trace_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        startTime: new Date(),
        operation: task.definition.id,
        metadata: {},
        tags: [],
      },
      async () => {
        return await next(task.input);
      }
    );
  })
  .build();

export const performanceContextMiddleware = r.middleware
  .task("app.middleware.performanceContext")
  .dependencies({ performanceContext: PerformanceContext })
  .everywhere((task) => true) // Apply to all tasks for demo
  .run(async ({ task, next }, { performanceContext }) => {
    const performanceData = {
      operationId: `op_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      startTime: new Date(),
      checkpoints: [],
      warnings: [],
      slowQueries: [],
    };

    return await next(task.input);
  })
  .build();

// ====================
// CONTEXT COLLECTIONS
// ====================

export const CoreContexts = {
  RequestContext,
  AuditContext,
  SecurityContext,
} as const;

export const BusinessContexts = {
  TenantContext,
  BusinessContext,
} as const;

export const SystemContexts = {
  PerformanceContext,
  CacheContext,
} as const;

export const AllContexts = {
  ...CoreContexts,
  ...BusinessContexts,
  ...SystemContexts,
} as const;

export const ContextMiddleware = {
  requestContextMiddleware,
  auditContextMiddleware,
  performanceContextMiddleware,
} as const;
