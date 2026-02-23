import { r } from "@bluelibs/runner";

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
  .meta({
    title: "Request Context",
    description:
      "Carries request-scoped metadata such as request identity, session hints, and client details.",
  })
  .parse(
    (value) =>
      JSON.parse(value) as {
        requestId: string;
        userId?: string;
        sessionId?: string;
        correlationId?: string;
        userAgent?: string;
        ipAddress?: string;
        timestamp: Date;
      }
  )
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
    settings: Record<string, unknown>;
  }>("app.contexts.tenant")
  .meta({
    title: "Tenant Context",
    description:
      "Holds tenant-specific runtime configuration including localization, feature flags, and settings.",
  })
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
    metadata: Record<string, unknown>;
    tags: string[];
  }>("app.contexts.audit")
  .meta({
    title: "Audit Context",
    description:
      "Tracks traceability data for observability and auditing, including trace identifiers and operation metadata.",
  })
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
  .meta({
    title: "Security Context",
    description:
      "Stores authentication and authorization state such as roles, permissions, token data, and trust level.",
  })
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
  .meta({
    title: "Business Context",
    description:
      "Captures business segmentation information like unit, region, channel, and campaign scope.",
  })
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
      metadata?: Record<string, unknown>;
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
  .meta({
    title: "Performance Context",
    description:
      "Collects operation performance details such as checkpoints, memory stats, warnings, and slow query signals.",
  })
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
  .meta({
    title: "Cache Context",
    description:
      "Represents per-operation cache behavior, including strategy, hit/miss counters, and invalidation tags.",
  })
  .parse((raw) => JSON.parse(raw))
  .serialize((data) => JSON.stringify(data))
  .build();

// ====================
// CONTEXT MIDDLEWARE
// ====================

export const requestContextMiddleware = r.middleware
  .task("app.middleware.requestContext")
  .dependencies({ requestContext: RequestContext })
  .applyTo("where-visible", (task) => !task.id.startsWith("system."))
  .run(async ({ task, next }, { requestContext: _requestContext }) => {
    const _contextData = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    return await next(task.input);
  })
  .build();

export const auditContextMiddleware = r.middleware
  .task("app.middleware.auditContext")
  .dependencies({ auditContext: AuditContext })
  .applyTo(
    "where-visible",
    (task) => task.id.startsWith("app.") || task.id.startsWith("api.")
  )
  .run(async ({ task, next }, { auditContext }) => {
    return await auditContext.provide(
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
  .applyTo("where-visible", (_task) => true) // Apply to all tasks for demo
  .run(async ({ task, next }, { performanceContext: _performanceContext }) => {
    const _performanceData = {
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
