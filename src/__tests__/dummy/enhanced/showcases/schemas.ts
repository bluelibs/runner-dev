import { Match } from "@bluelibs/runner";

function defineCompiledSchema<TShape extends Record<string, unknown>>(
  shape: TShape
) {
  return Match.compile(Match.ObjectIncluding(shape));
}

export const regionPattern: any = Match.OneOf("US", "EU", "APAC");

export const positiveNumberPattern: any = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0
);

export const nonNegativeIntegerPattern: any = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
);

export const InterceptorInputSchema = defineCompiledSchema({
  value: Number,
});

export const InterceptorResultSchema = defineCompiledSchema({
  value: Number,
  intercepted: Boolean,
});

export const FeaturedTagConfigSchema = defineCompiledSchema({
  source: Match.OneOf("catalog", "search"),
});

export const CatalogSearchInputSchema = defineCompiledSchema({
  query: Match.Optional(String),
});

export const CatalogSearchResultSchema = defineCompiledSchema({
  query: String,
  total: nonNegativeIntegerPattern,
});

export const FeaturedInspectorResultSchema = defineCompiledSchema({
  taggedTaskIds: Match.ArrayOf(String),
  taggedResourceIds: Match.ArrayOf(String),
});

export const RpcPricingPreviewInputSchema = defineCompiledSchema({
  sku: String,
  basePrice: positiveNumberPattern,
  region: Match.Optional(regionPattern),
});

export const RpcPricingPreviewResultSchema = defineCompiledSchema({
  sku: String,
  adjustedPrice: positiveNumberPattern,
  source: Match.OneOf("rpc-lane-task"),
});

export const RpcCatalogSyncInputSchema = defineCompiledSchema({
  supplierId: String,
  changedSkus: Match.NonEmptyArray(String),
});

export const RpcCatalogSyncResultSchema = defineCompiledSchema({
  supplierId: String,
  syncedCount: nonNegativeIntegerPattern,
  emittedEvent: String,
});

export const LaneCatalogUpdatedPayloadSchema = defineCompiledSchema({
  supplierId: String,
  updatedAt: Date,
});

export const LaneCatalogProjectionUpdatedPayloadSchema = defineCompiledSchema({
  supplierId: String,
  projectedAt: Date,
});

export const DurableOrderApprovalInputSchema = defineCompiledSchema({
  orderId: String,
  amount: positiveNumberPattern,
  region: Match.OneOf("US", "EU", "APAC"),
});

export const DurableOrderApprovalResultSchema = defineCompiledSchema({
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
});

export const DurableExecutionIdResultSchema = defineCompiledSchema({
  executionId: String,
});

export const SupportProbeInputSchema = defineCompiledSchema({
  fail: Match.Optional(Boolean),
  requestId: Match.Optional(String),
});

export const SupportProbeResultSchema = defineCompiledSchema({
  ok: Boolean,
  requestId: String,
});

export const InvalidInputErrorDataSchema = defineCompiledSchema({
  field: String,
  message: String,
});

export type InvalidInputErrorData = {
  field: string;
  message: string;
};
