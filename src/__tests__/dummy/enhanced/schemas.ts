import { Match, type CheckSchemaLike } from "@bluelibs/runner";

const regionPattern = Match.OneOf("US", "EU", "APAC");
const httpMethodPattern = Match.OneOf("GET", "POST", "PATCH");
const visibilityPattern = Match.OneOf("public", "internal");
const positiveNumberPattern = Match.Range({ min: 0, inclusive: false });
const nonNegativeIntegerPattern = Match.Range({ min: 0, integer: true });

export const HttpTagConfigSchema = Match.compile(
  Match.ObjectIncluding({
    method: httpMethodPattern,
    path: String,
    visibility: visibilityPattern,
  })
) as CheckSchemaLike<{
  method: "GET" | "POST" | "PATCH";
  path: string;
  visibility: "public" | "internal";
}>;

export const FeaturedTagConfigSchema = Match.compile(
  Match.ObjectIncluding({
    source: Match.OneOf("catalog", "search", "api"),
  })
) as CheckSchemaLike<{
  source: "catalog" | "search" | "api";
}>;

export const HttpRequestContextSchema = Match.compile(
  Match.ObjectIncluding({
    requestId: String,
    method: httpMethodPattern,
    path: String,
    actorId: Match.Optional(String),
  })
) as CheckSchemaLike<{
  requestId: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  actorId?: string;
}>;

export const HttpServerConfigSchema = Match.compile(
  Match.ObjectIncluding({
    port: nonNegativeIntegerPattern,
    host: String,
  })
) as CheckSchemaLike<{
  port: number;
  host: string;
}>;

export const DatabaseConfigSchema = Match.compile(
  Match.ObjectIncluding({
    client: Match.OneOf("postgresql"),
    database: String,
    poolMin: nonNegativeIntegerPattern,
    poolMax: nonNegativeIntegerPattern,
  })
) as CheckSchemaLike<{
  client: "postgresql";
  database: string;
  poolMin: number;
  poolMax: number;
}>;

export const MikroOrmConfigSchema = Match.compile(
  Match.ObjectIncluding({
    contextName: String,
    debug: Boolean,
  })
) as CheckSchemaLike<{
  contextName: string;
  debug: boolean;
}>;

export const RepositoryConfigSchema = Match.compile(
  Match.ObjectIncluding({
    entityName: String,
  })
) as CheckSchemaLike<{
  entityName: string;
}>;

export const InterceptorInputSchema = Match.compile(
  Match.ObjectIncluding({
    value: Number,
  })
) as CheckSchemaLike<{ value: number }>;

export const InterceptorResultSchema = Match.compile(
  Match.ObjectIncluding({
    value: Number,
    intercepted: Boolean,
  })
) as CheckSchemaLike<{
  value: number;
  intercepted: boolean;
}>;

export const CatalogSearchInputSchema = Match.compile(
  Match.ObjectIncluding({
    query: Match.Optional(String),
    requestId: Match.Optional(String),
  })
) as CheckSchemaLike<{
  query?: string;
  requestId?: string;
}>;

export const CatalogSearchResultSchema = Match.compile(
  Match.ObjectIncluding({
    query: String,
    total: nonNegativeIntegerPattern,
    source: Match.OneOf("catalog-http-handler"),
  })
) as CheckSchemaLike<{
  query: string;
  total: number;
  source: "catalog-http-handler";
}>;

export const FeaturedInspectorResultSchema = Match.compile(
  Match.ObjectIncluding({
    taggedTaskIds: Match.ArrayOf(String),
    taggedResourceIds: Match.ArrayOf(String),
  })
) as CheckSchemaLike<{
  taggedTaskIds: string[];
  taggedResourceIds: string[];
}>;

export const RpcPricingPreviewInputSchema = Match.compile(
  Match.ObjectIncluding({
    sku: String,
    basePrice: positiveNumberPattern,
    region: Match.Optional(regionPattern),
  })
) as CheckSchemaLike<{
  sku: string;
  basePrice: number;
  region?: "US" | "EU" | "APAC";
}>;

export const RpcPricingPreviewResultSchema = Match.compile(
  Match.ObjectIncluding({
    sku: String,
    adjustedPrice: positiveNumberPattern,
    source: Match.OneOf("rpc-lane-task"),
  })
) as CheckSchemaLike<{
  sku: string;
  adjustedPrice: number;
  source: "rpc-lane-task";
}>;

export const RpcCatalogSyncInputSchema = Match.compile(
  Match.ObjectIncluding({
    supplierId: String,
    changedSkus: Match.NonEmptyArray(String),
  })
) as CheckSchemaLike<{
  supplierId: string;
  changedSkus: string[];
}>;

export const RpcCatalogSyncResultSchema = Match.compile(
  Match.ObjectIncluding({
    supplierId: String,
    syncedCount: nonNegativeIntegerPattern,
    emittedEvent: String,
  })
) as CheckSchemaLike<{
  supplierId: string;
  syncedCount: number;
  emittedEvent: string;
}>;

export const LaneCatalogUpdatedPayloadSchema = Match.compile(
  Match.ObjectIncluding({
    supplierId: String,
    changedSkus: Match.NonEmptyArray(String),
    source: Match.OneOf("catalog-sync"),
    updatedAt: Date,
  })
) as CheckSchemaLike<{
  supplierId: string;
  changedSkus: string[];
  source: "catalog-sync";
  updatedAt: Date;
}>;

export const LaneCatalogProjectionUpdatedPayloadSchema = Match.compile(
  Match.ObjectIncluding({
    supplierId: String,
    projectedAt: Date,
  })
) as CheckSchemaLike<{
  supplierId: string;
  projectedAt: Date;
}>;

export const DurableOrderApprovalInputSchema = Match.compile(
  Match.ObjectIncluding({
    orderId: String,
    amount: positiveNumberPattern,
    region: Match.OneOf("US", "EU", "APAC"),
  })
) as CheckSchemaLike<{
  orderId: string;
  amount: number;
  region: "US" | "EU" | "APAC";
}>;

export const DurableOrderApprovalResultSchema = Match.compile(
  Match.ObjectIncluding({
    orderId: String,
    status: Match.OneOf("approved"),
    riskScore: Match.Where(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
    ),
    approvalReference: String,
    cooldownMs: nonNegativeIntegerPattern,
  })
) as CheckSchemaLike<{
  orderId: string;
  status: "approved";
  riskScore: number;
  approvalReference: string;
  cooldownMs: number;
}>;

export const DurableExecutionIdResultSchema = Match.compile(
  Match.ObjectIncluding({
    executionId: String,
  })
) as CheckSchemaLike<{
  executionId: string;
}>;

export const SupportProbeInputSchema = Match.compile(
  Match.ObjectIncluding({
    fail: Match.Optional(Boolean),
    requestId: Match.Optional(String),
    actorId: Match.Optional(String),
  })
) as CheckSchemaLike<{
  fail?: boolean;
  requestId?: string;
  actorId?: string;
}>;

export const SupportProbeResultSchema = Match.compile(
  Match.ObjectIncluding({
    ok: Boolean,
    requestId: String,
    actorId: String,
  })
) as CheckSchemaLike<{
  ok: boolean;
  requestId: string;
  actorId: string;
}>;

export const InvalidInputErrorDataSchema = Match.compile(
  Match.ObjectIncluding({
    field: String,
    message: String,
  })
) as CheckSchemaLike<InvalidInputErrorData>;

export type InvalidInputErrorData = {
  field: string;
  message: string;
};
